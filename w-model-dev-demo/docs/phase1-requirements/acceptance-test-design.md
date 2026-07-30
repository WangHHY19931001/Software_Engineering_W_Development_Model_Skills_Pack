# 验收测试设计（Acceptance Test Design）

> 阶段 1（需求分析）同步产出。W 模型第 23 轮（2026-07-30）端到端调测。
>
> **本阶段产出验收测试用例设计，阶段 8（验收测试）执行**。
> 每个 REQ/NFR/CON 至少 1 条可验证验收场景；不依赖具体代码路径（path-placeholder 由 `docs/uat-path-mapping.md` 维护）。
> 覆盖正常 / 异常 / 边界 / NFR / CON 五类场景。
>
> UAT 模板（与 `w-model-dev/templates/test-case.md` 对齐）：

```
UAT-NNN  <测试场景>        <REQ-XXX>
  角色:    <actor>
  前置:    <认证状态> + <数据依赖> + <接口路径>
  输入:    <HTTP method + path + headers + body>
  步骤:    <step 1; step 2; ...>
  预期:    <status code + JSON 字段断言 + 副作用断言>
  验收:    <可量化阈值（数字/状态码/字段值）>
  优先级:  <高/中/低>
  场景类型:<正常/异常/边界/NFR/CON>
```

## 0. 设计原则与全局约定

### 0.1 前置条件分析（强制）

> 第 22 轮 P1-3 新增。每条 UAT 须明确：

| 前置条件类型 | 要求 | 示例 |
|---|---|---|
| 认证状态 | 明确标注是否需认证 + 角色 | 需 admin token / 需 reader token / 需 blogger token / 无需认证 |
| 数据依赖 | 明确标注依赖的测试数据 | 需预创建用户/博文/标签；需在 beforeEach 中 resetAllRepositories() |
| 接口路径 | 明确标注 API 路径 + HTTP 方法 | POST /api/users |

### 0.2 demo 范围声明

本批次为后端 demo（无前端），UAT 通过 HTTP API 直接验证。所有 UAT 在 `tests/acceptance/*.spec.ts` 中通过 supertest 注入 `app` 实例执行（不监听端口）。Out of Scope 项（见 `requirement-spec.md §8`）的 UAT 不在本批次（如邮件发送、OAuth 登录、富文本上传）——本设计已剔除此类 UAT。

### 0.3 测试数据约定

- 唯一识别：每条 UAT 的输入数据使用 `it('UAT-NNN ...')` 描述内嵌的固定 seed 数据（如 `email: 'u1@test.com'`），避免依赖其他 UAT 副作用。
- JWT：`auth-helpers.ts::signTestToken({sub, role})` 生成；HS256 + `JWT_SECRET=test-secret-blog-demo`。
- 限流豁免：所有 UAT 请求头加 `x-test-bypass-rate-limit: true`（NFR-005 约定）。
- 时间：使用 `vi.useFakeTimers()` 控制审计 90 天、广告 startAt/endAt、Token 过期。

### 0.4 N/A 用例规则

如某 UAT 对应需求被 §8 Out of Scope 排除，则 UAT 设计中标注 `N/A — <Out of Scope 引用>`，并注明缺失端点。本批次 32 需求全部在范围内，无 N/A 用例。

---

## 1. REQ-001 用户注册（UAT-001 ~ UAT-004）

### UAT-001 [正常] reader 注册成功
- **关联需求**：REQ-001（user domain, level=1, P0）
- **角色**：匿名访客
- **前置**：无需认证；`resetAllRepositories()`
- **接口路径**：`POST /users`
- **输入**：`{email: 'u1@test.com', username: 'u1', password: 'P@ssw0rd123'}`
- **步骤**：
  1. POST /users with valid body
  2. 检查响应状态码 + body
- **预期**：
  - HTTP 201 Created
  - 响应 `{userId: '<uuid>', email: 'u1@test.com', username: 'u1', role: 'reader', displayName: 'u1', createdAt: '<iso>'}`
  - 数据库 `users` Map 新增 1 条；`passwordHash` 字段存在且 `bcrypt.getRounds(hash) >= 10`（NFR-006）
- **验收**：响应时间 < 500ms；密码不以明文出现；`displayName` 默认等于 `username`
- **优先级**：高
- **场景类型**：正常

### UAT-002 [异常] 重复邮箱注册
- **关联需求**：REQ-001
- **角色**：匿名访客
- **前置**：`resetAllRepositories()`；预创建 `users` 中存在 `email='u1@test.com'`
- **接口路径**：`POST /users`
- **输入**：`{email: 'u1@test.com', username: 'u2', password: 'P@ssw0rd123'}`
- **步骤**：
  1. 预创建 u1
  2. POST /users with same email
- **预期**：
  - HTTP 409 Conflict
  - 响应 `{error: {code: 'EMAIL_ALREADY_EXISTS', message: '邮箱已被注册'}}`
- **验收**：数据库未新增记录；响应时间 < 200ms
- **优先级**：高
- **场景类型**：异常

### UAT-003 [异常] 无效邮箱格式
- **关联需求**：REQ-001
- **角色**：匿名访客
- **前置**：`resetAllRepositories()`
- **接口路径**：`POST /users`
- **输入**：`{email: 'not-an-email', username: 'u1', password: 'P@ssw0rd123'}`
- **步骤**：
  1. POST /users with invalid email
- **预期**：
  - HTTP 400 Bad Request
  - 响应 `{error: {code: 'INVALID_EMAIL', message: '邮箱格式非法', details: {field: 'email'}}}`
- **验收**：数据库未新增；错误信息明确指出 `email` 字段
- **优先级**：高
- **场景类型**：异常

### UAT-004 [边界] 密码长度不足
- **关联需求**：REQ-001 + NFR-006（bcrypt cost 横切）
- **角色**：匿名访客
- **前置**：`resetAllRepositories()`
- **接口路径**：`POST /users`
- **输入**：`{email: 'u1@test.com', username: 'u1', password: 'short'}`
- **步骤**：
  1. POST /users with short password
- **预期**：
  - HTTP 400 Bad Request
  - 响应 `{error: {code: 'PASSWORD_TOO_SHORT', message: '密码至少 8 位', details: {minLength: 8}}}`
- **验收**：数据库未新增；minLength=8 在错误信息中明示
- **优先级**：中
- **场景类型**：边界

---

## 2. REQ-002 用户登录（UAT-005 ~ UAT-008）

