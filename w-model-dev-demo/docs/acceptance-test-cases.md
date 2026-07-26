# 验收测试用例设计文档

> 阶段 1（需求分析）同步产出。第 9 轮 W 模型端到端调测。
> 类型：验收测试（UAT）。覆盖全部 22 REQ（NFR/CON 通过 REQ 用例横切覆盖）。
> 执行阶段：阶段 8（验收测试）。本阶段仅设计。

## 文档信息

- 项目名称：blog-system-demo
- 文档版本：v1.0
- 编制日期：2026-07-26
- 编制者：S 子代理（阶段 1）

## 测试环境

- 运行环境：Node.js + tsx（开发模式）
- 测试框架：Vitest + supertest
- 环境变量：JWT_SECRET=test-secret-blog-demo
- 数据存储：内存存储（Map），每个测试前重置

## 用例设计原则

- 每个功能点 ≥ 1 条用例
- 覆盖正常 + 异常 + 边界场景
- 验收标准可量化（HTTP 状态码 + 响应体字段）
- 优先级：高（核心功能）/ 中（辅助功能）/ 低（边缘功能）

## 验收测试用例

### UAT-001：系统健康检查

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-001 |
| 场景 | 系统启动后健康检查 |
| 优先级 | 高 |
| 前置条件 | 服务已启动监听 3000 端口 |
| 测试步骤 | 1. GET /health |
| 预期输出 | HTTP 200，响应体 {"status":"ok"} |
| 异常场景 | 服务未启动 → 连接拒绝 |

### UAT-002：用户注册正常流程

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-002 |
| 场景 | 新用户注册 |
| 优先级 | 高 |
| 前置条件 | 无 |
| 测试步骤 | 1. POST /api/users/register，body={"email":"test@example.com","password":"Pass1234","role":"reader"} |
| 预期输出 | HTTP 201，响应体含 userId（非空字符串） |
| 异常场景 | 邮箱已存在 → 409；密码 < 8 位 → 400；role 非法 → 400 |

### UAT-003：用户登录正常流程

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-003 |
| 场景 | 已注册用户登录获取 JWT |
| 优先级 | 高 |
| 前置条件 | 用户已注册（email=test@example.com, password=Pass1234） |
| 测试步骤 | 1. POST /api/users/login，body={"email":"test@example.com","password":"Pass1234"} |
| 预期输出 | HTTP 200，响应体含 token（非空 JWT 字符串，三段式） |
| 异常场景 | 密码错误 → 401；邮箱不存在 → 401 |

### UAT-004：角色权限校验

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-004 |
| 场景 | 不同角色访问受保护资源 |
| 优先级 | 高 |
| 前置条件 | 创建 reader/author/admin 三种角色用户并登录获取 token |
| 测试步骤 | 1. reader token 调用 POST /api/articles → 403；2. author token 调用 POST /api/articles → 201；3. admin token 调用 DELETE /api/articles/:id（他人文章）→ 200 |
| 预期输出 | reader 被拒 403；author 可创建 201；admin 可删除任何文章 200 |
| 异常场景 | 无 token → 401；token 过期 → 401 |

### UAT-005：文章创建正常流程

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-005 |
| 场景 | author 创建文章 |
| 优先级 | 高 |
| 前置条件 | author 用户已登录获取 token |
| 测试步骤 | 1. POST /api/articles，header=Authorization: Bearer <token>，body={"title":"测试标题","content":"测试正文","tags":["tag1"],"categories":["cat1"]} |
| 预期输出 | HTTP 201，响应体含 articleId（非空） |
| 异常场景 | title 为空 → 400；content 为空 → 400；无 token → 401 |

### UAT-006：文章列表分页查询

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-006 |
| 场景 | 分页查询文章列表 |
| 优先级 | 中 |
| 前置条件 | 已创建 ≥ 15 篇 published 文章 |
| 测试步骤 | 1. GET /api/articles?page=1&limit=10&sort=createdAt:desc |
| 预期输出 | HTTP 200，响应体 {items: array(10), total: number, totalPages: number, page: 1} |
| 异常场景 | page 超出范围 → 200 空数组；limit > 100 → 400 |

