# Kindle MCP Server

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.10.0-brightgreen)
![MCP](https://img.shields.io/badge/MCP-1.0.0-orange)

**A Model Context Protocol (MCP) server that connects your AI assistant to your Kindle highlights and notes.**

[简体中文](docs/README_zh.md) • [Features](#features) • [Installation](#installation) • [Usage](#usage) • [Configuration](#configuration) • [Documentation](#documentation)

</div>

---

## 📖 Introduction

**Kindle MCP Server** allows AI assistants like Claude to access your personal Kindle highlights and notes from `read.amazon.com`. By bridging the gap between your reading history and your AI, you can:

- **Surface insights** from books you've read.
- **Synthesize knowledge** across multiple titles.
- **Review and summarize** your key takeaways.

It handles the authentication and scraping process securely using Playwright, supporting multiple Amazon regions (US, Japan, UK, etc.).

## ✨ Features

- **📚 Book Retrieval**: Get a list of all books with highlights in your library.
- **📝 Highlight Extraction**: Fetch full text highlights, notes, colors, and locations for specific books.
- **🌍 Multi-Region Support**: Supports Amazon US (`com`), Japan (`co.jp`), UK (`co.uk`), and more.
  - ⚠️ **Note**: Only the Japan (`co.jp`) region is thoroughly tested. Other regions are technically supported but their availability is not guaranteed.
- **🔐 Persistent Login**: Manages authentication sessions so you don't have to log in every time.
- **🤖 MCP Integration**: Designed to work seamlessly with Claude Desktop, Cline, and other MCP clients.

## 🛠️ Installation

### Prerequisites

- **Node.js**: v20.10.0 or higher
- **npm**: v9.0.0 or higher

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/kindle-annotations-mcp.git
   cd kindle-annotations-mcp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install browser binaries (Playwright)**
   ```bash
   npx playwright install chromium
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

## 🚀 Usage

### 1. Initial Authentication

Before using the server with an AI client, you need to log in to your Amazon account.

**Option A: Using the CLI (Recommended for first run)**

Replace `com` with your region code (e.g., `co.jp`, `co.uk`).

```bash
KINDLE_REGION=com npm run login
```
*This will open a browser window. Please log in manually. Once you see your Kindle Notebook, close the browser.*

**Option B: Using the MCP Tool**

You can also trigger login directly from Claude:
> "Launch the login tool for region co.jp"

### 2. Configure MCP Client

Add the server to your MCP client configuration (e.g., Claude Desktop, Cline, etc.). Use the following JSON configuration:

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

**Configuration Paths for Claude Desktop:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

*Note: Replace `/absolute/path/to/...` with the actual path to your cloned repository.*

### 3. Ask Claude

Restart Claude Desktop and try these prompts:

- "List my Kindle books."
- "Get my highlights for 'Atomic Habits'."
- "Summarize the key points from my notes on 'The Psychology of Money'."

## ⚙️ Configuration

### Supported Regions

The server supports the following Amazon domains. Set the `KINDLE_REGION` environment variable to the corresponding code.

| Region Code | Country | Domain |
|:---:|---|---|
| `co.jp` | 🇯🇵 Japan (Default) | amazon.co.jp |
| `com` | 🇺🇸 United States | amazon.com |
| `co.uk` | 🇬🇧 United Kingdom | amazon.co.uk |
| `de` | 🇩🇪 Germany | amazon.de |
| `fr` | 🇫🇷 France | amazon.fr |
| `ca` | 🇨🇦 Canada | amazon.ca |
| `in` | 🇮🇳 India | amazon.in |
 
> [!WARNING]
> Only the **Japan (`co.jp`)** region has been thoroughly tested. Other regions are provided on a best-effort basis and their functionality is not guaranteed.
 
*See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for more details.*

## 🧰 Available Tools

The server exposes the following MCP tools:

| Tool Name | Description |
|---|---|
| `get_book_list` | Retrieves a list of books that have highlights/notes. |
| `fetch_notes` | Fetches all highlights and notes for a specific book (requires `asin`). |
| `login` | Launches an interactive browser session for authentication. |

## 📚 Documentation

Detailed documentation is available in the `docs/` directory:

- [Installation Guide](docs/INSTALLATION.md)
- [Configuration Guide](docs/CONFIGURATION.md)
- [MCP Tools Reference](docs/MCP-TOOLS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [API Reference](docs/API.md)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](package.json) file for details.
