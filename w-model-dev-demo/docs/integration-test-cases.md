# 集成测试用例文档

> 阶段 3（概要设计）同步产出集成测试设计；执行在阶段 6（集成测试）。
> 覆盖模块间交互：auth×article、article×comment、controller×service×store、middleware×controller、错误路径等。

## 文档信息

- 项目名称：blog-system-demo
- 测试类型：集成测试
- 设计来源阶段：阶段 3（概要设计）
- 执行阶段：阶段 6（集成测试）
- 文档版本：v1.0
- 关联设计：`docs/outline-design.md`（INTF-001~012 接口契约）
- 关联系统设计：`docs/system-design.md`（SD-001~008 模块）

## 用例列表

### IT-001

- 标题：注册→登录全链路
- 优先级：高
- 关联需求/设计：REQ-001 / SD-001, INTF-001, INTF-004, INTF-005, INTF-010
- 测试场景：验证 authService×userStore×passwordHasher×jwtService 跨模块协作，注册后可登录并返回 JWT

**前置条件**
服务已启动（JWT_SECRET 环境变量已设置）；userStore 内存为空。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/v1/auth/register | `{"username":"alice","password":"Passw0rd!"}` | HTTP 201；响应含 userId(UUID v4) 与 username；不含 password |
| 2 | 读取 userStore 内部记录 | step1 返回的 userId | 记录存在；passwordHash 以 $2b$10$ 开头；无 password 明文字段 |
| 3 | POST /api/v1/auth/login | `{"username":"alice","password":"Passw0rd!"}` | HTTP 200；响应含 token(JWT 三段式)与 expiresIn:3600 |
| 4 | 解码 step3 返回 token | jwtService.verify(token) | payload.userId === step1.userId；exp - iat === 3600 |

**预期结果**
注册成功写入 userStore（passwordHash 为 bcrypt 格式），登录返回合法 JWT（HS256，exp=iat+3600），userId 端到端一致。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### IT-002

- 标题：重复注册→40901
- 优先级：高
- 关联需求/设计：REQ-001 / SD-001, INTF-001, INTF-010, INTF-008
- 测试场景：验证 authService×userStore×errorHandler 重复用户名冲突路径，返回 40901

**前置条件**
服务已启动；userStore 已存在 username=bob 的记录。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/v1/auth/register | `{"username":"bob","password":"Passw0rd!"}` | HTTP 409；响应 `{code:40901, message:"用户名已存在"}` |
| 2 | 读取 userStore | — | 仍只有 1 条 bob 记录（无重复写入） |

**预期结果**
重复注册被 userStore.findByUsername 查重拦截，authService 抛 ConflictError(40901)，errorHandler 序列化为 409 响应；存储无重复记录。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### IT-003

- 标题：登录密码错误→40101
- 优先级：高
- 关联需求/设计：REQ-001 / SD-001, INTF-001, INTF-004, INTF-008
- 测试场景：验证 authService×passwordHasher×errorHandler 错误密码路径，返回 40101 且不泄露用户名是否存在

**前置条件**
服务已启动；userStore 存在 username=alice（密码 Passw0rd!）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/v1/auth/login | `{"username":"alice","password":"WrongPass"}` | HTTP 401；响应 `{code:40101, message:"用户名或密码错误"}`；不含 token |
| 2 | POST /api/v1/auth/login | `{"username":"nobody","password":"WrongPass"}` | HTTP 401；响应 `{code:40101, message:"用户名或密码错误"}`（与 step1 文案一致，不区分用户名不存在） |

**预期结果**
passwordHasher.compare 返回 false，authService 抛 UnauthorizedError(40101)；不存在的用户名与错误密码返回相同文案（安全：不泄露用户名存在性）。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### IT-004

- 标题：创建文章全链路
- 优先级：高
- 关联需求/设计：REQ-002 / SD-002, INTF-006, INTF-002, INTF-011
- 测试场景：验证 authMiddleware×articleService×articleStore 受保护接口全链路，JWT 鉴权后写入文章

**前置条件**
服务已启动；已注册 alice 并获取合法 JWT。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/v1/articles | Header: `Authorization: Bearer <alice-token>`；Body: `{"title":"Hello World","content":"My first post.","tags":["intro"]}` | HTTP 201；响应含 articleId(UUID v4)、authorId(=JWT.userId)、title、content、tags、createdAt |
| 2 | 读取 articleStore | step1 返回 articleId | 记录存在；authorId === JWT.userId；createdAt 非空 |
| 3 | GET /api/v1/articles/:id | step1 返回 articleId（无 Authorization） | HTTP 200；返回文章详情，title/content/tags 与 step1 一致 |