### UAT-005 [正常] 正确凭证登录
- **关联需求**：REQ-002
- **角色**：已注册 reader
- **前置**：`resetAllRepositories()`；预创建 user `u1@test.com` / `P@ssw0rd123`
- **接口路径**：`POST /auth/login`
- **输入**：`{email: 'u1@test.com', password: 'P@ssw0rd123'}`
- **步骤**：
  1. POST /auth/login
- **预期**：
  - HTTP 200 OK
  - 响应 `{token: '<jwt>', userId: '<uuid>', role: 'reader', expiresIn: 86400}`
  - JWT 解码后 payload `{sub: '<uuid>', role: 'reader', iat, exp}`；`exp - iat = 86400`（24h TTL）
- **验收**：JWT HS256 签名验证通过；24h 有效期
- **优先级**：高
- **场景类型**：正常

### UAT-006 [异常] 错误密码
- **关联需求**：REQ-002 + NFR-003（不泄露账号存在性）
- **角色**：匿名访客
- **前置**：`resetAllRepositories()`；预创建 user
- **接口路径**：`POST /auth/login`
- **输入**：`{email: 'u1@test.com', password: 'wrong'}`
- **预期**：
  - HTTP 401 Unauthorized
  - 响应 `{error: {code: 'INVALID_CREDENTIALS', message: '邮箱或密码错误'}}`
  - **关键**：错误信息不区分「账号不存在」与「密码错误」
- **验收**：响应时间 ≈ 正确登录的耗时（防止时间侧信道）；bcrypt.compare 触发
- **优先级**：高
- **场景类型**：异常

### UAT-007 [异常] 不存在的邮箱
- **关联需求**：REQ-002 + NFR-003
- **角色**：匿名访客
- **前置**：`resetAllRepositories()`
- **接口路径**：`POST /auth/login`
- **输入**：`{email: 'none@test.com', password: 'whatever'}`
- **预期**：
  - HTTP 401 Unauthorized
  - 响应 `{error: {code: 'INVALID_CREDENTIALS', message: '邮箱或密码错误'}}`（与 UAT-006 完全一致）
- **验收**：响应 body 与 UAT-006 不可区分
- **优先级**：高
- **场景类型**：异常

### UAT-008 [边界] JWT 过期
- **关联需求**：REQ-002
- **角色**：已登录 reader
- **前置**：`resetAllRepositories()`；预创建 user；签发 24h+1s 前的 token（`vi.setSystemTime(now - 24h - 1s)`）
- **接口路径**：`GET /users/me`（任意需 JWT 端点）
- **输入**：`Authorization: Bearer <expired-jwt>`
- **预期**：
  - HTTP 401 Unauthorized
  - 响应 `{error: {code: 'TOKEN_EXPIRED', message: 'token 已过期'}}`
- **验收**：JWT 校验失败原因明确为 expired（而非 invalid signature）
- **优先级**：中
- **场景类型**：边界

---

## 3. REQ-003 用户资料（UAT-009 ~ UAT-011）

### UAT-009 [正常] 查询他人公开资料
- **关联需求**：REQ-003
- **角色**：匿名访客
- **前置**：`resetAllRepositories()`；预创建 user u1（`displayName='Alice'`, `bio='hello'`, `avatarUrl='https://...'`)
- **接口路径**：`GET /users/:id`
- **输入**：无 auth；path = `u1.userId`
- **预期**：
  - HTTP 200 OK
  - 响应 `{userId, username, displayName, bio, avatarUrl, createdAt}`（**不返回 email / passwordHash / role**）
- **验收**：敏感字段过滤
- **优先级**：中
- **场景类型**：正常

### UAT-010 [正常] 修改自己资料
- **关联需求**：REQ-003 + NFR-003（JWT）
- **角色**：已登录 reader
- **前置**：`resetAllRepositories()`；预创建 user；持有有效 JWT
- **接口路径**：`PUT /users/me`
- **输入**：`Authorization: Bearer <jwt>` + body `{displayName: 'NewName', bio: 'new bio', avatarUrl: 'https://new'}`
- **预期**：
  - HTTP 200 OK
  - 响应 `{userId, displayName: 'NewName', bio: 'new bio', avatarUrl: 'https://new', updatedAt}`
  - 数据库 updatedAt 已更新
- **验收**：仅修改允许字段（不允许改 email/username）
- **优先级**：高
- **场景类型**：正常

### UAT-011 [异常] 试图修改邮箱被拒
- **关联需求**：REQ-003
- **角色**：已登录 reader
- **前置**：`resetAllRepositories()`；预创建 user；JWT
- **接口路径**：`PUT /users/me`
- **输入**：`{email: 'new@test.com', displayName: 'NewName'}`
- **预期**：
  - HTTP 400 Bad Request
  - 响应 `{error: {code: 'IMMUTABLE_FIELD', message: '邮箱不可修改', details: {field: 'email'}}}`
- **验收**：email 未被修改
- **优先级**：中
- **场景类型**：异常

---

## 4. REQ-004 关注/取关（UAT-012 ~ UAT-014）

### UAT-012 [正常] 关注博主
- **关联需求**：REQ-004 + REQ-011（关注触发通知）
- **角色**：已登录 reader
- **前置**：`resetAllRepositories()`；预创建 reader u1 + blogger b1
- **接口路径**：`POST /follows/:bloggerId`
- **输入**：`Authorization: Bearer <reader-jwt>` + path = `b1.bloggerId`
- **预期**：
  - HTTP 200 OK
  - 响应 `{bloggerId, followed: true, followedAt: '<iso>'}`
  - 数据库 `follows` Map 新增 1 条
  - 事件总线发出 `follow.created`；b1 收到通知 `notifications` 新增 1 条（type=follow）
- **验收**：幂等（重复调用返回 200 + `followed: true`，数据库无重复）
- **优先级**：中
- **场景类型**：正常

### UAT-013 [异常] 关注不存在的博主
- **关联需求**：REQ-004
- **角色**：已登录 reader
- **前置**：`resetAllRepositories()`；预创建 reader u1
- **接口路径**：`POST /follows/<nonexistent-uuid>`
- **输入**：reader JWT
- **预期**：
  - HTTP 404 Not Found
  - 响应 `{error: {code: 'BLOGGER_NOT_FOUND', message: '博主不存在'}}`
- **验收**：无通知产生
- **优先级**：中
- **场景类型**：异常

### UAT-014 [边界] 关注自己被拒
- **关联需求**：REQ-004
- **角色**：已登录 reader（试图关注作为 blogger 的自己）
- **前置**：`resetAllRepositories()`；预创建 u1 同时也是 blogger b1（同 email）
- **接口路径**：`POST /follows/<self-blogger-id>`
- **输入**：reader JWT（sub=u1.userId）
- **预期**：
  - HTTP 400 Bad Request
  - 响应 `{error: {code: 'CANNOT_FOLLOW_SELF', message: '不能关注自己'}}`
