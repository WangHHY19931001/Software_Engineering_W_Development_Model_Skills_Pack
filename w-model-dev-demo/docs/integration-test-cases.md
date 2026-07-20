# 测试用例文档

> 阶段 3 设计、阶段 6 执行。集成测试用例。

## 文档信息

- 项目名称：博客系统（blog-system-demo）
- 测试类型：集成测试
- 设计来源阶段：阶段 3（概要设计）
- 执行阶段：阶段 6（集成测试）
- 文档版本：v1.0

## 用例列表

### IT-001

- 标题：JWT 在 M-001 与 M-002 之间正确传递
- 优先级：高
- 关联模块交互：M-001 ↔ M-002
- 测试场景：注册→登录获取 JWT→用 JWT 创建文章，验证 token 在跨模块调用中传递 userId

**前置条件**
- 服务已启动，存储已清空

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/auth/register | `{username, password}` | 201 + userId |
| 2 | POST /api/auth/login | 同上 | 200 + token |
| 3 | 解码 JWT | base64 decode payload | payload.userId === 步骤 1 返回的 userId |
| 4 | POST /api/articles | Bearer token + body | 201 + articleId |
| 5 | GET /api/articles/:id | — | 200 + article.authorId === userId |

**预期结果**
JWT payload 中的 userId 与创建出的文章 authorId 完全一致。

**执行状态**
- [x] 待执行

---

### IT-002

- 标题：文章 CRUD 全流程
- 优先级：高
- 关联模块交互：M-002 内部
- 测试场景：在一个测试用例内串联 create→findById→list→update→remove→findById(404)

**前置条件**
- 用户已注册并持有 JWT

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/articles | Bearer + `{title:"T1",content:"C1"}` | 201 + articleId |
| 2 | GET /api/articles/:id | — | 200 + 完整文章 |
| 3 | GET /api/articles | — | 200 + 数组长度 ≥ 1 |
| 4 | PUT /api/articles/:id | Bearer + `{title:"T1-updated"}` | 200 + title 更新 |
| 5 | DELETE /api/articles/:id | Bearer | 204 |
| 6 | GET /api/articles/:id | — | 404 |

**预期结果**
CRUD 串联无断层，删除后查询返回 404。

**执行状态**
- [x] 待执行

---

### IT-003

- 标题：评论创建依赖文章存在校验
- 优先级：高
- 关联模块交互：M-002 ↔ M-003
- 测试场景：CommentService.create 内部调用 ArticleService.findById 验证跨服务依赖

**前置条件**
- 用户 alice 持 JWT

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/articles/non-existent/comments | Bearer + `{content:"Hi"}` | 404 |
| 2 | POST /api/articles (alice) | Bearer + body | 201 + articleId=A1 |
| 3 | POST /api/articles/A1/comments (alice) | Bearer + `{content:"Nice"}` | 201 + commentId |

**预期结果**
对不存在文章评论返回 404；对存在文章评论返回 201。

**执行状态**
- [x] 待执行

---

### IT-004

- 标题：作者隔离跨用户验证
- 优先级：高
- 关联模块交互：M-001 ↔ M-002
- 测试场景：alice 创建文章，bob 用自己的 JWT 尝试 PUT/DELETE 该文章

**前置条件**
- alice、bob 均注册并各自登录

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/articles (alice) | Bearer alice | 201 + A1 |
| 2 | PUT /api/articles/A1 (bob) | Bearer bob + `{title:"Hacked"}` | 403 |
| 3 | DELETE /api/articles/A1 (bob) | Bearer bob | 403 |
| 4 | GET /api/articles/A1 | — | 200 + 标题仍为原值 |

**预期结果**
bob 的所有写操作被 403 拒绝，文章未被篡改。

**执行状态**
- [x] 待执行

---

### IT-005

- 标题：错误处理中间件统一捕获 AppError
- 优先级：中
- 关联模块交互：M-004 ↔ 全部
- 测试场景：触发各类 AppError，验证响应格式与状态码一致

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/articles（无 token） | 无 Authorization | 401 + `{error}` |
| 2 | PUT /api/articles/A1 (bob) | Bearer bob | 403 + `{error}` |
| 3 | GET /api/articles/non-existent | — | 404 + `{error}` |
| 4 | POST /api/auth/register (重复) | 已存在 username | 409 + `{error}` |
| 5 | POST /api/articles (title 缺失) | Bearer + `{content:"x"}` | 400 + `{error}` |

**预期结果**
所有错误响应体格式一致（`{error: string}`），状态码正确。

**执行状态**
- [x] 待执行

---

### IT-006

- 标题：删除文章后评论不可再创建
- 优先级：中
- 关联模块交互：M-002 ↔ M-003
- 测试场景：验证删除文章后 CommentService 仍能正确判定文章不存在

**前置条件**
- 文章 A1 存在；用户 alice 持 JWT

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | DELETE /api/articles/A1 (alice) | Bearer alice | 204 |
| 2 | POST /api/articles/A1/comments (alice) | Bearer + `{content:"Hi"}` | 404 |

**预期结果**
评论创建被拒，不存在孤儿评论。

**执行状态**
- [x] 待执行

---

## 用例汇总

| 用例 ID | 标题 | 优先级 | 关联 | 状态 |
|---|---|---|---|---|
| IT-001 | JWT 跨模块传递 | 高 | M-001↔M-002 | 待执行 |
| IT-002 | 文章 CRUD 全流程 | 高 | M-002 | 待执行 |
| IT-003 | 评论依赖文章存在校验 | 高 | M-002↔M-003 | 待执行 |
| IT-004 | 作者隔离跨用户 | 高 | M-001↔M-002 | 待执行 |
| IT-005 | 错误中间件统一捕获 | 中 | M-004↔全部 | 待执行 |
| IT-006 | 删除后评论不可创建 | 中 | M-002↔M-003 | 待执行 |

## 测试用例覆盖说明

- 模块交互覆盖：所有 6 对模块交互（M-001↔M-002 / M-002↔M-003 / M-002 内部 / M-004↔全部）均有用例
- 跨服务依赖覆盖：IT-003 / IT-006 验证 CommentService→ArticleService 跨模块调用
- 错误路径覆盖：401 / 403 / 404 / 409 / 400 全部覆盖
