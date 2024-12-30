import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, TextField, IconButton, Typography, CircularProgress, Avatar } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { sendMessage } from '../services/api';

// 消息类型定义
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 进度回调函数类型定义
type OnProgressCallback = (content: string) => void;

// 滚动条样式配置
const scrollbarStyle = {
  '&::-webkit-scrollbar': {
    width: '8px',
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#e5e5e5',
    borderRadius: '4px',
    '&:hover': {
      backgroundColor: '#d4d4d4',
    },
  },
};

/**
 * 计算打字机效果的延迟时间
 * @param totalLength - 总文本长度
 * @param currentLength - 当前已显示的文本长度
 * @returns 延迟时间（毫秒）
 */
const calculateTypingDelay = (totalLength: number, currentLength: number): number => {
  // 增加基础延迟时间
  const baseDelay = 20;
  
  // 调整速度因子，使变化更平缓
  let lengthFactor = 1;
  if (totalLength > 1000) {
    lengthFactor = 0.85; // 长文本适度加快
  } else if (totalLength > 500) {
    lengthFactor = 0.9; // 中等文本轻微加快
  } else if (totalLength > 100) {
    lengthFactor = 0.95; // 较短文本几乎保持原速
  }

  // 调整进度因子，使速度变化更平滑
  const progress = currentLength / totalLength;
  let progressFactor = 1;
  
  if (progress < 0.1) {
    progressFactor = 0.9; // 开始时略快
  } else if (progress < 0.2) {
    progressFactor = 0.95; // 前期保持较快
  } else if (progress > 0.95) {
    progressFactor = 1.05; // 结尾轻微减速
  }

  // 保持较小的随机变化
  const randomFactor = 0.98 + Math.random() * 0.04; // 0.98-1.02 之间的随机值

  return Math.round(baseDelay * lengthFactor * progressFactor * randomFactor);
};

// 组件属性类型定义
interface ChatInterfaceProps {
  className?: string;
}

/**
 * 聊天界面组件
 * 实现了类似 OpenRouter 的打字机效果和交互体验
 */