- **验收**：数据库无新增 follow 记录
- **优先级**：低
- **场景类型**：边界

---

## 5. REQ-005 博主注册（UAT-015 ~ UAT-017）

### UAT-015 [正常] 博主注册
- **关联需求**：REQ-005
- **角色**：匿名访客
- **前置**：`resetAllRepositories()`
- **接口路径**：`POST /bloggers`
- **输入**：`{email: 'b1@test.com', username: 'b1', password: 'P@ssw0rd123', displayName: 'Bob'}`
- **预期**：
  - HTTP 201 Created
  - 响应 `{bloggerId: '<uuid>', email, username, displayName: 'Bob', createdAt}`
  - 数据库 `bloggers` Map 新增 1 条；`passwordHash` 存在且 `bcrypt.getRounds >= 10`
- **验收**：与 REQ-001 一致的密码强度校验
- **优先级**：高
- **场景类型**：正常

### UAT-016 [异常] 博主邮箱已被 reader 占用
- **关联需求**：REQ-005 + REQ-001（email 跨域唯一）
- **角色**：匿名访客
- **前置**：`resetAllRepositories()`；预创建 reader u1（email='b1@test.com'）
- **接口路径**：`POST /bloggers`
- **输入**：`{email: 'b1@test.com', username: 'b1', password: 'P@ssw0rd123'}`
- **预期**：
  - HTTP 409 Conflict
  - 响应 `{error: {code: 'EMAIL_ALREADY_EXISTS', message: '邮箱已被注册'}}`
- **验收**：跨域邮箱唯一性
- **优先级**：中
- **场景类型**：异常

### UAT-017 [边界] 用户名长度边界（19 / 21 字符）
- **关联需求**：REQ-005
- **角色**：匿名访客
- **前置**：`resetAllRepositories()`
- **接口路径**：`POST /bloggers`
- **输入 A**：`{email: 'b1@test.com', username: 'a'.repeat(19), password: 'P@ssw0rd123'}` → 期望 201
- **输入 B**：`{email: 'b2@test.com', username: 'a'.repeat(21), password: 'P@ssw0rd123'}` → 期望 400 `USERNAME_TOO_LONG`
- **输入 C**：`{email: 'b3@test.com', username: 'ab', password: 'P@ssw0rd123'}` → 期望 400 `USERNAME_TOO_SHORT`
- **验收**：用户名 3–20 字符边界精确
- **优先级**：低
- **场景类型**：边界

---

## 6. REQ-006 博文 CRUD（UAT-018 ~ UAT-022）

### UAT-018 [正常] 创建草稿
- **关联需求**：REQ-006
- **角色**：已登录 blogger
- **前置**：`resetAllRepositories()`；预创建 blogger b1；blogger JWT
- **接口路径**：`POST /posts`
- **输入**：`{title: 'My First Post', content: 'Hello world content here'}`
- **预期**：
  - HTTP 201 Created
  - 响应 `{postId, authorId: b1.bloggerId, title, content, status: 'draft', tags: [], createdAt, updatedAt, publishedAt: null}`
  - 数据库 `posts` Map 新增 1 条
- **验收**：初始 status=draft；publishedAt=null
- **优先级**：高
- **场景类型**：正常

### UAT-019 [正常] 发布草稿
- **关联需求**：REQ-006
- **角色**：已登录 blogger（owner）
- **前置**：`resetAllRepositories()`；预创建 blogger b1 + 草稿 post p1
- **接口路径**：`POST /posts/:id/publish`
- **输入**：blogger JWT
- **预期**：
  - HTTP 200 OK
  - 响应 `{postId, status: 'published', publishedAt: '<iso>'}`
  - 数据库 status: 'draft' → 'published'；publishedAt 已设置
  - 事件 `post.published` 触发
- **验收**：状态机转移正确；事件可被监听
- **优先级**：高
- **场景类型**：正常

### UAT-020 [异常] 非 owner 编辑博文被拒
- **关联需求**：REQ-006 + NFR-003
- **角色**：已登录 blogger（b2，非 owner b1）
- **前置**：`resetAllRepositories()`；预创建 b1（owner）+ b2（other）；b1 拥有 post p1
- **接口路径**：`PUT /posts/:id`
- **输入**：b2 JWT + `{title: 'Hacked', content: '...'}`
- **预期**：
  - HTTP 403 Forbidden
  - 响应 `{error: {code: 'NOT_POST_OWNER', message: '无权操作此博文'}}`
- **验收**：数据库 title/content 未被修改
- **优先级**：高
- **场景类型**：异常

### UAT-021 [异常] 未认证创建博文
- **关联需求**：REQ-006 + NFR-003
- **角色**：匿名
- **前置**：`resetAllRepositories()`
- **接口路径**：`POST /posts`
- **输入**：无 Authorization
- **预期**：
  - HTTP 401 Unauthorized
  - 响应 `{error: {code: 'AUTH_REQUIRED', message: '需要认证'}}`
- **验收**：未创建记录
- **优先级**：高
- **场景类型**：异常

### UAT-022 [边界] 空内容发布被拒
- **关联需求**：REQ-006
- **角色**：已登录 blogger
- **前置**：`resetAllRepositories()`；b1 + 草稿 p1（content=空字符串）
- **接口路径**：`POST /posts/:id/publish`
- **输入**：blogger JWT
- **预期**：
  - HTTP 400 Bad Request
  - 响应 `{error: {code: 'EMPTY_CONTENT', message: '正文不能为空'}}`
- **验收**：status 仍为 draft
- **优先级**：中
- **场景类型**：边界

---

## 7. REQ-007 博文浏览（UAT-023 ~ UAT-025）

### UAT-023 [正常] 公开列表 + 分页
- **关联需求**：REQ-007 + NFR-001（性能横切读 API）
- **角色**：匿名访客
- **前置**：`resetAllRepositories()`；预创建 50 篇 published 博文
- **接口路径**：`GET /posts?page=1&pageSize=20`
- **输入**：无 auth
- **预期**：
  - HTTP 200 OK
  - 响应 `{items: [20 个 post], page: 1, pageSize: 20, total: 50, totalPages: 3}`
  - items 按 publishedAt DESC 排序
  - 不包含 draft 状态
- **验收**：分页正确；不含 draft；排序正确
- **优先级**：高
- **场景类型**：正常

