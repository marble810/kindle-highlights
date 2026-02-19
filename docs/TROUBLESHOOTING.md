# 故障排除

## 常见问题

### 登录问题

#### 问题：浏览器打开后没有自动跳转到登录页面

**症状**：运行 `npm run login` 后，浏览器打开了 Amazon 首页，但没有进入登录页面。

**原因**：这是**设计行为**。为了避免 Amazon 的反自动化检测，脚本不会自动点击登录按钮。

**解决方案**：
1. 在打开的浏览器中，**手动点击页面右上角的"Sign in"或"登录"按钮**
2. 输入您的 Amazon 账户和密码
3. 完成 2FA 验证（如果启用）
4. 等待脚本自动检测到登录状态并导航到 Kindle Notebook

---

#### 问题：登录后提示"Session expired"

**症状**：
```
[MCP] Error: Session expired. Please run with --login to refresh cookies.
```

**原因**：
- Amazon 会话已过期（通常 1-2 周后）
- 浏览器配置文件被删除或损坏
- 切换了不同的 Amazon 区域

**解决方案**：
```bash
# 1. 删除旧的会话
rm -rf kindle-mcp-profile/

# 2. 设置区域并重新登录
KINDLE_REGION=com npm run login
```

---

#### 问题：登录时卡住不动

**症状**：浏览器打开后长时间无响应

**解决方案**：
1. **关闭浏览器**，按 Ctrl+C 停止脚本
2. 删除配置文件：`rm -rf kindle-mcp-profile/`
3. 设置正确的区域：`KINDLE_REGION=com` （或您的区域）
4. 重新运行登录命令：`npm run login`
5. 确保**手动点击登录按钮**后等待脚本响应

---

#### 问题：2FA 验证问题

**症状**：登录时需要短信验证码，但输入后没有反应

**解决方案**：
1. 确保在验证码输入后点击"提交"或"继续"
2. 检查手机是否收到验证码
3. 如果使用验证器 App，确保时间同步
4. 完成验证后，脚本会自动检测到登录状态

---

### 区域配置问题

#### 问题：配置的区域不生效

**症状**：设置了某个区域，但服务器使用了默认区域

**原因**：配置优先级问题

**解决方案**：
```bash
# 检查当前配置
node dist/index.js 2>&1 | grep "Region configuration"

# 输出示例：
# [MCP] Region configuration: co.jp (Japan) [via Default]
#                                              ^^^^^^^^^^^^^^^
#                                              注意这里显示的来源

# 如果显示 "via Default"：
# - 检查环境变量是否设置：echo $KINDLE_REGION
# - 检查配置文件是否存在：cat kindle-region.config.json

# 如果显示 "via Environment variable" 但区域不对：
# - 确认环境变量值：echo $KINDLE_REGION

# 如果显示 "via Config file" 但区域不对：
# - 检查 JSON 格式：cat kindle-region.config.json | python3 -m json.tool
```

---

#### 问题：Invalid region 错误

**症状**：
```
Invalid region: cn
Valid regions: co.jp, com, co.uk, de, fr, es, it, ca, com.au, in, com.mx
```

**原因**：使用了不支持的区域代码

**解决方案**：使用支持的区域代码，参考下表：

| 账户所属 | 正确代码 |
|----------|----------|
| Amazon.co.jp 日本 | `co.jp` (默认) |
| Amazon.com 美国 | `com` |
| Amazon.co.uk 英国 | `co.uk` |
| Amazon.de 德国 | `de` |
| Amazon.fr 法国 | `fr` |
| Amazon.es 西班牙 | `es` |
| Amazon.it 意大利 | `it` |
| Amazon.ca 加拿大 | `ca` |
| Amazon.com.au 澳大利亚 | `com.au` |
| Amazon.in 印度 | `in` |
| Amazon.com.mx 墨西哥 | `com.mx` |

---

#### 问题：区域代码拼写正确但仍报错

**症状**：输入了正确的区域代码，但仍然报错

**可能原因**：
- 配置文件 JSON 格式错误
- 环境变量中有不可见字符
- CLI 参数格式错误

**解决方案**：
```bash
# 1. 验证 JSON 格式
cat kindle-region.config.json | python3 -m json.tool

# 2. 检查环境变量（注意引号）
echo "$KINDLE_REGION"  # 正确
echo $KINDLE_REGION    # 可能有问题

# 3. 使用正确的 CLI 格式
# 正确：
node dist/index.js --region=com
node dist/index.js --region co.jp

# 错误：
node dist/index.js --region co.jp --login  # 顺序错误（应该 npm run login -- --region=co.jp）
```

---

### MCP 工具问题

#### 问题：get_book_list 返回 SESSION_EXPIRED

**症状**：
```json
{
  "error": "SESSION_EXPIRED",
  "message": "Your Amazon session has expired.",
  "actionRequired": "Please use the \"login\" MCP tool to re-authenticate."
}
```

**解决方案**：
1. 在 Claude 中使用 `login` 工具
2. 或在命令行运行：`npm run login`
3. 重新完成登录流程

---

#### 问题：fetch_notes 找不到书籍

**症状**：
```json
{
  "error": "ASIN not found",
  "message": "The specified book ASIN could not be found."
}
```

**可能原因**：
- ASIN 错误或过期
- 书籍被删除或没有高亮
- 区域不匹配

