# Configuration

## Region Policy

Only `co.jp` is supported.

## Priority

1. CLI: `--region=co.jp`
2. Env: `KINDLE_REGION=co.jp`
3. File: `kindle-region.config.json`
4. Default: `co.jp`

If any value is not `co.jp`, the server rejects it.

## Examples

```bash
node dist/index.js --region=co.jp
KINDLE_REGION=co.jp node dist/index.js
```

`kindle-region.config.json`:

```json
{
  "region": "co.jp",
  "name": "Japan"
}
```