### UAT-024 [异常] 草稿对读者不可见
- **关联需求**：REQ-007
- **角色**：匿名访客
- **前置**：`resetAllRepositories()`；预创建 1 个 draft post
- **接口路径**：`GET /posts/draft-id`
- **输入**：无 auth
- **预期**：
  - HTTP 404 Not Found
  - 响应 `{error: {code: 'POST_NOT_FOUND', message: '博文不存在或未发布'}}`
- **验收**：draft 不暴露
- **优先级**：高
- **场景类型**：异常

### UAT-025 [边界] pageSize 上限 100
- **关联需求**：REQ-007
- **角色**：匿名访客
- **前置**：`resetAllRepositories()`；预创建 150 篇 published
- **接口路径**：`GET /posts?page=1&pageSize=200`
- **输入**：无 auth
- **预期**：
  - HTTP 200 OK
  - 响应 `{items: [100 个 post], page: 1, pageSize: 100, total: 150, totalPages: 2}`
  - pageSize 被截断为 100（不报错）
- **验收**：pageSize 上限生效；不抛错
- **优先级**：中
- **场景类型**：边界

---

## 8. REQ-008 点赞/收藏（UAT-026 ~ UAT-029）

### UAT-026 [正常] 点赞博文
- **关联需求**：REQ-008 + REQ-011（点赞触发通知）
- **角色**：已登录 reader
- **前置**：`resetAllRepositories()`；reader u1 + blogger b1 + published post p1
- **接口路径**：`POST /posts/:id/like`
- **输入**：reader JWT
- **预期**：
  - HTTP 200 OK
  - 响应 `{postId, liked: true, totalLikes: 1}`
  - 数据库 `likes` 新增 1 条
  - 事件 `like.created` 触发；b1 收到通知（type=like）
- **验收**：幂等（重复点赞返回 200 + totalLikes=1）
- **优先级**：中
- **场景类型**：正常

### UAT-027 [异常] 点赞不存在的博文
- **关联需求**：REQ-008
- **角色**：已登录 reader
- **前置**：`resetAllRepositories()`；reader u1
- **接口路径**：`POST /posts/<nonexistent>/like`
- **预期**：
  - HTTP 404 Not Found
- **验收**：无通知
- **优先级**：中
- **场景类型**：异常

### UAT-028 [异常] 未认证点赞
- **关联需求**：REQ-008 + NFR-003
- **角色**：匿名
- **接口路径**：`POST /posts/:id/like`
- **预期**：HTTP 401 Unauthorized
- **优先级**：中
- **场景类型**：异常

### UAT-029 [边界] 收藏列表分页
- **关联需求**：REQ-008
- **角色**：已登录 reader
- **前置**：`resetAllRepositories()`；reader u1 + 25 个 published；u1 收藏 25 个
- **接口路径**：`GET /me/bookmarks?page=1&pageSize=10`
- **预期**：
  - HTTP 200 OK
  - 响应 `{items: [10], page: 1, pageSize: 10, total: 25, totalPages: 3}`
- **验收**：分页正确
- **优先级**：低
- **场景类型**：边界

---

## 9. REQ-009 评论发表（UAT-030 ~ UAT-033）

### UAT-030 [正常] 顶级评论
- **关联需求**：REQ-009 + REQ-011（评论触发通知）
- **角色**：已登录 reader
- **前置**：`resetAllRepositories()`；reader u1 + published post p1（author=b1）
- **接口路径**：`POST /posts/:postId/comments`
- **输入**：`{content: 'Great post!'}`
- **预期**：
  - HTTP 201 Created
  - 响应 `{commentId, postId, parentId: null, authorId, content, level: 1, createdAt}`
  - 数据库 `comments` 新增 1 条
  - 事件 `comment.created` 触发；p1.author (b1) 收到通知
- **验收**：level=1
- **优先级**：高
- **场景类型**：正常

### UAT-031 [异常] 未登录评论
- **关联需求**：REQ-009 + NFR-003
- **角色**：匿名
- **接口路径**：`POST /posts/:postId/comments`
- **预期**：HTTP 401 Unauthorized
- **优先级**：高
- **场景类型**：异常

### UAT-032 [异常] 对不存在的博文评论
- **关联需求**：REQ-009
- **角色**：已登录 reader
- **接口路径**：`POST /posts/<nonexistent>/comments`
- **预期**：HTTP 404 Not Found
- **优先级**：中
- **场景类型**：异常

### UAT-033 [边界] 超过 5 层嵌套被拒
- **关联需求**：REQ-009
- **角色**：已登录 reader
- **前置**：`resetAllRepositories()`；预创建 5 层评论链 c1→c2→c3→c4→c5（level 1–5）
- **接口路径**：`POST /comments/:c5-id/replies`
- **输入**：`{content: 'too deep'}`
- **预期**：
  - HTTP 400 Bad Request
  - 响应 `{error: {code: 'MAX_DEPTH_EXCEEDED', message: '评论层级超过最大 5 层', details: {maxLevel: 5}}}`
- **验收**：未创建评论
- **优先级**：中
- **场景类型**：边界

---

## 10. REQ-010 评论删除（UAT-034 ~ UAT-036）

### UAT-034 [正常] 作者删除自己评论
- **关联需求**：REQ-010
- **角色**：已登录 reader（评论作者）
- **前置**：`resetAllRepositories()`；reader u1 + comment c1（authorId=u1）
- **接口路径**：`DELETE /comments/:id`
- **输入**：u1 JWT
- **预期**：
  - HTTP 204 No Content
  - 数据库 c1.deleted = true；c1.deletedAt = now；content 仍保留
- **验收**：软删（非物理删除）
- **优先级**：中
- **场景类型**：正常

### UAT-035 [异常] 第三方删除评论被拒
- **关联需求**：REQ-010
- **角色**：已登录 reader（u2，非作者 u1）
- **前置**：`resetAllRepositories()`；u1 + c1（authorId=u1）+ u2
- **接口路径**：`DELETE /comments/:c1-id`
- **输入**：u2 JWT
- **预期**：
  - HTTP 403 Forbidden
  - 响应 `{error: {code: 'NOT_COMMENT_OWNER', message: '无权删除此评论'}}`
- **验收**：c1.deleted 仍为 false
- **优先级**：中
- **场景类型**：异常

### UAT-036 [边界] 博主删除他人对自己博文的评论
- **关联需求**：REQ-010
- **角色**：已登录 blogger（b1，博文 p1 的作者）
- **前置**：`resetAllRepositories()`；b1 + p1（authorId=b1）+ reader u1 + c1（authorId=u1, postId=p1）
- **接口路径**：`DELETE /comments/:c1-id`
- **输入**：b1 JWT
- **预期**：
  - HTTP 204 No Content
  - c1.deleted = true
