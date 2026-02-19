# MCP 工具参考

## 概述

Kindle MCP Server 提供三个主要工具，用于与 Kindle Notebook 进行交互。

## 可用工具

### 1. login - 登录 Amazon

启动交互式浏览器会话，用于 Amazon 身份验证。

#### 用途

- 首次登录 Amazon
- 会话过期后重新登录
- 切换到不同的 Amazon 区域

#### 输入参数

```typescript
{
  region?: string;  // 可选，Amazon 区域代码
}
```

**参数说明**：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `region` | string | 否 | Amazon 区域代码，默认使用服务器配置的区域 |

**有效区域**：`com`, `co.jp`, `co.uk`, `de`, `fr`, `es`, `it`, `ca`, `com.au`, `in`, `com.mx`

#### 输出结果

```typescript
{
  success: boolean;
  status: 'browser_opened' | 'login_detected' | 'failed';
  message: string;
  region: string;
}
```

**状态说明**：

| 状态 | 说明 |
|------|------|
| `browser_opened` | 浏览器已打开，等待用户手动登录 |
| `login_detected` | 检测到已登录状态 |
| `failed` | 登录失败 |

#### 使用示例

```
用户：我需要重新登录 Amazon 日本账户
Claude：[调用 login 工具，参数: { region: "co.jp" }]
```

```
用户：显示登录界面
Claude：[调用 login 工具]
```

#### 注意事项

- 浏览器将以**非无头模式**打开
- 您需要**手动点击登录按钮**，然后输入凭证
- 如果启用 2FA，需要输入验证码
- 登录成功后可以关闭浏览器，会话会被保存

---

### 2. get_book_list - 获取书籍列表

获取 Kindle Notebook 中所有有高亮或笔记的书籍列表。

#### 用途

- 查看所有可获取笔记的书籍
- 获取书籍的 ASIN（用于 fetch_notes）
- 浏览您的 Kindle 阅读历史

#### 输入参数

```typescript
{}  // 无需参数
```

#### 输出结果

成功时：
```json
[
  {
    "asin": "B08XXXXX",
    "title": "书籍标题",
    "author": "作者名"
  },
  ...
]
```

失败时：
```json
{
  "error": "SESSION_EXPIRED",
  "message": "Your Amazon session has expired.",
  "region": "com",
  "actionRequired": "Please use the \"login\" MCP tool to re-authenticate."
}
```

#### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `asin` | string | Amazon 标准识别号，用于获取特定书籍的笔记 |
| `title` | string | 书籍标题 |
| `author` | string | 作者姓名 |

#### 使用示例

```
用户：我的 Kindle 里有哪些书？
Claude：[调用 get_book_list 工具]
     找到了以下书籍：
     1. 《三体》- 刘慈欣
     2. 《人类简史》- 尤瓦尔·赫拉利
     ...
```

```
用户：帮我获取书籍列表
Claude：[调用 get_book_list 工具]
     共找到 15 本书籍。您想获取哪本书的笔记？
```

#### 注意事项

- 只返回**有高亮或笔记**的书籍
- 如果会话过期，服务器会**自动尝试刷新会话**（访问 Amazon 首页后重试）
- 如果自动刷新失败，会返回 SESSION_EXPIRED 错误
- 需要先用 `login` 工具登录

---

### 3. fetch_notes - 获取笔记

获取指定书籍的高亮和笔记内容。

#### 用途

- 获取某本书的所有高亮
- 获取某本书的所有笔记
- 导出阅读笔记用于复习或整理

#### 输入参数

```typescript
{
  asin: string;  // 必需，书籍的 ASIN
}
```

**参数说明**：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `asin` | string | 是 | 从 `get_book_list` 获取的书籍 ASIN |

#### 输出结果

成功时：
```json
{
  "title": "书籍标题",
  "author": "作者名",
  "highlights": [
    {
      "text": "高亮的文本内容",
      "note": "用户添加的笔记（可能为 null）",
      "color": "yellow",
      "location": "位置 123"
    },
    ...
  ]
}
```

失败时：
```json
{
  "error": "SESSION_EXPIRED",
  "message": "Your Amazon session has expired.",
  "region": "com",
  "actionRequired": "Please use the \"login\" MCP tool to re-authenticate."
}
```

#### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | string | 书籍标题 |
| `author` | string | 作者姓名 |
| `highlights` | array | 高亮/笔记数组 |
| `highlights[].text` | string | 高亮的文本内容 |
| `highlights[].note` | string\|null | 用户添加的笔记，如果没有则为 null |
| `highlights[].color` | string | 高亮颜色 |
| `highlights[].location` | string | 位置信息 |