**预期结果**
authMiddleware 提取 Bearer token 调用 jwtService.verify 解码 {userId,username} 注入 req.user；articleService.create 用 req.user.userId 作为 authorId 写入 articleStore；公开 GET 可读回。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### IT-005

- 标题：作者隔离-非作者修改/删除→40301
- 优先级：高
- 关联需求/设计：REQ-002 / SD-002, INTF-006, INTF-002, INTF-008
- 测试场景：验证 authMiddleware×articleService×errorHandler 作者隔离校验，非作者操作返回 40301

**前置条件**
服务已启动；alice 与 bob 均已注册并登录；alice 拥有文章 A。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | PUT /api/v1/articles/:A | Header: `Authorization: Bearer <bob-token>`；Body: `{"title":"Hacked"}` | HTTP 403；响应 `{code:40301, message:"非作者，无权操作"}` |
| 2 | DELETE /api/v1/articles/:A | Header: `Authorization: Bearer <bob-token>` | HTTP 403；响应 `{code:40301}` |
| 3 | GET /api/v1/articles/:A | 无 Authorization | HTTP 200；文章仍存在，title 仍为原值（未被篡改） |

**预期结果**
articleService.update/delete 校验 article.authorId !== req.user.userId 时抛 ForbiddenError(40301)；errorHandler 序列化为 403；文章未被修改/删除。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### IT-006

- 标题：公开浏览列表+分页
- 优先级：高
- 关联需求/设计：REQ-003 / SD-003, INTF-002, INTF-011
- 测试场景：验证 articleService×articleStore 公开列表分页，未认证可访问且分页结构正确

**前置条件**
服务已启动；articleStore 预置 ≥15 篇文章（不同 createdAt）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | GET /api/v1/articles?page=1&pageSize=10 | 无 Authorization | HTTP 200；`{items:Article[10], total:≥15, page:1, pageSize:10}`；items 按 createdAt 降序 |
| 2 | GET /api/v1/articles?page=2&pageSize=10 | 无 Authorization | HTTP 200；items.length = total - 10 |
| 3 | GET /api/v1/articles?page=1&pageSize=100 | 无 Authorization | HTTP 200；items.length = total（pageSize 上限 100） |

**预期结果**
articleService.list 默认 page=1/pageSize=10，返回 {items,total,page,pageSize}；无 Authorization 也可访问（公开）；按 createdAt 降序。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### IT-007

- 标题：文章详情+评论聚合
- 优先级：高
- 关联需求/设计：REQ-003, REQ-004 / SD-003, SD-004, INTF-002, INTF-003, INTF-011, INTF-012
- 测试场景：验证 articleService×commentService×stores 跨模块聚合，文章详情含评论列表

**前置条件**
服务已启动；存在文章 A，A 下有 ≥2 条评论（不同 createdAt）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | GET /api/v1/articles/:A | 无 Authorization | HTTP 200；响应含 article 字段 + comments:Comment[] |
| 2 | 校验 comments 字段 | step1 响应 | comments.length >= 2；每条含 commentId/articleId(=A)/authorId/content/createdAt |
| 3 | 校验 comments 排序 | step1 响应 | comments 按 createdAt 升序排列 |

**预期结果**
articleService.getById 调用 articleStore.findById 取文章，再调用 commentService.listByArticle → commentStore.findByArticleId 聚合评论；评论按 createdAt 升序返回。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### IT-008

- 标题：发表评论+文章存在性校验
- 优先级：高
- 关联需求/设计：REQ-004 / SD-004, SD-002, INTF-006, INTF-003, INTF-002, INTF-012
- 测试场景：验证 authMiddleware×commentService×articleService 跨域调用，评论创建前校验文章存在

**前置条件**
服务已启动；alice 已登录；存在文章 A。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/v1/articles/:A/comments | Header: `Authorization: Bearer <alice-token>`；Body: `{"content":"Nice post!"}` | HTTP 201；响应含 commentId、articleId(=A)、authorId(=JWT.userId)、content、createdAt |
| 2 | 读取 commentStore | step1 返回 commentId | 记录存在；articleId === A；authorId === JWT.userId |
| 3 | GET /api/v1/articles/:A | 无 Authorization | HTTP 200；comments 字段含 step1 创建的评论 |