export default function ChatInterface({ className }: ChatInterfaceProps) {
  const [apiKey, setApiKey] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [displayedResponse, setDisplayedResponse] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isStreamingRef = useRef(false);
  const typewriterTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 打字机效果的实现
   * 通过计算延迟时间和字符显示数量来模拟真实打字效果
   */
  useEffect(() => {
    if (currentResponse && isStreamingRef.current) {
      const textToType = currentResponse.slice(displayedResponse.length);
      if (textToType) {
        if (typewriterTimeoutRef.current) {
          clearTimeout(typewriterTimeoutRef.current);
        }

        // 计算要一次性添加的字符数
        let charsToAdd = 1;
        const nextChar = textToType.charAt(0);
        const followingChar = textToType.charAt(1);
        
        // 优化显示逻辑
        if (/[.,!?，。！？、:：""''（）()]/.test(nextChar)) {
          // 标点符号单独显示
          charsToAdd = 1;
        } else if (/[\u4e00-\u9fa5]/.test(nextChar)) {
          // 中文字符显示逻辑优化
          const match = textToType.match(/^[\u4e00-\u9fa5]+/);
          if (match) {
            const phraseLength = match[0].length;
            if (phraseLength <= 2) {
              charsToAdd = phraseLength; // 短词组整体显示
            } else {
              charsToAdd = 1; // 长词组逐字显示
            }
          }
        } else if (/[a-zA-Z]/.test(nextChar)) {
          // 英文单词显示逻辑优化
          const match = textToType.match(/^[a-zA-Z]+(?=[^a-zA-Z]|$)/);
          if (match) {
            const wordLength = match[0].length;
            if (wordLength <= 4) {
              charsToAdd = wordLength; // 短单词整体显示
            } else {
              charsToAdd = 3; // 长单词分段显示
            }
          }
        } else if (nextChar === ' ' && /[a-zA-Z]/.test(followingChar)) {
          // 空格处理
          charsToAdd = 1;
        }

        const delay = calculateTypingDelay(
          currentResponse.length,
          displayedResponse.length
        );

        // 调整标点符号停顿时间
        const punctuationDelay = /[.。!！?？]$/.test(displayedResponse) ? 250 : // 句号停顿加长
                                /[,，、]$/.test(displayedResponse) ? 120 : // 逗号停顿适中
                                /[:：]$/.test(displayedResponse) ? 180 : // 冒号停顿适中
                                /["""'']$/.test(displayedResponse) ? 80 : // 引号停顿短促
                                0;

        // 段落停顿时间
        const paragraphDelay = /\n\s*\n$/.test(displayedResponse) ? 350 : 0;

        typewriterTimeoutRef.current = setTimeout(() => {
          setDisplayedResponse(prev => prev + textToType.slice(0, charsToAdd));
        }, delay + punctuationDelay + paragraphDelay);
      }
    } else if (!isStreamingRef.current) {
      setDisplayedResponse('');
    }

    return () => {
      if (typewriterTimeoutRef.current) {
        clearTimeout(typewriterTimeoutRef.current);
      }
    };
  }, [currentResponse, displayedResponse]);

  /**
   * 滚动到底部的处理函数
   * @param force - 是否强制滚动，不考虑当前滚动位置
   */
  const scrollToBottom = useCallback((force = false) => {
    if (messagesEndRef.current) {
      const element = messagesEndRef.current;
      const parent = element.parentElement;
      if (parent) {
        const isAtBottom = parent.scrollHeight - parent.scrollTop <= parent.clientHeight + 100;
        if (isAtBottom || force) {
          setTimeout(() => {
            element.scrollIntoView({ behavior: force ? 'auto' : 'smooth' });
          }, 50);
        }
      }
    }
  }, []);

  /**
   * 监听消息变化，自动滚动到底部
   */
  useEffect(() => {
    scrollToBottom(false);
  }, [messages, displayedResponse, scrollToBottom]);

  /**
   * 发送消息的处理函数
   * 处理消息发送、流式响应和错误处理
   */
  const handleSend = async () => {
    if (!input.trim() || !apiKey.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setCurrentResponse('');
    setDisplayedResponse('');
    isStreamingRef.current = true;
    
    // 发送消息后立即滚动到底部
    scrollToBottom(true);

    try {
      const newMessages = [...messages, userMessage];
      let fullResponse = '';

      const handleProgress: OnProgressCallback = (content: string) => {
        fullResponse += content;
        setCurrentResponse(fullResponse);
        // 每次收到新内容时滚动
        scrollToBottom(true);
      };

      await sendMessage(newMessages, apiKey, handleProgress);

      if (isStreamingRef.current) {
        setTimeout(() => {
          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: fullResponse }
          ]);
          setCurrentResponse('');
          setDisplayedResponse('');
          isStreamingRef.current = false;
          // 消息完成后滚动到底部
          scrollToBottom(true);
        }, 100);
      }

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev,
        { 
          role: 'assistant', 
          content: error instanceof Error ? error.message : '发送消息时出错，请稍后重试。' 
        }
      ]);
      isStreamingRef.current = false;
      setDisplayedResponse('');
      // 错误信息后也滚动到底
      scrollToBottom(true);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 键盘事件处理函数
   * 处理回车发送消息
   * @param e - 键盘事件对象
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * 组件卸载时的清理函数
   * 清理打字机效果的定时器和流式响应状态
   */
  useEffect(() => {
    return () => {
      isStreamingRef.current = false;
      if (typewriterTimeoutRef.current) {
        clearTimeout(typewriterTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Box 
      sx={{ 
        height: '100%',
        display: 'flex', 
        flexDirection: 'column',
        margin: '0 auto',
        width: '100%',
        maxWidth: {
          xs: '100%',     // 手机端全宽
          sm: '600px',    // 平板竖屏
          md: '900px',    // 平板横屏
          lg: '1200px',   // 桌面端
        },
        px: {
          xs: 0,         // 手机端无边距
          sm: 2,         // 平板端有小边距
          md: 4,         // 较大屏幕增加边距
        },
      }}
      className={className}
    >
      {/* API Key 输入框 */}
      <Box sx={{ 
        p: 2, 
        border: '1px solid rgba(0,0,0,0.1)',
        backgroundColor: '#ffffff',
        borderRadius: {
          xs: 0,        // 手机端无圆角
          sm: '12px',   // 平板及以上有圆角
        },
        mt: {
          xs: 0,        // 手机端无上边距
          sm: 2,        // 平板及以上有上边距
        },
      }}>
        <TextField
          fullWidth
          size="small"
          placeholder="输入 API Key..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          type="password"
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'white',
              '&:hover fieldset': {
                borderColor: 'rgba(16, 163, 127, 0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#10a37f',
                borderWidth: '2px',
              },
            }
          }}
        />
      </Box>

      {/* 消息列表 */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          backgroundColor: 'white',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: {
            xs: 0,        // 手机端无圆角
            sm: '12px',   // 平板及以上有圆角
          },
          my: {
            xs: 0,        // 手机端无边距
            sm: 2,        // 平板及以上有边距
          },
          border: {
            xs: 'none',   // 手机端无边框
            sm: '1px solid rgba(0,0,0,0.1)', // 平板及以上有边框
          },
          ...scrollbarStyle,
        }}
      >
        {messages.length === 0 && !displayedResponse && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              color: '#6b7280',
              px: 4,
              textAlign: 'center',
            }}
          >
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1.5,
              mb: 2 
            }}>
              <RocketLaunchIcon sx={{ 
                fontSize: 28,
                color: '#10a37f'
              }} />
              <Typography 
                variant="h5" 
                sx={{ 
                  fontWeight: 600,
                  color: '#10a37f'
                }}
              >
                AI ChatBot
              </Typography>
            </Box>
            <Typography variant="body2">
              请在顶部输入你的 API Key 开始对话
            </Typography>
          </Box>
        )}
        {messages.map((message, index) => (
          <Box
            key={index}
            sx={{
              py: 2,
              px: { xs: 2, sm: 4, md: 6 },
              display: 'flex',
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
              backgroundColor: 'white',
              gap: 2,
              alignItems: 'flex-start',
            }}
          >
            {message.role === 'assistant' && (
              <Avatar
                sx={{
                  bgcolor: '#10a37f',
                  width: 36,
                  height: 36,
                }}
              >
                <SmartToyIcon sx={{ fontSize: 20 }} />
              </Avatar>
            )}
            <Box
              sx={{
                maxWidth: '70%',
                backgroundColor: message.role === 'user' ? '#10a37f' : '#f7f7f8',
                color: message.role === 'user' ? 'white' : 'inherit',
                borderRadius: 2,
                px: 3,
                py: 2,
                position: 'relative',
              }}
            >
              <Typography
                component="div"
                sx={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'system-ui',
                  fontSize: '1rem',
                  lineHeight: 1.75,
                  '& p': {
                    margin: '0 0 1em 0',
                  },
                  '& p:last-child': {
                    marginBottom: 0,
                  },
                }}
              >
                {message.content}
              </Typography>
            </Box>
            {message.role === 'user' && (
              <Avatar
                sx={{
                  bgcolor: '#6b7280',
                  width: 36,
                  height: 36,
                }}
              >
                <PersonIcon sx={{ fontSize: 20 }} />
              </Avatar>
            )}
          </Box>
        ))}
        {isLoading && !displayedResponse && (
          <Box
            sx={{
              py: 2,
              px: { xs: 2, sm: 4, md: 6 },
              display: 'flex',
              justifyContent: 'flex-start',
              backgroundColor: 'white',
              gap: 2,
              alignItems: 'flex-start',
            }}
          >
            <Avatar
              sx={{
                bgcolor: '#10a37f',
                width: 36,
                height: 36,
              }}
            >
              <SmartToyIcon sx={{ fontSize: 20 }} />
            </Avatar>
            <Box
              sx={{
                maxWidth: '70%',
                backgroundColor: '#f7f7f8',
                borderRadius: 2,
                px: 3,
                py: 2,
                position: 'relative',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  alignItems: 'center',
                  '& .dot': {
                    width: 6,
                    height: 6,
                    backgroundColor: '#10a37f',
                    borderRadius: '50%',
                    animation: 'bounce 1.4s infinite ease-in-out both',
                  },
                  '& .dot:nth-of-type(1)': {
                    animationDelay: '-0.32s',
                  },
                  '& .dot:nth-of-type(2)': {
                    animationDelay: '-0.16s',
                  },
                  '@keyframes bounce': {
                    '0%, 80%, 100%': {
                      transform: 'scale(0)',
                    },
                    '40%': {
                      transform: 'scale(1)',
                    },
                  },
                }}
              >
                <Box className="dot" />
                <Box className="dot" />
                <Box className="dot" />
              </Box>
            </Box>
          </Box>
        )}
        {displayedResponse && isStreamingRef.current && (
          <Box
            sx={{
              py: 2,
              px: { xs: 2, sm: 4, md: 6 },
              display: 'flex',
              justifyContent: 'flex-start',
              backgroundColor: 'white',
              gap: 2,
              alignItems: 'flex-start',
            }}
          >
            <Avatar
              sx={{
                bgcolor: '#10a37f',
                width: 36,
                height: 36,
              }}
            >
              <SmartToyIcon sx={{ fontSize: 20 }} />
            </Avatar>
            <Box
              sx={{
                maxWidth: '70%',
                backgroundColor: '#f7f7f8',
                borderRadius: 2,
                px: 3,
                py: 2,
                position: 'relative',
              }}
            >
              <Typography
                component="div"
                sx={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'system-ui',
                  fontSize: '1rem',
                  lineHeight: 1.75,
                  '& p': {
                    margin: '0 0 1em 0',
                  },
                  '& p:last-child': {
                    marginBottom: 0,
                  },
                }}
              >
                {displayedResponse}
                <Box
                  component="span"
                  sx={{
                    display: 'inline-block',
                    width: '1px',
                    height: '1.2em',
                    marginLeft: '2px',
                    backgroundColor: '#10a37f',
                    verticalAlign: 'middle',
                    opacity: 0.8,
                    animation: 'blink 1s step-end infinite',
                    '@keyframes blink': {
                      '0%, 100%': {
                        opacity: 0.8,
                      },
                      '50%': {
                        opacity: 0,
                      },
                    },
                  }}
                />
              </Typography>
            </Box>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* 输入框 */}
      <Box
        sx={{
          p: 2,
          border: '1px solid rgba(0,0,0,0.1)',
          backgroundColor: '#ffffff',
          borderRadius: {
            xs: 0,        // 手机端无圆角
            sm: '12px',   // 平板及以上有圆角
          },
          mb: {
            xs: 0,        // 手机端无下边距
            sm: 2,        // 平板及以上有下边距
          },
        }}
      >
        <Box
          sx={{
            maxWidth: '100%',
            margin: '0 auto',
            width: '100%',
            display: 'flex',
            gap: 1.5,
            alignItems: 'flex-end',
            position: 'relative',
          }}
        >
          <TextField
            inputRef={inputRef}
            fullWidth
            multiline
            maxRows={4}
            placeholder="输入消息..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!apiKey.trim() || isLoading}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                backgroundColor: '#fff',
                '&:hover': {
                  backgroundColor: '#fff',
                },
                '& fieldset': {
                  borderColor: 'rgba(0,0,0,0.1)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#10a37f',
                  borderWidth: '2px',
                },
              },
            }}
          />
          <IconButton
            onClick={handleSend}
            disabled={!input.trim() || !apiKey.trim() || isLoading}
            sx={{
              backgroundColor: '#10a37f',
              color: 'white',
              padding: '10px',
              borderRadius: '8px',
              minWidth: '44px',
              height: '44px',
              marginBottom: '3px',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                backgroundColor: '#0e906f',
                transform: 'scale(1.05)',
              },
              '&.Mui-disabled': {
                backgroundColor: '#e0e0e0',
                color: '#a0a0a0',
              },
            }}
          >
            {isLoading ? (
              <CircularProgress size={22} color="inherit" thickness={4} />
            ) : (
              <SendIcon sx={{ fontSize: 20 }} />
            )}
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
} 