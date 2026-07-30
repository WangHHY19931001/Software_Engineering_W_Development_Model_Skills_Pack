# 系统测试设计（System Test Design）

> 阶段 2（系统设计）同步产出。W 模型第 23 轮（2026-07-30）端到端调测。
> 套用 `w-model-dev/templates/test-case.md` 模板，`type=系统测试`，执行阶段 = 阶段 7。
>
> **设计原则**：
> 1. **22 SD 至少 1 个 ST**：每个 SD 至少 1 个系统测试用例。
> 2. **五大类全覆盖**：性能（Performance）/ 安全（Security）/ 可靠性（Reliability）/ 内存（Memory）/ E2E（End-to-End）每类至少 1 个 ST。
> 3. **测试 seam 统一**：HTTP API（supertest）为最高 seam；k6 独立进程用于性能/可靠性/内存。
> 4. **可量化验收**：每个 ST 须含可量化的 P95 / 错误率 / 内存阈值 / 状态码断言。
> 5. **覆盖 NFR**：所有 ST 至少挂载 1 个 NFR 或 CON。
> 6. **TC-DES-007/008/009 必含**：端到端流程（ST-007）/ 性能基线（ST-006）/ 安全基线（ST-013）必须显式包含。

## 文档信息

- 项目名称：扩展博客系统后端（blog-system-demo）
- 测试类型：系统测试（System Test）
- 设计来源阶段：阶段 2（系统设计）
- 执行阶段：阶段 7（系统测试）
- 文档版本：v1.0.0
- 编制日期：2026-07-30
- 编制者：S-doc 子代理
- 关联设计：`docs/phase2-design/system-design.md`
- 关联需求：`docs/phase1-requirements/requirement-spec.md`
- 关联验收：`docs/phase1-requirements/acceptance-test-design.md`
- 关联 UAT 映射：`docs/uat-path-mapping.md`
- ST 总数：22（ST-001 ~ ST-022）
- 覆盖 SD 数：22（22/22 = 100%）
- 五大类覆盖：5/5 = 100%

## 全局约定

### 测试环境
- Node.js 20+
- 进程启动：`app.listen(0)` 随机端口（避免冲突）
- 端口监听后立即可被 k6/supertest 访问
- 测试数据通过 `resetAllRepositories()` 重置（CON-002 内存约束）

### 测试数据约定
- 唯一识别：每 ST 内嵌固定 seed 数据，避免依赖其他 ST 副作用
- JWT：`JWT_SECRET=test-secret-blog-demo`（与 package.json scripts 一致）
- 限流豁免：所有 ST 请求头加 `x-test-bypass-rate-limit: true`（NFR-005 约定）
- 时间：`vi.useFakeTimers()` 或 `Date.now()` mock 控制审计 90 天边界、Token 过期、广告 startAt/endAt
- Webhook 模拟：`nock` 拦截 HTTP 出站回调

### 性能基线（NFR-001）
- 数据集：1000 博文 + 5000 评论 + 1000 用户
- 压测工具：k6 100/1000 并发
- 验收：P95 ≤ 200ms（核心读 API）

### 内存基线（NFR-002）
- 1000 并发稳定运行 5 分钟
- 验收：`process.memoryUsage().heapUsed` ≤ 100MB

### 可靠性基线（NFR-004）
- 1000 并发同一健康 endpoint
- 验收：5xx 错误计数 = 0；超时阈值 30s

### 限流基线（NFR-005）
- 单 IP 第 101 次请求返回 429 + `Retry-After: 60`
- 验收：滑动窗口；`/health` 豁免

### 安全基线（NFR-003）
- JWT 必填端点未带 token → 401
- 跨用户操作 → 403
- 注入 payload → 400 + VALIDATION_FAILED

---

## ST-001 用户认证服务（SD-001）

**ST ID**：ST-001
**标题**：100 并发登录 P95 ≤ 200ms + 错密码脱敏
**优先级**：高
**关联设计**：SD-001
**关联 REQ**：REQ-001, REQ-002
**关联 NFR**：NFR-001（性能）, NFR-003（安全）
**类型**：性能 + 安全
**测试场景**：验证 100 并发登录场景下响应时间满足 P95 ≤ 200ms；同时验证错密码场景下不泄露账号存在性。

### 前置条件
- 1000 用户种子数据预创建（`resetAllRepositories()` + seed）
- `JWT_SECRET=test-secret-blog-demo`
- 所有请求带 `x-test-bypass-rate-limit: true`

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 启动 app.listen(0) | — | 端口可访问 |
| 2 | 100 并发 POST /auth/login（正确凭证） | `{email: 'u1@test.com', password: 'P@ssw0rd123'}` × 100 | 200 + `{token, userId, role}` |
| 3 | 测量 P95 响应时间 | k6 http_req_duration P95 | P95 ≤ 200ms |
| 4 | 100 并发 POST /auth/login（错误密码） | `{email: 'u1@test.com', password: 'wrong'}` × 100 | 401 + `{error: {code: 'INVALID_CREDENTIALS', message: '邮箱或密码错误'}}` |
| 5 | 100 并发 POST /auth/login（不存在邮箱） | `{email: 'none@test.com', password: 'whatever'}` × 100 | 401 + 同上（不区分账号存在） |
| 6 | 比对步骤 4 和 步骤 5 响应 body | — | 完全相同（不区分"账号不存在"与"密码错误"） |
| 7 | 测量步骤 4 平均响应时间 | — | ≈ 步骤 2（防止时间侧信道） |

### 预期结果
- 步骤 3 P95 ≤ 200ms
- 步骤 4/5 响应 body 完全一致
- 步骤 4 平均响应时间 ≈ 步骤 2（防止时间侧信道泄露账号存在性）
- 步骤 2 错误率 = 0%（NFR-004 可靠性）
- JWT 载荷 `{sub, role: 'reader', iat, exp}`，exp - iat = 86400

### 验收
- P95 ≤ 200ms（NFR-001）
- 错误响应脱敏（NFR-003）
- 100 并发 0 错误（NFR-004）

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-002 用户资料服务（SD-002）

**ST ID**：ST-002
**标题**：reader 修改资料 → 公开接口可见
**优先级**：中
**关联设计**：SD-002
**关联 REQ**：REQ-003
**关联 NFR**：NFR-003
**类型**：E2E
**测试场景**：reader 修改自己资料后，匿名访客可通过公开接口看到新资料；同时验证邮箱与 passwordHash 不可见。

### 前置条件
- 预创建 user `u1@test.com`（displayName='Alice'）
- 持有有效 JWT

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | PUT /users/me 修改资料 | JWT + `{displayName: 'NewName', bio: 'new bio', avatarUrl: 'https://new'}` | 200 + `{userId, displayName: 'NewName', bio: 'new bio', avatarUrl: 'https://new'}` |
| 2 | 尝试修改 email | JWT + `{email: 'evil@test.com'}` | 400 + `{error: {code: 'EMAIL_NOT_MODIFIABLE'}}` |
| 3 | 匿名 GET /users/:id | 无 token + path=u1.userId | 200 + `{userId, username, displayName: 'NewName', bio: 'new bio', avatarUrl: 'https://new', createdAt}` |
| 4 | 验证步骤 3 响应不包含 email | — | 响应 body 无 `email` 字段 |
| 5 | 验证步骤 3 响应不包含 passwordHash | — | 响应 body 无 `passwordHash` 字段 |
| 6 | 验证步骤 1 触发 audit | GET /admin/audit-logs?actor=u1.userId&type=user.profile.updated | 200 + 包含 1 条 audit log |

### 预期结果
- 资料修改成功
- email 不可修改
- 公开接口不返回敏感字段
- audit log 写入

### 验收
- 200 OK + 修改字段生效
- 敏感字段过滤（NFR-003）
- 审计写入（CON-004）

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-003 关注服务（SD-003）

**ST ID**：ST-003
**标题**：1000 并发关注/取关幂等 0 错误
**优先级**：高
**关联设计**：SD-003
**关联 REQ**：REQ-004
**关联 NFR**：NFR-004
**类型**：可靠性
**测试场景**：1000 并发关注/取关同一博主，验证幂等性 + 0 错误率。

### 前置条件
- 预创建 1 个 blogger（`b1`）和 1000 个 reader
- 1000 reader 各自持有有效 JWT

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 1000 并发 POST /follows/b1.bloggerId | 1000 个不同 reader 的 JWT | 200 + `{followed: true}` × 1000 |
| 2 | 验证步骤 1 错误率 | k6 200 状态码比例 | 100%（NFR-004） |
| 3 | 1000 并发 POST /follows/b1.bloggerId（重复关注） | 同 1000 个 reader JWT | 200 + `{followed: true}`（幂等） |
| 4 | GET /me/follows 任一 reader | reader1 JWT | 200 + items 包含 b1.bloggerId |
| 5 | 1000 并发 DELETE /follows/b1.bloggerId | 同 1000 个 reader JWT | 200 + `{followed: false}` × 1000 |
| 6 | GET /me/follows 同 reader1 | reader1 JWT | 200 + items 不包含 b1.bloggerId |
| 7 | 1000 并发 DELETE（重复取关） | 同 1000 个 reader JWT | 200 + `{followed: false}`（幂等） |

### 预期结果
- 所有步骤 200 OK
- 步骤 1/3 关注记录数 = 1
- 步骤 5/7 关注记录数 = 0
- 步骤 1 错误率 = 0%（NFR-004）

### 验收
- 1000 并发 0 错误（NFR-004）
- 关注/取关幂等

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-004 博主注册与多博主切换（SD-004）

**ST ID**：ST-004
**标题**：blogger 注册 → 登录 → 多博主切换
**优先级**：高
**关联设计**：SD-004
**关联 REQ**：REQ-005, REQ-017
**关联 NFR**：NFR-006
**类型**：E2E
**测试场景**：完整覆盖 blogger 身份生命周期，含多博主切换。

### 前置条件
- `resetAllRepositories()`

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /bloggers 注册 | `{email: 'b1@test.com', username: 'b1', password: 'P@ssw0rd123'}` | 201 + `{bloggerId, role: 'blogger'}` |
| 2 | 验证 passwordHash | — | bcrypt.getRounds ≥ 10（NFR-006） |
| 3 | POST /auth/login 登录 | `{email: 'b1@test.com', password: 'P@ssw0rd123'}` | 200 + `{token, userId, role: 'blogger'}` |
| 4 | 验证 JWT payload | — | `{sub: bloggerId, role: 'blogger'}` |
| 5 | POST /me/bloggers/:id/switch | reader JWT + path=bloggerId | 200 + `{token, bloggerId, role: 'blogger'}` |
| 6 | 验证新 JWT | — | payload.sub === bloggerId（新 token） |
| 7 | 重复切换 | 同上 | 200 + 新 token（幂等） |
| 8 | 切换未绑定的 bloggerId | reader JWT + path=其他 user 的 bloggerId | 403 + `{error: {code: 'FORBIDDEN_NOT_OWNER'}}` |

### 预期结果
- 全流程 200/201
- 多博主切换正确改变 JWT sub
- 未绑定切换被拒绝

### 验收
- REQ-005 + REQ-017 全部满足
- NFR-006 cost ≥ 10

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-005 博文生命周期服务（SD-005）

**ST ID**：ST-005
**标题**：1000 并发博文 CRUD 0 错误 + 状态机正确性
**优先级**：高
**关联设计**：SD-005
**关联 REQ**：REQ-006
**关联 NFR**：NFR-001, NFR-004
**类型**：可靠性 + E2E
**测试场景**：1000 并发博文 CRUD 验证 0 错误率，同时验证 draft↔published 状态机正确性。

### 前置条件
- 预创建 1000 个 blogger（`b1` ~ `b1000`）各持有 JWT
- `resetAllRepositories()`

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 1000 并发 POST /posts | 各 blogger JWT + `{title, content, tags: ['t1']}` | 201 × 1000；status='draft' |
| 2 | 1000 并发 POST /posts/:id/publish | 各 blogger JWT | 200 × 1000；status='published' |
| 3 | 步骤 2 错误率 | — | 0%（NFR-004） |
| 4 | 尝试发布正文为空的草稿 | blogger JWT + 创建空内容 draft + POST /posts/:id/publish | 400 + `{error: {code: 'EMPTY_CONTENT', message: '博文正文不能为空'}}` |
| 5 | 1000 并发 PUT /posts/:id 修改 | 各 blogger JWT + `{content: 'updated'}` | 200 × 1000 |
| 6 | 1000 并发 DELETE /posts/:id | 各 blogger JWT | 204 × 1000；status='deleted' |
| 7 | 验证步骤 6 后 GET /posts/:id | 匿名 | 404 + `{error: {code: 'POST_NOT_FOUND'}}` |
| 8 | 跨 blogger 修改 | b2 JWT 修改 b1 的 post | 403 + `{error: {code: 'FORBIDDEN_NOT_OWNER'}}` |
| 9 | 验证 audit log 数量 | GET /admin/audit-logs?type=post.published | 1000 条 post.published |

### 预期结果
- 1000 并发 CRUD 0 错误
- 状态机正确（draft→published→deleted）
- 跨用户操作被拒绝
- 审计全量记录

### 验收
- NFR-001 性能（间接）
- NFR-004 0 错误
- REQ-006 状态机正确

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-006 博文浏览服务（SD-006）

**ST ID**：ST-006
**标题**：1000 并发 GET /posts P95 ≤ 200ms（NFR-001 性能基线）
**优先级**：高
**关联设计**：SD-006
**关联 REQ**：REQ-007
**关联 NFR**：NFR-001
**类型**：性能
**测试场景**：1000 并发 GET /posts 验证 P95 ≤ 200ms；TC-DES-008 性能基线。

### 前置条件
- 1000 博文种子数据（全部 published）
- 1000 comments + 5000 access_records + 1000 notifications（噪声）
- `resetAllRepositories()` + seed

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 启动 app.listen(0) | — | 端口可访问 |
| 2 | 100 并发 GET /posts?page=1&pageSize=20 k6 持续 30s | — | 持续 200 OK |
| 3 | 测量 P95 | k6 http_req_duration | P95 ≤ 200ms（NFR-001） |
| 4 | 测量 P99 | k6 http_req_duration | P99 ≤ 350ms |
| 5 | 1000 并发 GET /posts/:id（不同 post） | — | 200 × 1000；0 错误（NFR-004） |
| 6 | 测量步骤 5 P95 | — | P95 ≤ 200ms |
| 7 | pageSize=200 边界 | — | 400 + `{error: {code: 'INVALID_PAGINATION'}}` |
| 8 | GET /posts?status=draft | — | 仅返回 published（draft 不可见） |

### 预期结果
- P95 ≤ 200ms
- 1000 并发 0 错误
- 边界 pageSize 校验
- draft 不可见

### 验收
- NFR-001 P95 ≤ 200ms
- NFR-004 0 错误
- REQ-007 分页 + 状态过滤

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-007 互动服务（SD-007）

**ST ID**：ST-007
**标题**：点赞/收藏幂等 + 通知触发（端到端 TC-DES-007）
**优先级**：高
**关联设计**：SD-007, SD-011（联动）
**关联 REQ**：REQ-008, REQ-011
**关联 NFR**：NFR-004
**类型**：E2E
**测试场景**：跨模块端到端验证。reader 点赞博文 → 触发通知给博主；收藏幂等。

### 前置条件
- 预创建 blogger `b1` + reader `r1` + post `p1`（published by b1）
- r1 持有 JWT

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | r1 点赞 p1 | POST /posts/p1.id/like | 200 + `{liked: true}` |
| 2 | r1 重复点赞 | POST /posts/p1.id/like | 200 + `{liked: true}`（幂等） |
| 3 | r1 收藏 p1 | POST /posts/p1.id/bookmark | 200 + `{bookmarked: true}` |
| 4 | r1 重复收藏 | POST /posts/p1.id/bookmark | 200 + `{bookmarked: true}`（幂等） |
| 5 | GET /me/bookmarks | r1 JWT | 200 + items 包含 p1 |
| 6 | b1 查通知 | GET /me/notifications?unreadOnly=true | 200 + items 包含 1 条 like notification |
| 7 | b1 标记已读 | PATCH /me/notifications/:id/read | 200 |
| 8 | GET /me/notifications?unreadOnly=true | b1 JWT | 200 + items 不包含已读 |
| 9 | 跨用户点赞验证 | r2 点赞 + 重复 10 次 | likes Set 大小 = 1（幂等去重） |

### 预期结果
- 点赞/收藏幂等
- 通知触发链路（点赞 → 通知 → 标记已读）正确
- likes Set 大小符合预期

### 验收
- REQ-008 幂等性
- REQ-011 通知触发
- TC-DES-007 端到端

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-008 标签服务（SD-008）

**ST ID**：ST-008
**标题**：标签关联幂等去重 + 反向查询
**优先级**：中
**关联设计**：SD-008
**关联 REQ**：REQ-012
**关联 NFR**：NFR-001
**类型**：E2E
**测试场景**：标签创建 + 多博文关联 + 幂等去重 + 反向查询。

### 前置条件
- 预创建 blogger `b1` + post `p1`（published by b1）
- b1 持有 JWT

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 创建标签 t1 | POST /tags + `{name: 't1'}` | 201 + `{name: 't1'}` |
| 2 | 重复创建 t1 | POST /tags + `{name: 't1'}` | 409 + `TAG_ALREADY_EXISTS` |
| 3 | 关联 t1 到 p1 | POST /posts/p1.id/tags + `{tags: ['t1', 't2']}` | 200 + tags=['t1','t2'] |
| 4 | 重复关联 t1 | POST /posts/p1.id/tags + `{tags: ['t1', 't3']}` | 200 + tags=['t1','t2','t3']（幂等去重） |
| 5 | 关联 6 个标签（超限） | `{tags: ['t1','t2','t3','t4','t5','t6']}` | 400 + `MAX_TAGS_EXCEEDED` |
| 6 | 解除 t1 | DELETE /posts/p1.id/tags/t1 | 204 |
| 7 | GET /tags/t2/posts | 匿名 | 200 + items 包含 p1 |
| 8 | 跨 blogger 关联 | b2 JWT 关联到 b1 的 p1 | 403 + `FORBIDDEN_NOT_OWNER` |
| 9 | 反向索引一致性 | GET /tags/t2/posts 多次 | 数量稳定 |

### 预期结果
- 标签创建唯一
- 关联幂等去重
- 上限 5 个校验
- 跨用户拒绝
- 反向索引准确

### 验收
- REQ-012 全部满足
- NFR-001 性能（反向查询 O(1)）

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-009 全文搜索服务（SD-009）

**ST ID**：ST-009
**标题**：1000 博文搜索 P95 ≤ 200ms + 0 错误
**优先级**：高
**关联设计**：SD-009
**关联 REQ**：REQ-013
**关联 NFR**：NFR-001, NFR-004
**类型**：性能 + 可靠性
**测试场景**：1000 博文 + 100 并发搜索 P95 ≤ 200ms，验证空关键词 400 + 标签过滤 + 标题权重。

### 前置条件
- 1000 博文种子数据（100 篇包含关键词 "TypeScript" 标题，500 篇包含 "TypeScript" 正文）
- `resetAllRepositories()` + seed

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | GET /search?q=TypeScript | — | 200 + items（标题命中排序优先） |
| 2 | 验证排序 | — | 标题包含的在前，正文包含的在后 |
| 3 | 100 并发 GET /search?q=TypeScript k6 30s | — | 200 OK |
| 4 | 测量 P95 | k6 | P95 ≤ 200ms（NFR-001） |
| 5 | 1000 并发 GET /search?q=TypeScript | — | 200 × 1000；0 错误（NFR-004） |
| 6 | GET /search?q=（空） | — | 400 + `EMPTY_KEYWORD` |
| 7 | GET /search （无 q） | — | 400 + `VALIDATION_FAILED` |
| 8 | GET /search?q=ts&tags=javascript | — | 200 + items 仅含 javascript 标签 |
| 9 | 验证草稿不可搜 | 搜索独有草稿标题 | items 不含草稿 |
| 10 | 标签 AND 过滤 | q + tags=a,b,c | items 同时含 a/b/c |

### 预期结果
- P95 ≤ 200ms
- 0 错误
- 标题权重生效
- 空关键词拒绝
- 标签 AND 过滤
- 仅 published 可搜

### 验收
- NFR-001 P95 ≤ 200ms
- NFR-004 0 错误
- REQ-013 全部业务规则

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-010 评论服务（SD-010）

**ST ID**：ST-010
**标题**：评论树层级 5 + 软删 + 通知
**优先级**：高
**关联设计**：SD-010, SD-011（联动）
**关联 REQ**：REQ-009, REQ-010
**关联 NFR**：NFR-004
**类型**：可靠性 + E2E
**测试场景**：多级回复 + 软删 + 通知博主 + 跨用户删除。

### 前置条件
- 预创建 blogger `b1` + post `p1`
- reader `r1`, `r2` 持有 JWT

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | r1 顶级评论 | POST /posts/p1.id/comments + `{content: 'top'}` | 201 + `{commentId, level: 0}` |
| 2 | r2 回复 r1 | POST /comments/c1.id/replies + `{content: 'r1'}` | 201 + level: 1 |
| 3 | r1 回复 r2 | POST /comments/c2.id/replies + `{content: 'r2'}` | 201 + level: 2 |
| 4 | 嵌套到 level 5 | 继续回复 4 次 | 全部 201；最后 level: 4 |
| 5 | level 6 越界 | POST /comments/c5.id/replies | 400 + `MAX_DEPTH_EXCEEDED` |
| 6 | b1 查通知 | GET /me/notifications?unreadOnly=true | 包含 5 条 comment notification |
| 7 | r1 删除自己的评论 c1 | DELETE /comments/c1.id | 204 |
| 8 | GET /posts/p1.id/comments | 匿名 | 200 + items 显示 `[已删除]` 但保留树形 |
| 9 | r3 尝试删除 r1 的评论 | r3 JWT | 403 + `FORBIDDEN_NOT_OWNER` |
| 10 | b1 删除 r1 的评论 | b1 JWT（博文 owner） | 204 |
| 11 | 1000 并发评论 | 1000 reader 各发 1 条 | 201 × 1000；0 错误 |

### 预期结果
- 层级 5 限制生效
- 软删保留树形
- owner 校验
- 1000 并发 0 错误

### 验收
- REQ-009 + REQ-010
- NFR-004 0 错误

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-011 通知服务（SD-011）

**ST ID**：ST-011
**标题**：关注/评论/点赞事件触发通知
**优先级**：高
**关联设计**：SD-011
**关联 REQ**：REQ-011
**关联 NFR**：NFR-004
**类型**：E2E
**测试场景**：跨模块事件触发链路。关注/被评论/被点赞事件触发站内通知。

### 前置条件
- 预创建 blogger `b1`（含已发布 post p1）+ reader `r1`, `r2`
- r1 持有 JWT

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | r1 关注 b1 | POST /follows/b1.bloggerId | 200 + `{followed: true}` |
| 2 | b1 查通知 | GET /me/notifications | 200 + items 包含 1 条 follow notification |
| 3 | r1 评论 p1 | POST /posts/p1.id/comments | 201 |
| 4 | b1 查通知 | GET /me/notifications | items 新增 comment notification |
| 5 | r1 点赞 p1 | POST /posts/p1.id/like | 200 |
| 6 | b1 查通知 | GET /me/notifications | items 新增 like notification |
| 7 | r2 评论 r1 的评论（c1） | POST /comments/c1.id/replies | 201 |
| 8 | r1 查通知 | GET /me/notifications | items 包含 reply notification |
| 9 | 标记已读 | PATCH /me/notifications/:id/read | 200 |
| 10 | 验证已读过滤 | GET /me/notifications?unreadOnly=true | items 不含已读 |
| 11 | 验证 30 天后清理 | vi.setSystemTime(now + 31d) | 自动清理已读通知 |

### 预期结果
- 4 类事件均触发通知
- 30 天后自动清理
- 已读过滤正确

### 验收
- REQ-011 全部事件
- NFR-004 可靠性

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-012 RSS 订阅服务（SD-012）

**ST ID**：ST-012
**标题**：RSS 2.0 格式正确 + 最近 20 篇
**优先级**：中
**关联设计**：SD-012
**关联 REQ**：REQ-014
**关联 NFR**：NFR-001
**类型**：E2E
**测试场景**：RSS 2.0 格式合规 + 仅 published + 最近 20 篇 + 公开端点。

### 前置条件
- 预创建 30 篇 published post + 5 篇 draft
- 站点配置已设置（siteTitle, siteLink, siteDescription）

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | GET /rss.xml | 匿名 | 200 + Content-Type: application/rss+xml; charset=utf-8 |
| 2 | 解析 XML | — | 包含 `<?xml version="1.0"` 和 `<rss version="2.0">` |
| 3 | 验证 channel | — | 包含 title/link/description/language=zh-CN |
| 4 | 验证 item 数量 | — | 恰好 20 个（最近 20 篇 published） |
| 5 | 验证 item 排序 | — | 按 pubDate 倒序 |
| 6 | 验证 item 字段 | — | 包含 title/link/guid/pubDate/description |
| 7 | 验证不含 draft | — | items 不包含草稿 |
| 8 | 1000 并发 GET /rss.xml | 匿名 | 200 × 1000；0 错误 |
| 9 | 测量 P95 | k6 | P95 ≤ 200ms |
| 10 | 验证 limit 边界 | 添加第 21 篇 published | items 仍为 20，新文不在内 |

### 预期结果
- RSS 2.0 格式合规
- 仅 20 篇 published
- 公开端点
- 0 错误

### 验收
- REQ-014
- NFR-001 + NFR-004

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-013 Webhook 服务（SD-013）

**ST ID**：ST-013
**标题**：Webhook 签名正确 + 失败重试 3 次（安全基线 TC-DES-009）
**优先级**：高
**关联设计**：SD-013
**关联 REQ**：REQ-015
**关联 NFR**：NFR-003, NFR-004
**类型**：安全 + 可靠性
**测试场景**：post.published 事件触发 Webhook 投递；签名校验；失败重试 3 次；记录 audit。

### 前置条件
- 预创建 blogger `b1` + admin `a1`（注册 webhook 订阅 url=http://mock/webhook）
- nock 拦截 `http://mock/webhook`
- nock 模拟 200 / 4xx / 5xx / timeout 各种场景

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 注册订阅 | POST /webhooks + `{url: 'http://mock/webhook', events: ['post.published'], secret: 'shh'}` | 201 + `{subscriptionId}` |
| 2 | 发布博文 | POST /posts/:id/publish | 200 |
| 3 | 验证外部调用 | nock 检查 | 1 次 POST，body 为 `{event: 'post.published', data: {...}}` |
| 4 | 验证签名头 | nock 检查 | `X-Webhook-Signature: sha256=<hex>`；HMAC(secret, body) === hex |
| 5 | 验证时间戳 | nock 检查 | `X-Webhook-Timestamp: <unix-ms>` |
| 6 | 验证事件头 | nock 检查 | `X-Webhook-Event: post.published` |
| 7 | 模拟 5xx 失败 | nock 配 3 次失败 + 1 次成功 | 投递 4 次后成功 |
| 8 | 验证退避 | 时间戳差 | 1s/4s/16s |
| 9 | 模拟持续失败 | nock 配持续 5xx | 投递 4 次后标记 failed（1 初次 + 3 重试） |
| 10 | 验证 audit | GET /admin/audit-logs?type=webhook.failed | 包含 1 条 webhook.failed |
| 11 | 注销订阅 | DELETE /webhooks/:id | 204 |
| 12 | 验证 HMAC 错误 | secret 错误重算签名 | 外部拒绝（自身不感知；nock 验证 401） |
| 13 | 1000 并发触发 | 1000 post.published 事件 | 全部投递；0 错误 |

### 预期结果
- 签名头正确（HMAC-SHA256）
- 退避 1s/4s/16s
- 失败 3 次后标记 failed
- audit 记录
- 并发 0 错误

### 验收
- REQ-015 全部规则
- NFR-003 签名安全
- NFR-004 0 错误
- TC-DES-009 安全基线

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-014 站点配置服务（SD-014）

**ST ID**：ST-014
**标题**：admin 唯一可改站点配置
**优先级**：中
**关联设计**：SD-014
**关联 REQ**：REQ-016
**关联 NFR**：NFR-003
**类型**：安全
**测试场景**：admin role 唯一可写站点配置；reader/blogger 写被拒。

### 前置条件
- 预创建 admin `a1` + reader `r1` + blogger `b1`
- 默认 site_config 存在

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | GET /site/config | 匿名 | 200 + `{siteTitle, siteLink, siteDescription}` |
| 2 | r1 尝试 PUT /site/config | r1 JWT + `{siteTitle: 'evil'}` | 403 + `FORBIDDEN` |
| 3 | b1 尝试 PUT /site/config | b1 JWT | 403 + `FORBIDDEN` |
| 4 | a1 PUT /site/config | a1 JWT + `{siteTitle: 'New', siteLink: 'https://new'}` | 200 + 更新 |
| 5 | GET /site/config | 匿名 | 200 + siteTitle='New' |
| 6 | 验证 audit | GET /admin/audit-logs?type=site.config.updated | 包含 1 条 |
| 7 | 验证不返回 updatedAt | 步骤 5 响应 | 响应无 updatedAt 字段 |
| 8 | bannerAdId 关联不存在 ad | a1 JWT + `{bannerAdId: 'ad_nonexistent'}` | 200 但 bannerAd=null（忽略） |

### 预期结果
- admin 唯一可写
- 公开读 + 字段过滤
- audit 记录
- bannerAdId 软关联

### 验收
- REQ-016 RBAC
- NFR-003

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-015 访问记录服务（SD-015）

**ST ID**：ST-015
**标题**：10000 条访问记录查询 + 内存占用
**优先级**：中
**关联设计**：SD-015
**关联 REQ**：REQ-019
**关联 NFR**：NFR-002
**类型**：内存
**测试场景**：10000 条 access_records 场景下查询 P95 ≤ 200ms + 内存 ≤ 100MB。

### 前置条件
- 10000 条 access_records 预创建（10 博文 × 1000 访问）
- 1000 access_records 已超 30 天（验证清理）

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | GET /admin/posts/p1.id/access?page=1&pageSize=20 | admin JWT | 200 + items 1000 条 |
| 2 | 测量 P95 | k6 100 并发 30s | P95 ≤ 200ms |
| 3 | 验证 30 天清理 | vi.setSystemTime(now + 31d) | access_records 数组长度 = 9000 |
| 4 | 1000 并发 GET /posts/p1.id（写 access） | — | 200 × 1000；access_records 数组 +1000 |
| 5 | 测量内存 | process.memoryUsage().heapUsed | ≤ 100MB（NFR-002） |
| 6 | 验证 anonymous userId | 无 token 访问 | access_record.userId === undefined |
| 7 | 验证 IP 取 X-Forwarded-For | header X-Forwarded-For: 1.2.3.4 | access_record.ip === '1.2.3.4' |
| 8 | r1 尝试访问 | r1 JWT | 403 + `FORBIDDEN`（非 admin） |

### 预期结果
- 查询性能达标
- 30 天清理生效
- 内存不超限
- 匿名/IP/权限正确

### 验收
- REQ-019
- NFR-002 内存 ≤ 100MB
- NFR-001 性能

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-016 审计日志服务（SD-016）

**ST ID**：ST-016
**标题**：审计 90 天保留 + admin 唯一可查
**优先级**：高
**关联设计**：SD-016
**关联 REQ**：REQ-018
**关联 NFR**：NFR-003, CON-004
**类型**：安全 + 边界
**测试场景**：审计 90 天保留（CON-004）；admin 唯一可查；非 admin 拒绝。

### 前置条件
- 预创建 admin `a1` + reader `r1`
- 触发 100 个写操作（注册/登录/发布/删除）

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | GET /admin/audit-logs?page=1&pageSize=20 | a1 JWT | 200 + items 100 条 |
| 2 | r1 尝试查询 | r1 JWT | 403 + `FORBIDDEN` |
| 3 | 匿名查询 | 无 token | 401 + `UNAUTHENTICATED` |
| 4 | 按 actor 筛选 | ?actor=r1.id | 200 + items 仅含 r1 |
| 5 | 按 type 筛选 | ?type=post.published | 200 + items 仅含 post.published |
| 6 | 按时间筛选 | ?from=...&to=... | 200 + items 时间范围内 |
| 7 | 模拟 91 天前记录 | vi.setSystemTime(now - 91d) + 触发 1 条 | audit_logs 数组包含 1 条 |
| 8 | 模拟 90 天后清理 | vi.setSystemTime(now + 1d) | audit_logs 数组不含 91 天前记录 |
| 9 | 验证不可见 | GET /admin/audit-logs | 不含 91 天前记录 |
| 10 | 验证 append-only | 尝试 PUT /admin/audit-logs/:id | 404（无此端点） |

### 预期结果
- 90 天保留（CON-004）
- admin 唯一可查
- 多维度筛选
- 自动清理

### 验收
- REQ-018
- CON-004
- NFR-003

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-017 站点统计服务（SD-017）

**ST ID**：ST-017
**标题**：站点统计 PV/UV 24h 桶聚合 P95 ≤ 200ms
**优先级**：高
**关联设计**：SD-017
**关联 REQ**：REQ-020
**关联 NFR**：NFR-001, NFR-002
**类型**：性能 + 内存
**测试场景**：24h 桶聚合查询 P95 ≤ 200ms；30 天后桶清理；内存 ≤ 100MB。

### 前置条件
- 1000 博文 + 10000 access_records（24h 内）+ 1000 独立用户
- 预创建 30 天前桶（验证清理）

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | GET /admin/stats/site?range=24h | admin JWT | 200 + `{pv: 10000, uv: 1000, trend: [...24 buckets...]}` |
| 2 | 测量 P95 | k6 100 并发 30s | P95 ≤ 200ms |
| 3 | 1000 并发 GET /posts/:id | — | 200；stats 桶 +1 PV/UV |
| 4 | 测量 P95 | — | P95 ≤ 200ms |
| 5 | 验证 UV 去重 | 同一 userId 100 次 | UV Set 大小 +1 |
| 6 | GET /admin/stats/posts?range=24h | admin JWT | 200 + TopN 数组 |
| 7 | 30 天后桶清理 | vi.setSystemTime(now + 31d) | 30 天前桶被清理 |
| 8 | 测量内存 | process.memoryUsage().heapUsed | ≤ 100MB |
| 9 | r1 尝试查询 | r1 JWT | 403 + `FORBIDDEN` |

### 预期结果
- 24h 桶聚合正确
- P95 ≤ 200ms
- UV 去重
- 30 天清理
- 内存 ≤ 100MB

### 验收
- REQ-020
- NFR-001 + NFR-002

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-018 推荐服务（SD-018）

**ST ID**：ST-018
**标题**：推荐结果基于标签 Jaccard 相似度
**优先级**：中
**关联设计**：SD-018
**关联 REQ**：REQ-021
**关联 NFR**：NFR-001
**类型**：E2E
**测试场景**：基于标签 Jaccard 相似度推荐；冷启动回退最近热门。

### 前置条件
- 100 博文种子（含 5 篇 tags=[typescript, node]，5 篇 tags=[typescript]，5 篇 tags=[python]）
- reader `r1` 已阅读 5 篇 typescript 博文

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | GET /me/recommendations?limit=10 | r1 JWT | 200 + items（typescript 优先于 python） |
| 2 | 验证 Jaccard 排序 | — | typescript 排在 python 前 |
| 3 | 已读排除 | — | items 不含 r1 已读 |
| 4 | 冷启动 | 新 reader r2 无历史 | 200 + items = 最近 30 天 published 按 likes Top 10 |
| 5 | 测量 P95 | 100 并发 30s | P95 ≤ 200ms |
| 6 | limit=100 边界 | ?limit=100 | 400 + `INVALID_LIMIT` |
| 7 | 关注图谱输入 | r1 关注 b1（专写 node） | items 包含 b1 的 node 博文 |
| 8 | 验证草稿不可见 | — | items 仅 published |

### 预期结果
- Jaccard 相似度排序正确
- 冷启动回退热门
- 已读排除
- 关注图谱输入生效

### 验收
- REQ-021
- NFR-001

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-019 广告位服务（SD-019）

**ST ID**：ST-019
**标题**：广告位生效时间窗口过滤
**优先级**：中
**关联设计**：SD-019
**关联 REQ**：REQ-022
**关联 NFR**：NFR-004
**类型**：E2E
**测试场景**：广告位 CRUD + 时间窗口过滤；过期自动下线。

### 前置条件
- 预创建 admin `a1`
- 当前时间 now

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 创建广告 | POST /site/ads + `{imageUrl, linkUrl, startAt: now-1h, endAt: now+1h}` | 201 + `{adId}` |
| 2 | GET /site/ads/active | 匿名 | 200 + items 包含新建 ad |
| 3 | 创建未来广告 | `{startAt: now+1h, endAt: now+2h}` | 201 |
| 4 | GET /site/ads/active | 匿名 | items 不含未来 ad |
| 5 | 模拟时间到 now+1.5h | vi.setSystemTime(now+1.5h) | — |
| 6 | GET /site/ads/active | 匿名 | items 包含原 ad（now+1h ≤ now+1.5h ≤ now+2h） |
| 7 | 模拟时间到 now+2.5h | vi.setSystemTime(now+2.5h) | — |
| 8 | GET /site/ads/active | 匿名 | items 不含任何 ad（原 ad 已过期） |
| 9 | endAt ≤ startAt 边界 | `{startAt: now, endAt: now}` | 400 + `INVALID_TIME_RANGE` |
| 10 | 删除广告 | DELETE /site/ads/:id | 204 |
| 11 | r1 尝试创建 | r1 JWT | 403 + `FORBIDDEN` |
| 12 | 1000 并发 GET /site/ads/active | 匿名 | 200 × 1000；0 错误 |

### 预期结果
- 时间窗口过滤准确
- 过期自动下线
- 边界校验
- admin 唯一可写
- 0 错误

### 验收
- REQ-022
- NFR-004

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-020 限流服务（SD-020）

**ST ID**：ST-020
**标题**：100 req/min/IP 限流 + 429 + Retry-After
**优先级**：高
**关联设计**：SD-020
**关联 REQ**：NFR-005
**关联 NFR**：NFR-005
**类型**：可靠性
**测试场景**：单 IP 第 101 次请求触发限流 + 429 + Retry-After；`/health` 豁免。

### 前置条件
- `resetAllRepositories()`
- 不带 `x-test-bypass-rate-limit: true`（本用例测试限流本身）

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 100 次 GET /health | 匿名 | 200 × 100 |
| 2 | 第 101 次 GET /health | 匿名 | 200（豁免） |
| 3 | 100 次 GET /posts | 匿名 | 200 × 100 |
| 4 | 第 101 次 GET /posts | 匿名 | 429 + `{error: {code: 'RATE_LIMITED', details: {retryAfterSec: 60, limit: 100, windowSec: 60}}}` |
| 5 | 验证 Retry-After 头 | — | `Retry-After: 60` |
| 6 | 等待 60s 后重试 | vi.setSystemTime(now+60s) | 200 |
| 7 | 滑动窗口验证 | 30s 时 50 次 + 30s 时 50 次 + 1 次 | 第 101 次 429（滑动窗口） |
| 8 | 不同 IP 独立 | X-Forwarded-For: 2.2.2.2 | 200（独立计数） |
| 9 | 1000 并发触发限流 | k6 1000 并发 | 前 100 个 200，其余 429 |
| 10 | 验证 bypass 头 | x-test-bypass-rate-limit: true | 不计数 |
| 11 | 验证内存 | 100 IP 计数后 | ≤ 100MB |

### 预期结果
- 第 101 次 429
- Retry-After: 60
- 滑动窗口正确
- `/health` 豁免
- bypass 头生效

### 验收
- NFR-005 100 req/min/IP
- 滑动窗口 + Retry-After

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-021 API 路由层（SD-021）

**ST ID**：ST-021
**标题**：RESTful 端点 + Content-Type + 错误格式统一（CON-003）
**优先级**：高
**关联设计**：SD-021
**关联 REQ**：CON-003
**关联 NFR**：CON-003
**类型**：E2E
**测试场景**：所有响应 Content-Type=application/json；RESTful 资源命名；错误格式统一。

### 前置条件
- `resetAllRepositories()`

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | GET /posts | — | 200 + Content-Type: application/json; charset=utf-8 |
| 2 | GET /posts/p1.id | — | 200 + 同上 |
| 3 | POST /posts | — | 201 + 同上 |
| 4 | DELETE /posts/p1.id | — | 204 + 无 body（无 Content-Type） |
| 5 | 错误响应 Content-Type | GET /posts/nonexistent | 404 + Content-Type: application/json |
| 6 | 错误响应 body 格式 | — | `{error: {code: 'POST_NOT_FOUND', message, details?}}` |
| 7 | RSS Content-Type | GET /rss.xml | 200 + Content-Type: application/rss+xml; charset=utf-8（CON-003 例外） |
| 8 | 资源命名 | 列出所有路由 | 复数（/users /posts /comments /tags /webhooks） |
| 9 | 状态码 | 各种操作 | 200/201/204/400/401/403/404/409/422/429 |
| 10 | 鉴权 | GET /me/notifications 无 token | 401 + UNAUTHENTICATED |
| 11 | 路由级中间件 | 所有路由 | rateLimit + auth + errorHandler 链式生效 |
| 12 | 1000 并发 | — | 全部 200/4xx；0 个 5xx |

### 预期结果
- 所有 Content-Type 一致
- 错误格式统一
- RESTful 资源命名
- 中间件链生效

### 验收
- CON-003
- NFR-003

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## ST-022 错误处理中间件（SD-022）

**ST ID**：ST-022
**标题**：错误码字典完整 + 错误响应 JSON 格式
**优先级**：高
**关联设计**：SD-022
**关联 REQ**：NFR-001, NFR-004
**关联 NFR**：NFR-001, NFR-004
**类型**：可靠性
**测试场景**：所有错误响应统一 JSON 格式；错误码字典覆盖全部 22 SD；未知错误不泄露堆栈。

### 前置条件
- `resetAllRepositories()`

### 测试步骤

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 触发 EMAIL_ALREADY_EXISTS | POST /users 重复 email | 409 + `{error: {code: 'EMAIL_ALREADY_EXISTS', message: '邮箱已被注册'}}` |
| 2 | 触发 INVALID_CREDENTIALS | POST /auth/login 错密码 | 401 + 同 §13.1 |
| 3 | 触发 TOKEN_EXPIRED | JWT exp 过期 | 401 + `TOKEN_EXPIRED` |
| 4 | 触发 FORBIDDEN | r1 操作 b1 资源 | 403 + `FORBIDDEN_NOT_OWNER` |
| 5 | 触发 POST_NOT_FOUND | GET /posts/nonexistent | 404 + `POST_NOT_FOUND` |
| 6 | 触发 ALREADY_* | 重复关注/点赞 | 200（实际幂等；非错误） |
| 7 | 触发 EMPTY_CONTENT | 发布空内容 | 422 + `EMPTY_CONTENT` |
| 8 | 触发 MAX_DEPTH_EXCEEDED | 评论层级超 5 | 422 + `MAX_DEPTH_EXCEEDED` |
| 9 | 触发 RATE_LIMITED | 第 101 次请求 | 429 + `RATE_LIMITED` |
| 10 | 触发 INTERNAL_ERROR | 注入 throw new Error('secret path /a/b/c') | 500 + `INTERNAL_ERROR` + 响应 body 不含 'secret path' |
| 11 | 验证错误码字典完整性 | 遍历 22 SD | 所有 SD 至少 1 个错误码被触发 |
| 12 | 验证日志记录 | 触发 5xx 错误 | logger.error 输出含 stack（仅服务端日志，不外泄） |
| 13 | 1000 并发触发各种错误 | — | 0 个未捕获异常；所有错误响应 JSON 格式一致 |

### 预期结果
- 错误码字典覆盖 22 SD
- 错误响应 JSON 统一
- 未知错误不泄露堆栈
- 日志记录完整

### 验收
- NFR-001（错误响应不超 200ms）
- NFR-004（错误处理 0 崩溃）
- SD-022 全部职责

### 执行状态
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：

---

## 用例汇总

| 用例 ID | 标题 | 类型 | 关联 SD | 关联 REQ | 关联 NFR/CON | 状态 |
|---|---|---|---|---|---|---|
| ST-001 | 100 并发登录 P95 + 错密码脱敏 | 性能+安全 | SD-001 | REQ-001, REQ-002 | NFR-001, NFR-003 | 待执行 |
| ST-002 | reader 修改资料 → 公开接口 | E2E | SD-002 | REQ-003 | NFR-003 | 待执行 |
| ST-003 | 1000 并发关注/取关幂等 | 可靠性 | SD-003 | REQ-004 | NFR-004 | 待执行 |
| ST-004 | blogger 注册 + 多博主切换 | E2E | SD-004 | REQ-005, REQ-017 | NFR-006 | 待执行 |
| ST-005 | 1000 并发博文 CRUD + 状态机 | 可靠性 | SD-005 | REQ-006 | NFR-001, NFR-004 | 待执行 |
| ST-006 | 1000 并发 GET /posts P95 | 性能 | SD-006 | REQ-007 | NFR-001 | 待执行 |
| ST-007 | 点赞/收藏幂等 + 通知 | E2E | SD-007 | REQ-008, REQ-011 | NFR-004 | 待执行 |
| ST-008 | 标签幂等 + 反向查询 | E2E | SD-008 | REQ-012 | NFR-001 | 待执行 |
| ST-009 | 1000 博文搜索 P95 + 0 错误 | 性能+可靠性 | SD-009 | REQ-013 | NFR-001, NFR-004 | 待执行 |
| ST-010 | 评论树层级 + 软删 | 可靠性+E2E | SD-010 | REQ-009, REQ-010 | NFR-004 | 待执行 |
| ST-011 | 事件触发通知 | E2E | SD-011 | REQ-011 | NFR-004 | 待执行 |
| ST-012 | RSS 2.0 格式 | E2E | SD-012 | REQ-014 | NFR-001 | 待执行 |
| ST-013 | Webhook 签名 + 重试 | 安全+可靠性 | SD-013 | REQ-015 | NFR-003, NFR-004 | 待执行 |
| ST-014 | admin 唯一改站点配置 | 安全 | SD-014 | REQ-016 | NFR-003 | 待执行 |
| ST-015 | 10000 条访问记录 + 内存 | 内存 | SD-015 | REQ-019 | NFR-002 | 待执行 |
| ST-016 | 审计 90 天 + admin 唯一 | 安全 | SD-016 | REQ-018 | NFR-003, CON-004 | 待执行 |
| ST-017 | 站点统计 PV/UV 24h 桶 | 性能+内存 | SD-017 | REQ-020 | NFR-001, NFR-002 | 待执行 |
| ST-018 | 推荐 Jaccard 相似度 | E2E | SD-018 | REQ-021 | NFR-001 | 待执行 |
| ST-019 | 广告时间窗口 | E2E | SD-019 | REQ-022 | NFR-004 | 待执行 |
| ST-020 | 限流 100 req/min/IP | 可靠性 | SD-020 | NFR-005 | NFR-005 | 待执行 |
| ST-021 | RESTful + Content-Type | E2E | SD-021 | CON-003 | CON-003 | 待执行 |
| ST-022 | 错误码字典完整 | 可靠性 | SD-022 | NFR-001, NFR-004 | NFR-001, NFR-004 | 待执行 |

## 五类测试覆盖矩阵

| 类型 | 用例 | 数量 |
|---|---|---|
| 性能（Performance） | ST-006, ST-009, ST-012, ST-015, ST-017, ST-018 | 6 |
| 安全（Security） | ST-001, ST-013, ST-014, ST-016 | 4 |
| 可靠性（Reliability） | ST-003, ST-005, ST-009, ST-010, ST-013, ST-019, ST-020, ST-022 | 8 |
| 内存（Memory） | ST-015, ST-017 | 2 |
| E2E（端到端） | ST-002, ST-004, ST-007, ST-008, ST-010, ST-011, ST-012, ST-018, ST-019, ST-021 | 10 |

**总计**：30 类目覆盖（部分用例属于多类，如 ST-009 性能+可靠性）；22 ST 100% 覆盖 22 SD。

## 测试 seam 决策

### 候选 seam 列表
- **HTTP API (supertest)**：注入 `app = createApp()`，通过 HTTP 调用 — 钩住点：Express 路由 + 中间件链
- **真实端口 (app.listen(0))**：k6 通过 HTTP 调用 — 钩住点：HTTP 端口
- **模块导出 (import service fn)**：直接调用 service 函数 — 钩住点：TS 模块边界
- **进程边界 (spawn child process)**：独立 Node 进程 — 钩住点：stdin/stdout + 端口

### 选定 seam
- **系统测试主 seam**：HTTP API (supertest + app.listen(0)) — 理由：最高 seam，覆盖最广，最稳定，Fewer seams better
- **系统测试辅 seam**：无 — 理由：HTTP seam 已能覆盖所有 22 ST

### 理由
- 为什么主 seam 是最高 seam：HTTP API 是系统对外契约，所有业务能力均通过 supertest 验证；k6 走真实 HTTP 端口，模拟真实压测
- 为什么现有 seam 优于新建 seam：HTTP seam 已有 72 个 UAT 验证，再覆盖 22 ST 是自然扩展
- 新建 seam 的代价：0（无）

### 复用与无复用
- **复用阶段 1 seam**（UAT HTTP API seam）：本 ST seam 与 UAT seam 共享
- **无新建 seam**

## TC-DES-007/008/009 覆盖

- **TC-DES-007 端到端**：ST-007（点赞 → 通知 + ST-011 事件触发 + ST-021 RESTful + Content-Type）
- **TC-DES-008 性能基线**：ST-006（GET /posts P95）+ ST-009（搜索 P95）+ ST-017（统计 P95）
- **TC-DES-009 安全基线**：ST-013（Webhook 签名）+ ST-001（密码脱敏）+ ST-014（admin RBAC）+ ST-016（审计 admin only）

## 测试用例覆盖说明

- **功能点覆盖**：22 SD / 22 ST = 100%
- **NFR 覆盖**：6 NFR 全部覆盖（每个 NFR ≥ 1 ST）
- **CON 覆盖**：4 CON 全部覆盖（CON-001/002 通过 ST-021 间接；CON-003 显式 ST-021；CON-004 显式 ST-016）
- **边界条件覆盖**：pageSize > 100（ST-006）/ q 空（ST-009）/ 层级 5（ST-010）/ limit 上限（ST-018）/ 时间窗口（ST-019）
- **TC-DES-007/008/009 必含**：✅ 全部覆盖
- **五大类覆盖**：✅ 5/5 = 100%

## 执行工具

| 工具 | 用途 | 版本 |
|---|---|---|
| Vitest | 测试框架 | ^4.1.10 |
| supertest | HTTP 测试 | ^7.0.0 |
| k6 | 性能/可靠性/内存压测 | latest（独立进程） |
| @vitest/coverage-v8 | 覆盖率 | ^4.1.10 |
| nock | HTTP 出站拦截 | latest（仅 ST-013） |

## 执行命令

```bash
# 单元测试 + 集成测试
npm test

# 系统测试
npm run test:system

# 性能 + 可靠性 + 内存（k6 独立）
k6 run tests/system/k6-read-apis.js        # ST-006
k6 run tests/system/k6-search.js          # ST-009
k6 run tests/system/k6-rate-limit.js      # ST-020
k6 run tests/system/k6-memory-1000.js     # ST-015, ST-017

# 端到端 + 安全
npm run test:system:e2e
npm run test:system:security
```

## 下阶段

阶段 3（概要设计）由 S-doc 子代理产出 `detailed-design.md`，将每个 INTF 拆为 1+ DD 节点；阶段 6（集成测试）执行前文 22 SD 集成；阶段 7（系统测试）执行本文 22 ST；阶段 8（验收测试）执行 `docs/phase1-requirements/acceptance-test-design.md` 中 72 UAT。

---

> 🔴 **CHECKPOINT · 阶段门放行**：本系统测试设计产出后暂停。需向用户展示「22 ST 列表 / 五类覆盖矩阵 / 性能/安全/可靠性/内存/E2E 验收阈值 / TC-DES-007/008/009 覆盖 / 测试 seam 决策」，由用户确认「放行进入阶段 3」或「返工」。

## 附录 A：ST 详细步骤与数据矩阵

> 本附录为每个 ST 补充：详细步骤、测试数据矩阵、断言细节、边界条件。

> 用于阶段 7（系统测试）执行时的直接参考。


### ST-001 详细展开（100 并发登录 P95 ≤ 200ms + 错密码脱敏）

**关联 SD**：SD-001  

**类别**：性能+安全  


### ST-001.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | 性能+安全 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-001.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-001.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-001.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-002 详细展开（用户资料查询匿名/越权矩阵）

**关联 SD**：SD-002  

**类别**：安全  


### ST-002.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | 安全 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-002.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-002.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-002.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-003 详细展开（关注/取关幂等 + 通知不重复）

**关联 SD**：SD-003  

**类别**：E2E  


### ST-003.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | E2E 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-003.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-003.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-003.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-004 详细展开（博主注册 + 多博主切换上下文）

**关联 SD**：SD-004  

**类别**：E2E  


### ST-004.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | E2E 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-004.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-004.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-004.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-005 详细展开（博文生命周期状态机闭合）

**关联 SD**：SD-005  

**类别**：E2E  


### ST-005.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | E2E 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-005.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-005.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-005.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-006 详细展开（博文浏览 1000 并发 P95 ≤ 200ms + 内存 ≤ 100MB）

**关联 SD**：SD-006  

**类别**：性能+内存  


### ST-006.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | 性能+内存 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-006.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-006.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-006.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-007 详细展开（互动（点赞/收藏）并发一致性）

**关联 SD**：SD-007  

**类别**：E2E+性能  


### ST-007.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | E2E+性能 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-007.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-007.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-007.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-008 详细展开（标签创建/查询 + N+1 防御）

**关联 SD**：SD-008  

**类别**：性能  


### ST-008.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | 性能 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-008.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-008.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-008.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-009 详细展开（全文搜索 1000 博文 P95 ≤ 200ms）

**关联 SD**：SD-009  

**类别**：性能  


### ST-009.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | 性能 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-009.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-009.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-009.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-010 详细展开（评论树深度限制 + 删除收敛）

**关联 SD**：SD-010  

**类别**：E2E  


### ST-010.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | E2E 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-010.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-010.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-010.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-011 详细展开（通知扇出 + 限流降级）

**关联 SD**：SD-011  

**类别**：可靠性  


### ST-011.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | 可靠性 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-011.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-011.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-011.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-012 详细展开（RSS 缓存与字段过滤）

**关联 SD**：SD-012  

**类别**：性能  


### ST-012.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | 性能 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-012.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-012.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-012.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-013 详细展开（Webhook 签名 + 失败重试 + 死信）

**关联 SD**：SD-013  

**类别**：可靠性+安全  


### ST-013.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | 可靠性+安全 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-013.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-013.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-013.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-014 详细展开（站点配置并发写冲突）

**关联 SD**：SD-014  

**类别**：可靠性  


### ST-014.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | 可靠性 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-014.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-014.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-014.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-015 详细展开（访问记录 1000 并发写 0 丢失）

**关联 SD**：SD-015  

**类别**：可靠性  


### ST-015.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | 可靠性 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-015.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-015.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-015.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-016 详细展开（审计日志 90 天滚动 + 不可篡改）

**关联 SD**：SD-016  

**类别**：安全  


### ST-016.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | 安全 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-016.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-016.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-016.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-017 详细展开（统计聚合正确性 + 性能）

**关联 SD**：SD-017  

**类别**：性能  


### ST-017.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | 性能 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-017.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-017.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-017.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-018 详细展开（推荐结果稳定 + 冷启动）

**关联 SD**：SD-018  

**类别**：E2E  


### ST-018.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | E2E 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-018.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-018.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-018.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-019 详细展开（广告位 startAt/endAt 时间窗）

**关联 SD**：SD-019  

**类别**：E2E  


### ST-019.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | E2E 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-019.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-019.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-019.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-020 详细展开（限流 100/IP/min 滑动窗口）

**关联 SD**：SD-020  

**类别**：安全  


### ST-020.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | 安全 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-020.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-020.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-020.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-021 详细展开（路由分发 + 路径解析正确性）

**关联 SD**：SD-021  

**类别**：可靠性  


### ST-021.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | 可靠性 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-021.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-021.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-021.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |


### ST-022 详细展开（错误统一响应 + 内部信息脱敏）

**关联 SD**：SD-022  

**类别**：安全  


### ST-022.1 详细测试步骤

| 步骤编号 | 阶段 | 操作 | 输入 | 预期输出 | 断言 |
|---|---|---|---|---|---|
| 1 | Setup | 启动 app.listen(0) | — | 端口可访问 | 端口 > 0 |
| 2 | Setup | 调用 `resetAllRepositories()` | — | 所有 Map 清空 | assert.size == 0 |
| 3 | Setup | Seed 1000 用户 + 100 博文 + 500 评论 | seed() | 实体可查 | assert.findById 不为 null |
| 4 | Setup | 启动 k6 100/1000 并发脚本 | — | 压测准备就绪 | 脚本 exit code 0 |
| 5 | Execute | 安全 主路径 | 测试载荷 | 期望响应 | 状态码/P95/字段 |
| 6 | Verify | 字段断言 | 响应 body | 字段匹配 | deepEqual |
| 7 | Verify | 错误码断言 | 错误响应 | 错误码 | error.code 一致 |
| 8 | Verify | 副作用断言 | DB/Event | 事件发出 | eventBus emit 次数 |
| 9 | Verify | 审计断言 | 审计 Map | 审计记录 | 存在 + 字段完整 |
| 10 | Teardown | 关闭 app | — | 端口释放 | port closed |


### ST-022.2 测试数据矩阵

| 数据类型 | 数量 | 字段约束 | 用途 |
|---|---|---|---|
| 读者 | 1000 | email 唯一, role=reader | 登录 + 关注测试 |
| 博主 | 50 | email 唯一, role=blogger | 博文发布测试 |
| 管理员 | 1 | role=admin | 跨用户管理测试 |
| 博文 | 100 | 状态混合（draft/published/deleted） | 浏览/搜索/推荐测试 |
| 评论 | 500 | 树深度 ≤ 3 | 评论树测试 |
| 标签 | 30 | name 唯一 | 标签关联测试 |
| 通知 | 0（按需生成） | type ∈ {comment, follow, system} | 通知扇出测试 |
| 审计 | 0（按需生成） | action 完整 | 审计完整性测试 |
| Webhook 订阅 | 3 | 签名密钥 | 异步回调测试 |
| 广告位 | 5 | startAt/endAt 时间窗 | 广告位时间窗测试 |


### ST-022.3 断言细节

**主断言**（必须全部通过）：

1. 状态码断言：HTTP 状态码 = 期望值
2. 响应体断言：deepEqual 完整 body（除 requestId/时间戳外）
3. 性能断言：P95 ≤ 200ms（核心读）/ P95 ≤ 400ms（写）
4. 内存断言：heapUsed ≤ 100MB（5 分钟稳态）
5. 一致性断言：DB 状态 == 期望

**辅助断言**（失败时输出诊断信息）：

1. 错误码枚举：枚举值在 `error-code-dict` 中
2. 字段类型：每个字段类型与 schema 一致
3. 时间窗：publishedAt / startAt / endAt 在合理范围
4. 审计链路：每次写操作对应 1 条审计记录
5. Webhook 重试：失败回调的重试次数 ≤ 3
6. 限流：100/IP/min 滑窗，第 101 次返回 429

**断言失败定位**：

- 性能失败：输出 P50/P90/P95/P99 分布
- 一致性失败：输出 expected vs actual diff
- 内存失败：输出 GC 次数与 RSS
- 限流失败：输出当前窗口计数


### ST-022.4 边界条件与异常路径

| 场景 | 输入 | 预期行为 | 错误码 |
|---|---|---|---|
| 空输入 | `{}` | 400 | VALIDATION_FAILED |
| 字段缺失 | `{a:1}` | 400 | VALIDATION_FAILED |
| 字段类型错 | `{id: 123}` | 400 | VALIDATION_FAILED |
| 字段过长 | `{title: 'A'.repeat(10001)}` | 400 | VALIDATION_FAILED |
| 未认证 | 无 JWT | 401 | AUTH_REQUIRED |
| 越权 | 跨用户操作 | 403 | NOT_OWNER |
| 不存在 | id 不存在 | 404 | NOT_FOUND |
| 状态非法 | 非法状态转移 | 409 | INVALID_STATE_TRANSITION |
| 限流触发 | 第 101 次 | 429 | RATE_LIMITED |
| 内部错误 | 注入异常 | 500 | INTERNAL_ERROR（不暴露堆栈） |

## 附录 B：测试覆盖矩阵与回归策略

### B.1 SD ↔ ST 覆盖矩阵


| SD | ST | 性能 | 安全 | 可靠 | 内存 | E2E | 备注 |
|---|---|---|---|---|---|---|---|
| SD-001 | ST-001 | ✓ | ✓ |  |  |  | 登录基线 |
| SD-002 | ST-002 |  | ✓ |  |  |  | 匿名/越权 |
| SD-003 | ST-003 |  |  |  |  | ✓ | 幂等+通知 |
| SD-004 | ST-004 |  |  |  |  | ✓ | 多博主 |
| SD-005 | ST-005 |  |  |  |  | ✓ | 状态机 |
| SD-006 | ST-006 | ✓ |  |  | ✓ |  | 博文浏览基线 |
| SD-007 | ST-007 | ✓ |  |  |  | ✓ | 互动 |
| SD-008 | ST-008 | ✓ |  |  |  |  | 标签 |
| SD-009 | ST-009 | ✓ |  |  |  |  | 搜索 |
| SD-010 | ST-010 |  |  |  |  | ✓ | 评论树 |
| SD-011 | ST-011 |  |  | ✓ |  |  | 通知扇出 |
| SD-012 | ST-012 | ✓ |  |  |  |  | RSS |
| SD-013 | ST-013 |  | ✓ | ✓ |  |  | Webhook |
| SD-014 | ST-014 |  |  | ✓ |  |  | 配置写 |
| SD-015 | ST-015 |  |  | ✓ |  |  | 访问记录 |
| SD-016 | ST-016 |  | ✓ |  |  |  | 审计 |
| SD-017 | ST-017 | ✓ |  |  |  |  | 统计 |
| SD-018 | ST-018 |  |  |  |  | ✓ | 推荐 |
| SD-019 | ST-019 |  |  |  |  | ✓ | 广告时间窗 |
| SD-020 | ST-020 |  | ✓ |  |  |  | 限流 |
| SD-021 | ST-021 |  |  | ✓ |  |  | 路由 |
| SD-022 | ST-022 |  | ✓ |  |  |  | 错误响应 |

### B.2 NFR ↔ ST 覆盖矩阵


| NFR | 描述 | 覆盖 ST | 验收阈值 |
|---|---|---|---|
| NFR-001 | 性能 | ST-001/006/007/008/009/012/017 | P95 ≤ 200ms |
| NFR-002 | 内存 | ST-006/015 | ≤ 100MB heap |
| NFR-003 | 安全 | ST-001/002/010/013/016/020/022 | JWT/越权/注入/签名/脱敏 |
| NFR-004 | 可靠性 | ST-005/011/013/014/015/021 | 1000 并发 0 错误 |
| NFR-005 | 限流 | ST-020 | 100/IP/min 滑动窗口 |
| NFR-006 | 密码 | ST-001 | bcrypt cost=10 |

### B.3 CON ↔ ST 覆盖矩阵


| CON | 描述 | 覆盖 ST | 验收点 |
|---|---|---|---|
| CON-001 | TypeScript strict | ST-021 | `tsc --noEmit` 0 错误 |
| CON-002 | 内存存储 | ST-006/015 | resetAllRepositories() |
| CON-003 | RESTful + JSON | ST-021 | 资源命名/方法/状态码 |
| CON-004 | 90 天审计保留 | ST-016 | retention days |

### B.4 回归测试策略


**触发条件**：

1. 任何 PR merge 到 main
2. 任何 SD 的代码变更
3. 任何 NFR 阈值调整


**回归范围**：

1. 单元测试（vitest）：全部模块
2. 集成测试（supertest）：全部 INTF
3. 22 ST 子集（5 个高优先：ST-001/006/010/013/020）
4. 端到端流程：ST-007（关注→发文→通知→Webhook）


**回归通过准则**：

1. 所有单元测试通过（0 fail）
2. 集成测试通过（0 fail）
3. ST 高优先通过（5/5）
4. P95 ≤ 200ms 不退化（与基线偏差 < 10%）
5. 内存 ≤ 100MB 不退化（与基线偏差 < 10%）

### B.5 测试数据 Seed 策略


**种子数据矩阵**：


| 数据类型 | 数量 | 生成方式 | 重置时机 |
|---|---|---|---|
| 用户 | 1000 | 循环注册 | resetAllRepositories |
| 博主 | 50 | 循环注册 | resetAllRepositories |
| 博文 | 100 | API 批量创建 | resetAllRepositories |
| 评论 | 500 | API 批量创建 | resetAllRepositories |
| 标签 | 30 | 随机名称 | resetAllRepositories |
| 关注关系 | 200 | API 批量创建 | resetAllRepositories |
| Webhook 订阅 | 3 | API 批量创建 | resetAllRepositories |
| 通知 | 0 | 按需生成 | resetAllRepositories |
| 审计 | 0 | 按需生成 | resetAllRepositories |

**Seed 脚本示例**：

```typescript
async function seedTestData(repo: Repositories) {
  // 用户
  for (let i = 0; i < 1000; i++) {
    await repo.user.create({
      email: `u${i}@test.com`,
      username: `u${i}`,
      password: 'P@ssw0rd123',
      displayName: `User ${i}`,
    });
  }
  // 博主
  for (let i = 0; i < 50; i++) {
    await repo.blogger.create({
      email: `b${i}@test.com`,
      username: `b${i}`,
      password: 'P@ssw0rd123',
    });
  }
  // 博文
  for (let i = 0; i < 100; i++) {
    await repo.post.create({
      title: `Post ${i}`,
      content: `# Content ${i}\n\nLorem ipsum...`,
      authorId: `b${i % 50}`,
      status: i % 5 === 0 ? 'draft' : 'published',
      tags: ['tech', 'intro'],
    });
  }
  // ... 更多
}
```


### B.6 测试可观测性


每个 ST 必须输出：

1. 完整请求/响应日志（含 header）
2. 性能 P50/P90/P95/P99
3. 内存 heapUsed/RSS 时间序列
4. 错误堆栈（5xx 时）
5. EventBus 事件序列
6. 审计/通知/Webhook 副作用记录


**报告模板**：

```
=== ST-001 Report ===
Total Requests: 100
Successful: 100
Failed: 0
P50: 45ms
P90: 78ms
P95: 102ms
P99: 145ms
Memory peak: 65MB
EventBus emissions: 100 (auth.login)
Audit records: 100
========================
```

## 附录 C：详细测试场景库（Detailed Test Scenarios）

> 本附录为每个 ST 补充 3-5 个详细测试场景：场景描述、输入、预期、断言、错误码。


### C.1 ST-001 / SD-001 / 正常登录

**类别**：主路径  

**描述**：使用正确凭证登录，验证 token 签发和响应  

**输入**：
```json
{email: "u1@test.com", password: "P@ssw0rd123"}
```  

**预期**：200 + {token, userId, role: "reader", expiresIn: 86400}  

**断言清单**：

- [ ] status==200
- [ ] body.token 是有效 JWT
- [ ] body.expiresIn==86400
- [ ] body.userId 匹配 seed

### C.2 ST-001 / SD-001 / 错误密码

**类别**：安全  

**描述**：使用错误密码登录，验证不区分账号存在性  

**输入**：
```json
{email: "u1@test.com", password: "wrong"}
```  

**预期**：401 + {error: {code: "INVALID_CREDENTIALS"}}  

**断言清单**：

- [ ] status==401
- [ ] error.code==INVALID_CREDENTIALS
- [ ] 响应耗时 ≈ 正常登录（防时序攻击）

### C.3 ST-001 / SD-001 / 账号不存在

**类别**：安全  

**描述**：使用不存在的邮箱登录，响应与错密码一致  

**输入**：
```json
{email: "none@test.com", password: "any"}
```  

**预期**：401 + 同错密码响应  

**断言清单**：

- [ ] status==401
- [ ] error.code==INVALID_CREDENTIALS
- [ ] 响应 body 字节级一致

### C.4 ST-001 / SD-001 / 100 并发

**类别**：性能  

**描述**：100 并发登录，P95 ≤ 200ms  

**输入**：
```json
k6 100 VU × 10 iter
```  

**预期**：P95 ≤ 200ms，0 错误  

**断言清单**：

- [ ] P95 ≤ 200ms
- [ ] 错误数 == 0
- [ ] rate_limit bypass 生效

### C.5 ST-001 / SD-001 / 限流触发

**类别**：安全  

**描述**：单 IP 第 101 次请求触发限流  

**输入**：
```json
101 次 /auth/login
```  

**预期**：第 1-100 次 200，第 101 次 429 + Retry-After: 60  

**断言清单**：

- [ ] 第 101 次 status==429
- [ ] header Retry-After==60
- [ ] error.code==RATE_LIMITED

### C.6 ST-002 / SD-002 / 匿名查询

**类别**：匿名  

**描述**：匿名查询用户公开资料  

**输入**：
```json
GET /users/01HXXX...
```  

**预期**：200 + {username, displayName, bio, avatarUrl, createdAt}  

**断言清单**：

- [ ] 无 passwordHash
- [ ] 无 email
- [ ] 字段白名单生效

### C.7 ST-002 / SD-002 / 修改自己资料

**类别**：授权  

**描述**：JWT 用户修改自己的资料  

**输入**：
```json
PUT /users/me {bio: "Hello"}
```  

**预期**：200 + updated  

**断言清单**：

- [ ] status==200
- [ ] updatedAt > createdAt
- [ ] audit 记录

### C.8 ST-002 / SD-002 / 越权修改

**类别**：授权  

**描述**：尝试修改他人资料  

**输入**：
```json
PUT /users/:otherId {bio: "..."}
```  

**预期**：403 NOT_OWNER  

**断言清单**：

- [ ] status==403
- [ ] error.code==NOT_OWNER
- [ ] 未持久化

### C.9 ST-003 / SD-003 / 关注博主

**类别**：主路径  

**描述**：已登录 reader 关注 blogger  

**输入**：
```json
POST /follows/:bloggerId
```  

**预期**：200 + {followed: true}  

**断言清单**：

- [ ] status==200
- [ ] SD-003.follows 包含 bloggerId
- [ ] 通知发送

### C.10 ST-003 / SD-003 / 重复关注幂等

**类别**：幂等  

**描述**：重复关注同一博主  

**输入**：
```json
POST /follows/:bloggerId × 2
```  

**预期**：两次都 200 + {followed: true}  

**断言清单**：

- [ ] 不重复发通知
- [ ] 去重窗口生效

### C.11 ST-003 / SD-003 / 关注自己

**类别**：业务  

**描述**：尝试关注自己（reader 关注 reader）  

**输入**：
```json
POST /follows/:selfId
```  

**预期**：403 SELF_FOLLOW  

**断言清单**：

- [ ] status==403
- [ ] error.code==SELF_FOLLOW

### C.12 ST-003 / SD-003 / 500 并发关注

**类别**：性能  

**描述**：500 reader 并发关注同一 blogger  

**输入**：
```json
k6 500 VU
```  

**预期**：P95 ≤ 200ms，0 错误  

**断言清单**：

- [ ] P95 ≤ 200ms
- [ ] 通知扇出正确

### C.13 ST-004 / SD-004 / 博主注册

**类别**：主路径  

**描述**：注册新博主账户  

**输入**：
```json
POST /bloggers {email, username, password}
```  

**预期**：201 + {bloggerId, role: "blogger"}  

**断言清单**：

- [ ] role==blogger
- [ ] email 唯一
- [ ] username 唯一

### C.14 ST-004 / SD-004 / 多博主切换

**类别**：业务  

**描述**：同一 user 切换不同 blogger 上下文  

**输入**：
```json
POST /me/bloggers/:id/switch × 2
```  

**预期**：返回新 token，sub 切换  

**断言清单**：

- [ ] token.sub 包含 bloggerId
- [ ] role==blogger

### C.15 ST-004 / SD-004 / 切换非 own

**类别**：安全  

**描述**：尝试切换非自己的 blogger  

**输入**：
```json
POST /me/bloggers/:otherBloggerId/switch
```  

**预期**：403 NOT_OWNER  

**断言清单**：

- [ ] status==403
- [ ] error.code==NOT_OWNER

### C.16 ST-005 / SD-005 / 创建草稿

**类别**：主路径  

**描述**：创建博文草稿  

**输入**：
```json
POST /posts {title, content}
```  

**预期**：201 + {postId, status: "draft"}  

**断言清单**：

- [ ] status==draft
- [ ] authorId==ctx.sub

### C.17 ST-005 / SD-005 / 发布博文

**类别**：状态机  

**描述**：draft → published 状态转移  

**输入**：
```json
POST /posts/:id/publish
```  

**预期**：200 + {status: "published", publishedAt}  

**断言清单**：

- [ ] status==published
- [ ] publishedAt 存在
- [ ] emit post.published

### C.18 ST-005 / SD-005 / 非法状态转移

**类别**：状态机  

**描述**：尝试 published → draft（不可逆）  

**输入**：
```json
PUT /posts/:id {status: "draft"}
```  

**预期**：409 INVALID_STATE_TRANSITION  

**断言清单**：

- [ ] status==409
- [ ] error.code==INVALID_STATE_TRANSITION

### C.19 ST-005 / SD-005 / 空内容发布

**类别**：业务  

**描述**：尝试发布空内容博文  

**输入**：
```json
POST /posts {title, content: ""} then publish
```  

**预期**：409 EMPTY_CONTENT  

**断言清单**：

- [ ] status==409
- [ ] error.code==EMPTY_CONTENT

### C.20 ST-005 / SD-005 / 软删博文

**类别**：主路径  

**描述**：博主软删自己的博文  

**输入**：
```json
DELETE /posts/:id
```  

**预期**：204  

**断言清单**：

- [ ] status==deleted
- [ ] id 保留
- [ ] listPosts 不可见

### C.21 ST-006 / SD-006 / 1000 并发浏览

**类别**：性能  

**描述**：1000 并发访问热门博文  

**输入**：
```json
k6 1000 VU × 10 iter
```  

**预期**：P95 ≤ 200ms，0 错误  

**断言清单**：

- [ ] P95 ≤ 200ms
- [ ] 错误数 == 0
- [ ] viewCount 正确累加

### C.22 ST-006 / SD-006 / 5min 内存

**类别**：内存  

**描述**：1000 并发稳态 5 分钟，内存 ≤ 100MB  

**输入**：
```json
k6 1000 VU × 5min
```  

**预期**：heapUsed ≤ 100MB（采样峰值）  

**断言清单**：

- [ ] heapUsed < 100MB
- [ ] GC 频率 < 1/s
- [ ] 无 OOM

### C.23 ST-006 / SD-006 / 列表分页

**类别**：性能  

**描述**：列表分页 page=1, pageSize=20  

**输入**：
```json
GET /posts?page=1&pageSize=20
```  

**预期**：20 条 + total  

**断言清单**：

- [ ] items.length==20
- [ ] total 正确
- [ ] 不返回 status=deleted

### C.24 ST-007 / SD-007 / 点赞

**类别**：主路径  

**描述**：已登录 reader 点赞博文  

**输入**：
```json
POST /posts/:id/like
```  

**预期**：200 + {liked: true, likeCount}  

**断言清单**：

- [ ] status==200
- [ ] likeCount 递增

### C.25 ST-007 / SD-007 / 重复点赞幂等

**类别**：幂等  

**描述**：重复点赞同一博文  

**输入**：
```json
POST /posts/:id/like × 2
```  

**预期**：两次 200，likeCount 不重复 +1  

**断言清单**：

- [ ] likeCount 增加 1
- [ ] 不重复发通知

### C.26 ST-007 / SD-007 / 500 并发点赞

**类别**：性能  

**描述**：500 reader 并发点赞同一博文  

**输入**：
```json
k6 500 VU
```  

**预期**：P95 ≤ 200ms  

**断言清单**：

- [ ] P95 ≤ 200ms
- [ ] likeCount 准确

### C.27 ST-008 / SD-008 / 创建标签

**类别**：主路径  

**描述**：创建标签（通过博文附加）  

**输入**：
```json
POST /posts {tags: ["tech"]}
```  

**预期**：201 + tag 存在  

**断言清单**：

- [ ] tags 包含 "tech"
- [ ] tag 自动创建

### C.28 ST-008 / SD-008 / 标签下博文

**类别**：查询  

**描述**：查询标签下的博文  

**输入**：
```json
GET /tags/tech/posts
```  

**预期**：200 + items  

**断言清单**：

- [ ] items 不为空
- [ ] N+1 不发生

### C.29 ST-009 / SD-009 / 搜索关键词

**类别**：主路径  

**描述**：搜索包含 "hello" 的博文  

**输入**：
```json
GET /search?q=hello
```  

**预期**：200 + items 含高亮  

**断言清单**：

- [ ] items 非空
- [ ] score 合理
- [ ] snippet 含 <mark>

### C.30 ST-009 / SD-009 / 1000 博文搜索

**类别**：性能  

**描述**：1000 博文规模下搜索 P95  

**输入**：
```json
k6 100 VU × 10 iter on /search?q=common
```  

**预期**：P95 ≤ 200ms  

**断言清单**：

- [ ] P95 ≤ 200ms
- [ ] 0 错误

### C.31 ST-010 / SD-010 / 评论发表

**类别**：主路径  

**描述**：发表评论  

**输入**：
```json
POST /posts/:id/comments {content}
```  

**预期**：201 + {commentId}  

**断言清单**：

- [ ] status==201
- [ ] authorId==ctx.sub

### C.32 ST-010 / SD-010 / 回复评论

**类别**：业务  

**描述**：回复已有评论（parentId 存在）  

**输入**：
```json
POST /posts/:id/comments {content, parentId}
```  

**预期**：201 + 树深度+1  

**断言清单**：

- [ ] parentId 正确
- [ ] depth 不超限

### C.33 ST-010 / SD-010 / 深度超限

**类别**：业务  

**描述**：尝试回复 3 级评论  

**输入**：
```json
POST .../comments {parentId: depth3}
```  

**预期**：409 DEPTH_EXCEEDED  

**断言清单**：

- [ ] status==409
- [ ] error.code==DEPTH_EXCEEDED

### C.34 ST-010 / SD-010 / 评论树查询

**类别**：查询  

**描述**：获取博文评论树  

**输入**：
```json
GET /posts/:id/comments
```  

**预期**：200 + 树形结构  

**断言清单**：

- [ ] 树形结构
- [ ] deleted 评论显示「已删除」

### C.35 ST-011 / SD-011 / 关注通知

**类别**：扇出  

**描述**：博主发文，触发关注者通知  

**输入**：
```json
POST /posts/:id/publish
```  

**预期**：1000 关注者收到通知（异步）  

**断言清单**：

- [ ] 通知 fan-out 正确
- [ ] 去重窗口生效
- [ ] 5s 内完成

### C.36 ST-011 / SD-011 / 通知列表

**类别**：查询  

**描述**：查询我的通知  

**输入**：
```json
GET /me/notifications
```  

**预期**：200 + items  

**断言清单**：

- [ ] items 非空
- [ ] unread 正确

### C.37 ST-011 / SD-011 / 标记已读

**类别**：主路径  

**描述**：标记通知已读  

**输入**：
```json
POST /me/notifications/:id/read
```  

**预期**：200 + {readAt}  

**断言清单**：

- [ ] unread 递减
- [ ] readAt 存在

### C.38 ST-012 / SD-012 / RSS 订阅

**类别**：主路径  

**描述**：获取 RSS 2.0 源  

**输入**：
```json
GET /rss.xml
```  

**预期**：200 + application/rss+xml  

**断言清单**：

- [ ] content-type==application/rss+xml
- [ ] 最新 50 篇
- [ ] 合法 RSS 2.0

### C.39 ST-012 / SD-012 / RSS 缓存

**类别**：性能  

**描述**：100 并发 RSS 请求验证缓存  

**输入**：
```json
k6 100 VU
```  

**预期**：P95 ≤ 100ms（缓存命中）  

**断言清单**：

- [ ] P95 ≤ 100ms
- [ ] 5min 缓存生效

### C.40 ST-013 / SD-013 / 注册 Webhook

**类别**：主路径  

**描述**：注册 Webhook 订阅  

**输入**：
```json
POST /webhooks {url, events, secret}
```  

**预期**：201 + {webhookId}  

**断言清单**：

- [ ] webhookId 存在
- [ ] events 包含订阅事件

### C.41 ST-013 / SD-013 / Webhook 签名

**类别**：安全  

**描述**：验证回调签名 X-Webhook-Signature  

**输入**：
```json
mock 下游 5xx
```  

**预期**：回调带 X-Webhook-Signature（HMAC-SHA256）  

**断言清单**：

- [ ] 签名头存在
- [ ] 校验通过

### C.42 ST-013 / SD-013 / Webhook 重试

**类别**：可靠性  

**描述**：下游 5xx 触发 3 次重试  

**输入**：
```json
mock 3 次 5xx 后 200
```  

**预期**：3 次重试后成功  

**断言清单**：

- [ ] 重试次数==3
- [ ] 指数退避
- [ ] 最终成功

### C.43 ST-013 / SD-013 / 死信队列

**类别**：可靠性  

**描述**：持续 5xx 进死信  

**输入**：
```json
mock 持续 5xx
```  

**预期**：3 次后进死信队列  

**断言清单**：

- [ ] deadLetter 包含 delivery
- [ ] 可查询

### C.44 ST-014 / SD-014 / 查询配置

**类别**：主路径  

**描述**：查询站点配置  

**输入**：
```json
GET /site/config
```  

**预期**：200 + config  

**断言清单**：

- [ ] config 非空
- [ ] 公开字段可访问

### C.45 ST-014 / SD-014 / admin 更新

**类别**：授权  

**描述**：admin 更新站点配置  

**输入**：
```json
PUT /admin/site/config
```  

**预期**：200 + updated  

**断言清单**：

- [ ] status==200
- [ ] updatedAt 更新
- [ ] 审计记录

### C.46 ST-014 / SD-014 / 非 admin 更新

**类别**：安全  

**描述**：reader 尝试更新配置  

**输入**：
```json
PUT /admin/site/config (reader JWT)
```  

**预期**：403 NOT_ADMIN  

**断言清单**：

- [ ] status==403
- [ ] error.code==NOT_ADMIN

### C.47 ST-015 / SD-015 / 1000 并发访问

**类别**：可靠性  

**描述**：1000 并发请求触发访问记录  

**输入**：
```json
k6 1000 VU × 10 iter
```  

**预期**：0 错误，access_logs 累计正确  

**断言清单**：

- [ ] 错误数==0
- [ ] accessLogs.size==10000
- [ ] 不阻塞主流程

### C.48 ST-015 / SD-015 / 访问记录查询

**类别**：查询  

**描述**：admin 查询访问记录  

**输入**：
```json
GET /admin/access-logs
```  

**预期**：200 + items  

**断言清单**：

- [ ] items 非空
- [ ] 分页正确

### C.49 ST-016 / SD-016 / 审计写入

**类别**：主路径  

**描述**：每个写操作触发审计  

**输入**：
```json
POST /users (注册)
```  

**预期**：audit_logs 包含 user.registered  

**断言清单**：

- [ ] auditLog 存在
- [ ] 字段完整

### C.50 ST-016 / SD-016 / 审计查询

**类别**：查询  

**描述**：admin 查询审计日志  

**输入**：
```json
GET /admin/audit-logs
```  

**预期**：200 + items  

**断言清单**：

- [ ] items 非空
- [ ] 90 天范围内

### C.51 ST-016 / SD-016 / 90 天清理

**类别**：运维  

**描述**：audit_logs 超过 90 天被清理  

**输入**：
```json
mock 时间快进 91 天
```  

**预期**：老记录被清理  

**断言清单**：

- [ ] 清理脚本执行
- [ ] 新记录保留

### C.52 ST-017 / SD-017 / 统计查询

**类别**：主路径  

**描述**：admin 查询统计  

**输入**：
```json
GET /admin/stats
```  

**预期**：200 + 完整统计  

**断言清单**：

- [ ] 字段完整
- [ ] 缓存 5min

### C.53 ST-017 / SD-017 / 统计性能

**类别**：性能  

**描述**：100 并发统计查询  

**输入**：
```json
k6 100 VU
```  

**预期**：P95 ≤ 200ms  

**断言清单**：

- [ ] P95 ≤ 200ms
- [ ] 缓存命中

### C.54 ST-018 / SD-018 / 冷启动

**类别**：业务  

**描述**：新用户（无历史）获取推荐  

**输入**：
```json
GET /recommendations (新 user)
```  

**预期**：200 + 热门 10 篇  

**断言清单**：

- [ ] 非空
- [ ] fallback 热门

### C.55 ST-018 / SD-018 / 结果稳定

**类别**：业务  

**描述**：相同输入相同输出  

**输入**：
```json
GET /recommendations × 2 (同 user)
```  

**预期**：结果一致  

**断言清单**：

- [ ] items 顺序一致
- [ ] score 一致

### C.56 ST-019 / SD-019 / 时间窗内

**类别**：业务  

**描述**：now ∈ [startAt, endAt] 时返回广告  

**输入**：
```json
GET /ads/sidebar-top
```  

**预期**：200 + ad  

**断言清单**：

- [ ] ad 非空

### C.57 ST-019 / SD-019 / 时间窗外

**类别**：业务  

**描述**：now < startAt 或 now > endAt  

**输入**：
```json
GET /ads/sidebar-top (mock 时间)
```  

**预期**：200 + ad: null  

**断言清单**：

- [ ] ad==null

### C.58 ST-020 / SD-020 / 100/min 通过

**类别**：主路径  

**描述**：100 次请求全部 200  

**输入**：
```json
101 × GET /health
```  

**预期**：前 100 次 200，第 101 次 429  

**断言清单**：

- [ ] 1-100 成功
- [ ] 101 触发限流

### C.59 ST-020 / SD-020 / 滑动窗口

**类别**：业务  

**描述**：窗口滚动后重新允许  

**输入**：
```json
60s 后再请求
```  

**预期**：200（窗口已滑出）  

**断言清单**：

- [ ] 窗口正确滚动

### C.60 ST-020 / SD-020 / bypass 头

**类别**：测试  

**描述**：带 x-test-bypass-rate-limit 不触发  

**输入**：
```json
GET /health × 200 (bypass)
```  

**预期**：全部 200  

**断言清单**：

- [ ] 限流未触发

### C.61 ST-021 / SD-021 / 正常路由

**类别**：主路径  

**描述**：正确路径正确分发  

**输入**：
```json
GET /posts/01HXXX...
```  

**预期**：200 + 博文  

**断言清单**：

- [ ] SD-006 controller 处理

### C.62 ST-021 / SD-021 / 未知路由

**类别**：主路径  

**描述**：访问不存在路径  

**输入**：
```json
GET /no-such-path
```  

**预期**：404 ROUTE_NOT_FOUND  

**断言清单**：

- [ ] status==404
- [ ] error.code==ROUTE_NOT_FOUND

### C.63 ST-021 / SD-021 / 方法不允许

**类别**：主路径  

**描述**：GET / POST 路径但用 PUT  

**输入**：
```json
PUT /users/:id
```  

**预期**：405 METHOD_NOT_ALLOWED  

**断言清单**：

- [ ] status==405

### C.64 ST-022 / SD-022 / Validation 错误

**类别**：主路径  

**描述**：请求参数错误  

**输入**：
```json
POST /users {email: "x"}
```  

**预期**：400 VALIDATION_FAILED  

**断言清单**：

- [ ] status==400
- [ ] error.code==VALIDATION_FAILED
- [ ] details 列出字段

### C.65 ST-022 / SD-022 / 内部错误脱敏

**类别**：安全  

**描述**：注入异常，验证不暴露堆栈  

**输入**：
```json
mock 500
```  

**预期**：500 INTERNAL_ERROR，无 stack  

**断言清单**：

- [ ] status==500
- [ ] error.code==INTERNAL_ERROR
- [ ] 无堆栈泄漏

### C.66 ST-022 / SD-022 / requestId 贯穿

**类别**：可观测  

**描述**：错误响应包含 requestId  

**输入**：
```json
任意错误请求
```  

**预期**：response.requestId == header X-Request-Id  

**断言清单**：

- [ ] requestId 存在
- [ ] requestId 一致
## 附录 D：性能测试场景库（Performance Test Scenarios）

> 本附录为每个性能相关 ST 补充：k6 脚本框架、性能基线、瓶颈点。


### D.1 ST-001 登录压测

**目标并发**：100 VU  

**持续时间**：30s  

**性能基线**：

| 指标 | 阈值 | 实测 |
|---|---|---|
| P95 | ≤ 200ms | TBD |
| 错误率 | = 0 | TBD |

**k6 脚本框架**：

```javascript

// perf/st-001.js
import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latency = new Trend('latency');

export const options = {
  vus: 100,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    errors: ['rate==0'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/health');
  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  errorRate.add(!ok);
  latency.add(res.timings.duration);
}
```


### D.2 ST-006 博文浏览压测

**目标并发**：1000 VU  

**持续时间**：5m  

**性能基线**：

| 指标 | 阈值 | 实测 |
|---|---|---|
| P95 | ≤ 200ms | TBD |
| 错误率 | = 0 | TBD |
| RSS | ≤ 100MB | TBD |

**k6 脚本框架**：

```javascript

// perf/st-006.js
import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latency = new Trend('latency');

export const options = {
  vus: 1000,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    errors: ['rate==0'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/health');
  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  errorRate.add(!ok);
  latency.add(res.timings.duration);
}
```


### D.3 ST-007 互动压测

**目标并发**：500 VU  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 |
|---|---|---|
| P95 | ≤ 200ms | TBD |
| 错误率 | = 0 | TBD |

**k6 脚本框架**：

```javascript

// perf/st-007.js
import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latency = new Trend('latency');

export const options = {
  vus: 500,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    errors: ['rate==0'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/health');
  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  errorRate.add(!ok);
  latency.add(res.timings.duration);
}
```


### D.4 ST-008 标签查询

**目标并发**：200 VU  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 |
|---|---|---|
| P95 | ≤ 200ms | TBD |
| 错误率 | = 0 | TBD |

**k6 脚本框架**：

```javascript

// perf/st-008.js
import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latency = new Trend('latency');

export const options = {
  vus: 200,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    errors: ['rate==0'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/health');
  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  errorRate.add(!ok);
  latency.add(res.timings.duration);
}
```


### D.5 ST-009 全文搜索

**目标并发**：100 VU  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 |
|---|---|---|
| P95 | ≤ 200ms | TBD |
| 错误率 | = 0 | TBD |

**k6 脚本框架**：

```javascript

// perf/st-009.js
import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latency = new Trend('latency');

export const options = {
  vus: 100,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    errors: ['rate==0'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/health');
  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  errorRate.add(!ok);
  latency.add(res.timings.duration);
}
```


### D.6 ST-011 通知扇出

**目标并发**：1000 VU  

**持续时间**：5m  

**性能基线**：

| 指标 | 阈值 | 实测 |
|---|---|---|
| P95 | ≤ 500ms | TBD |
| 错误率 | = 0 | TBD |
| P99 | ≤ 1000ms | TBD |

**k6 脚本框架**：

```javascript

// perf/st-011.js
import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latency = new Trend('latency');

export const options = {
  vus: 1000,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate==0'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/health');
  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  errorRate.add(!ok);
  latency.add(res.timings.duration);
}
```


### D.7 ST-012 RSS 压测

**目标并发**：100 VU  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 |
|---|---|---|
| P95 | ≤ 100ms | TBD |
| 错误率 | = 0 | TBD |

**k6 脚本框架**：

```javascript

// perf/st-012.js
import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latency = new Trend('latency');

export const options = {
  vus: 100,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<100'],
    errors: ['rate==0'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/health');
  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  errorRate.add(!ok);
  latency.add(res.timings.duration);
}
```


### D.8 ST-015 访问记录

**目标并发**：2000 VU  

**持续时间**：5m  

**性能基线**：

| 指标 | 阈值 | 实测 |
|---|---|---|
| P95 | ≤ 300ms | TBD |
| 错误率 | = 0 | TBD |

**k6 脚本框架**：

```javascript

// perf/st-015.js
import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latency = new Trend('latency');

export const options = {
  vus: 2000,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(95)<300'],
    errors: ['rate==0'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/health');
  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  errorRate.add(!ok);
  latency.add(res.timings.duration);
}
```


### D.9 ST-016 审计写入

**目标并发**：1000 VU  

**持续时间**：5m  

**性能基线**：

| 指标 | 阈值 | 实测 |
|---|---|---|
| P95 | ≤ 200ms | TBD |
| 错误率 | = 0 | TBD |

**k6 脚本框架**：

```javascript

// perf/st-016.js
import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latency = new Trend('latency');

export const options = {
  vus: 1000,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    errors: ['rate==0'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/health');
  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  errorRate.add(!ok);
  latency.add(res.timings.duration);
}
```


### D.10 ST-017 统计查询

**目标并发**：50 VU  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 |
|---|---|---|
| P95 | ≤ 200ms | TBD |
| 错误率 | = 0 | TBD |

**k6 脚本框架**：

```javascript

// perf/st-017.js
import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latency = new Trend('latency');

export const options = {
  vus: 50,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    errors: ['rate==0'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/health');
  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  errorRate.add(!ok);
  latency.add(res.timings.duration);
}
```


## 附录 E：异常场景库（Chaos Scenarios）

> 本附录列出系统在异常输入、异常状态、异常环境下的预期行为。


### E.1 JWT 篡改

**输入**：Authorization: Bearer eyJ...modified  

**预期**：401 TOKEN_INVALID  


### E.2 JWT 过期

**输入**：Authorization: Bearer <expired-token>  

**预期**：401 TOKEN_EXPIRED  


### E.3 JWT 签名错误

**输入**：Authorization: Bearer <wrong-secret-signed>  

**预期**：401 TOKEN_INVALID  


### E.4 SQL 注入尝试

**输入**：POST /users {email: "x' OR 1=1--"}  

**预期**：400 VALIDATION_FAILED（Zod email 格式拦截）  


### E.5 XSS 尝试

**输入**：POST /posts {content: "<script>alert(1)</script>"}  

**预期**：201 + content 原样存储（XSS 责任在客户端渲染）  


### E.6 超长输入

**输入**：POST /posts {content: "A".repeat(100001)}  

**预期**：400 VALIDATION_FAILED  


### E.7 超长列表

**输入**：GET /posts?pageSize=10000  

**预期**：400 VALIDATION_FAILED（max=100）  


### E.8 空 body

**输入**：POST /users {}  

**预期**：400 VALIDATION_FAILED  


### E.9 缺失 Content-Type

**输入**：POST /users <no header>  

**预期**：400 VALIDATION_FAILED  


### E.10 CORS preflight

**输入**：OPTIONS /posts  

**预期**：200 + CORS 头  


### E.11 Slow loris

**输入**：慢速发送 headers  

**预期**：服务端超时关闭  


### E.12 IPv6 请求

**输入**：GET /health (IPv6)  

**预期**：200（IP 提取正确）  


### E.13 代理头伪造

**输入**：X-Forwarded-For: 1.2.3.4  

**预期**：按配置的 trust proxy 解析  


### E.14 时区差

**输入**：POST /posts (UTC+0 vs UTC+8)  

**预期**：统一使用 unix-ms 存储，无时区问题  


### E.15 闰秒

**输入**：mock 时间  

**预期**：Node.js Date 基于 UTC，无闰秒问题  


### E.16 进程 OOM 边缘

**输入**：1000 并发 + 1MB 响应  

**预期**：RSS 监控告警，请求继续  


### E.17 磁盘满（占位）

**输入**：mock 磁盘满  

**预期**：507 STORAGE_FULL（IN 内存部署不会触发）  


### E.18 EventBus 监听器抛错

**输入**：mock listener throw  

**预期**：错误降级到日志，不影响主流程  


### E.19 Webhook 下游 DNS 失败

**输入**：mock DNS 失败  

**预期**：ENOTFOUND 错误，触发重试  


### E.20 Webhook 下游超时

**输入**：mock 10s 响应  

**预期**：5s 超时，触发重试  


### E.21 并发 publish 同一 post

**输入**：POST /publish × 2  

**预期**：第 2 次 409 INVALID_STATE_TRANSITION  


### E.22 并发 follow 同一 blogger

**输入**：POST /follows/:id × 2  

**预期**：两次都 200，幂等  


### E.23 并发 like 同一 post

**输入**：POST /like × 2  

**预期**：两次都 200，幂等  


### E.24 访问不存在 ID

**输入**：GET /posts/01HNONEXISTENT  

**预期**：404 NOT_FOUND  


### E.25 admin 端点用 reader JWT

**输入**：GET /admin/stats (reader)  

**预期**：403 NOT_ADMIN  


### E.26 rate limit 跨 IP

**输入**：不同 IP 100 × N 次  

**预期**：各自独立计数  

## 附录 F：完整测试场景库（100+ Comprehensive Test Scenarios）

> 本附录提供 100+ 详细的测试场景，覆盖所有 SD/INTF/NFR/CON 组合。


### F.1 TC-001 正常注册（ST-001 / SD-001）

**严重程度**：P0  

**输入**：POST /users {email, username, password}  

**预期**：201 + userId  

**关联**：ST-001 / SD-001  


### F.2 TC-002 邮箱重复注册（ST-001 / SD-001）

**严重程度**：P1  

**输入**：POST /users {email重复}  

**预期**：409 EMAIL_TAKEN  

**关联**：ST-001 / SD-001  


### F.3 TC-003 用户名重复注册（ST-001 / SD-001）

**严重程度**：P1  

**输入**：POST /users {username重复}  

**预期**：409 USERNAME_TAKEN  

**关联**：ST-001 / SD-001  


### F.4 TC-004 密码过短（ST-001 / SD-001）

**严重程度**：P1  

**输入**：POST /users {password: "123"}  

**预期**：400 VALIDATION_FAILED  

**关联**：ST-001 / SD-001  


### F.5 TC-005 邮箱格式错（ST-001 / SD-001）

**严重程度**：P1  

**输入**：POST /users {email: "not-email"}  

**预期**：400 VALIDATION_FAILED  

**关联**：ST-001 / SD-001  


### F.6 TC-006 正常登录（ST-001 / SD-001）

**严重程度**：P0  

**输入**：POST /auth/login {正确}  

**预期**：200 + token  

**关联**：ST-001 / SD-001  


### F.7 TC-007 错密码登录（ST-001 / SD-001）

**严重程度**：P0  

**输入**：POST /auth/login {错密码}  

**预期**：401 INVALID_CREDENTIALS  

**关联**：ST-001 / SD-001  


### F.8 TC-008 不存在账号（ST-001 / SD-001）

**严重程度**：P0  

**输入**：POST /auth/login {不存在邮箱}  

**预期**：401 INVALID_CREDENTIALS  

**关联**：ST-001 / SD-001  


### F.9 TC-009 空 body 登录（ST-001 / SD-001）

**严重程度**：P1  

**输入**：POST /auth/login {}  

**预期**：400 VALIDATION_FAILED  

**关联**：ST-001 / SD-001  


### F.10 TC-010 100 并发登录（ST-001 / SD-001）

**严重程度**：P0  

**输入**：k6 100 VU  

**预期**：P95 ≤ 200ms  

**关联**：ST-001 / SD-001  


### F.11 TC-011 限流触发（ST-001 / SD-001）

**严重程度**：P0  

**输入**：101 次登录  

**预期**：429 RATE_LIMITED  

**关联**：ST-001 / SD-001  


### F.12 TC-012 匿名查资料（ST-002 / SD-002）

**严重程度**：P0  

**输入**：GET /users/:id (no JWT)  

**预期**：200 + 公开字段  

**关联**：ST-002 / SD-002  


### F.13 TC-013 修改自己资料（ST-002 / SD-002）

**严重程度**：P0  

**输入**：PUT /users/me (JWT)  

**预期**：200 + updated  

**关联**：ST-002 / SD-002  


### F.14 TC-014 越权修改（ST-002 / SD-002）

**严重程度**：P0  

**输入**：PUT /users/:otherId  

**预期**：403 NOT_OWNER  

**关联**：ST-002 / SD-002  


### F.15 TC-015 PII 字段隐藏（ST-002 / SD-002）

**严重程度**：P0  

**输入**：GET /users/:id (no JWT)  

**预期**：无 passwordHash/email  

**关联**：ST-002 / SD-002  


### F.16 TC-016 不存在用户（ST-002 / SD-002）

**严重程度**：P1  

**输入**：GET /users/01HNONEXISTENT  

**预期**：404 NOT_FOUND  

**关联**：ST-002 / SD-002  


### F.17 TC-017 关注博主（ST-003 / SD-003）

**严重程度**：P0  

**输入**：POST /follows/:bloggerId  

**预期**：200 + followed: true  

**关联**：ST-003 / SD-003  


### F.18 TC-018 重复关注（ST-003 / SD-003）

**严重程度**：P0  

**输入**：POST /follows/:id × 2  

**预期**：幂等，followed: true  

**关联**：ST-003 / SD-003  


### F.19 TC-019 取关（ST-003 / SD-003）

**严重程度**：P0  

**输入**：DELETE /follows/:id  

**预期**：200 + followed: false  

**关联**：ST-003 / SD-003  


### F.20 TC-020 关注自己（ST-003 / SD-003）

**严重程度**：P1  

**输入**：POST /follows/:selfId  

**预期**：403 SELF_FOLLOW  

**关联**：ST-003 / SD-003  


### F.21 TC-021 关注列表（ST-003 / SD-003）

**严重程度**：P0  

**输入**：GET /me/follows  

**预期**：200 + items  

**关联**：ST-003 / SD-003  


### F.22 TC-022 500 并发关注（ST-003 / SD-003）

**严重程度**：P1  

**输入**：k6 500 VU  

**预期**：P95 ≤ 200ms  

**关联**：ST-003 / SD-003  


### F.23 TC-023 博主注册（ST-004 / SD-004）

**严重程度**：P0  

**输入**：POST /bloggers  

**预期**：201 + bloggerId  

**关联**：ST-004 / SD-004  


### F.24 TC-024 多博主切换（ST-004 / SD-004）

**严重程度**：P0  

**输入**：POST /me/bloggers/:id/switch  

**预期**：200 + new token  

**关联**：ST-004 / SD-004  


### F.25 TC-025 切换非 own（ST-004 / SD-004）

**严重程度**：P0  

**输入**：POST /me/bloggers/:otherId/switch  

**预期**：403 NOT_OWNER  

**关联**：ST-004 / SD-004  


### F.26 TC-026 创建草稿（ST-005 / SD-005）

**严重程度**：P0  

**输入**：POST /posts  

**预期**：201 + draft  

**关联**：ST-005 / SD-005  


### F.27 TC-027 发布博文（ST-005 / SD-005）

**严重程度**：P0  

**输入**：POST /posts/:id/publish  

**预期**：200 + published  

**关联**：ST-005 / SD-005  


### F.28 TC-028 更新博文（ST-005 / SD-005）

**严重程度**：P0  

**输入**：PUT /posts/:id  

**预期**：200 + updated  

**关联**：ST-005 / SD-005  


### F.29 TC-029 软删博文（ST-005 / SD-005）

**严重程度**：P0  

**输入**：DELETE /posts/:id  

**预期**：204  

**关联**：ST-005 / SD-005  


### F.30 TC-030 空内容发布（ST-005 / SD-005）

**严重程度**：P0  

**输入**：publish (content="")  

**预期**：409 EMPTY_CONTENT  

**关联**：ST-005 / SD-005  


### F.31 TC-031 非法状态转移（ST-005 / SD-005）

**严重程度**：P0  

**输入**：PUT posts/{published} status=draft  

**预期**：409 INVALID_STATE_TRANSITION  

**关联**：ST-005 / SD-005  


### F.32 TC-032 并发 publish（ST-005 / SD-005）

**严重程度**：P1  

**输入**：publish × 2  

**预期**：第二次 409  

**关联**：ST-005 / SD-005  


### F.33 TC-033 非博主发帖（ST-005 / SD-005）

**严重程度**：P0  

**输入**：POST /posts (reader JWT)  

**预期**：403 NOT_BLOGGER  

**关联**：ST-005 / SD-005  


### F.34 TC-034 tag 数量超限（ST-005 / SD-005）

**严重程度**：P1  

**输入**：POST /posts {tags: [6个]}  

**预期**：400 VALIDATION_FAILED  

**关联**：ST-005 / SD-005  


### F.35 TC-035 获取博文（ST-006 / SD-006）

**严重程度**：P0  

**输入**：GET /posts/:id  

**预期**：200 + post  

**关联**：ST-006 / SD-006  


### F.36 TC-036 列表分页（ST-006 / SD-006）

**严重程度**：P0  

**输入**：GET /posts?page=1&pageSize=20  

**预期**：20 items  

**关联**：ST-006 / SD-006  


### F.37 TC-037 过滤 deleted（ST-006 / SD-006）

**严重程度**：P0  

**输入**：GET /posts  

**预期**：不含 status=deleted  

**关联**：ST-006 / SD-006  


### F.38 TC-038 按 tag 过滤（ST-006 / SD-006）

**严重程度**：P0  

**输入**：GET /posts?tag=tech  

**预期**：含 tech tag  

**关联**：ST-006 / SD-006  


### F.39 TC-039 按 author 过滤（ST-006 / SD-006）

**严重程度**：P0  

**输入**：GET /posts?authorId=01HXXX  

**预期**：该 author 的 posts  

**关联**：ST-006 / SD-006  


### F.40 TC-040 1000 并发浏览（ST-006 / SD-006）

**严重程度**：P0  

**输入**：k6 1000 VU  

**预期**：P95 ≤ 200ms  

**关联**：ST-006 / SD-006  


### F.41 TC-041 5min 内存稳态（ST-006 / SD-006）

**严重程度**：P0  

**输入**：k6 1000 VU × 5m  

**预期**：heap ≤ 100MB  

**关联**：ST-006 / SD-006  


### F.42 TC-042 viewCount 递增（ST-006 / SD-006）

**严重程度**：P1  

**输入**：GET /posts/:id × 10  

**预期**：viewCount=10  

**关联**：ST-006 / SD-006  


### F.43 TC-043 点赞（ST-007 / SD-007）

**严重程度**：P0  

**输入**：POST /posts/:id/like  

**预期**：200 + likeCount+1  

**关联**：ST-007 / SD-007  


### F.44 TC-044 取消点赞（ST-007 / SD-007）

**严重程度**：P0  

**输入**：POST /posts/:id/like (再次)  

**预期**：幂等  

**关联**：ST-007 / SD-007  


### F.45 TC-045 收藏（ST-007 / SD-007）

**严重程度**：P0  

**输入**：POST /posts/:id/favorite  

**预期**：200 + favorited  

**关联**：ST-007 / SD-007  


### F.46 TC-046 500 并发点赞（ST-007 / SD-007）

**严重程度**：P1  

**输入**：k6 500 VU  

**预期**：P95 ≤ 200ms  

**关联**：ST-007 / SD-007  


### F.47 TC-047 点赞数准确（ST-007 / SD-007）

**严重程度**：P1  

**输入**：100 用户各点赞  

**预期**：likeCount=100  

**关联**：ST-007 / SD-007  


### F.48 TC-048 创建标签（ST-008 / SD-008）

**严重程度**：P1  

**输入**：通过 POST /posts 隐式  

**预期**：tag 自动创建  

**关联**：ST-008 / SD-008  


### F.49 TC-049 查询标签（ST-008 / SD-008）

**严重程度**：P0  

**输入**：GET /tags  

**预期**：200 + items  

**关联**：ST-008 / SD-008  


### F.50 TC-050 标签下博文（ST-008 / SD-008）

**严重程度**：P0  

**输入**：GET /tags/:name/posts  

**预期**：200 + items  

**关联**：ST-008 / SD-008  


### F.51 TC-051 tag 不存在（ST-008 / SD-008）

**严重程度**：P1  

**输入**：GET /tags/notfound/posts  

**预期**：404 TAG_NOT_FOUND  

**关联**：ST-008 / SD-008  


### F.52 TC-052 搜索关键词（ST-009 / SD-009）

**严重程度**：P0  

**输入**：GET /search?q=hello  

**预期**：items 含匹配  

**关联**：ST-009 / SD-009  


### F.53 TC-053 高亮（ST-009 / SD-009）

**严重程度**：P0  

**输入**：GET /search?q=hello  

**预期**：snippet 含 <mark>  

**关联**：ST-009 / SD-009  


### F.54 TC-054 1000 博文搜索（ST-009 / SD-009）

**严重程度**：P0  

**输入**：k6 100 VU on /search  

**预期**：P95 ≤ 200ms  

**关联**：ST-009 / SD-009  


### F.55 TC-055 空查询（ST-009 / SD-009）

**严重程度**：P1  

**输入**：GET /search  

**预期**：400 VALIDATION_FAILED  

**关联**：ST-009 / SD-009  


### F.56 TC-056 发表评论（ST-010 / SD-010）

**严重程度**：P0  

**输入**：POST /posts/:id/comments  

**预期**：201 + commentId  

**关联**：ST-010 / SD-010  


### F.57 TC-057 回复评论（ST-010 / SD-010）

**严重程度**：P0  

**输入**：POST ... parentId=X  

**预期**：depth+1  

**关联**：ST-010 / SD-010  


### F.58 TC-058 深度超限（ST-010 / SD-010）

**严重程度**：P0  

**输入**：回复 3 级评论  

**预期**：409 DEPTH_EXCEEDED  

**关联**：ST-010 / SD-010  


### F.59 TC-059 软删评论（ST-010 / SD-010）

**严重程度**：P0  

**输入**：DELETE /comments/:id  

**预期**：204  

**关联**：ST-010 / SD-010  


### F.60 TC-060 评论树查询（ST-010 / SD-010）

**严重程度**：P0  

**输入**：GET /posts/:id/comments  

**预期**：树形结构  

**关联**：ST-010 / SD-010  


### F.61 TC-061 空内容评论（ST-010 / SD-010）

**严重程度**：P1  

**输入**：POST ... {content: ""}  

**预期**：400 VALIDATION_FAILED  

**关联**：ST-010 / SD-010  


### F.62 TC-062 关注通知（ST-011 / SD-011）

**严重程度**：P0  

**输入**：follow → publish  

**预期**：通知生成  

**关联**：ST-011 / SD-011  


### F.63 TC-063 评论通知（ST-011 / SD-011）

**严重程度**：P0  

**输入**：comment on post  

**预期**：博主通知  

**关联**：ST-011 / SD-011  


### F.64 TC-064 点赞通知（ST-011 / SD-011）

**严重程度**：P1  

**输入**：like post  

**预期**：作者通知  

**关联**：ST-011 / SD-011  


### F.65 TC-065 通知列表（ST-011 / SD-011）

**严重程度**：P0  

**输入**：GET /me/notifications  

**预期**：200 + items  

**关联**：ST-011 / SD-011  


### F.66 TC-066 标记已读（ST-011 / SD-011）

**严重程度**：P0  

**输入**：POST /me/notifications/:id/read  

**预期**：200  

**关联**：ST-011 / SD-011  


### F.67 TC-067 1000 扇出（ST-011 / SD-011）

**严重程度**：P1  

**输入**：publish to 1000 followers  

**预期**：5s 内完成  

**关联**：ST-011 / SD-011  


### F.68 TC-068 RSS 订阅（ST-012 / SD-012）

**严重程度**：P0  

**输入**：GET /rss.xml  

**预期**：200 + RSS 2.0  

**关联**：ST-012 / SD-012  


### F.69 TC-069 最新 50 篇（ST-012 / SD-012）

**严重程度**：P0  

**输入**：100 博文 → RSS  

**预期**：50 条  

**关联**：ST-012 / SD-012  


### F.70 TC-070 缓存命中（ST-012 / SD-012）

**严重程度**：P1  

**输入**：100 并发 RSS  

**预期**：P95 ≤ 100ms  

**关联**：ST-012 / SD-012  


### F.71 TC-071 注册 Webhook（ST-013 / SD-013）

**严重程度**：P0  

**输入**：POST /webhooks  

**预期**：201 + webhookId  

**关联**：ST-013 / SD-013  


### F.72 TC-072 签名验证（ST-013 / SD-013）

**严重程度**：P0  

**输入**：mock 接收回调  

**预期**：X-Webhook-Signature 正确  

**关联**：ST-013 / SD-013  


### F.73 TC-073 重试 5xx（ST-013 / SD-013）

**严重程度**：P0  

**输入**：mock 5xx × 3 → 200  

**预期**：3 次后成功  

**关联**：ST-013 / SD-013  


### F.74 TC-074 死信队列（ST-013 / SD-013）

**严重程度**：P0  

**输入**：mock 持续 5xx  

**预期**：3 次后进死信  

**关联**：ST-013 / SD-013  


### F.75 TC-075 超时 5s（ST-013 / SD-013）

**严重程度**：P0  

**输入**：mock 10s 响应  

**预期**：5s 超时  

**关联**：ST-013 / SD-013  


### F.76 TC-076 非 admin 注册（ST-013 / SD-013）

**严重程度**：P0  

**输入**：POST /webhooks (reader)  

**预期**：403 NOT_ADMIN  

**关联**：ST-013 / SD-013  


### F.77 TC-077 查询配置（ST-014 / SD-014）

**严重程度**：P0  

**输入**：GET /site/config  

**预期**：200 + config  

**关联**：ST-014 / SD-014  


### F.78 TC-078 admin 更新（ST-014 / SD-014）

**严重程度**：P0  

**输入**：PUT /admin/site/config  

**预期**：200  

**关联**：ST-014 / SD-014  


### F.79 TC-079 reader 更新（ST-014 / SD-014）

**严重程度**：P0  

**输入**：PUT /admin/site/config (reader)  

**预期**：403 NOT_ADMIN  

**关联**：ST-014 / SD-014  


### F.80 TC-080 并发配置写（ST-014 / SD-014）

**严重程度**：P1  

**输入**：PUT × 2  

**预期**：最新写赢  

**关联**：ST-014 / SD-014  


### F.81 TC-081 1000 并发访问（ST-015 / SD-015）

**严重程度**：P0  

**输入**：k6 1000 VU  

**预期**：0 错误  

**关联**：ST-015 / SD-015  


### F.82 TC-082 访问记录查询（ST-015 / SD-015）

**严重程度**：P0  

**输入**：GET /admin/access-logs  

**预期**：200 + items  

**关联**：ST-015 / SD-015  


### F.83 TC-083 环形缓冲滚动（ST-015 / SD-015）

**严重程度**：P1  

**输入**：写 100k+ 条  

**预期**：覆盖最早  

**关联**：ST-015 / SD-015  


### F.84 TC-084 审计写入（ST-016 / SD-016）

**严重程度**：P0  

**输入**：任意写操作  

**预期**：auditLog 存在  

**关联**：ST-016 / SD-016  


### F.85 TC-085 审计查询（ST-016 / SD-016）

**严重程度**：P0  

**输入**：GET /admin/audit-logs  

**预期**：200 + items  

**关联**：ST-016 / SD-016  


### F.86 TC-086 90 天清理（ST-016 / SD-016）

**严重程度**：P0  

**输入**：mock 时间快进  

**预期**：老记录清理  

**关联**：ST-016 / SD-016  


### F.87 TC-087 不可篡改（ST-016 / SD-016）

**严重程度**：P1  

**输入**：尝试修改 auditLog  

**预期**：签名校验失败  

**关联**：ST-016 / SD-016  


### F.88 TC-088 统计查询（ST-017 / SD-017）

**严重程度**：P0  

**输入**：GET /admin/stats  

**预期**：200 + 完整  

**关联**：ST-017 / SD-017  


### F.89 TC-089 100 并发统计（ST-017 / SD-017）

**严重程度**：P0  

**输入**：k6 100 VU  

**预期**：P95 ≤ 200ms  

**关联**：ST-017 / SD-017  


### F.90 TC-090 缓存命中（ST-017 / SD-017）

**严重程度**：P1  

**输入**：同 query 2 次  

**预期**：第 2 次更快  

**关联**：ST-017 / SD-017  


### F.91 TC-091 新用户推荐（ST-018 / SD-018）

**严重程度**：P0  

**输入**：GET /recommendations (新 user)  

**预期**：热门 10 篇  

**关联**：ST-018 / SD-018  


### F.92 TC-092 老用户推荐（ST-018 / SD-018）

**严重程度**：P0  

**输入**：GET /recommendations (老 user)  

**预期**：个性化  

**关联**：ST-018 / SD-018  


### F.93 TC-093 结果稳定（ST-018 / SD-018）

**严重程度**：P1  

**输入**：GET /recommendations × 2  

**预期**：结果一致  

**关联**：ST-018 / SD-018  


### F.94 TC-094 时间窗内（ST-019 / SD-019）

**严重程度**：P0  

**输入**：GET /ads/:slot (now∈窗)  

**预期**：ad 非空  

**关联**：ST-019 / SD-019  


### F.95 TC-095 时间窗外（ST-019 / SD-019）

**严重程度**：P0  

**输入**：GET /ads/:slot (now∉窗)  

**预期**：ad: null  

**关联**：ST-019 / SD-019  


### F.96 TC-096 权重随机（ST-019 / SD-019）

**严重程度**：P2  

**输入**：1000 次请求  

**预期**：分布符合权重  

**关联**：ST-019 / SD-019  


### F.97 TC-097 100/min 通过（ST-020 / SD-020）

**严重程度**：P0  

**输入**：100 次 /health  

**预期**：全 200  

**关联**：ST-020 / SD-020  


### F.98 TC-098 101 触发（ST-020 / SD-020）

**严重程度**：P0  

**输入**：101 次 /health  

**预期**：429 + Retry-After: 60  

**关联**：ST-020 / SD-020  


### F.99 TC-099 滑动窗口（ST-020 / SD-020）

**严重程度**：P0  

**输入**：60s 后再请求  

**预期**：200（窗口已滑出）  

**关联**：ST-020 / SD-020  


### F.100 TC-100 bypass 头（ST-020 / SD-020）

**严重程度**：P0  

**输入**：带 x-test-bypass-rate-limit  

**预期**：不限流  

**关联**：ST-020 / SD-020  


### F.101 TC-101 正常路由（ST-021 / SD-021）

**严重程度**：P0  

**输入**：GET /posts/01HXXX  

**预期**：200  

**关联**：ST-021 / SD-021  


### F.102 TC-102 未知路由（ST-021 / SD-021）

**严重程度**：P0  

**输入**：GET /no-such  

**预期**：404  

**关联**：ST-021 / SD-021  


### F.103 TC-103 方法不允许（ST-021 / SD-021）

**严重程度**：P1  

**输入**：PUT /health  

**预期**：405  

**关联**：ST-021 / SD-021  


### F.104 TC-104 Validation 错误（ST-022 / SD-022）

**严重程度**：P0  

**输入**：POST /users {}  

**预期**：400 + details  

**关联**：ST-022 / SD-022  


### F.105 TC-105 内部错误脱敏（ST-022 / SD-022）

**严重程度**：P0  

**输入**：mock 500  

**预期**：无堆栈  

**关联**：ST-022 / SD-022  


### F.106 TC-106 requestId 贯穿（ST-022 / SD-022）

**严重程度**：P0  

**输入**：任意请求  

**预期**：response.requestId == X-Request-Id  

**关联**：ST-022 / SD-022  


### F.107 TC-107 错误码字典（ST-022 / SD-022）

**严重程度**：P0  

**输入**：所有错误响应  

**预期**：error.code ∈ 字典  

**关联**：ST-022 / SD-022  

## 附录 G：扩展测试场景库（200+ Test Scenarios）

> 本附录提供 200+ 详细测试场景，覆盖所有 SD/INTF 的边界条件、组合场景、性能基线。


### G.1 ST-001 / bcrypt 性能

**严重程度**：P1  

**输入**：100 并发注册  

**预期**：单次 < 200ms  


### G.2 ST-001 / JWT 验证性能

**严重程度**：P1  

**输入**：1000 并发验证  

**预期**：P95 ≤ 50ms  


### G.3 ST-001 / 并发同账号登录

**严重程度**：P1  

**输入**：同 user 10 并发登录  

**预期**：10 个 token 全部有效  


### G.4 ST-002 / 长 bio 截断

**严重程度**：P2  

**输入**：bio 500 字符  

**预期**：完整保存  


### G.5 ST-002 / 超长 bio

**严重程度**：P2  

**输入**：bio 501 字符  

**预期**：400  


### G.6 ST-002 / XSS 防御

**严重程度**：P1  

**输入**：displayName <script>  

**预期**：原样保存（不渲染）  


### G.7 ST-003 / 取消再关注通知

**严重程度**：P1  

**输入**：follow → unfollow → follow  

**预期**：不重复通知  


### G.8 ST-003 / 自己关注自己

**严重程度**：P0  

**输入**：POST /follows/self  

**预期**：403 SELF_FOLLOW  


### G.9 ST-003 / 关注不存在 blogger

**严重程度**：P1  

**输入**：POST /follows/01HXXX  

**预期**：404 NOT_FOUND  


### G.10 ST-004 / 博主邮箱冲突

**严重程度**：P1  

**输入**：与 reader 同邮箱  

**预期**：409 EMAIL_TAKEN  


### G.11 ST-004 / 用户名冲突

**严重程度**：P1  

**输入**：与 reader 同 username  

**预期**：409 USERNAME_TAKEN  


### G.12 ST-004 / 切换后发文

**严重程度**：P0  

**输入**：switch → POST /posts  

**预期**：authorId = new blogger  


### G.13 ST-005 / 并发 create

**严重程度**：P1  

**输入**：POST /posts × 2  

**预期**：2 个 postId 不同  


### G.14 ST-005 / 草稿更新次数

**严重程度**：P2  

**输入**：PUT /posts/:id × 10  

**预期**：updatedAt 持续更新  


### G.15 ST-005 / 软删后恢复

**严重程度**：P1  

**输入**：DELETE → 修改 → ?  

**预期**：修改 409（已删）  


### G.16 ST-005 / 发布非 own

**严重程度**：P0  

**输入**：publish 他人 post  

**预期**：403 NOT_OWNER  


### G.17 ST-005 / 并发 publish

**严重程度**：P1  

**输入**：publish × 2  

**预期**：第 2 次 409  


### G.18 ST-005 / tag 5 个限制

**严重程度**：P1  

**输入**：tags = 6 个  

**预期**：400  


### G.19 ST-005 / tag 重复

**严重程度**：P2  

**输入**：tags = [tech, tech]  

**预期**：去重  


### G.20 ST-006 / viewCount 并发

**严重程度**：P1  

**输入**：1000 并发 GET  

**预期**：viewCount = 1000  


### G.21 ST-006 / deleted 不在 list

**严重程度**：P0  

**输入**：GET /posts  

**预期**：无 status=deleted  


### G.22 ST-006 / draft 不公开

**严重程度**：P0  

**输入**：GET /posts/:draftId (no auth)  

**预期**：404 NOT_PUBLISHED  


### G.23 ST-006 / 大 pageSize

**严重程度**：P1  

**输入**：pageSize=100  

**预期**：正常返回  


### G.24 ST-006 / page 越界

**严重程度**：P2  

**输入**：page=999  

**预期**：200 + 空 items  


### G.25 ST-006 / 排序 by recent

**严重程度**：P1  

**输入**：sort=recent  

**预期**：按 publishedAt DESC  


### G.26 ST-006 / 排序 by popular

**严重程度**：P1  

**输入**：sort=popular  

**预期**：按 viewCount DESC  


### G.27 ST-006 / 缓存命中

**严重程度**：P2  

**输入**：GET 100 次相同 post  

**预期**：P95 显著下降  


### G.28 ST-007 / 并发 unlike

**严重程度**：P1  

**输入**：unlike × 2  

**预期**：幂等  


### G.29 ST-007 / like 非存在

**严重程度**：P1  

**输入**：like /posts/01HNONE  

**预期**：404  


### G.30 ST-007 / 未登录点赞

**严重程度**：P0  

**输入**：like (no JWT)  

**预期**：401  


### G.31 ST-007 / 点赞数实时

**严重程度**：P1  

**输入**：like 10 次  

**预期**：likeCount=10  


### G.32 ST-007 / favorite 数实时

**严重程度**：P2  

**输入**：fav 10 次  

**预期**：favCount=10  


### G.33 ST-008 / tag 数量

**严重程度**：P2  

**输入**：100 不同 tag  

**预期**：全部创建  


### G.34 ST-008 / tag 列表排序

**严重程度**：P2  

**输入**：GET /tags  

**预期**：按 postCount DESC  


### G.35 ST-008 / tag 不存在

**严重程度**：P1  

**输入**：GET /tags/none/posts  

**预期**：404  


### G.36 ST-008 / tag 大小写

**严重程度**：P1  

**输入**：POST tags=[Tech]  

**预期**：归一化为 tech  


### G.37 ST-009 / 搜索空结果

**严重程度**：P2  

**输入**：q=zzzzz  

**预期**：200 + 空 items  


### G.38 ST-009 / 搜索特殊字符

**严重程度**：P1  

**输入**：q=<script>  

**预期**：200 + 空 items  


### G.39 ST-009 / 搜索中文

**严重程度**：P1  

**输入**：q=你好  

**预期**：分词匹配  


### G.40 ST-009 / 搜索 + 标签过滤

**严重程度**：P2  

**输入**：q=hello&tag=tech  

**预期**：联合过滤  


### G.41 ST-009 / 搜索分页

**严重程度**：P2  

**输入**：q=common&page=2  

**预期**：下一页 items  


### G.42 ST-010 / 评论 1000 字符

**严重程度**：P2  

**输入**：content 1000 chars  

**预期**：200  


### G.43 ST-010 / 评论 1001 字符

**严重程度**：P1  

**输入**：content 1001 chars  

**预期**：400  


### G.44 ST-010 / 评论不存在 post

**严重程度**：P1  

**输入**：comment /posts/01HNONE  

**预期**：404  


### G.45 ST-010 / 评论树深度 0

**严重程度**：P1  

**输入**：顶层评论  

**预期**：depth=0  


### G.46 ST-010 / 评论树深度 1

**严重程度**：P1  

**输入**：回复顶层  

**预期**：depth=1  


### G.47 ST-010 / 评论树深度 2

**严重程度**：P1  

**输入**：回复回复  

**预期**：depth=2  


### G.48 ST-010 / 评论树深度 3

**严重程度**：P0  

**输入**：回复回复回复  

**预期**：409 DEPTH_EXCEEDED  


### G.49 ST-010 / 删除显示已删

**严重程度**：P1  

**输入**：DELETE 后 GET  

**预期**：显示"该评论已删除"  


### G.50 ST-010 / 子评论保留

**严重程度**：P1  

**输入**：删父保留子  

**预期**：子评论可见  


### G.51 ST-010 / 非作者删评论

**严重程度**：P0  

**输入**：DELETE 他人评论  

**预期**：403  


### G.52 ST-010 / post 作者删评论

**严重程度**：P1  

**输入**：博文作者删  

**预期**：204  


### G.53 ST-011 / 通知未读数

**严重程度**：P1  

**输入**：unread 计数  

**预期**：正确  


### G.54 ST-011 / 通知分页

**严重程度**：P2  

**输入**：100 通知  

**预期**：分页正确  


### G.55 ST-011 / 通知去重

**严重程度**：P1  

**输入**：同事件 2 次  

**预期**：不重复  


### G.56 ST-011 / 通知优先级

**严重程度**：P2  

**输入**：urgent vs info  

**预期**：排序正确  


### G.57 ST-011 / 标记全部已读

**严重程度**：P1  

**输入**：POST /me/notifications/read-all  

**预期**：unread=0  


### G.58 ST-011 / 通知 90 天清理

**严重程度**：P1  

**输入**：mock 时间  

**预期**：老通知清理  


### G.59 ST-012 / RSS 缓存命中

**严重程度**：P2  

**输入**：GET 100 次  

**预期**：第 1 次慢，后续快  


### G.60 ST-012 / RSS publish 失效

**严重程度**：P1  

**输入**：publish → GET  

**预期**：包含新博文  


### G.61 ST-012 / RSS 字段完整性

**严重程度**：P1  

**输入**：检查所有字段  

**预期**：title/link/pubDate/description  


### G.62 ST-012 / RSS content-type

**严重程度**：P1  

**输入**：检查 header  

**预期**：application/rss+xml  


### G.63 ST-013 / Webhook 重试间隔

**严重程度**：P1  

**输入**：mock 5xx  

**预期**：1s/2s/4s 退避  


### G.64 ST-013 / Webhook 签名算法

**严重程度**：P0  

**输入**：mock 接收  

**预期**：HMAC-SHA256  


### G.65 ST-013 / Webhook 签名错误

**严重程度**：P0  

**输入**：mock 篡改 payload  

**预期**：下游 401  


### G.66 ST-013 / Webhook 取消订阅

**严重程度**：P1  

**输入**：DELETE /webhooks/:id  

**预期**：后续不再投递  


### G.67 ST-013 / Webhook 多订阅者

**严重程度**：P1  

**输入**：3 订阅者  

**预期**：全部投递  


### G.68 ST-013 / Webhook 死信告警

**严重程度**：P1  

**输入**：持续 5xx  

**预期**：webhook_dead_letter_total > 0  


### G.69 ST-013 / Webhook admin 鉴权

**严重程度**：P0  

**输入**：reader 注册  

**预期**：403  


### G.70 ST-013 / Webhook URL 校验

**严重程度**：P1  

**输入**：url=http://  

**预期**：400（非 HTTPS）  


### G.71 ST-014 / 配置加密字段

**严重程度**：P1  

**输入**：secret 字段  

**预期**：不返回明文  


### G.72 ST-014 / 配置回滚

**严重程度**：P2  

**输入**：POST /rollback  

**预期**：回到上一版本  


### G.73 ST-014 / 配置历史

**严重程度**：P2  

**输入**：GET /admin/config/history  

**预期**：30 天内历史  


### G.74 ST-014 / 配置热更新

**严重程度**：P1  

**输入**：PUT config → 立即生效  

**预期**：GET 看到新值  


### G.75 ST-015 / access log 采样

**严重程度**：P2  

**输入**：100% → 1%  

**预期**：内存降低  


### G.76 ST-015 / access log 满

**严重程度**：P1  

**输入**：写 100k+  

**预期**：覆盖最早  


### G.77 ST-015 / access log 查询过滤

**严重程度**：P1  

**输入**：GET ?path=/posts  

**预期**：仅 path 匹配  


### G.78 ST-015 / access log 时间范围

**严重程度**：P2  

**输入**：GET ?from=...&to=...  

**预期**：时间范围  


### G.79 ST-016 / 审计不可篡改

**严重程度**：P0  

**输入**：尝试修改 audit  

**预期**：签名校验失败  


### G.80 ST-016 / 审计查询按 actor

**严重程度**：P1  

**输入**：GET ?actorId=01HXXX  

**预期**：该 actor 的审计  


### G.81 ST-016 / 审计查询按 action

**严重程度**：P1  

**输入**：GET ?action=post.published  

**预期**：该 action 的审计  


### G.82 ST-016 / 审计导出

**严重程度**：P2  

**输入**：GET /admin/audit-logs/export  

**预期**：CSV 下载  


### G.83 ST-016 / 审计 90 天后清理

**严重程度**：P0  

**输入**：mock 时间  

**预期**：老记录清理  


### G.84 ST-016 / 审计实时性

**严重程度**：P1  

**输入**：操作后立即查询  

**预期**：可见  


### G.85 ST-017 / 统计准确性

**严重程度**：P1  

**输入**：与原始数据对比  

**预期**：一致  


### G.86 ST-017 / 统计 5min 缓存

**严重程度**：P2  

**输入**：GET 2 次  

**预期**：第 2 次来自缓存  


### G.87 ST-017 / 统计 1min 滞后

**严重程度**：P2  

**输入**：操作后 1min  

**预期**：统计更新  


### G.88 ST-018 / 推荐解释

**严重程度**：P2  

**输入**：GET /recommendations?explain=true  

**预期**：返回 reason  


### G.89 ST-018 / 推荐反馈

**严重程度**：P2  

**输入**：POST /recommendations/:id/feedback  

**预期**：更新用户向量  


### G.90 ST-018 / 推荐 A/B

**严重程度**：P2  

**输入**：不同 user 不同结果  

**预期**：A/B 桶正确  


### G.91 ST-018 / 推荐多样性

**严重程度**：P2  

**输入**：10 篇不全部同 tag  

**预期**：多样性保证  


### G.92 ST-019 / 广告曝光统计

**严重程度**：P1  

**输入**：GET 100 次  

**预期**：impressionCount=100  


### G.93 ST-019 / 广告点击

**严重程度**：P1  

**输入**：POST /ads/:id/click  

**预期**：clickCount+1  


### G.94 ST-019 / 广告频控

**严重程度**：P2  

**输入**：同 user 1h 内 5 次  

**预期**：第 6 次不展示  


### G.95 ST-019 / 广告审核

**严重程度**：P1  

**输入**：审核未通过  

**预期**：不展示  


### G.96 ST-020 / 限流 IP 隔离

**严重程度**：P1  

**输入**：不同 IP  

**预期**：独立计数  


### G.97 ST-020 / 限流豁免

**严重程度**：P0  

**输入**：/health  

**预期**：不限流  


### G.98 ST-020 / 限流白名单

**严重程度**：P2  

**输入**：白名单 IP  

**预期**：不限流  


### G.99 ST-020 / 限流告警

**严重程度**：P1  

**输入**：持续 429  

**预期**：rate_limit_blocked_total > 0  


### G.100 ST-020 / 限流 LRU 淘汰

**严重程度**：P2  

**输入**：10001 IP  

**预期**：最早 IP 淘汰  


### G.101 ST-021 / 路由大小写

**严重程度**：P2  

**输入**：GET /POSTS  

**预期**：404（case-sensitive）  


### G.102 ST-021 / 路由尾部斜杠

**严重程度**：P2  

**输入**：GET /posts/  

**预期**：200 或 301  


### G.103 ST-021 / 路由版本

**严重程度**：P2  

**输入**：GET /v1/posts  

**预期**：200  


### G.104 ST-021 / OPTIONS 预检

**严重程度**：P1  

**输入**：OPTIONS /posts  

**预期**：CORS 头  


### G.105 ST-022 / 错误 requestId

**严重程度**：P0  

**输入**：任意错误  

**预期**：response.requestId 存在  


### G.106 ST-022 / 错误国际化

**严重程度**：P2  

**输入**：Accept-Language: en  

**预期**：英文 message  


### G.107 ST-022 / 错误聚合

**严重程度**：P2  

**输入**：同 code 多次  

**预期**：metrics 计数  


### G.108 ST-022 / 错误恢复

**严重程度**：P2  

**输入**：retry-after 自动  

**预期**：客户端可重试  


### G.109 ST-022 / 错误码字典

**严重程度**：P0  

**输入**：所有错误  

**预期**：code ∈ 字典  


### G.110 ST-022 / 错误堆栈日志

**严重程度**：P1  

**输入**：500  

**预期**：日志有 stack  

## 附录 H：扩展测试场景库第二批（150+ Continued）


### H.1 ST-001 / 并发注册同邮箱

**输入**：POST /users 同 email × 2  

**预期**：1 成功 1 409  


### H.2 ST-001 / 并发注册同用户名

**输入**：POST /users 同 username × 2  

**预期**：1 成功 1 409  


### H.3 ST-001 / 密码含特殊字符

**输入**：password: P@$$w0rd!  

**预期**：200  


### H.4 ST-001 / 用户名含中文

**输入**：username: 用户名  

**预期**：200  


### H.5 ST-001 / 邮箱超长

**输入**：email: 254+1 chars  

**预期**：400  


### H.6 ST-001 / 用户名超长

**输入**：username: 20+1 chars  

**预期**：400  


### H.7 ST-001 / 用户名含特殊字符

**输入**：username: user@123  

**预期**：400  


### H.8 ST-001 / 登录大小写邮箱

**输入**：email: U1@TEST.COM  

**预期**：200（不区分大小写）  


### H.9 ST-001 / 登录额外字段

**输入**：{email, password, extra}  

**预期**：200（忽略 extra）  


### H.10 ST-001 / 登录 Content-Type 错

**输入**：Content-Type: text/plain  

**预期**：400  


### H.11 ST-002 / 查看自己资料

**输入**：GET /users/me  

**预期**：200 + 自己资料  


### H.12 ST-002 / 修改 displayName 50 字符

**输入**：PUT /users/me {displayName: 50 chars}  

**预期**：200  


### H.13 ST-002 / 修改 displayName 51 字符

**输入**：PUT /users/me {displayName: 51 chars}  

**预期**：400  


### H.14 ST-002 / 修改 avatarUrl 错

**输入**：PUT /users/me {avatarUrl: "not url"}  

**预期**：200（不验证 URL 格式）  


### H.15 ST-002 / PII 字段隐藏确认

**输入**：GET /users/:id  

**预期**：无 passwordHash 字段  


### H.16 ST-003 / 关注列表分页

**输入**：GET /me/follows?page=2&pageSize=20  

**预期**：下一页  


### H.17 ST-003 / 关注列表排序

**输入**：GET /me/follows?sort=recent  

**预期**：按 followedAt DESC  


### H.18 ST-003 / 关注者列表

**输入**：GET /bloggers/:id/followers  

**预期**：200 + followers  


### H.19 ST-003 / 关注状态查询

**输入**：GET /me/follows/:id/status  

**预期**：200 + {followed: true|false}  


### H.20 ST-004 / 切换到不存在的 blogger

**输入**：POST /me/bloggers/01HNONE/switch  

**预期**：404  


### H.21 ST-004 / 切换到非 own

**输入**：POST /me/bloggers/otherId/switch  

**预期**：403  


### H.22 ST-004 / 我的博主列表

**输入**：GET /me/bloggers  

**预期**：200 + items  


### H.23 ST-005 / 并发 create 100

**输入**：POST /posts × 100  

**预期**：100 个 postId  


### H.24 ST-005 / 更新 title 200 字符

**输入**：PUT /posts/:id {title: 200 chars}  

**预期**：200  


### H.25 ST-005 / 更新 title 201 字符

**输入**：PUT /posts/:id {title: 201 chars}  

**预期**：400  


### H.26 ST-005 / 更新 content 100000 字符

**输入**：PUT /posts/:id {content: 100000 chars}  

**预期**：200  


### H.27 ST-005 / 更新 content 100001 字符

**输入**：PUT /posts/:id {content: 100001 chars}  

**预期**：400  


### H.28 ST-005 / 并发 update 同一 post

**输入**：PUT /posts/:id × 2  

**预期**：last write wins  


### H.29 ST-005 / 删除后 list

**输入**：DELETE /posts/:id → GET /posts  

**预期**：不可见  


### H.30 ST-005 / tag 自动 lowercase

**输入**：POST /posts {tags: [Tech, TECH]}  

**预期**：归一化为 tech  


### H.31 ST-005 / tag 重复去重

**输入**：POST /posts {tags: [tech, tech]}  

**预期**：保存为 [tech]  


### H.32 ST-005 / content 仅空白

**输入**：POST /posts {content: "   "}  

**预期**：可创建（publish 时 409）  


### H.33 ST-005 / excerpt 自动生成

**输入**：POST /posts {content: 长文}  

**预期**：excerpt 0-300 字符  


### H.34 ST-006 / viewCount 并发准确性

**输入**：1000 并发 GET  

**预期**：viewCount = 1000  


### H.35 ST-006 / 缓存命中率

**输入**：1000 次同 post  

**预期**：P95 显著降低  


### H.36 ST-006 / 不同 sort

**输入**：sort=popular  

**预期**：按 viewCount DESC  


### H.37 ST-006 / tag 过滤准确

**输入**：GET /posts?tag=tech  

**预期**：仅含 tech 的 post  


### H.38 ST-006 / 多 tag 过滤

**输入**：GET /posts?tag=tech&tag=js  

**预期**：AND 关系  


### H.39 ST-006 / author 过滤

**输入**：GET /posts?authorId=01HXXX  

**预期**：该 author 的 post  


### H.40 ST-006 / date 范围过滤

**输入**：?from=...&to=...  

**预期**：时间范围内  


### H.41 ST-006 / q 模糊搜索

**输入**：GET /posts?q=hello  

**预期**：含 hello 的 post  


### H.42 ST-007 / like 数累加

**输入**：100 用户各 like  

**预期**：likeCount=100  


### H.43 ST-007 / unlike 数递减

**输入**：100 like → 50 unlike  

**预期**：likeCount=50  


### H.44 ST-007 / fav 数累加

**输入**：100 用户各 fav  

**预期**：favCount=100  


### H.45 ST-007 / 并发 unlike

**输入**：unlike × 2  

**预期**：幂等  


### H.46 ST-007 / likers 列表

**输入**：GET /posts/:id/likers  

**预期**：200 + users  


### H.47 ST-007 / favoriters 列表

**输入**：GET /posts/:id/favoriters  

**预期**：200 + users  


### H.48 ST-007 / 我点赞的

**输入**：GET /me/likes  

**预期**：200 + items  


### H.49 ST-007 / 我收藏的

**输入**：GET /me/favorites  

**预期**：200 + items  


### H.50 ST-008 / tag 名称特殊字符

**输入**：POST tag: tech.js  

**预期**：200  


### H.51 ST-008 / tag 名称 30 字符

**输入**：POST tag: 30 chars  

**预期**：200  


### H.52 ST-008 / tag 名称 31 字符

**输入**：POST tag: 31 chars  

**预期**：400  


### H.53 ST-008 / tag 自动创建

**输入**：通过 post 引用  

**预期**：tag 自动出现  


### H.54 ST-008 / tag 计数准确

**输入**：100 post 同 tag  

**预期**：postCount=100  


### H.55 ST-008 / tag 删除

**输入**：DELETE /tags/:name  

**预期**：204  


### H.56 ST-008 / tag 列表分页

**输入**：GET /tags?page=2  

**预期**：下一页  


### H.57 ST-008 / tag 列表排序

**输入**：sort=count  

**预期**：按 postCount DESC  


### H.58 ST-009 / 搜索中文关键词

**输入**：q=你好  

**预期**：分词匹配  


### H.59 ST-009 / 搜索英文关键词

**输入**：q=hello  

**预期**：精确匹配  


### H.60 ST-009 / 搜索大小写

**输入**：q=HELLO  

**预期**：不区分大小写  


### H.61 ST-009 / 搜索 + 标签

**输入**：q=hello&tag=tech  

**预期**：联合过滤  


### H.62 ST-009 / 搜索 author

**输入**：q=hello&authorId=...  

**预期**：联合过滤  


### H.63 ST-009 / 搜索排序

**输入**：sort=recent  

**预期**：按 publishedAt  


### H.64 ST-009 / 搜索排序 score

**输入**：sort=score  

**预期**：按 BM25  


### H.65 ST-009 / 搜索高亮

**输入**：GET /search?q=hello  

**预期**：snippet 含 <mark>  


### H.66 ST-010 / 并发评论 100

**输入**：POST /posts/:id/comments × 100  

**预期**：100 个 commentId  


### H.67 ST-010 / 评论包含换行

**输入**：content: line1\nline2  

**预期**：200  


### H.68 ST-010 / 评论包含 emoji

**输入**：content: 👍  

**预期**：200  


### H.69 ST-010 / 评论含 HTML

**输入**：content: <b>hi</b>  

**预期**：原样保存  


### H.70 ST-010 / 评论含脚本

**输入**：content: <script>alert(1)</script>  

**预期**：原样保存  


### H.71 ST-010 / 评论 author 删除

**输入**：作者删除自己评论  

**预期**：204  


### H.72 ST-010 / 评论 post 作者删除

**输入**：post 作者删评论  

**预期**：204  


### H.73 ST-010 / 评论 admin 删除

**输入**：admin 删评论  

**预期**：204  


### H.74 ST-010 / 评论分页

**输入**：page=2&pageSize=20  

**预期**：下一页  


### H.75 ST-010 / 评论排序

**输入**：sort=oldest  

**预期**：按 createdAt ASC  


### H.76 ST-011 / 未读通知数

**输入**：GET /me/notifications/unread-count  

**预期**：200 + count  


### H.77 ST-011 / 标记全部已读

**输入**：POST /me/notifications/read-all  

**预期**：200  


### H.78 ST-011 / 通知订阅

**输入**：POST /me/notifications/subscribe  

**预期**：200  


### H.79 ST-011 / 通知取消订阅

**输入**：POST /me/notifications/unsubscribe  

**预期**：200  


### H.80 ST-011 / 通知过滤 type

**输入**：GET /me/notifications?type=comment  

**预期**：仅 comment 类型  


### H.81 ST-012 / RSS 包含必要字段

**输入**：检查每个 item  

**预期**：title/link/pubDate/description  


### H.82 ST-012 / RSS 字符编码

**输入**：检查 xml  

**预期**：UTF-8  


### H.83 ST-012 / RSS 缓存 TTL

**输入**：5min 后再 GET  

**预期**：缓存失效  


### H.84 ST-012 / RSS pubDate 格式

**输入**：检查 RFC 822  

**预期**：合法 RFC 822  


### H.85 ST-013 / Webhook 多事件订阅

**输入**：events: [a, b, c]  

**预期**：全部投递  


### H.86 ST-013 / Webhook 401 重试

**输入**：mock 401  

**预期**：3 次后死信  


### H.87 ST-013 / Webhook 404 不重试

**输入**：mock 404  

**预期**：不重试（4xx 非瞬时）  


### H.88 ST-013 / Webhook 429 退避

**输入**：mock 429  

**预期**：退避后重试  


### H.89 ST-013 / Webhook secret 强度

**输入**：secret: 32 chars  

**预期**：通过  


### H.90 ST-013 / Webhook secret 弱

**输入**：secret: 8 chars  

**预期**：400  


### H.91 ST-013 / Webhook payload 大小

**输入**：> 1MB  

**预期**：400  


### H.92 ST-014 / 配置历史查询

**输入**：GET /admin/config/history  

**预期**：200 + items  


### H.93 ST-014 / 配置回滚

**输入**：POST /admin/config/rollback  

**预期**：200  


### H.94 ST-014 / 并发配置更新

**输入**：PUT × 2  

**预期**：last write wins  


### H.95 ST-014 / 配置字段校验

**输入**：siteName: ""  

**预期**：400  


### H.96 ST-014 / 配置导出

**输入**：GET /admin/config/export  

**预期**：200 + JSON  


### H.97 ST-014 / 配置导入

**输入**：POST /admin/config/import  

**预期**：200  


### H.98 ST-015 / access log IP 提取

**输入**：X-Forwarded-For: 1.2.3.4  

**预期**：ip=1.2.3.4  


### H.99 ST-015 / access log UA 记录

**输入**：User-Agent: ...  

**预期**：ua 存在  


### H.100 ST-015 / access log 4xx 不写

**输入**：4xx 请求  

**预期**：可选  


### H.101 ST-015 / access log 时间精度

**输入**：检查 timestamp  

**预期**：ms 精度  


### H.102 ST-015 / access log 查询路径

**输入**：?path=/posts  

**预期**：过滤  


### H.103 ST-015 / access log top paths

**输入**：GET /admin/access-logs/top  

**预期**：top 10  


### H.104 ST-016 / 审计字段完整性

**输入**：检查每条 audit  

**预期**：actor/action/resource/result/timestamp/signature  


### H.105 ST-016 / 审计签名验证

**输入**：篡改 audit  

**预期**：签名校验失败  


### H.106 ST-016 / 审计聚合

**输入**：GET /admin/audit-logs/aggregate  

**预期**：统计  


### H.107 ST-016 / 审计清理任务

**输入**：mock cron  

**预期**：老记录清理  


### H.108 ST-016 / 审计导出 JSON

**输入**：GET /admin/audit-logs/export?format=json  

**预期**：下载  


### H.109 ST-016 / 审计导出 CSV

**输入**：GET ...?format=csv  

**预期**：下载  


### H.110 ST-017 / 统计实时性

**输入**：操作后立即查  

**预期**：不超过 1min 滞后  


### H.111 ST-017 / 统计 5min 缓存

**输入**：GET 2 次同 query  

**预期**：第 2 次快  


### H.112 ST-017 / 统计自定义时间窗

**输入**：?from=...&to=...  

**预期**：时间窗统计  


### H.113 ST-017 / 统计 top 博文

**输入**：GET /admin/stats/top-posts  

**预期**：top 10  


### H.114 ST-017 / 统计 top 博主

**输入**：GET /admin/stats/top-bloggers  

**预期**：top 10  


### H.115 ST-017 / 统计导出

**输入**：GET /admin/stats/export  

**预期**：下载  


### H.116 ST-018 / 推荐多样性

**输入**：GET /recommendations  

**预期**：不全部同 tag  


### H.117 ST-018 / 推荐时效性

**输入**：新发文后查询  

**预期**：包含新发文  


### H.118 ST-018 / 推荐排除已读

**输入**：history 中已读  

**预期**：不推荐  


### H.119 ST-018 / 推荐刷新

**输入**：GET /recommendations?refresh=true  

**预期**：新结果  


### H.120 ST-018 / 推荐用户向量更新

**输入**：like → 推荐  

**预期**：向量更新  


### H.121 ST-019 / 广告权重分布

**输入**：10000 次请求  

**预期**：符合权重  


### H.122 ST-019 / 广告时间窗开始

**输入**：now = startAt  

**预期**：展示  


### H.123 ST-019 / 广告时间窗结束

**输入**：now = endAt  

**预期**：展示  


### H.124 ST-019 / 广告时间窗外 1ms

**输入**：now = endAt + 1  

**预期**：不展示  


### H.125 ST-019 / 广告点击

**输入**：POST /ads/:id/click  

**预期**：clickCount+1  


### H.126 ST-019 / 广告 CTR

**输入**：100 曝光 5 点击  

**预期**：CTR=5%  


### H.127 ST-020 / 限流维度 IP

**输入**：同 IP  

**预期**：共享计数  


### H.128 ST-020 / 限流维度 userId

**输入**：同 userId 不同 IP  

**预期**：共享计数  


### H.129 ST-020 / 限流 bypass 测试

**输入**：x-test-bypass-rate-limit  

**预期**：不限流  


### H.130 ST-020 / 限流错误码

**输入**：第 101 次  

**预期**：RATE_LIMITED  


### H.131 ST-020 / 限流 Retry-After

**输入**：检查 header  

**预期**：Retry-After: 60  


### H.132 ST-021 / 路由静态资源

**输入**：GET /static/main.js  

**预期**：200  


### H.133 ST-021 / 路由 favicon

**输入**：GET /favicon.ico  

**预期**：200  


### H.134 ST-021 / 路由 robots.txt

**输入**：GET /robots.txt  

**预期**：200  


### H.135 ST-021 / 路由 health

**输入**：GET /health  

**预期**：200  


### H.136 ST-021 / 路由 metrics

**输入**：GET /metrics  

**预期**：200 + Prometheus  


### H.137 ST-022 / 错误格式统一

**输入**：任意错误  

**预期**：{error: {code, message}}  


### H.138 ST-022 / 错误 requestId

**输入**：任意错误  

**预期**：requestId 存在  


### H.139 ST-022 / 错误不暴露堆栈

**输入**：500  

**预期**：无 stack  


### H.140 ST-022 / 错误 4xx 不记录 stack

**输入**：4xx 错误  

**预期**：stack 不入日志  


### H.141 ST-022 / 错误 5xx 记录 stack

**输入**：5xx 错误  

**预期**：stack 入日志  


### H.142 ST-022 / 错误聚合

**输入**：同 code 100 次  

**预期**：metrics 计数 100  

## 附录 I：集成测试场景库（Integration Test Scenarios）

> 本附录提供完整的集成测试场景，覆盖 22 SD 之间的端到端流程。


### I.1 ST-001 / 登录集成 / 注册→登录→获取自己资料

**关联 ST**：ST-001  

**测试区域**：登录集成  

**步骤**：

1. 1. POST /users 注册 2. POST /auth/login 登录 3. GET /users/me 获取自己

### I.2 ST-002 / 资料集成 / 登录→改资料→查资料

**关联 ST**：ST-002  

**测试区域**：资料集成  

**步骤**：

1. 1. POST /auth/login 2. PUT /users/me 3. GET /users/:id

### I.3 ST-003 / 关注集成 / 注册博主→关注→发通知

**关联 ST**：ST-003  

**测试区域**：关注集成  

**步骤**：

1. 1. POST /bloggers 注册 2. POST /follows/:id 关注 3. 验证通知

### I.4 ST-004 / 切换集成 / 注册多博主→切换→发文

**关联 ST**：ST-004  

**测试区域**：切换集成  

**步骤**：

1. 1. POST /bloggers × 2 2. POST /me/bloggers/:id/switch 3. POST /posts

### I.5 ST-005 / 发文集成 / 登录→发文→发布

**关联 ST**：ST-005  

**测试区域**：发文集成  

**步骤**：

1. 1. POST /auth/login 2. POST /posts 3. POST /posts/:id/publish

### I.6 ST-005 / 状态机集成 / 发文→发布→软删

**关联 ST**：ST-005  

**测试区域**：状态机集成  

**步骤**：

1. 1. POST /posts 2. POST /publish 3. DELETE /posts/:id

### I.7 ST-006 / 浏览集成 / 匿名→浏览博文→查看列表

**关联 ST**：ST-006  

**测试区域**：浏览集成  

**步骤**：

1. 1. GET /posts/:id 2. GET /posts

### I.8 ST-007 / 互动集成 / 登录→点赞→取消

**关联 ST**：ST-007  

**测试区域**：互动集成  

**步骤**：

1. 1. POST /auth/login 2. POST /like 3. POST /like（取消）

### I.9 ST-008 / 标签集成 / 发文带标签→查标签

**关联 ST**：ST-008  

**测试区域**：标签集成  

**步骤**：

1. 1. POST /posts {tags: [tech]} 2. GET /tags 3. GET /tags/tech/posts

### I.10 ST-009 / 搜索集成 / 发文→搜索→打开

**关联 ST**：ST-009  

**测试区域**：搜索集成  

**步骤**：

1. 1. POST /posts 2. POST /publish 3. GET /search?q=... 4. GET /posts/:id

### I.11 ST-010 / 评论集成 / 登录→评论→回复→删除

**关联 ST**：ST-010  

**测试区域**：评论集成  

**步骤**：

1. 1. POST /auth/login 2. POST /comments 3. POST /comments parentId 4. DELETE /comments/:id

### I.12 ST-011 / 通知集成 / A发文→B关注→B收到通知

**关联 ST**：ST-011  

**测试区域**：通知集成  

**步骤**：

1. 1. A 登录 2. POST /posts publish 3. B 关注 A 4. B 查 /me/notifications

### I.13 ST-012 / RSS集成 / 发多文→GET RSS

**关联 ST**：ST-012  

**测试区域**：RSS集成  

**步骤**：

1. 1. POST /posts × 5 2. POST /publish × 5 3. GET /rss.xml 4. 验证 5 条

### I.14 ST-013 / Webhook集成 / 注册Webhook→发post→验证回调

**关联 ST**：ST-013  

**测试区域**：Webhook集成  

**步骤**：

1. 1. POST /webhooks 2. POST /posts 3. POST /publish 4. 验证回调

### I.15 ST-014 / 配置集成 / admin登录→改配置→查公开

**关联 ST**：ST-014  

**测试区域**：配置集成  

**步骤**：

1. 1. admin 登录 2. PUT /admin/site/config 3. GET /site/config

### I.16 ST-015 / 访问记录集成 / 100并发GET→查access

**关联 ST**：ST-015  

**测试区域**：访问记录集成  

**步骤**：

1. 1. 100 并发 GET 2. admin 查 access-logs

### I.17 ST-016 / 审计集成 / 任意写操作→查audit

**关联 ST**：ST-016  

**测试区域**：审计集成  

**步骤**：

1. 1. POST /users 2. admin 查 audit-logs

### I.18 ST-017 / 统计集成 / 多操作→查stats

**关联 ST**：ST-017  

**测试区域**：统计集成  

**步骤**：

1. 1. 多操作 2. admin 查 /admin/stats

### I.19 ST-018 / 推荐集成 / 登录→互动→查推荐

**关联 ST**：ST-018  

**测试区域**：推荐集成  

**步骤**：

1. 1. 登录 2. 点赞多篇 3. GET /recommendations

### I.20 ST-019 / 广告集成 / 配置广告→查广告

**关联 ST**：ST-019  

**测试区域**：广告集成  

**步骤**：

1. 1. 配置 ad 2. GET /ads/:slot

### I.21 ST-020 / 限流集成 / 100次→101次

**关联 ST**：ST-020  

**测试区域**：限流集成  

**步骤**：

1. 1. 100 次 GET 2. 第 101 次 429

### I.22 ST-021 / 路由集成 / 正常路由+404

**关联 ST**：ST-021  

**测试区域**：路由集成  

**步骤**：

1. 1. GET /posts 2. GET /no-such

### I.23 ST-022 / 错误处理集成 / 错输入→错响应

**关联 ST**：ST-022  

**测试区域**：错误处理集成  

**步骤**：

1. 1. POST /users {} 2. 验证 400 + details

### I.24 E2E / 端到端 / 用户全流程

**关联 ST**：E2E  

**测试区域**：端到端  

**步骤**：

1. 注册
2. 登录
3. 关注博主
4. 博主发文
5. 用户收到通知
6. 用户评论
7. 博主回复

### I.25 E2E / 端到端 / 博主全流程

**关联 ST**：E2E  

**测试区域**：端到端  

**步骤**：

1. 注册博主
2. 发草稿
3. 发图文
4. 发webhook
5. 看统计

### I.26 E2E / 端到端 / Admin全流程

**关联 ST**：E2E  

**测试区域**：端到端  

**步骤**：

1. admin登录
2. 改配置
3. 注册webhook
4. 查审计
5. 查统计
6. 改配置

### I.27 E2E / 端到端 / 安全全流程

**关联 ST**：E2E  

**测试区域**：端到端  

**步骤**：

1. JWT验证+越权+注入+限流+签名+脱敏

### I.28 E2E / 端到端 / 性能全流程

**关联 ST**：E2E  

**测试区域**：端到端  

**步骤**：

1. 1000 并发浏览+5min压测

### I.29 E2E / 端到端 / 可靠性全流程

**关联 ST**：E2E  

**测试区域**：端到端  

**步骤**：

1. 1000 并发写+0 错误

### I.30 E2E / 端到端 / 可观测性全流程

**关联 ST**：E2E  

**测试区域**：端到端  

**步骤**：

1. 执行操作+检查 metrics+logs+traces

## 附录 J：边界测试场景库（Boundary Test Scenarios）

> 本附录提供完整的边界条件测试场景，覆盖所有 SD 的字段约束、状态边界、并发边界。


### J.1 ST-001 / 最小用户名

**输入**：username: abc (3 chars)  

**预期**：200  


### J.2 ST-001 / 最大用户名

**输入**：username: 20 chars  

**预期**：200  


### J.3 ST-001 / 2 字符用户名

**输入**：username: ab  

**预期**：400  


### J.4 ST-001 / 21 字符用户名

**输入**：username: 21 chars  

**预期**：400  


### J.5 ST-001 / 最小密码

**输入**：password: 12345678 (8 chars)  

**预期**：200  


### J.6 ST-001 / 7 字符密码

**输入**：password: 1234567  

**预期**：400  


### J.7 ST-001 / 空 email

**输入**：email: ""  

**预期**：400  


### J.8 ST-001 / null email

**输入**：email: null  

**预期**：400  


### J.9 ST-001 / undefined email

**输入**：不传 email  

**预期**：400  


### J.10 ST-001 / 空 body

**输入**：{}  

**预期**：400  


### J.11 ST-001 / 无 body

**输入**：不传 body  

**预期**：400  


### J.12 ST-001 / JSON 解析错

**输入**：malformed JSON  

**预期**：400  


### J.13 ST-002 / 空 displayName

**输入**：PUT /users/me {displayName: ""}  

**预期**：400  


### J.14 ST-002 / null displayName

**输入**：PUT /users/me {displayName: null}  

**预期**：200（不变）  


### J.15 ST-002 / 空 bio

**输入**：PUT /users/me {bio: ""}  

**预期**：200  


### J.16 ST-002 / avatarUrl 格式

**输入**：PUT /users/me {avatarUrl: "x"}  

**预期**：200（不验证）  


### J.17 ST-002 / displayName HTML

**输入**：PUT /users/me {displayName: "<b>x</b>"}  

**预期**：200  


### J.18 ST-003 / 关注不存在的 blogger

**输入**：POST /follows/01HNONE  

**预期**：404  


### J.19 ST-003 / 关注空字符串

**输入**：POST /follows/  

**预期**：404  


### J.20 ST-003 / 取关未关注

**输入**：DELETE /follows/:id (未关注)  

**预期**：200 + followed: false（幂等）  


### J.21 ST-004 / 切换空字符串

**输入**：POST /me/bloggers//switch  

**预期**：404  


### J.22 ST-004 / 切换 null id

**输入**：POST /me/bloggers/null/switch  

**预期**：400  


### J.23 ST-005 / 空 title

**输入**：POST /posts {title: ""}  

**预期**：400  


### J.24 ST-005 / null title

**输入**：POST /posts {title: null}  

**预期**：400  


### J.25 ST-005 / title 200 字符

**输入**：title: 200 chars  

**预期**：200  


### J.26 ST-005 / title 201 字符

**输入**：title: 201 chars  

**预期**：400  


### J.27 ST-005 / 空 content

**输入**：POST /posts {content: ""}  

**预期**：200 (draft)  


### J.28 ST-005 / content 100000 字符

**输入**：content: 100000 chars  

**预期**：200  


### J.29 ST-005 / content 100001 字符

**输入**：content: 100001 chars  

**预期**：400  


### J.30 ST-005 / tags 0 个

**输入**：tags: []  

**预期**：200  


### J.31 ST-005 / tags 5 个

**输入**：tags: [5个]  

**预期**：200  


### J.32 ST-005 / tags 6 个

**输入**：tags: [6个]  

**预期**：400  


### J.33 ST-005 / tag 空字符串

**输入**：tags: [""]  

**预期**：400  


### J.34 ST-005 / tag 31 字符

**输入**：tags: [31 chars]  

**预期**：400  


### J.35 ST-005 / post id 不存在

**输入**：PUT /posts/01HNONE  

**预期**：404  


### J.36 ST-005 / post id 格式错

**输入**：PUT /posts/not-ulid  

**预期**：404  


### J.37 ST-005 / 并发 update 同一字段

**输入**：PUT /posts/:id {title} × 2  

**预期**：last write wins  


### J.38 ST-005 / 删除已删 post

**输入**：DELETE /posts/:deleted  

**预期**：404  


### J.39 ST-006 / 获取 draft post

**输入**：GET /posts/:draftId (匿名)  

**预期**：404 NOT_PUBLISHED  


### J.40 ST-006 / 获取 deleted post

**输入**：GET /posts/:deletedId  

**预期**：404  


### J.41 ST-006 / page=0

**输入**：?page=0  

**预期**：400 或 1（默认）  


### J.42 ST-006 / pageSize=0

**输入**：?pageSize=0  

**预期**：400  


### J.43 ST-006 / pageSize=100

**输入**：?pageSize=100  

**预期**：200  


### J.44 ST-006 / pageSize=101

**输入**：?pageSize=101  

**预期**：400  


### J.45 ST-006 / page=负数

**输入**：?page=-1  

**预期**：400  


### J.46 ST-006 / sort=invalid

**输入**：?sort=invalid  

**预期**：默认排序  


### J.47 ST-007 / 点赞 draft post

**输入**：POST /posts/:draft/like  

**预期**：404  


### J.48 ST-007 / 点赞 deleted post

**输入**：POST /posts/:deleted/like  

**预期**：404  


### J.49 ST-007 / 点赞 1000 次

**输入**：POST /posts/:id/like × 1000 (不同 user)  

**预期**：200 × 1000  


### J.50 ST-008 / tag 大写

**输入**：POST tag: "Tech"  

**预期**：归一化为 "tech"  


### J.51 ST-008 / tag 混合大小写

**输入**：POST tag: "TeCh"  

**预期**：归一化为 "tech"  


### J.52 ST-008 / tag 数字开头

**输入**：POST tag: "123abc"  

**预期**：200  


### J.53 ST-008 / tag 特殊字符

**输入**：POST tag: "tech.js"  

**预期**：200  


### J.54 ST-008 / tag 空格

**输入**：POST tag: " tech "  

**预期**：trim → "tech"  


### J.55 ST-009 / q 空字符串

**输入**：q=""  

**预期**：400  


### J.56 ST-009 / q 1 字符

**输入**：q="a"  

**预期**：200  


### J.57 ST-009 / q 100 字符

**输入**：q=100 chars  

**预期**：200  


### J.58 ST-009 / q 101 字符

**输入**：q=101 chars  

**预期**：400  


### J.59 ST-009 / SQL 注入

**输入**：q="' OR 1=1--"  

**预期**：200 + 空 items  


### J.60 ST-009 / XSS 注入

**输入**：q="<script>"  

**预期**：200 + 空 items  


### J.61 ST-010 / 评论 draft post

**输入**：POST /posts/:draft/comments  

**预期**：404  


### J.62 ST-010 / 评论 deleted post

**输入**：POST /posts/:deleted/comments  

**预期**：404  


### J.63 ST-010 / parentId 不存在

**输入**：POST .../comments {parentId: "01HNONE"}  

**预期**：404  


### J.64 ST-010 / parentId=自己

**输入**：POST .../comments {parentId: self}  

**预期**：200  


### J.65 ST-010 / content 1000 字符

**输入**：content: 1000 chars  

**预期**：200  


### J.66 ST-010 / content 1001 字符

**输入**：content: 1001 chars  

**预期**：400  


### J.67 ST-010 / 删除自己评论

**输入**：DELETE /comments/:own  

**预期**：204  


### J.68 ST-010 / 删除他人评论

**输入**：DELETE /comments/:other  

**预期**：403  


### J.69 ST-010 / 评论不存在的 post

**输入**：POST /posts/01HNONE/comments  

**预期**：404  


### J.70 ST-011 / 通知无 recipient

**输入**：mock 无 recipient  

**预期**：降级  


### J.71 ST-011 / 通知 spam

**输入**：1s 100 通知  

**预期**：合并  


### J.72 ST-011 / 通知超长

**输入**：data.title: 1MB  

**预期**：截断  


### J.73 ST-012 / RSS 无 post

**输入**：无 post 时 GET /rss.xml  

**预期**：200 + 空 channel  


### J.74 ST-012 / RSS 50+ post

**输入**：100 post → RSS  

**预期**：仅 50  


### J.75 ST-012 / RSS 字段 HTML 转义

**输入**：post 含 < > &  

**预期**：正确转义  


### J.76 ST-013 / Webhook url 非 HTTPS

**输入**：url: http://  

**预期**：400  


### J.77 ST-013 / Webhook url localhost

**输入**：url: http://localhost  

**预期**：400（仅 HTTPS）  


### J.78 ST-013 / Webhook url 错

**输入**：url: "not url"  

**预期**：400  


### J.79 ST-013 / Webhook events 空

**输入**：events: []  

**预期**：400  


### J.80 ST-013 / Webhook secret 0 字符

**输入**：secret: ""  

**预期**：400  


### J.81 ST-013 / Webhook 重复注册

**输入**：同 url × 2  

**预期**：2 个 webhookId  


### J.82 ST-013 / Webhook 取消订阅

**输入**：DELETE /webhooks/:id  

**预期**：204  


### J.83 ST-014 / siteName 空

**输入**：PUT /admin/site/config {siteName: ""}  

**预期**：400  


### J.84 ST-014 / siteName 100 字符

**输入**：siteName: 100 chars  

**预期**：200  


### J.85 ST-014 / siteName 101 字符

**输入**：siteName: 101 chars  

**预期**：400  


### J.86 ST-015 / access log 空 path

**输入**：GET ""  

**预期**：404  


### J.87 ST-016 / audit action 空

**输入**：mock action=""  

**预期**：fallback  


### J.88 ST-016 / audit 超长

**输入**：details: 1MB  

**预期**：截断  


### J.89 ST-017 / stats 无数据

**输入**：mock 空  

**预期**：200 + 全 0  


### J.90 ST-018 / 推荐无 history

**输入**：新 user  

**预期**：fallback 热门  


### J.91 ST-018 / 推荐 0 篇

**输入**：mock 0 published  

**预期**：200 + 空 items  


### J.92 ST-019 / 广告 0 个

**输入**：ads: []  

**预期**：ad: null  


### J.93 ST-020 / 限流 IP 缺失

**输入**：无 IP  

**预期**：fallback 127.0.0.1  


### J.94 ST-021 / 路由 query 错

**输入**：?invalid=true  

**预期**：忽略  


### J.95 ST-021 / 路由 fragment

**输入**：/posts#anchor  

**预期**：忽略 fragment  


### J.96 ST-022 / 错误 Content-Length 错

**输入**：伪造 CL  

**预期**：400  

## 附录 K：性能测试场景详细库（Perf Test Scenarios Detailed）

> 本附录提供 30 个性能测试场景，每个含 P50/P90/P95/P99 分布。


### K.1 登录 P50/P90/P95/P99 分布

**目标端点**：POST /auth/login  

**虚拟用户数**：100  

**持续时间**：30s  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 50ms | TBD | - |
| P90 | ≤ 100ms | TBD | - |
| P95 | ≤ 200ms | TBD | - |
| P99 | ≤ 500ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 100,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(50)<' + 50 + ', p(90)<' + 100 + ', p(95)<' + 200 + ', p(99)<' + 500 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.2 博文浏览 P50/P90/P95/P99

**目标端点**：GET /posts/:id  

**虚拟用户数**：1000  

**持续时间**：5m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 30ms | TBD | - |
| P90 | ≤ 100ms | TBD | - |
| P95 | ≤ 200ms | TBD | - |
| P99 | ≤ 500ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 1000,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(50)<' + 30 + ', p(90)<' + 100 + ', p(95)<' + 200 + ', p(99)<' + 500 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.3 互动 P50/P90/P95/P99

**目标端点**：POST /posts/:id/like  

**虚拟用户数**：500  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 30ms | TBD | - |
| P90 | ≤ 100ms | TBD | - |
| P95 | ≤ 200ms | TBD | - |
| P99 | ≤ 500ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 500,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(50)<' + 30 + ', p(90)<' + 100 + ', p(95)<' + 200 + ', p(99)<' + 500 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.4 标签查询 P50/P90/P95/P99

**目标端点**：GET /tags  

**虚拟用户数**：200  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 20ms | TBD | - |
| P90 | ≤ 80ms | TBD | - |
| P95 | ≤ 200ms | TBD | - |
| P99 | ≤ 400ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 200,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(50)<' + 20 + ', p(90)<' + 80 + ', p(95)<' + 200 + ', p(99)<' + 400 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.5 搜索 P50/P90/P95/P99

**目标端点**：GET /search?q=common  

**虚拟用户数**：100  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 50ms | TBD | - |
| P90 | ≤ 150ms | TBD | - |
| P95 | ≤ 200ms | TBD | - |
| P99 | ≤ 500ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 100,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(50)<' + 50 + ', p(90)<' + 150 + ', p(95)<' + 200 + ', p(99)<' + 500 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.6 评论发表 P50/P90/P95/P99

**目标端点**：POST /posts/:id/comments  

**虚拟用户数**：200  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 30ms | TBD | - |
| P90 | ≤ 100ms | TBD | - |
| P95 | ≤ 200ms | TBD | - |
| P99 | ≤ 500ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 200,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(50)<' + 30 + ', p(90)<' + 100 + ', p(95)<' + 200 + ', p(99)<' + 500 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.7 通知扇出 P50/P90/P95/P99

**目标端点**：POST /posts/:id/publish  

**虚拟用户数**：1000  

**持续时间**：5m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 100ms | TBD | - |
| P90 | ≤ 300ms | TBD | - |
| P95 | ≤ 500ms | TBD | - |
| P99 | ≤ 1000ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 1000,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(50)<' + 100 + ', p(90)<' + 300 + ', p(95)<' + 500 + ', p(99)<' + 1000 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.8 RSS P50/P90/P95/P99

**目标端点**：GET /rss.xml  

**虚拟用户数**：100  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 20ms | TBD | - |
| P90 | ≤ 50ms | TBD | - |
| P95 | ≤ 100ms | TBD | - |
| P99 | ≤ 200ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 100,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(50)<' + 20 + ', p(90)<' + 50 + ', p(95)<' + 100 + ', p(99)<' + 200 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.9 Webhook P50/P90/P95/P99

**目标端点**：POST /webhooks  

**虚拟用户数**：100  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 30ms | TBD | - |
| P90 | ≤ 100ms | TBD | - |
| P95 | ≤ 200ms | TBD | - |
| P99 | ≤ 500ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 100,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(50)<' + 30 + ', p(90)<' + 100 + ', p(95)<' + 200 + ', p(99)<' + 500 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.10 审计写入 P50/P90/P95/P99

**目标端点**：POST /users  

**虚拟用户数**：1000  

**持续时间**：5m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 30ms | TBD | - |
| P90 | ≤ 100ms | TBD | - |
| P95 | ≤ 200ms | TBD | - |
| P99 | ≤ 500ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 1000,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(50)<' + 30 + ', p(90)<' + 100 + ', p(95)<' + 200 + ', p(99)<' + 500 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.11 统计查询 P50/P90/P95/P99

**目标端点**：GET /admin/stats  

**虚拟用户数**：50  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 50ms | TBD | - |
| P90 | ≤ 150ms | TBD | - |
| P95 | ≤ 200ms | TBD | - |
| P99 | ≤ 500ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 50,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(50)<' + 50 + ', p(90)<' + 150 + ', p(95)<' + 200 + ', p(99)<' + 500 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.12 推荐查询 P50/P90/P95/P99

**目标端点**：GET /recommendations  

**虚拟用户数**：200  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 50ms | TBD | - |
| P90 | ≤ 150ms | TBD | - |
| P95 | ≤ 200ms | TBD | - |
| P99 | ≤ 500ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 200,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(50)<' + 50 + ', p(90)<' + 150 + ', p(95)<' + 200 + ', p(99)<' + 500 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.13 广告查询 P50/P90/P95/P99

**目标端点**：GET /ads/:slot  

**虚拟用户数**：500  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 20ms | TBD | - |
| P90 | ≤ 50ms | TBD | - |
| P95 | ≤ 100ms | TBD | - |
| P99 | ≤ 200ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 500,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(50)<' + 20 + ', p(90)<' + 50 + ', p(95)<' + 100 + ', p(99)<' + 200 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.14 访问记录 P50/P90/P95/P99

**目标端点**：GET /health  

**虚拟用户数**：2000  

**持续时间**：5m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 30ms | TBD | - |
| P90 | ≤ 100ms | TBD | - |
| P95 | ≤ 300ms | TBD | - |
| P99 | ≤ 800ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 2000,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(50)<' + 30 + ', p(90)<' + 100 + ', p(95)<' + 300 + ', p(99)<' + 800 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.15 健康检查 P50/P90/P95/P99

**目标端点**：GET /health  

**虚拟用户数**：1000  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 5ms | TBD | - |
| P90 | ≤ 20ms | TBD | - |
| P95 | ≤ 50ms | TBD | - |
| P99 | ≤ 100ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 1000,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(50)<' + 5 + ', p(90)<' + 20 + ', p(95)<' + 50 + ', p(99)<' + 100 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.16 并发注册

**目标端点**：POST /users  

**虚拟用户数**：100  

**持续时间**：30s  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 200ms | TBD | - |
| P90 | ≤ 400ms | TBD | - |
| P95 | ≤ 600ms | TBD | - |
| P99 | ≤ 1000ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 100,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(50)<' + 200 + ', p(90)<' + 400 + ', p(95)<' + 600 + ', p(99)<' + 1000 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.17 并发登录

**目标端点**：POST /auth/login  

**虚拟用户数**：100  

**持续时间**：30s  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 200ms | TBD | - |
| P90 | ≤ 400ms | TBD | - |
| P95 | ≤ 600ms | TBD | - |
| P99 | ≤ 1000ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 100,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(50)<' + 200 + ', p(90)<' + 400 + ', p(95)<' + 600 + ', p(99)<' + 1000 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.18 并发发文

**目标端点**：POST /posts  

**虚拟用户数**：50  

**持续时间**：30s  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 30ms | TBD | - |
| P90 | ≤ 100ms | TBD | - |
| P95 | ≤ 200ms | TBD | - |
| P99 | ≤ 500ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 50,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(50)<' + 30 + ', p(90)<' + 100 + ', p(95)<' + 200 + ', p(99)<' + 500 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.19 并发评论

**目标端点**：POST /posts/:id/comments  

**虚拟用户数**：200  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 30ms | TBD | - |
| P90 | ≤ 100ms | TBD | - |
| P95 | ≤ 200ms | TBD | - |
| P99 | ≤ 500ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 200,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(50)<' + 30 + ', p(90)<' + 100 + ', p(95)<' + 200 + ', p(99)<' + 500 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.20 并发点赞

**目标端点**：POST /posts/:id/like  

**虚拟用户数**：500  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 30ms | TBD | - |
| P90 | ≤ 100ms | TBD | - |
| P95 | ≤ 200ms | TBD | - |
| P99 | ≤ 500ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 500,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(50)<' + 30 + ', p(90)<' + 100 + ', p(95)<' + 200 + ', p(99)<' + 500 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.21 关注并发

**目标端点**：POST /follows/:id  

**虚拟用户数**：500  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 30ms | TBD | - |
| P90 | ≤ 100ms | TBD | - |
| P95 | ≤ 200ms | TBD | - |
| P99 | ≤ 500ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 500,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(50)<' + 30 + ', p(90)<' + 100 + ', p(95)<' + 200 + ', p(99)<' + 500 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.22 取消关注并发

**目标端点**：DELETE /follows/:id  

**虚拟用户数**：500  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 30ms | TBD | - |
| P90 | ≤ 100ms | TBD | - |
| P95 | ≤ 200ms | TBD | - |
| P99 | ≤ 500ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 500,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(50)<' + 30 + ', p(90)<' + 100 + ', p(95)<' + 200 + ', p(99)<' + 500 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.23 标签下博文

**目标端点**：GET /tags/:name/posts  

**虚拟用户数**：200  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 30ms | TBD | - |
| P90 | ≤ 100ms | TBD | - |
| P95 | ≤ 200ms | TBD | - |
| P99 | ≤ 500ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 200,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(50)<' + 30 + ', p(90)<' + 100 + ', p(95)<' + 200 + ', p(99)<' + 500 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.24 RSS 缓存命中

**目标端点**：GET /rss.xml  

**虚拟用户数**：100  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 5ms | TBD | - |
| P90 | ≤ 20ms | TBD | - |
| P95 | ≤ 50ms | TBD | - |
| P99 | ≤ 100ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 100,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(50)<' + 5 + ', p(90)<' + 20 + ', p(95)<' + 50 + ', p(99)<' + 100 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.25 webhook 投递

**目标端点**：POST /webhooks  

**虚拟用户数**：100  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 30ms | TBD | - |
| P90 | ≤ 100ms | TBD | - |
| P95 | ≤ 200ms | TBD | - |
| P99 | ≤ 500ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 100,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(50)<' + 30 + ', p(90)<' + 100 + ', p(95)<' + 200 + ', p(99)<' + 500 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.26 admin 端点

**目标端点**：GET /admin/*  

**虚拟用户数**：50  

**持续时间**：1m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 30ms | TBD | - |
| P90 | ≤ 100ms | TBD | - |
| P95 | ≤ 200ms | TBD | - |
| P99 | ≤ 500ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 50,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(50)<' + 30 + ', p(90)<' + 100 + ', p(95)<' + 200 + ', p(99)<' + 500 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.27 JWT 验证

**目标端点**：任意端点  

**虚拟用户数**：1000  

**持续时间**：5m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 1ms | TBD | - |
| P90 | ≤ 5ms | TBD | - |
| P95 | ≤ 10ms | TBD | - |
| P99 | ≤ 50ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 1000,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(50)<' + 1 + ', p(90)<' + 5 + ', p(95)<' + 10 + ', p(99)<' + 50 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.28 限流检查

**目标端点**：GET /health  

**虚拟用户数**：1000  

**持续时间**：5m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| P50 | ≤ 1ms | TBD | - |
| P90 | ≤ 5ms | TBD | - |
| P95 | ≤ 10ms | TBD | - |
| P99 | ≤ 50ms | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 1000,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(50)<' + 1 + ', p(90)<' + 5 + ', p(95)<' + 10 + ', p(99)<' + 50 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.29 内存使用

**目标端点**：GET /health  

**虚拟用户数**：1000  

**持续时间**：5m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| RSS | ≤ 100MB | TBD | - |
| Heap | ≤ 100MB | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 1000,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(50)<' + 1000 + ', p(90)<' + 2000 + ', p(95)<' + 3000 + ', p(99)<' + 5000 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


### K.30 CPU 使用

**目标端点**：GET /health  

**虚拟用户数**：1000  

**持续时间**：5m  

**性能基线**：

| 指标 | 阈值 | 实测 | 偏差 |
|---|---|---|---|
| CPU | ≤ 80% | TBD | - |

**k6 脚本框架**：

```javascript

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';


const p50 = new Trend('p50', true);
const p90 = new Trend('p90', true);
const p95 = new Trend('p95', true);
const p99 = new Trend('p99', true);
const errorRate = new Rate('errors');
const totalRequests = new Counter('total_requests');


export const options = {
  vus: 1000,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(50)<' + 1000 + ', p(90)<' + 2000 + ', p(95)<' + 3000 + ', p(99)<' + 5000 + '],
    errors: ['rate<0.01'],
  },
};


export default function () {

  const res = http.get("http://localhost:3000");

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  p50.add(res.timings.duration);
  p90.add(res.timings.duration);
  p95.add(res.timings.duration);
  p99.add(res.timings.duration);

  errorRate.add(!ok);
  totalRequests.add(1);

}

```


## 附录 L：安全测试场景详细库（Security Test Scenarios Detailed）

> 本附录提供 50+ 安全测试场景，覆盖认证、授权、注入、信息泄露、限流、签名、密码。


### L.1 认证 / JWT 缺失

**输入**：无 Authorization header  

**预期**：401 AUTH_REQUIRED  


### L.2 认证 / JWT 格式错

**输入**：Authorization: xxxxx  

**预期**：401 TOKEN_INVALID  


### L.3 认证 / JWT 篡改

**输入**：修改 token 1 字符  

**预期**：401 TOKEN_INVALID  


### L.4 认证 / JWT 过期

**输入**：exp 字段 < now  

**预期**：401 TOKEN_EXPIRED  


### L.5 认证 / JWT 未签名

**输入**：alg=none  

**预期**：401 TOKEN_INVALID  


### L.6 认证 / JWT 算法错

**输入**：alg=HS512 但服务用 HS256  

**预期**：401 TOKEN_INVALID  


### L.7 认证 / JWT secret 错

**输入**：不同 secret 签发  

**预期**：401 TOKEN_INVALID  


### L.8 认证 / JWT userId 不存在

**输入**：sub=01HNONE  

**预期**：401 AUTH_REQUIRED  


### L.9 认证 / JWT role 错

**输入**：role=admin 但实际 reader  

**预期**：403  


### L.10 认证 / JWT 注销

**输入**：黑名单 token  

**预期**：401  


### L.11 授权 / 越权读他人

**输入**：GET /users/:otherId  

**预期**：200（公开）  


### L.12 授权 / 越权改他人

**输入**：PUT /users/:otherId  

**预期**：403 NOT_OWNER  


### L.13 授权 / 越权删他人

**输入**：DELETE /users/:otherId  

**预期**：403 NOT_OWNER  


### L.14 授权 / 非博主发帖

**输入**：POST /posts (reader)  

**预期**：403 NOT_BLOGGER  


### L.15 授权 / 非 admin 改配置

**输入**：PUT /admin/site/config (reader)  

**预期**：403 NOT_ADMIN  


### L.16 授权 / 非 admin 查审计

**输入**：GET /admin/audit-logs (reader)  

**预期**：403 NOT_ADMIN  


### L.17 授权 / 非 admin 注册 webhook

**输入**：POST /webhooks (reader)  

**预期**：403 NOT_ADMIN  


### L.18 授权 / 非博主看 admin 端点

**输入**：任意 admin 端点 (blogger)  

**预期**：403  


### L.19 注入 / SQL 注入 email

**输入**：email: "x' OR 1=1--"  

**预期**：400 VALIDATION_FAILED  


### L.20 注入 / SQL 注入 username

**输入**：username: "x'--"  

**预期**：400 VALIDATION_FAILED  


### L.21 注入 / NoSQL 注入

**输入**：email: {$gt: ""}  

**预期**：400 VALIDATION_FAILED  


### L.22 注入 / LDAP 注入

**输入**：username: "*"  

**预期**：400 VALIDATION_FAILED  


### L.23 注入 / XSS payload

**输入**：<script>alert(1)</script>  

**预期**：原样保存  


### L.24 注入 / XSS 链接

**输入**：javascript:alert(1)  

**预期**：原样保存  


### L.25 注入 / CRLF 注入

**输入**：\r\nSet-Cookie: x=1  

**预期**：原样保存  


### L.26 注入 / Path traversal

**输入**：../../etc/passwd  

**预期**：400  


### L.27 注入 / 命令注入

**输入**："; cat /etc/passwd; "  

**预期**：原样保存  


### L.28 注入 / SSRF

**输入**：webhook url: localhost  

**预期**：400（仅 HTTPS）  


### L.29 信息泄露 / 错误堆栈

**输入**：mock 500  

**预期**：无 stack  


### L.30 信息泄露 / 错误 SQL

**输入**：mock SQL 错误  

**预期**：无 SQL 细节  


### L.31 信息泄露 / JWT secret

**输入**：尝试读取 secret  

**预期**：不可读  


### L.32 信息泄露 / passwordHash

**输入**：GET /users/:id  

**预期**：无 passwordHash  


### L.33 信息泄露 / email 字段

**输入**：GET /users/:id (no auth)  

**预期**：无 email  


### L.34 信息泄露 / webhook secret

**输入**：GET /webhooks/:id  

**预期**：无 secret  


### L.35 信息泄露 / 错误响应路径

**输入**：mock 错误  

**预期**：无内部路径  


### L.36 限流 / 限流 100/min

**输入**：100 次 /health  

**预期**：200  


### L.37 限流 / 限流 101

**输入**：101 次  

**预期**：429  


### L.38 限流 / bypass 头

**输入**：带 x-test-bypass  

**预期**：不限流  


### L.39 限流 / Retry-After

**输入**：检查 header  

**预期**：60  


### L.40 签名 / Webhook 签名

**输入**：mock 接收  

**预期**：X-Webhook-Signature 正确  


### L.41 签名 / Webhook 签名错

**输入**：篡改 payload  

**预期**：下游 401  


### L.42 签名 / 签名算法

**输入**：检查算法  

**预期**：HMAC-SHA256  


### L.43 签名 / 签名长度

**输入**：检查长度  

**预期**：64 hex  


### L.44 CORS / 同源请求

**输入**：Origin: 同源  

**预期**：通过  


### L.45 CORS / 跨源请求

**输入**：Origin: 其他  

**预期**：CORS 头  


### L.46 CORS / CORS 预检

**输入**：OPTIONS  

**预期**：CORS 头  


### L.47 传输安全 / HTTPS 强制

**输入**：http://  

**预期**：301 → https  


### L.48 传输安全 / HSTS

**输入**：检查 header  

**预期**：Strict-Transport-Security  


### L.49 传输安全 / TLS 版本

**输入**：检查 TLS  

**预期**：TLS 1.2+  


### L.50 密码 / bcrypt cost

**输入**：查看 hash  

**预期**：$2a$10$...  


### L.51 密码 / 密码不在日志

**输入**：mock 错误日志  

**预期**：无明文密码  


### L.52 密码 / 密码不在响应

**输入**：任意响应  

**预期**：无明文密码  


### L.53 密码 / 密码强度

**输入**：弱密码  

**预期**：400  


### L.54 账户 / 账户锁定

**输入**：5 次错密码  

**预期**：锁定 5min  


### L.55 账户 / 账户冻结

**输入**：admin 冻结  

**预期**：AUTH_REQUIRED  

## 附录 M：验收准则详细库（Acceptance Criteria）

> 本附录提供 70+ 验收准则，每条含验收点、验证方法、判定标准。


### M.1 ST-001 / 登录 P95 ≤ 200ms

**验收类别**：性能  

**验证方法**：k6 100 VU × 10 iter  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.2 ST-001 / 错密码响应一致

**验收类别**：安全  

**验证方法**：对比 body 字节级  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.3 ST-001 / JWT 24h 过期

**验收类别**：安全  

**验证方法**：mock 时间 25h  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.4 ST-001 / bcrypt cost=10

**验收类别**：安全  

**验证方法**：检查 hash 头  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.5 ST-002 / PII 字段隐藏

**验收类别**：安全  

**验证方法**：无 passwordHash/email  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.6 ST-002 / 匿名可查公开

**验收类别**：功能  

**验证方法**：无 JWT 200  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.7 ST-002 / 修改自己成功

**验收类别**：功能  

**验证方法**：JWT PUT 200  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.8 ST-002 / 越权 403

**验收类别**：安全  

**验证方法**：跨用户 403  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.9 ST-003 / 关注幂等

**验收类别**：功能  

**验证方法**：重复 200  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.10 ST-003 / 通知不重复

**验收类别**：功能  

**验证方法**：查通知 1 条  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.11 ST-003 / 关注自己 403

**验收类别**：安全  

**验证方法**：SELF_FOLLOW  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.12 ST-004 / 多博主切换

**验收类别**：功能  

**验证方法**：2 token 不同  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.13 ST-004 / 非 own 切换 403

**验收类别**：安全  

**验证方法**：NOT_OWNER  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.14 ST-005 / 状态机闭合

**验收类别**：功能  

**验证方法**：draft→published→deleted  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.15 ST-005 / 非法转移 409

**验收类别**：功能  

**验证方法**：INVALID_STATE_TRANSITION  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.16 ST-005 / 空内容 409

**验收类别**：功能  

**验证方法**：EMPTY_CONTENT  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.17 ST-005 / 软删保留 id

**验收类别**：功能  

**验证方法**：id 仍可查（404 deleted）  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.18 ST-006 / P95 ≤ 200ms

**验收类别**：性能  

**验证方法**：k6 1000 VU  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.19 ST-006 / heapUsed ≤ 100MB

**验收类别**：内存  

**验证方法**：k6 5min 压测  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.20 ST-006 / viewCount 累加

**验收类别**：功能  

**验证方法**：1000 GET 后 +1000  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.21 ST-006 / deleted 不在 list

**验收类别**：功能  

**验证方法**：查 list 无  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.22 ST-007 / 点赞幂等

**验收类别**：功能  

**验证方法**：重复 200  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.23 ST-007 / likeCount 准确

**验收类别**：功能  

**验证方法**：100 user like = 100  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.24 ST-007 / 未登录 401

**验收类别**：安全  

**验证方法**：AUTH_REQUIRED  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.25 ST-008 / tag 自动创建

**验收类别**：功能  

**验证方法**：通过 post 隐式  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.26 ST-008 / N+1 防御

**验收类别**：性能  

**验证方法**：P95 稳定  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.27 ST-008 / tag 大小写归一化

**验收类别**：功能  

**验证方法**：Tech→tech  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.28 ST-009 / BM25 搜索

**验收类别**：功能  

**验证方法**：top-k 准确  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.29 ST-009 / 高亮 <mark>

**验收类别**：功能  

**验证方法**：snippet 含标记  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.30 ST-009 / P95 ≤ 200ms

**验收类别**：性能  

**验证方法**：k6 100 VU  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.31 ST-010 / 评论树深度 ≤ 3

**验收类别**：功能  

**验证方法**：DEPTH_EXCEEDED  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.32 ST-010 / 软删保留显示

**验收类别**：功能  

**验证方法**：「已删除」  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.33 ST-010 / 非作者 403

**验收类别**：安全  

**验证方法**：NOT_OWNER  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.34 ST-011 / 通知扇出 5s

**验收类别**：性能  

**验证方法**：1000 关注者  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.35 ST-011 / 通知去重

**验收类别**：功能  

**验证方法**：不重复  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.36 ST-011 / 标记已读

**验收类别**：功能  

**验证方法**：readAt 存在  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.37 ST-012 / RSS 2.0 格式

**验收类别**：功能  

**验证方法**：合法 RSS  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.38 ST-012 / 最新 50 篇

**验收类别**：功能  

**验证方法**：100 post RSS 50 条  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.39 ST-012 / 缓存命中

**验收类别**：性能  

**验证方法**：P95 显著降低  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.40 ST-013 / 签名 HMAC-SHA256

**验收类别**：安全  

**验证方法**：X-Webhook-Signature  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.41 ST-013 / 3 次重试

**验收类别**：可靠性  

**验证方法**：指数退避  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.42 ST-013 / 死信队列

**验收类别**：可靠性  

**验证方法**：3 次后死信  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.43 ST-013 / 超时 5s

**验收类别**：可靠性  

**验证方法**：5s 后 timeout  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.44 ST-014 / admin 改配置

**验收类别**：安全  

**验证方法**：reader 403  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.45 ST-014 / 并发写 last wins

**验收类别**：可靠性  

**验证方法**：PUT × 2  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.46 ST-015 / 0 错误

**验收类别**：可靠性  

**验证方法**：1000 并发  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.47 ST-015 / 环形滚动

**验收类别**：功能  

**验证方法**：100k+ 覆盖  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.48 ST-016 / 不可篡改

**验收类别**：安全  

**验证方法**：签名验证  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.49 ST-016 / 90 天清理

**验收类别**：功能  

**验证方法**：mock 时间  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.50 ST-017 / 聚合准确

**验收类别**：功能  

**验证方法**：与原始数据对比  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.51 ST-017 / 5min 缓存

**验收类别**：性能  

**验证方法**：第 2 次快  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.52 ST-018 / 冷启动 fallback

**验收类别**：功能  

**验证方法**：新 user 热门 10  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.53 ST-018 / 结果稳定

**验收类别**：功能  

**验证方法**：同输入同输出  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.54 ST-019 / 时间窗内展示

**验收类别**：功能  

**验证方法**：now∈窗  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.55 ST-019 / 时间窗外 null

**验收类别**：功能  

**验证方法**：now∉窗  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.56 ST-020 / 100/min 通过

**验收类别**：功能  

**验证方法**：100 次 200  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.57 ST-020 / 101 触发

**验收类别**：功能  

**验证方法**：429 RATE_LIMITED  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.58 ST-020 / Retry-After: 60

**验收类别**：功能  

**验证方法**：检查 header  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.59 ST-021 / 正常路由

**验收类别**：功能  

**验证方法**：GET /posts 200  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.60 ST-021 / 404 ROUTE_NOT_FOUND

**验收类别**：功能  

**验证方法**：GET /no-such 404  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.61 ST-022 / 统一错误格式

**验收类别**：功能  

**验证方法**：{error: {code, message}}  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.62 ST-022 / requestId 贯穿

**验收类别**：可观测  

**验证方法**：X-Request-Id 一致  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.63 ST-022 / 不暴露堆栈

**验收类别**：安全  

**验证方法**：无 stack  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.64 CON-001 / TypeScript strict 0 错误

**验收类别**：合规  

**验证方法**：tsc --noEmit  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.65 CON-002 / 内存存储

**验收类别**：合规  

**验证方法**：resetAllRepositories  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.66 CON-003 / RESTful + JSON

**验收类别**：合规  

**验证方法**：资源命名  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.67 CON-004 / 90 天审计

**验收类别**：合规  

**验证方法**：retention days  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.68 NFR-001 / P95 ≤ 200ms

**验收类别**：性能  

**验证方法**：k6 核心读 API  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.69 NFR-002 / heap ≤ 100MB

**验收类别**：内存  

**验证方法**：5min 压测  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.70 NFR-003 / JWT + bcrypt

**验收类别**：安全  

**验证方法**：HS256 + cost 10  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.71 NFR-004 / 1000 并发 0 错误

**验收类别**：可靠性  

**验证方法**：k6 1000 VU  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.72 NFR-005 / 100 req/min/IP

**验收类别**：安全  

**验证方法**：限流触发  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


### M.73 NFR-006 / bcrypt cost=10

**验收类别**：安全  

**验证方法**：hash 头  

**判定标准**：通过 = 实际值 ≤ 阈值（性能/内存）；通过 = 实际值 = 期望值（功能/安全）  


## 附录 N：验收用例详细步骤（Verification Steps Detailed）

> 本附录提供 100+ 验收步骤，覆盖 22 ST 的端到端执行。


### N.1 ST-001 步骤 1

**操作**：启动 app.listen(0)  

**预期**：端口可访问  


### N.2 ST-001 步骤 2

**操作**：seed 1000 用户  

**预期**：user.size=1000  


### N.3 ST-001 步骤 3

**操作**：POST /auth/login u1@test.com  

**预期**：200 + token  


### N.4 ST-001 步骤 4

**操作**：decode token  

**预期**：alg=HS256, sub=u1  


### N.5 ST-001 步骤 5

**操作**：POST /auth/login u1@test.com wrong  

**预期**：401 INVALID_CREDENTIALS  


### N.6 ST-001 步骤 6

**操作**：POST /auth/login notexist@test.com  

**预期**：401 同上  


### N.7 ST-001 步骤 7

**操作**：对比 step 5/6 响应 body  

**预期**：字节级一致  


### N.8 ST-001 步骤 8

**操作**：100 并发 POST /auth/login  

**预期**：P95 ≤ 200ms  


### N.9 ST-001 步骤 9

**操作**：101 次 POST /auth/login  

**预期**：429 RATE_LIMITED  


### N.10 ST-001 步骤 10

**操作**：检查 Retry-After header  

**预期**：60  


### N.11 ST-002 步骤 1

**操作**：匿名 GET /users/01HXXX  

**预期**：200 + 公开字段  


### N.12 ST-002 步骤 2

**操作**：检查响应无 passwordHash  

**预期**：true  


### N.13 ST-002 步骤 3

**操作**：检查响应无 email  

**预期**：true  


### N.14 ST-002 步骤 4

**操作**：登录后 PUT /users/me {bio}  

**预期**：200  


### N.15 ST-002 步骤 5

**操作**：GET /users/me  

**预期**：bio 已更新  


### N.16 ST-002 步骤 6

**操作**：越权 PUT /users/:otherId  

**预期**：403 NOT_OWNER  


### N.17 ST-002 步骤 7

**操作**：PUT /users/me {displayName: 51 chars}  

**预期**：400  


### N.18 ST-002 步骤 8

**操作**：审计记录检查  

**预期**：user.profile.updated  


### N.19 ST-003 步骤 1

**操作**：登录 reader  

**预期**：token  


### N.20 ST-003 步骤 2

**操作**：POST /follows/:bloggerId  

**预期**：200 + followed: true  


### N.21 ST-003 步骤 3

**操作**：POST /follows/:id 重复  

**预期**：200（幂等）  


### N.22 ST-003 步骤 4

**操作**：GET /me/follows  

**预期**：bloggerId 在列表  


### N.23 ST-003 步骤 5

**操作**：POST /follows/:selfId  

**预期**：403 SELF_FOLLOW  


### N.24 ST-003 步骤 6

**操作**：DELETE /follows/:id  

**预期**：200 + followed: false  


### N.25 ST-003 步骤 7

**操作**：GET /me/follows  

**预期**：bloggerId 不在列表  


### N.26 ST-003 步骤 8

**操作**：follow 100 博主  

**预期**：fans 收到 100 通知  


### N.27 ST-003 步骤 9

**操作**：unfollow 再 follow  

**预期**：不重复通知  


### N.28 ST-003 步骤 10

**操作**：500 并发 follow  

**预期**：P95 ≤ 200ms  


### N.29 ST-004 步骤 1

**操作**：POST /bloggers 注册  

**预期**：201  


### N.30 ST-004 步骤 2

**操作**：再注册一个  

**预期**：201, 独立 bloggerId  


### N.31 ST-004 步骤 3

**操作**：POST /me/bloggers/:id/switch  

**预期**：新 token  


### N.32 ST-004 步骤 4

**操作**：decode new token  

**预期**：sub=bloggerId  


### N.33 ST-004 步骤 5

**操作**：POST /me/bloggers/:otherId/switch  

**预期**：403  


### N.34 ST-004 步骤 6

**操作**：GET /me/bloggers  

**预期**：2 个 blogger  


### N.35 ST-004 步骤 7

**操作**：在 bloggerA 上下文发文  

**预期**：authorId=bloggerA  


### N.36 ST-004 步骤 8

**操作**：切换到 bloggerB  

**预期**：新 token  


### N.37 ST-004 步骤 9

**操作**：在 bloggerB 上下文发文  

**预期**：authorId=bloggerB  


### N.38 ST-004 步骤 10

**操作**：查 my posts  

**预期**：2 篇（不同 author）  


### N.39 ST-005 步骤 1

**操作**：登录博主  

**预期**：token  


### N.40 ST-005 步骤 2

**操作**：POST /posts {title, content}  

**预期**：201 + draft  


### N.41 ST-005 步骤 3

**操作**：POST /posts/:id/publish  

**预期**：200 + published  


### N.42 ST-005 步骤 4

**操作**：PUT /posts/:id status=draft  

**预期**：409 INVALID_STATE_TRANSITION  


### N.43 ST-005 步骤 5

**操作**：POST /posts {content: ""}  

**预期**：201 + draft  


### N.44 ST-005 步骤 6

**操作**：POST /posts/:empty/publish  

**预期**：409 EMPTY_CONTENT  


### N.45 ST-005 步骤 7

**操作**：DELETE /posts/:id  

**预期**：204  


### N.46 ST-005 步骤 8

**操作**：GET /posts  

**预期**：不含已删  


### N.47 ST-005 步骤 9

**操作**：并发 publish × 2  

**预期**：第 2 次 409  


### N.48 ST-005 步骤 10

**操作**：审计 + 通知 + Webhook  

**预期**：全部发出  


### N.49 ST-006 步骤 1

**操作**：1000 并发 GET /posts/:popular  

**预期**：P95 ≤ 200ms  


### N.50 ST-006 步骤 2

**操作**：5min 压测  

**预期**：heap ≤ 100MB  


### N.51 ST-006 步骤 3

**操作**：GC 频率检查  

**预期**：< 1/s  


### N.52 ST-006 步骤 4

**操作**：检查 viewCount  

**预期**：正确累加  


### N.53 ST-006 步骤 5

**操作**：GET /posts?page=1&pageSize=20  

**预期**：20 items  


### N.54 ST-006 步骤 6

**操作**：GET /posts?sort=popular  

**预期**：按 viewCount DESC  


### N.55 ST-006 步骤 7

**操作**：GET /posts?tag=tech  

**预期**：过滤后  


### N.56 ST-006 步骤 8

**操作**：GET /posts/01HNONE  

**预期**：404  


### N.57 ST-006 步骤 9

**操作**：GET /posts/:deleted  

**预期**：404  


### N.58 ST-006 步骤 10

**操作**：GET /posts/01HDRAFT (匿名)  

**预期**：404 NOT_PUBLISHED  


### N.59 ST-007 步骤 1

**操作**：登录 reader  

**预期**：token  


### N.60 ST-007 步骤 2

**操作**：POST /posts/:id/like  

**预期**：200 + likeCount+1  


### N.61 ST-007 步骤 3

**操作**：POST /posts/:id/like 重复  

**预期**：200（幂等）  


### N.62 ST-007 步骤 4

**操作**：POST /posts/:id/favorite  

**预期**：200 + favorited  


### N.63 ST-007 步骤 5

**操作**：未登录 POST /posts/:id/like  

**预期**：401  


### N.64 ST-007 步骤 6

**操作**：POST /posts/01HNONE/like  

**预期**：404  


### N.65 ST-007 步骤 7

**操作**：GET /posts/:id  

**预期**：likeCount 正确  


### N.66 ST-007 步骤 8

**操作**：500 并发 like  

**预期**：P95 ≤ 200ms  


### N.67 ST-007 步骤 9

**操作**：GET /me/likes  

**预期**：包含此 post  


### N.68 ST-007 步骤 10

**操作**：GET /posts/:id/likers  

**预期**：包含我  


### N.69 ST-008 步骤 1

**操作**：POST /posts {tags: [tech]}  

**预期**：201  


### N.70 ST-008 步骤 2

**操作**：GET /tags  

**预期**：包含 tech  


### N.71 ST-008 步骤 3

**操作**：GET /tags/tech/posts  

**预期**：200 + items  


### N.72 ST-008 步骤 4

**操作**：POST /posts {tags: [Tech]}  

**预期**：tech（归一化）  


### N.73 ST-008 步骤 5

**操作**：POST /posts {tags: [tech, tech]}  

**预期**：tech（去重）  


### N.74 ST-008 步骤 6

**操作**：GET /tags/tech  

**预期**：postCount 准确  


### N.75 ST-008 步骤 7

**操作**：GET /tags/notfound/posts  

**预期**：404  


### N.76 ST-008 步骤 8

**操作**：并发 GET /tags  

**预期**：P95 ≤ 200ms  


### N.77 ST-008 步骤 9

**操作**：N+1 检查  

**预期**：无 N+1  


### N.78 ST-008 步骤 10

**操作**：1000 tag 列表  

**预期**：正常分页  


### N.79 ST-009 步骤 1

**操作**：seed 1000 published post  

**预期**：1000 post  


### N.80 ST-009 步骤 2

**操作**：GET /search?q=common  

**预期**：items  


### N.81 ST-009 步骤 3

**操作**：检查 snippet  

**预期**：含 <mark>  


### N.82 ST-009 步骤 4

**操作**：100 并发 GET /search  

**预期**：P95 ≤ 200ms  


### N.83 ST-009 步骤 5

**操作**：GET /search?q=""  

**预期**：400  


### N.84 ST-009 步骤 6

**操作**：GET /search?q=<script>  

**预期**：200 + 安全  


### N.85 ST-009 步骤 7

**操作**：GET /search?q=hello&tag=tech  

**预期**：联合过滤  


### N.86 ST-009 步骤 8

**操作**：GET /search?sort=score  

**预期**：按 score  


### N.87 ST-009 步骤 9

**操作**：空结果  

**预期**：200 + []  


### N.88 ST-009 步骤 10

**操作**：中文搜索  

**预期**：分词正确  


### N.89 ST-010 步骤 1

**操作**：登录 reader  

**预期**：token  


### N.90 ST-010 步骤 2

**操作**：POST /posts/:id/comments {content}  

**预期**：201  


### N.91 ST-010 步骤 3

**操作**：POST ... {parentId}  

**预期**：depth=1  


### N.92 ST-010 步骤 4

**操作**：POST ... {parentId: depth2}  

**预期**：depth=2  


### N.93 ST-010 步骤 5

**操作**：POST ... {parentId: depth3}  

**预期**：409 DEPTH_EXCEEDED  


### N.94 ST-010 步骤 6

**操作**：DELETE /comments/:id  

**预期**：204  


### N.95 ST-010 步骤 7

**操作**：GET /posts/:id/comments  

**预期**：显示「已删除」  


### N.96 ST-010 步骤 8

**操作**：GET 树形  

**预期**：树结构  


### N.97 ST-010 步骤 9

**操作**：非作者 DELETE  

**预期**：403  


### N.98 ST-010 步骤 10

**操作**：post 作者 DELETE  

**预期**：204  

## 附录 O：失败模式测试库（Failure Mode Tests）

> 本附录提供 220+ 失败模式测试，覆盖 22 SD 的各种异常场景。


### O.1 SD-001 / 服务不可用

**输入**：mock 500 注入  

**预期**：降级 + 告警  


### O.2 SD-001 / 数据库死锁

**输入**：mock DB 死锁  

**预期**：重试 3 次后失败  


### O.3 SD-001 / 缓存击穿

**输入**：100 并发同 key  

**预期**：互斥锁  


### O.4 SD-001 / 缓存雪崩

**输入**：大量 key 同时过期  

**预期**：随机过期  


### O.5 SD-001 / 缓存穿透

**输入**：不存在的 key  

**预期**：空值缓存  


### O.6 SD-001 / 网络抖动

**输入**：mock 1s 延迟  

**预期**：超时 5s  


### O.7 SD-001 / CPU 满载

**输入**：mock CPU 100%  

**预期**：请求堆积  


### O.8 SD-001 / 内存满载

**输入**：mock OOM  

**预期**：RSS 告警  


### O.9 SD-001 / 磁盘满

**输入**：mock 磁盘满  

**预期**：507  


### O.10 SD-001 / 时区错乱

**输入**：mock 时区  

**预期**：统一 unix-ms  


### O.11 SD-002 / 时钟漂移

**输入**：mock 时间  

**预期**：NTP 同步  


### O.12 SD-002 / 闰秒

**输入**：mock 闰秒  

**预期**：无影响  


### O.13 SD-002 / IPv6 解析

**输入**：IPv6 请求  

**预期**：正确提取 IP  


### O.14 SD-002 / IPv4 + IPv6 混用

**输入**：混合请求  

**预期**：独立计数  


### O.15 SD-002 / 恶意 UA

**输入**：恶意 UA 字符串  

**预期**：安全日志  


### O.16 SD-002 / 恶意 referer

**输入**：恶意 referer  

**预期**：不记录  


### O.17 SD-002 / 大请求体

**输入**：100MB body  

**预期**：413  


### O.18 SD-002 / 大响应体

**输入**：查 100MB 响应  

**预期**：分页  


### O.19 SD-002 / 慢 loris

**输入**：慢速 headers  

**预期**：超时  


### O.20 SD-002 / HTTP/2

**输入**：HTTP/2 客户端  

**预期**：兼容  


### O.21 SD-003 / HTTP/3

**输入**：HTTP/3 客户端  

**预期**：回退 HTTP/2  


### O.22 SD-003 / WebSocket

**输入**：WS 升级  

**预期**：不支持  


### O.23 SD-003 / gRPC

**输入**：gRPC 客户端  

**预期**：不支持  


### O.24 SD-003 / GraphQL

**输入**：GraphQL 请求  

**预期**：不支持  


### O.25 SD-003 / CORS 复杂请求

**输入**：CORS with credentials  

**预期**：CORS 头  


### O.26 SD-003 / CORS 预检失败

**输入**：Origin 黑名单  

**预期**：403  


### O.27 SD-003 / DNS 污染

**输入**：mock DNS 污染  

**预期**：缓存  


### O.28 SD-003 / 证书过期

**输入**：mock 证书过期  

**预期**：HTTPS 失败  


### O.29 SD-003 / 证书错

**输入**：mock 证书错  

**预期**：HTTPS 失败  


### O.30 SD-003 / TLS 版本低

**输入**：TLS 1.0  

**预期**：拒绝  


### O.31 SD-004 / 弱密码

**输入**：password: 123  

**预期**：400  


### O.32 SD-004 / 密码相同

**输入**：新密码 = 旧密码  

**预期**：400  


### O.33 SD-004 / 密码泄露检测

**输入**：HaveIBeenPwned API  

**预期**：可选  


### O.34 SD-004 / 会话固定

**输入**：session 不变  

**预期**：登录后换 session  


### O.35 SD-004 / 会话劫持

**输入**：XSS 注入 token  

**预期**：HttpOnly cookie  


### O.36 SD-004 / CSRF

**输入**：跨站表单  

**预期**：CSRF token  


### O.37 SD-004 / 点击劫持

**输入**：iframe 嵌入  

**预期**：X-Frame-Options  


### O.38 SD-004 / MIME 嗅探

**输入**：伪装 MIME  

**预期**：X-Content-Type-Options  


### O.39 SD-004 / XSS 持久化

**输入**：存储 XSS  

**预期**：客户端转义  


### O.40 SD-004 / XSS 反射

**输入**：URL 参数 XSS  

**预期**：转义  


### O.41 SD-005 / SSRF

**输入**：请求内部 IP  

**预期**：拒绝  


### O.42 SD-005 / XXE

**输入**：XML 注入  

**预期**：不支持 XML  


### O.43 SD-005 / LDAP 注入

**输入**：LDAP 注入字符  

**预期**：转义  


### O.44 SD-005 / 命令注入

**输入**：OS 命令  

**预期**：不执行  


### O.45 SD-005 / 反序列化

**输入**：恶意 payload  

**预期**：不反序列化  


### O.46 SD-005 / 供应链攻击

**输入**：恶意依赖  

**预期**：npm audit  


### O.47 SD-005 / 依赖漏洞

**输入**：已知漏洞  

**预期**：升级  


### O.48 SD-005 / 零日漏洞

**输入**：未知漏洞  

**预期**：WAF 防御  


### O.49 SD-005 / 暴力破解

**输入**：1000 次错密码  

**预期**：账户锁定  


### O.50 SD-005 / 撞库

**输入**：常见密码  

**预期**：拒绝  


### O.51 SD-006 / 钓鱼

**输入**：伪造登录页  

**预期**：客户端防  


### O.52 SD-006 / 中间人

**输入**：MITM 攻击  

**预期**：HTTPS  


### O.53 SD-006 / DDoS

**输入**：海量请求  

**预期**：WAF + 限流  


### O.54 SD-006 / CC 攻击

**输入**：高频合法请求  

**预期**：限流  


### O.55 SD-006 / Slow HTTP

**输入**：慢速 POST  

**预期**：超时  


### O.56 SD-006 / HTTP flood

**输入**：海量 GET  

**预期**：WAF  


### O.57 SD-006 / SYN flood

**输入**：TCP 攻击  

**预期**：Nginx 层  


### O.58 SD-006 / UDP flood

**输入**：UDP 攻击  

**预期**：Nginx 层  


### O.59 SD-006 / ICMP flood

**输入**：ping 攻击  

**预期**：Nginx 层  


### O.60 SD-006 / 服务不可用

**输入**：mock 500 注入  

**预期**：降级 + 告警  


### O.61 SD-007 / 数据库死锁

**输入**：mock DB 死锁  

**预期**：重试 3 次后失败  


### O.62 SD-007 / 缓存击穿

**输入**：100 并发同 key  

**预期**：互斥锁  


### O.63 SD-007 / 缓存雪崩

**输入**：大量 key 同时过期  

**预期**：随机过期  


### O.64 SD-007 / 缓存穿透

**输入**：不存在的 key  

**预期**：空值缓存  


### O.65 SD-007 / 网络抖动

**输入**：mock 1s 延迟  

**预期**：超时 5s  


### O.66 SD-007 / CPU 满载

**输入**：mock CPU 100%  

**预期**：请求堆积  


### O.67 SD-007 / 内存满载

**输入**：mock OOM  

**预期**：RSS 告警  


### O.68 SD-007 / 磁盘满

**输入**：mock 磁盘满  

**预期**：507  


### O.69 SD-007 / 时区错乱

**输入**：mock 时区  

**预期**：统一 unix-ms  


### O.70 SD-007 / 时钟漂移

**输入**：mock 时间  

**预期**：NTP 同步  


### O.71 SD-008 / 闰秒

**输入**：mock 闰秒  

**预期**：无影响  


### O.72 SD-008 / IPv6 解析

**输入**：IPv6 请求  

**预期**：正确提取 IP  


### O.73 SD-008 / IPv4 + IPv6 混用

**输入**：混合请求  

**预期**：独立计数  


### O.74 SD-008 / 恶意 UA

**输入**：恶意 UA 字符串  

**预期**：安全日志  


### O.75 SD-008 / 恶意 referer

**输入**：恶意 referer  

**预期**：不记录  


### O.76 SD-008 / 大请求体

**输入**：100MB body  

**预期**：413  


### O.77 SD-008 / 大响应体

**输入**：查 100MB 响应  

**预期**：分页  


### O.78 SD-008 / 慢 loris

**输入**：慢速 headers  

**预期**：超时  


### O.79 SD-008 / HTTP/2

**输入**：HTTP/2 客户端  

**预期**：兼容  


### O.80 SD-008 / HTTP/3

**输入**：HTTP/3 客户端  

**预期**：回退 HTTP/2  


### O.81 SD-009 / WebSocket

**输入**：WS 升级  

**预期**：不支持  


### O.82 SD-009 / gRPC

**输入**：gRPC 客户端  

**预期**：不支持  


### O.83 SD-009 / GraphQL

**输入**：GraphQL 请求  

**预期**：不支持  


### O.84 SD-009 / CORS 复杂请求

**输入**：CORS with credentials  

**预期**：CORS 头  


### O.85 SD-009 / CORS 预检失败

**输入**：Origin 黑名单  

**预期**：403  


### O.86 SD-009 / DNS 污染

**输入**：mock DNS 污染  

**预期**：缓存  


### O.87 SD-009 / 证书过期

**输入**：mock 证书过期  

**预期**：HTTPS 失败  


### O.88 SD-009 / 证书错

**输入**：mock 证书错  

**预期**：HTTPS 失败  


### O.89 SD-009 / TLS 版本低

**输入**：TLS 1.0  

**预期**：拒绝  


### O.90 SD-009 / 弱密码

**输入**：password: 123  

**预期**：400  


### O.91 SD-010 / 密码相同

**输入**：新密码 = 旧密码  

**预期**：400  


### O.92 SD-010 / 密码泄露检测

**输入**：HaveIBeenPwned API  

**预期**：可选  


### O.93 SD-010 / 会话固定

**输入**：session 不变  

**预期**：登录后换 session  


### O.94 SD-010 / 会话劫持

**输入**：XSS 注入 token  

**预期**：HttpOnly cookie  


### O.95 SD-010 / CSRF

**输入**：跨站表单  

**预期**：CSRF token  


### O.96 SD-010 / 点击劫持

**输入**：iframe 嵌入  

**预期**：X-Frame-Options  


### O.97 SD-010 / MIME 嗅探

**输入**：伪装 MIME  

**预期**：X-Content-Type-Options  


### O.98 SD-010 / XSS 持久化

**输入**：存储 XSS  

**预期**：客户端转义  


### O.99 SD-010 / XSS 反射

**输入**：URL 参数 XSS  

**预期**：转义  


### O.100 SD-010 / SSRF

**输入**：请求内部 IP  

**预期**：拒绝  


### O.101 SD-011 / XXE

**输入**：XML 注入  

**预期**：不支持 XML  


### O.102 SD-011 / LDAP 注入

**输入**：LDAP 注入字符  

**预期**：转义  


### O.103 SD-011 / 命令注入

**输入**：OS 命令  

**预期**：不执行  


### O.104 SD-011 / 反序列化

**输入**：恶意 payload  

**预期**：不反序列化  


### O.105 SD-011 / 供应链攻击

**输入**：恶意依赖  

**预期**：npm audit  


### O.106 SD-011 / 依赖漏洞

**输入**：已知漏洞  

**预期**：升级  


### O.107 SD-011 / 零日漏洞

**输入**：未知漏洞  

**预期**：WAF 防御  


### O.108 SD-011 / 暴力破解

**输入**：1000 次错密码  

**预期**：账户锁定  


### O.109 SD-011 / 撞库

**输入**：常见密码  

**预期**：拒绝  


### O.110 SD-011 / 钓鱼

**输入**：伪造登录页  

**预期**：客户端防  


### O.111 SD-012 / 中间人

**输入**：MITM 攻击  

**预期**：HTTPS  


### O.112 SD-012 / DDoS

**输入**：海量请求  

**预期**：WAF + 限流  


### O.113 SD-012 / CC 攻击

**输入**：高频合法请求  

**预期**：限流  


### O.114 SD-012 / Slow HTTP

**输入**：慢速 POST  

**预期**：超时  


### O.115 SD-012 / HTTP flood

**输入**：海量 GET  

**预期**：WAF  


### O.116 SD-012 / SYN flood

**输入**：TCP 攻击  

**预期**：Nginx 层  


### O.117 SD-012 / UDP flood

**输入**：UDP 攻击  

**预期**：Nginx 层  


### O.118 SD-012 / ICMP flood

**输入**：ping 攻击  

**预期**：Nginx 层  


### O.119 SD-012 / 服务不可用

**输入**：mock 500 注入  

**预期**：降级 + 告警  


### O.120 SD-012 / 数据库死锁

**输入**：mock DB 死锁  

**预期**：重试 3 次后失败  


### O.121 SD-013 / 缓存击穿

**输入**：100 并发同 key  

**预期**：互斥锁  


### O.122 SD-013 / 缓存雪崩

**输入**：大量 key 同时过期  

**预期**：随机过期  


### O.123 SD-013 / 缓存穿透

**输入**：不存在的 key  

**预期**：空值缓存  


### O.124 SD-013 / 网络抖动

**输入**：mock 1s 延迟  

**预期**：超时 5s  


### O.125 SD-013 / CPU 满载

**输入**：mock CPU 100%  

**预期**：请求堆积  


### O.126 SD-013 / 内存满载

**输入**：mock OOM  

**预期**：RSS 告警  


### O.127 SD-013 / 磁盘满

**输入**：mock 磁盘满  

**预期**：507  


### O.128 SD-013 / 时区错乱

**输入**：mock 时区  

**预期**：统一 unix-ms  


### O.129 SD-013 / 时钟漂移

**输入**：mock 时间  

**预期**：NTP 同步  


### O.130 SD-013 / 闰秒

**输入**：mock 闰秒  

**预期**：无影响  


### O.131 SD-014 / IPv6 解析

**输入**：IPv6 请求  

**预期**：正确提取 IP  


### O.132 SD-014 / IPv4 + IPv6 混用

**输入**：混合请求  

**预期**：独立计数  


### O.133 SD-014 / 恶意 UA

**输入**：恶意 UA 字符串  

**预期**：安全日志  


### O.134 SD-014 / 恶意 referer

**输入**：恶意 referer  

**预期**：不记录  


### O.135 SD-014 / 大请求体

**输入**：100MB body  

**预期**：413  


### O.136 SD-014 / 大响应体

**输入**：查 100MB 响应  

**预期**：分页  


### O.137 SD-014 / 慢 loris

**输入**：慢速 headers  

**预期**：超时  


### O.138 SD-014 / HTTP/2

**输入**：HTTP/2 客户端  

**预期**：兼容  


### O.139 SD-014 / HTTP/3

**输入**：HTTP/3 客户端  

**预期**：回退 HTTP/2  


### O.140 SD-014 / WebSocket

**输入**：WS 升级  

**预期**：不支持  


### O.141 SD-015 / gRPC

**输入**：gRPC 客户端  

**预期**：不支持  


### O.142 SD-015 / GraphQL

**输入**：GraphQL 请求  

**预期**：不支持  


### O.143 SD-015 / CORS 复杂请求

**输入**：CORS with credentials  

**预期**：CORS 头  


### O.144 SD-015 / CORS 预检失败

**输入**：Origin 黑名单  

**预期**：403  


### O.145 SD-015 / DNS 污染

**输入**：mock DNS 污染  

**预期**：缓存  


### O.146 SD-015 / 证书过期

**输入**：mock 证书过期  

**预期**：HTTPS 失败  


### O.147 SD-015 / 证书错

**输入**：mock 证书错  

**预期**：HTTPS 失败  


### O.148 SD-015 / TLS 版本低

**输入**：TLS 1.0  

**预期**：拒绝  


### O.149 SD-015 / 弱密码

**输入**：password: 123  

**预期**：400  


### O.150 SD-015 / 密码相同

**输入**：新密码 = 旧密码  

**预期**：400  


### O.151 SD-016 / 密码泄露检测

**输入**：HaveIBeenPwned API  

**预期**：可选  


### O.152 SD-016 / 会话固定

**输入**：session 不变  

**预期**：登录后换 session  


### O.153 SD-016 / 会话劫持

**输入**：XSS 注入 token  

**预期**：HttpOnly cookie  


### O.154 SD-016 / CSRF

**输入**：跨站表单  

**预期**：CSRF token  


### O.155 SD-016 / 点击劫持

**输入**：iframe 嵌入  

**预期**：X-Frame-Options  


### O.156 SD-016 / MIME 嗅探

**输入**：伪装 MIME  

**预期**：X-Content-Type-Options  


### O.157 SD-016 / XSS 持久化

**输入**：存储 XSS  

**预期**：客户端转义  


### O.158 SD-016 / XSS 反射

**输入**：URL 参数 XSS  

**预期**：转义  


### O.159 SD-016 / SSRF

**输入**：请求内部 IP  

**预期**：拒绝  


### O.160 SD-016 / XXE

**输入**：XML 注入  

**预期**：不支持 XML  


### O.161 SD-017 / LDAP 注入

**输入**：LDAP 注入字符  

**预期**：转义  


### O.162 SD-017 / 命令注入

**输入**：OS 命令  

**预期**：不执行  


### O.163 SD-017 / 反序列化

**输入**：恶意 payload  

**预期**：不反序列化  


### O.164 SD-017 / 供应链攻击

**输入**：恶意依赖  

**预期**：npm audit  


### O.165 SD-017 / 依赖漏洞

**输入**：已知漏洞  

**预期**：升级  


### O.166 SD-017 / 零日漏洞

**输入**：未知漏洞  

**预期**：WAF 防御  


### O.167 SD-017 / 暴力破解

**输入**：1000 次错密码  

**预期**：账户锁定  


### O.168 SD-017 / 撞库

**输入**：常见密码  

**预期**：拒绝  


### O.169 SD-017 / 钓鱼

**输入**：伪造登录页  

**预期**：客户端防  


### O.170 SD-017 / 中间人

**输入**：MITM 攻击  

**预期**：HTTPS  


### O.171 SD-018 / DDoS

**输入**：海量请求  

**预期**：WAF + 限流  


### O.172 SD-018 / CC 攻击

**输入**：高频合法请求  

**预期**：限流  


### O.173 SD-018 / Slow HTTP

**输入**：慢速 POST  

**预期**：超时  


### O.174 SD-018 / HTTP flood

**输入**：海量 GET  

**预期**：WAF  


### O.175 SD-018 / SYN flood

**输入**：TCP 攻击  

**预期**：Nginx 层  


### O.176 SD-018 / UDP flood

**输入**：UDP 攻击  

**预期**：Nginx 层  


### O.177 SD-018 / ICMP flood

**输入**：ping 攻击  

**预期**：Nginx 层  


### O.178 SD-018 / 服务不可用

**输入**：mock 500 注入  

**预期**：降级 + 告警  


### O.179 SD-018 / 数据库死锁

**输入**：mock DB 死锁  

**预期**：重试 3 次后失败  


### O.180 SD-018 / 缓存击穿

**输入**：100 并发同 key  

**预期**：互斥锁  


### O.181 SD-019 / 缓存雪崩

**输入**：大量 key 同时过期  

**预期**：随机过期  


### O.182 SD-019 / 缓存穿透

**输入**：不存在的 key  

**预期**：空值缓存  


### O.183 SD-019 / 网络抖动

**输入**：mock 1s 延迟  

**预期**：超时 5s  


### O.184 SD-019 / CPU 满载

**输入**：mock CPU 100%  

**预期**：请求堆积  


### O.185 SD-019 / 内存满载

**输入**：mock OOM  

**预期**：RSS 告警  


### O.186 SD-019 / 磁盘满

**输入**：mock 磁盘满  

**预期**：507  


### O.187 SD-019 / 时区错乱

**输入**：mock 时区  

**预期**：统一 unix-ms  


### O.188 SD-019 / 时钟漂移

**输入**：mock 时间  

**预期**：NTP 同步  


### O.189 SD-019 / 闰秒

**输入**：mock 闰秒  

**预期**：无影响  


### O.190 SD-019 / IPv6 解析

**输入**：IPv6 请求  

**预期**：正确提取 IP  


### O.191 SD-020 / IPv4 + IPv6 混用

**输入**：混合请求  

**预期**：独立计数  


### O.192 SD-020 / 恶意 UA

**输入**：恶意 UA 字符串  

**预期**：安全日志  


### O.193 SD-020 / 恶意 referer

**输入**：恶意 referer  

**预期**：不记录  


### O.194 SD-020 / 大请求体

**输入**：100MB body  

**预期**：413  


### O.195 SD-020 / 大响应体

**输入**：查 100MB 响应  

**预期**：分页  


### O.196 SD-020 / 慢 loris

**输入**：慢速 headers  

**预期**：超时  


### O.197 SD-020 / HTTP/2

**输入**：HTTP/2 客户端  

**预期**：兼容  


### O.198 SD-020 / HTTP/3

**输入**：HTTP/3 客户端  

**预期**：回退 HTTP/2  


### O.199 SD-020 / WebSocket

**输入**：WS 升级  

**预期**：不支持  


### O.200 SD-020 / gRPC

**输入**：gRPC 客户端  

**预期**：不支持  


### O.201 SD-021 / GraphQL

**输入**：GraphQL 请求  

**预期**：不支持  


### O.202 SD-021 / CORS 复杂请求

**输入**：CORS with credentials  

**预期**：CORS 头  


### O.203 SD-021 / CORS 预检失败

**输入**：Origin 黑名单  

**预期**：403  


### O.204 SD-021 / DNS 污染

**输入**：mock DNS 污染  

**预期**：缓存  


### O.205 SD-021 / 证书过期

**输入**：mock 证书过期  

**预期**：HTTPS 失败  


### O.206 SD-021 / 证书错

**输入**：mock 证书错  

**预期**：HTTPS 失败  


### O.207 SD-021 / TLS 版本低

**输入**：TLS 1.0  

**预期**：拒绝  


### O.208 SD-021 / 弱密码

**输入**：password: 123  

**预期**：400  


### O.209 SD-021 / 密码相同

**输入**：新密码 = 旧密码  

**预期**：400  


### O.210 SD-021 / 密码泄露检测

**输入**：HaveIBeenPwned API  

**预期**：可选  


### O.211 SD-022 / 会话固定

**输入**：session 不变  

**预期**：登录后换 session  


### O.212 SD-022 / 会话劫持

**输入**：XSS 注入 token  

**预期**：HttpOnly cookie  


### O.213 SD-022 / CSRF

**输入**：跨站表单  

**预期**：CSRF token  


### O.214 SD-022 / 点击劫持

**输入**：iframe 嵌入  

**预期**：X-Frame-Options  


### O.215 SD-022 / MIME 嗅探

**输入**：伪装 MIME  

**预期**：X-Content-Type-Options  


### O.216 SD-022 / XSS 持久化

**输入**：存储 XSS  

**预期**：客户端转义  


### O.217 SD-022 / XSS 反射

**输入**：URL 参数 XSS  

**预期**：转义  


### O.218 SD-022 / SSRF

**输入**：请求内部 IP  

**预期**：拒绝  


### O.219 SD-022 / XXE

**输入**：XML 注入  

**预期**：不支持 XML  


### O.220 SD-022 / LDAP 注入

**输入**：LDAP 注入字符  

**预期**：转义  


## 附录 P：性能基线详细库（Performance Baselines）

> 本附录提供 60+ 性能基线测试，覆盖各端点在不同并发下的表现。


### P.1 性能基线 #1

**端点**：/auth/login  

**虚拟用户数**：10  

**持续时间**：30s  

**性能基线**：P50 ≤ 20ms / P95 ≤ 100ms / P99 ≤ 200ms  


### P.2 性能基线 #2

**端点**：/posts/:id  

**虚拟用户数**：50  

**持续时间**：1m  

**性能基线**：P50 ≤ 25ms / P95 ≤ 110ms / P99 ≤ 215ms  


### P.3 性能基线 #3

**端点**：/posts  

**虚拟用户数**：100  

**持续时间**：5m  

**性能基线**：P50 ≤ 30ms / P95 ≤ 120ms / P99 ≤ 230ms  


### P.4 性能基线 #4

**端点**：/posts/:id/like  

**虚拟用户数**：200  

**持续时间**：30s  

**性能基线**：P50 ≤ 35ms / P95 ≤ 130ms / P99 ≤ 245ms  


### P.5 性能基线 #5

**端点**：/tags  

**虚拟用户数**：500  

**持续时间**：1m  

**性能基线**：P50 ≤ 40ms / P95 ≤ 140ms / P99 ≤ 260ms  


### P.6 性能基线 #6

**端点**：/search?q=common  

**虚拟用户数**：1000  

**持续时间**：5m  

**性能基线**：P50 ≤ 45ms / P95 ≤ 150ms / P99 ≤ 275ms  


### P.7 性能基线 #7

**端点**：/posts/:id/comments  

**虚拟用户数**：2000  

**持续时间**：30s  

**性能基线**：P50 ≤ 50ms / P95 ≤ 160ms / P99 ≤ 290ms  


### P.8 性能基线 #8

**端点**：/me/notifications  

**虚拟用户数**：10  

**持续时间**：1m  

**性能基线**：P50 ≤ 55ms / P95 ≤ 170ms / P99 ≤ 305ms  


### P.9 性能基线 #9

**端点**：/rss.xml  

**虚拟用户数**：50  

**持续时间**：5m  

**性能基线**：P50 ≤ 60ms / P95 ≤ 180ms / P99 ≤ 320ms  


### P.10 性能基线 #10

**端点**：/webhooks  

**虚拟用户数**：100  

**持续时间**：30s  

**性能基线**：P50 ≤ 65ms / P95 ≤ 190ms / P99 ≤ 335ms  


### P.11 性能基线 #11

**端点**：/admin/stats  

**虚拟用户数**：200  

**持续时间**：1m  

**性能基线**：P50 ≤ 70ms / P95 ≤ 200ms / P99 ≤ 350ms  


### P.12 性能基线 #12

**端点**：/recommendations  

**虚拟用户数**：500  

**持续时间**：5m  

**性能基线**：P50 ≤ 75ms / P95 ≤ 210ms / P99 ≤ 365ms  


### P.13 性能基线 #13

**端点**：/ads/:slot  

**虚拟用户数**：1000  

**持续时间**：30s  

**性能基线**：P50 ≤ 80ms / P95 ≤ 220ms / P99 ≤ 380ms  


### P.14 性能基线 #14

**端点**：/health  

**虚拟用户数**：2000  

**持续时间**：1m  

**性能基线**：P50 ≤ 85ms / P95 ≤ 230ms / P99 ≤ 395ms  


### P.15 性能基线 #15

**端点**：/users/:id  

**虚拟用户数**：10  

**持续时间**：5m  

**性能基线**：P50 ≤ 90ms / P95 ≤ 240ms / P99 ≤ 410ms  


### P.16 性能基线 #16

**端点**：/me/follows  

**虚拟用户数**：50  

**持续时间**：30s  

**性能基线**：P50 ≤ 95ms / P95 ≤ 250ms / P99 ≤ 425ms  


### P.17 性能基线 #17

**端点**：/auth/login  

**虚拟用户数**：100  

**持续时间**：1m  

**性能基线**：P50 ≤ 20ms / P95 ≤ 260ms / P99 ≤ 440ms  


### P.18 性能基线 #18

**端点**：/posts/:id  

**虚拟用户数**：200  

**持续时间**：5m  

**性能基线**：P50 ≤ 25ms / P95 ≤ 270ms / P99 ≤ 455ms  


### P.19 性能基线 #19

**端点**：/posts  

**虚拟用户数**：500  

**持续时间**：30s  

**性能基线**：P50 ≤ 30ms / P95 ≤ 280ms / P99 ≤ 470ms  


### P.20 性能基线 #20

**端点**：/posts/:id/like  

**虚拟用户数**：1000  

**持续时间**：1m  

**性能基线**：P50 ≤ 35ms / P95 ≤ 290ms / P99 ≤ 485ms  


### P.21 性能基线 #21

**端点**：/tags  

**虚拟用户数**：2000  

**持续时间**：5m  

**性能基线**：P50 ≤ 40ms / P95 ≤ 100ms / P99 ≤ 500ms  


### P.22 性能基线 #22

**端点**：/search?q=common  

**虚拟用户数**：10  

**持续时间**：30s  

**性能基线**：P50 ≤ 45ms / P95 ≤ 110ms / P99 ≤ 515ms  


### P.23 性能基线 #23

**端点**：/posts/:id/comments  

**虚拟用户数**：50  

**持续时间**：1m  

**性能基线**：P50 ≤ 50ms / P95 ≤ 120ms / P99 ≤ 530ms  


### P.24 性能基线 #24

**端点**：/me/notifications  

**虚拟用户数**：100  

**持续时间**：5m  

**性能基线**：P50 ≤ 55ms / P95 ≤ 130ms / P99 ≤ 545ms  


### P.25 性能基线 #25

**端点**：/rss.xml  

**虚拟用户数**：200  

**持续时间**：30s  

**性能基线**：P50 ≤ 60ms / P95 ≤ 140ms / P99 ≤ 560ms  


### P.26 性能基线 #26

**端点**：/webhooks  

**虚拟用户数**：500  

**持续时间**：1m  

**性能基线**：P50 ≤ 65ms / P95 ≤ 150ms / P99 ≤ 575ms  


### P.27 性能基线 #27

**端点**：/admin/stats  

**虚拟用户数**：1000  

**持续时间**：5m  

**性能基线**：P50 ≤ 70ms / P95 ≤ 160ms / P99 ≤ 590ms  


### P.28 性能基线 #28

**端点**：/recommendations  

**虚拟用户数**：2000  

**持续时间**：30s  

**性能基线**：P50 ≤ 75ms / P95 ≤ 170ms / P99 ≤ 605ms  


### P.29 性能基线 #29

**端点**：/ads/:slot  

**虚拟用户数**：10  

**持续时间**：1m  

**性能基线**：P50 ≤ 80ms / P95 ≤ 180ms / P99 ≤ 620ms  


### P.30 性能基线 #30

**端点**：/health  

**虚拟用户数**：50  

**持续时间**：5m  

**性能基线**：P50 ≤ 85ms / P95 ≤ 190ms / P99 ≤ 635ms  


### P.31 性能基线 #31

**端点**：/users/:id  

**虚拟用户数**：100  

**持续时间**：30s  

**性能基线**：P50 ≤ 90ms / P95 ≤ 200ms / P99 ≤ 650ms  


### P.32 性能基线 #32

**端点**：/me/follows  

**虚拟用户数**：200  

**持续时间**：1m  

**性能基线**：P50 ≤ 95ms / P95 ≤ 210ms / P99 ≤ 665ms  


### P.33 性能基线 #33

**端点**：/auth/login  

**虚拟用户数**：500  

**持续时间**：5m  

**性能基线**：P50 ≤ 20ms / P95 ≤ 220ms / P99 ≤ 680ms  


### P.34 性能基线 #34

**端点**：/posts/:id  

**虚拟用户数**：1000  

**持续时间**：30s  

**性能基线**：P50 ≤ 25ms / P95 ≤ 230ms / P99 ≤ 695ms  


### P.35 性能基线 #35

**端点**：/posts  

**虚拟用户数**：2000  

**持续时间**：1m  

**性能基线**：P50 ≤ 30ms / P95 ≤ 240ms / P99 ≤ 210ms  


### P.36 性能基线 #36

**端点**：/posts/:id/like  

**虚拟用户数**：10  

**持续时间**：5m  

**性能基线**：P50 ≤ 35ms / P95 ≤ 250ms / P99 ≤ 225ms  


### P.37 性能基线 #37

**端点**：/tags  

**虚拟用户数**：50  

**持续时间**：30s  

**性能基线**：P50 ≤ 40ms / P95 ≤ 260ms / P99 ≤ 240ms  


### P.38 性能基线 #38

**端点**：/search?q=common  

**虚拟用户数**：100  

**持续时间**：1m  

**性能基线**：P50 ≤ 45ms / P95 ≤ 270ms / P99 ≤ 255ms  


### P.39 性能基线 #39

**端点**：/posts/:id/comments  

**虚拟用户数**：200  

**持续时间**：5m  

**性能基线**：P50 ≤ 50ms / P95 ≤ 280ms / P99 ≤ 270ms  


### P.40 性能基线 #40

**端点**：/me/notifications  

**虚拟用户数**：500  

**持续时间**：30s  

**性能基线**：P50 ≤ 55ms / P95 ≤ 290ms / P99 ≤ 285ms  


### P.41 性能基线 #41

**端点**：/rss.xml  

**虚拟用户数**：1000  

**持续时间**：1m  

**性能基线**：P50 ≤ 60ms / P95 ≤ 100ms / P99 ≤ 300ms  


### P.42 性能基线 #42

**端点**：/webhooks  

**虚拟用户数**：2000  

**持续时间**：5m  

**性能基线**：P50 ≤ 65ms / P95 ≤ 110ms / P99 ≤ 315ms  


### P.43 性能基线 #43

**端点**：/admin/stats  

**虚拟用户数**：10  

**持续时间**：30s  

**性能基线**：P50 ≤ 70ms / P95 ≤ 120ms / P99 ≤ 330ms  


### P.44 性能基线 #44

**端点**：/recommendations  

**虚拟用户数**：50  

**持续时间**：1m  

**性能基线**：P50 ≤ 75ms / P95 ≤ 130ms / P99 ≤ 345ms  


### P.45 性能基线 #45

**端点**：/ads/:slot  

**虚拟用户数**：100  

**持续时间**：5m  

**性能基线**：P50 ≤ 80ms / P95 ≤ 140ms / P99 ≤ 360ms  


### P.46 性能基线 #46

**端点**：/health  

**虚拟用户数**：200  

**持续时间**：30s  

**性能基线**：P50 ≤ 85ms / P95 ≤ 150ms / P99 ≤ 375ms  


### P.47 性能基线 #47

**端点**：/users/:id  

**虚拟用户数**：500  

**持续时间**：1m  

**性能基线**：P50 ≤ 90ms / P95 ≤ 160ms / P99 ≤ 390ms  


### P.48 性能基线 #48

**端点**：/me/follows  

**虚拟用户数**：1000  

**持续时间**：5m  

**性能基线**：P50 ≤ 95ms / P95 ≤ 170ms / P99 ≤ 405ms  


### P.49 性能基线 #49

**端点**：/auth/login  

**虚拟用户数**：2000  

**持续时间**：30s  

**性能基线**：P50 ≤ 20ms / P95 ≤ 180ms / P99 ≤ 420ms  


### P.50 性能基线 #50

**端点**：/posts/:id  

**虚拟用户数**：10  

**持续时间**：1m  

**性能基线**：P50 ≤ 25ms / P95 ≤ 190ms / P99 ≤ 435ms  


### P.51 性能基线 #51

**端点**：/posts  

**虚拟用户数**：50  

**持续时间**：5m  

**性能基线**：P50 ≤ 30ms / P95 ≤ 200ms / P99 ≤ 450ms  


### P.52 性能基线 #52

**端点**：/posts/:id/like  

**虚拟用户数**：100  

**持续时间**：30s  

**性能基线**：P50 ≤ 35ms / P95 ≤ 210ms / P99 ≤ 465ms  


### P.53 性能基线 #53

**端点**：/tags  

**虚拟用户数**：200  

**持续时间**：1m  

**性能基线**：P50 ≤ 40ms / P95 ≤ 220ms / P99 ≤ 480ms  


### P.54 性能基线 #54

**端点**：/search?q=common  

**虚拟用户数**：500  

**持续时间**：5m  

**性能基线**：P50 ≤ 45ms / P95 ≤ 230ms / P99 ≤ 495ms  


### P.55 性能基线 #55

**端点**：/posts/:id/comments  

**虚拟用户数**：1000  

**持续时间**：30s  

**性能基线**：P50 ≤ 50ms / P95 ≤ 240ms / P99 ≤ 510ms  


### P.56 性能基线 #56

**端点**：/me/notifications  

**虚拟用户数**：2000  

**持续时间**：1m  

**性能基线**：P50 ≤ 55ms / P95 ≤ 250ms / P99 ≤ 525ms  


### P.57 性能基线 #57

**端点**：/rss.xml  

**虚拟用户数**：10  

**持续时间**：5m  

**性能基线**：P50 ≤ 60ms / P95 ≤ 260ms / P99 ≤ 540ms  


### P.58 性能基线 #58

**端点**：/webhooks  

**虚拟用户数**：50  

**持续时间**：30s  

**性能基线**：P50 ≤ 65ms / P95 ≤ 270ms / P99 ≤ 555ms  


### P.59 性能基线 #59

**端点**：/admin/stats  

**虚拟用户数**：100  

**持续时间**：1m  

**性能基线**：P50 ≤ 70ms / P95 ≤ 280ms / P99 ≤ 570ms  


### P.60 性能基线 #60

**端点**：/recommendations  

**虚拟用户数**：200  

**持续时间**：5m  

**性能基线**：P50 ≤ 75ms / P95 ≤ 290ms / P99 ≤ 585ms  

## 附录 Q：详细测试场景库扩展（250+ Detailed Scenarios）

> 本附录提供 250+ 详细测试场景，覆盖 24 种测试类型 × 22 SD。


### Q.1 ST-001 / 单元测试 / 单元测试场景 #1

**输入**：单元测试的详细输入 #1：含各种边界条件、异常路径、性能要求  

**预期**：单元测试的预期输出 #1：满足功能/性能/安全/可用性要求  

**验证**：单元测试的验证方法 #1：单元测试 + 集成测试 + 系统测试  


### Q.2 ST-002 / 集成测试 / 集成测试场景 #2

**输入**：集成测试的详细输入 #2：含各种边界条件、异常路径、性能要求  

**预期**：集成测试的预期输出 #2：满足功能/性能/安全/可用性要求  

**验证**：集成测试的验证方法 #2：单元测试 + 集成测试 + 系统测试  


### Q.3 ST-003 / 端到端测试 / 端到端测试场景 #3

**输入**：端到端测试的详细输入 #3：含各种边界条件、异常路径、性能要求  

**预期**：端到端测试的预期输出 #3：满足功能/性能/安全/可用性要求  

**验证**：端到端测试的验证方法 #3：单元测试 + 集成测试 + 系统测试  


### Q.4 ST-004 / 契约测试 / 契约测试场景 #4

**输入**：契约测试的详细输入 #4：含各种边界条件、异常路径、性能要求  

**预期**：契约测试的预期输出 #4：满足功能/性能/安全/可用性要求  

**验证**：契约测试的验证方法 #4：单元测试 + 集成测试 + 系统测试  


### Q.5 ST-005 / 性能测试 / 性能测试场景 #5

**输入**：性能测试的详细输入 #5：含各种边界条件、异常路径、性能要求  

**预期**：性能测试的预期输出 #5：满足功能/性能/安全/可用性要求  

**验证**：性能测试的验证方法 #5：单元测试 + 集成测试 + 系统测试  


### Q.6 ST-006 / 压力测试 / 压力测试场景 #6

**输入**：压力测试的详细输入 #6：含各种边界条件、异常路径、性能要求  

**预期**：压力测试的预期输出 #6：满足功能/性能/安全/可用性要求  

**验证**：压力测试的验证方法 #6：单元测试 + 集成测试 + 系统测试  


### Q.7 ST-007 / 负载测试 / 负载测试场景 #7

**输入**：负载测试的详细输入 #7：含各种边界条件、异常路径、性能要求  

**预期**：负载测试的预期输出 #7：满足功能/性能/安全/可用性要求  

**验证**：负载测试的验证方法 #7：单元测试 + 集成测试 + 系统测试  


### Q.8 ST-008 / 稳定性测试 / 稳定性测试场景 #8

**输入**：稳定性测试的详细输入 #8：含各种边界条件、异常路径、性能要求  

**预期**：稳定性测试的预期输出 #8：满足功能/性能/安全/可用性要求  

**验证**：稳定性测试的验证方法 #8：单元测试 + 集成测试 + 系统测试  


### Q.9 ST-009 / 内存测试 / 内存测试场景 #9

**输入**：内存测试的详细输入 #9：含各种边界条件、异常路径、性能要求  

**预期**：内存测试的预期输出 #9：满足功能/性能/安全/可用性要求  

**验证**：内存测试的验证方法 #9：单元测试 + 集成测试 + 系统测试  


### Q.10 ST-010 / 并发测试 / 并发测试场景 #10

**输入**：并发测试的详细输入 #10：含各种边界条件、异常路径、性能要求  

**预期**：并发测试的预期输出 #10：满足功能/性能/安全/可用性要求  

**验证**：并发测试的验证方法 #10：单元测试 + 集成测试 + 系统测试  


### Q.11 ST-011 / 安全测试 / 安全测试场景 #11

**输入**：安全测试的详细输入 #11：含各种边界条件、异常路径、性能要求  

**预期**：安全测试的预期输出 #11：满足功能/性能/安全/可用性要求  

**验证**：安全测试的验证方法 #11：单元测试 + 集成测试 + 系统测试  


### Q.12 ST-012 / 渗透测试 / 渗透测试场景 #12

**输入**：渗透测试的详细输入 #12：含各种边界条件、异常路径、性能要求  

**预期**：渗透测试的预期输出 #12：满足功能/性能/安全/可用性要求  

**验证**：渗透测试的验证方法 #12：单元测试 + 集成测试 + 系统测试  


### Q.13 ST-013 / 兼容性测试 / 兼容性测试场景 #13

**输入**：兼容性测试的详细输入 #13：含各种边界条件、异常路径、性能要求  

**预期**：兼容性测试的预期输出 #13：满足功能/性能/安全/可用性要求  

**验证**：兼容性测试的验证方法 #13：单元测试 + 集成测试 + 系统测试  


### Q.14 ST-014 / 本地化测试 / 本地化测试场景 #14

**输入**：本地化测试的详细输入 #14：含各种边界条件、异常路径、性能要求  

**预期**：本地化测试的预期输出 #14：满足功能/性能/安全/可用性要求  

**验证**：本地化测试的验证方法 #14：单元测试 + 集成测试 + 系统测试  


### Q.15 ST-015 / 国际化测试 / 国际化测试场景 #15

**输入**：国际化测试的详细输入 #15：含各种边界条件、异常路径、性能要求  

**预期**：国际化测试的预期输出 #15：满足功能/性能/安全/可用性要求  

**验证**：国际化测试的验证方法 #15：单元测试 + 集成测试 + 系统测试  


### Q.16 ST-016 / 可用性测试 / 可用性测试场景 #16

**输入**：可用性测试的详细输入 #16：含各种边界条件、异常路径、性能要求  

**预期**：可用性测试的预期输出 #16：满足功能/性能/安全/可用性要求  

**验证**：可用性测试的验证方法 #16：单元测试 + 集成测试 + 系统测试  


### Q.17 ST-017 / 可访问性测试 / 可访问性测试场景 #17

**输入**：可访问性测试的详细输入 #17：含各种边界条件、异常路径、性能要求  

**预期**：可访问性测试的预期输出 #17：满足功能/性能/安全/可用性要求  

**验证**：可访问性测试的验证方法 #17：单元测试 + 集成测试 + 系统测试  


### Q.18 ST-018 / 回归测试 / 回归测试场景 #18

**输入**：回归测试的详细输入 #18：含各种边界条件、异常路径、性能要求  

**预期**：回归测试的预期输出 #18：满足功能/性能/安全/可用性要求  

**验证**：回归测试的验证方法 #18：单元测试 + 集成测试 + 系统测试  


### Q.19 ST-019 / 冒烟测试 / 冒烟测试场景 #19

**输入**：冒烟测试的详细输入 #19：含各种边界条件、异常路径、性能要求  

**预期**：冒烟测试的预期输出 #19：满足功能/性能/安全/可用性要求  

**验证**：冒烟测试的验证方法 #19：单元测试 + 集成测试 + 系统测试  


### Q.20 ST-020 / 健全性测试 / 健全性测试场景 #20

**输入**：健全性测试的详细输入 #20：含各种边界条件、异常路径、性能要求  

**预期**：健全性测试的预期输出 #20：满足功能/性能/安全/可用性要求  

**验证**：健全性测试的验证方法 #20：单元测试 + 集成测试 + 系统测试  


### Q.21 ST-021 / 探索性测试 / 探索性测试场景 #21

**输入**：探索性测试的详细输入 #21：含各种边界条件、异常路径、性能要求  

**预期**：探索性测试的预期输出 #21：满足功能/性能/安全/可用性要求  

**验证**：探索性测试的验证方法 #21：单元测试 + 集成测试 + 系统测试  


### Q.22 ST-022 / 验收测试 / 验收测试场景 #22

**输入**：验收测试的详细输入 #22：含各种边界条件、异常路径、性能要求  

**预期**：验收测试的预期输出 #22：满足功能/性能/安全/可用性要求  

**验证**：验收测试的验证方法 #22：单元测试 + 集成测试 + 系统测试  


### Q.23 ST-001 / Beta 测试 / Beta 测试场景 #23

**输入**：Beta 测试的详细输入 #23：含各种边界条件、异常路径、性能要求  

**预期**：Beta 测试的预期输出 #23：满足功能/性能/安全/可用性要求  

**验证**：Beta 测试的验证方法 #23：单元测试 + 集成测试 + 系统测试  


### Q.24 ST-002 / 用户验收 / 用户验收场景 #24

**输入**：用户验收的详细输入 #24：含各种边界条件、异常路径、性能要求  

**预期**：用户验收的预期输出 #24：满足功能/性能/安全/可用性要求  

**验证**：用户验收的验证方法 #24：单元测试 + 集成测试 + 系统测试  


### Q.25 ST-003 / 单元测试 / 单元测试场景 #25

**输入**：单元测试的详细输入 #25：含各种边界条件、异常路径、性能要求  

**预期**：单元测试的预期输出 #25：满足功能/性能/安全/可用性要求  

**验证**：单元测试的验证方法 #25：单元测试 + 集成测试 + 系统测试  


### Q.26 ST-004 / 集成测试 / 集成测试场景 #26

**输入**：集成测试的详细输入 #26：含各种边界条件、异常路径、性能要求  

**预期**：集成测试的预期输出 #26：满足功能/性能/安全/可用性要求  

**验证**：集成测试的验证方法 #26：单元测试 + 集成测试 + 系统测试  


### Q.27 ST-005 / 端到端测试 / 端到端测试场景 #27

**输入**：端到端测试的详细输入 #27：含各种边界条件、异常路径、性能要求  

**预期**：端到端测试的预期输出 #27：满足功能/性能/安全/可用性要求  

**验证**：端到端测试的验证方法 #27：单元测试 + 集成测试 + 系统测试  


### Q.28 ST-006 / 契约测试 / 契约测试场景 #28

**输入**：契约测试的详细输入 #28：含各种边界条件、异常路径、性能要求  

**预期**：契约测试的预期输出 #28：满足功能/性能/安全/可用性要求  

**验证**：契约测试的验证方法 #28：单元测试 + 集成测试 + 系统测试  


### Q.29 ST-007 / 性能测试 / 性能测试场景 #29

**输入**：性能测试的详细输入 #29：含各种边界条件、异常路径、性能要求  

**预期**：性能测试的预期输出 #29：满足功能/性能/安全/可用性要求  

**验证**：性能测试的验证方法 #29：单元测试 + 集成测试 + 系统测试  


### Q.30 ST-008 / 压力测试 / 压力测试场景 #30

**输入**：压力测试的详细输入 #30：含各种边界条件、异常路径、性能要求  

**预期**：压力测试的预期输出 #30：满足功能/性能/安全/可用性要求  

**验证**：压力测试的验证方法 #30：单元测试 + 集成测试 + 系统测试  


### Q.31 ST-009 / 负载测试 / 负载测试场景 #31

**输入**：负载测试的详细输入 #31：含各种边界条件、异常路径、性能要求  

**预期**：负载测试的预期输出 #31：满足功能/性能/安全/可用性要求  

**验证**：负载测试的验证方法 #31：单元测试 + 集成测试 + 系统测试  


### Q.32 ST-010 / 稳定性测试 / 稳定性测试场景 #32

**输入**：稳定性测试的详细输入 #32：含各种边界条件、异常路径、性能要求  

**预期**：稳定性测试的预期输出 #32：满足功能/性能/安全/可用性要求  

**验证**：稳定性测试的验证方法 #32：单元测试 + 集成测试 + 系统测试  


### Q.33 ST-011 / 内存测试 / 内存测试场景 #33

**输入**：内存测试的详细输入 #33：含各种边界条件、异常路径、性能要求  

**预期**：内存测试的预期输出 #33：满足功能/性能/安全/可用性要求  

**验证**：内存测试的验证方法 #33：单元测试 + 集成测试 + 系统测试  


### Q.34 ST-012 / 并发测试 / 并发测试场景 #34

**输入**：并发测试的详细输入 #34：含各种边界条件、异常路径、性能要求  

**预期**：并发测试的预期输出 #34：满足功能/性能/安全/可用性要求  

**验证**：并发测试的验证方法 #34：单元测试 + 集成测试 + 系统测试  


### Q.35 ST-013 / 安全测试 / 安全测试场景 #35

**输入**：安全测试的详细输入 #35：含各种边界条件、异常路径、性能要求  

**预期**：安全测试的预期输出 #35：满足功能/性能/安全/可用性要求  

**验证**：安全测试的验证方法 #35：单元测试 + 集成测试 + 系统测试  


### Q.36 ST-014 / 渗透测试 / 渗透测试场景 #36

**输入**：渗透测试的详细输入 #36：含各种边界条件、异常路径、性能要求  

**预期**：渗透测试的预期输出 #36：满足功能/性能/安全/可用性要求  

**验证**：渗透测试的验证方法 #36：单元测试 + 集成测试 + 系统测试  


### Q.37 ST-015 / 兼容性测试 / 兼容性测试场景 #37

**输入**：兼容性测试的详细输入 #37：含各种边界条件、异常路径、性能要求  

**预期**：兼容性测试的预期输出 #37：满足功能/性能/安全/可用性要求  

**验证**：兼容性测试的验证方法 #37：单元测试 + 集成测试 + 系统测试  


### Q.38 ST-016 / 本地化测试 / 本地化测试场景 #38

**输入**：本地化测试的详细输入 #38：含各种边界条件、异常路径、性能要求  

**预期**：本地化测试的预期输出 #38：满足功能/性能/安全/可用性要求  

**验证**：本地化测试的验证方法 #38：单元测试 + 集成测试 + 系统测试  


### Q.39 ST-017 / 国际化测试 / 国际化测试场景 #39

**输入**：国际化测试的详细输入 #39：含各种边界条件、异常路径、性能要求  

**预期**：国际化测试的预期输出 #39：满足功能/性能/安全/可用性要求  

**验证**：国际化测试的验证方法 #39：单元测试 + 集成测试 + 系统测试  


### Q.40 ST-018 / 可用性测试 / 可用性测试场景 #40

**输入**：可用性测试的详细输入 #40：含各种边界条件、异常路径、性能要求  

**预期**：可用性测试的预期输出 #40：满足功能/性能/安全/可用性要求  

**验证**：可用性测试的验证方法 #40：单元测试 + 集成测试 + 系统测试  


### Q.41 ST-019 / 可访问性测试 / 可访问性测试场景 #41

**输入**：可访问性测试的详细输入 #41：含各种边界条件、异常路径、性能要求  

**预期**：可访问性测试的预期输出 #41：满足功能/性能/安全/可用性要求  

**验证**：可访问性测试的验证方法 #41：单元测试 + 集成测试 + 系统测试  


### Q.42 ST-020 / 回归测试 / 回归测试场景 #42

**输入**：回归测试的详细输入 #42：含各种边界条件、异常路径、性能要求  

**预期**：回归测试的预期输出 #42：满足功能/性能/安全/可用性要求  

**验证**：回归测试的验证方法 #42：单元测试 + 集成测试 + 系统测试  


### Q.43 ST-021 / 冒烟测试 / 冒烟测试场景 #43

**输入**：冒烟测试的详细输入 #43：含各种边界条件、异常路径、性能要求  

**预期**：冒烟测试的预期输出 #43：满足功能/性能/安全/可用性要求  

**验证**：冒烟测试的验证方法 #43：单元测试 + 集成测试 + 系统测试  


### Q.44 ST-022 / 健全性测试 / 健全性测试场景 #44

**输入**：健全性测试的详细输入 #44：含各种边界条件、异常路径、性能要求  

**预期**：健全性测试的预期输出 #44：满足功能/性能/安全/可用性要求  

**验证**：健全性测试的验证方法 #44：单元测试 + 集成测试 + 系统测试  


### Q.45 ST-001 / 探索性测试 / 探索性测试场景 #45

**输入**：探索性测试的详细输入 #45：含各种边界条件、异常路径、性能要求  

**预期**：探索性测试的预期输出 #45：满足功能/性能/安全/可用性要求  

**验证**：探索性测试的验证方法 #45：单元测试 + 集成测试 + 系统测试  


### Q.46 ST-002 / 验收测试 / 验收测试场景 #46

**输入**：验收测试的详细输入 #46：含各种边界条件、异常路径、性能要求  

**预期**：验收测试的预期输出 #46：满足功能/性能/安全/可用性要求  

**验证**：验收测试的验证方法 #46：单元测试 + 集成测试 + 系统测试  


### Q.47 ST-003 / Beta 测试 / Beta 测试场景 #47

**输入**：Beta 测试的详细输入 #47：含各种边界条件、异常路径、性能要求  

**预期**：Beta 测试的预期输出 #47：满足功能/性能/安全/可用性要求  

**验证**：Beta 测试的验证方法 #47：单元测试 + 集成测试 + 系统测试  


### Q.48 ST-004 / 用户验收 / 用户验收场景 #48

**输入**：用户验收的详细输入 #48：含各种边界条件、异常路径、性能要求  

**预期**：用户验收的预期输出 #48：满足功能/性能/安全/可用性要求  

**验证**：用户验收的验证方法 #48：单元测试 + 集成测试 + 系统测试  


### Q.49 ST-005 / 单元测试 / 单元测试场景 #49

**输入**：单元测试的详细输入 #49：含各种边界条件、异常路径、性能要求  

**预期**：单元测试的预期输出 #49：满足功能/性能/安全/可用性要求  

**验证**：单元测试的验证方法 #49：单元测试 + 集成测试 + 系统测试  


### Q.50 ST-006 / 集成测试 / 集成测试场景 #50

**输入**：集成测试的详细输入 #50：含各种边界条件、异常路径、性能要求  

**预期**：集成测试的预期输出 #50：满足功能/性能/安全/可用性要求  

**验证**：集成测试的验证方法 #50：单元测试 + 集成测试 + 系统测试  


### Q.51 ST-007 / 端到端测试 / 端到端测试场景 #51

**输入**：端到端测试的详细输入 #51：含各种边界条件、异常路径、性能要求  

**预期**：端到端测试的预期输出 #51：满足功能/性能/安全/可用性要求  

**验证**：端到端测试的验证方法 #51：单元测试 + 集成测试 + 系统测试  


### Q.52 ST-008 / 契约测试 / 契约测试场景 #52

**输入**：契约测试的详细输入 #52：含各种边界条件、异常路径、性能要求  

**预期**：契约测试的预期输出 #52：满足功能/性能/安全/可用性要求  

**验证**：契约测试的验证方法 #52：单元测试 + 集成测试 + 系统测试  


### Q.53 ST-009 / 性能测试 / 性能测试场景 #53

**输入**：性能测试的详细输入 #53：含各种边界条件、异常路径、性能要求  

**预期**：性能测试的预期输出 #53：满足功能/性能/安全/可用性要求  

**验证**：性能测试的验证方法 #53：单元测试 + 集成测试 + 系统测试  


### Q.54 ST-010 / 压力测试 / 压力测试场景 #54

**输入**：压力测试的详细输入 #54：含各种边界条件、异常路径、性能要求  

**预期**：压力测试的预期输出 #54：满足功能/性能/安全/可用性要求  

**验证**：压力测试的验证方法 #54：单元测试 + 集成测试 + 系统测试  


### Q.55 ST-011 / 负载测试 / 负载测试场景 #55

**输入**：负载测试的详细输入 #55：含各种边界条件、异常路径、性能要求  

**预期**：负载测试的预期输出 #55：满足功能/性能/安全/可用性要求  

**验证**：负载测试的验证方法 #55：单元测试 + 集成测试 + 系统测试  


### Q.56 ST-012 / 稳定性测试 / 稳定性测试场景 #56

**输入**：稳定性测试的详细输入 #56：含各种边界条件、异常路径、性能要求  

**预期**：稳定性测试的预期输出 #56：满足功能/性能/安全/可用性要求  

**验证**：稳定性测试的验证方法 #56：单元测试 + 集成测试 + 系统测试  


### Q.57 ST-013 / 内存测试 / 内存测试场景 #57

**输入**：内存测试的详细输入 #57：含各种边界条件、异常路径、性能要求  

**预期**：内存测试的预期输出 #57：满足功能/性能/安全/可用性要求  

**验证**：内存测试的验证方法 #57：单元测试 + 集成测试 + 系统测试  


### Q.58 ST-014 / 并发测试 / 并发测试场景 #58

**输入**：并发测试的详细输入 #58：含各种边界条件、异常路径、性能要求  

**预期**：并发测试的预期输出 #58：满足功能/性能/安全/可用性要求  

**验证**：并发测试的验证方法 #58：单元测试 + 集成测试 + 系统测试  


### Q.59 ST-015 / 安全测试 / 安全测试场景 #59

**输入**：安全测试的详细输入 #59：含各种边界条件、异常路径、性能要求  

**预期**：安全测试的预期输出 #59：满足功能/性能/安全/可用性要求  

**验证**：安全测试的验证方法 #59：单元测试 + 集成测试 + 系统测试  


### Q.60 ST-016 / 渗透测试 / 渗透测试场景 #60

**输入**：渗透测试的详细输入 #60：含各种边界条件、异常路径、性能要求  

**预期**：渗透测试的预期输出 #60：满足功能/性能/安全/可用性要求  

**验证**：渗透测试的验证方法 #60：单元测试 + 集成测试 + 系统测试  


### Q.61 ST-017 / 兼容性测试 / 兼容性测试场景 #61

**输入**：兼容性测试的详细输入 #61：含各种边界条件、异常路径、性能要求  

**预期**：兼容性测试的预期输出 #61：满足功能/性能/安全/可用性要求  

**验证**：兼容性测试的验证方法 #61：单元测试 + 集成测试 + 系统测试  


### Q.62 ST-018 / 本地化测试 / 本地化测试场景 #62

**输入**：本地化测试的详细输入 #62：含各种边界条件、异常路径、性能要求  

**预期**：本地化测试的预期输出 #62：满足功能/性能/安全/可用性要求  

**验证**：本地化测试的验证方法 #62：单元测试 + 集成测试 + 系统测试  


### Q.63 ST-019 / 国际化测试 / 国际化测试场景 #63

**输入**：国际化测试的详细输入 #63：含各种边界条件、异常路径、性能要求  

**预期**：国际化测试的预期输出 #63：满足功能/性能/安全/可用性要求  

**验证**：国际化测试的验证方法 #63：单元测试 + 集成测试 + 系统测试  


### Q.64 ST-020 / 可用性测试 / 可用性测试场景 #64

**输入**：可用性测试的详细输入 #64：含各种边界条件、异常路径、性能要求  

**预期**：可用性测试的预期输出 #64：满足功能/性能/安全/可用性要求  

**验证**：可用性测试的验证方法 #64：单元测试 + 集成测试 + 系统测试  


### Q.65 ST-021 / 可访问性测试 / 可访问性测试场景 #65

**输入**：可访问性测试的详细输入 #65：含各种边界条件、异常路径、性能要求  

**预期**：可访问性测试的预期输出 #65：满足功能/性能/安全/可用性要求  

**验证**：可访问性测试的验证方法 #65：单元测试 + 集成测试 + 系统测试  


### Q.66 ST-022 / 回归测试 / 回归测试场景 #66

**输入**：回归测试的详细输入 #66：含各种边界条件、异常路径、性能要求  

**预期**：回归测试的预期输出 #66：满足功能/性能/安全/可用性要求  

**验证**：回归测试的验证方法 #66：单元测试 + 集成测试 + 系统测试  


### Q.67 ST-001 / 冒烟测试 / 冒烟测试场景 #67

**输入**：冒烟测试的详细输入 #67：含各种边界条件、异常路径、性能要求  

**预期**：冒烟测试的预期输出 #67：满足功能/性能/安全/可用性要求  

**验证**：冒烟测试的验证方法 #67：单元测试 + 集成测试 + 系统测试  


### Q.68 ST-002 / 健全性测试 / 健全性测试场景 #68

**输入**：健全性测试的详细输入 #68：含各种边界条件、异常路径、性能要求  

**预期**：健全性测试的预期输出 #68：满足功能/性能/安全/可用性要求  

**验证**：健全性测试的验证方法 #68：单元测试 + 集成测试 + 系统测试  


### Q.69 ST-003 / 探索性测试 / 探索性测试场景 #69

**输入**：探索性测试的详细输入 #69：含各种边界条件、异常路径、性能要求  

**预期**：探索性测试的预期输出 #69：满足功能/性能/安全/可用性要求  

**验证**：探索性测试的验证方法 #69：单元测试 + 集成测试 + 系统测试  


### Q.70 ST-004 / 验收测试 / 验收测试场景 #70

**输入**：验收测试的详细输入 #70：含各种边界条件、异常路径、性能要求  

**预期**：验收测试的预期输出 #70：满足功能/性能/安全/可用性要求  

**验证**：验收测试的验证方法 #70：单元测试 + 集成测试 + 系统测试  


### Q.71 ST-005 / Beta 测试 / Beta 测试场景 #71

**输入**：Beta 测试的详细输入 #71：含各种边界条件、异常路径、性能要求  

**预期**：Beta 测试的预期输出 #71：满足功能/性能/安全/可用性要求  

**验证**：Beta 测试的验证方法 #71：单元测试 + 集成测试 + 系统测试  


### Q.72 ST-006 / 用户验收 / 用户验收场景 #72

**输入**：用户验收的详细输入 #72：含各种边界条件、异常路径、性能要求  

**预期**：用户验收的预期输出 #72：满足功能/性能/安全/可用性要求  

**验证**：用户验收的验证方法 #72：单元测试 + 集成测试 + 系统测试  


### Q.73 ST-007 / 单元测试 / 单元测试场景 #73

**输入**：单元测试的详细输入 #73：含各种边界条件、异常路径、性能要求  

**预期**：单元测试的预期输出 #73：满足功能/性能/安全/可用性要求  

**验证**：单元测试的验证方法 #73：单元测试 + 集成测试 + 系统测试  


### Q.74 ST-008 / 集成测试 / 集成测试场景 #74

**输入**：集成测试的详细输入 #74：含各种边界条件、异常路径、性能要求  

**预期**：集成测试的预期输出 #74：满足功能/性能/安全/可用性要求  

**验证**：集成测试的验证方法 #74：单元测试 + 集成测试 + 系统测试  


### Q.75 ST-009 / 端到端测试 / 端到端测试场景 #75

**输入**：端到端测试的详细输入 #75：含各种边界条件、异常路径、性能要求  

**预期**：端到端测试的预期输出 #75：满足功能/性能/安全/可用性要求  

**验证**：端到端测试的验证方法 #75：单元测试 + 集成测试 + 系统测试  


### Q.76 ST-010 / 契约测试 / 契约测试场景 #76

**输入**：契约测试的详细输入 #76：含各种边界条件、异常路径、性能要求  

**预期**：契约测试的预期输出 #76：满足功能/性能/安全/可用性要求  

**验证**：契约测试的验证方法 #76：单元测试 + 集成测试 + 系统测试  


### Q.77 ST-011 / 性能测试 / 性能测试场景 #77

**输入**：性能测试的详细输入 #77：含各种边界条件、异常路径、性能要求  

**预期**：性能测试的预期输出 #77：满足功能/性能/安全/可用性要求  

**验证**：性能测试的验证方法 #77：单元测试 + 集成测试 + 系统测试  


### Q.78 ST-012 / 压力测试 / 压力测试场景 #78

**输入**：压力测试的详细输入 #78：含各种边界条件、异常路径、性能要求  

**预期**：压力测试的预期输出 #78：满足功能/性能/安全/可用性要求  

**验证**：压力测试的验证方法 #78：单元测试 + 集成测试 + 系统测试  


### Q.79 ST-013 / 负载测试 / 负载测试场景 #79

**输入**：负载测试的详细输入 #79：含各种边界条件、异常路径、性能要求  

**预期**：负载测试的预期输出 #79：满足功能/性能/安全/可用性要求  

**验证**：负载测试的验证方法 #79：单元测试 + 集成测试 + 系统测试  


### Q.80 ST-014 / 稳定性测试 / 稳定性测试场景 #80

**输入**：稳定性测试的详细输入 #80：含各种边界条件、异常路径、性能要求  

**预期**：稳定性测试的预期输出 #80：满足功能/性能/安全/可用性要求  

**验证**：稳定性测试的验证方法 #80：单元测试 + 集成测试 + 系统测试  


### Q.81 ST-015 / 内存测试 / 内存测试场景 #81

**输入**：内存测试的详细输入 #81：含各种边界条件、异常路径、性能要求  

**预期**：内存测试的预期输出 #81：满足功能/性能/安全/可用性要求  

**验证**：内存测试的验证方法 #81：单元测试 + 集成测试 + 系统测试  


### Q.82 ST-016 / 并发测试 / 并发测试场景 #82

**输入**：并发测试的详细输入 #82：含各种边界条件、异常路径、性能要求  

**预期**：并发测试的预期输出 #82：满足功能/性能/安全/可用性要求  

**验证**：并发测试的验证方法 #82：单元测试 + 集成测试 + 系统测试  


### Q.83 ST-017 / 安全测试 / 安全测试场景 #83

**输入**：安全测试的详细输入 #83：含各种边界条件、异常路径、性能要求  

**预期**：安全测试的预期输出 #83：满足功能/性能/安全/可用性要求  

**验证**：安全测试的验证方法 #83：单元测试 + 集成测试 + 系统测试  


### Q.84 ST-018 / 渗透测试 / 渗透测试场景 #84

**输入**：渗透测试的详细输入 #84：含各种边界条件、异常路径、性能要求  

**预期**：渗透测试的预期输出 #84：满足功能/性能/安全/可用性要求  

**验证**：渗透测试的验证方法 #84：单元测试 + 集成测试 + 系统测试  


### Q.85 ST-019 / 兼容性测试 / 兼容性测试场景 #85

**输入**：兼容性测试的详细输入 #85：含各种边界条件、异常路径、性能要求  

**预期**：兼容性测试的预期输出 #85：满足功能/性能/安全/可用性要求  

**验证**：兼容性测试的验证方法 #85：单元测试 + 集成测试 + 系统测试  


### Q.86 ST-020 / 本地化测试 / 本地化测试场景 #86

**输入**：本地化测试的详细输入 #86：含各种边界条件、异常路径、性能要求  

**预期**：本地化测试的预期输出 #86：满足功能/性能/安全/可用性要求  

**验证**：本地化测试的验证方法 #86：单元测试 + 集成测试 + 系统测试  


### Q.87 ST-021 / 国际化测试 / 国际化测试场景 #87

**输入**：国际化测试的详细输入 #87：含各种边界条件、异常路径、性能要求  

**预期**：国际化测试的预期输出 #87：满足功能/性能/安全/可用性要求  

**验证**：国际化测试的验证方法 #87：单元测试 + 集成测试 + 系统测试  


### Q.88 ST-022 / 可用性测试 / 可用性测试场景 #88

**输入**：可用性测试的详细输入 #88：含各种边界条件、异常路径、性能要求  

**预期**：可用性测试的预期输出 #88：满足功能/性能/安全/可用性要求  

**验证**：可用性测试的验证方法 #88：单元测试 + 集成测试 + 系统测试  


### Q.89 ST-001 / 可访问性测试 / 可访问性测试场景 #89

**输入**：可访问性测试的详细输入 #89：含各种边界条件、异常路径、性能要求  

**预期**：可访问性测试的预期输出 #89：满足功能/性能/安全/可用性要求  

**验证**：可访问性测试的验证方法 #89：单元测试 + 集成测试 + 系统测试  


### Q.90 ST-002 / 回归测试 / 回归测试场景 #90

**输入**：回归测试的详细输入 #90：含各种边界条件、异常路径、性能要求  

**预期**：回归测试的预期输出 #90：满足功能/性能/安全/可用性要求  

**验证**：回归测试的验证方法 #90：单元测试 + 集成测试 + 系统测试  


### Q.91 ST-003 / 冒烟测试 / 冒烟测试场景 #91

**输入**：冒烟测试的详细输入 #91：含各种边界条件、异常路径、性能要求  

**预期**：冒烟测试的预期输出 #91：满足功能/性能/安全/可用性要求  

**验证**：冒烟测试的验证方法 #91：单元测试 + 集成测试 + 系统测试  


### Q.92 ST-004 / 健全性测试 / 健全性测试场景 #92

**输入**：健全性测试的详细输入 #92：含各种边界条件、异常路径、性能要求  

**预期**：健全性测试的预期输出 #92：满足功能/性能/安全/可用性要求  

**验证**：健全性测试的验证方法 #92：单元测试 + 集成测试 + 系统测试  


### Q.93 ST-005 / 探索性测试 / 探索性测试场景 #93

**输入**：探索性测试的详细输入 #93：含各种边界条件、异常路径、性能要求  

**预期**：探索性测试的预期输出 #93：满足功能/性能/安全/可用性要求  

**验证**：探索性测试的验证方法 #93：单元测试 + 集成测试 + 系统测试  


### Q.94 ST-006 / 验收测试 / 验收测试场景 #94

**输入**：验收测试的详细输入 #94：含各种边界条件、异常路径、性能要求  

**预期**：验收测试的预期输出 #94：满足功能/性能/安全/可用性要求  

**验证**：验收测试的验证方法 #94：单元测试 + 集成测试 + 系统测试  


### Q.95 ST-007 / Beta 测试 / Beta 测试场景 #95

**输入**：Beta 测试的详细输入 #95：含各种边界条件、异常路径、性能要求  

**预期**：Beta 测试的预期输出 #95：满足功能/性能/安全/可用性要求  

**验证**：Beta 测试的验证方法 #95：单元测试 + 集成测试 + 系统测试  


### Q.96 ST-008 / 用户验收 / 用户验收场景 #96

**输入**：用户验收的详细输入 #96：含各种边界条件、异常路径、性能要求  

**预期**：用户验收的预期输出 #96：满足功能/性能/安全/可用性要求  

**验证**：用户验收的验证方法 #96：单元测试 + 集成测试 + 系统测试  


### Q.97 ST-009 / 单元测试 / 单元测试场景 #97

**输入**：单元测试的详细输入 #97：含各种边界条件、异常路径、性能要求  

**预期**：单元测试的预期输出 #97：满足功能/性能/安全/可用性要求  

**验证**：单元测试的验证方法 #97：单元测试 + 集成测试 + 系统测试  


### Q.98 ST-010 / 集成测试 / 集成测试场景 #98

**输入**：集成测试的详细输入 #98：含各种边界条件、异常路径、性能要求  

**预期**：集成测试的预期输出 #98：满足功能/性能/安全/可用性要求  

**验证**：集成测试的验证方法 #98：单元测试 + 集成测试 + 系统测试  


### Q.99 ST-011 / 端到端测试 / 端到端测试场景 #99

**输入**：端到端测试的详细输入 #99：含各种边界条件、异常路径、性能要求  

**预期**：端到端测试的预期输出 #99：满足功能/性能/安全/可用性要求  

**验证**：端到端测试的验证方法 #99：单元测试 + 集成测试 + 系统测试  


### Q.100 ST-012 / 契约测试 / 契约测试场景 #100

**输入**：契约测试的详细输入 #100：含各种边界条件、异常路径、性能要求  

**预期**：契约测试的预期输出 #100：满足功能/性能/安全/可用性要求  

**验证**：契约测试的验证方法 #100：单元测试 + 集成测试 + 系统测试  


### Q.101 ST-013 / 性能测试 / 性能测试场景 #101

**输入**：性能测试的详细输入 #101：含各种边界条件、异常路径、性能要求  

**预期**：性能测试的预期输出 #101：满足功能/性能/安全/可用性要求  

**验证**：性能测试的验证方法 #101：单元测试 + 集成测试 + 系统测试  


### Q.102 ST-014 / 压力测试 / 压力测试场景 #102

**输入**：压力测试的详细输入 #102：含各种边界条件、异常路径、性能要求  

**预期**：压力测试的预期输出 #102：满足功能/性能/安全/可用性要求  

**验证**：压力测试的验证方法 #102：单元测试 + 集成测试 + 系统测试  


### Q.103 ST-015 / 负载测试 / 负载测试场景 #103

**输入**：负载测试的详细输入 #103：含各种边界条件、异常路径、性能要求  

**预期**：负载测试的预期输出 #103：满足功能/性能/安全/可用性要求  

**验证**：负载测试的验证方法 #103：单元测试 + 集成测试 + 系统测试  


### Q.104 ST-016 / 稳定性测试 / 稳定性测试场景 #104

**输入**：稳定性测试的详细输入 #104：含各种边界条件、异常路径、性能要求  

**预期**：稳定性测试的预期输出 #104：满足功能/性能/安全/可用性要求  

**验证**：稳定性测试的验证方法 #104：单元测试 + 集成测试 + 系统测试  


### Q.105 ST-017 / 内存测试 / 内存测试场景 #105

**输入**：内存测试的详细输入 #105：含各种边界条件、异常路径、性能要求  

**预期**：内存测试的预期输出 #105：满足功能/性能/安全/可用性要求  

**验证**：内存测试的验证方法 #105：单元测试 + 集成测试 + 系统测试  


### Q.106 ST-018 / 并发测试 / 并发测试场景 #106

**输入**：并发测试的详细输入 #106：含各种边界条件、异常路径、性能要求  

**预期**：并发测试的预期输出 #106：满足功能/性能/安全/可用性要求  

**验证**：并发测试的验证方法 #106：单元测试 + 集成测试 + 系统测试  


### Q.107 ST-019 / 安全测试 / 安全测试场景 #107

**输入**：安全测试的详细输入 #107：含各种边界条件、异常路径、性能要求  

**预期**：安全测试的预期输出 #107：满足功能/性能/安全/可用性要求  

**验证**：安全测试的验证方法 #107：单元测试 + 集成测试 + 系统测试  


### Q.108 ST-020 / 渗透测试 / 渗透测试场景 #108

**输入**：渗透测试的详细输入 #108：含各种边界条件、异常路径、性能要求  

**预期**：渗透测试的预期输出 #108：满足功能/性能/安全/可用性要求  

**验证**：渗透测试的验证方法 #108：单元测试 + 集成测试 + 系统测试  


### Q.109 ST-021 / 兼容性测试 / 兼容性测试场景 #109

**输入**：兼容性测试的详细输入 #109：含各种边界条件、异常路径、性能要求  

**预期**：兼容性测试的预期输出 #109：满足功能/性能/安全/可用性要求  

**验证**：兼容性测试的验证方法 #109：单元测试 + 集成测试 + 系统测试  


### Q.110 ST-022 / 本地化测试 / 本地化测试场景 #110

**输入**：本地化测试的详细输入 #110：含各种边界条件、异常路径、性能要求  

**预期**：本地化测试的预期输出 #110：满足功能/性能/安全/可用性要求  

**验证**：本地化测试的验证方法 #110：单元测试 + 集成测试 + 系统测试  


### Q.111 ST-001 / 国际化测试 / 国际化测试场景 #111

**输入**：国际化测试的详细输入 #111：含各种边界条件、异常路径、性能要求  

**预期**：国际化测试的预期输出 #111：满足功能/性能/安全/可用性要求  

**验证**：国际化测试的验证方法 #111：单元测试 + 集成测试 + 系统测试  


### Q.112 ST-002 / 可用性测试 / 可用性测试场景 #112

**输入**：可用性测试的详细输入 #112：含各种边界条件、异常路径、性能要求  

**预期**：可用性测试的预期输出 #112：满足功能/性能/安全/可用性要求  

**验证**：可用性测试的验证方法 #112：单元测试 + 集成测试 + 系统测试  


### Q.113 ST-003 / 可访问性测试 / 可访问性测试场景 #113

**输入**：可访问性测试的详细输入 #113：含各种边界条件、异常路径、性能要求  

**预期**：可访问性测试的预期输出 #113：满足功能/性能/安全/可用性要求  

**验证**：可访问性测试的验证方法 #113：单元测试 + 集成测试 + 系统测试  


### Q.114 ST-004 / 回归测试 / 回归测试场景 #114

**输入**：回归测试的详细输入 #114：含各种边界条件、异常路径、性能要求  

**预期**：回归测试的预期输出 #114：满足功能/性能/安全/可用性要求  

**验证**：回归测试的验证方法 #114：单元测试 + 集成测试 + 系统测试  


### Q.115 ST-005 / 冒烟测试 / 冒烟测试场景 #115

**输入**：冒烟测试的详细输入 #115：含各种边界条件、异常路径、性能要求  

**预期**：冒烟测试的预期输出 #115：满足功能/性能/安全/可用性要求  

**验证**：冒烟测试的验证方法 #115：单元测试 + 集成测试 + 系统测试  


### Q.116 ST-006 / 健全性测试 / 健全性测试场景 #116

**输入**：健全性测试的详细输入 #116：含各种边界条件、异常路径、性能要求  

**预期**：健全性测试的预期输出 #116：满足功能/性能/安全/可用性要求  

**验证**：健全性测试的验证方法 #116：单元测试 + 集成测试 + 系统测试  


### Q.117 ST-007 / 探索性测试 / 探索性测试场景 #117

**输入**：探索性测试的详细输入 #117：含各种边界条件、异常路径、性能要求  

**预期**：探索性测试的预期输出 #117：满足功能/性能/安全/可用性要求  

**验证**：探索性测试的验证方法 #117：单元测试 + 集成测试 + 系统测试  


### Q.118 ST-008 / 验收测试 / 验收测试场景 #118

**输入**：验收测试的详细输入 #118：含各种边界条件、异常路径、性能要求  

**预期**：验收测试的预期输出 #118：满足功能/性能/安全/可用性要求  

**验证**：验收测试的验证方法 #118：单元测试 + 集成测试 + 系统测试  


### Q.119 ST-009 / Beta 测试 / Beta 测试场景 #119

**输入**：Beta 测试的详细输入 #119：含各种边界条件、异常路径、性能要求  

**预期**：Beta 测试的预期输出 #119：满足功能/性能/安全/可用性要求  

**验证**：Beta 测试的验证方法 #119：单元测试 + 集成测试 + 系统测试  


### Q.120 ST-010 / 用户验收 / 用户验收场景 #120

**输入**：用户验收的详细输入 #120：含各种边界条件、异常路径、性能要求  

**预期**：用户验收的预期输出 #120：满足功能/性能/安全/可用性要求  

**验证**：用户验收的验证方法 #120：单元测试 + 集成测试 + 系统测试  


### Q.121 ST-011 / 单元测试 / 单元测试场景 #121

**输入**：单元测试的详细输入 #121：含各种边界条件、异常路径、性能要求  

**预期**：单元测试的预期输出 #121：满足功能/性能/安全/可用性要求  

**验证**：单元测试的验证方法 #121：单元测试 + 集成测试 + 系统测试  


### Q.122 ST-012 / 集成测试 / 集成测试场景 #122

**输入**：集成测试的详细输入 #122：含各种边界条件、异常路径、性能要求  

**预期**：集成测试的预期输出 #122：满足功能/性能/安全/可用性要求  

**验证**：集成测试的验证方法 #122：单元测试 + 集成测试 + 系统测试  


### Q.123 ST-013 / 端到端测试 / 端到端测试场景 #123

**输入**：端到端测试的详细输入 #123：含各种边界条件、异常路径、性能要求  

**预期**：端到端测试的预期输出 #123：满足功能/性能/安全/可用性要求  

**验证**：端到端测试的验证方法 #123：单元测试 + 集成测试 + 系统测试  


### Q.124 ST-014 / 契约测试 / 契约测试场景 #124

**输入**：契约测试的详细输入 #124：含各种边界条件、异常路径、性能要求  

**预期**：契约测试的预期输出 #124：满足功能/性能/安全/可用性要求  

**验证**：契约测试的验证方法 #124：单元测试 + 集成测试 + 系统测试  


### Q.125 ST-015 / 性能测试 / 性能测试场景 #125

**输入**：性能测试的详细输入 #125：含各种边界条件、异常路径、性能要求  

**预期**：性能测试的预期输出 #125：满足功能/性能/安全/可用性要求  

**验证**：性能测试的验证方法 #125：单元测试 + 集成测试 + 系统测试  


### Q.126 ST-016 / 压力测试 / 压力测试场景 #126

**输入**：压力测试的详细输入 #126：含各种边界条件、异常路径、性能要求  

**预期**：压力测试的预期输出 #126：满足功能/性能/安全/可用性要求  

**验证**：压力测试的验证方法 #126：单元测试 + 集成测试 + 系统测试  


### Q.127 ST-017 / 负载测试 / 负载测试场景 #127

**输入**：负载测试的详细输入 #127：含各种边界条件、异常路径、性能要求  

**预期**：负载测试的预期输出 #127：满足功能/性能/安全/可用性要求  

**验证**：负载测试的验证方法 #127：单元测试 + 集成测试 + 系统测试  


### Q.128 ST-018 / 稳定性测试 / 稳定性测试场景 #128

**输入**：稳定性测试的详细输入 #128：含各种边界条件、异常路径、性能要求  

**预期**：稳定性测试的预期输出 #128：满足功能/性能/安全/可用性要求  

**验证**：稳定性测试的验证方法 #128：单元测试 + 集成测试 + 系统测试  


### Q.129 ST-019 / 内存测试 / 内存测试场景 #129

**输入**：内存测试的详细输入 #129：含各种边界条件、异常路径、性能要求  

**预期**：内存测试的预期输出 #129：满足功能/性能/安全/可用性要求  

**验证**：内存测试的验证方法 #129：单元测试 + 集成测试 + 系统测试  


### Q.130 ST-020 / 并发测试 / 并发测试场景 #130

**输入**：并发测试的详细输入 #130：含各种边界条件、异常路径、性能要求  

**预期**：并发测试的预期输出 #130：满足功能/性能/安全/可用性要求  

**验证**：并发测试的验证方法 #130：单元测试 + 集成测试 + 系统测试  


### Q.131 ST-021 / 安全测试 / 安全测试场景 #131

**输入**：安全测试的详细输入 #131：含各种边界条件、异常路径、性能要求  

**预期**：安全测试的预期输出 #131：满足功能/性能/安全/可用性要求  

**验证**：安全测试的验证方法 #131：单元测试 + 集成测试 + 系统测试  


### Q.132 ST-022 / 渗透测试 / 渗透测试场景 #132

**输入**：渗透测试的详细输入 #132：含各种边界条件、异常路径、性能要求  

**预期**：渗透测试的预期输出 #132：满足功能/性能/安全/可用性要求  

**验证**：渗透测试的验证方法 #132：单元测试 + 集成测试 + 系统测试  


### Q.133 ST-001 / 兼容性测试 / 兼容性测试场景 #133

**输入**：兼容性测试的详细输入 #133：含各种边界条件、异常路径、性能要求  

**预期**：兼容性测试的预期输出 #133：满足功能/性能/安全/可用性要求  

**验证**：兼容性测试的验证方法 #133：单元测试 + 集成测试 + 系统测试  


### Q.134 ST-002 / 本地化测试 / 本地化测试场景 #134

**输入**：本地化测试的详细输入 #134：含各种边界条件、异常路径、性能要求  

**预期**：本地化测试的预期输出 #134：满足功能/性能/安全/可用性要求  

**验证**：本地化测试的验证方法 #134：单元测试 + 集成测试 + 系统测试  


### Q.135 ST-003 / 国际化测试 / 国际化测试场景 #135

**输入**：国际化测试的详细输入 #135：含各种边界条件、异常路径、性能要求  

**预期**：国际化测试的预期输出 #135：满足功能/性能/安全/可用性要求  

**验证**：国际化测试的验证方法 #135：单元测试 + 集成测试 + 系统测试  


### Q.136 ST-004 / 可用性测试 / 可用性测试场景 #136

**输入**：可用性测试的详细输入 #136：含各种边界条件、异常路径、性能要求  

**预期**：可用性测试的预期输出 #136：满足功能/性能/安全/可用性要求  

**验证**：可用性测试的验证方法 #136：单元测试 + 集成测试 + 系统测试  


### Q.137 ST-005 / 可访问性测试 / 可访问性测试场景 #137

**输入**：可访问性测试的详细输入 #137：含各种边界条件、异常路径、性能要求  

**预期**：可访问性测试的预期输出 #137：满足功能/性能/安全/可用性要求  

**验证**：可访问性测试的验证方法 #137：单元测试 + 集成测试 + 系统测试  


### Q.138 ST-006 / 回归测试 / 回归测试场景 #138

**输入**：回归测试的详细输入 #138：含各种边界条件、异常路径、性能要求  

**预期**：回归测试的预期输出 #138：满足功能/性能/安全/可用性要求  

**验证**：回归测试的验证方法 #138：单元测试 + 集成测试 + 系统测试  


### Q.139 ST-007 / 冒烟测试 / 冒烟测试场景 #139

**输入**：冒烟测试的详细输入 #139：含各种边界条件、异常路径、性能要求  

**预期**：冒烟测试的预期输出 #139：满足功能/性能/安全/可用性要求  

**验证**：冒烟测试的验证方法 #139：单元测试 + 集成测试 + 系统测试  


### Q.140 ST-008 / 健全性测试 / 健全性测试场景 #140

**输入**：健全性测试的详细输入 #140：含各种边界条件、异常路径、性能要求  

**预期**：健全性测试的预期输出 #140：满足功能/性能/安全/可用性要求  

**验证**：健全性测试的验证方法 #140：单元测试 + 集成测试 + 系统测试  


### Q.141 ST-009 / 探索性测试 / 探索性测试场景 #141

**输入**：探索性测试的详细输入 #141：含各种边界条件、异常路径、性能要求  

**预期**：探索性测试的预期输出 #141：满足功能/性能/安全/可用性要求  

**验证**：探索性测试的验证方法 #141：单元测试 + 集成测试 + 系统测试  


### Q.142 ST-010 / 验收测试 / 验收测试场景 #142

**输入**：验收测试的详细输入 #142：含各种边界条件、异常路径、性能要求  

**预期**：验收测试的预期输出 #142：满足功能/性能/安全/可用性要求  

**验证**：验收测试的验证方法 #142：单元测试 + 集成测试 + 系统测试  


### Q.143 ST-011 / Beta 测试 / Beta 测试场景 #143

**输入**：Beta 测试的详细输入 #143：含各种边界条件、异常路径、性能要求  

**预期**：Beta 测试的预期输出 #143：满足功能/性能/安全/可用性要求  

**验证**：Beta 测试的验证方法 #143：单元测试 + 集成测试 + 系统测试  


### Q.144 ST-012 / 用户验收 / 用户验收场景 #144

**输入**：用户验收的详细输入 #144：含各种边界条件、异常路径、性能要求  

**预期**：用户验收的预期输出 #144：满足功能/性能/安全/可用性要求  

**验证**：用户验收的验证方法 #144：单元测试 + 集成测试 + 系统测试  


### Q.145 ST-013 / 单元测试 / 单元测试场景 #145

**输入**：单元测试的详细输入 #145：含各种边界条件、异常路径、性能要求  

**预期**：单元测试的预期输出 #145：满足功能/性能/安全/可用性要求  

**验证**：单元测试的验证方法 #145：单元测试 + 集成测试 + 系统测试  


### Q.146 ST-014 / 集成测试 / 集成测试场景 #146

**输入**：集成测试的详细输入 #146：含各种边界条件、异常路径、性能要求  

**预期**：集成测试的预期输出 #146：满足功能/性能/安全/可用性要求  

**验证**：集成测试的验证方法 #146：单元测试 + 集成测试 + 系统测试  


### Q.147 ST-015 / 端到端测试 / 端到端测试场景 #147

**输入**：端到端测试的详细输入 #147：含各种边界条件、异常路径、性能要求  

**预期**：端到端测试的预期输出 #147：满足功能/性能/安全/可用性要求  

**验证**：端到端测试的验证方法 #147：单元测试 + 集成测试 + 系统测试  


### Q.148 ST-016 / 契约测试 / 契约测试场景 #148

**输入**：契约测试的详细输入 #148：含各种边界条件、异常路径、性能要求  

**预期**：契约测试的预期输出 #148：满足功能/性能/安全/可用性要求  

**验证**：契约测试的验证方法 #148：单元测试 + 集成测试 + 系统测试  


### Q.149 ST-017 / 性能测试 / 性能测试场景 #149

**输入**：性能测试的详细输入 #149：含各种边界条件、异常路径、性能要求  

**预期**：性能测试的预期输出 #149：满足功能/性能/安全/可用性要求  

**验证**：性能测试的验证方法 #149：单元测试 + 集成测试 + 系统测试  


### Q.150 ST-018 / 压力测试 / 压力测试场景 #150

**输入**：压力测试的详细输入 #150：含各种边界条件、异常路径、性能要求  

**预期**：压力测试的预期输出 #150：满足功能/性能/安全/可用性要求  

**验证**：压力测试的验证方法 #150：单元测试 + 集成测试 + 系统测试  


### Q.151 ST-019 / 负载测试 / 负载测试场景 #151

**输入**：负载测试的详细输入 #151：含各种边界条件、异常路径、性能要求  

**预期**：负载测试的预期输出 #151：满足功能/性能/安全/可用性要求  

**验证**：负载测试的验证方法 #151：单元测试 + 集成测试 + 系统测试  


### Q.152 ST-020 / 稳定性测试 / 稳定性测试场景 #152

**输入**：稳定性测试的详细输入 #152：含各种边界条件、异常路径、性能要求  

**预期**：稳定性测试的预期输出 #152：满足功能/性能/安全/可用性要求  

**验证**：稳定性测试的验证方法 #152：单元测试 + 集成测试 + 系统测试  


### Q.153 ST-021 / 内存测试 / 内存测试场景 #153

**输入**：内存测试的详细输入 #153：含各种边界条件、异常路径、性能要求  

**预期**：内存测试的预期输出 #153：满足功能/性能/安全/可用性要求  

**验证**：内存测试的验证方法 #153：单元测试 + 集成测试 + 系统测试  


### Q.154 ST-022 / 并发测试 / 并发测试场景 #154

**输入**：并发测试的详细输入 #154：含各种边界条件、异常路径、性能要求  

**预期**：并发测试的预期输出 #154：满足功能/性能/安全/可用性要求  

**验证**：并发测试的验证方法 #154：单元测试 + 集成测试 + 系统测试  


### Q.155 ST-001 / 安全测试 / 安全测试场景 #155

**输入**：安全测试的详细输入 #155：含各种边界条件、异常路径、性能要求  

**预期**：安全测试的预期输出 #155：满足功能/性能/安全/可用性要求  

**验证**：安全测试的验证方法 #155：单元测试 + 集成测试 + 系统测试  


### Q.156 ST-002 / 渗透测试 / 渗透测试场景 #156

**输入**：渗透测试的详细输入 #156：含各种边界条件、异常路径、性能要求  

**预期**：渗透测试的预期输出 #156：满足功能/性能/安全/可用性要求  

**验证**：渗透测试的验证方法 #156：单元测试 + 集成测试 + 系统测试  


### Q.157 ST-003 / 兼容性测试 / 兼容性测试场景 #157

**输入**：兼容性测试的详细输入 #157：含各种边界条件、异常路径、性能要求  

**预期**：兼容性测试的预期输出 #157：满足功能/性能/安全/可用性要求  

**验证**：兼容性测试的验证方法 #157：单元测试 + 集成测试 + 系统测试  


### Q.158 ST-004 / 本地化测试 / 本地化测试场景 #158

**输入**：本地化测试的详细输入 #158：含各种边界条件、异常路径、性能要求  

**预期**：本地化测试的预期输出 #158：满足功能/性能/安全/可用性要求  

**验证**：本地化测试的验证方法 #158：单元测试 + 集成测试 + 系统测试  


### Q.159 ST-005 / 国际化测试 / 国际化测试场景 #159

**输入**：国际化测试的详细输入 #159：含各种边界条件、异常路径、性能要求  

**预期**：国际化测试的预期输出 #159：满足功能/性能/安全/可用性要求  

**验证**：国际化测试的验证方法 #159：单元测试 + 集成测试 + 系统测试  


### Q.160 ST-006 / 可用性测试 / 可用性测试场景 #160

**输入**：可用性测试的详细输入 #160：含各种边界条件、异常路径、性能要求  

**预期**：可用性测试的预期输出 #160：满足功能/性能/安全/可用性要求  

**验证**：可用性测试的验证方法 #160：单元测试 + 集成测试 + 系统测试  


### Q.161 ST-007 / 可访问性测试 / 可访问性测试场景 #161

**输入**：可访问性测试的详细输入 #161：含各种边界条件、异常路径、性能要求  

**预期**：可访问性测试的预期输出 #161：满足功能/性能/安全/可用性要求  

**验证**：可访问性测试的验证方法 #161：单元测试 + 集成测试 + 系统测试  


### Q.162 ST-008 / 回归测试 / 回归测试场景 #162

**输入**：回归测试的详细输入 #162：含各种边界条件、异常路径、性能要求  

**预期**：回归测试的预期输出 #162：满足功能/性能/安全/可用性要求  

**验证**：回归测试的验证方法 #162：单元测试 + 集成测试 + 系统测试  


### Q.163 ST-009 / 冒烟测试 / 冒烟测试场景 #163

**输入**：冒烟测试的详细输入 #163：含各种边界条件、异常路径、性能要求  

**预期**：冒烟测试的预期输出 #163：满足功能/性能/安全/可用性要求  

**验证**：冒烟测试的验证方法 #163：单元测试 + 集成测试 + 系统测试  


### Q.164 ST-010 / 健全性测试 / 健全性测试场景 #164

**输入**：健全性测试的详细输入 #164：含各种边界条件、异常路径、性能要求  

**预期**：健全性测试的预期输出 #164：满足功能/性能/安全/可用性要求  

**验证**：健全性测试的验证方法 #164：单元测试 + 集成测试 + 系统测试  


### Q.165 ST-011 / 探索性测试 / 探索性测试场景 #165

**输入**：探索性测试的详细输入 #165：含各种边界条件、异常路径、性能要求  

**预期**：探索性测试的预期输出 #165：满足功能/性能/安全/可用性要求  

**验证**：探索性测试的验证方法 #165：单元测试 + 集成测试 + 系统测试  


### Q.166 ST-012 / 验收测试 / 验收测试场景 #166

**输入**：验收测试的详细输入 #166：含各种边界条件、异常路径、性能要求  

**预期**：验收测试的预期输出 #166：满足功能/性能/安全/可用性要求  

**验证**：验收测试的验证方法 #166：单元测试 + 集成测试 + 系统测试  


### Q.167 ST-013 / Beta 测试 / Beta 测试场景 #167

**输入**：Beta 测试的详细输入 #167：含各种边界条件、异常路径、性能要求  

**预期**：Beta 测试的预期输出 #167：满足功能/性能/安全/可用性要求  

**验证**：Beta 测试的验证方法 #167：单元测试 + 集成测试 + 系统测试  


### Q.168 ST-014 / 用户验收 / 用户验收场景 #168

**输入**：用户验收的详细输入 #168：含各种边界条件、异常路径、性能要求  

**预期**：用户验收的预期输出 #168：满足功能/性能/安全/可用性要求  

**验证**：用户验收的验证方法 #168：单元测试 + 集成测试 + 系统测试  


### Q.169 ST-015 / 单元测试 / 单元测试场景 #169

**输入**：单元测试的详细输入 #169：含各种边界条件、异常路径、性能要求  

**预期**：单元测试的预期输出 #169：满足功能/性能/安全/可用性要求  

**验证**：单元测试的验证方法 #169：单元测试 + 集成测试 + 系统测试  


### Q.170 ST-016 / 集成测试 / 集成测试场景 #170

**输入**：集成测试的详细输入 #170：含各种边界条件、异常路径、性能要求  

**预期**：集成测试的预期输出 #170：满足功能/性能/安全/可用性要求  

**验证**：集成测试的验证方法 #170：单元测试 + 集成测试 + 系统测试  


### Q.171 ST-017 / 端到端测试 / 端到端测试场景 #171

**输入**：端到端测试的详细输入 #171：含各种边界条件、异常路径、性能要求  

**预期**：端到端测试的预期输出 #171：满足功能/性能/安全/可用性要求  

**验证**：端到端测试的验证方法 #171：单元测试 + 集成测试 + 系统测试  


### Q.172 ST-018 / 契约测试 / 契约测试场景 #172

**输入**：契约测试的详细输入 #172：含各种边界条件、异常路径、性能要求  

**预期**：契约测试的预期输出 #172：满足功能/性能/安全/可用性要求  

**验证**：契约测试的验证方法 #172：单元测试 + 集成测试 + 系统测试  


### Q.173 ST-019 / 性能测试 / 性能测试场景 #173

**输入**：性能测试的详细输入 #173：含各种边界条件、异常路径、性能要求  

**预期**：性能测试的预期输出 #173：满足功能/性能/安全/可用性要求  

**验证**：性能测试的验证方法 #173：单元测试 + 集成测试 + 系统测试  


### Q.174 ST-020 / 压力测试 / 压力测试场景 #174

**输入**：压力测试的详细输入 #174：含各种边界条件、异常路径、性能要求  

**预期**：压力测试的预期输出 #174：满足功能/性能/安全/可用性要求  

**验证**：压力测试的验证方法 #174：单元测试 + 集成测试 + 系统测试  


### Q.175 ST-021 / 负载测试 / 负载测试场景 #175

**输入**：负载测试的详细输入 #175：含各种边界条件、异常路径、性能要求  

**预期**：负载测试的预期输出 #175：满足功能/性能/安全/可用性要求  

**验证**：负载测试的验证方法 #175：单元测试 + 集成测试 + 系统测试  


### Q.176 ST-022 / 稳定性测试 / 稳定性测试场景 #176

**输入**：稳定性测试的详细输入 #176：含各种边界条件、异常路径、性能要求  

**预期**：稳定性测试的预期输出 #176：满足功能/性能/安全/可用性要求  

**验证**：稳定性测试的验证方法 #176：单元测试 + 集成测试 + 系统测试  


### Q.177 ST-001 / 内存测试 / 内存测试场景 #177

**输入**：内存测试的详细输入 #177：含各种边界条件、异常路径、性能要求  

**预期**：内存测试的预期输出 #177：满足功能/性能/安全/可用性要求  

**验证**：内存测试的验证方法 #177：单元测试 + 集成测试 + 系统测试  


### Q.178 ST-002 / 并发测试 / 并发测试场景 #178

**输入**：并发测试的详细输入 #178：含各种边界条件、异常路径、性能要求  

**预期**：并发测试的预期输出 #178：满足功能/性能/安全/可用性要求  

**验证**：并发测试的验证方法 #178：单元测试 + 集成测试 + 系统测试  


### Q.179 ST-003 / 安全测试 / 安全测试场景 #179

**输入**：安全测试的详细输入 #179：含各种边界条件、异常路径、性能要求  

**预期**：安全测试的预期输出 #179：满足功能/性能/安全/可用性要求  

**验证**：安全测试的验证方法 #179：单元测试 + 集成测试 + 系统测试  


### Q.180 ST-004 / 渗透测试 / 渗透测试场景 #180

**输入**：渗透测试的详细输入 #180：含各种边界条件、异常路径、性能要求  

**预期**：渗透测试的预期输出 #180：满足功能/性能/安全/可用性要求  

**验证**：渗透测试的验证方法 #180：单元测试 + 集成测试 + 系统测试  


### Q.181 ST-005 / 兼容性测试 / 兼容性测试场景 #181

**输入**：兼容性测试的详细输入 #181：含各种边界条件、异常路径、性能要求  

**预期**：兼容性测试的预期输出 #181：满足功能/性能/安全/可用性要求  

**验证**：兼容性测试的验证方法 #181：单元测试 + 集成测试 + 系统测试  


### Q.182 ST-006 / 本地化测试 / 本地化测试场景 #182

**输入**：本地化测试的详细输入 #182：含各种边界条件、异常路径、性能要求  

**预期**：本地化测试的预期输出 #182：满足功能/性能/安全/可用性要求  

**验证**：本地化测试的验证方法 #182：单元测试 + 集成测试 + 系统测试  


### Q.183 ST-007 / 国际化测试 / 国际化测试场景 #183

**输入**：国际化测试的详细输入 #183：含各种边界条件、异常路径、性能要求  

**预期**：国际化测试的预期输出 #183：满足功能/性能/安全/可用性要求  

**验证**：国际化测试的验证方法 #183：单元测试 + 集成测试 + 系统测试  


### Q.184 ST-008 / 可用性测试 / 可用性测试场景 #184

**输入**：可用性测试的详细输入 #184：含各种边界条件、异常路径、性能要求  

**预期**：可用性测试的预期输出 #184：满足功能/性能/安全/可用性要求  

**验证**：可用性测试的验证方法 #184：单元测试 + 集成测试 + 系统测试  


### Q.185 ST-009 / 可访问性测试 / 可访问性测试场景 #185

**输入**：可访问性测试的详细输入 #185：含各种边界条件、异常路径、性能要求  

**预期**：可访问性测试的预期输出 #185：满足功能/性能/安全/可用性要求  

**验证**：可访问性测试的验证方法 #185：单元测试 + 集成测试 + 系统测试  


### Q.186 ST-010 / 回归测试 / 回归测试场景 #186

**输入**：回归测试的详细输入 #186：含各种边界条件、异常路径、性能要求  

**预期**：回归测试的预期输出 #186：满足功能/性能/安全/可用性要求  

**验证**：回归测试的验证方法 #186：单元测试 + 集成测试 + 系统测试  


### Q.187 ST-011 / 冒烟测试 / 冒烟测试场景 #187

**输入**：冒烟测试的详细输入 #187：含各种边界条件、异常路径、性能要求  

**预期**：冒烟测试的预期输出 #187：满足功能/性能/安全/可用性要求  

**验证**：冒烟测试的验证方法 #187：单元测试 + 集成测试 + 系统测试  


### Q.188 ST-012 / 健全性测试 / 健全性测试场景 #188

**输入**：健全性测试的详细输入 #188：含各种边界条件、异常路径、性能要求  

**预期**：健全性测试的预期输出 #188：满足功能/性能/安全/可用性要求  

**验证**：健全性测试的验证方法 #188：单元测试 + 集成测试 + 系统测试  


### Q.189 ST-013 / 探索性测试 / 探索性测试场景 #189

**输入**：探索性测试的详细输入 #189：含各种边界条件、异常路径、性能要求  

**预期**：探索性测试的预期输出 #189：满足功能/性能/安全/可用性要求  

**验证**：探索性测试的验证方法 #189：单元测试 + 集成测试 + 系统测试  


### Q.190 ST-014 / 验收测试 / 验收测试场景 #190

**输入**：验收测试的详细输入 #190：含各种边界条件、异常路径、性能要求  

**预期**：验收测试的预期输出 #190：满足功能/性能/安全/可用性要求  

**验证**：验收测试的验证方法 #190：单元测试 + 集成测试 + 系统测试  


### Q.191 ST-015 / Beta 测试 / Beta 测试场景 #191

**输入**：Beta 测试的详细输入 #191：含各种边界条件、异常路径、性能要求  

**预期**：Beta 测试的预期输出 #191：满足功能/性能/安全/可用性要求  

**验证**：Beta 测试的验证方法 #191：单元测试 + 集成测试 + 系统测试  


### Q.192 ST-016 / 用户验收 / 用户验收场景 #192

**输入**：用户验收的详细输入 #192：含各种边界条件、异常路径、性能要求  

**预期**：用户验收的预期输出 #192：满足功能/性能/安全/可用性要求  

**验证**：用户验收的验证方法 #192：单元测试 + 集成测试 + 系统测试  


### Q.193 ST-017 / 单元测试 / 单元测试场景 #193

**输入**：单元测试的详细输入 #193：含各种边界条件、异常路径、性能要求  

**预期**：单元测试的预期输出 #193：满足功能/性能/安全/可用性要求  

**验证**：单元测试的验证方法 #193：单元测试 + 集成测试 + 系统测试  


### Q.194 ST-018 / 集成测试 / 集成测试场景 #194

**输入**：集成测试的详细输入 #194：含各种边界条件、异常路径、性能要求  

**预期**：集成测试的预期输出 #194：满足功能/性能/安全/可用性要求  

**验证**：集成测试的验证方法 #194：单元测试 + 集成测试 + 系统测试  


### Q.195 ST-019 / 端到端测试 / 端到端测试场景 #195

**输入**：端到端测试的详细输入 #195：含各种边界条件、异常路径、性能要求  

**预期**：端到端测试的预期输出 #195：满足功能/性能/安全/可用性要求  

**验证**：端到端测试的验证方法 #195：单元测试 + 集成测试 + 系统测试  


### Q.196 ST-020 / 契约测试 / 契约测试场景 #196

**输入**：契约测试的详细输入 #196：含各种边界条件、异常路径、性能要求  

**预期**：契约测试的预期输出 #196：满足功能/性能/安全/可用性要求  

**验证**：契约测试的验证方法 #196：单元测试 + 集成测试 + 系统测试  


### Q.197 ST-021 / 性能测试 / 性能测试场景 #197

**输入**：性能测试的详细输入 #197：含各种边界条件、异常路径、性能要求  

**预期**：性能测试的预期输出 #197：满足功能/性能/安全/可用性要求  

**验证**：性能测试的验证方法 #197：单元测试 + 集成测试 + 系统测试  


### Q.198 ST-022 / 压力测试 / 压力测试场景 #198

**输入**：压力测试的详细输入 #198：含各种边界条件、异常路径、性能要求  

**预期**：压力测试的预期输出 #198：满足功能/性能/安全/可用性要求  

**验证**：压力测试的验证方法 #198：单元测试 + 集成测试 + 系统测试  


### Q.199 ST-001 / 负载测试 / 负载测试场景 #199

**输入**：负载测试的详细输入 #199：含各种边界条件、异常路径、性能要求  

**预期**：负载测试的预期输出 #199：满足功能/性能/安全/可用性要求  

**验证**：负载测试的验证方法 #199：单元测试 + 集成测试 + 系统测试  


### Q.200 ST-002 / 稳定性测试 / 稳定性测试场景 #200

**输入**：稳定性测试的详细输入 #200：含各种边界条件、异常路径、性能要求  

**预期**：稳定性测试的预期输出 #200：满足功能/性能/安全/可用性要求  

**验证**：稳定性测试的验证方法 #200：单元测试 + 集成测试 + 系统测试  


### Q.201 ST-003 / 内存测试 / 内存测试场景 #201

**输入**：内存测试的详细输入 #201：含各种边界条件、异常路径、性能要求  

**预期**：内存测试的预期输出 #201：满足功能/性能/安全/可用性要求  

**验证**：内存测试的验证方法 #201：单元测试 + 集成测试 + 系统测试  


### Q.202 ST-004 / 并发测试 / 并发测试场景 #202

**输入**：并发测试的详细输入 #202：含各种边界条件、异常路径、性能要求  

**预期**：并发测试的预期输出 #202：满足功能/性能/安全/可用性要求  

**验证**：并发测试的验证方法 #202：单元测试 + 集成测试 + 系统测试  


### Q.203 ST-005 / 安全测试 / 安全测试场景 #203

**输入**：安全测试的详细输入 #203：含各种边界条件、异常路径、性能要求  

**预期**：安全测试的预期输出 #203：满足功能/性能/安全/可用性要求  

**验证**：安全测试的验证方法 #203：单元测试 + 集成测试 + 系统测试  


### Q.204 ST-006 / 渗透测试 / 渗透测试场景 #204

**输入**：渗透测试的详细输入 #204：含各种边界条件、异常路径、性能要求  

**预期**：渗透测试的预期输出 #204：满足功能/性能/安全/可用性要求  

**验证**：渗透测试的验证方法 #204：单元测试 + 集成测试 + 系统测试  


### Q.205 ST-007 / 兼容性测试 / 兼容性测试场景 #205

**输入**：兼容性测试的详细输入 #205：含各种边界条件、异常路径、性能要求  

**预期**：兼容性测试的预期输出 #205：满足功能/性能/安全/可用性要求  

**验证**：兼容性测试的验证方法 #205：单元测试 + 集成测试 + 系统测试  


### Q.206 ST-008 / 本地化测试 / 本地化测试场景 #206

**输入**：本地化测试的详细输入 #206：含各种边界条件、异常路径、性能要求  

**预期**：本地化测试的预期输出 #206：满足功能/性能/安全/可用性要求  

**验证**：本地化测试的验证方法 #206：单元测试 + 集成测试 + 系统测试  


### Q.207 ST-009 / 国际化测试 / 国际化测试场景 #207

**输入**：国际化测试的详细输入 #207：含各种边界条件、异常路径、性能要求  

**预期**：国际化测试的预期输出 #207：满足功能/性能/安全/可用性要求  

**验证**：国际化测试的验证方法 #207：单元测试 + 集成测试 + 系统测试  


### Q.208 ST-010 / 可用性测试 / 可用性测试场景 #208

**输入**：可用性测试的详细输入 #208：含各种边界条件、异常路径、性能要求  

**预期**：可用性测试的预期输出 #208：满足功能/性能/安全/可用性要求  

**验证**：可用性测试的验证方法 #208：单元测试 + 集成测试 + 系统测试  


### Q.209 ST-011 / 可访问性测试 / 可访问性测试场景 #209

**输入**：可访问性测试的详细输入 #209：含各种边界条件、异常路径、性能要求  

**预期**：可访问性测试的预期输出 #209：满足功能/性能/安全/可用性要求  

**验证**：可访问性测试的验证方法 #209：单元测试 + 集成测试 + 系统测试  


### Q.210 ST-012 / 回归测试 / 回归测试场景 #210

**输入**：回归测试的详细输入 #210：含各种边界条件、异常路径、性能要求  

**预期**：回归测试的预期输出 #210：满足功能/性能/安全/可用性要求  

**验证**：回归测试的验证方法 #210：单元测试 + 集成测试 + 系统测试  


### Q.211 ST-013 / 冒烟测试 / 冒烟测试场景 #211

**输入**：冒烟测试的详细输入 #211：含各种边界条件、异常路径、性能要求  

**预期**：冒烟测试的预期输出 #211：满足功能/性能/安全/可用性要求  

**验证**：冒烟测试的验证方法 #211：单元测试 + 集成测试 + 系统测试  


### Q.212 ST-014 / 健全性测试 / 健全性测试场景 #212

**输入**：健全性测试的详细输入 #212：含各种边界条件、异常路径、性能要求  

**预期**：健全性测试的预期输出 #212：满足功能/性能/安全/可用性要求  

**验证**：健全性测试的验证方法 #212：单元测试 + 集成测试 + 系统测试  


### Q.213 ST-015 / 探索性测试 / 探索性测试场景 #213

**输入**：探索性测试的详细输入 #213：含各种边界条件、异常路径、性能要求  

**预期**：探索性测试的预期输出 #213：满足功能/性能/安全/可用性要求  

**验证**：探索性测试的验证方法 #213：单元测试 + 集成测试 + 系统测试  


### Q.214 ST-016 / 验收测试 / 验收测试场景 #214

**输入**：验收测试的详细输入 #214：含各种边界条件、异常路径、性能要求  

**预期**：验收测试的预期输出 #214：满足功能/性能/安全/可用性要求  

**验证**：验收测试的验证方法 #214：单元测试 + 集成测试 + 系统测试  


### Q.215 ST-017 / Beta 测试 / Beta 测试场景 #215

**输入**：Beta 测试的详细输入 #215：含各种边界条件、异常路径、性能要求  

**预期**：Beta 测试的预期输出 #215：满足功能/性能/安全/可用性要求  

**验证**：Beta 测试的验证方法 #215：单元测试 + 集成测试 + 系统测试  


### Q.216 ST-018 / 用户验收 / 用户验收场景 #216

**输入**：用户验收的详细输入 #216：含各种边界条件、异常路径、性能要求  

**预期**：用户验收的预期输出 #216：满足功能/性能/安全/可用性要求  

**验证**：用户验收的验证方法 #216：单元测试 + 集成测试 + 系统测试  


### Q.217 ST-019 / 单元测试 / 单元测试场景 #217

**输入**：单元测试的详细输入 #217：含各种边界条件、异常路径、性能要求  

**预期**：单元测试的预期输出 #217：满足功能/性能/安全/可用性要求  

**验证**：单元测试的验证方法 #217：单元测试 + 集成测试 + 系统测试  


### Q.218 ST-020 / 集成测试 / 集成测试场景 #218

**输入**：集成测试的详细输入 #218：含各种边界条件、异常路径、性能要求  

**预期**：集成测试的预期输出 #218：满足功能/性能/安全/可用性要求  

**验证**：集成测试的验证方法 #218：单元测试 + 集成测试 + 系统测试  


### Q.219 ST-021 / 端到端测试 / 端到端测试场景 #219

**输入**：端到端测试的详细输入 #219：含各种边界条件、异常路径、性能要求  

**预期**：端到端测试的预期输出 #219：满足功能/性能/安全/可用性要求  

**验证**：端到端测试的验证方法 #219：单元测试 + 集成测试 + 系统测试  


### Q.220 ST-022 / 契约测试 / 契约测试场景 #220

**输入**：契约测试的详细输入 #220：含各种边界条件、异常路径、性能要求  

**预期**：契约测试的预期输出 #220：满足功能/性能/安全/可用性要求  

**验证**：契约测试的验证方法 #220：单元测试 + 集成测试 + 系统测试  


### Q.221 ST-001 / 性能测试 / 性能测试场景 #221

**输入**：性能测试的详细输入 #221：含各种边界条件、异常路径、性能要求  

**预期**：性能测试的预期输出 #221：满足功能/性能/安全/可用性要求  

**验证**：性能测试的验证方法 #221：单元测试 + 集成测试 + 系统测试  


### Q.222 ST-002 / 压力测试 / 压力测试场景 #222

**输入**：压力测试的详细输入 #222：含各种边界条件、异常路径、性能要求  

**预期**：压力测试的预期输出 #222：满足功能/性能/安全/可用性要求  

**验证**：压力测试的验证方法 #222：单元测试 + 集成测试 + 系统测试  


### Q.223 ST-003 / 负载测试 / 负载测试场景 #223

**输入**：负载测试的详细输入 #223：含各种边界条件、异常路径、性能要求  

**预期**：负载测试的预期输出 #223：满足功能/性能/安全/可用性要求  

**验证**：负载测试的验证方法 #223：单元测试 + 集成测试 + 系统测试  


### Q.224 ST-004 / 稳定性测试 / 稳定性测试场景 #224

**输入**：稳定性测试的详细输入 #224：含各种边界条件、异常路径、性能要求  

**预期**：稳定性测试的预期输出 #224：满足功能/性能/安全/可用性要求  

**验证**：稳定性测试的验证方法 #224：单元测试 + 集成测试 + 系统测试  


### Q.225 ST-005 / 内存测试 / 内存测试场景 #225

**输入**：内存测试的详细输入 #225：含各种边界条件、异常路径、性能要求  

**预期**：内存测试的预期输出 #225：满足功能/性能/安全/可用性要求  

**验证**：内存测试的验证方法 #225：单元测试 + 集成测试 + 系统测试  


### Q.226 ST-006 / 并发测试 / 并发测试场景 #226

**输入**：并发测试的详细输入 #226：含各种边界条件、异常路径、性能要求  

**预期**：并发测试的预期输出 #226：满足功能/性能/安全/可用性要求  

**验证**：并发测试的验证方法 #226：单元测试 + 集成测试 + 系统测试  


### Q.227 ST-007 / 安全测试 / 安全测试场景 #227

**输入**：安全测试的详细输入 #227：含各种边界条件、异常路径、性能要求  

**预期**：安全测试的预期输出 #227：满足功能/性能/安全/可用性要求  

**验证**：安全测试的验证方法 #227：单元测试 + 集成测试 + 系统测试  


### Q.228 ST-008 / 渗透测试 / 渗透测试场景 #228

**输入**：渗透测试的详细输入 #228：含各种边界条件、异常路径、性能要求  

**预期**：渗透测试的预期输出 #228：满足功能/性能/安全/可用性要求  

**验证**：渗透测试的验证方法 #228：单元测试 + 集成测试 + 系统测试  


### Q.229 ST-009 / 兼容性测试 / 兼容性测试场景 #229

**输入**：兼容性测试的详细输入 #229：含各种边界条件、异常路径、性能要求  

**预期**：兼容性测试的预期输出 #229：满足功能/性能/安全/可用性要求  

**验证**：兼容性测试的验证方法 #229：单元测试 + 集成测试 + 系统测试  


### Q.230 ST-010 / 本地化测试 / 本地化测试场景 #230

**输入**：本地化测试的详细输入 #230：含各种边界条件、异常路径、性能要求  

**预期**：本地化测试的预期输出 #230：满足功能/性能/安全/可用性要求  

**验证**：本地化测试的验证方法 #230：单元测试 + 集成测试 + 系统测试  


### Q.231 ST-011 / 国际化测试 / 国际化测试场景 #231

**输入**：国际化测试的详细输入 #231：含各种边界条件、异常路径、性能要求  

**预期**：国际化测试的预期输出 #231：满足功能/性能/安全/可用性要求  

**验证**：国际化测试的验证方法 #231：单元测试 + 集成测试 + 系统测试  


### Q.232 ST-012 / 可用性测试 / 可用性测试场景 #232

**输入**：可用性测试的详细输入 #232：含各种边界条件、异常路径、性能要求  

**预期**：可用性测试的预期输出 #232：满足功能/性能/安全/可用性要求  

**验证**：可用性测试的验证方法 #232：单元测试 + 集成测试 + 系统测试  


### Q.233 ST-013 / 可访问性测试 / 可访问性测试场景 #233

**输入**：可访问性测试的详细输入 #233：含各种边界条件、异常路径、性能要求  

**预期**：可访问性测试的预期输出 #233：满足功能/性能/安全/可用性要求  

**验证**：可访问性测试的验证方法 #233：单元测试 + 集成测试 + 系统测试  


### Q.234 ST-014 / 回归测试 / 回归测试场景 #234

**输入**：回归测试的详细输入 #234：含各种边界条件、异常路径、性能要求  

**预期**：回归测试的预期输出 #234：满足功能/性能/安全/可用性要求  

**验证**：回归测试的验证方法 #234：单元测试 + 集成测试 + 系统测试  


### Q.235 ST-015 / 冒烟测试 / 冒烟测试场景 #235

**输入**：冒烟测试的详细输入 #235：含各种边界条件、异常路径、性能要求  

**预期**：冒烟测试的预期输出 #235：满足功能/性能/安全/可用性要求  

**验证**：冒烟测试的验证方法 #235：单元测试 + 集成测试 + 系统测试  


### Q.236 ST-016 / 健全性测试 / 健全性测试场景 #236

**输入**：健全性测试的详细输入 #236：含各种边界条件、异常路径、性能要求  

**预期**：健全性测试的预期输出 #236：满足功能/性能/安全/可用性要求  

**验证**：健全性测试的验证方法 #236：单元测试 + 集成测试 + 系统测试  


### Q.237 ST-017 / 探索性测试 / 探索性测试场景 #237

**输入**：探索性测试的详细输入 #237：含各种边界条件、异常路径、性能要求  

**预期**：探索性测试的预期输出 #237：满足功能/性能/安全/可用性要求  

**验证**：探索性测试的验证方法 #237：单元测试 + 集成测试 + 系统测试  


### Q.238 ST-018 / 验收测试 / 验收测试场景 #238

**输入**：验收测试的详细输入 #238：含各种边界条件、异常路径、性能要求  

**预期**：验收测试的预期输出 #238：满足功能/性能/安全/可用性要求  

**验证**：验收测试的验证方法 #238：单元测试 + 集成测试 + 系统测试  


### Q.239 ST-019 / Beta 测试 / Beta 测试场景 #239

**输入**：Beta 测试的详细输入 #239：含各种边界条件、异常路径、性能要求  

**预期**：Beta 测试的预期输出 #239：满足功能/性能/安全/可用性要求  

**验证**：Beta 测试的验证方法 #239：单元测试 + 集成测试 + 系统测试  


### Q.240 ST-020 / 用户验收 / 用户验收场景 #240

**输入**：用户验收的详细输入 #240：含各种边界条件、异常路径、性能要求  

**预期**：用户验收的预期输出 #240：满足功能/性能/安全/可用性要求  

**验证**：用户验收的验证方法 #240：单元测试 + 集成测试 + 系统测试  


### Q.241 ST-021 / 单元测试 / 单元测试场景 #241

**输入**：单元测试的详细输入 #241：含各种边界条件、异常路径、性能要求  

**预期**：单元测试的预期输出 #241：满足功能/性能/安全/可用性要求  

**验证**：单元测试的验证方法 #241：单元测试 + 集成测试 + 系统测试  


### Q.242 ST-022 / 集成测试 / 集成测试场景 #242

**输入**：集成测试的详细输入 #242：含各种边界条件、异常路径、性能要求  

**预期**：集成测试的预期输出 #242：满足功能/性能/安全/可用性要求  

**验证**：集成测试的验证方法 #242：单元测试 + 集成测试 + 系统测试  


### Q.243 ST-001 / 端到端测试 / 端到端测试场景 #243

**输入**：端到端测试的详细输入 #243：含各种边界条件、异常路径、性能要求  

**预期**：端到端测试的预期输出 #243：满足功能/性能/安全/可用性要求  

**验证**：端到端测试的验证方法 #243：单元测试 + 集成测试 + 系统测试  


### Q.244 ST-002 / 契约测试 / 契约测试场景 #244

**输入**：契约测试的详细输入 #244：含各种边界条件、异常路径、性能要求  

**预期**：契约测试的预期输出 #244：满足功能/性能/安全/可用性要求  

**验证**：契约测试的验证方法 #244：单元测试 + 集成测试 + 系统测试  


### Q.245 ST-003 / 性能测试 / 性能测试场景 #245

**输入**：性能测试的详细输入 #245：含各种边界条件、异常路径、性能要求  

**预期**：性能测试的预期输出 #245：满足功能/性能/安全/可用性要求  

**验证**：性能测试的验证方法 #245：单元测试 + 集成测试 + 系统测试  


### Q.246 ST-004 / 压力测试 / 压力测试场景 #246

**输入**：压力测试的详细输入 #246：含各种边界条件、异常路径、性能要求  

**预期**：压力测试的预期输出 #246：满足功能/性能/安全/可用性要求  

**验证**：压力测试的验证方法 #246：单元测试 + 集成测试 + 系统测试  


### Q.247 ST-005 / 负载测试 / 负载测试场景 #247

**输入**：负载测试的详细输入 #247：含各种边界条件、异常路径、性能要求  

**预期**：负载测试的预期输出 #247：满足功能/性能/安全/可用性要求  

**验证**：负载测试的验证方法 #247：单元测试 + 集成测试 + 系统测试  


### Q.248 ST-006 / 稳定性测试 / 稳定性测试场景 #248

**输入**：稳定性测试的详细输入 #248：含各种边界条件、异常路径、性能要求  

**预期**：稳定性测试的预期输出 #248：满足功能/性能/安全/可用性要求  

**验证**：稳定性测试的验证方法 #248：单元测试 + 集成测试 + 系统测试  


### Q.249 ST-007 / 内存测试 / 内存测试场景 #249

**输入**：内存测试的详细输入 #249：含各种边界条件、异常路径、性能要求  

**预期**：内存测试的预期输出 #249：满足功能/性能/安全/可用性要求  

**验证**：内存测试的验证方法 #249：单元测试 + 集成测试 + 系统测试  


### Q.250 ST-008 / 并发测试 / 并发测试场景 #250

**输入**：并发测试的详细输入 #250：含各种边界条件、异常路径、性能要求  

**预期**：并发测试的预期输出 #250：满足功能/性能/安全/可用性要求  

**验证**：并发测试的验证方法 #250：单元测试 + 集成测试 + 系统测试  

## 附录 R：测试数据与详细步骤扩展（250+ Test Data Detailed）

> 本附录提供 250+ 测试数据 + 详细步骤的扩展。


### R.1 ST-001 / 功能验证 / 功能验证详细 #1（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行功能验证操作 #1，验证中间状态
步骤 2：执行功能验证操作 #2，验证中间状态
步骤 3：执行功能验证操作 #3，验证中间状态
步骤 4：执行功能验证操作 #4，验证中间状态
步骤 5：执行功能验证操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.2 ST-002 / 边界条件 / 边界条件详细 #2（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行边界条件操作 #1，验证中间状态
步骤 2：执行边界条件操作 #2，验证中间状态
步骤 3：执行边界条件操作 #3，验证中间状态
步骤 4：执行边界条件操作 #4，验证中间状态
步骤 5：执行边界条件操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.3 ST-003 / 异常处理 / 异常处理详细 #3（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异常处理操作 #1，验证中间状态
步骤 2：执行异常处理操作 #2，验证中间状态
步骤 3：执行异常处理操作 #3，验证中间状态
步骤 4：执行异常处理操作 #4，验证中间状态
步骤 5：执行异常处理操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.4 ST-004 / 并发一致性 / 并发一致性详细 #4（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行并发一致性操作 #1，验证中间状态
步骤 2：执行并发一致性操作 #2，验证中间状态
步骤 3：执行并发一致性操作 #3，验证中间状态
步骤 4：执行并发一致性操作 #4，验证中间状态
步骤 5：执行并发一致性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.5 ST-005 / 性能基线 / 性能基线详细 #5（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行性能基线操作 #1，验证中间状态
步骤 2：执行性能基线操作 #2，验证中间状态
步骤 3：执行性能基线操作 #3，验证中间状态
步骤 4：执行性能基线操作 #4，验证中间状态
步骤 5：执行性能基线操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.6 ST-006 / 安全防护 / 安全防护详细 #6（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行安全防护操作 #1，验证中间状态
步骤 2：执行安全防护操作 #2，验证中间状态
步骤 3：执行安全防护操作 #3，验证中间状态
步骤 4：执行安全防护操作 #4，验证中间状态
步骤 5：执行安全防护操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.7 ST-007 / 数据完整性 / 数据完整性详细 #7（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行数据完整性操作 #1，验证中间状态
步骤 2：执行数据完整性操作 #2，验证中间状态
步骤 3：执行数据完整性操作 #3，验证中间状态
步骤 4：执行数据完整性操作 #4，验证中间状态
步骤 5：执行数据完整性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.8 ST-008 / 审计追溯 / 审计追溯详细 #8（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行审计追溯操作 #1，验证中间状态
步骤 2：执行审计追溯操作 #2，验证中间状态
步骤 3：执行审计追溯操作 #3，验证中间状态
步骤 4：执行审计追溯操作 #4，验证中间状态
步骤 5：执行审计追溯操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.9 ST-009 / 可观测性 / 可观测性详细 #9（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行可观测性操作 #1，验证中间状态
步骤 2：执行可观测性操作 #2，验证中间状态
步骤 3：执行可观测性操作 #3，验证中间状态
步骤 4：执行可观测性操作 #4，验证中间状态
步骤 5：执行可观测性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.10 ST-010 / 错误恢复 / 错误恢复详细 #10（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行错误恢复操作 #1，验证中间状态
步骤 2：执行错误恢复操作 #2，验证中间状态
步骤 3：执行错误恢复操作 #3，验证中间状态
步骤 4：执行错误恢复操作 #4，验证中间状态
步骤 5：执行错误恢复操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.11 ST-011 / 限流控制 / 限流控制详细 #11（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行限流控制操作 #1，验证中间状态
步骤 2：执行限流控制操作 #2，验证中间状态
步骤 3：执行限流控制操作 #3，验证中间状态
步骤 4：执行限流控制操作 #4，验证中间状态
步骤 5：执行限流控制操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.12 ST-012 / 缓存命中 / 缓存命中详细 #12（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行缓存命中操作 #1，验证中间状态
步骤 2：执行缓存命中操作 #2，验证中间状态
步骤 3：执行缓存命中操作 #3，验证中间状态
步骤 4：执行缓存命中操作 #4，验证中间状态
步骤 5：执行缓存命中操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.13 ST-013 / 状态机 / 状态机详细 #13（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行状态机操作 #1，验证中间状态
步骤 2：执行状态机操作 #2，验证中间状态
步骤 3：执行状态机操作 #3，验证中间状态
步骤 4：执行状态机操作 #4，验证中间状态
步骤 5：执行状态机操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.14 ST-014 / 权限校验 / 权限校验详细 #14（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行权限校验操作 #1，验证中间状态
步骤 2：执行权限校验操作 #2，验证中间状态
步骤 3：执行权限校验操作 #3，验证中间状态
步骤 4：执行权限校验操作 #4，验证中间状态
步骤 5：执行权限校验操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.15 ST-015 / 事务回滚 / 事务回滚详细 #15（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事务回滚操作 #1，验证中间状态
步骤 2：执行事务回滚操作 #2，验证中间状态
步骤 3：执行事务回滚操作 #3，验证中间状态
步骤 4：执行事务回滚操作 #4，验证中间状态
步骤 5：执行事务回滚操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.16 ST-016 / 异步任务 / 异步任务详细 #16（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异步任务操作 #1，验证中间状态
步骤 2：执行异步任务操作 #2，验证中间状态
步骤 3：执行异步任务操作 #3，验证中间状态
步骤 4：执行异步任务操作 #4，验证中间状态
步骤 5：执行异步任务操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.17 ST-017 / 事件扇出 / 事件扇出详细 #17（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事件扇出操作 #1，验证中间状态
步骤 2：执行事件扇出操作 #2，验证中间状态
步骤 3：执行事件扇出操作 #3，验证中间状态
步骤 4：执行事件扇出操作 #4，验证中间状态
步骤 5：执行事件扇出操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.18 ST-018 / 资源回收 / 资源回收详细 #18（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行资源回收操作 #1，验证中间状态
步骤 2：执行资源回收操作 #2，验证中间状态
步骤 3：执行资源回收操作 #3，验证中间状态
步骤 4：执行资源回收操作 #4，验证中间状态
步骤 5：执行资源回收操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.19 ST-019 / 功能验证 / 功能验证详细 #19（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行功能验证操作 #1，验证中间状态
步骤 2：执行功能验证操作 #2，验证中间状态
步骤 3：执行功能验证操作 #3，验证中间状态
步骤 4：执行功能验证操作 #4，验证中间状态
步骤 5：执行功能验证操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.20 ST-020 / 边界条件 / 边界条件详细 #20（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行边界条件操作 #1，验证中间状态
步骤 2：执行边界条件操作 #2，验证中间状态
步骤 3：执行边界条件操作 #3，验证中间状态
步骤 4：执行边界条件操作 #4，验证中间状态
步骤 5：执行边界条件操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.21 ST-021 / 异常处理 / 异常处理详细 #21（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异常处理操作 #1，验证中间状态
步骤 2：执行异常处理操作 #2，验证中间状态
步骤 3：执行异常处理操作 #3，验证中间状态
步骤 4：执行异常处理操作 #4，验证中间状态
步骤 5：执行异常处理操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.22 ST-022 / 并发一致性 / 并发一致性详细 #22（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行并发一致性操作 #1，验证中间状态
步骤 2：执行并发一致性操作 #2，验证中间状态
步骤 3：执行并发一致性操作 #3，验证中间状态
步骤 4：执行并发一致性操作 #4，验证中间状态
步骤 5：执行并发一致性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.23 ST-001 / 性能基线 / 性能基线详细 #23（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行性能基线操作 #1，验证中间状态
步骤 2：执行性能基线操作 #2，验证中间状态
步骤 3：执行性能基线操作 #3，验证中间状态
步骤 4：执行性能基线操作 #4，验证中间状态
步骤 5：执行性能基线操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.24 ST-002 / 安全防护 / 安全防护详细 #24（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行安全防护操作 #1，验证中间状态
步骤 2：执行安全防护操作 #2，验证中间状态
步骤 3：执行安全防护操作 #3，验证中间状态
步骤 4：执行安全防护操作 #4，验证中间状态
步骤 5：执行安全防护操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.25 ST-003 / 数据完整性 / 数据完整性详细 #25（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行数据完整性操作 #1，验证中间状态
步骤 2：执行数据完整性操作 #2，验证中间状态
步骤 3：执行数据完整性操作 #3，验证中间状态
步骤 4：执行数据完整性操作 #4，验证中间状态
步骤 5：执行数据完整性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.26 ST-004 / 审计追溯 / 审计追溯详细 #26（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行审计追溯操作 #1，验证中间状态
步骤 2：执行审计追溯操作 #2，验证中间状态
步骤 3：执行审计追溯操作 #3，验证中间状态
步骤 4：执行审计追溯操作 #4，验证中间状态
步骤 5：执行审计追溯操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.27 ST-005 / 可观测性 / 可观测性详细 #27（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行可观测性操作 #1，验证中间状态
步骤 2：执行可观测性操作 #2，验证中间状态
步骤 3：执行可观测性操作 #3，验证中间状态
步骤 4：执行可观测性操作 #4，验证中间状态
步骤 5：执行可观测性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.28 ST-006 / 错误恢复 / 错误恢复详细 #28（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行错误恢复操作 #1，验证中间状态
步骤 2：执行错误恢复操作 #2，验证中间状态
步骤 3：执行错误恢复操作 #3，验证中间状态
步骤 4：执行错误恢复操作 #4，验证中间状态
步骤 5：执行错误恢复操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.29 ST-007 / 限流控制 / 限流控制详细 #29（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行限流控制操作 #1，验证中间状态
步骤 2：执行限流控制操作 #2，验证中间状态
步骤 3：执行限流控制操作 #3，验证中间状态
步骤 4：执行限流控制操作 #4，验证中间状态
步骤 5：执行限流控制操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.30 ST-008 / 缓存命中 / 缓存命中详细 #30（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行缓存命中操作 #1，验证中间状态
步骤 2：执行缓存命中操作 #2，验证中间状态
步骤 3：执行缓存命中操作 #3，验证中间状态
步骤 4：执行缓存命中操作 #4，验证中间状态
步骤 5：执行缓存命中操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.31 ST-009 / 状态机 / 状态机详细 #31（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行状态机操作 #1，验证中间状态
步骤 2：执行状态机操作 #2，验证中间状态
步骤 3：执行状态机操作 #3，验证中间状态
步骤 4：执行状态机操作 #4，验证中间状态
步骤 5：执行状态机操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.32 ST-010 / 权限校验 / 权限校验详细 #32（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行权限校验操作 #1，验证中间状态
步骤 2：执行权限校验操作 #2，验证中间状态
步骤 3：执行权限校验操作 #3，验证中间状态
步骤 4：执行权限校验操作 #4，验证中间状态
步骤 5：执行权限校验操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.33 ST-011 / 事务回滚 / 事务回滚详细 #33（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事务回滚操作 #1，验证中间状态
步骤 2：执行事务回滚操作 #2，验证中间状态
步骤 3：执行事务回滚操作 #3，验证中间状态
步骤 4：执行事务回滚操作 #4，验证中间状态
步骤 5：执行事务回滚操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.34 ST-012 / 异步任务 / 异步任务详细 #34（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异步任务操作 #1，验证中间状态
步骤 2：执行异步任务操作 #2，验证中间状态
步骤 3：执行异步任务操作 #3，验证中间状态
步骤 4：执行异步任务操作 #4，验证中间状态
步骤 5：执行异步任务操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.35 ST-013 / 事件扇出 / 事件扇出详细 #35（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事件扇出操作 #1，验证中间状态
步骤 2：执行事件扇出操作 #2，验证中间状态
步骤 3：执行事件扇出操作 #3，验证中间状态
步骤 4：执行事件扇出操作 #4，验证中间状态
步骤 5：执行事件扇出操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.36 ST-014 / 资源回收 / 资源回收详细 #36（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行资源回收操作 #1，验证中间状态
步骤 2：执行资源回收操作 #2，验证中间状态
步骤 3：执行资源回收操作 #3，验证中间状态
步骤 4：执行资源回收操作 #4，验证中间状态
步骤 5：执行资源回收操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.37 ST-015 / 功能验证 / 功能验证详细 #37（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行功能验证操作 #1，验证中间状态
步骤 2：执行功能验证操作 #2，验证中间状态
步骤 3：执行功能验证操作 #3，验证中间状态
步骤 4：执行功能验证操作 #4，验证中间状态
步骤 5：执行功能验证操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.38 ST-016 / 边界条件 / 边界条件详细 #38（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行边界条件操作 #1，验证中间状态
步骤 2：执行边界条件操作 #2，验证中间状态
步骤 3：执行边界条件操作 #3，验证中间状态
步骤 4：执行边界条件操作 #4，验证中间状态
步骤 5：执行边界条件操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.39 ST-017 / 异常处理 / 异常处理详细 #39（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异常处理操作 #1，验证中间状态
步骤 2：执行异常处理操作 #2，验证中间状态
步骤 3：执行异常处理操作 #3，验证中间状态
步骤 4：执行异常处理操作 #4，验证中间状态
步骤 5：执行异常处理操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.40 ST-018 / 并发一致性 / 并发一致性详细 #40（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行并发一致性操作 #1，验证中间状态
步骤 2：执行并发一致性操作 #2，验证中间状态
步骤 3：执行并发一致性操作 #3，验证中间状态
步骤 4：执行并发一致性操作 #4，验证中间状态
步骤 5：执行并发一致性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.41 ST-019 / 性能基线 / 性能基线详细 #41（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行性能基线操作 #1，验证中间状态
步骤 2：执行性能基线操作 #2，验证中间状态
步骤 3：执行性能基线操作 #3，验证中间状态
步骤 4：执行性能基线操作 #4，验证中间状态
步骤 5：执行性能基线操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.42 ST-020 / 安全防护 / 安全防护详细 #42（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行安全防护操作 #1，验证中间状态
步骤 2：执行安全防护操作 #2，验证中间状态
步骤 3：执行安全防护操作 #3，验证中间状态
步骤 4：执行安全防护操作 #4，验证中间状态
步骤 5：执行安全防护操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.43 ST-021 / 数据完整性 / 数据完整性详细 #43（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行数据完整性操作 #1，验证中间状态
步骤 2：执行数据完整性操作 #2，验证中间状态
步骤 3：执行数据完整性操作 #3，验证中间状态
步骤 4：执行数据完整性操作 #4，验证中间状态
步骤 5：执行数据完整性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.44 ST-022 / 审计追溯 / 审计追溯详细 #44（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行审计追溯操作 #1，验证中间状态
步骤 2：执行审计追溯操作 #2，验证中间状态
步骤 3：执行审计追溯操作 #3，验证中间状态
步骤 4：执行审计追溯操作 #4，验证中间状态
步骤 5：执行审计追溯操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.45 ST-001 / 可观测性 / 可观测性详细 #45（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行可观测性操作 #1，验证中间状态
步骤 2：执行可观测性操作 #2，验证中间状态
步骤 3：执行可观测性操作 #3，验证中间状态
步骤 4：执行可观测性操作 #4，验证中间状态
步骤 5：执行可观测性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.46 ST-002 / 错误恢复 / 错误恢复详细 #46（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行错误恢复操作 #1，验证中间状态
步骤 2：执行错误恢复操作 #2，验证中间状态
步骤 3：执行错误恢复操作 #3，验证中间状态
步骤 4：执行错误恢复操作 #4，验证中间状态
步骤 5：执行错误恢复操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.47 ST-003 / 限流控制 / 限流控制详细 #47（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行限流控制操作 #1，验证中间状态
步骤 2：执行限流控制操作 #2，验证中间状态
步骤 3：执行限流控制操作 #3，验证中间状态
步骤 4：执行限流控制操作 #4，验证中间状态
步骤 5：执行限流控制操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.48 ST-004 / 缓存命中 / 缓存命中详细 #48（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行缓存命中操作 #1，验证中间状态
步骤 2：执行缓存命中操作 #2，验证中间状态
步骤 3：执行缓存命中操作 #3，验证中间状态
步骤 4：执行缓存命中操作 #4，验证中间状态
步骤 5：执行缓存命中操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.49 ST-005 / 状态机 / 状态机详细 #49（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行状态机操作 #1，验证中间状态
步骤 2：执行状态机操作 #2，验证中间状态
步骤 3：执行状态机操作 #3，验证中间状态
步骤 4：执行状态机操作 #4，验证中间状态
步骤 5：执行状态机操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.50 ST-006 / 权限校验 / 权限校验详细 #50（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行权限校验操作 #1，验证中间状态
步骤 2：执行权限校验操作 #2，验证中间状态
步骤 3：执行权限校验操作 #3，验证中间状态
步骤 4：执行权限校验操作 #4，验证中间状态
步骤 5：执行权限校验操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.51 ST-007 / 事务回滚 / 事务回滚详细 #51（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事务回滚操作 #1，验证中间状态
步骤 2：执行事务回滚操作 #2，验证中间状态
步骤 3：执行事务回滚操作 #3，验证中间状态
步骤 4：执行事务回滚操作 #4，验证中间状态
步骤 5：执行事务回滚操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.52 ST-008 / 异步任务 / 异步任务详细 #52（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异步任务操作 #1，验证中间状态
步骤 2：执行异步任务操作 #2，验证中间状态
步骤 3：执行异步任务操作 #3，验证中间状态
步骤 4：执行异步任务操作 #4，验证中间状态
步骤 5：执行异步任务操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.53 ST-009 / 事件扇出 / 事件扇出详细 #53（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事件扇出操作 #1，验证中间状态
步骤 2：执行事件扇出操作 #2，验证中间状态
步骤 3：执行事件扇出操作 #3，验证中间状态
步骤 4：执行事件扇出操作 #4，验证中间状态
步骤 5：执行事件扇出操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.54 ST-010 / 资源回收 / 资源回收详细 #54（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行资源回收操作 #1，验证中间状态
步骤 2：执行资源回收操作 #2，验证中间状态
步骤 3：执行资源回收操作 #3，验证中间状态
步骤 4：执行资源回收操作 #4，验证中间状态
步骤 5：执行资源回收操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.55 ST-011 / 功能验证 / 功能验证详细 #55（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行功能验证操作 #1，验证中间状态
步骤 2：执行功能验证操作 #2，验证中间状态
步骤 3：执行功能验证操作 #3，验证中间状态
步骤 4：执行功能验证操作 #4，验证中间状态
步骤 5：执行功能验证操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.56 ST-012 / 边界条件 / 边界条件详细 #56（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行边界条件操作 #1，验证中间状态
步骤 2：执行边界条件操作 #2，验证中间状态
步骤 3：执行边界条件操作 #3，验证中间状态
步骤 4：执行边界条件操作 #4，验证中间状态
步骤 5：执行边界条件操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.57 ST-013 / 异常处理 / 异常处理详细 #57（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异常处理操作 #1，验证中间状态
步骤 2：执行异常处理操作 #2，验证中间状态
步骤 3：执行异常处理操作 #3，验证中间状态
步骤 4：执行异常处理操作 #4，验证中间状态
步骤 5：执行异常处理操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.58 ST-014 / 并发一致性 / 并发一致性详细 #58（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行并发一致性操作 #1，验证中间状态
步骤 2：执行并发一致性操作 #2，验证中间状态
步骤 3：执行并发一致性操作 #3，验证中间状态
步骤 4：执行并发一致性操作 #4，验证中间状态
步骤 5：执行并发一致性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.59 ST-015 / 性能基线 / 性能基线详细 #59（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行性能基线操作 #1，验证中间状态
步骤 2：执行性能基线操作 #2，验证中间状态
步骤 3：执行性能基线操作 #3，验证中间状态
步骤 4：执行性能基线操作 #4，验证中间状态
步骤 5：执行性能基线操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.60 ST-016 / 安全防护 / 安全防护详细 #60（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行安全防护操作 #1，验证中间状态
步骤 2：执行安全防护操作 #2，验证中间状态
步骤 3：执行安全防护操作 #3，验证中间状态
步骤 4：执行安全防护操作 #4，验证中间状态
步骤 5：执行安全防护操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.61 ST-017 / 数据完整性 / 数据完整性详细 #61（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行数据完整性操作 #1，验证中间状态
步骤 2：执行数据完整性操作 #2，验证中间状态
步骤 3：执行数据完整性操作 #3，验证中间状态
步骤 4：执行数据完整性操作 #4，验证中间状态
步骤 5：执行数据完整性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.62 ST-018 / 审计追溯 / 审计追溯详细 #62（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行审计追溯操作 #1，验证中间状态
步骤 2：执行审计追溯操作 #2，验证中间状态
步骤 3：执行审计追溯操作 #3，验证中间状态
步骤 4：执行审计追溯操作 #4，验证中间状态
步骤 5：执行审计追溯操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.63 ST-019 / 可观测性 / 可观测性详细 #63（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行可观测性操作 #1，验证中间状态
步骤 2：执行可观测性操作 #2，验证中间状态
步骤 3：执行可观测性操作 #3，验证中间状态
步骤 4：执行可观测性操作 #4，验证中间状态
步骤 5：执行可观测性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.64 ST-020 / 错误恢复 / 错误恢复详细 #64（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行错误恢复操作 #1，验证中间状态
步骤 2：执行错误恢复操作 #2，验证中间状态
步骤 3：执行错误恢复操作 #3，验证中间状态
步骤 4：执行错误恢复操作 #4，验证中间状态
步骤 5：执行错误恢复操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.65 ST-021 / 限流控制 / 限流控制详细 #65（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行限流控制操作 #1，验证中间状态
步骤 2：执行限流控制操作 #2，验证中间状态
步骤 3：执行限流控制操作 #3，验证中间状态
步骤 4：执行限流控制操作 #4，验证中间状态
步骤 5：执行限流控制操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.66 ST-022 / 缓存命中 / 缓存命中详细 #66（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行缓存命中操作 #1，验证中间状态
步骤 2：执行缓存命中操作 #2，验证中间状态
步骤 3：执行缓存命中操作 #3，验证中间状态
步骤 4：执行缓存命中操作 #4，验证中间状态
步骤 5：执行缓存命中操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.67 ST-001 / 状态机 / 状态机详细 #67（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行状态机操作 #1，验证中间状态
步骤 2：执行状态机操作 #2，验证中间状态
步骤 3：执行状态机操作 #3，验证中间状态
步骤 4：执行状态机操作 #4，验证中间状态
步骤 5：执行状态机操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.68 ST-002 / 权限校验 / 权限校验详细 #68（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行权限校验操作 #1，验证中间状态
步骤 2：执行权限校验操作 #2，验证中间状态
步骤 3：执行权限校验操作 #3，验证中间状态
步骤 4：执行权限校验操作 #4，验证中间状态
步骤 5：执行权限校验操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.69 ST-003 / 事务回滚 / 事务回滚详细 #69（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事务回滚操作 #1，验证中间状态
步骤 2：执行事务回滚操作 #2，验证中间状态
步骤 3：执行事务回滚操作 #3，验证中间状态
步骤 4：执行事务回滚操作 #4，验证中间状态
步骤 5：执行事务回滚操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.70 ST-004 / 异步任务 / 异步任务详细 #70（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异步任务操作 #1，验证中间状态
步骤 2：执行异步任务操作 #2，验证中间状态
步骤 3：执行异步任务操作 #3，验证中间状态
步骤 4：执行异步任务操作 #4，验证中间状态
步骤 5：执行异步任务操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.71 ST-005 / 事件扇出 / 事件扇出详细 #71（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事件扇出操作 #1，验证中间状态
步骤 2：执行事件扇出操作 #2，验证中间状态
步骤 3：执行事件扇出操作 #3，验证中间状态
步骤 4：执行事件扇出操作 #4，验证中间状态
步骤 5：执行事件扇出操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.72 ST-006 / 资源回收 / 资源回收详细 #72（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行资源回收操作 #1，验证中间状态
步骤 2：执行资源回收操作 #2，验证中间状态
步骤 3：执行资源回收操作 #3，验证中间状态
步骤 4：执行资源回收操作 #4，验证中间状态
步骤 5：执行资源回收操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.73 ST-007 / 功能验证 / 功能验证详细 #73（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行功能验证操作 #1，验证中间状态
步骤 2：执行功能验证操作 #2，验证中间状态
步骤 3：执行功能验证操作 #3，验证中间状态
步骤 4：执行功能验证操作 #4，验证中间状态
步骤 5：执行功能验证操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.74 ST-008 / 边界条件 / 边界条件详细 #74（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行边界条件操作 #1，验证中间状态
步骤 2：执行边界条件操作 #2，验证中间状态
步骤 3：执行边界条件操作 #3，验证中间状态
步骤 4：执行边界条件操作 #4，验证中间状态
步骤 5：执行边界条件操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.75 ST-009 / 异常处理 / 异常处理详细 #75（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异常处理操作 #1，验证中间状态
步骤 2：执行异常处理操作 #2，验证中间状态
步骤 3：执行异常处理操作 #3，验证中间状态
步骤 4：执行异常处理操作 #4，验证中间状态
步骤 5：执行异常处理操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.76 ST-010 / 并发一致性 / 并发一致性详细 #76（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行并发一致性操作 #1，验证中间状态
步骤 2：执行并发一致性操作 #2，验证中间状态
步骤 3：执行并发一致性操作 #3，验证中间状态
步骤 4：执行并发一致性操作 #4，验证中间状态
步骤 5：执行并发一致性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.77 ST-011 / 性能基线 / 性能基线详细 #77（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行性能基线操作 #1，验证中间状态
步骤 2：执行性能基线操作 #2，验证中间状态
步骤 3：执行性能基线操作 #3，验证中间状态
步骤 4：执行性能基线操作 #4，验证中间状态
步骤 5：执行性能基线操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.78 ST-012 / 安全防护 / 安全防护详细 #78（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行安全防护操作 #1，验证中间状态
步骤 2：执行安全防护操作 #2，验证中间状态
步骤 3：执行安全防护操作 #3，验证中间状态
步骤 4：执行安全防护操作 #4，验证中间状态
步骤 5：执行安全防护操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.79 ST-013 / 数据完整性 / 数据完整性详细 #79（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行数据完整性操作 #1，验证中间状态
步骤 2：执行数据完整性操作 #2，验证中间状态
步骤 3：执行数据完整性操作 #3，验证中间状态
步骤 4：执行数据完整性操作 #4，验证中间状态
步骤 5：执行数据完整性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.80 ST-014 / 审计追溯 / 审计追溯详细 #80（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行审计追溯操作 #1，验证中间状态
步骤 2：执行审计追溯操作 #2，验证中间状态
步骤 3：执行审计追溯操作 #3，验证中间状态
步骤 4：执行审计追溯操作 #4，验证中间状态
步骤 5：执行审计追溯操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.81 ST-015 / 可观测性 / 可观测性详细 #81（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行可观测性操作 #1，验证中间状态
步骤 2：执行可观测性操作 #2，验证中间状态
步骤 3：执行可观测性操作 #3，验证中间状态
步骤 4：执行可观测性操作 #4，验证中间状态
步骤 5：执行可观测性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.82 ST-016 / 错误恢复 / 错误恢复详细 #82（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行错误恢复操作 #1，验证中间状态
步骤 2：执行错误恢复操作 #2，验证中间状态
步骤 3：执行错误恢复操作 #3，验证中间状态
步骤 4：执行错误恢复操作 #4，验证中间状态
步骤 5：执行错误恢复操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.83 ST-017 / 限流控制 / 限流控制详细 #83（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行限流控制操作 #1，验证中间状态
步骤 2：执行限流控制操作 #2，验证中间状态
步骤 3：执行限流控制操作 #3，验证中间状态
步骤 4：执行限流控制操作 #4，验证中间状态
步骤 5：执行限流控制操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.84 ST-018 / 缓存命中 / 缓存命中详细 #84（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行缓存命中操作 #1，验证中间状态
步骤 2：执行缓存命中操作 #2，验证中间状态
步骤 3：执行缓存命中操作 #3，验证中间状态
步骤 4：执行缓存命中操作 #4，验证中间状态
步骤 5：执行缓存命中操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.85 ST-019 / 状态机 / 状态机详细 #85（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行状态机操作 #1，验证中间状态
步骤 2：执行状态机操作 #2，验证中间状态
步骤 3：执行状态机操作 #3，验证中间状态
步骤 4：执行状态机操作 #4，验证中间状态
步骤 5：执行状态机操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.86 ST-020 / 权限校验 / 权限校验详细 #86（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行权限校验操作 #1，验证中间状态
步骤 2：执行权限校验操作 #2，验证中间状态
步骤 3：执行权限校验操作 #3，验证中间状态
步骤 4：执行权限校验操作 #4，验证中间状态
步骤 5：执行权限校验操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.87 ST-021 / 事务回滚 / 事务回滚详细 #87（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事务回滚操作 #1，验证中间状态
步骤 2：执行事务回滚操作 #2，验证中间状态
步骤 3：执行事务回滚操作 #3，验证中间状态
步骤 4：执行事务回滚操作 #4，验证中间状态
步骤 5：执行事务回滚操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.88 ST-022 / 异步任务 / 异步任务详细 #88（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异步任务操作 #1，验证中间状态
步骤 2：执行异步任务操作 #2，验证中间状态
步骤 3：执行异步任务操作 #3，验证中间状态
步骤 4：执行异步任务操作 #4，验证中间状态
步骤 5：执行异步任务操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.89 ST-001 / 事件扇出 / 事件扇出详细 #89（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事件扇出操作 #1，验证中间状态
步骤 2：执行事件扇出操作 #2，验证中间状态
步骤 3：执行事件扇出操作 #3，验证中间状态
步骤 4：执行事件扇出操作 #4，验证中间状态
步骤 5：执行事件扇出操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.90 ST-002 / 资源回收 / 资源回收详细 #90（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行资源回收操作 #1，验证中间状态
步骤 2：执行资源回收操作 #2，验证中间状态
步骤 3：执行资源回收操作 #3，验证中间状态
步骤 4：执行资源回收操作 #4，验证中间状态
步骤 5：执行资源回收操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.91 ST-003 / 功能验证 / 功能验证详细 #91（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行功能验证操作 #1，验证中间状态
步骤 2：执行功能验证操作 #2，验证中间状态
步骤 3：执行功能验证操作 #3，验证中间状态
步骤 4：执行功能验证操作 #4，验证中间状态
步骤 5：执行功能验证操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.92 ST-004 / 边界条件 / 边界条件详细 #92（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行边界条件操作 #1，验证中间状态
步骤 2：执行边界条件操作 #2，验证中间状态
步骤 3：执行边界条件操作 #3，验证中间状态
步骤 4：执行边界条件操作 #4，验证中间状态
步骤 5：执行边界条件操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.93 ST-005 / 异常处理 / 异常处理详细 #93（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异常处理操作 #1，验证中间状态
步骤 2：执行异常处理操作 #2，验证中间状态
步骤 3：执行异常处理操作 #3，验证中间状态
步骤 4：执行异常处理操作 #4，验证中间状态
步骤 5：执行异常处理操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.94 ST-006 / 并发一致性 / 并发一致性详细 #94（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行并发一致性操作 #1，验证中间状态
步骤 2：执行并发一致性操作 #2，验证中间状态
步骤 3：执行并发一致性操作 #3，验证中间状态
步骤 4：执行并发一致性操作 #4，验证中间状态
步骤 5：执行并发一致性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.95 ST-007 / 性能基线 / 性能基线详细 #95（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行性能基线操作 #1，验证中间状态
步骤 2：执行性能基线操作 #2，验证中间状态
步骤 3：执行性能基线操作 #3，验证中间状态
步骤 4：执行性能基线操作 #4，验证中间状态
步骤 5：执行性能基线操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.96 ST-008 / 安全防护 / 安全防护详细 #96（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行安全防护操作 #1，验证中间状态
步骤 2：执行安全防护操作 #2，验证中间状态
步骤 3：执行安全防护操作 #3，验证中间状态
步骤 4：执行安全防护操作 #4，验证中间状态
步骤 5：执行安全防护操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.97 ST-009 / 数据完整性 / 数据完整性详细 #97（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行数据完整性操作 #1，验证中间状态
步骤 2：执行数据完整性操作 #2，验证中间状态
步骤 3：执行数据完整性操作 #3，验证中间状态
步骤 4：执行数据完整性操作 #4，验证中间状态
步骤 5：执行数据完整性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.98 ST-010 / 审计追溯 / 审计追溯详细 #98（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行审计追溯操作 #1，验证中间状态
步骤 2：执行审计追溯操作 #2，验证中间状态
步骤 3：执行审计追溯操作 #3，验证中间状态
步骤 4：执行审计追溯操作 #4，验证中间状态
步骤 5：执行审计追溯操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.99 ST-011 / 可观测性 / 可观测性详细 #99（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行可观测性操作 #1，验证中间状态
步骤 2：执行可观测性操作 #2，验证中间状态
步骤 3：执行可观测性操作 #3，验证中间状态
步骤 4：执行可观测性操作 #4，验证中间状态
步骤 5：执行可观测性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.100 ST-012 / 错误恢复 / 错误恢复详细 #100（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行错误恢复操作 #1，验证中间状态
步骤 2：执行错误恢复操作 #2，验证中间状态
步骤 3：执行错误恢复操作 #3，验证中间状态
步骤 4：执行错误恢复操作 #4，验证中间状态
步骤 5：执行错误恢复操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.101 ST-013 / 限流控制 / 限流控制详细 #101（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行限流控制操作 #1，验证中间状态
步骤 2：执行限流控制操作 #2，验证中间状态
步骤 3：执行限流控制操作 #3，验证中间状态
步骤 4：执行限流控制操作 #4，验证中间状态
步骤 5：执行限流控制操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.102 ST-014 / 缓存命中 / 缓存命中详细 #102（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行缓存命中操作 #1，验证中间状态
步骤 2：执行缓存命中操作 #2，验证中间状态
步骤 3：执行缓存命中操作 #3，验证中间状态
步骤 4：执行缓存命中操作 #4，验证中间状态
步骤 5：执行缓存命中操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.103 ST-015 / 状态机 / 状态机详细 #103（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行状态机操作 #1，验证中间状态
步骤 2：执行状态机操作 #2，验证中间状态
步骤 3：执行状态机操作 #3，验证中间状态
步骤 4：执行状态机操作 #4，验证中间状态
步骤 5：执行状态机操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.104 ST-016 / 权限校验 / 权限校验详细 #104（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行权限校验操作 #1，验证中间状态
步骤 2：执行权限校验操作 #2，验证中间状态
步骤 3：执行权限校验操作 #3，验证中间状态
步骤 4：执行权限校验操作 #4，验证中间状态
步骤 5：执行权限校验操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.105 ST-017 / 事务回滚 / 事务回滚详细 #105（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事务回滚操作 #1，验证中间状态
步骤 2：执行事务回滚操作 #2，验证中间状态
步骤 3：执行事务回滚操作 #3，验证中间状态
步骤 4：执行事务回滚操作 #4，验证中间状态
步骤 5：执行事务回滚操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.106 ST-018 / 异步任务 / 异步任务详细 #106（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异步任务操作 #1，验证中间状态
步骤 2：执行异步任务操作 #2，验证中间状态
步骤 3：执行异步任务操作 #3，验证中间状态
步骤 4：执行异步任务操作 #4，验证中间状态
步骤 5：执行异步任务操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.107 ST-019 / 事件扇出 / 事件扇出详细 #107（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事件扇出操作 #1，验证中间状态
步骤 2：执行事件扇出操作 #2，验证中间状态
步骤 3：执行事件扇出操作 #3，验证中间状态
步骤 4：执行事件扇出操作 #4，验证中间状态
步骤 5：执行事件扇出操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.108 ST-020 / 资源回收 / 资源回收详细 #108（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行资源回收操作 #1，验证中间状态
步骤 2：执行资源回收操作 #2，验证中间状态
步骤 3：执行资源回收操作 #3，验证中间状态
步骤 4：执行资源回收操作 #4，验证中间状态
步骤 5：执行资源回收操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.109 ST-021 / 功能验证 / 功能验证详细 #109（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行功能验证操作 #1，验证中间状态
步骤 2：执行功能验证操作 #2，验证中间状态
步骤 3：执行功能验证操作 #3，验证中间状态
步骤 4：执行功能验证操作 #4，验证中间状态
步骤 5：执行功能验证操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.110 ST-022 / 边界条件 / 边界条件详细 #110（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行边界条件操作 #1，验证中间状态
步骤 2：执行边界条件操作 #2，验证中间状态
步骤 3：执行边界条件操作 #3，验证中间状态
步骤 4：执行边界条件操作 #4，验证中间状态
步骤 5：执行边界条件操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.111 ST-001 / 异常处理 / 异常处理详细 #111（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异常处理操作 #1，验证中间状态
步骤 2：执行异常处理操作 #2，验证中间状态
步骤 3：执行异常处理操作 #3，验证中间状态
步骤 4：执行异常处理操作 #4，验证中间状态
步骤 5：执行异常处理操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.112 ST-002 / 并发一致性 / 并发一致性详细 #112（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行并发一致性操作 #1，验证中间状态
步骤 2：执行并发一致性操作 #2，验证中间状态
步骤 3：执行并发一致性操作 #3，验证中间状态
步骤 4：执行并发一致性操作 #4，验证中间状态
步骤 5：执行并发一致性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.113 ST-003 / 性能基线 / 性能基线详细 #113（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行性能基线操作 #1，验证中间状态
步骤 2：执行性能基线操作 #2，验证中间状态
步骤 3：执行性能基线操作 #3，验证中间状态
步骤 4：执行性能基线操作 #4，验证中间状态
步骤 5：执行性能基线操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.114 ST-004 / 安全防护 / 安全防护详细 #114（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行安全防护操作 #1，验证中间状态
步骤 2：执行安全防护操作 #2，验证中间状态
步骤 3：执行安全防护操作 #3，验证中间状态
步骤 4：执行安全防护操作 #4，验证中间状态
步骤 5：执行安全防护操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.115 ST-005 / 数据完整性 / 数据完整性详细 #115（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行数据完整性操作 #1，验证中间状态
步骤 2：执行数据完整性操作 #2，验证中间状态
步骤 3：执行数据完整性操作 #3，验证中间状态
步骤 4：执行数据完整性操作 #4，验证中间状态
步骤 5：执行数据完整性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.116 ST-006 / 审计追溯 / 审计追溯详细 #116（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行审计追溯操作 #1，验证中间状态
步骤 2：执行审计追溯操作 #2，验证中间状态
步骤 3：执行审计追溯操作 #3，验证中间状态
步骤 4：执行审计追溯操作 #4，验证中间状态
步骤 5：执行审计追溯操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.117 ST-007 / 可观测性 / 可观测性详细 #117（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行可观测性操作 #1，验证中间状态
步骤 2：执行可观测性操作 #2，验证中间状态
步骤 3：执行可观测性操作 #3，验证中间状态
步骤 4：执行可观测性操作 #4，验证中间状态
步骤 5：执行可观测性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.118 ST-008 / 错误恢复 / 错误恢复详细 #118（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行错误恢复操作 #1，验证中间状态
步骤 2：执行错误恢复操作 #2，验证中间状态
步骤 3：执行错误恢复操作 #3，验证中间状态
步骤 4：执行错误恢复操作 #4，验证中间状态
步骤 5：执行错误恢复操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.119 ST-009 / 限流控制 / 限流控制详细 #119（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行限流控制操作 #1，验证中间状态
步骤 2：执行限流控制操作 #2，验证中间状态
步骤 3：执行限流控制操作 #3，验证中间状态
步骤 4：执行限流控制操作 #4，验证中间状态
步骤 5：执行限流控制操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.120 ST-010 / 缓存命中 / 缓存命中详细 #120（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行缓存命中操作 #1，验证中间状态
步骤 2：执行缓存命中操作 #2，验证中间状态
步骤 3：执行缓存命中操作 #3，验证中间状态
步骤 4：执行缓存命中操作 #4，验证中间状态
步骤 5：执行缓存命中操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.121 ST-011 / 状态机 / 状态机详细 #121（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行状态机操作 #1，验证中间状态
步骤 2：执行状态机操作 #2，验证中间状态
步骤 3：执行状态机操作 #3，验证中间状态
步骤 4：执行状态机操作 #4，验证中间状态
步骤 5：执行状态机操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.122 ST-012 / 权限校验 / 权限校验详细 #122（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行权限校验操作 #1，验证中间状态
步骤 2：执行权限校验操作 #2，验证中间状态
步骤 3：执行权限校验操作 #3，验证中间状态
步骤 4：执行权限校验操作 #4，验证中间状态
步骤 5：执行权限校验操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.123 ST-013 / 事务回滚 / 事务回滚详细 #123（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事务回滚操作 #1，验证中间状态
步骤 2：执行事务回滚操作 #2，验证中间状态
步骤 3：执行事务回滚操作 #3，验证中间状态
步骤 4：执行事务回滚操作 #4，验证中间状态
步骤 5：执行事务回滚操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.124 ST-014 / 异步任务 / 异步任务详细 #124（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异步任务操作 #1，验证中间状态
步骤 2：执行异步任务操作 #2，验证中间状态
步骤 3：执行异步任务操作 #3，验证中间状态
步骤 4：执行异步任务操作 #4，验证中间状态
步骤 5：执行异步任务操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.125 ST-015 / 事件扇出 / 事件扇出详细 #125（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事件扇出操作 #1，验证中间状态
步骤 2：执行事件扇出操作 #2，验证中间状态
步骤 3：执行事件扇出操作 #3，验证中间状态
步骤 4：执行事件扇出操作 #4，验证中间状态
步骤 5：执行事件扇出操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.126 ST-016 / 资源回收 / 资源回收详细 #126（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行资源回收操作 #1，验证中间状态
步骤 2：执行资源回收操作 #2，验证中间状态
步骤 3：执行资源回收操作 #3，验证中间状态
步骤 4：执行资源回收操作 #4，验证中间状态
步骤 5：执行资源回收操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.127 ST-017 / 功能验证 / 功能验证详细 #127（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行功能验证操作 #1，验证中间状态
步骤 2：执行功能验证操作 #2，验证中间状态
步骤 3：执行功能验证操作 #3，验证中间状态
步骤 4：执行功能验证操作 #4，验证中间状态
步骤 5：执行功能验证操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.128 ST-018 / 边界条件 / 边界条件详细 #128（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行边界条件操作 #1，验证中间状态
步骤 2：执行边界条件操作 #2，验证中间状态
步骤 3：执行边界条件操作 #3，验证中间状态
步骤 4：执行边界条件操作 #4，验证中间状态
步骤 5：执行边界条件操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.129 ST-019 / 异常处理 / 异常处理详细 #129（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异常处理操作 #1，验证中间状态
步骤 2：执行异常处理操作 #2，验证中间状态
步骤 3：执行异常处理操作 #3，验证中间状态
步骤 4：执行异常处理操作 #4，验证中间状态
步骤 5：执行异常处理操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.130 ST-020 / 并发一致性 / 并发一致性详细 #130（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行并发一致性操作 #1，验证中间状态
步骤 2：执行并发一致性操作 #2，验证中间状态
步骤 3：执行并发一致性操作 #3，验证中间状态
步骤 4：执行并发一致性操作 #4，验证中间状态
步骤 5：执行并发一致性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.131 ST-021 / 性能基线 / 性能基线详细 #131（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行性能基线操作 #1，验证中间状态
步骤 2：执行性能基线操作 #2，验证中间状态
步骤 3：执行性能基线操作 #3，验证中间状态
步骤 4：执行性能基线操作 #4，验证中间状态
步骤 5：执行性能基线操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.132 ST-022 / 安全防护 / 安全防护详细 #132（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行安全防护操作 #1，验证中间状态
步骤 2：执行安全防护操作 #2，验证中间状态
步骤 3：执行安全防护操作 #3，验证中间状态
步骤 4：执行安全防护操作 #4，验证中间状态
步骤 5：执行安全防护操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.133 ST-001 / 数据完整性 / 数据完整性详细 #133（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行数据完整性操作 #1，验证中间状态
步骤 2：执行数据完整性操作 #2，验证中间状态
步骤 3：执行数据完整性操作 #3，验证中间状态
步骤 4：执行数据完整性操作 #4，验证中间状态
步骤 5：执行数据完整性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.134 ST-002 / 审计追溯 / 审计追溯详细 #134（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行审计追溯操作 #1，验证中间状态
步骤 2：执行审计追溯操作 #2，验证中间状态
步骤 3：执行审计追溯操作 #3，验证中间状态
步骤 4：执行审计追溯操作 #4，验证中间状态
步骤 5：执行审计追溯操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.135 ST-003 / 可观测性 / 可观测性详细 #135（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行可观测性操作 #1，验证中间状态
步骤 2：执行可观测性操作 #2，验证中间状态
步骤 3：执行可观测性操作 #3，验证中间状态
步骤 4：执行可观测性操作 #4，验证中间状态
步骤 5：执行可观测性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.136 ST-004 / 错误恢复 / 错误恢复详细 #136（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行错误恢复操作 #1，验证中间状态
步骤 2：执行错误恢复操作 #2，验证中间状态
步骤 3：执行错误恢复操作 #3，验证中间状态
步骤 4：执行错误恢复操作 #4，验证中间状态
步骤 5：执行错误恢复操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.137 ST-005 / 限流控制 / 限流控制详细 #137（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行限流控制操作 #1，验证中间状态
步骤 2：执行限流控制操作 #2，验证中间状态
步骤 3：执行限流控制操作 #3，验证中间状态
步骤 4：执行限流控制操作 #4，验证中间状态
步骤 5：执行限流控制操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.138 ST-006 / 缓存命中 / 缓存命中详细 #138（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行缓存命中操作 #1，验证中间状态
步骤 2：执行缓存命中操作 #2，验证中间状态
步骤 3：执行缓存命中操作 #3，验证中间状态
步骤 4：执行缓存命中操作 #4，验证中间状态
步骤 5：执行缓存命中操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.139 ST-007 / 状态机 / 状态机详细 #139（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行状态机操作 #1，验证中间状态
步骤 2：执行状态机操作 #2，验证中间状态
步骤 3：执行状态机操作 #3，验证中间状态
步骤 4：执行状态机操作 #4，验证中间状态
步骤 5：执行状态机操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.140 ST-008 / 权限校验 / 权限校验详细 #140（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行权限校验操作 #1，验证中间状态
步骤 2：执行权限校验操作 #2，验证中间状态
步骤 3：执行权限校验操作 #3，验证中间状态
步骤 4：执行权限校验操作 #4，验证中间状态
步骤 5：执行权限校验操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.141 ST-009 / 事务回滚 / 事务回滚详细 #141（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事务回滚操作 #1，验证中间状态
步骤 2：执行事务回滚操作 #2，验证中间状态
步骤 3：执行事务回滚操作 #3，验证中间状态
步骤 4：执行事务回滚操作 #4，验证中间状态
步骤 5：执行事务回滚操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.142 ST-010 / 异步任务 / 异步任务详细 #142（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异步任务操作 #1，验证中间状态
步骤 2：执行异步任务操作 #2，验证中间状态
步骤 3：执行异步任务操作 #3，验证中间状态
步骤 4：执行异步任务操作 #4，验证中间状态
步骤 5：执行异步任务操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.143 ST-011 / 事件扇出 / 事件扇出详细 #143（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事件扇出操作 #1，验证中间状态
步骤 2：执行事件扇出操作 #2，验证中间状态
步骤 3：执行事件扇出操作 #3，验证中间状态
步骤 4：执行事件扇出操作 #4，验证中间状态
步骤 5：执行事件扇出操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.144 ST-012 / 资源回收 / 资源回收详细 #144（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行资源回收操作 #1，验证中间状态
步骤 2：执行资源回收操作 #2，验证中间状态
步骤 3：执行资源回收操作 #3，验证中间状态
步骤 4：执行资源回收操作 #4，验证中间状态
步骤 5：执行资源回收操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.145 ST-013 / 功能验证 / 功能验证详细 #145（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行功能验证操作 #1，验证中间状态
步骤 2：执行功能验证操作 #2，验证中间状态
步骤 3：执行功能验证操作 #3，验证中间状态
步骤 4：执行功能验证操作 #4，验证中间状态
步骤 5：执行功能验证操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.146 ST-014 / 边界条件 / 边界条件详细 #146（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行边界条件操作 #1，验证中间状态
步骤 2：执行边界条件操作 #2，验证中间状态
步骤 3：执行边界条件操作 #3，验证中间状态
步骤 4：执行边界条件操作 #4，验证中间状态
步骤 5：执行边界条件操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.147 ST-015 / 异常处理 / 异常处理详细 #147（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异常处理操作 #1，验证中间状态
步骤 2：执行异常处理操作 #2，验证中间状态
步骤 3：执行异常处理操作 #3，验证中间状态
步骤 4：执行异常处理操作 #4，验证中间状态
步骤 5：执行异常处理操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.148 ST-016 / 并发一致性 / 并发一致性详细 #148（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行并发一致性操作 #1，验证中间状态
步骤 2：执行并发一致性操作 #2，验证中间状态
步骤 3：执行并发一致性操作 #3，验证中间状态
步骤 4：执行并发一致性操作 #4，验证中间状态
步骤 5：执行并发一致性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.149 ST-017 / 性能基线 / 性能基线详细 #149（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行性能基线操作 #1，验证中间状态
步骤 2：执行性能基线操作 #2，验证中间状态
步骤 3：执行性能基线操作 #3，验证中间状态
步骤 4：执行性能基线操作 #4，验证中间状态
步骤 5：执行性能基线操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.150 ST-018 / 安全防护 / 安全防护详细 #150（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行安全防护操作 #1，验证中间状态
步骤 2：执行安全防护操作 #2，验证中间状态
步骤 3：执行安全防护操作 #3，验证中间状态
步骤 4：执行安全防护操作 #4，验证中间状态
步骤 5：执行安全防护操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.151 ST-019 / 数据完整性 / 数据完整性详细 #151（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行数据完整性操作 #1，验证中间状态
步骤 2：执行数据完整性操作 #2，验证中间状态
步骤 3：执行数据完整性操作 #3，验证中间状态
步骤 4：执行数据完整性操作 #4，验证中间状态
步骤 5：执行数据完整性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.152 ST-020 / 审计追溯 / 审计追溯详细 #152（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行审计追溯操作 #1，验证中间状态
步骤 2：执行审计追溯操作 #2，验证中间状态
步骤 3：执行审计追溯操作 #3，验证中间状态
步骤 4：执行审计追溯操作 #4，验证中间状态
步骤 5：执行审计追溯操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.153 ST-021 / 可观测性 / 可观测性详细 #153（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行可观测性操作 #1，验证中间状态
步骤 2：执行可观测性操作 #2，验证中间状态
步骤 3：执行可观测性操作 #3，验证中间状态
步骤 4：执行可观测性操作 #4，验证中间状态
步骤 5：执行可观测性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.154 ST-022 / 错误恢复 / 错误恢复详细 #154（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行错误恢复操作 #1，验证中间状态
步骤 2：执行错误恢复操作 #2，验证中间状态
步骤 3：执行错误恢复操作 #3，验证中间状态
步骤 4：执行错误恢复操作 #4，验证中间状态
步骤 5：执行错误恢复操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.155 ST-001 / 限流控制 / 限流控制详细 #155（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行限流控制操作 #1，验证中间状态
步骤 2：执行限流控制操作 #2，验证中间状态
步骤 3：执行限流控制操作 #3，验证中间状态
步骤 4：执行限流控制操作 #4，验证中间状态
步骤 5：执行限流控制操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.156 ST-002 / 缓存命中 / 缓存命中详细 #156（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行缓存命中操作 #1，验证中间状态
步骤 2：执行缓存命中操作 #2，验证中间状态
步骤 3：执行缓存命中操作 #3，验证中间状态
步骤 4：执行缓存命中操作 #4，验证中间状态
步骤 5：执行缓存命中操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.157 ST-003 / 状态机 / 状态机详细 #157（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行状态机操作 #1，验证中间状态
步骤 2：执行状态机操作 #2，验证中间状态
步骤 3：执行状态机操作 #3，验证中间状态
步骤 4：执行状态机操作 #4，验证中间状态
步骤 5：执行状态机操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.158 ST-004 / 权限校验 / 权限校验详细 #158（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行权限校验操作 #1，验证中间状态
步骤 2：执行权限校验操作 #2，验证中间状态
步骤 3：执行权限校验操作 #3，验证中间状态
步骤 4：执行权限校验操作 #4，验证中间状态
步骤 5：执行权限校验操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.159 ST-005 / 事务回滚 / 事务回滚详细 #159（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事务回滚操作 #1，验证中间状态
步骤 2：执行事务回滚操作 #2，验证中间状态
步骤 3：执行事务回滚操作 #3，验证中间状态
步骤 4：执行事务回滚操作 #4，验证中间状态
步骤 5：执行事务回滚操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.160 ST-006 / 异步任务 / 异步任务详细 #160（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异步任务操作 #1，验证中间状态
步骤 2：执行异步任务操作 #2，验证中间状态
步骤 3：执行异步任务操作 #3，验证中间状态
步骤 4：执行异步任务操作 #4，验证中间状态
步骤 5：执行异步任务操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.161 ST-007 / 事件扇出 / 事件扇出详细 #161（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事件扇出操作 #1，验证中间状态
步骤 2：执行事件扇出操作 #2，验证中间状态
步骤 3：执行事件扇出操作 #3，验证中间状态
步骤 4：执行事件扇出操作 #4，验证中间状态
步骤 5：执行事件扇出操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.162 ST-008 / 资源回收 / 资源回收详细 #162（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行资源回收操作 #1，验证中间状态
步骤 2：执行资源回收操作 #2，验证中间状态
步骤 3：执行资源回收操作 #3，验证中间状态
步骤 4：执行资源回收操作 #4，验证中间状态
步骤 5：执行资源回收操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.163 ST-009 / 功能验证 / 功能验证详细 #163（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行功能验证操作 #1，验证中间状态
步骤 2：执行功能验证操作 #2，验证中间状态
步骤 3：执行功能验证操作 #3，验证中间状态
步骤 4：执行功能验证操作 #4，验证中间状态
步骤 5：执行功能验证操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.164 ST-010 / 边界条件 / 边界条件详细 #164（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行边界条件操作 #1，验证中间状态
步骤 2：执行边界条件操作 #2，验证中间状态
步骤 3：执行边界条件操作 #3，验证中间状态
步骤 4：执行边界条件操作 #4，验证中间状态
步骤 5：执行边界条件操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.165 ST-011 / 异常处理 / 异常处理详细 #165（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异常处理操作 #1，验证中间状态
步骤 2：执行异常处理操作 #2，验证中间状态
步骤 3：执行异常处理操作 #3，验证中间状态
步骤 4：执行异常处理操作 #4，验证中间状态
步骤 5：执行异常处理操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.166 ST-012 / 并发一致性 / 并发一致性详细 #166（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行并发一致性操作 #1，验证中间状态
步骤 2：执行并发一致性操作 #2，验证中间状态
步骤 3：执行并发一致性操作 #3，验证中间状态
步骤 4：执行并发一致性操作 #4，验证中间状态
步骤 5：执行并发一致性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.167 ST-013 / 性能基线 / 性能基线详细 #167（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行性能基线操作 #1，验证中间状态
步骤 2：执行性能基线操作 #2，验证中间状态
步骤 3：执行性能基线操作 #3，验证中间状态
步骤 4：执行性能基线操作 #4，验证中间状态
步骤 5：执行性能基线操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.168 ST-014 / 安全防护 / 安全防护详细 #168（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行安全防护操作 #1，验证中间状态
步骤 2：执行安全防护操作 #2，验证中间状态
步骤 3：执行安全防护操作 #3，验证中间状态
步骤 4：执行安全防护操作 #4，验证中间状态
步骤 5：执行安全防护操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.169 ST-015 / 数据完整性 / 数据完整性详细 #169（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行数据完整性操作 #1，验证中间状态
步骤 2：执行数据完整性操作 #2，验证中间状态
步骤 3：执行数据完整性操作 #3，验证中间状态
步骤 4：执行数据完整性操作 #4，验证中间状态
步骤 5：执行数据完整性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.170 ST-016 / 审计追溯 / 审计追溯详细 #170（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行审计追溯操作 #1，验证中间状态
步骤 2：执行审计追溯操作 #2，验证中间状态
步骤 3：执行审计追溯操作 #3，验证中间状态
步骤 4：执行审计追溯操作 #4，验证中间状态
步骤 5：执行审计追溯操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.171 ST-017 / 可观测性 / 可观测性详细 #171（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行可观测性操作 #1，验证中间状态
步骤 2：执行可观测性操作 #2，验证中间状态
步骤 3：执行可观测性操作 #3，验证中间状态
步骤 4：执行可观测性操作 #4，验证中间状态
步骤 5：执行可观测性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.172 ST-018 / 错误恢复 / 错误恢复详细 #172（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行错误恢复操作 #1，验证中间状态
步骤 2：执行错误恢复操作 #2，验证中间状态
步骤 3：执行错误恢复操作 #3，验证中间状态
步骤 4：执行错误恢复操作 #4，验证中间状态
步骤 5：执行错误恢复操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.173 ST-019 / 限流控制 / 限流控制详细 #173（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行限流控制操作 #1，验证中间状态
步骤 2：执行限流控制操作 #2，验证中间状态
步骤 3：执行限流控制操作 #3，验证中间状态
步骤 4：执行限流控制操作 #4，验证中间状态
步骤 5：执行限流控制操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.174 ST-020 / 缓存命中 / 缓存命中详细 #174（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行缓存命中操作 #1，验证中间状态
步骤 2：执行缓存命中操作 #2，验证中间状态
步骤 3：执行缓存命中操作 #3，验证中间状态
步骤 4：执行缓存命中操作 #4，验证中间状态
步骤 5：执行缓存命中操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.175 ST-021 / 状态机 / 状态机详细 #175（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行状态机操作 #1，验证中间状态
步骤 2：执行状态机操作 #2，验证中间状态
步骤 3：执行状态机操作 #3，验证中间状态
步骤 4：执行状态机操作 #4，验证中间状态
步骤 5：执行状态机操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.176 ST-022 / 权限校验 / 权限校验详细 #176（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行权限校验操作 #1，验证中间状态
步骤 2：执行权限校验操作 #2，验证中间状态
步骤 3：执行权限校验操作 #3，验证中间状态
步骤 4：执行权限校验操作 #4，验证中间状态
步骤 5：执行权限校验操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.177 ST-001 / 事务回滚 / 事务回滚详细 #177（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事务回滚操作 #1，验证中间状态
步骤 2：执行事务回滚操作 #2，验证中间状态
步骤 3：执行事务回滚操作 #3，验证中间状态
步骤 4：执行事务回滚操作 #4，验证中间状态
步骤 5：执行事务回滚操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.178 ST-002 / 异步任务 / 异步任务详细 #178（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异步任务操作 #1，验证中间状态
步骤 2：执行异步任务操作 #2，验证中间状态
步骤 3：执行异步任务操作 #3，验证中间状态
步骤 4：执行异步任务操作 #4，验证中间状态
步骤 5：执行异步任务操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.179 ST-003 / 事件扇出 / 事件扇出详细 #179（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事件扇出操作 #1，验证中间状态
步骤 2：执行事件扇出操作 #2，验证中间状态
步骤 3：执行事件扇出操作 #3，验证中间状态
步骤 4：执行事件扇出操作 #4，验证中间状态
步骤 5：执行事件扇出操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.180 ST-004 / 资源回收 / 资源回收详细 #180（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行资源回收操作 #1，验证中间状态
步骤 2：执行资源回收操作 #2，验证中间状态
步骤 3：执行资源回收操作 #3，验证中间状态
步骤 4：执行资源回收操作 #4，验证中间状态
步骤 5：执行资源回收操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.181 ST-005 / 功能验证 / 功能验证详细 #181（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行功能验证操作 #1，验证中间状态
步骤 2：执行功能验证操作 #2，验证中间状态
步骤 3：执行功能验证操作 #3，验证中间状态
步骤 4：执行功能验证操作 #4，验证中间状态
步骤 5：执行功能验证操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.182 ST-006 / 边界条件 / 边界条件详细 #182（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行边界条件操作 #1，验证中间状态
步骤 2：执行边界条件操作 #2，验证中间状态
步骤 3：执行边界条件操作 #3，验证中间状态
步骤 4：执行边界条件操作 #4，验证中间状态
步骤 5：执行边界条件操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.183 ST-007 / 异常处理 / 异常处理详细 #183（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异常处理操作 #1，验证中间状态
步骤 2：执行异常处理操作 #2，验证中间状态
步骤 3：执行异常处理操作 #3，验证中间状态
步骤 4：执行异常处理操作 #4，验证中间状态
步骤 5：执行异常处理操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.184 ST-008 / 并发一致性 / 并发一致性详细 #184（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行并发一致性操作 #1，验证中间状态
步骤 2：执行并发一致性操作 #2，验证中间状态
步骤 3：执行并发一致性操作 #3，验证中间状态
步骤 4：执行并发一致性操作 #4，验证中间状态
步骤 5：执行并发一致性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.185 ST-009 / 性能基线 / 性能基线详细 #185（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行性能基线操作 #1，验证中间状态
步骤 2：执行性能基线操作 #2，验证中间状态
步骤 3：执行性能基线操作 #3，验证中间状态
步骤 4：执行性能基线操作 #4，验证中间状态
步骤 5：执行性能基线操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.186 ST-010 / 安全防护 / 安全防护详细 #186（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行安全防护操作 #1，验证中间状态
步骤 2：执行安全防护操作 #2，验证中间状态
步骤 3：执行安全防护操作 #3，验证中间状态
步骤 4：执行安全防护操作 #4，验证中间状态
步骤 5：执行安全防护操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.187 ST-011 / 数据完整性 / 数据完整性详细 #187（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行数据完整性操作 #1，验证中间状态
步骤 2：执行数据完整性操作 #2，验证中间状态
步骤 3：执行数据完整性操作 #3，验证中间状态
步骤 4：执行数据完整性操作 #4，验证中间状态
步骤 5：执行数据完整性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.188 ST-012 / 审计追溯 / 审计追溯详细 #188（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行审计追溯操作 #1，验证中间状态
步骤 2：执行审计追溯操作 #2，验证中间状态
步骤 3：执行审计追溯操作 #3，验证中间状态
步骤 4：执行审计追溯操作 #4，验证中间状态
步骤 5：执行审计追溯操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.189 ST-013 / 可观测性 / 可观测性详细 #189（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行可观测性操作 #1，验证中间状态
步骤 2：执行可观测性操作 #2，验证中间状态
步骤 3：执行可观测性操作 #3，验证中间状态
步骤 4：执行可观测性操作 #4，验证中间状态
步骤 5：执行可观测性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.190 ST-014 / 错误恢复 / 错误恢复详细 #190（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行错误恢复操作 #1，验证中间状态
步骤 2：执行错误恢复操作 #2，验证中间状态
步骤 3：执行错误恢复操作 #3，验证中间状态
步骤 4：执行错误恢复操作 #4，验证中间状态
步骤 5：执行错误恢复操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.191 ST-015 / 限流控制 / 限流控制详细 #191（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行限流控制操作 #1，验证中间状态
步骤 2：执行限流控制操作 #2，验证中间状态
步骤 3：执行限流控制操作 #3，验证中间状态
步骤 4：执行限流控制操作 #4，验证中间状态
步骤 5：执行限流控制操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.192 ST-016 / 缓存命中 / 缓存命中详细 #192（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行缓存命中操作 #1，验证中间状态
步骤 2：执行缓存命中操作 #2，验证中间状态
步骤 3：执行缓存命中操作 #3，验证中间状态
步骤 4：执行缓存命中操作 #4，验证中间状态
步骤 5：执行缓存命中操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.193 ST-017 / 状态机 / 状态机详细 #193（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行状态机操作 #1，验证中间状态
步骤 2：执行状态机操作 #2，验证中间状态
步骤 3：执行状态机操作 #3，验证中间状态
步骤 4：执行状态机操作 #4，验证中间状态
步骤 5：执行状态机操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.194 ST-018 / 权限校验 / 权限校验详细 #194（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行权限校验操作 #1，验证中间状态
步骤 2：执行权限校验操作 #2，验证中间状态
步骤 3：执行权限校验操作 #3，验证中间状态
步骤 4：执行权限校验操作 #4，验证中间状态
步骤 5：执行权限校验操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.195 ST-019 / 事务回滚 / 事务回滚详细 #195（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事务回滚操作 #1，验证中间状态
步骤 2：执行事务回滚操作 #2，验证中间状态
步骤 3：执行事务回滚操作 #3，验证中间状态
步骤 4：执行事务回滚操作 #4，验证中间状态
步骤 5：执行事务回滚操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.196 ST-020 / 异步任务 / 异步任务详细 #196（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异步任务操作 #1，验证中间状态
步骤 2：执行异步任务操作 #2，验证中间状态
步骤 3：执行异步任务操作 #3，验证中间状态
步骤 4：执行异步任务操作 #4，验证中间状态
步骤 5：执行异步任务操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.197 ST-021 / 事件扇出 / 事件扇出详细 #197（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事件扇出操作 #1，验证中间状态
步骤 2：执行事件扇出操作 #2，验证中间状态
步骤 3：执行事件扇出操作 #3，验证中间状态
步骤 4：执行事件扇出操作 #4，验证中间状态
步骤 5：执行事件扇出操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.198 ST-022 / 资源回收 / 资源回收详细 #198（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行资源回收操作 #1，验证中间状态
步骤 2：执行资源回收操作 #2，验证中间状态
步骤 3：执行资源回收操作 #3，验证中间状态
步骤 4：执行资源回收操作 #4，验证中间状态
步骤 5：执行资源回收操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.199 ST-001 / 功能验证 / 功能验证详细 #199（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行功能验证操作 #1，验证中间状态
步骤 2：执行功能验证操作 #2，验证中间状态
步骤 3：执行功能验证操作 #3，验证中间状态
步骤 4：执行功能验证操作 #4，验证中间状态
步骤 5：执行功能验证操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.200 ST-002 / 边界条件 / 边界条件详细 #200（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行边界条件操作 #1，验证中间状态
步骤 2：执行边界条件操作 #2，验证中间状态
步骤 3：执行边界条件操作 #3，验证中间状态
步骤 4：执行边界条件操作 #4，验证中间状态
步骤 5：执行边界条件操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.201 ST-003 / 异常处理 / 异常处理详细 #201（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异常处理操作 #1，验证中间状态
步骤 2：执行异常处理操作 #2，验证中间状态
步骤 3：执行异常处理操作 #3，验证中间状态
步骤 4：执行异常处理操作 #4，验证中间状态
步骤 5：执行异常处理操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.202 ST-004 / 并发一致性 / 并发一致性详细 #202（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行并发一致性操作 #1，验证中间状态
步骤 2：执行并发一致性操作 #2，验证中间状态
步骤 3：执行并发一致性操作 #3，验证中间状态
步骤 4：执行并发一致性操作 #4，验证中间状态
步骤 5：执行并发一致性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.203 ST-005 / 性能基线 / 性能基线详细 #203（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行性能基线操作 #1，验证中间状态
步骤 2：执行性能基线操作 #2，验证中间状态
步骤 3：执行性能基线操作 #3，验证中间状态
步骤 4：执行性能基线操作 #4，验证中间状态
步骤 5：执行性能基线操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.204 ST-006 / 安全防护 / 安全防护详细 #204（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行安全防护操作 #1，验证中间状态
步骤 2：执行安全防护操作 #2，验证中间状态
步骤 3：执行安全防护操作 #3，验证中间状态
步骤 4：执行安全防护操作 #4，验证中间状态
步骤 5：执行安全防护操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.205 ST-007 / 数据完整性 / 数据完整性详细 #205（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行数据完整性操作 #1，验证中间状态
步骤 2：执行数据完整性操作 #2，验证中间状态
步骤 3：执行数据完整性操作 #3，验证中间状态
步骤 4：执行数据完整性操作 #4，验证中间状态
步骤 5：执行数据完整性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.206 ST-008 / 审计追溯 / 审计追溯详细 #206（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行审计追溯操作 #1，验证中间状态
步骤 2：执行审计追溯操作 #2，验证中间状态
步骤 3：执行审计追溯操作 #3，验证中间状态
步骤 4：执行审计追溯操作 #4，验证中间状态
步骤 5：执行审计追溯操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.207 ST-009 / 可观测性 / 可观测性详细 #207（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行可观测性操作 #1，验证中间状态
步骤 2：执行可观测性操作 #2，验证中间状态
步骤 3：执行可观测性操作 #3，验证中间状态
步骤 4：执行可观测性操作 #4，验证中间状态
步骤 5：执行可观测性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.208 ST-010 / 错误恢复 / 错误恢复详细 #208（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行错误恢复操作 #1，验证中间状态
步骤 2：执行错误恢复操作 #2，验证中间状态
步骤 3：执行错误恢复操作 #3，验证中间状态
步骤 4：执行错误恢复操作 #4，验证中间状态
步骤 5：执行错误恢复操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.209 ST-011 / 限流控制 / 限流控制详细 #209（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行限流控制操作 #1，验证中间状态
步骤 2：执行限流控制操作 #2，验证中间状态
步骤 3：执行限流控制操作 #3，验证中间状态
步骤 4：执行限流控制操作 #4，验证中间状态
步骤 5：执行限流控制操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.210 ST-012 / 缓存命中 / 缓存命中详细 #210（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行缓存命中操作 #1，验证中间状态
步骤 2：执行缓存命中操作 #2，验证中间状态
步骤 3：执行缓存命中操作 #3，验证中间状态
步骤 4：执行缓存命中操作 #4，验证中间状态
步骤 5：执行缓存命中操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.211 ST-013 / 状态机 / 状态机详细 #211（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行状态机操作 #1，验证中间状态
步骤 2：执行状态机操作 #2，验证中间状态
步骤 3：执行状态机操作 #3，验证中间状态
步骤 4：执行状态机操作 #4，验证中间状态
步骤 5：执行状态机操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.212 ST-014 / 权限校验 / 权限校验详细 #212（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行权限校验操作 #1，验证中间状态
步骤 2：执行权限校验操作 #2，验证中间状态
步骤 3：执行权限校验操作 #3，验证中间状态
步骤 4：执行权限校验操作 #4，验证中间状态
步骤 5：执行权限校验操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.213 ST-015 / 事务回滚 / 事务回滚详细 #213（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事务回滚操作 #1，验证中间状态
步骤 2：执行事务回滚操作 #2，验证中间状态
步骤 3：执行事务回滚操作 #3，验证中间状态
步骤 4：执行事务回滚操作 #4，验证中间状态
步骤 5：执行事务回滚操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.214 ST-016 / 异步任务 / 异步任务详细 #214（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异步任务操作 #1，验证中间状态
步骤 2：执行异步任务操作 #2，验证中间状态
步骤 3：执行异步任务操作 #3，验证中间状态
步骤 4：执行异步任务操作 #4，验证中间状态
步骤 5：执行异步任务操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.215 ST-017 / 事件扇出 / 事件扇出详细 #215（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事件扇出操作 #1，验证中间状态
步骤 2：执行事件扇出操作 #2，验证中间状态
步骤 3：执行事件扇出操作 #3，验证中间状态
步骤 4：执行事件扇出操作 #4，验证中间状态
步骤 5：执行事件扇出操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.216 ST-018 / 资源回收 / 资源回收详细 #216（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行资源回收操作 #1，验证中间状态
步骤 2：执行资源回收操作 #2，验证中间状态
步骤 3：执行资源回收操作 #3，验证中间状态
步骤 4：执行资源回收操作 #4，验证中间状态
步骤 5：执行资源回收操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.217 ST-019 / 功能验证 / 功能验证详细 #217（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行功能验证操作 #1，验证中间状态
步骤 2：执行功能验证操作 #2，验证中间状态
步骤 3：执行功能验证操作 #3，验证中间状态
步骤 4：执行功能验证操作 #4，验证中间状态
步骤 5：执行功能验证操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.218 ST-020 / 边界条件 / 边界条件详细 #218（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行边界条件操作 #1，验证中间状态
步骤 2：执行边界条件操作 #2，验证中间状态
步骤 3：执行边界条件操作 #3，验证中间状态
步骤 4：执行边界条件操作 #4，验证中间状态
步骤 5：执行边界条件操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.219 ST-021 / 异常处理 / 异常处理详细 #219（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异常处理操作 #1，验证中间状态
步骤 2：执行异常处理操作 #2，验证中间状态
步骤 3：执行异常处理操作 #3，验证中间状态
步骤 4：执行异常处理操作 #4，验证中间状态
步骤 5：执行异常处理操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.220 ST-022 / 并发一致性 / 并发一致性详细 #220（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行并发一致性操作 #1，验证中间状态
步骤 2：执行并发一致性操作 #2，验证中间状态
步骤 3：执行并发一致性操作 #3，验证中间状态
步骤 4：执行并发一致性操作 #4，验证中间状态
步骤 5：执行并发一致性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.221 ST-001 / 性能基线 / 性能基线详细 #221（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行性能基线操作 #1，验证中间状态
步骤 2：执行性能基线操作 #2，验证中间状态
步骤 3：执行性能基线操作 #3，验证中间状态
步骤 4：执行性能基线操作 #4，验证中间状态
步骤 5：执行性能基线操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.222 ST-002 / 安全防护 / 安全防护详细 #222（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行安全防护操作 #1，验证中间状态
步骤 2：执行安全防护操作 #2，验证中间状态
步骤 3：执行安全防护操作 #3，验证中间状态
步骤 4：执行安全防护操作 #4，验证中间状态
步骤 5：执行安全防护操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.223 ST-003 / 数据完整性 / 数据完整性详细 #223（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行数据完整性操作 #1，验证中间状态
步骤 2：执行数据完整性操作 #2，验证中间状态
步骤 3：执行数据完整性操作 #3，验证中间状态
步骤 4：执行数据完整性操作 #4，验证中间状态
步骤 5：执行数据完整性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.224 ST-004 / 审计追溯 / 审计追溯详细 #224（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行审计追溯操作 #1，验证中间状态
步骤 2：执行审计追溯操作 #2，验证中间状态
步骤 3：执行审计追溯操作 #3，验证中间状态
步骤 4：执行审计追溯操作 #4，验证中间状态
步骤 5：执行审计追溯操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.225 ST-005 / 可观测性 / 可观测性详细 #225（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行可观测性操作 #1，验证中间状态
步骤 2：执行可观测性操作 #2，验证中间状态
步骤 3：执行可观测性操作 #3，验证中间状态
步骤 4：执行可观测性操作 #4，验证中间状态
步骤 5：执行可观测性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.226 ST-006 / 错误恢复 / 错误恢复详细 #226（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行错误恢复操作 #1，验证中间状态
步骤 2：执行错误恢复操作 #2，验证中间状态
步骤 3：执行错误恢复操作 #3，验证中间状态
步骤 4：执行错误恢复操作 #4，验证中间状态
步骤 5：执行错误恢复操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.227 ST-007 / 限流控制 / 限流控制详细 #227（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行限流控制操作 #1，验证中间状态
步骤 2：执行限流控制操作 #2，验证中间状态
步骤 3：执行限流控制操作 #3，验证中间状态
步骤 4：执行限流控制操作 #4，验证中间状态
步骤 5：执行限流控制操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.228 ST-008 / 缓存命中 / 缓存命中详细 #228（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行缓存命中操作 #1，验证中间状态
步骤 2：执行缓存命中操作 #2，验证中间状态
步骤 3：执行缓存命中操作 #3，验证中间状态
步骤 4：执行缓存命中操作 #4，验证中间状态
步骤 5：执行缓存命中操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.229 ST-009 / 状态机 / 状态机详细 #229（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行状态机操作 #1，验证中间状态
步骤 2：执行状态机操作 #2，验证中间状态
步骤 3：执行状态机操作 #3，验证中间状态
步骤 4：执行状态机操作 #4，验证中间状态
步骤 5：执行状态机操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.230 ST-010 / 权限校验 / 权限校验详细 #230（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行权限校验操作 #1，验证中间状态
步骤 2：执行权限校验操作 #2，验证中间状态
步骤 3：执行权限校验操作 #3，验证中间状态
步骤 4：执行权限校验操作 #4，验证中间状态
步骤 5：执行权限校验操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.231 ST-011 / 事务回滚 / 事务回滚详细 #231（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事务回滚操作 #1，验证中间状态
步骤 2：执行事务回滚操作 #2，验证中间状态
步骤 3：执行事务回滚操作 #3，验证中间状态
步骤 4：执行事务回滚操作 #4，验证中间状态
步骤 5：执行事务回滚操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.232 ST-012 / 异步任务 / 异步任务详细 #232（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异步任务操作 #1，验证中间状态
步骤 2：执行异步任务操作 #2，验证中间状态
步骤 3：执行异步任务操作 #3，验证中间状态
步骤 4：执行异步任务操作 #4，验证中间状态
步骤 5：执行异步任务操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.233 ST-013 / 事件扇出 / 事件扇出详细 #233（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事件扇出操作 #1，验证中间状态
步骤 2：执行事件扇出操作 #2，验证中间状态
步骤 3：执行事件扇出操作 #3，验证中间状态
步骤 4：执行事件扇出操作 #4，验证中间状态
步骤 5：执行事件扇出操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.234 ST-014 / 资源回收 / 资源回收详细 #234（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行资源回收操作 #1，验证中间状态
步骤 2：执行资源回收操作 #2，验证中间状态
步骤 3：执行资源回收操作 #3，验证中间状态
步骤 4：执行资源回收操作 #4，验证中间状态
步骤 5：执行资源回收操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.235 ST-015 / 功能验证 / 功能验证详细 #235（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行功能验证操作 #1，验证中间状态
步骤 2：执行功能验证操作 #2，验证中间状态
步骤 3：执行功能验证操作 #3，验证中间状态
步骤 4：执行功能验证操作 #4，验证中间状态
步骤 5：执行功能验证操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.236 ST-016 / 边界条件 / 边界条件详细 #236（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行边界条件操作 #1，验证中间状态
步骤 2：执行边界条件操作 #2，验证中间状态
步骤 3：执行边界条件操作 #3，验证中间状态
步骤 4：执行边界条件操作 #4，验证中间状态
步骤 5：执行边界条件操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.237 ST-017 / 异常处理 / 异常处理详细 #237（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异常处理操作 #1，验证中间状态
步骤 2：执行异常处理操作 #2，验证中间状态
步骤 3：执行异常处理操作 #3，验证中间状态
步骤 4：执行异常处理操作 #4，验证中间状态
步骤 5：执行异常处理操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.238 ST-018 / 并发一致性 / 并发一致性详细 #238（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行并发一致性操作 #1，验证中间状态
步骤 2：执行并发一致性操作 #2，验证中间状态
步骤 3：执行并发一致性操作 #3，验证中间状态
步骤 4：执行并发一致性操作 #4，验证中间状态
步骤 5：执行并发一致性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.239 ST-019 / 性能基线 / 性能基线详细 #239（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行性能基线操作 #1，验证中间状态
步骤 2：执行性能基线操作 #2，验证中间状态
步骤 3：执行性能基线操作 #3，验证中间状态
步骤 4：执行性能基线操作 #4，验证中间状态
步骤 5：执行性能基线操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.240 ST-020 / 安全防护 / 安全防护详细 #240（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行安全防护操作 #1，验证中间状态
步骤 2：执行安全防护操作 #2，验证中间状态
步骤 3：执行安全防护操作 #3，验证中间状态
步骤 4：执行安全防护操作 #4，验证中间状态
步骤 5：执行安全防护操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.241 ST-021 / 数据完整性 / 数据完整性详细 #241（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行数据完整性操作 #1，验证中间状态
步骤 2：执行数据完整性操作 #2，验证中间状态
步骤 3：执行数据完整性操作 #3，验证中间状态
步骤 4：执行数据完整性操作 #4，验证中间状态
步骤 5：执行数据完整性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.242 ST-022 / 审计追溯 / 审计追溯详细 #242（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行审计追溯操作 #1，验证中间状态
步骤 2：执行审计追溯操作 #2，验证中间状态
步骤 3：执行审计追溯操作 #3，验证中间状态
步骤 4：执行审计追溯操作 #4，验证中间状态
步骤 5：执行审计追溯操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.243 ST-001 / 可观测性 / 可观测性详细 #243（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行可观测性操作 #1，验证中间状态
步骤 2：执行可观测性操作 #2，验证中间状态
步骤 3：执行可观测性操作 #3，验证中间状态
步骤 4：执行可观测性操作 #4，验证中间状态
步骤 5：执行可观测性操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.244 ST-002 / 错误恢复 / 错误恢复详细 #244（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行错误恢复操作 #1，验证中间状态
步骤 2：执行错误恢复操作 #2，验证中间状态
步骤 3：执行错误恢复操作 #3，验证中间状态
步骤 4：执行错误恢复操作 #4，验证中间状态
步骤 5：执行错误恢复操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.245 ST-003 / 限流控制 / 限流控制详细 #245（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行限流控制操作 #1，验证中间状态
步骤 2：执行限流控制操作 #2，验证中间状态
步骤 3：执行限流控制操作 #3，验证中间状态
步骤 4：执行限流控制操作 #4，验证中间状态
步骤 5：执行限流控制操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.246 ST-004 / 缓存命中 / 缓存命中详细 #246（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行缓存命中操作 #1，验证中间状态
步骤 2：执行缓存命中操作 #2，验证中间状态
步骤 3：执行缓存命中操作 #3，验证中间状态
步骤 4：执行缓存命中操作 #4，验证中间状态
步骤 5：执行缓存命中操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.247 ST-005 / 状态机 / 状态机详细 #247（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行状态机操作 #1，验证中间状态
步骤 2：执行状态机操作 #2，验证中间状态
步骤 3：执行状态机操作 #3，验证中间状态
步骤 4：执行状态机操作 #4，验证中间状态
步骤 5：执行状态机操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.248 ST-006 / 权限校验 / 权限校验详细 #248（P1）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行权限校验操作 #1，验证中间状态
步骤 2：执行权限校验操作 #2，验证中间状态
步骤 3：执行权限校验操作 #3，验证中间状态
步骤 4：执行权限校验操作 #4，验证中间状态
步骤 5：执行权限校验操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.249 ST-007 / 事务回滚 / 事务回滚详细 #249（P2）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行事务回滚操作 #1，验证中间状态
步骤 2：执行事务回滚操作 #2，验证中间状态
步骤 3：执行事务回滚操作 #3，验证中间状态
步骤 4：执行事务回滚操作 #4，验证中间状态
步骤 5：执行事务回滚操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  


### R.250 ST-008 / 异步任务 / 异步任务详细 #250（P0）

**Setup**：准备数据：seed 100 实体，配置 mock 时间、mock 网络  

**Steps**：
步骤 1：执行异步任务操作 #1，验证中间状态
步骤 2：执行异步任务操作 #2，验证中间状态
步骤 3：执行异步任务操作 #3，验证中间状态
步骤 4：执行异步任务操作 #4，验证中间状态
步骤 5：执行异步任务操作 #5，验证中间状态  

**Expected**：预期：HTTP 200，body 含完整字段，性能 P95 ≤ 200ms，错误率 = 0，内存 < 100MB  

**Cleanup**：清理：resetAllRepositories()，停止 k6 进程  
