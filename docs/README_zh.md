# Kindle MCP Server

[English](../README.md)

Kindle MCP Server 用于将 AI 助手连接到 `read.amazon.co.jp` 的 Kindle 高亮与笔记。

## 地区支持

项目当前**仅支持 Amazon 日本站 `co.jp`**。

## 快速开始

```bash
npm install
npx playwright install chromium
npm run build
KINDLE_REGION=co.jp npm run login
```

在 MCP 客户端中配置：

```json
{
  "mcpServers": {
    "kindle": {
      "command": "node",
      "args": ["/absolute/path/to/kindle-annotations-mcp/dist/index.js"],
      "env": {
        "KINDLE_REGION": "co.jp"
      }
    }
  }
}
```

## 工具

- `login`：打开浏览器进行手动登录。
- `check_login_status`：检查主站和 Web Reader 登录状态。
- `get_book_list`：获取有高亮的书籍列表。
- `fetch_notes`：按 ASIN 获取书籍笔记。

## 文档

- [Installation](INSTALLATION.md)
- [Configuration](CONFIGURATION.md)
- [MCP Tools](MCP-TOOLS.md)
- [Troubleshooting](TROUBLESHOOTING.md)
- [API](API.md)