**预期结果**
authMiddleware 鉴权后 commentService.create 调用 articleService.getById（或存在性校验）确认文章 A 存在，再写入 commentStore；authorId 来自 JWT 不来自 body。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### IT-009

- 标题：删除评论-作者隔离→40301
- 优先级：高
- 关联需求/设计：REQ-004 / SD-004, INTF-006, INTF-003, INTF-008
- 测试场景：验证 authMiddleware×commentService×errorHandler 评论作者隔离，非作者删除返回 40301

**前置条件**
服务已启动；alice 与 bob 均登录；alice 拥有评论 C（在文章 A 下）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | DELETE /api/v1/comments/:C | Header: `Authorization: Bearer <bob-token>` | HTTP 403；响应 `{code:40301, message:"非作者，无权操作"}` |
| 2 | GET /api/v1/articles/:A | 无 Authorization | HTTP 200；comments 仍含评论 C（未被删除） |
| 3 | DELETE /api/v1/comments/:C | Header: `Authorization: Bearer <alice-token>` | HTTP 204；空响应 |
| 4 | GET /api/v1/articles/:A | 无 Authorization | HTTP 200；comments 不再含 C |

**预期结果**
commentService.delete 校验 comment.authorId !== req.user.userId 抛 ForbiddenError(40301)；作者本人删除返回 204。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### IT-010

- 标题：评论对不存在文章→40401
- 优先级：中
- 关联需求/设计：REQ-004 / SD-004, SD-002, INTF-003, INTF-002, INTF-008
- 测试场景：验证 commentService×articleService×errorHandler 文章存在性校验失败路径，返回 40401

**前置条件**
服务已启动；alice 已登录；使用不存在的 articleId（UUID v4 格式但不在 articleStore 中）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/v1/articles/:nonExistId/comments | Header: `Authorization: Bearer <alice-token>`；Body: `{"content":"Nice"}` | HTTP 404；响应 `{code:40401, message:"文章不存在"}` |
| 2 | 读取 commentStore | — | 无 articleId === nonExistId 的评论记录（未写入） |

**预期结果**
commentService.create 调用 articleService 校验存在性时抛 NotFoundError(40401)；commentStore 未写入脏数据。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### IT-011

- 标题：鉴权中间件-缺token/伪造/过期→40103/40102
- 优先级：高
- 关联需求/设计：NFR-001 / SD-005, INTF-006, INTF-005, INTF-008
- 测试场景：验证 authMiddleware×jwtService×errorHandler 三种令牌异常路径

**前置条件**
服务已启动；存在受保护接口 POST /api/v1/articles；已知 JWT_SECRET。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/v1/articles | 无 Authorization 头；合法 body | HTTP 401；响应 `{code:40103, message:"未提供认证令牌"}` |
| 2 | POST /api/v1/articles | Header: `Authorization: Bearer fake.invalid.token` | HTTP 401；响应 `{code:40102, message:"JWT 已过期或无效"}` |
| 3 | POST /api/v1/articles | Header: `Authorization: Bearer <expired-jwt>`（exp=now-1s，用正确密钥签名） | HTTP 401；响应 `{code:40102, message:"JWT 已过期或无效"}` |
| 4 | POST /api/v1/articles | Header: `Authorization: Bearer <forged-jwt>`（用错误密钥签名） | HTTP 401；响应 `{code:40102}` |
| 5 | 读取 articleStore | — | 无文章被创建（4 步均未写入） |

**预期结果**
缺 token→40103；伪造/过期/签名错误→40102；jwtService.verify 失败由 authMiddleware 捕获并映射错误码；errorHandler 统一序列化。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### IT-012

- 标题：zod参数校验-非法入参→40001
- 优先级：高
- 关联需求/设计：NFR-003 / SD-006, INTF-007, INTF-008
- 测试场景：验证 validateRequest×errorHandler zod schema 校验失败路径，返回 40001

**前置条件**
服务已启动。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/v1/auth/register | `{"username":"ab","password":"short"}`（username<3，password<8） | HTTP 400；响应 `{code:40001, message:"参数校验失败", details:[...]}`（含 zod 错误明细） |
| 2 | POST /api/v1/articles | Header: 合法 JWT；Body: `{"title":"","content":"x"}`（title 为空） | HTTP 400；响应 `{code:40001}` |
| 3 | GET /api/v1/articles?page=0&pageSize=200 | 无 Authorization（page<1，pageSize>100） | HTTP 400；响应 `{code:40001}` |
| 4 | POST /api/v1/auth/register | `{"username":"alice"}`（缺 password 字段） | HTTP 400；响应 `{code:40001}` |