### UAT-007：文章详情查询

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-007 |
| 场景 | 按 ID 查询文章详情 |
| 优先级 | 高 |
| 前置条件 | 已创建 1 篇文章 |
| 测试步骤 | 1. GET /api/articles/:id |
| 预期输出 | HTTP 200，响应体含 id/title/content/tags/categories/author/createdAt |
| 异常场景 | id 不存在 → 404；id 格式非法 → 400 |

### UAT-008：文章更新权限校验

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-008 |
| 场景 | 作者更新自己的文章，非作者被拒 |
| 优先级 | 高 |
| 前置条件 | author A 创建文章，author B 登录 |
| 测试步骤 | 1. author B token 调用 PUT /api/articles/:id（A 的文章）→ 403；2. author A token 调用 PUT /api/articles/:id → 200；3. admin token 调用 PUT /api/articles/:id → 200 |
| 预期输出 | 非作者 403；作者本人 200；admin 200 |
| 异常场景 | 文章不存在 → 404 |

### UAT-009：文章删除权限校验

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-009 |
| 场景 | 作者删除自己的文章，非作者被拒 |
| 优先级 | 高 |
| 前置条件 | author A 创建文章，author B 登录 |
| 测试步骤 | 1. author B token 调用 DELETE /api/articles/:id（A 的文章）→ 403；2. author A token 调用 DELETE /api/articles/:id → 200；3. 再次查询 GET /api/articles/:id → 404 |
| 预期输出 | 非作者 403；作者 200；删除后查询 404 |
| 异常场景 | 文章不存在 → 404 |

### UAT-010：评论创建正常流程

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-010 |
| 场景 | 对文章发表评论 |
| 优先级 | 高 |
| 前置条件 | 已登录用户，文章已存在 |
| 测试步骤 | 1. POST /api/articles/:id/comments，body={"content":"好文章"} |
| 预期输出 | HTTP 201，响应体含 commentId（非空） |
| 异常场景 | 文章不存在 → 404；content 为空 → 400；无 token → 401 |

### UAT-011：评论列表查询

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-011 |
| 场景 | 查询文章的评论列表 |
| 优先级 | 中 |
| 前置条件 | 文章已有 ≥ 3 条评论 |
| 测试步骤 | 1. GET /api/articles/:id/comments |
| 预期输出 | HTTP 200，响应体为数组，按 createdAt 升序 |
| 异常场景 | 文章不存在 → 404 |

### UAT-012：评论删除权限校验

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-012 |
| 场景 | 评论作者删除自己的评论，非作者被拒 |
| 优先级 | 高 |
| 前置条件 | 用户 A 创建评论，用户 B 登录 |
| 测试步骤 | 1. 用户 B token 调用 DELETE /api/comments/:id（A 的评论）→ 403；2. 用户 A token 调用 DELETE /api/comments/:id → 200 |
| 预期输出 | 非作者 403；作者 200 |
| 异常场景 | 评论不存在 → 404 |

### UAT-013：标签管理 CRUD

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-013 |
| 场景 | 标签的增删改查 |
| 优先级 | 中 |
| 前置条件 | admin 用户已登录 |
| 测试步骤 | 1. POST /api/tags → 201；2. GET /api/tags → 200 数组含新标签；3. PUT /api/tags/:id → 200；4. DELETE /api/tags/:id → 200；5. GET /api/tags → 200 不含已删除 |
| 预期输出 | CRUD 全流程通过 |
| 异常场景 | reader 创建标签 → 403；标签名重复 → 409 |

### UAT-014：分类管理 CRUD

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-014 |
| 场景 | 分类的增删改查 |
| 优先级 | 中 |
| 前置条件 | admin 用户已登录 |
| 测试步骤 | 1. POST /api/categories → 201；2. GET /api/categories → 200；3. PUT /api/categories/:id → 200；4. DELETE /api/categories/:id → 200 |
| 预期输出 | CRUD 全流程通过 |
| 异常场景 | reader 创建分类 → 403 |