- **验收**：博主对自有博文下他人评论有删除权
- **优先级**：中
- **场景类型**：边界

---

## 11. REQ-011 通知系统（UAT-037 ~ UAT-040）

### UAT-037 [正常] 接收关注通知
- **关联需求**：REQ-011 + REQ-004
- **角色**：已登录 blogger
- **前置**：`resetAllRepositories()`；b1 + reader u1；u1 关注 b1（触发 follow.created → b1 收通知）
- **接口路径**：`GET /me/notifications`
- **输入**：b1 JWT
- **预期**：
  - HTTP 200 OK
  - 响应 `{items: [{id, type: 'follow', payload: {followerId: u1.userId}, read: false, createdAt}], page, pageSize, total}`
- **验收**：通知按时间倒序
- **优先级**：中
- **场景类型**：正常

### UAT-038 [正常] 标记已读
- **关联需求**：REQ-011
- **角色**：已登录 blogger
- **前置**：`resetAllRepositories()`；b1 + 1 条未读通知 n1
- **接口路径**：`PATCH /me/notifications/:id/read`
- **输入**：b1 JWT
- **预期**：
  - HTTP 200 OK
  - 响应 `{id, read: true, readAt: '<iso>'}`
  - 数据库 n1.read = true
- **验收**：幂等（重复标记仍 200 + read=true）
- **优先级**：中
- **场景类型**：正常

### UAT-039 [异常] 他人通知不可见
- **关联需求**：REQ-011
- **角色**：已登录 blogger（b2，非 b1）
- **前置**：`resetAllRepositories()`；b1 + n1
- **接口路径**：`PATCH /me/notifications/:n1-id/read`
- **输入**：b2 JWT
- **预期**：
  - HTTP 404 Not Found
  - 响应 `{error: {code: 'NOTIFICATION_NOT_FOUND', message: '通知不存在或无权访问'}}`
- **验收**：n1.read 仍为 false
- **优先级**：中
- **场景类型**：异常

### UAT-040 [边界] 通知分页 + 全部已读后 total=0
- **关联需求**：REQ-011
- **角色**：已登录 blogger
- **前置**：`resetAllRepositories()`；b1 + 30 条通知；全部标记已读
- **接口路径**：`GET /me/notifications?read=true`
- **预期**：
  - HTTP 200 OK
  - `total = 30`（查询条件过滤）
- **接口路径**：`GET /me/notifications?read=false`
- **预期**：`total = 0`
- **验收**：read 过滤参数生效
- **优先级**：低
- **场景类型**：边界

---

## 12. REQ-012 文章标签（UAT-041 ~ UAT-043）

### UAT-041 [正常] 创建标签并关联
- **关联需求**：REQ-012
- **角色**：已登录 blogger
- **前置**：`resetAllRepositories()`；b1 + draft post p1
- **接口路径**：
  - `POST /tags` body `{name: 'tech'}` → 201 `{tagId, name: 'tech'}`
  - `POST /posts/:p1-id/tags` body `{tags: ['tech', 'nodejs']}` → 200 `{postId, tags: ['tech', 'nodejs']}`
- **预期**：
  - 数据库 `tags` Map 新增 'tech'；`post_tags` Map[p1.id] = ['tech', 'nodejs']
  - p1.tags 更新
- **验收**：1–5 个标签限制
- **优先级**：中
- **场景类型**：正常

### UAT-042 [异常] 关联 6 个标签被拒
- **关联需求**：REQ-012
- **角色**：已登录 blogger
- **前置**：`resetAllRepositories()`；b1 + p1
- **接口路径**：`POST /posts/:p1-id/tags`
- **输入**：`{tags: ['a','b','c','d','e','f']}`
- **预期**：
  - HTTP 400 Bad Request
  - 响应 `{error: {code: 'TOO_MANY_TAGS', message: '标签数量超过 5', details: {max: 5}}}`
- **验收**：未变更
- **优先级**：中
- **场景类型**：异常

### UAT-043 [边界] 重复添加相同标签（幂等）
- **关联需求**：REQ-012
- **角色**：已登录 blogger
- **前置**：`resetAllRepositories()`；b1 + p1 + tag 'tech' 已关联
- **接口路径**：`POST /posts/:p1-id/tags`
- **输入**：`{tags: ['tech']}`
- **预期**：
  - HTTP 200 OK
  - 响应 `{postId, tags: ['tech']}`（不重复）
- **验收**：幂等
- **优先级**：低
- **场景类型**：边界

---

## 13. REQ-013 全文搜索（UAT-044 ~ UAT-046）

### UAT-044 [正常] 关键词命中
- **关联需求**：REQ-013 + NFR-001
- **角色**：匿名访客
- **前置**：`resetAllRepositories()`；3 个 published（p1 title='Node.js tutorial', p2 title='Python tips', p3 title='Node best practices'）
- **接口路径**：`GET /search?q=Node`
- **预期**：
  - HTTP 200 OK
  - 响应 `{items: [p1, p3], total: 2, page: 1, pageSize: 20}`
  - 仅 published 博文；title 命中权重 2× > content 命中
- **验收**：搜索仅覆盖 published；权重生效
- **优先级**：高
- **场景类型**：正常

### UAT-045 [异常] 空关键词
- **关联需求**：REQ-013
- **角色**：匿名
- **接口路径**：`GET /search?q=`
- **预期**：
  - HTTP 400 Bad Request
  - 响应 `{error: {code: 'EMPTY_KEYWORD', message: '关键词不能为空'}}`
- **优先级**：中
- **场景类型**：异常

### UAT-046 [边界] 关键词大小写不敏感 + 草稿不参与
- **关联需求**：REQ-013
- **角色**：匿名
- **前置**：`resetAllRepositories()`；published p1（title='Node'）+ draft p2（title='Node draft'）
- **接口路径**：`GET /search?q=NODE`
- **预期**：
  - 响应只含 p1（大小写不敏感；draft 不参与）
  - `total = 1`
- **验收**：综合边界
- **优先级**：中
- **场景类型**：边界

---

## 14. REQ-014 RSS 订阅（UAT-047 ~ UAT-048）

### UAT-047 [正常] RSS 输出
- **关联需求**：REQ-014 + CON-003（RSS 例外）
- **角色**：匿名访客（第三方 RSS 订阅方）
- **前置**：`resetAllRepositories()`；site config（title='My Blog'）+ 25 个 published + 5 个 draft
- **接口路径**：`GET /rss.xml`
- **输入**：无 auth
- **预期**：
  - HTTP 200 OK
  - `Content-Type: application/rss+xml`
  - body 为合法 RSS 2.0 XML；含 `<channel><title>My Blog</title>...</channel>`
  - `<item>` 数量 = 20（最近 20 篇 published）；不含 draft
