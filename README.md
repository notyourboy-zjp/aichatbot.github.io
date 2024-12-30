# AI ChatBot

一个基于 React 和 OpenRouter API 开发的智能聊天应用，提供流畅的对话体验和实时打字机效果。

## 功能特点

- 🤖 智能对话：基于 GPT-3.5-turbo 模型的智能对话功能
- ⌨️ 打字机效果：模拟真实打字的流畅显示效果
- 🌊 流式响应：实时显示 AI 回复，无需等待完整响应
- 💬 上下文记忆：保持对话上下文，实现连贯交流
- 🎨 现代界面：简洁优雅的用户界面设计
- 📱 响应式设计：完美适配桌面和移动设备
- 🔒 安全认证：支持 API Key 认证机制

## 技术栈

- **前端框架**：React 18 + TypeScript
- **UI 组件**：Material-UI (MUI) v5
- **构建工具**：Vite
- **API 集成**：OpenRouter API
- **状态管理**：React Hooks
- **样式方案**：MUI styled-components + CSS-in-JS
- **开发工具**：ESLint + TypeScript

## 项目结构

```
my-chat-app/
├── src/
│   ├── components/     # 组件目录
│   │   └── ChatInterface.tsx    # 主聊天界面组件
│   ├── services/      # 服务目录
│   │   └── api.ts     # API 服务封装
│   ├── App.tsx        # 应用入口组件
│   └── main.tsx       # 应用入口文件
├── public/            # 静态资源目录
├── index.html         # HTML 模板
├── package.json       # 项目配置文件
└── vite.config.ts     # Vite 配置文件
```

## 运行项目

### 前置要求

- Node.js 16.0 或更高版本
- npm 或 yarn 包管理器
- OpenRouter API Key

### 安装步骤

1. 克隆项目到本地：
   ```bash
   git clone <repository-url>
   cd my-chat-app
   ```

2. 安装依赖：
   ```bash
   npm install
   # 或
   yarn install
   ```

3. 启动开发服务器：
   ```bash
   npm run dev
   # 或
   yarn dev
   ```

4. 在浏览器中访问：
   ```
   http://localhost:5173
   ```

### 生产部署

1. 构建生产版本：
   ```bash
   npm run build
   # 或
   yarn build
   ```

2. 预览生产构建：
   ```bash
   npm run preview
   # 或
   yarn preview
   ```

## 使用说明

1. 首次使用时，需要在顶部输入框中填入有效的 OpenRouter API Key
2. 在底部输入框中输入您想说的内容
3. 按发送按钮或回车键发送消息
4. AI 将以打字机效果实时显示回复内容

## 特性说明

### 智能对话
- 支持多轮对话
- 保持上下文连贯性
- 实时流式响应

### 用户界面
- 简洁现代的设计风格
- 响应式布局适配
- 流畅的动画效果
- 优雅的加载状态

### 错误处理
- 网络错误自动重试
- 友好的错误提示
- 请求超时保护
- API 异常处理

## 注意事项

- 需要有效的 OpenRouter API Key
- 建议使用现代浏览器以获得最佳体验
- 请遵守 OpenRouter 的使用条款和限制

## 更多开发计划

- [ ] 支持更多 AI 模型选择
- [ ] 添加对话历史保存功能
- [ ] 支持 Markdown 格式显示
- [ ] 添加代码高亮功能
- [ ] 支持图片生成功能
- [ ] 添加主题切换功能

## 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助改进项目。

## 许可证

MIT License
