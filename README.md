# Kindle MCP Server

[简体中文](docs/README_zh.md)

Kindle MCP Server connects AI assistants to your Kindle highlights and notes from `read.amazon.co.jp`.

## Region Support

This project supports **Amazon Japan (`co.jp`) only**.

## Quick Start

```bash
npm install
npx playwright install chromium
npm run build
KINDLE_REGION=co.jp npm run login
```

Then configure your MCP client:

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

## Tools

- `login`: open browser for manual sign-in.
- `check_login_status`: verify main-site and Web Reader readiness.
- `get_book_list`: list books with highlights.
- `fetch_notes`: fetch notes by ASIN.

## Documentation

- [中文说明](docs/README_zh.md)
- [Installation](docs/INSTALLATION.md)
- [Configuration](docs/CONFIGURATION.md)
- [MCP Tools](docs/MCP-TOOLS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [API](docs/API.md)
