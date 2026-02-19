# Kindle MCP Server

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.10.0-brightgreen)
![MCP](https://img.shields.io/badge/MCP-1.0.0-orange)

**一个将您的 AI 助手连接到 Kindle 高亮和笔记的 Model Context Protocol (MCP) 服务器。**

[English](../README.md) • [功能](#功能) • [安装](#安装) • [使用](#使用) • [配置](#配置) • [文档](#文档)

</div>

---

## 📖 简介

**Kindle MCP Server** 允许像 Claude 这样的 AI 助手从 `read.amazon.com` 访问您的个人 Kindle 高亮和笔记。通过在您的阅读历史和 AI 之间建立桥梁，您可以：

- **挖掘洞察**：从您读过的书籍中提取深层信息。
- **知识集成**：跨多个书名合成知识。
- **回顾与总结**：梳理您的关键收获。

它使用 Playwright 安全地处理身份验证和抓取过程，支持多个亚马逊区域（美国、日本、英国等）。

## ✨ 功能

- **📚 书籍检索**：获取库中所有带有高亮的书籍列表。
- **📝 高亮提取**：获取特定书籍的全文本高亮、笔记、颜色和位置。
- **🌍 多区域支持**：支持亚马逊美国 (`com`)、日本 (`co.jp`)、英国 (`co.uk`)、德国 (`de`) 等。
  - ⚠️ **注意**：目前仅对日本 (`co.jp`) 地区进行了充分测试。其他地区虽已包含，但不保证其可用性。
- **🔐 持久登录**：管理身份验证会话，无需每次操作都重新登录。
- **🤖 MCP 集成**：专为与 Claude Desktop、Cline 和其他 MCP 客户端配合使用而设计。

## 🛠️ 安装

### 先决条件

- **Node.js**: v20.10.0 或更高版本
- **npm**: v9.0.0 或更高版本

### 设置步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/yourusername/kindle-annotations-mcp.git
   cd kindle-annotations-mcp
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **安装浏览器二进制文件 (Playwright)**
   ```bash
   npx playwright install chromium
   ```

4. **构建项目**
   ```bash
   npm run build
   ```

## 🚀 使用

### 1. 初始身份验证

在使用 AI 客户端访问服务器之前，您需要登录您的亚马逊账户。

**选项 A：使用 CLI（推荐首次运行使用）**

将 `com` 替换为您的区域代码（例如：`co.jp`, `co.uk`）。

```bash
KINDLE_REGION=com npm run login
```
*这将打开一个浏览器窗口。请手动完成登录。看到您的 Kindle Notebook 页面后，即可关闭浏览器。*

**选项 B：使用 MCP 工具**

您也可以直接从 Claude 触发登录：
> "启动 co.jp 区域的登录工具"

### 2. 配置 MCP 客户端

将服务器添加到您的 MCP 客户端配置中（例如 Claude Desktop、Cline 等）。使用以下 JSON 配置：

```json
{
  "mcpServers": {
    "kindle": {
      "command": "node",
      "args": ["/absolute/path/to/kindle-annotations-mcp/dist/index.js"],
      "env": {
        "KINDLE_REGION": "com"
      }
    }
  }
}
```

**Claude Desktop 的配置文件路径：**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

*注意：请将 `/absolute/path/to/...` 替换为您克隆仓库的实际路径。*

### 3. 开始提问

重启 Claude Desktop 并尝试以下提示词：

- "列出我的 Kindle 书籍。"
- "获取《原子习惯》(Atomic Habits) 的高亮内容。"
- "总结我在《金钱心理学》(The Psychology of Money) 笔记中的核心观点。"

## ⚙️ 配置

### 支持的区域

服务器支持以下亚马逊域名。请将 `KINDLE_REGION` 环境变量设置为相应的代码。

| 区域代码 | 国家/地区 | 域名 |
|:---:|---|---|
| `co.jp` | 🇯🇵 日本 (默认) | amazon.co.jp |
| `com` | 🇺🇸 美国 | amazon.com |
| `co.uk` | 🇬🇧 英国 | amazon.co.uk |
| `de` | 🇩🇪 德国 | amazon.de |
| `fr` | 🇫🇷 法国 | amazon.fr |
| `ca` | 🇨🇦 加拿大 | amazon.ca |
| `in` | 🇮🇳 印度 | amazon.in |
 
> [!WARNING]
> 目前仅对 **日本 (`co.jp`)** 地区进行了充分测试。其他地区虽已支持，但属于“尽力而为”，不保证功能完全正常。
 
*更多详情请参阅 [docs/CONFIGURATION.md](CONFIGURATION.md)。*

## 🧰 可用工具

服务器公开了以下 MCP 工具：

| 工具名称 | 描述 |
|---|---|
| `get_book_list` | 检索带有高亮/笔记的书籍列表。 |
| `fetch_notes` | 获取特定书籍的所有高亮和笔记（需要 `asin`）。 |
| `login` | 启动交互式浏览器会话进行身份验证。 |

## 📚 文档

详细文档位于 `docs/` 目录：

- [安装指南](INSTALLATION.md)
- [配置指南](CONFIGURATION.md)
- [MCP 工具参考](MCP-TOOLS.md)
- [问题排查](TROUBLESHOOTING.md)
- [API 参考](API.md)

## 🤝 贡献

欢迎贡献！请随意提交 Pull Request。

1. Fork 本仓库。
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)。
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)。
4. 推送到分支 (`git push origin feature/AmazingFeature`)。
5. 开启一个 Pull Request。

## 📄 许可证

本项目采用 MIT 许可证 - 详情请参阅 [package.json](../package.json) 文件。
