# 安装指南

## 系统要求

### 必需组件

- **Node.js**: >= 20.10.0
- **npm**: >= 9.0.0
- **操作系统**: Linux, macOS, Windows

### 检查环境

```bash
# 检查 Node.js 版本
node --version

# 检查 npm 版本
npm --version
```

## 安装步骤

### 1. 克隆或下载项目

```bash
# 如果从 git 克隆
git clone <repository-url>
cd kindle-mcp-server

# 或解压下载的压缩包后进入目录
cd kindle-mcp-server
```

### 2. 安装依赖

```bash
npm install
```

这将安装以下依赖：

| 依赖包 | 用途 |
|--------|------|
| `@modelcontextprotocol/sdk` | MCP 协议 SDK |
| `playwright` | 浏览器自动化 |
| `winston` | 日志记录 |
| `zod` | 数据验证 |
| `dotenv` | 环境变量管理 |

### 3. 安装 Chromium

Playwright 需要下载 Chromium 浏览器：

```bash
npx playwright install chromium
```

### 4. 编译 TypeScript

```bash
npm run build
```

这将把 `src/` 下的 TypeScript 文件编译到 `dist/` 目录。

## 验证安装

运行以下命令验证安装是否成功：

```bash
# 运行单元测试
npm run test:unit

# 运行区域配置测试
npm run test:region
```

所有测试应该通过。

## Amazon 账户准备

### 登录要求

1. **有效的 Amazon 账户**：必须有 Kindle 内容的 Amazon 账户
2. **网络访问**：需要能够访问 `read.amazon.<region>`
3. **可能需要 2FA**：如果账户启用了双重认证，登录时需要输入验证码

### 区域确定

根据您的 Amazon 账户区域选择正确的区域代码：

| 账户所属 | 区域代码 |
|----------|----------|
| Amazon.co.jp (日本) | `co.jp` (默认) |
| Amazon.com (美国) | `com` |
| Amazon.co.uk (英国) | `co.uk` |
| Amazon.de (德国) | `de` |
| Amazon.fr (法国) | `fr` |

> [!NOTE]
> 服务器默认区域是 **`co.jp`** (日本)。如果不配置任何区域，将使用日本站。

## 首次登录

### 1. 运行登录命令

```bash
# 方法 1: 通过环境变量设置区域（推荐用于测试）
KINDLE_REGION=com npm run login

# 方法 2: 通过配置文件设置（持久化）
# 创建 kindle-region.config.json: {"region": "com"}
npm run login

# 方法 3: 使用 CLI 参数临时覆盖
npm run login -- --region=com

# 方法 4: 使用默认区域 (co.jp - 日本)
npm run login
```

### 2. 完成浏览器登录

登录流程已自动化：

1. Chrome 浏览器窗口将自动打开并访问 Amazon 首页
2. **手动点击页面右上角的"Sign in"登录按钮**
3. 输入您的 Amazon 账户和密码
4. 如果需要，完成 2FA 验证
5. 登录成功后，脚本会**自动检测并导航到 Kindle Notebook 页面**
6. 看到"Successfully reached Kindle Notebook!"提示后，可以关闭浏览器

### 3. 验证登录状态

```bash
npm start
```

如果看到以下输出，表示登录成功：

```
[MCP] Region configuration: co.jp (Japan) [via Default]
[MCP] Starting Kindle MCP Server...
[MCP] Server started and ready to accept connections
```

## MCP 客户端配置

### Claude Desktop (macOS)

1. 打开或创建配置文件：
   ```bash
   open ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. 添加服务器配置：
   ```json
   {
     "mcpServers": {
       "kindle": {
         "command": "node",
         "args": ["/absolute/path/to/kindle-mcp-server/dist/index.js"],
         "env": {
           "KINDLE_REGION": "com"
         }
       }
     }
   }
   ```

3. 重启 Claude Desktop

### Claude Desktop (Windows)

配置文件位置：`%APPDATA%\Claude\claude_desktop_config.json`

### Cline (VSCode)

在 VSCode 设置中添加 MCP 服务器配置。

## 目录结构

安装后的目录结构：

```
kindle-mcp-server/
├── dist/                      # 编译后的 JavaScript
│   ├── index.js
│   ├── browser.js
│   ├── config.js
│   └── types.js
├── src/                       # TypeScript 源码
│   ├── index.ts
│   ├── browser.ts
│   ├── config.ts
│   └── types.ts
├── kindle-mcp-profile/        # 浏览器配置文件（自动生成）
├── kindle-region.config.json  # 可选的区域配置
├── docs/                      # 文档
├── tests/                     # 测试文件
├── package.json
├── tsconfig.json
└── README.md
```

## 升级

### 从旧版本升级

```bash
# 1. 备份配置（如果有）
cp kindle-region.config.json kindle-region.config.json.backup

# 2. 拉取最新代码
git pull origin main

# 3. 安装新依赖
npm install

# 4. 重新编译
npm run build

# 5. 恢复配置
cp kindle-region.config.json.backup kindle-region.config.json
```

### 更新 Playwright

```bash
npx playwright install chromium --force
```

## 卸载

```bash
# 1. 删除浏览器配置文件
rm -rf kindle-mcp-profile/

# 2. 删除项目文件
rm -rf kindle-mcp-server/
```

## 下一步

- 阅读 [配置详解](CONFIGURATION.md) 了解更多配置选项
- 查看 [MCP 工具参考](MCP-TOOLS.md) 了解可用工具
- 遇到问题时查看 [故障排除](TROUBLESHOOTING.md)
