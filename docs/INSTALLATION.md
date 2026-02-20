# Installation

## Requirements

- Node.js >= 20.10.0
- npm >= 9
- Network access to `read.amazon.co.jp`

## Steps

```bash
git clone <repository-url>
cd kindle-annotations-mcp
npm install
npx playwright install chromium
npm run build
```

## First Login

```bash
KINDLE_REGION=co.jp npm run login
```

Manual sign-in is required in the opened browser.