**解决方案**：
```
1. 在 Claude 中说："重新获取书籍列表"
2. 使用最新的 ASIN
3. 确保书籍在 Kindle Notebook 中有高亮或笔记
4. 确认使用的是正确的 Amazon 区域
```

---

#### 问题：Claude Desktop 找不到 MCP 服务器

**症状**：Claude Desktop 启动后无法使用 Kindle 功能

**解决方案**：

1. **检查配置文件路径**：
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. **检查配置格式**：
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

3. **使用绝对路径**：
   ```json
   // ❌ 错误：相对路径
   "args": ["./dist/index.js"]

   // ✅ 正确：绝对路径
   "args": ["/Users/username/kindle-mcp-server/dist/index.js"]
   ```

4. **验证安装**：
   ```bash
   # 测试服务器是否能正常运行
   node /absolute/path/to/dist/index.js
   ```

5. **重启 Claude Desktop**：
   - 完全退出 Claude Desktop
   - 重新打开应用

---

### 数据抓取问题

#### 问题：没有返回任何书籍

**症状**：`get_book_list` 返回空数组

**可能原因**：
- Kindle Notebook 中没有高亮或笔记
- Amazon 账户没有符合条件的书籍
- 网络连接问题

**解决方案**：
1. 在浏览器中访问 `https://read.amazon.<region>/notebook`
2. 确认是否有书籍显示
3. 如果有书籍但服务器获取不到，可能是选择器问题

---

#### 问题：返回的笔记不完整

**症状**：某些高亮或笔记没有返回

**可能原因**：
- 页面加载超时
- Amazon 的 DOM 结构变化

**解决方案**：
1. 重新尝试获取
2. 检查网络连接
3. 如果问题持续，报告 issue

---

### 网络问题

#### 问题：无法连接到 Amazon

**症状**：
```
Error: net::ERR_CONNECTION_REFUSED
Error: net::ERR_TIMED_OUT
```

**解决方案**：

1. **检查网络连接**：
   ```bash
   ping read.amazon.com
   ```

2. **检查防火墙设置**：
   - 确保允许 Chromium 访问网络

3. **使用代理**（如果在需要代理的地区）：
   编辑 `src/browser.ts`，添加代理配置：
   ```typescript
   this.context = await chromium.launchPersistentContext(
     this.config.userDataDir,
     {
       headless: this.config.headless,
       proxy: { server: 'http://proxy.example.com:8080' },
     }
   );
   ```

4. **检查 DNS 解析**：
   ```bash
   nslookup read.amazon.com
   ```

---

#### 问题：页面加载超时

**症状**：
```
Error: Timeout 30000ms exceeded
```

**原因**：网络慢或 Amazon 响应慢

**解决方案**：

1. 等待片刻后重试
2. 检查网络速度
3. 如果使用代理，检查代理是否正常
4. 可以尝试切换到更快的网络

---

### 构建问题

#### 问题：TypeScript 编译错误

**症状**：
```
npm run build
error TS2307: Cannot find module ...
```

**解决方案**：
```bash
# 1. 清理并重新安装依赖
rm -rf node_modules package-lock.json
npm install

# 2. 清理编译输出
rm -rf dist/

# 3. 重新编译
npm run build
```

---

#### 问题：Playwright 未安装

**症状**：
```
Error: Executable doesn't exist at ...
```

**解决方案**：
```bash
npx playwright install chromium
```

---

### 测试问题

#### 问题：单元测试失败

**症状**：`npm run test:unit` 有测试失败

**解决方案**：
```bash
# 1. 清理并重新安装
rm -rf node_modules package-lock.json
npm install

# 2. 重新编译
npm run build

# 3. 重新运行测试
npm run test:unit
```

---

#### 问题：区域配置测试失败

**症状**：`npm run test:region` 有测试失败

**可能原因**：
- 编译输出不是最新
- 端口冲突

**解决方案**：
```bash
# 1. 确保已编译
npm run build

# 2. 等待几秒后重试
sleep 3
npm run test:region
```

---

## 日志调试

### 启用详细日志

```bash
# 重定向 stderr 到文件
node dist/index.js 2> debug.log

# 同时显示和保存
node dist/index.js 2>&1 | tee debug.log
```

### 查看日志内容

```bash
# 查看配置日志
cat debug.log | grep "Region configuration"

# 查看错误日志
cat debug.log | grep -i error

# 查看完整日志
cat debug.log
```

---

## 获取帮助

### 报告问题

如果以上方案都无法解决您的问题，请收集以下信息后报告 issue：

1. **系统信息**：
   ```bash
   node --version
   npm --version
   uname -a  # Linux/macOS
   systeminfo  # Windows
   ```

2. **错误日志**：
   ```bash
   node dist/index.js 2>&1 | tee error.log
   ```

3. **配置信息**：
   ```bash
   echo "Region: $KINDLE_REGION"
   cat kindle-region.config.json 2>/dev/null || echo "No config file"
   ```

4. **复现步骤**：详细描述如何触发问题

### 社区支持

- GitHub Issues: [项目地址]/issues
- 文档: `docs/` 目录

---

## 相关文档

- [安装指南](INSTALLATION.md)
- [配置详解](CONFIGURATION.md)
- [MCP 工具参考](MCP-TOOLS.md)
