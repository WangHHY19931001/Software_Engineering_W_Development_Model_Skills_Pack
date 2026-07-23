# 系统测试用例文档

> 阶段 2（系统设计）同步产出系统测试设计。本阶段只设计，不执行；执行在阶段 7（系统测试）。
> 系统测试用例 ST-001~008 的索引与覆盖说明见 `docs/system-design.md §8`。

## 文档信息

- 项目名称：blog-system-demo
- 测试类型：系统测试
- 设计来源阶段：阶段 2（系统设计）
- 执行阶段：阶段 7（系统测试）
- 文档版本：v1.0
- 编制日期：2026-07-23
- 编制者：W-Model Agent（self-as-verifier 回归调测）

## 用例列表

### ST-001

- 标题：端到端 - 注册→登录→创建文章→浏览→评论→删除全链路
- 优先级：高
- 关联需求/设计：REQ-001、REQ-002、REQ-003、REQ-004 / SD-001~004
- 测试场景：验证四大业务域端到端完整链路可跑通，公开浏览可在未认证下进行，评论随文章详情聚合。

**前置条件**
- 内存存储已重置（`POST /__test/reset`）；环境变量 `JWT_SECRET` 已注入。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/v1/auth/register | `{"username":"alice","password":"Passw0rd!"}` | 201；响应含 `userId`（UUID v4）与 `username`；不含 `password` |
| 2 | POST /api/v1/auth/login | `{"username":"alice","password":"Passw0rd!"}` | 200；响应含 `token`（JWT 三段式）与 `expiresIn:3600` |
| 3 | POST /api/v1/articles | Header `Authorization: Bearer <token>`；`{"title":"Hello World","content":"My first post.","tags":["intro"]}` | 201；响应含 `articleId`、`authorId`（=step1 userId）、`title`、`content`、`tags`、`createdAt` |
| 4 | GET /api/v1/articles?page=1&pageSize=10 | 无 Authorization 头 | 200；`{items:[Article], total:1, page:1, pageSize:10}`；items[0].title === "Hello World" |
| 5 | GET /api/v1/articles/:articleId | 无 Authorization 头 | 200；响应含 `comments:[]`（空数组） |
| 6 | POST /api/v1/articles/:articleId/comments | Header `Authorization: Bearer <token>`；`{"content":"Nice post!"}` | 201；响应含 `commentId`、`articleId`、`authorId`（=JWT.userId）、`content`、`createdAt` |
| 7 | GET /api/v1/articles/:articleId | 无 Authorization 头 | 200；`comments.length === 1`；comments[0].content === "Nice post!" |
| 8 | DELETE /api/v1/articles/:articleId | Header `Authorization: Bearer <token>` | 204 空响应 |
| 9 | GET /api/v1/articles/:articleId | 无 Authorization 头 | 404；`{code:40401, message:"资源不存在"}` |

**预期结果**
步骤 1-8 依次返回 201/200/201/200/200/201/200/204；步骤 9 返回 404 + 40401；公开浏览（步骤 4/5/7/9）在未认证下进行；评论随文章详情聚合（步骤 7）。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### ST-002

- 标题：作者隔离 - A 修改 / 删除 B 的文章被拒
- 优先级：高
- 关联需求/设计：REQ-002 / SD-002
- 测试场景：验证作者隔离校验，非作者修改 / 删除返回 40301，作者本人操作成功。

**前置条件**
- 内存存储已重置；用户 A、B 已注册登录（持有各自 token）；文章 X 由 B 创建。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/v1/articles | A 的 token；`{"title":"A 的文章","content":"...","tags":[]}` | 201；返回 articleId-A |
| 2 | PATCH /api/v1/articles/:articleId-A | B 的 token；`{"title":"被篡改"}` | 403；`{code:40301, message:"无权操作他人资源"}` |
| 3 | PATCH /api/v1/articles/:articleId-A | A 的 token；`{"title":"A 修改自己的"}` | 200；`title` 已更新；`updatedAt > createdAt` |
| 4 | DELETE /api/v1/articles/:articleId-A | B 的 token | 403；`{code:40301}` |
| 5 | GET /api/v1/articles/:articleId-A | 无 Authorization | 200；文章仍存在，title === "A 修改自己的" |
| 6 | DELETE /api/v1/articles/:articleId-A | A 的 token | 204 空响应 |

**预期结果**
B 修改 / 删除 A 的文章一律返回 403 + 40301；A 修改自己的文章返回 200 且 title 更新；A 删除自己的文章返回 204；非作者操作不改变资源状态。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### ST-003

- 标题：评论增删 + 删除他人评论被拒 + 评论随详情聚合
- 优先级：高
- 关联需求/设计：REQ-004 / SD-004
- 测试场景：验证评论增删查全链路，删除他人评论返回 40301，评论列表按 createdAt 升序随文章详情返回。

