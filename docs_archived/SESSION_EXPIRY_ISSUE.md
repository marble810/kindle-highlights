# Session 过期问题分析与解决方案

## 问题描述

### 核心问题

虽然 Playwright 的 `persistentContext` 将登录 cookies 保存在 `kindle-mcp-profile/` 目录中，但这些 cookies 对 `read.amazon.co.jp/notebook` 页面无效。

### 表现

1. **直接导航到 notebook 页面失败**
   - 使用保存的 profile 直接导航到 `https://read.amazon.co.jp/notebook`
   - 结果：重定向到登录页面 (`/ap/signin`)
   - 错误：`Session expired or not logged in`

2. **登录状态的有效域不匹配**
   - Amazon 主页 (`www.amazon.co.jp`) 的登录状态有效
   - 但这个登录状态对子域名 (`read.amazon.co.jp`) 无效
   - 需要通过特定流程来"激活"跨域 session

## 优化方案（已实现）

### 用户体验改进

#### 1. 友好的错误提示

Session 过期时提供清晰的操作指引：

```
╔══════════════════════════════════════════════════════════╗
║  🔐 需要登录 Amazon 日本站                        ║
╚══════════════════════════════════════════════════════════╝

您的 session 已过期或尚未登录。请运行以下命令：

  npm run login:jp

这将打开浏览器，请按照提示完成登录。
登录成功后，session 会自动保存，之后可以正常使用。

💡 提示：
  • Session 通常可以保持数天到数周
  • 如果频繁过期，可能是 Amazon 的安全策略
  • 建议定期（如每周）重新登录一次
```

#### 2. 增强的登录流程

美化的登录流程输出：

```
╔══════════════════════════════════════════════════════════╗
║  🚀 正在启动 Kindle MCP 登录助手 - 日本站           ║
╚══════════════════════════════════════════════════════╝

📖 正在打开 Amazon 主页: https://www.amazon.co.jp

┌──────────────────────────────────────────────────┐
│  📋 请按照以下步骤操作：                  │
│                                           │
│  1️⃣  点击页面右上角的 "Sign in" 按钮    │
│  2️⃣  输入你的 Amazon 账号和密码        │
│  3️⃣  完成双因素认证（2FA）（如需要）      │
│                                           │
│  ✨ 登录成功后，系统会自动跳转到        │
│     Kindle 笔记本页面                      │
│                                           │
│  ⏳ 正在等待登录完成...                  │
└──────────────────────────────────────────────────┘

✅ 检测到登录成功！
🔄 正在自动跳转到 Kindle 笔记本页面...

🎉 成功访问 Kindle 笔记本页面！

┌──────────────────────────────────────────────────┐
│  ✅ 设置完成！                             │
│                                           │
│  💾 Session 已保存到本地               │
│  🎉 您现在可以关闭浏览器了                 │
│                                           │
│  💡 提示：                              │
│  • Session 通常可以保持数天到数周           │
│  • 如果频繁过期，可能是 Amazon 安全策略     │
│  • 建议定期（如每周）重新登录一次        │
│                                           │
│  📖 关闭浏览器后，即可开始使用 MCP 工具   │
└──────────────────────────────────────────────────┘
```

#### 3. Session 验证函数

```typescript
export async function validateSession(
  region: AmazonRegion = DEFAULT_REGION
): Promise<boolean> {
  const browserManager = new BrowserManager({ headless: true }, region);

  try {
    await browserManager.launch();
    const page = await browserManager.newPage();
    const notebookUrl = `https://read.amazon.${region}/notebook`;

    await page.goto(notebookUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    const url = page.url();
    await browserManager.close();

    return !url.includes('/signin') && !url.includes('/ap/signin');
  } catch (error) {
    await browserManager.close();
    return false;
  }
}
```

#### 4. MCP 工具错误处理增强

当 session 过期时，MCP 工具返回友好的操作指引而不是技术性错误。

### 优化前后对比

| 方面 | 优化前 | 优化后 |
|------|--------|--------|
| 错误提示 | 技术性错误消息 | 友好的操作指引 + emoji |
| 登录反馈 | 纯文本日志 | 美化输出 + 框线 |
| 进度提示 | 无 | 实时状态更新 |
| 用户体验 | 需要理解技术细节 | 清晰的步骤指引 |

## 总结

### 核心问题

Amazon 使用跨域 session 管理。主站 (`www.amazon.co.jp`) 和 Kindle 子域 (`read.amazon.co.jp`) 有独立的 session 机制。

### 解决方案

通过自动化"主页登录 → 自动导航到 notebook"的流程：
1. 在主域建立有效 session
2. 通过跳转传递 session 到子域
3. 使用 persistentContext 持久化保存

### 已实现的优化

✅ **友好的错误提示** - 清晰的操作指引
✅ **美化的控制台输出** - emoji 和框线
✅ **自动检测登录** - 无需手动导航
✅ **友好的完成提示** - 保存和后续步骤说明
✅ **Session 验证函数** - 操作前验证有效性
✅ **MCP 错误处理增强** - 友好提示代替技术错误
