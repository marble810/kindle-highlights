# 人类测试指南

## 前置条件

1. 确保已安装 Playwright Chromium：
   ```bash
   npx playwright install chromium
   ```

2. 确保项目已构建：
   ```bash
   npm run build
   ```

---

## 测试 1: 登录流程 (--login 模式，日本地区)

**目的**: 验证交互式登录功能正常工作

```bash
# 登录到日本 Amazon (amazon.co.jp)
npm run login -- --region=co.jp

# 或登录到美国 Amazon (amazon.com) - 默认
npm run login
```

**预期结果**:
- [ ] Chrome 浏览器窗口打开
- [ ] 自动导航到正确的 Amazon 登录页面 (如 https://www.amazon.co.jp/ap/signin)
- [ ] 控制台显示当前地区信息
- [ ] 可以手动完成登录（包括 2FA）
- [ ] 关闭浏览器后程序正常退出

**如果失败**:
- 检查控制台错误信息
- 确认网络连接正常
- 确认 Chromium 已安装

---

## 测试 2: 直接运行 MCP Server（指定地区）

**目的**: 验证 MCP Server 能正常启动并使用指定地区

```bash
# 使用日本地区
node dist/index.js --region=co.jp

# 或使用默认美国地区
node dist/index.js
```

**预期结果**:
- [ ] 控制台显示: `[MCP] Using Amazon region: co.jp` (或 `com`)
- [ ] 控制台显示: `[MCP] Starting Kindle MCP Server...`
- [ ] 控制台显示: `[MCP] Server started and ready to accept connections`
- [ ] 控制台显示地区切换提示: `Region: co.jp | To change, use: --region=<region>`
- [ ] Server 保持运行状态（等待输入）

**测试 MCP 工具调用**:

在另一个终端，使用 MCP SDK 客户端测试：
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

或者调用 fetch_notes：
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"fetch_notes","arguments":{"limit":1}}}' | node dist/index.js
```

**预期结果**:
- [ ] 返回工具列表或执行结果
- [ ] 如果未登录，返回错误提示运行 `--login`
- [ ] JSON 格式正确

---

## 测试 3: 完整抓取流程（日本地区）

**目的**: 验证能成功抓取 Kindle 数据

1. 首先登录保存 session（日本地区）：
   ```bash
   npm run login -- --region=co.jp
   # 完成登录并导航到 https://read.amazon.co.jp/notebook
   # 关闭浏览器
   ```

2. 运行 MCP Server 并调用工具：
   ```bash
   node dist/index.js --region=co.jp
   ```

3. 在另一个终端调用 fetch_notes

**预期结果**:
- [ ] 浏览器自动启动（headless 模式）
- [ ] 导航到 Kindle Notebook 页面
- [ ] 成功提取书籍标题和作者
- [ ] 成功提取高亮和笔记
- [ ] 返回格式化的 JSON 数据

**验证数据格式**:
- [ ] 抓取的数据来自正确的地区（日本 Kindle 笔记）
- [ ] JSON 格式正确

```json
[
  {
    "title": "书名",
    "author": "作者名",
    "highlights": [
      {
        "text": "高亮文本内容",
        "note": "用户笔记或 null",
        "color": "yellow|blue|pink|orange|purple",
        "location": "Loc 123"
      }
    ]
  }
]
```

---

## 测试 4: 地区切换功能

**目的**: 验证可以在不同 Amazon 地区之间切换

```bash
# 测试日本地区
node dist/index.js --region=co.jp

# 测试英国地区
node dist/index.js --region=co.uk

# 测试德国地区
node dist/index.js --region=de
```

**预期结果**:
- [ ] 每个地区正确显示在控制台
- [ ] URL 正确使用对应的地区域名
- [ ] Invalid 地区被正确拒绝并显示有效地区列表

---

## 测试 4: 错误处理

**目的**: 验证各种错误场景被正确处理

### 4a: Session 过期

1. 删除或让 session 过期
2. 运行 fetch_notes

**预期**: 返回清晰的错误消息 "Session expired. Please run with `--login`"

### 4b: 无效的 limit 参数

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"fetch_notes","arguments":{"limit":-1}}}' | node dist/index.js
```

**预期**: 优雅处理错误，不崩溃

### 4c: 网络超时

1. 断开网络连接
2. 运行 fetch_notes

**预期**: 返回超时错误，而不是无限挂起

---

## 测试检查清单

| 测试项 | 状态 | 备注 |
|-------|------|------|
| 登录流程 | ⬜ | |
| MCP Server 启动 | ⬜ | |
| 指定地区启动 | ⬜ | |
| fetch_notes 工具 | ⬜ | |
| headless 浏览器 | ⬜ | |
| 数据格式正确 | ⬜ | |
| 错误处理 | ⬜ | |
| Session 持久化 | ⬜ | |
| 地区URL正确 | ⬜ | |
| 无效地区拒绝 | ⬜ | |

---

## 调试问题

### 问题: Chromium 未安装
**解决**: `npx playwright install chromium`

### 问题: "Cannot find module"
**解决**: 确保先运行 `npm run build`

### 问题: Session 每次都过时
**原因**: Amazon 的 cookie 可能有时间限制
**解决**: 每次使用前运行 `npm run login`

### 问题: 选择器无法找到元素
**原因**: Amazon 可能更改了页面结构
**解决**: 需要更新 `SELECTORS` 配置

---

## 完成测试后

请报告：
1. 通过的测试项
2. 失败的测试项及错误信息
3. 数据格式是否符合预期
4. 任何改进建议
