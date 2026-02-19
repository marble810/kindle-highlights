# API 参考

## 概述

本文档详细描述 Kindle MCP Server 的内部 API 接口、类型定义和函数签名。

## 目录

- [类型定义](#类型定义)
- [配置模块 (config.ts)](#配置模块-configts)
- [浏览器模块 (browser.ts)](#浏览器模块-browserts)
- [类型模块 (types.ts)](#类型模块-typests)

---

## 类型定义

### AmazonRegion

Amazon 区域代码类型。

```typescript
type AmazonRegion =
  | 'com'      // 美国
  | 'co.jp'    // 日本
  | 'co.uk'    // 英国
  | 'de'       // 德国
  | 'fr'       // 法国
  | 'es'       // 西班牙
  | 'it'       // 意大利
  | 'ca'       // 加拿大
  | 'com.au'   // 澳大利亚
  | 'in'       // 印度
  | 'com.mx';  // 墨西哥
```

### HighlightColor

Kindle 高亮颜色类型。

```typescript
type HighlightColor =
  | 'yellow'   // 黄色
  | 'blue'     // 蓝色
  | 'pink'     // 粉色
  | 'orange'   // 橙色
  | 'purple';  // 紫色
```

### KindleHighlight

单个高亮/笔记条目。

```typescript
interface KindleHighlight {
  /** 高亮的文本内容 */
  text: string;
  /** 用户添加的笔记，如果没有则为 null */
  note: string | null;
  /** 高亮颜色 */
  color: HighlightColor;
  /** 位置信息（如 "Loc 123" 或 "第 45 页"） */
  location: string;
}
```

### KindleBookData

完整的书籍数据。

```typescript
interface KindleBookData {
  /** 书籍标题 */
  title: string;
  /** 作者姓名 */
  author: string;
  /** 高亮和笔记数组 */
  highlights: KindleHighlight[];
}
```

### BookListItem

书籍列表项。

```typescript
interface BookListItem {
  /** Amazon 标准识别号 */
  asin: string;
  /** 书籍标题 */
  title: string;
  /** 作者姓名 */
  author: string;
}
```

### BrowserConfig

浏览器配置选项。

```typescript
interface BrowserConfig {
  /** 是否使用无头模式 */
  headless?: boolean;
  /** 用户数据目录路径（用于持久化会话） */
  userDataDir?: string;
  /** 额外的浏览器启动参数 */
  args?: string[];
}
```

### ScrapingResult<T>

抓取操作结果。

```typescript
interface ScrapingResult<T> {
  /** 操作是否成功 */
  success: boolean;
  /** 成功时的数据 */
  data?: T;
  /** 失败时的错误消息 */
  error?: string;
}
```

### LoginToolResult

登录工具返回结果。

```typescript
interface LoginToolResult {
  /** 是否成功 */
  success: boolean;
  /** 登录状态 */
  status: 'browser_opened' | 'login_detected' | 'failed';
  /** 状态消息 */
  message: string;
  /** Amazon 区域 */
  region: AmazonRegion;
}
```

### SessionRefreshResult

会话刷新结果。

```typescript
interface SessionRefreshResult {
  /** 是否成功 */
  success: boolean;
  /** 刷新方法 */
  method: 'cookie_refresh' | 'homepage_visit' | 'failed';
  /** 结果消息 */
  message: string;
}
```

---

## 配置模块 (config.ts)

### RegionConfig

区域配置元数据。

```typescript
interface RegionConfig {
  /** Amazon 区域代码 */
  region: AmazonRegion;
  /** 配置来源 */
  source: 'cli' | 'env' | 'file' | 'default';
  /** 区域名称 */
  name: string;
}
```

### RegionInfo

区域信息。

```typescript
interface RegionInfo {
  /** 区域名称 */
  name: string;
  /** Amazon URL */
  url: string;
}
```

### REGIONS

所有支持的区域信息常量。

```typescript
const REGIONS: Record<string, RegionInfo>;
```

### DEFAULT_REGION

默认区域常量。

```typescript
const DEFAULT_REGION: AmazonRegion = 'co.jp';  // 日本
```

### isValidRegion(region: string)

验证区域代码是否有效。

```typescript
function isValidRegion(region: string): region is AmazonRegion;
```

**参数**：
- `region`: 要验证的区域代码字符串

**返回**：类型谓词，如果是有效区域则为 true

---

### getRegionInfo(region: AmazonRegion)

获取区域信息。

```typescript
function getRegionInfo(region: AmazonRegion): RegionInfo;
```

**参数**：
- `region`: Amazon 区域代码

**返回**：区域信息对象

---

### getRegionConfig(cliArg: string | null)

获取区域配置（四层优先级）。

```typescript
function getRegionConfig(cliArg: string | null): RegionConfig;
```

**参数**：
- `cliArg`: 命令行参数中的区域代码，如果没有则为 null

**返回**：区域配置对象

**优先级**：
1. CLI 参数（最高）
2. 环境变量 (KINDLE_REGION)
3. 配置文件 (kindle-region.config.json)
4. 默认值 (co.jp)

---

### getValidRegions()

获取所有有效区域代码列表。

```typescript
function getValidRegions(): string[];
```

**返回**：区域代码数组

---

### formatRegionConfig(config: RegionConfig)

格式化区域配置用于日志输出。

```typescript
function formatRegionConfig(config: RegionConfig): string;
```

**参数**：
- `config`: 区域配置对象

**返回**：格式化的字符串，如 "co.jp (Japan) [via CLI argument]"

---

## 浏览器模块 (browser.ts)

### BrowserManager

浏览器管理器类。

```typescript
class BrowserManager {
  constructor(config?: Partial<BrowserConfig>, region?: AmazonRegion);
  async launch(): Promise<void>;
  async close(): Promise<void>;
  async newPage(): Promise<Page>;
  getRegion(): AmazonRegion;
  getContext(): BrowserContext | null;
}
```

#### constructor(config?, region?)

创建浏览器管理器实例。

```typescript
constructor(config?: Partial<BrowserConfig>, region?: AmazonRegion);
```

**参数**：
- `config`: 可选的浏览器配置
- `region`: Amazon 区域代码，默认为 'co.jp'

---

#### launch()

启动浏览器。

```typescript
async launch(): Promise<void>;
```

---

#### close()

关闭浏览器。

```typescript
async close(): Promise<void>;
```

---

#### newPage()

创建新页面。

```typescript
async newPage(): Promise<Page>;
```

**返回**：Playwright Page 对象

---

### KindleScraper

Kindle 抓取器类。

```typescript
class KindleScraper {
  constructor(browserManager: BrowserManager, region?: AmazonRegion);
  async navigateToNotebook(): Promise<void>;
  async extractBookData(authorOverride?: string): Promise<ScrapingResult<KindleBookData>>;
  async getBookList(): Promise<BookListItem[]>;
  async selectBook(asin: string): Promise<boolean>;
  async close(): Promise<void>;
}
```

---

### 辅助函数

#### validateSession(region)

验证会话是否有效。

```typescript
async function validateSession(region: AmazonRegion): Promise<boolean>;
```

**参数**：
- `region`: Amazon 区域代码

**返回**：会话是否有效

---

#### refreshSessionHeadless(region)

在无头模式下尝试刷新会话。

```typescript
async function refreshSessionHeadless(region: AmazonRegion): Promise<SessionRefreshResult>;
```

**参数**：
- `region`: Amazon 区域代码

**返回**：刷新结果对象

**刷新策略**：
1. 尝试直接访问 Notebook
2. 如果失败，先访问 Amazon 首页，再访问 Notebook

---

#### getLoginInstructions(region)

获取用户友好的登录说明。

```typescript
function getLoginInstructions(region: AmazonRegion): string;
```

**参数**：
- `region`: Amazon 区域代码

**返回**：格式化的登录说明字符串

---

#### launchLoginSession(region)

启动登录会话（非无头模式）。

```typescript
async function launchLoginSession(region: AmazonRegion): Promise<void>;
```

**参数**：
- `region`: Amazon 区域代码

**流程**：
1. 打开浏览器并访问 Amazon 首页
2. 等待用户手动登录
3. 检测登录后自动导航到 Kindle Notebook

---

#### launchLoginForMCP(region)

为 MCP 工具启动登录会话。

```typescript
async function launchLoginForMCP(region: AmazonRegion): Promise<LoginToolResult>;
```

**参数**：
- `region`: Amazon 区域代码

**返回**：登录工具结果对象

---

#### getBookList(region, autoRefresh?)

获取书籍列表。

```typescript
async function getBookList(
  region: AmazonRegion,
  autoRefresh?: boolean
): Promise<ScrapingResult<BookListItem[]>>;
```

**参数**：
- `region`: Amazon 区域代码
- `autoRefresh`: 是否自动刷新过期会话，默认为 true

**返回**：书籍列表的抓取结果

---

#### fetchBookHighlights(asin, region, autoRefresh?)

获取指定书籍的高亮和笔记。

```typescript
async function fetchBookHighlights(
  asin: string,
  region: AmazonRegion,
  autoRefresh?: boolean
): Promise<ScrapingResult<KindleBookData>>;
```

**参数**：
- `asin`: 书籍的 ASIN
- `region`: Amazon 区域代码
- `autoRefresh`: 是否自动刷新过期会话，默认为 true

**返回**：书籍数据的抓取结果

---

#### scrapeKindleNotes(bookLimit, region)

主要的抓取函数入口。

```typescript
async function scrapeKindleNotes(
  bookLimit?: number,
  region?: AmazonRegion
): Promise<ScrapingResult<KindleBookData[]>>;
```

**参数**：
- `bookLimit`: 要获取的书籍数量，默认为 1
- `region`: Amazon 区域代码，默认为 'co.jp'

**返回**：书籍数据数组的抓取结果

---

## 类型模块 (types.ts)

### 辅助函数

#### getAmazonBaseUrl(region)

获取 Amazon 基础 URL。

```typescript
function getAmazonBaseUrl(region: AmazonRegion): string;
```

**参数**：
- `region`: Amazon 区域代码

**返回**：基础 URL，如 "https://www.amazon.com"

---

#### getNotebookUrl(region)

获取 Kindle Notebook URL。

```typescript
function getNotebookUrl(region: AmazonRegion): string;
```

**参数**：
- `region`: Amazon 区域代码

**返回**：Notebook URL，如 "https://read.amazon.com/notebook"

---

### 错误类

#### AuthError

认证错误。

```typescript
class AuthError extends Error {
  constructor(message?: string);
}
```

---

#### SelectorError

选择器错误。

```typescript
class SelectorError extends Error {
  constructor(selector: string);
}
```

---

#### ScrapingError

抓取错误。

```typescript
class ScrapingError extends Error {
  constructor(message: string);
}
```

---

## MCP 协议接口

### Server

MCP 服务器实例。

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

const server = new Server(
  {
    name: 'kindle-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);
```

### ListToolsRequestSchema

工具列表请求架构。

```typescript
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // 工具定义
    ],
  };
});
```

### CallToolRequestSchema

工具调用请求架构。

```typescript
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  // 处理工具调用
});
```

---

## 使用示例

### 基本用法

```typescript
import { getRegionConfig } from './config.js';
import { getBookList, fetchBookHighlights } from './browser.js';

