/**
 * 消息接口定义
 * @interface Message
 * @property {('user' | 'assistant' | 'system')} role - 消息发送者的角色
 * @property {string} content - 消息内容
 */
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * 进度回调函数类型定义
 * 用于处理流式响应的实时内容更新
 * @callback OnProgressCallback
 * @param {string} content - 新接收到的内容片段
 */
type OnProgressCallback = (content: string) => void;

/**
 * 延迟函数
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 带超时的 fetch 函数
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeout = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * 发送消息到 OpenRouter API 并处理流式响应
 * @async
 * @param {Message[]} messages - 对话历史消息数组
 * @param {string} apiKey - OpenRouter API 密钥
 * @param {OnProgressCallback} onProgress - 处理流式响应的回调函数
 * @throws {Error} 当 API Key 无效或请求失败时抛出错误
 */
export async function sendMessage(
  messages: Message[],
  apiKey: string,
  onProgress: OnProgressCallback
): Promise<void> {
  // 验证 API Key
  if (!apiKey.trim()) {
    throw new Error('请提供有效的 API Key');
  }

  const maxRetries = 3;
  let retryCount = 0;
  let lastError: Error | null = null;

  while (retryCount < maxRetries) {
    try {
      console.log(`尝试发送请求 (${retryCount + 1}/${maxRetries})...`);
      
      const response = await fetchWithTimeout(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'AI-ChatBot',
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({
            model: 'mistralai/mistral-7b-instruct',  // 使用 Mistral AI 的模型
            messages: [
              {
                role: 'system',
                content: '你是一个有帮助的AI助手，请用简洁、专业的中文回答问题。'
              },
              ...messages.map(msg => ({
                role: msg.role,
                content: msg.content
              }))
            ],
            stream: true,
            temperature: 0.7,
            max_tokens: 2000,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
          }),
        },
        30000 // 30 秒超时
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API 响应错误:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });

        try {
          const errorData = JSON.parse(errorText);
          const providerError = errorData?.error?.metadata?.raw;
          if (providerError) {
            const parsedProviderError = JSON.parse(providerError);
            const errorMessage = parsedProviderError?.error?.message;
            if (errorMessage) {
              throw new Error(`服务提供商错误: ${errorMessage}`);
            }
          }
          const errorMessage = errorData?.error?.message;
          if (errorMessage) {
            throw new Error(`OpenRouter API 错误: ${errorMessage}`);
          }
        } catch (e) {
          console.warn('解析错误信息失败:', e);
        }

        // 对特定错误码进行处理
        if (response.status === 429) {
          throw new Error('请求过于频繁，请稍后再试');
        } else if (response.status === 401) {
          throw new Error('API Key 无效或已过期，请检查你的 OpenRouter API Key');
        } else if (response.status === 403) {
          throw new Error('访问被拒绝，请检查 API Key 权限或尝试使用其他模型');
        } else if (response.status === 503) {
          throw new Error('服务暂时不可用，请稍后再试');
        }

        throw new Error(`API请求失败: ${response.status} ${response.statusText}\n${errorText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      try {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('响应流读取完成');
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // 处理完整的 SSE 消息
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留不完整的最后一行

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                console.log('收到结束标记');
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                if (!parsed || !parsed.choices || !Array.isArray(parsed.choices) || parsed.choices.length === 0) {
                  console.warn('无效的 SSE 消息格式:', data);
                  continue;
                }

                const choice = parsed.choices[0];
                if (!choice || !choice.delta) {
                  console.warn('无效的 choice 格式:', choice);
                  continue;
                }

                const content = choice.delta.content;
                if (content !== undefined && content !== null) {
                  onProgress(content);
                }
              } catch (e) {
                console.warn('解析 SSE 消息时出错:', e, '\n原始数据:', data);
                continue;
              }
            }
          }
        }
      } catch (error) {
        console.error('读取响应流时出错:', error);
        throw error;
      } finally {
        try {
          await reader.cancel();
          console.log('响应流已关闭');
        } catch (error) {
          console.warn('关闭响应流时出错:', error);
        }
      }

      // 成功完成，退出重试循环
      return;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('未知错误');
      console.error(`第 ${retryCount + 1} 次请求失败:`, lastError);

      // 判断是否需要重试
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('请求超时，请检查网络连接');
      }

      if (retryCount < maxRetries - 1) {
        // 使用指数退避策略
        const waitTime = Math.min(1000 * Math.pow(2, retryCount), 8000);
        console.log(`等待 ${waitTime}ms 后重试...`);
        await delay(waitTime);
        retryCount++;
      } else {
        throw new Error(`多次请求失败: ${lastError.message}`);
      }
    }
  }

  // 如果所有重试都失败了
  throw lastError || new Error('请求失败');
} 