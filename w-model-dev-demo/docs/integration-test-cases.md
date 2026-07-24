# 集成测试用例文档

> 阶段 3（概要设计）同步产出。套用 `templates/test-case.md` 模板，类型=集成测试。
> 覆盖模块间交互：控制器↔服务、服务↔存储、中间件链、跨模块调用与异常路径。
> 本阶段只设计，阶段 6 执行。

## 文档信息

- 项目名称：blog-system-demo
- 测试类型：集成测试
- 设计来源阶段：阶段 3（概要设计）
- 执行阶段：阶段 6（集成测试）
- 文档版本：v1.0
- 关联接口设计：docs/outline-design.md

## 用例列表

### IT-001

- 标题：注册正向链路（控制器→服务→存储贯通）
- 优先级：高
- 关联需求/设计：REQ-002 / INTF-AUTH-API → INTF-AUTH-SERVICE → INTF-USER-SERVICE → INTF-USER-STORE
- 测试场景：验证注册请求经路由→服务→存储全链路贯通，密码 bcrypt 哈希后存入

**前置条件**
- 内存存储 users Map 为空
- JWT_SECRET 环境变量已设置

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/auth/register | `{"username":"alice","password":"secret123"}` | 200，`{code:0, data:{userId, username:"alice"}}` |
| 2 | 查询 INTF-USER-STORE.findById(userId) | userId | 返回 User 对象，passwordHash 非明文（bcrypt $2b$ 前缀） |

**预期结果**
注册成功，用户存入 Map，密码以 bcrypt 哈希存储（非明文），userId 非空。

**执行状态**
- [ ] 待执行

---

### IT-002

- 标题：注册异常——用户名已存在
- 优先级：高
- 关联需求/设计：REQ-002 / INTF-AUTH-API → INTF-AUTH-SERVICE
- 测试场景：重复用户名注册返回业务错误码 60001

**前置条件**
- users Map 已存在 username="alice"

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/auth/register | `{"username":"alice","password":"secret456"}` | 409，`{code:60001, message:"用户名已存在"}` |

**预期结果**
返回 409 + 错误码 60001，存储层未写入重复用户。

**执行状态**
- [ ] 待执行

---

### IT-003

- 标题：登录正向链路（bcrypt 比对 + JWT 签发）
- 优先级：高
- 关联需求/设计：REQ-002 / INTF-AUTH-API → INTF-AUTH-SERVICE → INTF-USER-SERVICE
- 测试场景：已注册用户登录，bcrypt 比对密码后签发 JWT

**前置条件**
- users Map 已存在 alice（bcrypt 哈希存储）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/auth/login | `{"username":"alice","password":"secret123"}` | 200，`{code:0, data:{token, role:"user"}}` |
| 2 | 解析返回 token | JWT payload | 含 userId、role，过期时间 ≤1 小时 |

**预期结果**
登录成功，返回有效 JWT token，payload 含 userId 与 role。

**执行状态**
- [ ] 待执行

---

### IT-004

- 标题：登录异常——密码错误
- 优先级：高
- 关联需求/设计：REQ-002 / INTF-AUTH-API → INTF-AUTH-SERVICE
- 测试场景：错误密码登录返回 40101

**前置条件**
- users Map 已存在 alice

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/auth/login | `{"username":"alice","password":"wrongpassword"}` | 401，`{code:40101, message:"用户名或密码错误"}` |

**预期结果**
返回 401 + 错误码 40101，不签发 JWT。

**执行状态**
- [ ] 待执行

---

### IT-005

- 标题：发布文章正向链路（JWT 校验→发布→存储）
- 优先级：高
- 关联需求/设计：REQ-003 / auth.middleware → INTF-ARTICLE-API → INTF-ARTICLE-SERVICE → INTF-ARTICLE-STORE
- 测试场景：已登录用户携带 JWT 发布文章，经鉴权中间件→控制器→服务→存储全链路

**前置条件**
- 已注册并登录 alice，持有有效 JWT
- articles Map 为空

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/articles | Header: `Authorization: Bearer <token>`，Body: `{"title":"我的文章","content":"正文"}` | 200，`{code:0, data:{articleId, status:"pending"}}` |
| 2 | 查询 INTF-ARTICLE-STORE.findById(articleId) | articleId | 返回 Article，status="pending"，authorId=alice 的 userId |

**预期结果**
文章发布成功，初始状态 pending，存入 Map，authorId 关联登录用户。

**执行状态**
- [ ] 待执行

---

### IT-006

