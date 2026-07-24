# 测试用例文档

> 阶段 2 设计、阶段 7 执行。套用 `templates/test-case.md` 模板填充。
> 测试类型：系统测试（System Test）
> 设计来源阶段：阶段 2（系统设计）
> 执行阶段：阶段 7（系统测试）

## 文档信息

- 项目名称：blog-system-demo
- 测试类型：系统测试
- 设计来源阶段：阶段 2
- 执行阶段：阶段 7
- 文档版本：v1.0

## 用例列表

### ST-001

- 标题：端到端业务链路-注册→登录→发布文章→审核→查询
- 优先级：高
- 关联需求/设计：REQ-001, REQ-002, REQ-003, REQ-005 / SD-AUTH, SD-ARTICLE, SD-REVIEW
- 测试场景：验证完整业务链路从用户注册到审核后查询的全流程状态流转

**前置条件**

- 服务已启动（`npm run dev`，JWT_SECRET=test-secret-blog-demo）
- 数据存储为空（初始状态）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/auth/register | `{"username":"alice","password":"Secret123"}` | HTTP 201，含 `userId`，无明文密码 |
| 2 | POST /api/auth/register | `{"username":"admin","password":"Admin456"}` | HTTP 201，admin 用户 role=admin |
| 3 | POST /api/auth/login | `{"username":"alice","password":"Secret123"}` | HTTP 200，含 `token`（JWT 三段式） |
| 4 | POST /api/articles | Header: `Authorization: Bearer ${aliceToken}`；Body: `{"title":"端到端测试","content":"内容"}` | HTTP 201，含 `articleId`，`status:"pending"` |
| 5 | POST /api/auth/login | `{"username":"admin","password":"Admin456"}` | HTTP 200，含 adminToken |
| 6 | PATCH /api/articles/${articleId}/review | Header: `Authorization: Bearer ${adminToken}`；Body: `{"action":"approve"}` | HTTP 200，`status:"approved"` |
| 7 | GET /api/articles | Header: `Authorization: Bearer ${aliceToken}` | HTTP 200，数组含该文章 |

**预期结果**

完整链路状态流转正确：注册→登录→发布(pending)→审核(approved)→查询可见。

**执行状态**

- [ ] 待执行

---

### ST-002

- 标题：端到端业务链路-发布文章→添加评论→查询评论
- 优先级：高
- 关联需求/设计：REQ-003, REQ-004 / SD-ARTICLE, SD-COMMENT
- 测试场景：验证文章发布后评论子系统的添加与查询链路

**前置条件**

- 服务已启动
- 用户 `alice` 已注册并登录，持有 aliceToken
- 文章 `art-001` 已发布且 status=approved

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/articles/art-001/comments | Header: `Authorization: Bearer ${aliceToken}`；Body: `{"content":"好文！"}` | HTTP 201，含 `commentId` |
| 2 | POST /api/articles/art-001/comments | Header: `Authorization: Bearer ${aliceToken}`；Body: `{"content":"第二评论"}` | HTTP 201，含 `commentId` |
| 3 | GET /api/articles/art-001/comments | 无需 Authorization | HTTP 200，数组含 2 条评论 |

**预期结果**

评论添加成功且查询返回正确数量；评论查询无需登录。

**执行状态**

- [ ] 待执行

---

### ST-003

- 标题：安全基线-非管理员调用审核接口被拒（403）
- 优先级：高
- 关联需求/设计：REQ-005 / SD-REVIEW
- 测试场景：验证审核接口的权限控制，普通用户调用返回 403

**前置条件**

- 服务已启动
- 普通用户 `alice` 已登录，持有 aliceToken（role=user）
- 管理员 `admin` 已登录，持有 adminToken
- 文章 `art-001` status=pending

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | PATCH /api/articles/art-001/review | Header: `Authorization: Bearer ${aliceToken}`；Body: `{"action":"approve"}` | HTTP 403，错误信息含"无权限"或"禁止" |
| 2 | PATCH /api/articles/art-001/review | Header: `Authorization: Bearer ${adminToken}`；Body: `{"action":"approve"}` | HTTP 200，`status:"approved"` |

**预期结果**

普通用户审核被拒（403），管理员审核成功（200）。对应 TC-DES-009 安全基线。

**执行状态**

- [ ] 待执行

---

### ST-004

