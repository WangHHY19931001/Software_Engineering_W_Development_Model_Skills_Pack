# 集成测试用例文档

> 阶段 6（集成测试执行）产出。
> 设计来源：`docs/outline-design.md` §4 集成测试用例设计（IT-001 ~ IT-006）。
> 执行入口：`npm run test:integration` → `tests/integration/integration.test.ts`。

## 文档信息

- 项目名称：blog-system-demo
- 文档版本：v1.0
- 编制日期：2026-07-21
- 编制者：W-Model Agent（阶段 6）
- 关联设计文档：`docs/outline-design.md` §4
- 测试运行器：vitest 1.6 + supertest 7.2
- 被测入口：`src/app.ts` 单例 `app`（真实 Express 实例，不 mock 控制器 / 服务 / 存储）

## 1. 用例总览

| 用例 ID | 关联接口 | 场景 | 优先级 | 模块覆盖 |
|---|---|---|---|---|
| IT-001 | 接口 1（POST /api/v1/auth/register） | 合法参数注册成功 + 重复注册 40901 | 高 | routes/auth + AuthController + UserService + PasswordUtils + UserStore |
| IT-002 | 接口 1 | 5 类非法参数（用户名过短 / 密码 < 8 / 无数字 / 无字母 / 缺字段）全部 400 | 高 | middleware/validate + schemas/auth + ErrorHandler |
| IT-003 | 接口 2 + 3（/auth/login + /articles） | 登录后跨模块创建文章，JWT 认证传递 + authorId 注入 | 高 | routes/auth + routes/article + AuthMiddleware + ArticleService + ArticleStore |
| IT-004 | 接口 3 + 8 + 6（/articles + /comments + GET 详情） | 文章 → 评论 → 详情聚合数据传递 + 评论顺序 | 高 | ArticleService + CommentService + ArticleStore + CommentStore |
| IT-005 | 接口 8 | 文章不存在异常路径发表评论 → 404 + 进程未崩溃 | 高 | CommentService + ArticleService + ErrorHandler（异常链路） |
| IT-006 | 接口 5 + 6 + 9 | 删除文章后查询返回 404 + 评论级联删除 | 高 | ArticleService.delete + CommentStore（级联清理） |

## 2. 用例详细规格

### IT-001：合法参数注册成功 + 重复注册 40901

| 项 | 内容 |
|---|---|
| 关联接口 | 接口 1 POST /api/v1/auth/register |
| 场景 | 合法参数注册成功 + 重复注册返回 40901 |
| 输入 | 1) `POST /api/v1/auth/register` body `{"username":"alice","password":"Passw0rd!"}`<br>2) 重复同 body |
| 预期输出 | 第 1 次：HTTP 201；`res.body.userId` 匹配 UUID v4；`res.body.username === "alice"`；响应不含 password / passwordHash<br>第 2 次：HTTP 409 + `code === 40901`<br>存储校验：`userStore.findByUsername("alice").passwordHash` 以 `$2b$10$` 开头 |
| 优先级 | 高 |
| 模块覆盖 | routes/auth + AuthController + UserService + PasswordUtils + UserStore |
| 实现位置 | tests/integration/integration.test.ts → describe('IT-001') |

### IT-002：5 类非法参数全部 400 + 不写入存储

| 项 | 内容 |
|---|---|
| 关联接口 | 接口 1 POST /api/v1/auth/register |
| 场景 | 5 类非法参数（用户名过短 / 密码 < 8 / 无数字 / 无字母 / 缺字段） |
| 输入 | 1) `{"username":"ab","password":"Passw0rd!"}`（用户名过短）<br>2) `{"username":"bob","password":"Ab1"}`（密码 < 8）<br>3) `{"username":"bob","password":"Password"}`（无数字）<br>4) `{"username":"bob","password":"12345678"}`（无字母）<br>5) `{"username":"bob"}`（缺 password） |
| 预期输出 | 全部返回 HTTP 400 + `code === 40001`<br>5 类非法输入全部跑完后 `userStore.findByUsername("bob")` 为 undefined（不写入存储） |
| 优先级 | 高 |
| 模块覆盖 | middleware/validate + schemas/auth + ErrorHandler |
| 实现位置 | tests/integration/integration.test.ts → describe('IT-002') |
| 设计-实现偏差说明 | outline-design §4.1 原设计 2-4 项密码复杂度失败预期 40002，但 `src/middleware/validate.ts` 注释已声明「本 demo 统一使用 40001 简化错误码映射」，故实际断言为 40001。该偏差在阶段 5 编码时已固化并记录于源码注释，不影响四级测试覆盖完整性。 |

### IT-003：登录后跨模块创建文章（认证传递）

| 项 | 内容 |
|---|---|
| 关联接口 | 接口 2 POST /api/v1/auth/login + 接口 3 POST /api/v1/articles |
| 场景 | 登录获取 token → 解码 payload → 创建文章，authorId 来自 JWT 而非 body |
| 输入 | 1) 注册 alice<br>2) `POST /api/v1/auth/login` body `{"username":"alice","password":"Passw0rd!"}`<br>3) `jwt.decode(token)` 校验 payload<br>4) `POST /api/v1/articles` Header `Authorization: Bearer <token>` body `{"title":"T1","content":"C1"}` |
| 预期输出 | 登录返回 200 + token；payload.userId 与注册返回一致；创建文章返回 201；`res.body.authorId === payload.userId`；`articleStore.findById(articleId).authorId` 一致 |
| 优先级 | 高 |
| 模块覆盖 | routes/auth + routes/article + AuthMiddleware + ArticleService + ArticleStore |
| 实现位置 | tests/integration/integration.test.ts → describe('IT-003') |

