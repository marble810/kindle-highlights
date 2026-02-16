# Kindle Web Reader MCP Server - 项目构建计划

## 给 AI Agent 的核心指令 (System Instructions)

### 1. 严格循序渐进
- 禁止跳过任何步骤。每完成一个 Step，**必须**运行对应的 `npm run test:unit`。
- 除非用户明确要求跳过，否则不得省略任何实现细节。

### 2. 人类介入法则 (Human-in-the-Loop)
- 遇到标注为 `🧪 人类测试` 的环节，**必须停止生成代码**，提示用户进行手动操作。
- 直到用户确认通过后，才能继续下一步。
- **关键**：所有需要浏览器/页面交互的操作，都属于人类测试环节。

### 3. 选择器配置 (禁止硬编码)
- **禁止**在业务逻辑中硬编码 CSS 选择器。
- 必须通过 Step 3.2 分析并提取到 `src/selectors.ts`。
- 所有选择器必须是动态可配置的常量。

### 4. 反爬与安全
- 默认使用 Playwright Stealth 插件隐藏浏览器指纹。
- 严禁将 `kindle-mcp-profile/` 目录提交到版本控制。

### 5. 错误处理
- 单元测试必须 Mock 所有外部依赖（浏览器、页面）。
- 集成测试必须验证完整流程，但使用 Mock 数据。

---

## 项目概述

构建一个基于 Node.js 的 MCP (Model Context Protocol) 服务器，使用 Playwright 从 `read.amazon.com/notebook` 抓取 Kindle 高亮和笔记。

**技术栈**：Node.js 20+, TypeScript 5.3+, Playwright 1.40+ (配合 Stealth 插件), MCP SDK 1.0+

**核心设计**：
- `src/index.ts` - MCP Server 入口 (stdio transport)
- `src/browser.ts` - Playwright 封装（登录与抓取逻辑）
- `src/types.ts` - TypeScript 接口定义
- `tests/unit/` - 单元测试（Mock 所有外部依赖）

---

## Phase 1: 项目初始化 ✅

### Step 1.1: 创建 package.json
```json
{
  "name": "kindle-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "kindle-mcp": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "login": "node dist/index.js --login",
    "login:jp": "node dist/index.js --login --region co.jp",
    "login:uk": "node dist/index.js --login --region co.uk",
    "start": "node dist/index.js",
    "start:jp": "node dist/index.js --region co.jp",
    "start:uk": "node dist/index.js --region co.uk",
    "test": "vitest",
    "test:unit": "vitest run tests/unit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "dotenv": "^16.3.0",
    "playwright": "^1.40.0",
    "playwright-extra": "^4.3.0",
    "puppeteer-extra-plugin-stealth": "^2.11.0",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.58.2",
    "@types/node": "^20.10.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

### Step 1.2: 配置 TypeScript
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### Step 1.3: 配置 .gitignore
```
kindle-mcp-profile/     # Browser profile with cookies/session
dist/                   # Compiled TypeScript
node_modules/
.env
debug/
```

### Step 1.4: 创建占位文件
```bash
# 创建必要的源文件目录结构
mkdir -p src tests/unit

# 创建占位文件（后续 Phase 会填充内容）
echo "// Placeholder" > src/index.ts
echo "// Placeholder" > src/types.ts
```

**验证**：
```bash
npm install
npm run build
npm run test:unit
```

---

## Phase 2: 核心类型定义 ✅

### Step 2.1: 定义 Amazon 区域类型
**文件**: `src/types.ts`

**关键类型**：
```typescript
export type AmazonRegion =
  | 'com'    // 美国
  | 'co.jp'   // 日本
  | 'co.uk'   // 英国
  | 'de'      // 德国
  | 'fr'      // 法国
  | 'es'      // 西班牙
  | 'it'      // 意大利
  | 'ca'      // 加拿大
  | 'com.au'  // 澳大利亚
  | 'in'      // 印度
  | 'com.mx'; // 墨西哥
```

### Step 2.2: 定义 Kindle 高亮颜色
**重要**: Kindle 有 **5 种**高亮颜色，不是 4 种！

```typescript
export type HighlightColor = 'yellow' | 'blue' | 'pink' | 'orange' | 'purple';
```

### Step 2.3: 定义核心数据结构
```typescript
export interface KindleHighlight {
  text: string;        // 高亮文本
  note: string | null; // 用户笔记（可能为空）
  color: HighlightColor; // 高亮颜色（5种之一）
  location: string;       // 位置信息（如 "Loc 123"）
}

