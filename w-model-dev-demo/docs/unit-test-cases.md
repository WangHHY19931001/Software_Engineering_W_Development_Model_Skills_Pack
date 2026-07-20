# 测试用例文档

> 阶段 4 设计、阶段 5 执行。单元测试用例。

## 文档信息

- 项目名称：博客系统（blog-system-demo）
- 测试类型：单元测试
- 设计来源阶段：阶段 4（详细设计）
- 执行阶段：阶段 5（编码）
- 文档版本：v1.0

## 用例列表

> 为节省篇幅，每个用例只列关键步骤；详细断言见测试代码。所有用例前置条件：每个用例独立运行，使用 `beforeEach` 清空 store。

### UT-001 ~ UT-007 · UserService

| 用例 ID | 场景 | 操作 | 预期 | 优先级 |
|---|---|---|---|---|
| UT-001 | 注册成功 | `userService.register({username:"alice",password:"Passw0rd!"})` | 返回 `{userId}`；UserStore 中 alice 的 passwordHash ≠ "Passw0rd!" | 高 |
| UT-002 | 重复用户名 | 先注册 alice，再注册 alice | 抛 `ConflictError` (409) | 高 |
| UT-003 | 登录成功 | 注册后 `userService.login({username:"alice",password:"Passw0rd!"})` | 返回 `{token}`，jwt.decode 后 userId 一致 | 高 |
| UT-004 | 错误密码 | `userService.login({username:"alice",password:"wrong"})` | 抛 `UnauthorizedError` (401) | 高 |
| UT-005 | 用户不存在 | `userService.login({username:"bob",password:"x"})` | 抛 `UnauthorizedError` (401) | 高 |
| UT-006 | verifyToken 合法 | login 拿 token → verifyToken | 返回 `{userId}` | 高 |
| UT-007 | verifyToken 非法 | `userService.verifyToken("garbage")` | 返回 `null` | 高 |

### UT-008 ~ UT-013 · ArticleService

| 用例 ID | 场景 | 操作 | 预期 | 优先级 |
|---|---|---|---|---|
| UT-008 | 创建成功 | `articleService.create({title:"T",content:"C"}, "u1")` | 返回 `{articleId}`；list() 长度 +1 | 高 |
| UT-009 | 作者更新成功 | 创建后用同一 userId 调 update | 返回更新后 article，title 已变 | 高 |
| UT-010 | 非作者更新 | userId="u2" 调 update | 抛 `ForbiddenError` (403) | 高 |
| UT-011 | 不存在文章 | update("non-existent", ..., "u1") | 抛 `NotFoundError` (404) | 高 |
| UT-012 | 作者删除成功 | 创建后用同一 userId 调 remove | 无返回；list() 长度 -1 | 高 |
| UT-013 | 非作者删除 | userId="u2" 调 remove | 抛 `ForbiddenError` (403) | 高 |

### UT-014 ~ UT-016 · CommentService

| 用例 ID | 场景 | 操作 | 预期 | 优先级 |
|---|---|---|---|---|
| UT-014 | 评论创建成功 | 先创建文章 A1，再 `commentService.create("A1", {content:"Hi"}, "u1")` | 返回 `{commentId}` | 高 |
| UT-015 | 文章不存在 | `commentService.create("non-existent", {content:"Hi"}, "u1")` | 抛 `NotFoundError` (404) | 高 |
| UT-016 | listByArticle 返回指定文章评论 | 对 A1 创建 2 条评论，对 A2 创建 1 条 | `listByArticle("A1")` 长度 = 2 | 中 |

### UT-017 ~ UT-019 · authMiddleware

| 用例 ID | 场景 | 操作 | 预期 | 优先级 |
|---|---|---|---|---|
| UT-017 | 合法 Bearer 通过 | 构造 Request 含 `Authorization: Bearer <valid>` | next 被调用；req.userId 已注入 | 高 |
| UT-018 | 无 Authorization | 构造 Request 不含 header | next 被调用且参数为 UnauthorizedError | 高 |
| UT-019 | 过期 token | 构造 exp=now-1s 的 JWT | next 被调用且参数为 UnauthorizedError | 高 |

### UT-020 ~ UT-022 · errorHandler

| 用例 ID | 场景 | 操作 | 预期 | 优先级 |
|---|---|---|---|---|
| UT-020 | AppError 转换 | 传入 `new ForbiddenError()` | res.status=403, body={error:"Forbidden"} | 中 |
| UT-021 | ZodError 转换 | 传入 zod 校验失败错误 | res.status=400, body 含字段路径 | 中 |
| UT-022 | 未知错误 | 传入 `new Error("boom")` | res.status=500, body={error:"Internal Server Error"} | 中 |

## 用例汇总

| 用例 ID | 模块 | 优先级 | 状态 |
|---|---|---|---|
| UT-001~007 | UserService (7) | 高 | 待执行 |
| UT-008~013 | ArticleService (6) | 高 | 待执行 |
| UT-014~016 | CommentService (3) | 高/中 | 待执行 |
| UT-017~019 | authMiddleware (3) | 高 | 待执行 |
| UT-020~022 | errorHandler (3) | 中 | 待执行 |
| **合计** | **22 个单元测试** | | **待执行** |

## 测试用例覆盖说明

- 方法覆盖：UserService(3/3) + ArticleService(4/4) + CommentService(2/2) + authMiddleware(1) + errorHandler(1) 全覆盖
- 异常路径覆盖：ConflictError / UnauthorizedError / ForbiddenError / NotFoundError / ValidationError / 500 全覆盖
- 关键业务约束覆盖：密码哈希、作者隔离、文章存在校验、JWT 过期 全覆盖
- 预估覆盖率：22 个用例覆盖核心业务逻辑，预计行覆盖率 ≥ 85%（满足 NFR-004 ≥ 80% 要求）
