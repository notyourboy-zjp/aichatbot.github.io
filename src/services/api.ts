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
            'X-Title': 'AI ChatBot'
          },
          body: JSON.stringify({
            model: 'openai/gpt-3.5-turbo',
            messages: messages.map(msg => ({
              role: msg.role,
              content: msg.content
            })),
            stream: true,
            temperature: 0.7,
            max_tokens: 2000
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

        // 对特定错误码进行处理
        if (response.status === 429) {
          throw new Error('请求过于频繁，请稍后再试');
        } else if (response.status === 401) {
          throw new Error('API Key 无效或已过期');
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

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        buffer += chunk;

        // 处理完整的 SSE 消息
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的最后一行

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              if (content) {
                onProgress(content);
              }
            } catch (e) {
              console.warn('解析 SSE 消息时出错:', e);
              continue;
            }
          }
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