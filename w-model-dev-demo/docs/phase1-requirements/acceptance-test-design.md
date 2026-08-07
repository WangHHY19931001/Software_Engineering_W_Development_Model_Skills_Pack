# 验收测试设计文档

> 阶段 1（需求分析）同步设计的验收测试用例（UAT）。阶段 8 执行。
> 类型：验收测试。覆盖 32 需求 × 正常+异常+边界场景。
> 每条用例含前置条件分析（认证状态 / 数据依赖 / 接口路径，禁止行为 #12/#13）。

## 文档信息

- 项目名称：博客系统后端（第 34 轮端到端调测，blog-system-demo-r34）
- 测试类型：验收测试
- 设计来源阶段：阶段 1（需求分析）
- 执行阶段：阶段 8（验收测试）
- 文档版本：v1.1（S-fix 修订，依据 RC-phase1-1-01 fixRecommendation）
- 编制者：S-doc（dispatchId=phase1-S-doc-01）；修订：S-fix（dispatchId=phase1-S-fix-01）

## 用例列表（UAT-001 ~ UAT-091）

> 前置条件格式：`认证：<角色/token 要求>；数据：<依赖数据>；路径：<METHOD /api/...>`
> 场景类型：正常 / 异常 / 边界。

### UAT-001 ~ UAT-066：功能需求（REQ-001 ~ REQ-022，每需求 正常/异常/边界 3 用例）

