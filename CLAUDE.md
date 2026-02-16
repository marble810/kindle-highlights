# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Kindle Web Reader MCP Server** - a Node.js-based MCP (Model Context Protocol) server that scrapes Kindle highlights and notes from `read.amazon.com` using Playwright.

## High-Level Architecture

### File Organization

```
src/
├── index.ts      # MCP Server entry point (Stdio Transport)
├── browser.ts    # Playwright wrapper (login & scraping logic)
└── types.ts      # TypeScript interfaces
```

**Key Design Decision**: The browser automation is isolated in `browser.ts` to separate concerns:
- `index.ts` handles MCP protocol and tool definitions
- `browser.ts` manages Playwright lifecycle, authentication state, and DOM scraping

### Authentication Flow

The server uses **Persistent Browser Context** for Amazon authentication:

1. **Initial Login**: Run with `--login` flag to launch headed Chrome
2. **Manual Auth**: User manually logs into Amazon (may include 2FA)
3. **State Persistence**: Cookies/session saved to `./kindle-mcp-profile/`
4. **Subsequent Runs**: Load saved profile for headless operation

This avoids storing credentials in code and handles Amazon's anti-automation measures.

### Amazon Region Selection

The server supports multiple Amazon regions/endpoints. Use `--region=<code>` to specify:

| Region Code | Country | Example URLs |
|-------------|---------|--------------|
| `com` | United States (default) | read.amazon.com/notebook |
| `co.jp` | Japan | read.amazon.co.jp/notebook |
| `co.uk` | United Kingdom | read.amazon.co.uk/notebook |
| `de` | Germany | read.amazon.de/notebook |
| `fr` | France | read.amazon.fr/notebook |
| `es` | Spain | read.amazon.es/notebook |
| `it` | Italy | read.amazon.it/notebook |
| `ca` | Canada | read.amazon.ca/notebook |
| `com.au` | Australia | read.amazon.com.au/notebook |
| `in` | India | read.amazon.in/notebook |
| `com.mx` | Mexico | read.amazon.com.mx/notebook |

**Usage Examples**:
```bash
# Login to Japan Amazon
npm run login -- --region=co.jp

# Start server for Japan
node dist/index.js --region=co.jp
```

### MCP Tool Interface

**Tool: `fetch_notes`**
- Input: `{ limit?: number }` - number of recent books to fetch (default: 1)
- Output: JSON string matching `KindleBookData` interface

### Data Schema

Output follows this TypeScript interface:

```typescript
interface KindleBookData {
  title: string;
  author: string;
  highlights: {
    text: string;
    note: string | null;
    color: "yellow" | "blue" | "pink" | "orange" | "purple";
    location: string;
  }[];
}
```

## DOM Scraping Strategy

Target: `https://read.amazon.<region>/notebook`

Key CSS selectors (may need adjustment for Amazon's changing markup):
- Book title: `.a-spacing-top-small h2`
- Note containers: `.a-spacing-base`
- Highlight text: `#highlight`
- User note: `#note`
- Location: `.a-size-small.a-color-secondary`
- Color classes: `.kp-notebook-highlight-[color]`

**Note**: DOM structure may vary between Amazon regions. If scraping fails, verify selectors for your specific region.

## Development Commands

### Initial Setup
```bash
npm install
npx playwright install chromium
```

### Build
```bash
npm run build
```

### Development Mode (with watch)
```bash
npm run dev
```

### Login (to authenticate with Amazon)
```bash
# Default region (US)
npm run login

# Specific region
npm run login -- --region=co.jp
```

### Run the MCP Server
```bash
# Default region (US)
node dist/index.js

# Specific region
node dist/index.js --region=co.jp
```

### Run a Single Test (if tests exist)
```bash
npm test -- test-name-pattern
```

## Error Handling

The server handles these key error scenarios:

1. **Session Expired**: Detects redirect to `signin` URL, returns error: "Session expired. Please run with `--login` to refresh cookies."
2. **Timeout**: 30-second timeout for page loads; returns empty data or retry suggestion
3. **Missing Profile**: If `./kindle-mcp-profile/` doesn't exist, prompts user to run `--login` first
4. **Invalid Region**: Shows valid regions list and exits if unknown region code provided

## Git Ignore

Ensure these are in `.gitignore`:
```
kindle-mcp-profile/     # Browser profile with cookies/session
dist/                   # Compiled TypeScript
node_modules/
.env
```
