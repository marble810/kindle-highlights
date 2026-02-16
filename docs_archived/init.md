这是一份为下一个 Session 准备的**项目上下文文档 (Context Document)**。你可以直接将此文档发送给新的对话窗口（或 Agent），它将包含所有必要的技术决策和架构细节，以便立即开始编码。

---

# Project Context: Kindle Web Reader MCP Server (Node.js Version)

## 1. 项目目标
开发一个基于 **Node.js** 的 **MCP (Model Context Protocol) Server**。该服务通过 **Playwright** 模拟浏览器访问 Kindle Web Reader (`read.amazon.com/notebook`)，抓取用户的读书笔记与高亮，并以 **Structured JSON** 格式返回数据，供上层 AI Agent (如 Claude Code) 进行后续的整理、分析或 Markdown 转换。

## 2. 技术栈 (Tech Stack)
*   **语言**: Node.js / TypeScript (利用 Playwright 原生 JS 执行的优势)
*   **核心库**:
    *   `@modelcontextprotocol/sdk`: MCP 协议实现
    *   `playwright`: 无头浏览器自动化
    *   `zod`: 输入验证与 Schema 定义
*   **运行环境**: 本地终端 (Local CLI)，作为 MCP Server 运行。

## 3. 核心功能与工作流

### 3.1 认证机制 (Authentication)
*   **策略**: **持久化 Browser Context (Persistent Context)**。
*   **流程**:
    1.  提供一个“手动登录模式” (Flag: `--login`)，启动带界面的 Chrome。
    2.  用户手动登录 Amazon 账号。
    3.  登录成功后关闭窗口，Cookies 和 Session 数据自动保存至本地文件夹 (`./kindle-mcp-profile`)。
    4.  后续 MCP 工具调用时，加载此 Profile 实现免登访问。

### 3.2 工具定义 (MCP Tools)
Server 将暴露以下主要工具 (Tool)：

#### Tool: `fetch_notes`
*   **描述**: 获取指定书籍或最近阅读书籍的高亮与笔记。
*   **输入 (Input Schema)**:
    ```json
    {
      "limit": "number (optional) - 限制获取的书籍数量，默认为 1 (最近一本)"
    }
    ```
    *(注：由于 Kindle 网页版 URL 结构限制，通过 ASIN 精确搜索较复杂，初版 MVP 建议直接抓取“当前/最近”页面，或遍历列表)*
*   **输出 (Output)**: JSON 字符串，包含书籍元数据和笔记列表。

### 3.3 数据结构 (JSON Output Schema)
这是从 DOM 中提取并整理后的最终 JSON 格式：

```typescript
interface KindleBookData {
  title: string;       // 书名
  author: string;      // 作者
  coverUrl: string;    // 封面图片 URL
  lastAccessed: string;// 最后访问时间
  highlights: {
    text: string;      // 高亮原文
    note: string | null; // 用户添加的笔记 (User Note)
    color: "yellow" | "blue" | "pink" | "orange"; // 高亮颜色
    location: string;  // 电子书位置代码 (e.g., "Loc 345")
  }[];
}
```

## 4. 实现细节 (Implementation Steps)

### 4.1 Playwright DOM 抓取逻辑 (Node.js 优势)
无需在 Python 中拼接字符串，直接在 TypeScript 中编写 `page.evaluate` 函数。

*   **页面 URL**: `https://read.amazon.com/notebook`
*   **关键 CSS Selectors (需根据 Amazon 实际页面适配)**:
    *   **Book Title**: `h2` output likely inside `.a-spacing-top-small`
    *   **Container**: `.a-spacing-base` (每一个笔记块)
    *   **Highlight Text**: `#highlight`
    *   **User Note**: `#note`
    *   **Color Class**: `.kp-notebook-highlight-[color]`

### 4.2 错误处理
*   **未登录**: 检测 URL 是否重定向至 `signin`，如果是，返回明确错误提示：“Session expired. Please run with `--login` to refresh cookies.”
*   **超时**: 设置合理的 `30s` 超时，若页面未加载出笔记列表，返回空数据或重试提示。

## 5. 项目结构规划

```text
kindle-mcp-node/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts        # MCP Server 入口 (Stdio Transport)
│   ├── browser.ts      # Playwright 封装 (Login & Scrape逻辑)
│   └── types.ts        # TS 接口定义
└── kindle-mcp-profile/ # (GitIgnore) 存放浏览器 User Data
```

## 6. 给 AI Agent 的指令 (Prompt via Developer)
"请基于上述文档，使用 TypeScript 和 `@modelcontextprotocol/sdk` 实现该 MCP Server。请先创建 `package.json` 和 `tsconfig.json`，然后实现核心的 `browser.ts` 抓取逻辑，最后在 `index.ts` 中组装 MCP 服务。"