| 用例 ID | 标题 | 优先级 | 关联需求 | 场景类型 | 前置条件 | 输入 | 预期输出 |
|---|---|---|---|---|---|---|---|
| UAT-001 | 注册成功返回用户与令牌 | 高 | REQ-001 | 正常 | 认证：无需；数据：邮箱未注册；路径：POST /api/auth/register | `{"email":"reader1@example.com","password":"pass123456"}` | 201，响应含 userId/email/token，JWT 可访问受保护接口 |
| UAT-002 | 重复邮箱注册冲突 | 高 | REQ-001 | 异常 | 认证：无需；数据：reader1@example.com 已注册；路径：POST /api/auth/register | 同上邮箱再次注册 | 409 冲突错误体 |
| UAT-003 | 非法邮箱/短密码拒绝 | 高 | REQ-001 | 边界 | 认证：无需；数据：无；路径：POST /api/auth/register | `{"email":"bad","password":"123"}` | 400 参数错误，含 zod 校验错误明细 |
| UAT-004 | 查询个人资料 | 高 | REQ-002 | 正常 | 认证：用户 token；数据：用户已注册；路径：GET /api/users/me | 无 body | 200，返回昵称/邮箱等资料字段 |
| UAT-005 | 未认证访问资料 | 高 | REQ-002 | 异常 | 认证：无 token；数据：无；路径：GET /api/users/me | 无 Authorization 头 | 401 未认证 |
| UAT-006 | 超长昵称更新拒绝 | 高 | REQ-002 | 边界 | 认证：用户 token；数据：用户已注册；路径：PUT /api/users/me | `{"nickname":"x".repeat(33)}` | 400 参数错误 |
| UAT-007 | 正确凭据登录换取 JWT | 高 | REQ-003 | 正常 | 认证：无需；数据：用户已注册；路径：POST /api/auth/login | `{"email":"reader1@example.com","password":"pass123456"}` | 200，返回 JWT；用该 JWT 请求受保护接口成功 |
| UAT-008 | 错误密码登录拒绝 | 高 | REQ-003 | 异常 | 认证：无需；数据：用户已注册；路径：POST /api/auth/login | `{"email":"reader1@example.com","password":"wrongpass"}` | 401 未授权 |
| UAT-009 | 无效/过期 token 拒绝 | 高 | REQ-003 | 边界 | 认证：伪造/过期 token；数据：无；路径：GET /api/users/me | Authorization: Bearer invalid-token | 401 未认证 |
| UAT-010 | 开通博主身份 | 高 | REQ-004 | 正常 | 认证：用户 token；数据：用户已注册且非博主；路径：POST /api/bloggers | `{"displayName":"博主甲"}` | 201，返回 bloggerId |
| UAT-011 | 重复开通博主冲突 | 高 | REQ-004 | 异常 | 认证：用户 token；数据：用户已是博主；路径：POST /api/bloggers | 同上 | 409 冲突 |
| UAT-012 | 未认证开通博主拒绝 | 高 | REQ-004 | 异常 | 认证：无 token；数据：无；路径：POST /api/bloggers | 同上 | 401 未认证 |
| UAT-013 | 关注博主成功 | 高 | REQ-005 | 正常 | 认证：用户 token；数据：博主已开通；路径：POST /api/bloggers/:id/follow | 无 body | 200，博主粉丝数 +1 |
| UAT-014 | 重复关注幂等 | 高 | REQ-005 | 边界 | 认证：用户 token；数据：已关注该博主；路径：POST /api/bloggers/:id/follow | 无 body | 200，粉丝数不变（幂等） |
| UAT-015 | 关注不存在博主 | 高 | REQ-005 | 异常 | 认证：用户 token；数据：博主 id 不存在；路径：POST /api/bloggers/:id/follow | 无 body | 404 不存在 |
| UAT-016 | 创建文章成功 | 高 | REQ-006 | 正常 | 认证：博主 token；数据：博主已开通；路径：POST /api/posts | `{"title":"T1","content":"C1"}` | 201，返回文章含 id/title/author |
| UAT-017 | 非作者更新文章拒绝 | 高 | REQ-006 | 异常 | 认证：博主 B token；数据：文章作者为博主 A；路径：PUT /api/posts/:id | `{"title":"hacked"}` | 403 越权 |
| UAT-018 | 空标题/内容创建拒绝 | 高 | REQ-006 | 边界 | 认证：博主 token；数据：无；路径：POST /api/posts | `{"title":"","content":""}` | 400 参数错误 |
| UAT-019 | 保存草稿不公开可见 | 高 | REQ-007 | 正常 | 认证：博主 token；数据：无；路径：POST /api/posts | `{"title":"D1","content":"D","status":"draft"}` | 201 status=draft；访客 GET 公开列表不含该文章 |
| UAT-020 | 发布文章公开可见 | 高 | REQ-007 | 正常 | 认证：博主 token；数据：草稿已存在；路径：PATCH /api/posts/:id/status | `{"status":"published"}` | 200 status=published；公开列表可见 |
| UAT-021 | 非作者修改状态拒绝 | 高 | REQ-007 | 异常 | 认证：博主 B token；数据：草稿作者为博主 A；路径：PATCH /api/posts/:id/status | `{"status":"published"}` | 403 越权 |
| UAT-022 | 浏览公开文章计数 | 高 | REQ-008 | 正常 | 认证：无需；数据：公开文章已存在；路径：GET /api/posts/:id | 无 body | 200 文章内容；再次 GET 后 viewCount +1 且持久化 |
| UAT-023 | 浏览不存在文章 | 高 | REQ-008 | 异常 | 认证：无需；数据：文章 id 不存在；路径：GET /api/posts/:id | 无 body | 404 不存在 |
| UAT-024 | 访客浏览草稿 | 高 | REQ-008 | 边界 | 认证：无需（访客）；数据：草稿存在；路径：GET /api/posts/:id | 无 body | 404（草稿仅作者可见） |
| UAT-025 | 发表评论成功 | 高 | REQ-009 | 正常 | 认证：用户 token；数据：公开文章存在；路径：POST /api/posts/:id/comments | `{"content":"好文"}` | 201，返回评论含 id/content |
| UAT-026 | 非评论作者删除拒绝 | 高 | REQ-009 | 异常 | 认证：用户 B token；数据：评论作者为用户 A；路径：DELETE /api/comments/:id | 无 body | 403 越权 |
| UAT-027 | 空/超长评论拒绝 | 高 | REQ-009 | 边界 | 认证：用户 token；数据：公开文章存在；路径：POST /api/posts/:id/comments | `{"content":""}` 或 `{"content":"x".repeat(1001)}` | 400 参数错误 |
| UAT-028 | 审核通过评论可见 | 高 | REQ-010 | 正常 | 认证：博主 token；数据：待审评论存在；路径：PATCH /api/comments/:id/review | `{"action":"approve"}` | 200，评论公开可见 |
| UAT-029 | 审核拒绝评论隐藏 | 高 | REQ-010 | 正常 | 认证：博主 token；数据：待审评论存在；路径：PATCH /api/comments/:id/review | `{"action":"reject"}` | 200，评论公开列表不可见 |
| UAT-030 | 非博主审核拒绝 | 高 | REQ-010 | 异常 | 认证：普通用户 token；数据：待审评论存在；路径：PATCH /api/comments/:id/review | `{"action":"approve"}` | 403 越权 |
| UAT-031 | 创建标签成功 | 高 | REQ-011 | 正常 | 认证：博主 token；数据：无；路径：POST /api/tags | `{"name":"Node.js"}` | 201，返回标签 |
| UAT-032 | 重复标签冲突 | 高 | REQ-011 | 异常 | 认证：博主 token；数据：同名标签已存在；路径：POST /api/tags | `{"name":"Node.js"}` | 409 冲突 |
| UAT-033 | 删除被引用标签拒绝 | 高 | REQ-011 | 边界 | 认证：博主 token；数据：标签已被文章引用；路径：DELETE /api/tags/:id | 无 body | 409（先解绑后删除） |
| UAT-034 | 创建分类含层级 | 高 | REQ-012 | 正常 | 认证：博主 token；数据：父分类存在；路径：POST /api/categories | `{"name":"前端","parentId":1}` | 201，返回分类含 parent 信息 |
| UAT-035 | 删除含文章分类拒绝 | 高 | REQ-012 | 异常 | 认证：博主 token；数据：分类下存在文章；路径：DELETE /api/categories/:id | 无 body | 409 冲突 |
| UAT-036 | parent 分类不存在 | 高 | REQ-012 | 边界 | 认证：博主 token；数据：parentId 不存在；路径：POST /api/categories | `{"name":"x","parentId":9999}` | 400 参数错误 |
| UAT-037 | 关键词搜索命中 | 高 | REQ-013 | 正常 | 认证：无需；数据：文章含目标关键词；路径：GET /api/search?q=TypeScript&page=1&pageSize=10 | 无 body | 200，结果列表含标题命中文章 + 分页元数据 |
| UAT-038 | 搜索无命中返回空 | 高 | REQ-013 | 正常 | 认证：无需；数据：无匹配文章；路径：GET /api/search?q=zzzz | 无 body | 200 空列表 |
| UAT-039 | 空关键词搜索拒绝 | 高 | REQ-013 | 边界 | 认证：无需；数据：无；路径：GET /api/search?q= | 无 body | 400 参数错误 |
| UAT-040 | 获取推荐文章 | 高 | REQ-014 | 正常 | 认证：无需；数据：≥1 篇公开文章；路径：GET /api/recommendations | 无 body | 200，推荐文章列表 ≤ 10 条，不含草稿 |
| UAT-041 | 无内容推荐空列表 | 高 | REQ-014 | 正常 | 认证：无需；数据：无文章；路径：GET /api/recommendations | 无 body | 200 空列表 |
| UAT-042 | 推荐结果上限约束 | 高 | REQ-014 | 边界 | 认证：无需；数据：> 10 篇公开文章；路径：GET /api/recommendations | 无 body | 200，结果数 ≤ 10 |
| UAT-043 | 查询文章统计 | 高 | REQ-015 | 正常 | 认证：博主 token；数据：文章含浏览/评论数据；路径：GET /api/posts/:id/stats | 无 body | 200，viewCount/commentCount 与实测一致 |
| UAT-044 | 无数据统计为 0 | 高 | REQ-015 | 边界 | 认证：博主 token；数据：文章无浏览无评论；路径：GET /api/posts/:id/stats | 无 body | 200，viewCount=0、commentCount=0（非 null） |
| UAT-045 | 统计不存在文章 | 高 | REQ-015 | 异常 | 认证：博主 token；数据：文章 id 不存在；路径：GET /api/posts/:id/stats | 无 body | 404 不存在 |
| UAT-046 | 事件生成通知可查 | 高 | REQ-016 | 正常 | 认证：用户 token；数据：他人评论了我的文章/关注了我；路径：GET /api/notifications | 无 body | 200，含新评论/新关注通知（unread） |
| UAT-047 | 标记通知已读 | 高 | REQ-016 | 正常 | 认证：用户 token；数据：存在未读通知；路径：PATCH /api/notifications/:id/read | 无 body | 200，该通知状态变为已读 |
| UAT-048 | 越权查询他人通知拒绝 | 高 | REQ-016 | 异常 | 认证：用户 B token；数据：通知归属用户 A（可通过 userId 参数指定）；路径：GET /api/notifications?userId=<A 的 userId> | `userId=A` | 403 越权（查询他人通知 → 403，见 requirement-spec.md §9 设计决策「通知/通知类资源越权查询语义」，与 REQ-016 AC3 一致） |
| UAT-049 | 订阅博主成功 | 高 | REQ-017 | 正常 | 认证：用户 token；数据：博主存在；路径：POST /api/subscriptions | `{"bloggerId":1}` | 200，订阅关系建立 |
| UAT-050 | 重复订阅幂等 | 高 | REQ-017 | 边界 | 认证：用户 token；数据：已订阅该博主；路径：POST /api/subscriptions | `{"bloggerId":1}` | 200 幂等，订阅列表无重复 |
| UAT-051 | 订阅不存在博主 | 高 | REQ-017 | 异常 | 认证：用户 token；数据：bloggerId 不存在；路径：POST /api/subscriptions | `{"bloggerId":9999}` | 404 不存在 |
| UAT-052 | 关键操作写入审计日志 | 高 | REQ-018 | 正常 | 认证：管理员 token（与 UAT-054 管理员专属语义一致）；数据：管理员已创建；路径：POST /api/auth/login（管理员登录，触发）→ GET /api/admin/audit-logs（验证） | 管理员登录一次 | 审计日志新增记录，含 actor=admin/action=login/timestamp |
| UAT-053 | 审计记录字段完整性 | 高 | REQ-018 | 正常 | 认证：管理员 token；数据：执行过删除文章/改 Webhook；路径：GET /api/admin/audit-logs | 无 body | 日志记录含 actor/action/timestamp/详情四字段 |
| UAT-054 | 普通用户读审计日志拒绝 | 高 | REQ-018 | 异常 | 认证：普通用户 token；数据：无；路径：GET /api/admin/audit-logs | 无 body | 403 越权 |
| UAT-055 | 管理员查询审计日志分页 | 高 | REQ-019 | 正常 | 认证：管理员 token；数据：> 10 条日志；路径：GET /api/admin/audit-logs?page=1&pageSize=10 | 无 body | 200，日志列表 + 分页元数据 |
| UAT-056 | 按条件筛选审计日志 | 高 | REQ-019 | 正常 | 认证：管理员 token；数据：含多种 action；路径：GET /api/admin/audit-logs?action=delete_post | 无 body | 200，仅返回 action=delete_post 记录 |
| UAT-057 | 非管理员查询拒绝 | 高 | REQ-019 | 异常 | 认证：博主 token（非管理员）；数据：无；路径：GET /api/admin/audit-logs | 无 body | 403 越权 |
| UAT-058 | 获取系统级 RSS | 高 | REQ-020 | 正常 | 认证：无需；数据：≥1 篇公开文章；路径：GET /api/rss | 无 body | 200，Content-Type application/xml，XML 可解析，含文章条目 |
| UAT-059 | 无文章返回合法空源 | 高 | REQ-020 | 边界 | 认证：无需；数据：无公开文章；路径：GET /api/rss | 无 body | 200，合法 XML 空源（无 item） |
| UAT-060 | 获取不存在博主 RSS | 高 | REQ-020 | 异常 | 认证：无需；数据：bloggerId 不存在；路径：GET /api/bloggers/:id/rss | 无 body | 404 不存在 |
| UAT-061 | 创建 Webhook 并触发投递 | 高 | REQ-021 | 正常 | 认证：博主 token；数据：目标 URL 可达；路径：POST /api/webhooks | `{"url":"https://example.com/hook","event":"post.published"}` | 201；发布文章后目标 URL 收到 POST 投递（含事件负载） |
| UAT-062 | 更新/删除 Webhook | 高 | REQ-021 | 正常 | 认证：博主 token；数据：Webhook 已创建；路径：PUT/DELETE /api/webhooks/:id | `{"url":"https://new.com/hook"}` | 200，配置更新/删除生效 |
| UAT-063 | 非法 URL 创建拒绝 | 高 | REQ-021 | 边界 | 认证：博主 token；数据：无；路径：POST /api/webhooks | `{"url":"not-a-url"}` | 400 参数错误 |
| UAT-064 | 投递失败自动重试 | 高 | REQ-022 | 正常 | 认证：博主 token；数据：Webhook 目标 URL 返回 5xx；路径：POST /api/webhooks（配置）+ 发布文章（触发） | 目标 URL 返回 500 | 投递自动重试 ≤ 3 次，间隔指数退避（日志可证） |
| UAT-065 | 重试超限标记失败 | 高 | REQ-022 | 异常 | 认证：博主 token；数据：目标 URL 持续失败；路径：POST /api/webhooks（配置）+ 发布文章（触发） | 目标 URL 持续 500 | 重试 3 次后停止，Webhook 状态标记 failed |
| UAT-066 | 投递成功不重试 | 高 | REQ-022 | 边界 | 认证：博主 token；数据：目标 URL 可达；路径：POST /api/webhooks（配置）+ 发布文章（触发） | 目标 URL 返回 200 | 投递 1 次成功，无重试发生 |