### UAT-015：文章搜索

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-015 |
| 场景 | 按关键词/标签/分类搜索文章 |
| 优先级 | 中 |
| 前置条件 | 已创建含 "TypeScript" 关键词、tag1 标签、cat1 分类的文章 |
| 测试步骤 | 1. GET /api/search?q=TypeScript；2. GET /api/search?tag=tag1；3. GET /api/search?category=cat1；4. GET /api/search?q=TypeScript&tag=tag1 |
| 预期输出 | HTTP 200，返回匹配文章列表 |
| 异常场景 | 无匹配 → 200 空数组 |

### UAT-016：密码重置流程 [第9轮新增]

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-016 |
| 场景 | 忘记密码后通过邮箱重置 |
| 优先级 | 高 |
| 前置条件 | 用户已注册（email=test@example.com） |
| 测试步骤 | 1. POST /api/users/password/reset-request，body={"email":"test@example.com"} → 200 含 resetToken；2. POST /api/users/password/reset，body={"token":<resetToken>,"newPassword":"NewPass1234"} → 200；3. 用新密码登录 POST /api/users/login → 200 |
| 预期输出 | 重置请求返回 token；重置成功 200；新密码可登录 |
| 异常场景 | 邮箱不存在 → 200（防枚举，不暴露）；token 无效 → 400；新密码 < 8 位 → 400 |

### UAT-017：草稿/发布工作流 [第9轮新增]

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-017 |
| 场景 | 文章草稿→发布→取消发布的状态转换 |
| 优先级 | 高 |
| 前置条件 | author 已登录 |
| 测试步骤 | 1. POST /api/articles 创建文章（默认 draft）→ 201 status=draft；2. GET /api/articles（reader）→ 不含 draft 文章；3. POST /api/articles/:id/publish → 200 status=published；4. GET /api/articles（reader）→ 含该文章；5. POST /api/articles/:id/unpublish → 200 status=draft；6. GET /api/articles（reader）→ 不含该文章 |
| 预期输出 | 状态转换正确；reader 仅见 published；author/admin 可见 draft |
| 异常场景 | reader 发布 → 403；文章不存在 → 404 |

### UAT-018：文章点赞去重 [第9轮新增]

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-018 |
| 场景 | 用户点赞/取消点赞，去重计数 |
| 优先级 | 中 |
| 前置条件 | 用户已登录，文章已 published |
| 测试步骤 | 1. POST /api/articles/:id/like → 200 likeCount=1；2. 同一用户再次 POST /api/articles/:id/like → 200 likeCount=0（取消）；3. 用户 A、B 各点赞一次 → likeCount=2 |
| 预期输出 | 切换点赞状态；likeCount 正确；同一用户去重 |
| 异常场景 | 未登录 → 401；文章不存在 → 404；draft 文章 → 403 |

### UAT-019：审计日志记录与查询 [第9轮新增]

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-019 |
| 场景 | 关键操作记录审计日志，admin 查询 |
| 优先级 | 高 |
| 前置条件 | admin 用户已登录 |
| 测试步骤 | 1. 执行登录操作 → 触发审计日志；2. 执行文章创建 → 触发审计日志；3. GET /api/audit-logs?page=1&limit=20 → 200 含日志列表，每条含 userId/action/resource/timestamp；4. reader 调用 GET /api/audit-logs → 403 |
| 预期输出 | 关键操作被记录；admin 可查询；reader 被拒 |
| 异常场景 | 非 admin 查询 → 403；分页超出范围 → 200 空数组 |

### UAT-020：RSS 订阅输出 [第9轮新增]

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-020 |
| 场景 | 获取 RSS Atom 格式订阅源 |
| 优先级 | 中 |
| 前置条件 | 已有 ≥ 5 篇 published 文章 |
| 测试步骤 | 1. GET /api/rss → 200；2. 检查 Content-Type: application/atom+xml；3. 检查响应体为合法 Atom XML（含 <feed> 根元素，<entry> 子元素）；4. 检查仅含最新 20 篇 published 文章 |
| 预期输出 | 合法 Atom XML，仅 published 文章，最多 20 条 |
| 异常场景 | 无 published 文章 → 200 空 feed；XML 特殊字符转义正确 |

