<p align="center">
  <img src="build/icon.png" alt="MarkFlow" width="128" height="128">
</p>

<h1 align="center">MarkFlow</h1>

<p align="center">
  <b>知识库文件转换工具</b> — 将 Word、网页、文本一键转换为 Markdown
</p>

<p align="center">
  <a href="#功能特点">功能</a> •
  <a href="#截图预览">预览</a> •
  <a href="#安装使用">安装</a> •
  <a href="#从源码运行">开发</a> •
  <a href="#技术架构">架构</a> •
  <a href="#许可证">许可证</a>
</p>

---

## ✨ 功能特点

| 功能 | 说明 |
|------|------|
| 📄 **Word 转换** | 支持 `.docx` 格式，自动提取并保存文档中的图片 |
| 🌐 **网页抓取** | 输入 URL 即可将网页文章转为 Markdown（支持微信公众号、知乎、CSDN 等） |
| 📋 **文本转换** | 粘贴 HTML 或富文本，自动解析为 Markdown 格式 |
| 📦 **批量处理** | 支持同时导入多个 Word 文件或多条 URL，一键批量转换 |
| ✏️ **实时编辑** | 内置 Markdown 编辑器，支持分屏预览、工具栏快捷操作 |
| 🎨 **深色模式** | 支持浅色/深色主题切换 |
| 💾 **自定义输出** | 可自由设置文件保存路径 |

## 📥 安装使用

### macOS

1. 前往 [Releases](https://github.com/zhangjingjing962464-glitch/markflow/releases) 页面
2. 下载最新版 `MarkFlow-x.x.x-universal-mac.zip`
3. 解压后将 `MarkFlow.app` 拖入「应用程序」文件夹

> **提示**：首次打开如果提示"无法验证开发者"，请前往 **系统设置 → 隐私与安全性** → 点击"仍要打开"

### 从源码运行

```bash
# 克隆仓库
git clone https://github.com/zhangjingjing962464-glitch/markflow.git
cd markflow

# 安装依赖
npm install

# 方式一：作为桌面应用运行（Electron）
npm run electron

# 方式二：作为 Web 服务运行
npm start
# 然后打开浏览器访问 http://localhost:3000
```

### 构建安装包

```bash
# 构建 macOS 安装包
npm run build:mac

# 构建 Windows 安装包
npm run build:win

# 同时构建两个平台
npm run build:all
```

## 🏗️ 技术架构

```
markflow/
├── electron/           # Electron 主进程
│   ├── main.js         # 窗口管理、菜单、IPC 通信
│   └── preload.js      # 预加载脚本（安全桥接）
├── converters/         # 核心转换引擎
│   ├── word.js         # Word (.docx) → Markdown
│   ├── url.js          # 网页 URL → Markdown
│   └── text.js         # HTML 文本 → Markdown
├── js/
│   └── app.js          # 前端交互逻辑
├── css/
│   └── styles.css      # UI 样式
├── server.js           # Express 后端服务
├── index.html          # 前端页面
└── package.json
```

### 技术栈

- **前端**: 原生 HTML/CSS/JavaScript + [Phosphor Icons](https://phosphoricons.com/) + [Marked.js](https://marked.js.org/)
- **后端**: [Express 5](https://expressjs.com/) + [Multer](https://github.com/expressjs/multer)
- **桌面**: [Electron 35](https://www.electronjs.org/)
- **转换引擎**: [Mammoth](https://github.com/mwilliamson/mammoth.js)（Word）、[Turndown](https://github.com/mixmark-io/turndown)（HTML→MD）、[Cheerio](https://cheerio.js.org/)（网页解析）

## 📝 许可证

[MIT License](LICENSE) © 2026 MarkFlow