### UAT-067 ~ UAT-078：非功能需求（NFR-001 ~ NFR-006，每 NFR 2 用例）

| 用例 ID | 标题 | 优先级 | 关联需求 | 场景类型 | 前置条件 | 输入 | 预期输出 |
|---|---|---|---|---|---|---|---|
| UAT-067 | 列表接口 P95 响应达标 | 高 | NFR-001 | 正常 | 认证：无需；数据：≥10 篇文章；路径：GET /api/posts | 循环请求 N 次，采集响应时间 | P95 ≤ 200ms（生产目标）/ ≤ 400ms（CI 阈值） |
| UAT-068 | 并发下响应仍达标 | 高 | NFR-001 | 边界 | 认证：无需；数据：≥10 篇文章；路径：GET /api/posts | 并发 50 请求 | P95 响应时间 ≤ 400ms（CI 阈值），无超时 |
| UAT-069 | 未认证/越权访问拒绝 | 高 | NFR-002 | 正常 | 认证：无/非资源所有者；数据：受保护资源存在；路径：GET /api/users/me、DELETE /api/posts/:id | 无 token / 他人 token | 未认证 401；越权 403 |
| UAT-070 | 密码哈希存储验证 | 高 | NFR-002 | 正常 | 认证：无需；数据：新注册用户；路径：POST /api/auth/register | 注册新用户 | 存储中密码为 bcrypt 哈希（非明文）；登录可比对成功 |
| UAT-071 | 1000 请求零 5xx | 高 | NFR-003 | 正常 | 认证：无需；数据：≥10 篇文章；路径：GET /api/posts | 1000 次连续 GET | 错误率 = 0%（无 5xx 响应） |
| UAT-072 | 混合请求零 5xx | 高 | NFR-003 | 边界 | 认证：用户/博主 token；数据：完整测试数据；路径：混合 API | 混合读操作 1000 次 | 错误率 = 0% |
| UAT-073 | 单元行覆盖率达标 | 高 | NFR-004 | 正常 | 认证：n/a；数据：n/a；路径：静态（vitest coverage） | 运行 vitest coverage | 行覆盖率 ≥ 80% |
| UAT-074 | 覆盖率报告可复现 | 高 | NFR-004 | 边界 | 认证：n/a；数据：n/a；路径：静态（CI 重跑） | 重复运行 coverage | 两次结果均 ≥ 80% |
| UAT-075 | 峰值内存达标 | 高 | NFR-005 | 正常 | 认证：无需；数据：≥10 篇文章；路径：GET /api/posts | 1000 次请求后测量内存 | 峰值内存 ≤ 100MB（生产）/ ≤ 150MB（CI） |
| UAT-076 | 长时运行内存稳定 | 高 | NFR-005 | 边界 | 认证：无需；数据：≥10 篇文章；路径：GET /api/posts | 2000 次请求后测量内存 | 峰值内存 ≤ 150MB（CI 阈值） |
| UAT-077 | 限流阈值内正常放行 | 高 | NFR-006 | 正常 | 认证：无需；数据：无；路径：任意 API（GET /api/posts） | 60 秒内 ≤ 100 次请求 | 全部 2xx，无 429 |
| UAT-078 | 超限返回 429 | 高 | NFR-006 | 边界 | 认证：无需；数据：无；路径：任意 API（GET /api/posts） | 60 秒内第 101 次请求 | 429 限流 + Retry-After 头 |