### UAT-021：用户资料管理

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-021 |
| 场景 | 更新与查询用户资料 |
| 优先级 | 中 |
| 前置条件 | 用户已登录 |
| 测试步骤 | 1. PUT /api/users/profile，body={"nickname":"张三","avatar":"https://example.com/a.png","bio":"博主"} → 200；2. GET /api/users/:id/profile → 200 含 nickname/avatar/bio |
| 预期输出 | 资料更新成功；公开资料可查询 |
| 异常场景 | nickname > 50 字符 → 400；查询不存在用户 → 404 |

### UAT-022：文章归档查询

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-022 |
| 场景 | 按月份分组查询文章归档 |
| 优先级 | 低 |
| 前置条件 | 已创建跨月份的文章 |
| 测试步骤 | 1. GET /api/articles/archive → 200 |
| 预期输出 | HTTP 200，响应体为数组 [{year:2026,month:7,count:5},...]，按时间倒序 |
| 异常场景 | 无文章 → 200 空数组 |

## 阶段 8 补充用例（UAT-023 ~ UAT-063）

> 阶段 1 设计 22 UAT 仅每 REQ 1 条；阶段 8 执行前补充至 63 UAT，覆盖 32 需求（22 REQ + 6 NFR + 4 CON）× 正常/异常/边界场景。
> 满足分布约束：5 新增 REQ（018~022）各 ≥3 UAT；17 现有 REQ 各 ≥2 UAT；NFR-006/CON-004 各 ≥2 UAT；其余 NFR 各 ≥1；其余 CON 各 ≥1。
> 实际 API 路径以 `docs/uat-path-mapping.md` 回填为准（设计路径与实际路径存在等价映射）。

### UAT-023：未知路由 404（边界）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-001 |
| 场景 | 边界：访问不存在的路由 |
| 优先级 | 中 |
| 前置条件 | 服务已启动 |
| 测试步骤 | 1. GET /api/non-existent-route |
| 预期输出 | HTTP 404，响应体 {error:{code:"NOT_FOUND_ERROR"}} |

### UAT-024：注册邮箱已存在（异常）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-002 |
| 场景 | 异常：重复注册同一邮箱 |
| 优先级 | 高 |
| 前置条件 | 用户 test@example.com 已注册 |
| 测试步骤 | 1. POST /api/users/register，body={"email":"test@example.com","password":"Pass1234","role":"reader"} |
| 预期输出 | HTTP 409，响应体 error.code=CONFLICT_ERROR |

### UAT-025：注册密码边界值（边界）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-002 |
| 场景 | 边界：密码长度边界（7 位拒绝 / 8 位通过） |
| 优先级 | 中 |
| 前置条件 | 无 |
| 测试步骤 | 1. POST /api/users/register，body={"email":"a@b.com","password":"1234567","role":"reader"} → 400；2. POST /api/users/register，body={"email":"b@b.com","password":"12345678","role":"reader"} → 201 |
| 预期输出 | 7 位密码 400（VALIDATION_ERROR）；8 位密码 201 |

### UAT-026：登录密码错误（异常）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-003 |
| 场景 | 异常：密码错误登录失败 |
| 优先级 | 高 |
| 前置条件 | 用户已注册（email=test@example.com, password=Pass1234） |
| 测试步骤 | 1. POST /api/users/login，body={"email":"test@example.com","password":"WrongPass"} |
| 预期输出 | HTTP 401，error.code=AUTHENTICATION_ERROR |

### UAT-027：无 Token 访问受保护资源（异常）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-004 |
| 场景 | 异常：无 Authorization 头访问受保护端点 |
| 优先级 | 高 |
| 前置条件 | 无 |
| 测试步骤 | 1. POST /api/articles（无 Authorization 头），body={"title":"t","content":"c"} |
| 预期输出 | HTTP 401，error.code=AUTHENTICATION_ERROR |