- 标题：发布文章异常——无 JWT 鉴权失败
- 优先级：高
- 关联需求/设计：REQ-003 / auth.middleware → INTF-ARTICLE-API
- 测试场景：未携带 JWT 发布文章返回 40101

**前置条件**
- 无

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/articles | Body: `{"title":"我的文章","content":"正文"}`（无 Authorization 头） | 401，`{code:40101, message:"未授权"}` |

**预期结果**
返回 401 + 错误码 40101，文章未存储。

**执行状态**
- [ ] 待执行

---

### IT-007

- 标题：文章列表查询——普通用户过滤 rejected
- 优先级：高
- 关联需求/设计：REQ-003, REQ-005 / INTF-ARTICLE-API → INTF-ARTICLE-SERVICE → INTF-ARTICLE-STORE
- 测试场景：普通用户列表查询不返回 rejected 文章，admin 返回全部

**前置条件**
- articles Map 存在 3 篇：a1(pending)、a2(approved)、a3(rejected)

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | GET /api/articles（role=user） | 无 JWT 或 user token | 列表仅含 a2(approved)，不含 a3(rejected) |
| 2 | GET /api/articles（role=admin） | admin token | 列表含 a1+a2+a3 全部 |

**预期结果**
普通用户列表过滤 rejected；管理员返回全部文章。

**执行状态**
- [ ] 待执行

---

### IT-008

- 标题：评论正向链路（文章存在性校验→评论存储）
- 优先级：高
- 关联需求/设计：REQ-004 / INTF-COMMENT-API → INTF-COMMENT-SERVICE → INTF-ARTICLE-SERVICE → INTF-COMMENT-STORE
- 测试场景：已登录用户对已存在文章添加评论，跨模块校验文章存在性后存储

**前置条件**
- 已登录 alice 持有 JWT
- articles Map 存在 a1(status=approved)

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/articles/a1/comments | Header: JWT，Body: `{"content":"好文章"}` | 200，`{code:0, data:{commentId, articleId:"a1"}}` |
| 2 | 查询 INTF-COMMENT-STORE.findByArticle("a1") | articleId="a1" | 返回含该评论的数组 |

**预期结果**
评论添加成功，INTF-COMMENT-SERVICE 调用 INTF-ARTICLE-SERVICE 校验文章存在后存入 Map。

**执行状态**
- [ ] 待执行

---

### IT-009

- 标题：评论异常——文章不存在（跨模块调用异常路径）
- 优先级：高
- 关联需求/设计：REQ-004 / INTF-COMMENT-SERVICE → INTF-ARTICLE-SERVICE
- 测试场景：对不存在文章添加评论，跨模块校验返回 40401

**前置条件**
- 已登录 alice 持有 JWT
- articles Map 不存在 a999

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/articles/a999/comments | Header: JWT，Body: `{"content":"好文章"}` | 404，`{code:40401, message:"文章不存在"}` |

**预期结果**
INTF-COMMENT-SERVICE 调用 INTF-ARTICLE-SERVICE 发现文章不存在，返回 40401，评论未存储。

**执行状态**
- [ ] 待执行

---

### IT-010

- 标题：审核正向链路（admin 审核 pending→approved）
- 优先级：高
- 关联需求/设计：REQ-005 / INTF-ARTICLE-API → INTF-REVIEW-SERVICE → INTF-ARTICLE-STORE
- 测试场景：管理员审核 pending 文章，状态流转为 approved 并写入存储

**前置条件**
- 已登录 admin 持有 JWT（role=admin）
- articles Map 存在 a1(status=pending)

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | PATCH /api/articles/a1/review | Header: admin JWT，Body: `{"action":"approve"}` | 200，`{code:0, data:{articleId:"a1", status:"approved"}}` |
| 2 | 查询 INTF-ARTICLE-STORE.findById("a1") | id="a1" | status="approved" |

**预期结果**
审核成功，文章状态从 pending 流转为 approved，存储层同步更新。

**执行状态**
- [ ] 待执行

---

### IT-011

- 标题：审核异常——非 admin 角色被拒
- 优先级：高
- 关联需求/设计：REQ-005 / auth.middleware(admin-guard) → INTF-REVIEW-SERVICE
- 测试场景：普通用户调用审核接口返回 40301

**前置条件**
- 已登录 alice（role=user）持有 JWT
- articles Map 存在 a1(status=pending)

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | PATCH /api/articles/a1/review | Header: user JWT，Body: `{"action":"approve"}` | 403，`{code:40301, message:"禁止访问"}` |

**预期结果**
admin-guard 中间件拦截非 admin 角色，返回 40301，文章状态不变。

**执行状态**
- [ ] 待执行

---

### IT-012