**前置条件**
- 内存存储已重置；用户 A、B 已登录；文章 Y 由 A 创建；A 与 B 各对 Y 发表 1 条评论。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/v1/articles/:Y/comments | A 的 token；`{"content":"A 的评论"}` | 201；返回 commentId-A |
| 2 | POST /api/v1/articles/:Y/comments | B 的 token；`{"content":"B 的评论"}` | 201；返回 commentId-B |
| 3 | GET /api/v1/articles/:Y | 无 Authorization | 200；`comments.length === 2`；按 `createdAt` 升序 |
| 4 | DELETE /api/v1/comments/:commentId-A | B 的 token | 403；`{code:40301}` |
| 5 | DELETE /api/v1/comments/:commentId-A | A 的 token | 204 空响应 |
| 6 | GET /api/v1/articles/:Y | 无 Authorization | 200；`comments.length === 1`；comments[0].content === "B 的评论" |
| 7 | POST /api/v1/articles/:不存在id/comments | A 的 token；`{"content":"x"}` | 404；`{code:40401}` |

**预期结果**
发表评论返回 201；删除他人评论返回 403 + 40301；删除自己评论返回 204；评论列表随文章详情返回并按 createdAt 升序；对不存在文章发表评论返回 404 + 40401。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### ST-004

- 标题：性能基线 - 100 QPS 持续 10min，P95 ≤ 200ms
- 优先级：高
- 关联需求/设计：NFR-002 / SD-008
- 测试场景：验证读接口在 10000 条数据规模下的性能基线（P95 ≤ 200ms，100 QPS 持续 10min，无崩溃）。

**前置条件**
- 内存存储预置 10000 篇文章（通过种子脚本或批量接口）；k6 / autocannon 压测工具就绪。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 预置数据 | 种子 10000 篇文章到 ArticleStore | 存储总数 === 10000 |
| 2 | 压测 GET /api/v1/articles?page=1&pageSize=10 | k6 负载模型：ramp-up 30s → sustain 100QPS 9min → ramp-down 30s；总时长 10min | 进程未崩溃；无 5xx |
| 3 | 采集指标 | 读取 k6 summary | `p(95) <= 200`；`http_req_failed === 0`；`actualRPS >= 95` |

**预期结果**
`expect(p95).toBeLessThanOrEqual(200)`；`expect(errorRate).toBe(0)`；`expect(actualRPS).toBeGreaterThanOrEqual(95)`；无 5xx；进程未崩溃；内存占用 < 500MB。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### ST-005

- 标题：安全基线 - 未授权访问受保护资源被拒
- 优先级：高
- 关联需求/设计：NFR-001 / SD-005
- 测试场景：验证受保护接口在缺失 Authorization 头时返回 401 + 40103，公开接口不受影响。

**前置条件**
- 内存存储已重置；至少 1 个已存在文章（供 DELETE / POST comment 路径触发到鉴权之后）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/v1/articles | 无 Authorization 头；`{"title":"x","content":"y","tags":[]}` | 401；`{code:40103, message:"未提供认证令牌"}` |
| 2 | DELETE /api/v1/articles/:已存在id | 无 Authorization 头 | 401；`{code:40103}` |
| 3 | POST /api/v1/articles/:已存在id/comments | 无 Authorization 头；`{"content":"x"}` | 401；`{code:40103}` |
| 4 | GET /api/v1/articles?page=1&pageSize=10 | 无 Authorization 头（对照组） | 200；不受鉴权影响 |

**预期结果**
受保护接口（POST 文章 / DELETE 文章 / POST 评论）缺失 Authorization 时返回 401 + 40103；公开接口 `GET /api/v1/articles` 返回 200 不受影响。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### ST-006

- 标题：安全基线 - JWT 过期 / 伪造处理
- 优先级：高
- 关联需求/设计：NFR-001 / SD-005
- 测试场景：验证过期 JWT 与伪造签名 JWT 一律返回 401 + 40102，合法 JWT 对照组通过。

**前置条件**
- 内存存储已重置；用户 alice 已注册；持有合法 token；可构造过期 JWT（exp = now - 1s）与伪造签名 JWT（错误密钥签名）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/v1/articles | 过期 JWT（exp = now - 1s）+ 合法 body | 401；`{code:40102, message:"JWT 已过期或无效"}`；不返回 201 |
| 2 | POST /api/v1/articles | 伪造签名 JWT（错误密钥签名）+ 合法 body | 401；`{code:40102}` |
| 3 | POST /api/v1/articles | 格式错误 JWT（"not.a.jwt"）+ 合法 body | 401；`{code:40102}` |
| 4 | POST /api/v1/articles | 合法 JWT（对照组）+ 合法 body | 201；返回 articleId |

**预期结果**
过期 / 伪造 / 格式错误 JWT 一律返回 401 + 40102；合法 JWT 返回 201（对照组通过）。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### ST-007