// 获取配置
const config = getRegionConfig(null);
console.log(`Using region: ${config.region}`);

// 获取书籍列表
const booksResult = await getBookList(config.region);
if (booksResult.success && booksResult.data) {
  for (const book of booksResult.data) {
    console.log(`${book.title} by ${book.author}`);
  }
}

// 获取书籍笔记
const notesResult = await fetchBookHighlights('B08XXXXX', config.region);
if (notesResult.success && notesResult.data) {
  console.log(`Found ${notesResult.data.highlights.length} highlights`);
}
```

### 自定义浏览器配置

```typescript
import { BrowserManager } from './browser.js';

const manager = new BrowserManager(
  {
    headless: false,
    userDataDir: './my-profile',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  },
  'com'
);

await manager.launch();
// 使用浏览器...
await manager.close();
```

### 会话验证

```typescript
import { validateSession, refreshSessionHeadless } from './browser.js';

// 检查会话是否有效
const isValid = await validateSession('co.jp');
if (!isValid) {
  // 尝试自动刷新
  const result = await refreshSessionHeadless('co.jp');
  if (result.success) {
    console.log('Session refreshed successfully');
  } else {
    console.log('Manual login required');
  }
}
```

---

## 错误处理

### 检查抓取结果

```typescript
import type { ScrapingResult } from './types.js';

function handleResult<T>(result: ScrapingResult<T>) {
  if (result.success) {
    console.log('Success:', result.data);
  } else {
    console.error('Error:', result.error);
  }
}
```

### 捕获异常

```typescript
import { AuthError, ScrapingError, SelectorError } from './types.js';

try {
  const result = await fetchBookHighlights(asin, region);
} catch (error) {
  if (error instanceof AuthError) {
    console.error('Authentication failed:', error.message);
  } else if (error instanceof SelectorError) {
    console.error('Element not found:', error.message);
  } else if (error instanceof ScrapingError) {
    console.error('Scraping failed:', error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

---

## 相关文档

- [安装指南](INSTALLATION.md)
- [配置详解](CONFIGURATION.md)
- [MCP 工具参考](MCP-TOOLS.md)
- [故障排除](TROUBLESHOOTING.md)