- **验收**：XML 合法；item 数量正确
- **优先级**：低
- **场景类型**：正常

### UAT-048 [边界] 无 published 时返回空 channel
- **关联需求**：REQ-014
- **前置**：`resetAllRepositories()`；site config；0 个 published
- **接口路径**：`GET /rss.xml`
- **预期**：
  - HTTP 200 OK
  - 合法 XML；`<item>` 0 个
- **验收**：空 channel 不报错
- **优先级**：低
- **场景类型**：边界

---

## 15. REQ-015 Webhook 通知（UAT-049 ~ UAT-052）

### UAT-049 [正常] 注册并触发
- **关联需求**：REQ-015
- **角色**：已登录 blogger
- **前置**：`resetAllRepositories()`；b1 + 1 个 Webhook 端点（nock 模拟）；预注册 `POST /webhooks` `{url: 'https://hook.test/cb', events: ['post.published'], secret: 's1'}`
- **接口路径**：
  - `POST /webhooks` → 201
  - `POST /posts/:p1-id/publish` → 触发 `post.published`
- **预期**：
  - nock 收到 1 次回调
  - 请求体含 `event=post.published` + `payload.postId`
  - 请求头 `X-Webhook-Signature: sha256=<hmac-hex>` 校验通过
  - 数据库 `webhook_deliveries` 新增 1 条（status=success）
- **验收**：签名 + payload + 重试
- **优先级**：中
- **场景类型**：正常

### UAT-050 [异常] 端点 500 触发重试
- **关联需求**：REQ-015
- **角色**：已登录 blogger
- **前置**：`resetAllRepositories()`；b1 + 1 个 Webhook（nock 模拟 500 响应 3 次后 200）
- **步骤**：
  1. POST /posts/:p1-id/publish
  2. 等待 21s（1+4+16 退避）+ buffer
- **预期**：
  - 累计 4 次回调（3 次 500 + 1 次 200）
  - 数据库 `webhook_deliveries` 最终 1 条（status=success，attempts=4）
- **验收**：指数退避重试
- **优先级**：中
- **场景类型**：异常

### UAT-051 [异常] URL 非 https 被拒
- **关联需求**：REQ-015
- **角色**：已登录 blogger
- **接口路径**：`POST /webhooks`
- **输入**：`{url: 'http://insecure.test/cb', events: ['post.published']}`
- **预期**：
  - HTTP 400 Bad Request
  - 响应 `{error: {code: 'INSECURE_URL', message: 'URL 必须使用 https'}}`
- **验收**：不注册
- **优先级**：中
- **场景类型**：异常

### UAT-052 [边界] 重试 3 次后仍失败标记 failed
- **关联需求**：REQ-015
- **角色**：已登录 blogger
- **前置**：`resetAllRepositories()`；b1 + Webhook（nock 持续 500）
- **步骤**：
  1. POST /posts/:p1-id/publish
  2. 等待 22s
- **预期**：
  - 累计 4 次回调（1 + 3 重试）
  - `webhook_deliveries` 1 条（status=failed，attempts=4）
- **验收**：失败终态
- **优先级**：中
- **场景类型**：边界

---

## 16. REQ-016 站点配置（UAT-053 ~ UAT-056）

### UAT-053 [正常] 匿名查询站点配置
- **关联需求**：REQ-016
- **角色**：匿名访客
- **前置**：`resetAllRepositories()`；seed siteConfig（title='My Blog', description='A demo', bannerAd=null）
- **接口路径**：`GET /site/config`
- **预期**：
  - HTTP 200 OK
  - 响应 `{siteTitle, siteDescription, bannerAd: null, updatedAt}`
- **验收**：anon 可见
- **优先级**：中
- **场景类型**：正常

### UAT-054 [正常] admin 修改配置
- **关联需求**：REQ-016 + NFR-003
- **角色**：已登录 admin
- **前置**：`resetAllRepositories()`；seed admin user
- **接口路径**：`PUT /site/config`
- **输入**：`{siteTitle: 'New Title', siteDescription: 'New Desc'}`
- **预期**：
  - HTTP 200 OK
  - 数据库更新；updatedAt 刷新
- **验收**：仅 admin
- **优先级**：中
- **场景类型**：正常

### UAT-055 [异常] reader 修改配置被拒
- **关联需求**：REQ-016 + NFR-003
- **角色**：已登录 reader
- **前置**：`resetAllRepositories()`；reader u1
- **接口路径**：`PUT /site/config`
- **输入**：`{siteTitle: 'hacked'}`
- **预期**：
  - HTTP 403 Forbidden
  - 响应 `{error: {code: 'INSUFFICIENT_ROLE', message: '需要 admin 角色'}}`
- **验收**：未修改
- **优先级**：中
- **场景类型**：异常

### UAT-056 [边界] 当前生效横幅广告
- **关联需求**：REQ-016 + REQ-022
- **角色**：匿名
- **前置**：`resetAllRepositories()`；siteConfig + 3 个广告（a1 已过期、a2 当前生效、a3 未开始）
- **接口路径**：`GET /site/config`
- **预期**：
  - 响应 `bannerAd = a2 的 imageUrl+linkUrl`
- **验收**：当前生效筛选
- **优先级**：低
- **场景类型**：边界

---

## 17. REQ-017 多博主系统（UAT-057 ~ UAT-059）

### UAT-057 [正常] 切换博主身份
- **关联需求**：REQ-017
- **角色**：已登录 reader（拥有多博主身份）
- **前置**：`resetAllRepositories()`；reader u1 + 2 个 blogger b1、b2（均绑定到 u1）
- **接口路径**：`POST /me/bloggers/:b2.id/switch`
- **输入**：u1 reader JWT
- **预期**：
  - HTTP 200 OK
  - 响应 `{token: '<new-jwt>', bloggerId: b2.id, role: 'blogger', expiresIn: 86400}`
  - 新 JWT payload `{sub: b2.id, role: 'blogger', iat, exp}`
- **验收**：新 token 可用于博文 CRUD
- **优先级**：中
- **场景类型**：正常

### UAT-058 [异常] 切换到非自己绑定的博主
- **关联需求**：REQ-017
- **角色**：已登录 reader u1
- **前置**：`resetAllRepositories()`；u1 + b1、b2（b2 绑定到 u2）
- **接口路径**：`POST /me/bloggers/:b2.id/switch`
- **输入**：u1 JWT
- **预期**：
  - HTTP 403 Forbidden
  - 响应 `{error: {code: 'BLOGGER_NOT_BOUND', message: '该博主未绑定到当前用户'}}`