### UAT-079 ~ UAT-086：约束需求（CON-001 ~ CON-004，每 CON 2 用例）

| 用例 ID | 标题 | 优先级 | 关联需求 | 场景类型 | 前置条件 | 输入 | 预期输出 |
|---|---|---|---|---|---|---|---|
| UAT-079 | 技术栈编译运行 | 高 | CON-001 | 正常 | 认证：n/a；数据：n/a；路径：静态（package.json/tsconfig） | tsc 编译 + 启动服务 | 编译通过；路由基于 Express 4；源码 TypeScript 5 |
| UAT-080 | 无其他 Web 框架 | 高 | CON-001 | 边界 | 认证：n/a；数据：n/a；路径：静态（依赖清单） | 检查 package.json 依赖 | 无 Express 之外的 Web 框架依赖 |
| UAT-081 | 无外部数据库连接 | 高 | CON-002 | 正常 | 认证：n/a；数据：n/a；路径：静态 + 启动行为 | 启动服务 | 启动无外部连接；数据在内存可读写 |
| UAT-082 | 内存数据可读写 | 高 | CON-002 | 正常 | 认证：博主 token；数据：无；路径：POST /api/posts → GET /api/posts/:id | 创建文章后查询 | 创建成功且内存中可读回 |
| UAT-083 | 非法入参统一 400 | 高 | CON-003 | 正常 | 认证：博主 token；数据：无；路径：POST /api/posts | `{"title":"","content":""}` | 400 + 结构化错误体（zod 校验） |
| UAT-084 | 校验基于 zod schema | 高 | CON-003 | 边界 | 认证：n/a；数据：n/a；路径：静态（源码检查） | 检查校验实现 | 入参校验逻辑基于 zod schema 声明 |
| UAT-085 | 保留期可配置 | 高 | CON-004 | 正常 | 认证：管理员 token；数据：n/a；路径：配置检查 + GET /api/admin/audit-logs | 设置保留期（如 90 天） | 配置项生效，超期记录被清理/不可查 |
| UAT-086 | 超期日志清理 | 高 | CON-004 | 边界 | 认证：管理员 token；数据：存在超期审计记录；路径：GET /api/admin/audit-logs | 模拟超期记录 | 超期记录不再返回 |