- 标题：安全基线-无效 JWT 访问受保护接口（401）
- 优先级：高
- 关联需求/设计：REQ-002, REQ-003 / SD-AUTH
- 测试场景：验证 JWT 鉴权对无效/过期 token 的拒绝

**前置条件**

- 服务已启动

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/articles | Header: 无 Authorization；Body: `{"title":"t","content":"c"}` | HTTP 401，错误信息"未授权" |
| 2 | POST /api/articles | Header: `Authorization: Bearer invalid.token.here`；Body: `{"title":"t","content":"c"}` | HTTP 401，错误信息"token 无效" |
| 3 | POST /api/articles | Header: `Authorization: Bearer`（空 token）；Body: `{"title":"t","content":"c"}` | HTTP 401 |

**预期结果**

所有无效鉴权场景返回 401。对应 TC-DES-009 安全基线。

**执行状态**

- [ ] 待执行

---

### ST-005

- 标题：安全基线-rejected 文章对普通用户不可见
- 优先级：高
- 关联需求/设计：REQ-005 / SD-ARTICLE, SD-REVIEW
- 测试场景：验证审核驳回后文章对普通用户的可见性隔离

**前置条件**

- 服务已启动
- 文章 `art-001` status=approved，文章 `art-002` status=rejected（管理员已驳回）
- 普通用户 `alice` 持有 aliceToken

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | GET /api/articles | Header: `Authorization: Bearer ${aliceToken}` | HTTP 200，数组含 art-001，不含 art-002 |
| 2 | GET /api/articles/art-002 | Header: `Authorization: Bearer ${aliceToken}` | HTTP 404，文章不可见 |
| 3 | GET /api/articles/art-002 | Header: `Authorization: Bearer ${adminToken}` | HTTP 200，管理员可见 rejected 文章 |

**预期结果**

普通用户列表/详情均不可见 rejected 文章；管理员可见全部。对应 TC-DES-009 安全基线。

**执行状态**

- [ ] 待执行

---

### ST-006

- 标题：性能基线-100 QPS 持续 10min，P95 < 2s
- 优先级：高
- 关联需求/设计：REQ-001, NFR-006 / 全模块
- 测试场景：验证系统在持续负载下的响应时间满足性能基线

**前置条件**

- 服务已启动
- 预置测试用户与文章数据
- k6 压测工具可用

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | k6 压测 | 100 VU 持续 10min，混合请求：GET /api/articles（70%）+ POST /api/auth/login（20%）+ POST /api/articles（10%） | P95 < 2s，错误率 < 1% |
| 2 | 收集指标 | k6 summary | http_req_duration.p(95) < 2000ms |

**预期结果**

100 QPS 持续 10 分钟，P95 响应时间 < 2s，错误率 < 1%。对应 TC-DES-008 性能基线。

**执行状态**

- [ ] 待执行

---

### ST-007

- 标题：性能基线-单接口响应 < 500ms
- 优先级：高
- 关联需求/设计：NFR-006 / 全模块
- 测试场景：验证各核心接口在单次请求下的响应时间

**前置条件**

- 服务已启动
- 预置测试数据

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 单次请求 POST /api/auth/register | `{"username":"perf1","password":"Pass123"}` | 响应时间 < 500ms（含 bcrypt 哈希） |
| 2 | 单次请求 POST /api/auth/login | `{"username":"perf1","password":"Pass123"}` | 响应时间 < 500ms |
| 3 | 单次请求 GET /api/articles | 无 Authorization | 响应时间 < 100ms |
| 4 | 单次请求 POST /api/articles | `Authorization: Bearer ${token}` | 响应时间 < 500ms |

**预期结果**

所有核心接口单次响应 < 500ms（NFR-006）。对应 TC-DES-008 性能基线。

**执行状态**

- [ ] 待执行

---

### ST-008

- 标题：安全基线-密码 bcrypt 哈希存储（无明文）
- 优先级：高
- 关联需求/设计：REQ-002, NFR-001 / SD-AUTH
- 测试场景：验证密码不以明文存储，bcrypt 哈希格式正确

**前置条件**

- 服务已启动
- 用户 `alice` 已注册（密码 Secret123）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 查询存储层 | 读取 users Map 中 alice 记录 | `passwordHash` 字段以 `$2b$` 或 `$2a$` 开头 |
| 2 | 验证无明文 | 搜索存储层是否含 "Secret123" 字符串 | 无匹配（密码未明文存储） |
| 3 | 验证 cost factor | 解析 bcrypt 哈希 | cost factor = 10（`$2b$10$...`） |