export interface KindleBookData {
  title: string;         // 书名
  author: string;        // 作者名
  highlights: KindleHighlight[]; // 高亮数组
}
```

### Step 2.4: 定义函数参数类型
```typescript
export interface FetchNotesArgs {
  limit?: number;           // 获取书籍数量（默认：1）
  maxHighlights?: number;  // 每本书最大高亮数（防 Token 溢出）
}
```

### Step 2.5: 定义浏览器配置
```typescript
export interface BrowserConfig {
  headless: boolean;      // 是否无头模式
  userDataDir: string;     // 用户数据目录
  args?: string[];       // 额外的浏览器启动参数
}
```

### Step 2.6: 定义专用错误类型
```typescript
export class AuthError extends Error {
  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthError';
  }
}

export class ScrapingError extends Error {
  constructor(message: string) {
    super(`Scraping failed: ${message}`);
    this.name = 'ScrapingError';
  }
}

export interface ScrapingResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

**验证**：
```bash
npm run test:unit
```

---

## Phase 3: 浏览器自动化 ✅

> **重要变更**：登录流程已从"直接导航到登录页"改为"打开主页 → 用户手动点击进入登录页"。

### Step 3.1: 创建浏览器管理器 (BrowserManager)
**文件**: `src/browser.ts`

**核心类**：
```typescript
export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private config: BrowserConfig;
  private region: AmazonRegion;

  constructor(config: Partial<BrowserConfig> = {}, region: AmazonRegion = 'com') {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.region = region;
  }

  async launch(): Promise<void> { ... }
  async newPage(): Promise<Page> { ... }
  async close(): Promise<void> { ... }
  getRegion(): AmazonRegion { return this.region; }
}
```

### Step 3.2: 创建抓取器 (KindleScraper)
**文件**: `src/browser.ts`

**核心类**：
```typescript
export class KindleScraper {
  private page: Page | null = null;
  private region: AmazonRegion;

  constructor(private browserManager: BrowserManager, region: AmazonRegion = 'com') {
    this.region = region;
  }

  async navigateToNotebook(): Promise<void> { ... }
  async extractBookData(): Promise<ScrapingResult<KindleBookData>> { ... }
  async close(): Promise<void> { ... }
}
```

### Step 3.3: 实现登录流程（NEW 人工介入方式）
**文件**: `src/browser.ts`

**新流程**：
1. **打开 Amazon 主页**（不是直接导航到登录页）
2. **用户手动点击** "Sign in" 按钮进入登录页面
3. **完成登录后**，用户手动导航到 `https://read.amazon.{region}/notebook`
4. **Session 保存**到 `kindle-mcp-profile/`

**实现要点**：
```typescript
export async function launchLoginSession(
  region: AmazonRegion = 'com'
): Promise<void> {
  const browserManager = new BrowserManager({
    headless: false,  // 有头模式
  }, region);

  await browserManager.launch();

  const page = await browserManager.newPage();

  // NEW: 打开各地区主页，而不是直接导航到登录页
  const homeUrl = `https://www.amazon.${region}`;
  console.log(`[Login] Opening Amazon homepage: ${homeUrl}`);
  await page.goto(homeUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  console.log('[Login] Browser opened. Please:');
  console.log('  1. Click "Sign in" button to go to login page');
  console.log(`  2. Log in with your Amazon credentials`);
  console.log('  3. Complete any 2FA/verification steps');
  console.log(`  4. Navigate to: https://read.amazon.${region}/notebook`);
  console.log('  5. Close the browser when done');

  // 等待用户操作完成（通过手动关闭浏览器）
  await new Promise<void>((resolve) => {
    const checkInterval = setInterval(() => {
      if (!browserManager['browser']) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 1000);
  })();

  console.log('[Login] Session saved. You can now run the MCP server.');
}
```

**验证**：
```bash
# 测试登录流程
npm run login:jp

# 预期控制台输出
[Login] Opening Amazon homepage: https://www.amazon.co.jp
[Login] Browser opened. Please:
  1. Click "Sign in" button to go to login page
  2. Log in with your Amazon credentials
  3. Complete any 2FA/verification steps
  4. Navigate to: https://read.amazon.co.jp/notebook
  5. Close the browser when done
[Login] Session saved. You can now run the MCP server.
```

### Step 3.4: 实现笔记抓取 (scrapeKindleNotes)
**文件**: `src/browser.ts`

**主函数**：
```typescript
export async function scrapeKindleNotes(
  bookLimit: number = 1,
  region: AmazonRegion = 'com'
): Promise<ScrapingResult<KindleBookData[]>> {
  const browserManager = new BrowserManager({}, region);
  const results: KindleBookData[] = [];

  try {
    await browserManager.launch();
    const scraper = new KindleScraper(browserManager, region);
    await scraper.navigateToNotebook();
    // ... 抓取逻辑 ...
  } finally {
    await browserManager.close();
  }

  return {
    success: true,
    data: results,
  };
}
```

**验证**：
```bash
npm run build
npm run test:unit
```

---

## Phase 4: MCP 服务器实现 ✅

### Step 4.1: 创建 MCP Server
**文件**: `src/index.ts`

**核心功能**：
- 注册 `fetch_notes` 工具
- 处理 `--login` 和 `--region` 命令行参数
- stdio transport 通信

**工具定义**：
```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'fetch_notes',
        description: 'Fetch Kindle highlights and notes from read.amazon.com. Returns book metadata and highlighted passages.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of recent books to fetch (default: 1)',
            },
          },
        },
      },
    ],
  };
});
```

**参数处理**：
```typescript
function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    login: false,
    region: null,
  };

  for (const arg of args) {
    if (arg === '--login') {
      result.login = true;
    } else if (arg.startsWith('--region=')) {
      const regionCode = arg.split('=')[1] as AmazonRegion;
      if (isValidRegion(regionCode)) {
        result.region = regionCode;
      } else {
        console.error(`Invalid region: ${regionCode}`);
        console.error('Valid regions: com, co.jp, co.uk, de, fr, es, it, ca, com.au, in, com.mx');
        process.exit(1);
      }
    }
  }

  return result;
}
```

**验证**：
```bash
npm run build