- 标题：审核异常——文章状态非 pending
- 优先级：高
- 关联需求/设计：REQ-005 / INTF-REVIEW-SERVICE → INTF-ARTICLE-STORE
- 测试场景：对已审核文章重复审核返回业务错误码 60002

**前置条件**
- 已登录 admin 持有 JWT
- articles Map 存在 a1(status=approved)

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | PATCH /api/articles/a1/review | Header: admin JWT，Body: `{"action":"reject"}` | 409，`{code:60002, message:"文章状态非法"}` |

**预期结果**
INTF-REVIEW-SERVICE 检测文章非 pending，返回 60002，状态不变。

**执行状态**
- [ ] 待执行

---

### IT-013

- 标题：参数校验——非法输入返回 400
- 优先级：高
- 关联需求/设计：REQ-001 / validate.middleware
- 测试场景：zod 校验非法参数（空字符串、长度越界）返回 400 + 40001

**前置条件**
- 无

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/auth/register | `{"username":"ab","password":"123"}` | 400，`{code:40001, message:"参数缺失/格式非法"}` |
| 2 | POST /api/articles | JWT + `{"title":"","content":"正文"}` | 400，`{code:40001}` |

**预期结果**
validate.middleware 拦截非法参数，返回 400 + 40001，请求不进入控制器。

**执行状态**
- [ ] 待执行

---

### IT-014

- 标题：存储异常 fallback——服务层不崩溃
- 优先级：中
- 关联需求/设计：REQ-001 / INTF-ARTICLE-SERVICE → INTF-ARTICLE-STORE
- 测试场景：存储层抛异常时，服务层捕获并返回 50001，进程不崩溃

**前置条件**
- mock INTF-ARTICLE-STORE.findById 抛异常

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | GET /api/articles/a1 | id="a1"（存储 mock 抛异常） | 500，`{code:50001, message:"服务端存储错误"}` |
| 2 | GET /api/articles/a2 | id="a2"（恢复正常） | 正常返回或 40401（存储恢复后正常响应） |

**预期结果**
存储异常被 error.handler 捕获，返回 50001，进程存活可继续处理后续请求（fallback 不崩溃）。

**执行状态**
- [ ] 待执行

---

## 用例汇总

| 用例 ID | 标题 | 优先级 | 关联 | 状态 |
|---|---|---|---|---|
| IT-001 | 注册正向链路 | 高 | REQ-002 | 待执行 |
| IT-002 | 注册异常-用户名已存在 | 高 | REQ-002 | 待执行 |
| IT-003 | 登录正向链路 | 高 | REQ-002 | 待执行 |
| IT-004 | 登录异常-密码错误 | 高 | REQ-002 | 待执行 |
| IT-005 | 发布文章正向链路 | 高 | REQ-003 | 待执行 |
| IT-006 | 发布文章异常-无 JWT | 高 | REQ-003 | 待执行 |
| IT-007 | 文章列表-过滤 rejected | 高 | REQ-003, REQ-005 | 待执行 |
| IT-008 | 评论正向链路 | 高 | REQ-004 | 待执行 |
| IT-009 | 评论异常-文章不存在 | 高 | REQ-004 | 待执行 |
| IT-010 | 审核正向链路 | 高 | REQ-005 | 待执行 |
| IT-011 | 审核异常-非 admin | 高 | REQ-005 | 待执行 |
| IT-012 | 审核异常-状态非 pending | 高 | REQ-005 | 待执行 |
| IT-013 | 参数校验-非法输入 | 高 | REQ-001 | 待执行 |
| IT-014 | 存储异常 fallback | 中 | REQ-001 | 待执行 |

## 测试用例覆盖说明

- 功能点覆盖：14/14（注册/登录/发布/查询/评论/审核全链路）
- 边界条件覆盖：参数长度越界（IT-013）、状态机非法状态（IT-012）、重复注册（IT-002）
- 跨模块调用覆盖：INTF-COMMENT-SERVICE→INTF-ARTICLE-SERVICE（IT-008/009）、INTF-REVIEW-SERVICE→INTF-ARTICLE-STORE（IT-010/012）
- 异常路径覆盖：认证失败（IT-004/006）、权限不足（IT-011）、资源不存在（IT-009）、存储异常 fallback（IT-014）
- 中间件链覆盖：validate.middleware（IT-013）、auth.middleware（IT-005/006）、admin-guard（IT-011）、error.handler（IT-014）
- REQ 映射：REQ-001(IT-013/014)、REQ-002(IT-001~004)、REQ-003(IT-005~007)、REQ-004(IT-008/009)、REQ-005(IT-007/010/011/012)