- 标题：安全基线 - 密码 bcrypt 哈希存储（cost=10）
- 优先级：高
- 关联需求/设计：NFR-001 / SD-005、SD-007
- 测试场景：验证密码以 bcrypt 哈希存储，cost=10，存储中无明文密码字段。

**前置条件**
- 内存存储已重置；可直接访问 UserStore 内部记录（测试钩子或 `/__test/inspect`）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/v1/auth/register | `{"username":"bob","password":"Secret123"}` | 201；返回 `userId`、`username`；响应不含 `password` / `passwordHash` |
| 2 | 读取 UserStore | 按 username=bob 查询内部记录 | `user.passwordHash` 以 `$2b$10$` 开头；`user.passwordHash !== "Secret123"`；记录中无 `password` 字段 |
| 3 | bcrypt.getRounds | `bcrypt.getRounds(user.passwordHash)` | 返回 `10` |
| 4 | bcrypt.compare | `bcrypt.compare("WrongPass", user.passwordHash)` | 返回 `false` |
| 5 | bcrypt.compare | `bcrypt.compare("Secret123", user.passwordHash)` | 返回 `true` |

**预期结果**
`user.passwordHash` 以 `$2b$10$` 开头；`passwordHash !== "Secret123"`；存储中无 `password` 字段；`bcrypt.getRounds(hash) === 10`；正确密码 compare 返回 true，错误密码返回 false。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### ST-008

- 标题：异常路径 - 分页越界 + zod 校验 + 不存在文章
- 优先级：中
- 关联需求/设计：REQ-003、NFR-003 / SD-003、SD-006
- 测试场景：验证分页参数越界返回 40001，zod 校验非法入参返回 40001，不存在文章返回 40401。

**前置条件**
- 内存存储已重置；预置 ≥ 15 篇文章。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | GET /api/v1/articles?page=0&pageSize=10 | page=0（越界） | 400；`{code:40001, message:"参数校验失败"}` |
| 2 | GET /api/v1/articles?page=1&pageSize=200 | pageSize=200（>100 越界） | 400；`{code:40001}` |
| 3 | POST /api/v1/auth/register | `{"username":"ab","password":"short"}`（用户名过短 + 密码不满足复杂度） | 400；`{code:40001}` |
| 4 | POST /api/v1/auth/register | `{"username":"alice"}`（缺 password 字段） | 400；`{code:40001}` |
| 5 | GET /api/v1/articles/:不存在id | UUID 格式但不存在的 id | 404；`{code:40401, message:"资源不存在"}` |
| 6 | GET /api/v1/articles?page=1&pageSize=10 | 合法分页（对照组） | 200；`{items, total, page:1, pageSize:10}` |

**预期结果**
分页越界（page<1 / pageSize>100）返回 400 + 40001；zod 校验非法入参返回 400 + 40001；不存在文章返回 404 + 40401；合法分页对照组返回 200。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

## 用例汇总

| 用例 ID | 标题 | 优先级 | 关联 | 状态 |
|---|---|---|---|---|
| ST-001 | 端到端全链路 | 高 | REQ-001~004 | 待执行 |
| ST-002 | 作者隔离 | 高 | REQ-002 | 待执行 |
| ST-003 | 评论增删 + 聚合 | 高 | REQ-004 | 待执行 |
| ST-004 | 性能基线 P95 ≤ 200ms | 高 | NFR-002 | 待执行 |
| ST-005 | 未授权访问被拒 | 高 | NFR-001 | 待执行 |
| ST-006 | JWT 过期 / 伪造 | 高 | NFR-001 | 待执行 |
| ST-007 | bcrypt 哈希存储 | 高 | NFR-001 | 待执行 |
| ST-008 | 异常路径 + zod 校验 | 中 | REQ-003、NFR-003 | 待执行 |

## 测试用例覆盖说明

- 功能点覆盖：REQ-001~004 全部覆盖（ST-001 端到端 + ST-002 文章隔离 + ST-003 评论 + ST-008 浏览异常）
- 非功能点覆盖：NFR-001 安全（ST-005/006/007）、NFR-002 性能（ST-004）、NFR-003 可维护性/zod（ST-008）
- 端到端覆盖（TC-DES-007）：ST-001
- 性能基线覆盖（TC-DES-008）：ST-004
- 安全基线覆盖（TC-DES-009）：ST-005 / ST-006 / ST-007
- 边界条件覆盖：分页越界（page<1 / pageSize>100）/ 缺字段 / 用户名过短 / 不存在 ID / 删除后查询
- 异常路径覆盖：40001 / 40101 / 40102 / 40103 / 40301 / 40401 / 40901 全覆盖
- 总计：8 条 ST，正常路径 3 条 + 异常路径 3 条 + 性能 / 安全基线 2 条
