# 配置详解

## 概述

Kindle MCP Server 支持三层配置优先级系统，让您可以灵活地设置 Amazon 区域。

## 配置优先级

优先级从高到低：

```
┌─────────────────────────────────────────────────────────────┐
│                    配置优先级金字塔                          │
├─────────────────────────────────────────────────────────────┤
│  1. CLI 参数      (--region=xx)     最高优先级             │
│  2. 环境变量      (KINDLE_REGION)   MCP 客户端配置（推荐）  │
│  3. 配置文件      (config.json)     持久化项目配置          │
│  4. 默认值        (co.jp)           无配置时的后备           │
└─────────────────────────────────────────────────────────────┘
```

### 优先级示例

```bash
# 场景：四种配置同时存在
# CLI 参数：--region=de
# 环境变量：KINDLE_REGION=com
# 配置文件：{"region": "co.uk"}
# 默认值：co.jp

# 结果：使用 CLI 参数 de（最高优先级）
node dist/index.js --region=de

# 场景：无 CLI 参数
# 环境变量：KINDLE_REGION=com
# 配置文件：{"region": "co.uk"}
# 默认值：co.jp

# 结果：使用环境变量 com（MCP 推荐方式）
KINDLE_REGION=com node dist/index.js
```

## 配置方式详解

### 1. 命令行参数 (CLI Arguments)

**适用场景**：临时覆盖配置、调试、测试不同区域

**语法**：
```bash
# 等号格式
node dist/index.js --region=co.jp

# 空格格式
node dist/index.js --region co.jp
```

**优点**：
- 无需修改文件
- 立即生效
- 最高优先级，可覆盖其他配置

**缺点**：
- 每次运行需要手动输入
- 无法在 MCP 客户端中使用
- 不适合日常使用

---

### 2. 环境变量 (Environment Variables) ⭐ 推荐

**适用场景**：MCP 客户端配置、容器化部署、日常使用

**语法**：
```bash
# Unix/Linux/macOS
KINDLE_REGION=com node dist/index.js

# Windows (CMD)
set KINDLE_REGION=com && node dist/index.js

# Windows (PowerShell)
$env:KINDLE_REGION="com"; node dist/index.js

# 永久设置（添加到 ~/.bashrc 或 ~/.zshrc）
export KINDLE_REGION=com
```

**Claude Desktop 配置**：
```json
{
  "mcpServers": {
    "kindle": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "KINDLE_REGION": "com"
      }
    }
  }
}
```

**优点**：
- MCP 客户端原生支持
- 适合自动化部署
- 不受代码版本控制影响

**缺点**：
- 需要在每个使用环境中设置

---

### 3. 配置文件 (Config File)

**适用场景**：持久化项目配置、团队共享

**注意**：当使用 MCP 客户端时，优先推荐使用环境变量配置。配置文件适合不使用 MCP 客户端的场景。

**文件位置**：项目根目录下的 `kindle-region.config.json`

**创建步骤**：
```bash
# 1. 复制示例文件
cp kindle-region.config.json.example kindle-region.config.json

# 2. 编辑文件
vim kindle-region.config.json
```

**文件格式**：
```json
{
  "region": "co.jp",
  "name": "Japan"
}
```

**配置文件已加入 .gitignore**，不会被提交到版本控制。

**优点**：
- 持久化存储
- 易于版本控制（通过示例文件）
- 团队成员可以有自己的配置

**缺点**：
- 需要手动创建和编辑
- 容易忘记更新

---

### 4. 默认值 (Default)

当没有其他配置时，服务器使用默认区域：**`co.jp`** (日本)

```typescript
// src/config.ts
export const DEFAULT_REGION: AmazonRegion = 'co.jp';
```

## 支持的区域

### 完整列表

| 区域代码 | 国家 | 语言 | Amazon 域名 |
|----------|------|------|-------------|
| `co.jp` | 日本 | 日语 | amazon.co.jp (默认) |
| `com` | 美国 | 英语 | amazon.com |
| `co.uk` | 英国 | 英语 | amazon.co.uk |
| `de` | 德国 | 德语 | amazon.de |
| `fr` | 法国 | 法语 | amazon.fr |
| `es` | 西班牙 | 西班牙语 | amazon.es |
| `it` | 意大利 | 意大利语 | amazon.it |
| `ca` | 加拿大 | 英语/法语 | amazon.ca |
| `com.au` | 澳大利亚 | 英语 | amazon.com.au |
| `in` | 印度 | 英语 | amazon.in |
| `com.mx` | 墨西哥 | 西班牙语 | amazon.com.mx |

### 区域选择指南