**预期结果**
validateRequest 中间件对 req.body/req.query 用 zod schema 校验，失败抛 BadRequestError(40001) 含 zod details；errorHandler 序列化为 400；请求未进入 controller。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### IT-013

- 标题：bcrypt哈希存储-cost=10+无明文
- 优先级：高
- 关联需求/设计：NFR-001 / SD-005, SD-007, INTF-004, INTF-010
- 测试场景：验证 passwordHasher×userStore 密码哈希存储安全基线

**前置条件**
服务已启动；userStore 为空。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/v1/auth/register | `{"username":"carol","password":"Secret123"}` | HTTP 201；响应 {userId, username}（不含 password） |
| 2 | 读取 userStore 内部记录 | step1 返回 userId | 记录含 passwordHash 字段；passwordHash 以 `$2b$10$` 开头；**无** password 字段 |
| 3 | bcrypt.getRounds(passwordHash) | step2 passwordHash | 返回 10 |
| 4 | passwordHasher.compare("Secret123", hash) | step2 passwordHash | 返回 true |
| 5 | passwordHasher.compare("WrongPass", hash) | step2 passwordHash | 返回 false |
| 6 | 全量扫描 userStore 序列化输出 | — | 不含字符串 "Secret123"（明文不入存储） |

**预期结果**
passwordHasher.hash 使用 bcrypt cost=10 生成 $2b$10$ 格式哈希；userStore 仅存 passwordHash 不存明文；compare 正确校验。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

## 用例汇总

| 用例 ID | 标题 | 优先级 | 关联 | 状态 |
|---|---|---|---|---|
| IT-001 | 注册→登录全链路 | 高 | REQ-001 / SD-001 | 待执行 |
| IT-002 | 重复注册→40901 | 高 | REQ-001 / SD-001 | 待执行 |
| IT-003 | 登录密码错误→40101 | 高 | REQ-001 / SD-001 | 待执行 |
| IT-004 | 创建文章全链路 | 高 | REQ-002 / SD-002 | 待执行 |
| IT-005 | 作者隔离-非作者修改/删除→40301 | 高 | REQ-002 / SD-002 | 待执行 |
| IT-006 | 公开浏览列表+分页 | 高 | REQ-003 / SD-003 | 待执行 |
| IT-007 | 文章详情+评论聚合 | 高 | REQ-003, REQ-004 / SD-003, SD-004 | 待执行 |
| IT-008 | 发表评论+文章存在性校验 | 高 | REQ-004 / SD-004, SD-002 | 待执行 |
| IT-009 | 删除评论-作者隔离→40301 | 高 | REQ-004 / SD-004 | 待执行 |
| IT-010 | 评论对不存在文章→40401 | 中 | REQ-004 / SD-004, SD-002 | 待执行 |
| IT-011 | 鉴权中间件-缺token/伪造/过期→40103/40102 | 高 | NFR-001 / SD-005 | 待执行 |
| IT-012 | zod参数校验-非法入参→40001 | 高 | NFR-003 / SD-006 | 待执行 |
| IT-013 | bcrypt哈希存储-cost=10+无明文 | 高 | NFR-001 / SD-005, SD-007 | 待执行 |

## 测试用例覆盖说明

- 功能点覆盖：REQ-001（IT-001~003）、REQ-002（IT-004~005）、REQ-003（IT-006~007）、REQ-004（IT-008~010）、NFR-001（IT-011, IT-013）、NFR-003（IT-012）= 8/8 需求覆盖
- 跨模块调用覆盖（TC-DES-011）：IT-001（auth×store×utils）、IT-004（middleware×service×store）、IT-007（article×comment×stores）、IT-008（comment×article 跨域校验）
- 参数校验覆盖（TC-DES-010）：IT-012（zod 非法入参 → 40001）
- 数据传递异常路径（TC-DES-012）：IT-002（40901）、IT-003（40101）、IT-005（40301）、IT-010（40401）、IT-011（40102/40103）
- 错误码全覆盖：40001 / 40101 / 40102 / 40103 / 40301 / 40401 / 40901（7/7 客户端错误码，50001 由 errorHandler 兜底不单独设计 IT）
- controller×service×store 全链路：IT-001 / IT-004 / IT-006 / IT-007
- middleware×controller：IT-005 / IT-008 / IT-011
- 边界条件覆盖：分页越界（IT-006 step3 + IT-012 step3）、不存在资源（IT-010）、令牌异常（IT-011）
