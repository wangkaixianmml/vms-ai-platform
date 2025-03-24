# VMS AI Platform

VMS AI平台是一个整合漏洞管理和AI分析能力的全栈应用程序，提供实时漏洞分析和聊天功能。

## 功能特点

- **实时AI聊天**：基于SSE（Server-Sent Events）的流式响应，提供流畅的聊天体验
- **漏洞分析**：针对安全漏洞提供详细分析和修复建议
- **Markdown支持**：聊天内容支持Markdown格式，提升可读性
- **会话管理**：支持创建和管理多个对话会话

## 技术栈

### 后端
- Python + FastAPI
- 异步处理
- 集成Dify API

### 前端
- React + TypeScript
- Chakra UI
- 实时消息流处理

## 安装指南

### 后端设置

1. 克隆仓库
```bash
git clone https://github.com/your-username/vms-ai-platform.git
cd vms-ai-platform
```

2. 创建并激活虚拟环境
```bash
python -m venv venv
source venv/bin/activate  # Windows使用: venv\Scripts\activate
```

3. 安装依赖
```bash
cd backend
pip install -r requirements.txt
```

4. 配置环境变量
创建`.env`文件并添加以下内容：
```
DIFY_API_URL=https://api.dify.ai/v1
DIFY_API_KEY=your_api_key_here
```

5. 启动后端服务
```bash
python -m app.main
```

### 前端设置

1. 安装依赖
```bash
cd frontend
npm install
```

2. 启动开发服务器
```bash
npm start
```

## 使用方法

1. 访问 `http://localhost:3000` 打开前端界面
2. 使用聊天界面与AI进行交流
3. 提交漏洞信息获取专业分析

## 许可证

[MIT](LICENSE)

## 贡献指南

欢迎提交Pull Request或Issue来改进项目。