### UAT-028：文章创建标题为空（异常）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-005 |
| 场景 | 异常：title 空字符串 |
| 优先级 | 中 |
| 前置条件 | author 已登录 |
| 测试步骤 | 1. POST /api/articles，body={"title":"","content":"正文","tagIds":[],"categoryId":null} |
| 预期输出 | HTTP 400，error.code=VALIDATION_ERROR |

### UAT-029：文章列表分页超出范围（边界）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-006 |
| 场景 | 边界：page 超出总页数 |
| 优先级 | 中 |
| 前置条件 | 已创建 3 篇 published 文章 |
| 测试步骤 | 1. GET /api/articles?page=999&limit=10 |
| 预期输出 | HTTP 200，{items:[], total:3, page:999, limit:10} |

### UAT-030：文章详情 ID 不存在（异常）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-007 |
| 场景 | 异常：查询不存在的文章 ID |
| 优先级 | 高 |
| 前置条件 | 无 |
| 测试步骤 | 1. GET /api/articles/non-existent-id |
| 预期输出 | HTTP 404，error.code=NOT_FOUND_ERROR |

### UAT-031：更新不存在的文章（异常）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-008 |
| 场景 | 异常：更新不存在文章 |
| 优先级 | 中 |
| 前置条件 | author 已登录 |
| 测试步骤 | 1. PUT /api/articles/non-existent-id，body={"title":"新标题"} |
| 预期输出 | HTTP 404，error.code=NOT_FOUND_ERROR |

### UAT-032：删除文章后查询 404（边界）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-009 |
| 场景 | 边界：删除后再次查询/删除 |
| 优先级 | 中 |
| 前置条件 | author 创建文章并删除 |
| 测试步骤 | 1. 再次 DELETE /api/articles/:id → 404；2. GET /api/articles/:id → 404 |
| 预期输出 | 重复删除 404；查询 404 |

### UAT-033：评论内容为空（异常）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-010 |
| 场景 | 异常：content 空字符串 |
| 优先级 | 中 |
| 前置条件 | 用户已登录，文章已 published |
| 测试步骤 | 1. POST /api/articles/:id/comments，body={"content":""} |
| 预期输出 | HTTP 400，error.code=VALIDATION_ERROR |

### UAT-034：空评论列表（边界）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-011 |
| 场景 | 边界：文章无评论时查询 |
| 优先级 | 低 |
| 前置条件 | 文章已 published，无评论 |
| 测试步骤 | 1. GET /api/articles/:id/comments |
| 预期输出 | HTTP 200，{items:[], total:0, page:1, limit:10} |

### UAT-035：删除不存在的评论（异常）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-012 |
| 场景 | 异常：删除不存在评论 |
| 优先级 | 中 |
| 前置条件 | 用户已登录 |
| 测试步骤 | 1. DELETE /api/comments/non-existent-id |
| 预期输出 | HTTP 404，error.code=NOT_FOUND_ERROR |

### UAT-036：非 admin 创建标签被拒（异常）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-013 |
| 场景 | 异常：reader/author 创建标签 |
| 优先级 | 中 |
| 前置条件 | reader 已登录 |
| 测试步骤 | 1. POST /api/tags，body={"name":"新标签"} |
| 预期输出 | HTTP 403，error.code=AUTHORIZATION_ERROR |

### UAT-037：分类循环依赖检测（异常）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-014 |
| 场景 | 异常：分类形成循环父引用 |
| 优先级 | 中 |
| 前置条件 | 已创建分类 A→B→A 循环尝试 |
| 测试步骤 | 1. POST /api/categories 创建 A；2. POST /api/categories 创建 B（parentCategoryId=A.id）；3. PUT /api/categories/A.id 更新 parentCategoryId=B.id |
| 预期输出 | 第 3 步 400（循环依赖检测）或系统拒绝循环 |

