import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, TextField, IconButton, Typography, CircularProgress, Avatar } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import Typewriter from 'typewriter-effect';
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
  const [displayedResponse, setDisplayedResponse] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isStreamingRef = useRef(false);

  // 滚动到底部
  const scrollToBottom = useCallback((force = false) => {
    if (messagesEndRef.current) {
      const element = messagesEndRef.current;
      const parent = element.parentElement;
      if (parent) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (force) {
              parent.scrollTop = parent.scrollHeight;
            } else {
              try {
                parent.scrollTo({
                  top: parent.scrollHeight,
                  behavior: 'smooth'
                });
              } catch {
                parent.scrollTop = parent.scrollHeight;
              }
            }
          });
        });
      }
    }
  }, []);

  // 处理流式响应
  const handleProgress: OnProgressCallback = useCallback((content: string) => {
    if (isStreamingRef.current) {
      setDisplayedResponse(prev => {
        const newResponse = prev + content;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => scrollToBottom(false));
        });
        return newResponse;
      });
    }
  }, [scrollToBottom]);

  // 监听消息变化，自动滚动
  useEffect(() => {
    scrollToBottom(false);
  }, [messages, displayedResponse, scrollToBottom]);

  // 发送消息
  const handleSend = async () => {
    if (!input.trim() || !apiKey.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setDisplayedResponse('');
    isStreamingRef.current = true;
    
    requestAnimationFrame(() => scrollToBottom(true));

    try {
      const newMessages = [...messages, userMessage];
      let fullResponse = '';

      await sendMessage(newMessages, apiKey, (content: string) => {
        fullResponse += content;
        handleProgress(content);
      });

      if (isStreamingRef.current) {
        requestAnimationFrame(() => {
          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: fullResponse }
          ]);
          setDisplayedResponse('');
          isStreamingRef.current = false;
          scrollToBottom(true);
        });
      }

      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
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
      requestAnimationFrame(() => scrollToBottom(true));
    } finally {
      setIsLoading(false);
    }
  };

  // 键盘事件处理函数
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 渲染 AI 回复
  const renderAIResponse = useCallback(() => {
    if (!displayedResponse || !isStreamingRef.current) return null;

    // 将文本按换行符分割成数组，保留空行
    const lines = displayedResponse.split(/(\n)/g).filter(line => line !== '');
    const lastLineIndex = lines.length - 1;

    return (
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
            {lines.map((line, index) => (
              <Box 
                key={index} 
                sx={{ 
                  display: 'block', 
                  minHeight: line === '\n' ? '1em' : '1.75em',
                  '&:last-child': {
                    minHeight: 'auto'
                  },
                  transform: 'translateZ(0)', // 启用硬件加速
                  willChange: 'transform', // 提示浏览器优化
                }}
              >
                {index === lastLineIndex ? (
                  <Typewriter
                    onInit={(typewriter) => {
                      typewriter
                        .changeDelay(30)
                        .changeDeleteSpeed(Infinity)
                        .pauseFor(50)
                        .typeString(line)
                        .callFunction(() => {
                          // 使用 RAF 嵌套来优化滚动
                          requestAnimationFrame(() => {
                            requestAnimationFrame(() => scrollToBottom(false));
                          });
                        })
                        .start();
                    }}
                    options={{
                      cursor: '|',
                      autoStart: false,
                      loop: false,
                      delay: 30,
                      skipAddStyles: true,
                      wrapperClassName: index === lastLineIndex ? 'typewriter-wrapper active' : 'typewriter-wrapper',
                      cursorClassName: 'Typewriter__cursor',
                    }}
                  />
                ) : (
                  <span>{line}</span>
                )}
              </Box>
            ))}
          </Typography>
        </Box>
      </Box>
    );
  }, [displayedResponse, scrollToBottom]);

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
        {renderAIResponse()}
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