# API

## Types

```ts
type AmazonRegion = 'co.jp';
```

```ts
function getAmazonBaseUrl(region: AmazonRegion): string;
function getNotebookUrl(region: AmazonRegion, language?: string): string;
```

## Config (`src/config.ts`)

```ts
const DEFAULT_REGION: AmazonRegion = 'co.jp';
const REGIONS: Record<'co.jp', { name: string; url: string }>;

function isValidRegion(region: string): region is AmazonRegion;
function getRegionConfig(cliArg: string | null): {
  region: AmazonRegion;
  source: 'cli' | 'env' | 'file' | 'default';
  name: string;
};
```

## MCP Tools

- `login({ region?: 'co.jp' })`
- `check_login_status({ region?: 'co.jp' })`
- `get_book_list({})`
- `fetch_notes({ asin: string })`
