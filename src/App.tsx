/**
 * App 组件 - 应用程序的根组件
 * 提供全局样式和布局设置，集成聊天界面
 */
import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import ChatInterface from './components/ChatInterface';

/**
 * 主题配置
 * 定义应用的颜色、排版和组件样式
 */
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#10a37f', // ChatGPT 风格的主题绿色
    },
    background: {
      default: '#f7f7f8',
      paper: '#ffffff',
    },
  },
});

/**
 * 全局样式配置
 * 设置基本的布局和响应式设计
 */
const globalStyles = {
  // HTML 根元素样式
  html: {
    height: '100%',
    margin: 0,
    padding: 0,
  },
  // Body 元素样式
  body: {
    minHeight: '100%',
    margin: 0,
    padding: 0,
    backgroundColor: '#f7f7f8', // 设置背景色
    display: 'block',
  },
  // React 根容器样式
  '#root': {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
};

/**
 * App 组件
 * 应用程序的根组件，提供主题和全局样式
 * @returns {JSX.Element} 渲染的应用程序界面
 */
function App() {
  return (
    <ThemeProvider theme={theme}>
      {/* 重置浏览器默认样式 */}
      <CssBaseline />
      
      {/* 注入全局样式 */}
      <Box sx={globalStyles}>
        {/* 主容器 - 采用 flex 布局实现全屏效果 */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            height: '100vh',
            width: '100%',
          }}
        >
          {/* 聊天界面组件 - 实现主要的交互功能 */}
          <ChatInterface />
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