#### 高亮颜色

| 颜色值 | 颜色 |
|--------|------|
| `yellow` | 黄色 |
| `blue` | 蓝色 |
| `pink` | 粉色 |
| `orange` | 橙色 |
| `purple` | 紫色 |

#### 使用示例

```
用户：获取《三体》的笔记
Claude：[先调用 get_book_list 查找 ASIN]
     [再调用 fetch_notes，参数: { asin: "B08XXXXX" }]

     《三体》- 刘慈欣

     高亮和笔记：

     1. "物理学规律在时间和空间上是均匀的..."
       位置：第 45 页
       颜色：黄色
       笔记：这是宇宙学的核心假设

     2. "不要回答！不要回答！不要回答！"
       位置：第 123 页
       颜色：红色
       笔记：三体人的警告
```

```
用户：帮我总结这本书的重点
Claude：[调用 fetch_notes 获取所有内容]
     根据您的笔记，这本书的主要观点包括：
     1. ...
     2. ...
```

#### 注意事项

- ASIN 必须从 `get_book_list` 获取
- 如果会话过期，服务器会**自动尝试刷新会话**（访问 Amazon 首页后重试）
- 如果自动刷新失败，会返回 SESSION_EXPIRED 错误
- 大量笔记可能需要一些时间加载

---

## 工作流程

### 典型使用流程

```
┌─────────────────────────────────────────────────────────────┐
│                    典型使用流程                              │
└─────────────────────────────────────────────────────────────┘

首次使用：
  1. 调用 login 工具 → 完成 Amazon 登录

日常使用：
  2. 调用 get_book_list 工具 → 获取书籍列表
  3. 选择书籍 ASIN
  4. 调用 fetch_notes 工具 → 获取笔记内容

会话过期（自动处理）：
  5. 服务器自动尝试刷新会话
  6. 如果刷新成功，自动重试操作
  7. 如果刷新失败，返回 SESSION_EXPIRED 错误
  8. 用户手动调用 login 工具重新登录
```

### Claude 中的使用示例

```
你：我在读《人类简史》，帮我回顾一下我的笔记

Claude：让我先获取您的书籍列表，找到这本书...
      [调用 get_book_list]

      找到了《人类简史》，现在获取您的笔记...
      [调用 fetch_notes, asin: "XXX"]

      根据您的笔记，您在《人类简史》中重点关注了：
      1. 认知革命 - 您标记了关于语言和虚构...
      2. 农业革命 - 您认为这是"最大的骗局"...
      3. ...（继续总结）
```

```
你：把《三体》里有我笔记的部分整理出来

Claude：[调用 fetch_notes]

      您在《三体》中添加了 12 条笔记：

      === 第 1 章 ===
      "那几年的生活..."
      您的笔记：开篇氛围描写

      === 第 5 章 ===
      ...
```

## 错误处理

### SESSION_EXPIRED 错误

```json
{
  "error": "SESSION_EXPIRED",
  "message": "Your Amazon session has expired.",
  "region": "com",
  "actionRequired": "Please use the \"login\" MCP tool to re-authenticate."
}
```

**解决方案**：调用 `login` 工具重新登录

### ASIN_NOT_FOUND 错误

```json
{
  "error": "ASIN not found",
  "message": "The specified book ASIN could not be found."
}
```

**解决方案**：
1. 调用 `get_book_list` 获取最新的书籍列表
2. 使用正确的 ASIN

### INVALID_ASIN 错误

```json
{
  "error": "Invalid ASIN",
  "message": "ASIN parameter is required. Use get_book_list first."
}
```

**解决方案**：提供有效的 ASIN 参数

## 性能考虑

| 操作 | 预计耗时 | 说明 |
|------|----------|------|
| `login` | 30-60秒 | 需要用户手动操作 |
| `get_book_list` | 5-15秒 | 取决于书籍数量（会话过期时自动重试会额外耗时） |
| `fetch_notes` | 3-10秒 | 取决于高亮数量（会话过期时自动重试会额外耗时） |

## 最佳实践

1. **自动会话刷新**：服务器会在会话过期时自动尝试刷新（通过访问 Amazon 首页）
2. **定期检查会话**：如果长时间未使用，先尝试获取书籍列表验证会话
3. **批量处理**：如果要获取多本书的笔记，逐个调用 fetch_notes
4. **错误处理**：始终检查返回结果中的错误字段
5. **ASIN 缓存**：可以缓存 ASIN 以避免频繁调用 get_book_list

## 相关文档

- [安装指南](INSTALLATION.md)
- [配置详解](CONFIGURATION.md)
- [故障排除](TROUBLESHOOTING.md)