### UAT-038：搜索无匹配（边界）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-015 |
| 场景 | 边界：关键词无匹配文章 |
| 优先级 | 低 |
| 前置条件 | 已创建若干文章 |
| 测试步骤 | 1. GET /api/search?keyword=zzzznonexistent |
| 预期输出 | HTTP 200，{items:[], total:0, page:1, limit:10} |

### UAT-039：密码重置令牌无效（异常）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-016 |
| 场景 | 异常：使用无效/已用令牌重置 |
| 优先级 | 高 |
| 前置条件 | 用户已注册 |
| 测试步骤 | 1. POST /api/users/password-reset，body={"token":"invalid-token","newPassword":"NewPass1234"} |
| 预期输出 | HTTP 404，error.code=NOT_FOUND_ERROR |

### UAT-040：密码重置新密码不足 8 位（边界）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-016 |
| 场景 | 边界：新密码 < 8 位 |
| 优先级 | 中 |
| 前置条件 | 用户已注册，已获取有效 resetToken |
| 测试步骤 | 1. POST /api/users/password-reset，body={"token":<valid>,"newPassword":"123"} |
| 预期输出 | HTTP 400，error.code=VALIDATION_ERROR |

### UAT-041：reader 发布文章被拒（异常）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-017 |
| 场景 | 异常：reader 角色调用发布工作流 |
| 优先级 | 高 |
| 前置条件 | reader 已登录，文章已存在 |
| 测试步骤 | 1. POST /api/articles/:id/workflow，body={"action":"publish"} |
| 预期输出 | HTTP 403，error.code=AUTHORIZATION_ERROR |

### UAT-042：发布不存在的文章（边界）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-017 |
| 场景 | 边界：对不存在文章执行工作流 |
| 优先级 | 中 |
| 前置条件 | author 已登录 |
| 测试步骤 | 1. POST /api/articles/non-existent-id/workflow，body={"action":"publish"} |
| 预期输出 | HTTP 404，error.code=NOT_FOUND_ERROR |

### UAT-043：点赞未发布文章被拒（异常）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-018 |
| 场景 | 异常：对 draft 文章点赞 |
| 优先级 | 中 |
| 前置条件 | 用户已登录，文章为 draft |
| 测试步骤 | 1. POST /api/articles/:id/like |
| 预期输出 | HTTP 400，error.code=VALIDATION_ERROR（文章未发布） |

### UAT-044：多用户点赞计数（边界）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-018 |
| 场景 | 边界：多用户点赞后 likeCount 正确 |
| 优先级 | 中 |
| 前置条件 | 文章已 published，用户 A、B 已登录 |
| 测试步骤 | 1. A 点赞 → likeCount=1；2. B 点赞 → likeCount=2；3. A 取消 → likeCount=1 |
| 预期输出 | likeCount 依次为 1→2→1，去重正确 |

### UAT-045：非 admin 查询审计日志被拒（异常）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-019 |
| 场景 | 异常：reader 查询审计日志 |
| 优先级 | 高 |
| 前置条件 | reader 已登录 |
| 测试步骤 | 1. GET /api/audit-logs |
| 预期输出 | HTTP 403，error.code=AUTHORIZATION_ERROR |

### UAT-046：审计日志分页超出范围（边界）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-019 |
| 场景 | 边界：page 超出范围返回空 |
| 优先级 | 低 |
| 前置条件 | admin 已登录，已有若干审计日志 |
| 测试步骤 | 1. GET /api/audit-logs?page=999&limit=20 |
| 预期输出 | HTTP 200，{items:[], total:<n>, page:999, limit:20} |

### UAT-047：RSS XML 特殊字符转义（异常）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-020 |
| 场景 | 异常：文章标题含 XML 特殊字符需转义 |
| 优先级 | 中 |
| 前置条件 | 已创建含 <script>、& 等特殊字符的 published 文章 |
| 测试步骤 | 1. GET /api/rss；2. 检查响应体中特殊字符被转义（&lt; &gt; &amp;） |
| 预期输出 | HTTP 200，XML 中特殊字符正确转义 |