- **验收**：未签发 token
- **优先级**：中
- **场景类型**：异常

### UAT-059 [边界] 切换回原身份
- **关联需求**：REQ-017
- **角色**：已登录 reader
- **前置**：UAT-057 后持有 blogger token
- **接口路径**：`POST /me/switch-back-to-reader`
- **预期**：
  - HTTP 200 OK
  - 新 token payload `{sub: u1.userId, role: 'reader'}`
- **验收**：双向切换
- **优先级**：低
- **场景类型**：边界

---

## 18. REQ-018 审计日志（UAT-060 ~ UAT-062）

### UAT-060 [正常] 关键操作自动记录
- **关联需求**：REQ-018 + CON-004
- **角色**：已登录 admin
- **前置**：`resetAllRepositories()`；admin user；执行 1 次 `POST /posts`（b1 创建草稿）+ 1 次 `POST /posts/:id/publish`
- **接口路径**：`GET /admin/audit-logs`
- **输入**：admin JWT
- **预期**：
  - HTTP 200 OK
  - 响应 `items` 至少含 2 条：
    - `{action: 'post.create', actorId: b1.id, targetType: 'post', targetId: p1.id, ts}`
    - `{action: 'post.publish', actorId: b1.id, targetType: 'post', targetId: p1.id, ts}`
- **验收**：关键操作全覆盖
- **优先级**：高
- **场景类型**：正常

### UAT-061 [异常] 非 admin 查询被拒
- **关联需求**：REQ-018 + NFR-003
- **角色**：已登录 reader
- **接口路径**：`GET /admin/audit-logs`
- **输入**：reader JWT
- **预期**：
  - HTTP 403 Forbidden
  - 响应 `{error: {code: 'INSUFFICIENT_ROLE', message: '需要 admin 角色'}}`
- **验收**：不返回数据
- **优先级**：中
- **场景类型**：异常

### UAT-062 [边界] 90 天前日志不可见
- **关联需求**：REQ-018 + CON-004
- **角色**：已登录 admin
- **前置**：`resetAllRepositories()`；admin；1 条新日志（now）+ 1 条 91 天前日志（`vi.setSystemTime(now - 91d)` 写入）
- **接口路径**：`GET /admin/audit-logs?from=now-100d&to=now`
- **预期**：
  - 响应 `items` 仅含 1 条（now 那条）
  - 91 天前那条自动清理（CON-004）
- **验收**：90 天保留边界
- **优先级**：中
- **场景类型**：边界

---

## 19. REQ-019 文章访问记录（UAT-063 ~ UAT-064）

### UAT-063 [正常] 浏览触发访问记录
- **关联需求**：REQ-019
- **角色**：匿名 + reader
- **前置**：`resetAllRepositories()`；b1 + published p1
- **接口路径**：
  - `GET /posts/:p1.id`（匿名）→ 1 次
  - `GET /posts/:p1.id`（reader u1）→ 1 次
- **接口路径**：`GET /admin/posts/:p1.id/access`
- **输入**：admin JWT
- **预期**：
  - 响应 `items` 长度 = 2
  - 第 1 条 `userId: null, ip: '127.0.0.1'`
  - 第 2 条 `userId: u1.id, ip: '127.0.0.1'`
- **验收**：匿名 vs 登录分别记录
- **优先级**：中
- **场景类型**：正常

### UAT-064 [边界] 同一用户 5 分钟内多次浏览只记 1 次
- **关联需求**：REQ-019
- **角色**：reader u1
- **前置**：`resetAllRepositories()`；b1 + p1；u1
- **步骤**：
  1. GET /posts/:p1.id（t=0）
  2. GET /posts/:p1.id（t=1min）
  3. GET /posts/:p1.id（t=4min59s）
  4. GET /posts/:p1.id（t=5min1s）
- **预期**：
  - `access_records` 总数 = 2（首次 + 跨过 5min 窗口）
- **验收**：去重窗口生效
- **优先级**：低
- **场景类型**：边界

---

## 20. REQ-020 站点统计（UAT-065 ~ UAT-066）

### UAT-065 [正常] PV / UV 聚合
- **关联需求**：REQ-020
- **角色**：已登录 admin
- **前置**：`resetAllRepositories()`；admin；过去 24h 内 100 次浏览（80 unique IP + 20 重复 IP）
- **接口路径**：`GET /admin/stats/site?range=24h`
- **输入**：admin JWT
- **预期**：
  - HTTP 200 OK
  - 响应 `{pv: 100, uv: 80, range: '24h', hourly: [{hour: '...', pv, uv} × 24]}`
- **验收**：PV = 浏览总次数；UV = unique IP/用户数
- **优先级**：中
- **场景类型**：正常

### UAT-066 [边界] range=7d 包含 7×24 桶
- **关联需求**：REQ-020
- **角色**：已登录 admin
- **接口路径**：`GET /admin/stats/site?range=7d`
- **预期**：
  - `hourly` 长度 = 168
- **验收**：range 参数生效
- **优先级**：低
- **场景类型**：边界

---

## 21. REQ-021 推荐系统（UAT-067 ~ UAT-068）

### UAT-067 [正常] 基于标签相似度推荐
- **关联需求**：REQ-021
- **角色**：已登录 reader
- **前置**：`resetAllRepositories()`；reader u1（已浏览 p1 tags=['node','web']）；published p2（tags=['node','js']）、p3（tags=['python','ml']）、p4（tags=['node','server']）
- **接口路径**：`GET /me/recommendations?limit=3`
- **输入**：u1 JWT
- **预期**：
  - 响应 `{items: [p4, p2]}`（Jaccard 相似度高者优先；不含 p3；不含已浏览 p1）
- **验收**：标签 Jaccard 排序
- **优先级**：低
- **场景类型**：正常

### UAT-068 [边界] 冷启动回退最近热门
- **关联需求**：REQ-021
- **角色**：已登录 reader（无浏览历史）
- **前置**：`resetAllRepositories()`；u1 + 15 个 published（views: 100, 90, 80, ..., 10）
- **接口路径**：`GET /me/recommendations?limit=10`
- **预期**：
  - 响应 `items` 长度 = 10，按 view 数降序
- **验收**：冷启动兜底
- **优先级**：低
- **场景类型**：边界

---

## 22. REQ-022 广告位管理（UAT-069 ~ UAT-071）

### UAT-069 [正常] admin 创建广告
- **关联需求**：REQ-022
- **角色**：已登录 admin
- **前置**：`resetAllRepositories()`；admin
- **接口路径**：`POST /site/ads`
- **输入**：`{imageUrl: 'https://cdn/a.png', linkUrl: 'https://target', startAt: 'now', endAt: 'now+7d'}`
- **预期**：
  - HTTP 201 Created
  - 响应 `{adId, imageUrl, linkUrl, startAt, endAt, createdAt}`
