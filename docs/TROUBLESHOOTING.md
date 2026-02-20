# Troubleshooting

## Session expired

If tools return session errors:

```bash
rm -rf kindle-mcp-profile/
KINDLE_REGION=co.jp npm run login
```

Then call `check_login_status` until it returns `ready`.

## Invalid region

Only `co.jp` is valid.

Use:

```bash
node dist/index.js --region=co.jp
```

## MCP config not working

Check client config:

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