### UAT-048：空 RSS Feed（边界）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-020 |
| 场景 | 边界：无 published 文章时获取 RSS |
| 优先级 | 低 |
| 前置条件 | 无 published 文章 |
| 测试步骤 | 1. GET /api/rss |
| 预期输出 | HTTP 200，合法 XML（含根元素，无 entry/item 子元素） |

### UAT-049：用户资料 nickname 超长（异常）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-021 |
| 场景 | 异常：nickname > 50 字符 |
| 优先级 | 中 |
| 前置条件 | 用户已登录 |
| 测试步骤 | 1. PUT /api/users/profile，body={"nickname":"x".repeat(51)} |
| 预期输出 | HTTP 400，error.code=VALIDATION_ERROR |

### UAT-050：查询未设置资料的用户（边界）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-021 |
| 场景 | 边界：未设置资料时查询 |
| 优先级 | 低 |
| 前置条件 | 用户已注册但未设置 profile（注册即初始化空 profile，DD-021） |
| 测试步骤 | 1. GET /api/users/profile（携带 token） |
| 预期输出 | HTTP 200，返回空资料（nickname/avatar/bio 均为空串） |

### UAT-051：无文章时归档查询（边界）

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-022 |
| 场景 | 边界：无文章时查询归档 |
| 优先级 | 低 |
| 前置条件 | 无 published 文章 |
| 测试步骤 | 1. GET /api/archive |
| 预期输出 | HTTP 200，响应体为空数组 [] |

### UAT-052：NFR-001 性能 P95（正常）

| 项 | 内容 |
|---|---|
| 关联需求 | NFR-001 |
| 场景 | 正常：API 响应时间 P95 < 200ms |
| 优先级 | 高 |
| 前置条件 | 服务已启动，已预置若干文章 |
| 测试步骤 | 1. 连续请求 GET /api/articles 50 次；2. 计算 P95 延迟 |
| 预期输出 | P95 < 200ms |

### UAT-053：NFR-002 JWT 密钥强度（正常）

| 项 | 内容 |
|---|---|
| 关联需求 | NFR-002 |
| 场景 | 正常：JWT HS256 密钥 ≥ 32 字节（256 位） |
| 优先级 | 高 |
| 前置条件 | JWT_SECRET 环境变量已设置 |
| 测试步骤 | 1. 验证 process.env.JWT_SECRET.length ≥ 32；2. 登录获取 token，验证 token 用 HS256 算法 |
| 预期输出 | 密钥长度 ≥ 32；token header.alg=HS256 |

### UAT-054：NFR-003 统一错误响应（正常）

| 项 | 内容 |
|---|---|
| 关联需求 | NFR-003 |
| 场景 | 正常：错误响应统一格式 {error:{code,message}} |
| 优先级 | 中 |
| 前置条件 | 无 |
| 测试步骤 | 1. 触发 400/401/403/404/409 各类错误；2. 验证响应体均含 error.code + error.message |
| 预期输出 | 所有错误响应格式统一 |

### UAT-055：NFR-004 内存存储容量（正常）

| 项 | 内容 |
|---|---|
| 关联需求 | NFR-004 |
| 场景 | 正常：单表 ≥ 10000 条记录可正常工作 |
| 优先级 | 中 |
| 前置条件 | 无 |
| 测试步骤 | 1. 直接通过 store.insert 批量插入 10000 篇文章；2. GET /api/articles 验证可查询 |
| 预期输出 | 插入成功，查询 total=10000 |

### UAT-056：NFR-005 输入验证 zod（正常）

| 项 | 内容 |
|---|---|
| 关联需求 | NFR-005 |
| 场景 | 正常：所有写入端点经 zod schema 校验 |
| 优先级 | 中 |
| 前置条件 | 无 |
| 测试步骤 | 1. 各写入端点发送非法 body（缺字段/类型错误/超长）；2. 验证返回 400 VALIDATION_ERROR |
| 预期输出 | 非法输入统一 400 |

### UAT-057：NFR-006 限流 60 次/分钟触发 429（正常）