- **验收**：DB 新增
- **优先级**：低
- **场景类型**：正常

### UAT-070 [异常] reader 创建广告被拒
- **关联需求**：REQ-022 + NFR-003
- **角色**：已登录 reader
- **接口路径**：`POST /site/ads`
- **预期**：HTTP 403 Forbidden
- **优先级**：低
- **场景类型**：异常

### UAT-071 [边界] 过期广告不展示
- **关联需求**：REQ-022
- **角色**：匿名
- **前置**：`resetAllRepositories()`；3 个广告（a1 endAt=past、a2 endAt=future、a3 endAt=past）
- **接口路径**：`GET /site/ads/active`
- **预期**：
  - 响应 `items: [a2]`（仅未来 + 当前）
- **验收**：过期自动过滤
- **优先级**：低
- **场景类型**：边界

---

## 23. NFR / CON 验收（UAT-072）

### UAT-072 [NFR + CON 联合验收] 横切治理
- **关联需求**：NFR-001~006 + CON-001~004
- **角色**：多角色（per case）
- **目的**：在阶段 8 验收阶段统一验证 10 条横切治理指标

#### UAT-072a NFR-001 性能
- **前置**：seed 1000 博文 + 100 并发
- **接口路径**：k6 脚本 `tests/perf/k6-read-apis.js`
- **执行**：`k6 run --vus 100 --duration 30s tests/perf/k6-read-apis.js`
- **预期**：GET /posts、GET /posts/:id、GET /search P95 ≤ 200ms
- **优先级**：高

#### UAT-072b NFR-002 内存
- **前置**：1000 并发稳定 5 分钟
- **指标**：`process.memoryUsage().heapUsed` 在稳态 ≤ 100MB
- **验收**：监控采样 5min 中位数 ≤ 100MB；峰值 ≤ 130MB（20% buffer）
- **优先级**：高

#### UAT-072c NFR-003 单元覆盖率
- **命令**：`pnpm test:coverage`
- **验收**：
  - 全局 `lines ≥ 80%`
  - 核心模块（auth/posts/comments）`lines ≥ 90%`
- **优先级**：高

#### UAT-072d NFR-004 1000 并发 0 错误
- **命令**：`k6 run --vus 1000 --duration 30s tests/perf/k6-health.js`（`/health` 端点）
- **验收**：`http_req_failed: ['rate==0']` 通过
- **优先级**：高

#### UAT-072e NFR-005 限流
- **接口路径**：`GET /posts` 101 次（同一 IP）
- **验收**：第 101 次返回 HTTP 429 + `Retry-After: 60`
- **优先级**：高

#### UAT-072f NFR-006 bcrypt
- **接口路径**：`POST /users` 注册后查 DB
- **验收**：`bcrypt.getRounds(users[0].passwordHash) >= 10`
- **优先级**：高

#### UAT-072g CON-001 TypeScript strict
- **命令**：`pnpm tsc --noEmit`
- **验收**：exit code = 0；输出为空
- **优先级**：高

#### UAT-072h CON-002 内存存储
- **命令**：`cat package.json | grep -E '(mysql|pg|mongoose|sequelize|typeorm|redis)'`
- **验收**：无匹配（exit 1）
- **优先级**：高

#### UAT-072i CON-003 RESTful + JSON
- **接口路径**：任意 `GET /posts`
- **验收**：`Content-Type: application/json; charset=utf-8`（RSS 端点除外：`application/rss+xml`）
- **优先级**：中

#### UAT-072j CON-004 审计 90 天
- **接口路径**：`GET /admin/audit-logs?from=now-100d&to=now`
- **验收**：响应 items 中所有 `ts >= now - 90d`；> 90d 记录被清理
- **优先级**：中

---

## 24. UAT 数量汇总

| 需求 ID | UAT 范围 | 正常 | 异常 | 边界 | 合计 |
|---|---|---|---|---|---|
| REQ-001 | UAT-001~004 | 1 | 2 | 1 | 4 |
| REQ-002 | UAT-005~008 | 1 | 2 | 1 | 4 |
| REQ-003 | UAT-009~011 | 2 | 1 | 0 | 3 |
| REQ-004 | UAT-012~014 | 1 | 1 | 1 | 3 |
| REQ-005 | UAT-015~017 | 1 | 1 | 1 | 3 |
| REQ-006 | UAT-018~022 | 2 | 2 | 1 | 5 |
| REQ-007 | UAT-023~025 | 1 | 1 | 1 | 3 |
| REQ-008 | UAT-026~029 | 1 | 2 | 1 | 4 |
| REQ-009 | UAT-030~033 | 1 | 2 | 1 | 4 |
| REQ-010 | UAT-034~036 | 1 | 1 | 1 | 3 |
| REQ-011 | UAT-037~040 | 2 | 1 | 1 | 4 |
| REQ-012 | UAT-041~043 | 1 | 1 | 1 | 3 |
| REQ-013 | UAT-044~046 | 1 | 1 | 1 | 3 |
| REQ-014 | UAT-047~048 | 1 | 0 | 1 | 2 |
| REQ-015 | UAT-049~052 | 1 | 2 | 1 | 4 |
| REQ-016 | UAT-053~056 | 2 | 1 | 1 | 4 |
| REQ-017 | UAT-057~059 | 1 | 1 | 1 | 3 |
| REQ-018 | UAT-060~062 | 1 | 1 | 1 | 3 |
| REQ-019 | UAT-063~064 | 1 | 0 | 1 | 2 |
| REQ-020 | UAT-065~066 | 1 | 0 | 1 | 2 |
| REQ-021 | UAT-067~068 | 1 | 0 | 1 | 2 |
| REQ-022 | UAT-069~071 | 1 | 1 | 1 | 3 |
| NFR+CON | UAT-072 (a–j) | 10 | 0 | 0 | 10 |
| **合计** | **UAT-001 ~ UAT-072** | **35** | **23** | **24** | **82** |

注：UAT-072 内含 10 个子用例（a–j），总 UAT 项 = 72（ID 范围）+ 10（子项）= 82 条独立断言，但 72 个 UAT ID 是 RTM 与 UAT 路径映射表的主键。

> 每条 REQ 至少 1 个 UAT；UAT-001~UAT-072 全部覆盖 32 需求（22 REQ + 6 NFR + 4 CON）。
> 阶段 1 同步验收测试设计完成；阶段 8（验收测试）执行。