# 验证 MCP Server 启动（不登录）
node dist/index.js

# 预期：控制台显示地区信息
[MCP] Using Amazon region: com (United States)
[MCP] Starting Kindle MCP Server...
[MCP] Server started and ready to accept connections
```

---

## 支持的 Amazon 区域

| 区域代码 | 国家 | 主页 URL | Notebook URL |
|----------|------|----------|----------|
| `com` | 美国 (默认) | https://www.amazon.com | https://read.amazon.com/notebook |
| `co.jp` | 日本 | https://www.amazon.co.jp | https://read.amazon.co.jp/notebook |
| `co.uk` | 英国 | https://www.amazon.co.uk | https://read.amazon.co.uk/notebook |
| `de` | 德国 | https://www.amazon.de | https://read.amazon.de/notebook |
| `fr` | 法国 | https://www.amazon.fr | https://read.amazon.fr/notebook |
| `es` | 西班牙 | https://www.amazon.es | https://read.amazon.es/notebook |
| `it` | 意大利 | https://www.amazon.it | https://read.amazon.it/notebook |
| `ca` | 加拿大 | https://www.amazon.ca | https://read.amazon.ca/notebook |
| `com.au` | 澳大利亚 | https://www.amazon.com.au | https://read.amazon.com.au/notebook |
| `in` | 印度 | https://www.amazon.in | https://read.amazon.in/notebook |
| `com.mx` | 墨西哥 | https://www.amazon.com.mx | https://read.amazon.com.mx/notebook |

---

## 验证清单

| Phase | 状态 | 验证命令 |
|------|------|----------|
| Phase 1: 项目初始化 | ✅ | `npm run build && npm run test:unit` |
| Phase 2: 核心类型定义 | ✅ | `npm run test:unit` |
| Phase 3: 浏览器自动化 | ✅ | `npm run build && npm run test:unit` |
| Phase 4: MCP 服务器实现 | ✅ | `npm run build` 启动测试 |

---

## 使用指南

### 安装依赖
```bash
npm install
npx playwright install chromium
```

### 首次登录（设置 Session）
```bash
# 日本站
npm run login:jp

# 英国站
npm run login:uk

# 美国站（需要新增脚本）
# npm run login:fr
```

### 运行 MCP Server
```bash
# 默认（美国站）
node dist/index.js

# 指定地区
node dist/index.js --region co.jp
```

### 运行测试
```bash
# 单元测试
npm run test:unit

# 集成测试（需要实现）
npm run test:integration
```

---

## 项目文件结构

```
kindle-highlights/
├── src/
│   ├── index.ts          # MCP Server 入口 (4个 Phase)
│   ├── browser.ts        # Playwright 封装 (登录、抓取、Session 管理)
│   └── types.ts         # TypeScript 类型定义
├── tests/
│   └── unit/
│       ├── verify-setup.test.ts
│       ├── dependencies.test.ts
│       ├── types.test.ts
│       └── browser.test.ts
├── dist/                    # 编译输出
├── kindle-mcp-profile/    # 浏览器 Session 数据（不提交）
├── package.json
├── tsconfig.json
├── tsconfig.json
├── .gitignore
├── CLAUDE.md
└── README.md
```

---

**关键变更说明**：
- **登录流程重构**：从"直接导航到登录页"改为"打开主页 → 用户手动点击进入登录页"
- **地区参数简化**：使用 `--region=<code>` 格式，通过 package.json 脚本提供快捷方式