```
您的 Amazon 账户在哪注册？
│
├─ Amazon.co.jp (日本)        → 使用 'co.jp' (默认)
├─ Amazon.com (美国)          → 使用 'com'
├─ Amazon.co.uk (英国)        → 使用 'co.uk'
├─ Amazon.de (德国)           → 使用 'de'
├─ Amazon.fr (法国)           → 使用 'fr'
├─ Amazon.es (西班牙)         → 使用 'es'
├─ Amazon.it (意大利)         → 使用 'it'
├─ Amazon.ca (加拿大)         → 使用 'ca'
├─ Amazon.com.au (澳大利亚)   → 使用 'com.au'
├─ Amazon.in (印度)           → 使用 'in'
└─ Amazon.com.mx (墨西哥)     → 使用 'com.mx'
```

> [!WARNING]
> 只有 **日本 (`co.jp`)** 区域经过充分测试。其他区域提供尽力支持，功能不保证。

### 多区域账户

如果您在多个 Amazon 区域有账户：

1. **为每个区域创建独立的配置文件**
   ```bash
   kindle-mcp-server-us/   # 使用 'com'
   kindle-mcp-server-jp/   # 使用 'co.jp'
   ```

2. **使用环境变量动态切换**（推荐）
   ```bash
   KINDLE_REGION=com npm start   # 美国
   KINDLE_REGION=co.jp npm start # 日本
   ```

3. **使用 CLI 参数**（临时覆盖）
   ```bash
   node dist/index.js --region=com
   node dist/index.js --region=co.jp
   ```

## 配置验证

### 检查当前配置

```bash
# 直接运行服务器，查看日志输出
node dist/index.js

# 输出示例：
# [MCP] Region configuration: co.jp (Japan) [via Default]
# [MCP] Sign-in URL: https://www.amazon.co.jp/login
# [MCP] Notebook URL: https://read.amazon.co.jp/notebook
```

### 日志输出说明

配置日志格式：
```
[MCP] Region configuration: {region} ({name}) [via {source}]
```

- `region`: 区域代码
- `name`: 区域名称
- `source`: 配置来源
  - `CLI argument` - 命令行参数
  - `Environment variable (KINDLE_REGION)` - 环境变量
  - `Config file (kindle-region.config.json)` - 配置文件
  - `Default` - 默认值

### 配置测试

运行配置测试：
```bash
npm run test:region
```

这将测试所有配置方式的优先级是否正确。

## 浏览器配置

浏览器配置存储在 `kindle-mcp-profile/` 目录中，包含：
- Cookies
- 会话状态
- 本地存储
- 浏览器缓存

### 配置目录位置

```
项目根目录/
└── kindle-mcp-profile/    # 自动生成
    ├── ...
```

### 不同区域共享配置

每个区域的登录状态是独立的。

如果需要切换区域，建议：
1. 删除 `kindle-mcp-profile/` 目录
2. 重新运行登录命令

## 高级配置

### 自定义端口

目前 MCP Server 使用 stdio 传输，不涉及端口配置。

### 日志级别

日志输出到 stderr，可以通过 shell 重定向：

```bash
# 保存日志到文件
node dist/index.js 2> server.log

# 同时显示和保存
node dist/index.js 2>&1 | tee server.log
```

### 超时设置

页面加载超时在代码中设置为 30 秒，如需修改，请编辑 `src/browser.ts`。

## 故障排除

### 配置不生效

1. 检查配置优先级
2. 查看日志中的配置来源
3. 确保配置文件格式正确

```bash
# 验证 JSON 格式
cat kindle-region.config.json | python3 -m json.tool
```

### 区域代码无效

```
错误：Invalid region: xx
有效区域：co.jp, com, co.uk, de, fr, es, it, ca, com.au, in, com.mx
```

解决方法：使用正确的区域代码。

### 会话过期

```bash
# 设置区域并重新登录
KINDLE_REGION=com npm run login
```

## 配置示例

### 开发环境

```bash
# 使用环境变量设置区域
export KINDLE_REGION=com
npm run build
npm run login
npm start
```

### 生产环境 (Claude Desktop)

```json
{
  "mcpServers": {
    "kindle": {
      "command": "node",
      "args": ["/usr/local/kindle-mcp-server/dist/index.js"],
      "env": {
        "KINDLE_REGION": "com"
      }
    }
  }
}
```

### Docker 部署

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install && npx playwright install chromium --with-deps
ENV KINDLE_REGION=com
CMD ["node", "dist/index.js"]
```

## 相关文档

- [安装指南](INSTALLATION.md)
- [MCP 工具参考](MCP-TOOLS.md)
- [故障排除](TROUBLESHOOTING.md)