**预期结果**

密码以 bcrypt 哈希存储，cost=10，无明文。对应 TC-DES-009 安全基线 + NFR-001。

**执行状态**

- [ ] 待执行

---

### ST-009

- 标题：异常路径-zod 校验非法输入返回 400
- 优先级：中
- 关联需求/设计：REQ-002, REQ-003, NFR-003 / 全模块
- 测试场景：验证所有 POST 接口的 zod 输入校验对非法输入返回 400 + 错误明细

**前置条件**

- 服务已启动

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/auth/register | `{"username":"","password":""}` | HTTP 400，zod 错误含 username/password 字段 |
| 2 | POST /api/auth/register | `{"username":"x"}`（缺 password） | HTTP 400，zod 错误含 password required |
| 3 | POST /api/articles | Header: `Authorization: Bearer ${token}`；Body: `{"title":"","content":""}` | HTTP 400，zod 错误含 title/content |
| 4 | POST /api/articles/art-001/comments | Header: `Authorization: Bearer ${token}`；Body: `{}`（缺 content） | HTTP 400，zod 错误含 content required |

**预期结果**

所有非法输入返回 400 + zod 错误明细。对应 NFR-003 输入校验。

**执行状态**

- [ ] 待执行

---

### ST-010

- 标题：异常路径-文章/评论不存在返回 404
- 优先级：中
- 关联需求/设计：REQ-003, REQ-004 / SD-ARTICLE, SD-COMMENT
- 测试场景：验证查询不存在的资源返回 404

**前置条件**

- 服务已启动
- 用户 `alice` 持有 aliceToken

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | GET /api/articles/non-existent | Header: `Authorization: Bearer ${aliceToken}` | HTTP 404，错误信息"文章不存在" |
| 2 | POST /api/articles/non-existent/comments | Header: `Authorization: Bearer ${aliceToken}`；Body: `{"content":"c"}` | HTTP 404，错误信息"文章不存在" |
| 3 | GET /api/articles/non-existent/comments | 无 Authorization | HTTP 404，错误信息"文章不存在" |

**预期结果**

不存在的资源返回 404 且错误信息明确。

**执行状态**

- [ ] 待执行

---

## 用例汇总

| 用例 ID | 标题 | 优先级 | 关联 | 状态 |
|---|---|---|---|---|
| ST-001 | 端到端：注册→登录→发布→审核→查询 | 高 | REQ-001,REQ-002,REQ-003,REQ-005 | 待执行 |
| ST-002 | 端到端：发布文章→添加评论→查询评论 | 高 | REQ-003,REQ-004 | 待执行 |
| ST-003 | 安全：非管理员审核被拒（403） | 高 | REQ-005 | 待执行 |
| ST-004 | 安全：无效 JWT 访问被拒（401） | 高 | REQ-002,REQ-003 | 待执行 |
| ST-005 | 安全：rejected 文章对普通用户不可见 | 高 | REQ-005 | 待执行 |
| ST-006 | 性能基线：100 QPS 持续 10min P95<2s | 高 | REQ-001,NFR-006 | 待执行 |
| ST-007 | 性能基线：单接口响应<500ms | 高 | NFR-006 | 待执行 |
| ST-008 | 安全：密码 bcrypt 哈希存储 | 高 | REQ-002,NFR-001 | 待执行 |
| ST-009 | 异常：zod 校验非法输入返回 400 | 中 | REQ-002,REQ-003,NFR-003 | 待执行 |
| ST-010 | 异常：资源不存在返回 404 | 中 | REQ-003,REQ-004 | 待执行 |

## 测试用例覆盖说明

- 功能点覆盖：5/5（REQ-001~005 全覆盖）
- 端到端覆盖：2 条（ST-001 注册→审核→查询全链路；ST-002 发布→评论链路），对应 TC-DES-007
- 性能基线覆盖：2 条（ST-006 100QPS/P95<2s；ST-007 单接口<500ms），对应 TC-DES-008
- 安全基线覆盖：4 条（ST-003 权限控制；ST-004 JWT 鉴权；ST-005 可见性隔离；ST-008 密码哈希），对应 TC-DES-009
- 异常路径覆盖：2 条（ST-009 输入校验；ST-010 资源不存在）
- 边界条件覆盖：rejected 不可见（ST-005）、空输入（ST-009）、不存在的文章（ST-010）