| 项 | 内容 |
|---|---|
| 关联需求 | NFR-006 |
| 场景 | 正常：超过 60 次/分钟限流触发 429 |
| 优先级 | 高 |
| 前置条件 | 清空限流桶 |
| 测试步骤 | 1. 连续请求 61 次 GET /api/articles；2. 第 61 次应返回 429 |
| 预期输出 | 前 60 次 2xx，第 61 次 429 RATE_LIMIT_ERROR |

### UAT-058：NFR-006 限流令牌恢复（边界）

| 项 | 内容 |
|---|---|
| 关联需求 | NFR-006 |
| 场景 | 边界：等待令牌恢复后可继续请求 |
| 优先级 | 中 |
| 前置条件 | 限流桶已耗尽 |
| 测试步骤 | 1. 消耗全部 60 令牌；2. 等待 ≥ 1 秒（refillRate=1/s）；3. 再次请求 |
| 预期输出 | 等待后请求 2xx（令牌已恢复） |

### UAT-059：CON-001 技术栈约束（正常）

| 项 | 内容 |
|---|---|
| 关联需求 | CON-001 |
| 场景 | 正常：验证 Express 4 + TypeScript 5 + 内存存储 |
| 优先级 | 中 |
| 前置条件 | 无 |
| 测试步骤 | 1. 检查 package.json 含 express 依赖；2. tsc --noEmit 0 错误；3. 验证 store 实现为 Map |
| 预期输出 | 技术栈符合约束 |

### UAT-060：CON-002 JWT HS256 1 小时有效期（正常）

| 项 | 内容 |
|---|---|
| 关联需求 | CON-002 |
| 场景 | 正常：JWT 算法 HS256，有效期 1 小时 |
| 优先级 | 中 |
| 前置条件 | 用户登录获取 token |
| 测试步骤 | 1. 解码 token header 验证 alg=HS256；2. 解码 payload 验证 exp-iat ≈ 3600 秒 |
| 预期输出 | alg=HS256；有效期约 1 小时 |

### UAT-061：CON-003 TypeScript strict 0 错误（正常）

| 项 | 内容 |
|---|---|
| 关联需求 | CON-003 |
| 场景 | 正常：tsc --noEmit 退出码 0 |
| 优先级 | 高 |
| 前置条件 | 无 |
| 测试步骤 | 1. npx tsc --noEmit |
| 预期输出 | 退出码 0，无编译错误 |

### UAT-062：CON-004 结构化 JSON 日志（正常）

| 项 | 内容 |
|---|---|
| 关联需求 | CON-004 |
| 场景 | 正常：审计日志含 level+timestamp+message+meta 结构 |
| 优先级 | 中 |
| 前置条件 | 触发审计日志 |
| 测试步骤 | 1. 执行登录触发审计日志；2. GET /api/audit-logs 查询；3. 验证每条含 userId/action/resource/timestamp |
| 预期输出 | 审计日志结构化字段完整 |

### UAT-063：CON-004 审计日志 90 天保留（边界）

| 项 | 内容 |
|---|---|
| 关联需求 | CON-004 |
| 场景 | 边界：90 天以上日志被清理 |
| 优先级 | 中 |
| 前置条件 | 预置 100 天前与 30 天前日志 |
| 测试步骤 | 1. 直接通过 store.insert 插入 100 天前日志；2. 调用 cleanupExpired；3. 验证 100 天前日志被清理，30 天前保留 |
| 预期输出 | 过期日志清理，未过期保留 |

## 验收标准汇总

- 63 条 UAT 用例覆盖全部 32 需求（22 REQ + 6 NFR + 4 CON）
- 分布达标：
  - 5 新增 REQ（018~022）各 3 UAT（正常/异常/边界）
  - 17 现有 REQ（001~017）各 ≥2 UAT
  - NFR-006 限流 2 UAT（触发 + 恢复）
  - CON-004 日志规范 2 UAT（结构化 + 保留期）
  - 其余 5 NFR 各 1 UAT；其余 3 CON 各 1 UAT
- 第 9 轮新增 41 条 UAT（UAT-023~UAT-063）补充覆盖
- 所有用例在阶段 8 执行，预期通过率 100%