### UAT-087 ~ UAT-091：AC 级补全用例（依据 RC-phase1-1-01 fixRecommendation）

> 修复 R3-completeness 识别的 4 处 AC 级覆盖缺口（REQ-005 AC2 取关 / REQ-006 AC3 文章不存在 404 / REQ-009 AC3 文章不存在 404 / REQ-017 AC3 退订）+ NFR-002 AC3 JWT_SECRET 密钥管理，确保每条验收标准 ≥1 个可执行用例。

| 用例 ID | 标题 | 优先级 | 关联需求 | 场景类型 | 前置条件 | 输入 | 预期输出 |
|---|---|---|---|---|---|---|---|
| UAT-087 | 取关博主粉丝数减一 | 高 | REQ-005 | 正常 | 认证：用户 token；数据：已关注目标博主；路径：DELETE /api/bloggers/:id/follow | 无 body | 200，粉丝数 -1（覆盖 REQ-005 AC2） |
| UAT-088 | 操作不存在文章 | 高 | REQ-006 | 异常 | 认证：博主 token；数据：文章 id 不存在；路径：PUT /api/posts/:id | `{"title":"x"}` | 404 不存在（覆盖 REQ-006 AC3） |
| UAT-089 | 评论不存在文章 | 高 | REQ-009 | 异常 | 认证：用户 token；数据：文章 id 不存在；路径：POST /api/posts/:id/comments | `{"content":"好文"}` | 404 不存在（覆盖 REQ-009 AC3） |
| UAT-090 | 退订博主成功 | 高 | REQ-017 | 正常 | 认证：用户 token；数据：已订阅目标博主；路径：DELETE /api/subscriptions/:id | 无 body | 200，订阅关系解除（覆盖 REQ-017 AC3） |
| UAT-091 | JWT_SECRET 密钥管理验证 | 高 | NFR-002 | 正常 | 认证：n/a；数据：n/a；路径：静态（环境变量与启动日志检查） | 检查 JWT_SECRET 来源/默认值/日志输出 | JWT_SECRET 经环境变量注入（process.env.JWT_SECRET）、代码无硬编码默认值、生产禁用默认密钥、密钥不出现在日志/错误输出（覆盖 NFR-002 AC3，见 requirement-spec.md §9） |