### IT-004：文章 → 评论 → 详情聚合数据传递

| 项 | 内容 |
|---|---|
| 关联接口 | 接口 3 + 接口 8 + 接口 6 |
| 场景 | alice 创建文章 → 发表 2 条评论 → GET 详情聚合 comments 数组 |
| 输入 | 1) alice 注册 + 登录<br>2) `POST /api/v1/articles` 创建文章<br>3) `POST /api/v1/articles/:id/comments` body `{"content":"First!"}`<br>4) `POST /api/v1/articles/:id/comments` body `{"content":"Second!"}`<br>5) `GET /api/v1/articles/:id` |
| 预期输出 | 步骤 2-4 返回 201；步骤 5 返回 200；`res.body.comments.length === 2`；评论按 createdAt 升序：First → Second；`comments[0].authorId === alice.userId` |
| 优先级 | 高 |
| 模块覆盖 | ArticleService + CommentService + ArticleStore + CommentStore |
| 实现位置 | tests/integration/integration.test.ts → describe('IT-004') |

### IT-005：文章不存在异常路径 - 发表评论

| 项 | 内容 |
|---|---|
| 关联接口 | 接口 8 POST /api/v1/articles/:id/comments |
| 场景 | 对不存在文章 UUID 发表评论 → 404 + 进程未崩溃 |
| 输入 | alice 登录后 `POST /api/v1/articles/00000000-0000-4000-8000-000000000000/comments` Bearer + `{"content":"Hi"}` |
| 预期输出 | HTTP 404 + `code === 40401`；`commentStore.findByArticleId(...)` 为 `[]`；`unhandledRejection` / `uncaughtException` 计数 = 0（异常经 errorHandler 链路捕获） |
| 优先级 | 高 |
| 模块覆盖 | CommentService + ArticleService + ErrorHandler（异常链路） |
| 实现位置 | tests/integration/integration.test.ts → describe('IT-005') |

### IT-006：删除文章后查询返回 404 + 评论级联删除

| 项 | 内容 |
|---|---|
| 关联接口 | 接口 5 DELETE /api/v1/articles/:id + 接口 6 GET 详情 + 接口 9 GET 评论列表 |
| 场景 | 文章存在且下有 2 条评论 → 删除文章 → 后续 GET 详情 / GET 评论列表均返回 404 |
| 输入 | 1) alice 注册 + 登录 + 创建文章 X<br>2) 加 2 条评论<br>3) `DELETE /api/v1/articles/:X`<br>4) `GET /api/v1/articles/:X`<br>5) `GET /api/v1/articles/:X/comments` |
| 预期输出 | DELETE 返回 204；GET 详情返回 404 + 40401；GET 评论列表返回 404 + 40401；`articleStore.findById(X)` 为 undefined；`commentStore.findByArticleId(X)` 为 `[]`（评论随文章级联删除） |
| 优先级 | 高 |
| 模块覆盖 | ArticleService.delete + CommentStore（级联清理） |
| 实现位置 | tests/integration/integration.test.ts → describe('IT-006') |

## 3. 覆盖说明

### 3.1 强制场景覆盖（TC-DES-010 / 011 / 012）

| 场景类型 | 覆盖用例 | 说明 |
|---|---|---|
| TC-DES-010 参数校验 | IT-001 合法 + IT-002 非法 5 类 | 格式 / 长度 / 复杂度 / 缺失全命中 |
| TC-DES-011 跨模块调用 | IT-003（auth→article 认证传递）+ IT-004（article→comment→article 详情聚合） | 真实模块链路，不 mock |
| TC-DES-012 异常路径 | IT-005（文章不存在发表评论 → 40401）+ IT-006（删除后查询 → 40401） | 含进程未崩溃断言 |

### 3.2 数据传递正确性

- IT-003 authorId 注入（JWT → article.authorId，非 body）
- IT-004 评论聚合 + 评论顺序（升序）+ authorId 注入
- IT-006 级联删除（文章删除后评论同步清理）

### 3.3 总计

- 设计 IT 用例数：6 条（IT-001 ~ IT-006）
- 实际 it() 测试数：12 条（IT-001 拆 2 + IT-002 拆 6 + IT-003/004/005/006 各 1）
- 全部为高优先级用例

## 4. 测试环境与隔离

| 项 | 内容 |
|---|---|
| 被测 app | `import { app, deps } from '../../src/app.js'`（单例） |
| 状态重置 | `beforeEach` 调 `POST /__test/reset` 清空 3 个内存 Store |
| 存储断言 | 通过 `deps.userStore` / `deps.articleStore` / `deps.commentStore` 直接读取，验证 passwordHash 前缀 / 级联删除 / 不写入存储 |
| JWT 密钥 | `cross-env JWT_SECRET=test-secret-blog-demo`（package.json 脚本注入，RISK-008） |
| 异常监听 | IT-005 通过 `process.on('unhandledRejection' / 'uncaughtException')` 计数器验证进程未崩溃 |