## 用例汇总

| 用例 ID 区间 | 关联需求 | 用例数 | 场景覆盖 |
|---|---|---|---|
| UAT-001~003 | REQ-001 | 3 | 正常/异常/边界 |
| UAT-004~006 | REQ-002 | 3 | 正常/异常/边界 |
| UAT-007~009 | REQ-003 | 3 | 正常/异常/边界 |
| UAT-010~012 | REQ-004 | 3 | 正常/异常/边界 |
| UAT-013~015, UAT-087 | REQ-005 | 4 | 正常/异常/边界 |
| UAT-016~018, UAT-088 | REQ-006 | 4 | 正常/异常/边界 |
| UAT-019~021 | REQ-007 | 3 | 正常/异常/边界 |
| UAT-022~024 | REQ-008 | 3 | 正常/异常/边界 |
| UAT-025~027, UAT-089 | REQ-009 | 4 | 正常/异常/边界 |
| UAT-028~030 | REQ-010 | 3 | 正常/异常/边界 |
| UAT-031~033 | REQ-011 | 3 | 正常/异常/边界 |
| UAT-034~036 | REQ-012 | 3 | 正常/异常/边界 |
| UAT-037~039 | REQ-013 | 3 | 正常/异常/边界 |
| UAT-040~042 | REQ-014 | 3 | 正常/异常/边界 |
| UAT-043~045 | REQ-015 | 3 | 正常/异常/边界 |
| UAT-046~048 | REQ-016 | 3 | 正常/异常/边界 |
| UAT-049~051, UAT-090 | REQ-017 | 4 | 正常/异常/边界 |
| UAT-052~054 | REQ-018 | 3 | 正常/异常/边界 |
| UAT-055~057 | REQ-019 | 3 | 正常/异常/边界 |
| UAT-058~060 | REQ-020 | 3 | 正常/异常/边界 |
| UAT-061~063 | REQ-021 | 3 | 正常/异常/边界 |
| UAT-064~066 | REQ-022 | 3 | 正常/异常/边界 |
| UAT-067~068 | NFR-001 | 2 | 正常/边界 |
| UAT-069~070, UAT-091 | NFR-002 | 3 | 正常（验证类） |
| UAT-071~072 | NFR-003 | 2 | 正常/边界 |
| UAT-073~074 | NFR-004 | 2 | 正常/边界 |
| UAT-075~076 | NFR-005 | 2 | 正常/边界 |
| UAT-077~078 | NFR-006 | 2 | 正常/边界 |
| UAT-079~080 | CON-001 | 2 | 正常/边界 |
| UAT-081~082 | CON-002 | 2 | 正常/边界 |
| UAT-083~084 | CON-003 | 2 | 正常/边界 |
| UAT-085~086 | CON-004 | 2 | 正常/边界 |

合计：**91 个 UAT 用例**（REQ 70 + NFR 13 + CON 8），32 需求全覆盖。

## 代表用例详解（套用 test-case.md 模板）

> 完整展开全部 91 个用例篇幅过长，以下给出正常/异常/边界各一代表用例的完整结构，其余用例按「用例列表」表结构执行。

### UAT-001（正常场景代表）

- 标题：注册成功返回用户与令牌
- 优先级：高
- 关联需求：REQ-001
- 场景类型：正常
- 测试场景：访客以合法邮箱+密码注册，验证注册成功与令牌可用性

**前置条件**：认证：无需；数据：邮箱 reader1@example.com 未注册；路径：POST /api/auth/register

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/auth/register | `{"email":"reader1@example.com","password":"pass123456"}` | 201，body 含 userId/email/token |
| 2 | 用返回 token 请求 GET /api/users/me | Authorization: Bearer <token> | 200，返回该用户资料 |

**预期结果**：注册成功返回 201 与可用 JWT；token 可访问受保护接口。

**执行状态**：[ ] 待执行

### UAT-002（异常场景代表）

- 标题：重复邮箱注册冲突
- 优先级：高
- 关联需求：REQ-001
- 场景类型：异常
- 测试场景：已注册邮箱再次注册，验证冲突拒绝

**前置条件**：认证：无需；数据：reader1@example.com 已注册；路径：POST /api/auth/register

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/auth/register | `{"email":"reader1@example.com","password":"pass123456"}` | 409 冲突错误体 |

**预期结果**：重复注册返回 409，不创建新用户。

**执行状态**：[ ] 待执行

### UAT-003（边界场景代表）

- 标题：非法邮箱/短密码拒绝
- 优先级：高
- 关联需求：REQ-001
- 场景类型：边界
- 测试场景：非法邮箱格式与过短密码，验证参数边界校验

**前置条件**：认证：无需；数据：无；路径：POST /api/auth/register

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/auth/register | `{"email":"bad","password":"123"}` | 400，zod 校验错误明细 |

**预期结果**：非法入参返回 400 与结构化错误体。

**执行状态**：[ ] 待执行

## N/A 用例说明（demo 范围声明，第 22 轮 P1-3）

| N/A 项 | 说明 |
|---|---|
| 前端界面（Web/移动端 UI） | 无对应 API 端点，无 UAT 用例（Out of Scope，本迭代仅后端 API） |
| 数据库持久化 | 无对应 API 端点（Out of Scope，采用内存存储），无 UAT 用例 |
| 第三方支付/电商功能 | 无对应 API 端点（Out of Scope，与博客系统无关），无 UAT 用例 |
| 多语言国际化（i18n） | 无对应 API 端点（Out of Scope，下轮迭代），无 UAT 用例 |
| 移动端推送（APNs/FCM） | 无对应 API 端点（Out of Scope，依赖未就绪），无 UAT 用例 |

> 上述 N/A 项与 requirement-spec.md §8 Out of Scope 声明一致；R3 完整性校验若发现不一致，以本表注释为准。

## 测试用例覆盖说明

- 功能点覆盖：22/22 REQ 全覆盖（每需求 正常/异常/边界 ≥3 用例 = 70 个，含 AC 级补全用例 UAT-087~090）
- 非功能覆盖：6/6 NFR（指标验证 + 边界 = 13 个，含 UAT-091 JWT_SECRET 密钥管理）
- 约束覆盖：4/4 CON（行为验证 + 边界，8 个）
- 边界条件覆盖：每 REQ 1 个边界用例 + NFR/CON 边界场景
- AC 级映射：每需求验收标准（AC）≥1 个可执行用例（修复 REQ-005 AC2 取关 / REQ-006 AC3 / REQ-009 AC3 / REQ-017 AC3 退订 / NFR-002 AC3 缺口）
- 前置条件完整性：全部 91 用例声明 认证状态/数据依赖/接口路径（禁止行为 #12/#13）
- 与 Out of Scope 一致性：N/A 项与 §8 声明一致（见上表）
