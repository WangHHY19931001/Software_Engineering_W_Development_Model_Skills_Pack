# 测试用例文档（集成测试设计）

> 阶段 3（概要设计）同步产出；阶段 6（集成测试）执行。套用 `templates/test-case.md` 模板，类型=集成测试。
> 对应接口设计：`docs/phase3-outline/blog-system-interface-design.md`；系统设计：`docs/phase2-design/blog-system-system-design.md`；需求规格：`docs/phase1-requirements/requirement-spec.md`。
> **接口路径说明**：本文件「接口路径」以阶段 3 接口设计文档（INTF-001~022）为准；若阶段 5 编码调整，以实际路径为准。
> **测试 seam**：主 seam-HTTP（supertest 直连 Express app 工厂，不启真实端口）；辅 seam-STORE（种子数据准备 / WebhookDelivery·Notification store 快照断言，见接口设计 §6）。禁止在集成层引入 mock 中间件链等新 seam。

## 文档信息

- 项目名称：博客系统后端（blog-system-demo-r35）
- 测试类型：集成测试
- 设计来源阶段：阶段 3（概要设计）
- 执行阶段：阶段 6（集成测试）
- 文档版本：v1.0

## 用例列表

### IT-001

- 标题：注册→登录→申请博主 身份链路（跨模块）+ 邮箱唯一 409 + 错误凭据 401
- 优先级：高
- 关联需求/设计：REQ-007, REQ-008, REQ-009 / SD-001 / INTF-001, INTF-002, INTF-003
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：验证身份域三个接口的契约联动：注册成功（bcrypt 存储、响应无密码字段）→ 邮箱重复注册 40901 → 登录成功签发 JWT（exp−iat ≤ 24h，CON-003）→ 错误密码 40101 → 申请博主角色变更 reader→blogger（参数校验 + 异常路径 + 跨接口数据流）。

**前置条件**
- 认证状态：初始无认证；用例内依次获得 reader JWT → blogger JWT
- 数据依赖：无（新建数据；预置 `JWT_SECRET=test-*`，CON-003）
- 接口路径：POST /api/auth/register → POST /api/auth/register（重复）→ POST /api/auth/login → POST /api/auth/login（错误密码）→ POST /api/users/me/blogger

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 注册读者 | `{"username":"it1_reader","email":"it1@example.com","password":"Passw0rd!x"}` | 201 + `role=reader`；响应无 password 字段 |
| 2 | 重复邮箱注册 | `{"username":"it1_reader2","email":"it1@example.com","password":"Passw0rd!y"}` | 409 + `error.code=40901` |
| 3 | 登录成功 | `{"identifier":"it1@example.com","password":"Passw0rd!x"}` | 200 + `token` 可解析，`exp−iat ≤ 86400` |
| 4 | 错误密码登录 | `{"identifier":"it1@example.com","password":"WrongPass0!"}` | 401 + `error.code=40101`（不区分账号/密码错误） |
| 5 | 申请博主 | 携带步骤 3 的 JWT：POST /api/users/me/blogger | 200 + `role=blogger` |
| 6 | 重复申请博主 | 同步骤 5 | 200（幂等，不报错） |

**预期结果**
注册/登录/博主申请链路正确；邮箱唯一约束、错误凭据防枚举、角色变更均符合契约；全程错误响应结构 `{ error: { code, message } }`（CON-002）。

**执行状态**
- [ ] 待执行

---

### IT-002

- 标题：登录限流：同一 IP 第 11 次认证请求返回 429
- 优先级：高
- 关联需求/设计：REQ-008 / SD-007 / INTF-002（NFR-006）
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：认证接口限流 10 次/分/IP（测试环境窗口可配置），第 11 次请求返回 42901 且 retryable=true；验证横切中间件与业务接口的集成（异常路径）。

**前置条件**
- 认证状态：无需认证（公开接口）
- 数据依赖：测试环境限流窗口缩小（如窗口 1 分钟阈值 10，NFR-006 testThreshold）；种子账号（可先注册 1 个）
- 接口路径：POST /api/auth/login ×11

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 连续登录 10 次（正确凭据） | 固定账号凭据 | 前 10 次均 200（成功）或 40101（凭据错）——均属「被限流前」正常响应 |
| 2 | 第 11 次登录 | 同凭据 | 429 + `error.code=42901` |
| 3 | 断言响应体 | — | `retryable` 语义成立（429 可稍后重试） |

**预期结果**
第 11 次认证请求被限流中间件拦截返回 429；普通接口 100 次/分阈值不受影响。

**执行状态**
- [ ] 待执行

---

### IT-003

- 标题：创建文章：非博主（reader）403（跨模块博主权限校验）
- 优先级：高
- 关联需求/设计：REQ-009, REQ-011 / SD-002 → SD-001 / INTF-005
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：reader 角色用户携带 JWT 调 POST /api/articles 被拒 40301——验证 SD-002 创建文章前经 SD-001 user store 校验 `role=blogger` 的跨模块调用（`token.sub=userId` 对齐 user store，P7-002/P7-003 约束）。

**前置条件**
- 认证状态：reader JWT（已注册未申请博主）+ blogger JWT（对照组）
- 数据依赖：预置 reader 与 blogger 各 1（seed：user store）；预置标签/分类（tag store / category store）
- 接口路径：POST /api/articles

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | reader 创建文章 | 携带 reader JWT：`{"title":"越权文","body":"正文","tags":["t1"],"categoryId":"c_1"}` | 403 + `error.code=40301`；article store 无新增 |
| 2 | blogger 创建文章（对照组） | 携带 blogger JWT：`{"title":"合法文","body":"正文","tags":["t1"],"categoryId":"c_1"}` | 201 + `status=draft` |
| 3 | 未携带 JWT 创建 | 无 Authorization | 401 + `error.code=40101` |

**预期结果**
博主权限校验在 user store 正确执行：reader 403、blogger 201、无令牌 401；无越权写入。

**执行状态**
- [ ] 待执行

---

### IT-004

- 标题：创建文章引用不存在标签/分类 404；标签重名 409
- 优先级：高
- 关联需求/设计：REQ-011, REQ-015, REQ-016 / SD-002 / INTF-005, INTF-009, INTF-010
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：文章创建时标签/分类引用校验（tag store / category store 存在性）与标签唯一性（参数校验 + 异常路径 + 跨 store 数据一致性）。

**前置条件**
- 认证状态：blogger JWT
- 数据依赖：预置标签 `["存在标签"]`、分类 `c_1`（SD-002 各 store seed）
- 接口路径：POST /api/articles；POST /api/tags

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 引用不存在标签 | `{"title":"t","body":"b","tags":["不存在标签"]}` | 404 + `error.code=40401` |
| 2 | 引用不存在分类 | `{"title":"t","body":"b","categoryId":"c_not_exist"}` | 404 + `error.code=40401` |
| 3 | 创建重名标签 | POST /api/tags `{"name":"存在标签"}` | 409 + `error.code=40901` |
| 4 | 创建新标签 | POST /api/tags `{"name":"新标签"}` | 201 + 返回 tagId |

**预期结果**
引用校验与唯一性校验均按契约返回错误码；创建成功的数据进入对应 store。

**执行状态**
- [ ] 待执行

---

### IT-005

- 标题：发布/归档状态机非法流转 60001（archived→published 直跳）
- 优先级：高
- 关联需求/设计：REQ-012, REQ-013 / SD-002 / INTF-006, INTF-007
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：文章状态机约束：draft→published 合法；archived 状态下直接 publish 60001；draft 直接 archive 60001（异常路径 + 状态机规则）。

**前置条件**
- 认证状态：blogger JWT
- 数据依赖：预创建博主文章：A1（draft）、A2（published→archived，经 seed 或步骤构造）
- 接口路径：POST /api/articles/:id/publish；POST /api/articles/:id/archive

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 发布草稿 A1 | POST /api/articles/A1/publish | 200 + `status=published` |
| 2 | 归档 A2（published） | POST /api/articles/A2/archive | 200 + `status=archived` |
| 3 | 归档后直接发布 | POST /api/articles/A2/publish | 409 + `error.code=60001`（须先 unarchive） |
| 4 | draft 直接归档 | 新建草稿 A3 → POST /api/articles/A3/archive | 409 + `error.code=60001` |
| 5 | 已发布重复发布 | POST /api/articles/A1/publish（A1 已 published） | 200（幂等，不报错） |

**预期结果**
状态机只允许合法迁移；非法迁移统一 60001；重复发布幂等。

**执行状态**
- [ ] 待执行

---

### IT-006

- 标题：发布→Webhook 回调成功（HMAC 验签）（跨模块事件）
- 优先级：高
- 关联需求/设计：REQ-012, REQ-028 / SD-002 → SD-006 / INTF-006, INTF-022
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：博主配置 Webhook（article.published）→ 发布草稿 → 本地 mock 回调收到 POST 且 `X-Blog-Signature` HMAC 验签通过 → WebhookDelivery store 记录成功（跨模块事件分发 + 契约）。

**前置条件**
- 认证状态：blogger JWT
- 数据依赖：本地 mock 回调服务（阶段 2 系统测试已引入，D-04）；预置 webhook 配置（url 指向 mock，events=[article.published]）；预置草稿
- 接口路径：POST /api/me/webhooks → POST /api/articles/:id/publish

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 配置 Webhook | `{"url":"http://127.0.0.1:9000/hook","events":["article.published"]}` | 201 + 返回 webhookId 与 secret |
| 2 | 发布草稿 | POST /api/articles/A1/publish | 200 + published |
| 3 | 断言 mock 回调 | 检查 mock 服务收到 1 次回调 | 收到；`X-Blog-Event=article.published`；用 secret 对 body 重算 HMAC 一致 |
| 4 | 断言投递记录 | seam-STORE 读 WebhookDelivery store | 状态=success，attempts=1 |

**预期结果**
发布成功触发事件→SD-006 分发回调；HMAC 签名有效；投递成功记录落 store。

**执行状态**
- [ ] 待执行

---

### IT-007

- 标题：Webhook 回调失败自动重试 ≤3 次并留存失败记录（NFR-003 异常路径）
- 优先级：高
- 关联需求/设计：REQ-028, NFR-003 / SD-006 / INTF-006, INTF-022
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：mock 回调返回 500/不可达 → 系统按指数退避重试 ≤3 次 → 最终失败写入 WebhookDelivery store 失败记录（attempts=3、状态=failed、lastError 非空）；发布接口本身不受影响返回 200（异步投递，异常路径）。

**前置条件**
- 认证状态：blogger JWT
- 数据依赖：mock 回调配置为「永远失败」（返回 500）；webhook 配置 events=[article.published]；预置草稿
- 接口路径：POST /api/articles/:id/publish → 观察重试

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 发布草稿 | POST /api/articles/A1/publish | 200 + published（同步主链路不受回调失败影响） |
| 2 | 等待重试完成 | 等待（退避 1s/2s/4s + 抖动） | mock 收到 ≥1 次且 ≤3 次回调，均失败 |
| 3 | 断言投递记录 | seam-STORE 读 WebhookDelivery store | 状态=failed，attempts=3，lastError 记录原因 |

**预期结果**
重试次数 ≤3；最终失败有持久化记录（NFR-003）；发布主链路不被回调失败拖垮。

**执行状态**
- [ ] 待执行

---

### IT-008

- 标题：评论→Webhook comment.created 事件分发（跨模块事件）
- 优先级：高
- 关联需求/设计：REQ-018, REQ-028 / SD-003 → SD-006 / INTF-012, INTF-022
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：博主配置 events=[comment.created] 的 Webhook → 读者在博主已发布文章下发评论 → mock 回调收到事件（跨模块：SD-003 评论创建 → SD-006 分发）。

**前置条件**
- 认证状态：reader JWT（评论）+ blogger JWT（配置）
- 数据依赖：预置博主、已发布文章、webhook 配置（events=[comment.created]）
- 接口路径：POST /api/me/webhooks → POST /api/articles/:id/comments

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 配置 Webhook | events=["comment.created"] | 201 |
| 2 | 读者发表评论 | 携带 reader JWT：`{"content":"触发事件"}` | 201 + 评论立即可见 |
| 3 | 断言 mock 回调 | — | 收到回调，`X-Blog-Event=comment.created`，body 含 commentId/articleId |

**预期结果**
评论事件正确分发至 Webhook；事件载荷包含评论与文章标识。

**执行状态**
- [ ] 待执行

---

### IT-009

- 标题：归档→取消归档：状态机回 draft 且读者不可见
- 优先级：高
- 关联需求/设计：REQ-013 / SD-002 / INTF-007
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：published→archived（读者列表/详情消失）→ unarchive → draft（仍对读者隐藏，需重新发布）——验证归档生命周期与读者可见性联动。

**前置条件**
- 认证状态：blogger JWT（归档）+ 公开浏览（读者侧）
- 数据依赖：预置博主已发布文章 A1
- 接口路径：POST /api/articles/A1/archive → GET /api/articles（读者）→ POST /api/articles/A1/unarchive → GET /api/articles/A1

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 归档 A1 | POST /api/articles/A1/archive | 200 + `status=archived` |
| 2 | 读者浏览列表 | GET /api/articles | A1 不出现在列表 |
| 3 | 读者访问详情 | GET /api/articles/A1 | 404 + `error.code=40402`（防枚举） |
| 4 | 取消归档 | POST /api/articles/A1/unarchive | 200 + `status=draft` |
| 5 | 读者再访问详情 | GET /api/articles/A1 | 404 + `error.code=40402`（draft 仍隐藏） |

**预期结果**
归档→取消归档状态迁移正确；archived 与 draft 对读者均不可见。

**执行状态**
- [ ] 待执行

---

### IT-010

- 标题：删除文章：已发布 409（仅可归档）、草稿 204
- 优先级：高
- 关联需求/设计：REQ-013, REQ-014 / SD-002 / INTF-008
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：删除草稿成功（204 + store 移除）；删除已发布/已归档文章被拒 60001（异常路径 + 业务规则）。

**前置条件**
- 认证状态：blogger JWT（作者本人）
- 数据依赖：预置博主文章：A1（draft）、A2（published）、A3（archived）
- 接口路径：DELETE /api/articles/:id

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 删除草稿 A1 | DELETE /api/articles/A1 | 204 无 body；article store 无 A1 |
| 2 | 删除已发布 A2 | DELETE /api/articles/A2 | 409 + `error.code=60001`（提示仅可归档） |
| 3 | 删除已归档 A3 | DELETE /api/articles/A3 | 409 + `error.code=60001` |
| 4 | 删除不存在文章 | DELETE /api/articles/A_ghost | 404 + `error.code=40401` |

**预期结果**
删除规则符合状态机约束；草稿删除生效，已发布/归档不可删。

**执行状态**
- [ ] 待执行

---

### IT-011

- 标题：浏览列表/详情：草稿与归档对读者不可见（跨模块 SD-003→SD-002）
- 优先级：高
- 关联需求/设计：REQ-017 / SD-003 → SD-002 / INTF-011
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：读者分页浏览仅见 published 文章；组合筛选（categoryId/tag/keyword）与分页正确；草稿/归档不在列表且详情 40402（跨模块：SD-003 经 SD-002 article store 读数据）。

**前置条件**
- 认证状态：公开（无认证）
- 数据依赖：seed：博主 B + 文章 A1（published，tag=t1, category=c1）、A2（draft）、A3（archived）
- 接口路径：GET /api/articles?page=&pageSize=&categoryId=&tag=&keyword=；GET /api/articles/:id

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 分页列表 | GET /api/articles?page=1&pageSize=10 | 200 + items 仅含 A1；total=1 |
| 2 | 按分类筛选 | GET /api/articles?categoryId=c1 | 200 + 含 A1 |
| 3 | 按标签筛选 | GET /api/articles?tag=t1 | 200 + 含 A1 |
| 4 | 关键词筛选 | GET /api/articles?keyword=关键字 | 200 + 命中 A1（标题/摘要匹配） |
| 5 | 详情草稿 A2 | GET /api/articles/A2 | 404 + `error.code=40402` |

**预期结果**
已发布文章可被列表/筛选/详情消费；草稿归档对读者隐藏；跨模块读文章数据正确。

**执行状态**
- [ ] 待执行

---

### IT-012

- 标题：详情访问阅读量 +1；同 IP 5 分钟窗口去重（跨模块事件）
- 优先级：高
- 关联需求/设计：REQ-024 / SD-003 → SD-005 / INTF-011, INTF-018
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：首次详情访问 viewCount+1；同 IP 5 分钟内重复访问不重复计数；窗口过期后再访问 +1（跨模块：`reading.viewed` 事件 → SD-005 ReadingRecord store 去重写入；REQ-024）。

**前置条件**
- 认证状态：公开（详情接口）
- 数据依赖：预置已发布文章 A1；测试环境阅读去重窗口可配置（默认 5 分钟）
- 接口路径：GET /api/articles/:id ×多次

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 首次访问详情 | GET /api/articles/A1（IP=127.0.0.1） | 200 + `viewCount=1` |
| 2 | 窗口内重复访问 | 同 IP 再访问 A1（2 次） | 200 + `viewCount` 仍为 1（去重） |
| 3 | 断言 ReadingRecord store | seam-STORE 检查 | 该 IP+文章 仅 1 条去重记录（窗口内） |
| 4 | 窗口过期后访问 | 模拟推进时间越过 5 分钟后再访问 | 200 + `viewCount=2` |

**预期结果**
阅读量按「同 IP 短窗口去重」规则累计；事件写入与聚合正确（SD-005）。

**执行状态**
- [ ] 待执行

---

### IT-013

- 标题：评论发表：未认证 401；草稿文章不可评论 404
- 优先级：高
- 关联需求/设计：REQ-018 / SD-003 → SD-002 / INTF-012
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：未携带 JWT 发表评论 40101；对草稿/归档文章发表评论 404（跨模块：文章状态校验经 SD-002 article store）（参数校验 + 异常路径）。

**前置条件**
- 认证状态：reader JWT（步骤 2 用）+ 无令牌（步骤 1）
- 数据依赖：预置文章 A1（published）、A2（draft）
- 接口路径：POST /api/articles/:id/comments

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 未认证发表评论 | 无 Authorization：`{"content":"x"}` | 401 + `error.code=40101` |
| 2 | 对草稿文章评论 | 携带 reader JWT：POST /api/articles/A2/comments | 404 + `error.code=40402`（草稿不可评论） |
| 3 | 对已发布文章评论 | 携带 reader JWT：POST /api/articles/A1/comments | 201 + 评论立即可见 |
| 4 | 空内容评论 | `{"content":""}` | 400 + `error.code=40001` |

**预期结果**
评论接口认证、文章状态、内容参数三类校验均符合契约。

**执行状态**
- [ ] 待执行

---

### IT-014

- 标题：评论删除：非文章作者删除他人评论 403（跨模块归属校验）
- 优先级：高
- 关联需求/设计：REQ-018 / SD-003 → SD-001 / INTF-012
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：读者 C 发表评论 → 文章作者 B 可删（204）→ 另一读者 D 删除被拒 40301（异常路径：跨模块归属校验——文章作者校验经 SD-001 user store）。

**前置条件**
- 认证状态：文章作者 blogger JWT（B）+ 评论者 reader JWT（C）+ 第三方 reader JWT（D）
- 数据依赖：seed：博主 B + 已发布文章 A1 + 读者 C 的评论 C1
- 接口路径：DELETE /api/articles/A1/comments/:cid

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 第三方 D 删除评论 C1 | 携带 D JWT：DELETE /api/articles/A1/comments/C1 | 403 + `error.code=40301` |
| 2 | 文章作者 B 删除评论 C1 | 携带 B JWT | 204 无 body；comment store 移除 C1 |
| 3 | 删除不存在评论 | 携带 B JWT：DELETE /api/articles/A1/comments/C_ghost | 404 + `error.code=40401` |

**预期结果**
仅文章作者可删评论；第三方越权 403；删除后评论不可再查询。

**执行状态**
- [ ] 待执行

---

### IT-015

- 标题：回复评论→被回复通知（跨模块事件）
- 优先级：高
- 关联需求/设计：REQ-018, REQ-026 / SD-003 → SD-005 / INTF-012, INTF-020
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：读者 C 评论 → 博主 B 回复 → 读者 C 收到 REPLY 通知；标记已读幂等（跨模块：`comment.created` 事件 → SD-005 notification store）。

**前置条件**
- 认证状态：reader JWT（C）+ blogger JWT（B）
- 数据依赖：seed：博主 B、已发布文章 A1、读者 C 的评论 C1
- 接口路径：POST /api/articles/A1/comments/C1/reply → GET /api/me/notifications → PATCH /api/me/notifications/:nid/read

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 博主回复 C1 | 携带 B JWT：`{"content":"谢谢支持"}` | 201 + 回复挂载于 C1 |
| 2 | 读者 C 查通知 | 携带 C JWT：GET /api/me/notifications | 200 + 含 `type=REPLY` 通知，actorId=B |
| 3 | 读者 C 标记已读 | PATCH /api/me/notifications/:nid/read | 200 + `read=true` |
| 4 | 重复标记已读 | 同步骤 3 | 200（幂等） |

**预期结果**
回复事件生成被回复通知；通知归属正确（仅 C 可见）；已读幂等。

**执行状态**
- [ ] 待执行

---

### IT-016

- 标题：点赞幂等（重复点赞不重复计数）+ 被点赞通知
- 优先级：高
- 关联需求/设计：REQ-019, REQ-026 / SD-003 → SD-005 / INTF-013, INTF-020
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：读者对文章重复点赞 2 次，likeCount 只 +1（幂等）；博主收到 LIKE 通知（跨模块事件 + 幂等边界）。

**前置条件**
- 认证状态：reader JWT（C）+ blogger JWT（B，查通知）
- 数据依赖：seed：博主 B、已发布文章 A1（初始 likeCount=0）
- 接口路径：POST /api/articles/A1/like ×2 → GET /api/articles/A1 → GET /api/me/notifications（B）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 首次点赞 | 携带 C JWT：POST /api/articles/A1/like | 200 + `liked=true` |
| 2 | 重复点赞 | 同步骤 1 | 200 + `liked=true`（幂等，likeCount 不重复累计） |
| 3 | 详情校验计数 | GET /api/articles/A1 | `likeCount=1` |
| 4 | 博主查通知 | 携带 B JWT：GET /api/me/notifications | 200 + 含 `type=LIKE` 通知（仅 1 条） |

**预期结果**
点赞幂等语义成立；like store 无重复记录；被点赞通知仅产生一次。

**执行状态**
- [ ] 待执行

---

### IT-017

- 标题：收藏/取消收藏/收藏列表（幂等）
- 优先级：中
- 关联需求/设计：REQ-019 / SD-003 / INTF-013
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：收藏已发布文章 → 收藏列表可见 → 重复收藏幂等 → 取消收藏 → 列表移除（参数校验 + 幂等 + 数据一致性）。

**前置条件**
- 认证状态：reader JWT
- 数据依赖：seed：博主 B、已发布文章 A1、A2
- 接口路径：POST /api/articles/A1/favorite → GET /api/me/favorites → DELETE /api/articles/A1/favorite

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 收藏 A1 | POST /api/articles/A1/favorite | 200 + `favorited=true` |
| 2 | 重复收藏 A1 | 同步骤 1 | 200（幂等，无重复记录） |
| 3 | 收藏列表 | GET /api/me/favorites | 200 + items 含 A1（不含未收藏的 A2） |
| 4 | 取消收藏 A1 | DELETE /api/articles/A1/favorite | 200 + `favorited=false` |
| 5 | 收藏列表复查 | GET /api/me/favorites | items 不含 A1 |

**预期结果**
收藏生命周期完整；幂等与列表一致性正确。

**执行状态**
- [ ] 待执行

---

### IT-018

- 标题：关注校验：自关注 400 / 关注不存在用户 404 / 关注非博主（跨模块 user store）
- 优先级：高
- 关联需求/设计：REQ-020 / SD-003 → SD-001 / INTF-014
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：关注自己 40002；关注不存在用户 40401；关注 reader 角色用户（非博主）被拒——验证 follower/followee 身份校验在 user store 执行（P7-002 约束：`followerId/followeeId` 均为 user 实体子集，不得在 blogger store 校验；`token.sub=userId` 对齐）。

**前置条件**
- 认证状态：reader JWT（follower）
- 数据依赖：seed：reader C（follower）、blogger B、reader R（非博主）
- 接口路径：POST /api/users/:id/follow

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 关注自己 | POST /api/users/C/follow（C 自身） | 400 + `error.code=40002` |
| 2 | 关注不存在用户 | POST /api/users/u_ghost/follow | 404 + `error.code=40401` |
| 3 | 关注非博主 reader | POST /api/users/R/follow | 400 + `error.code=40002`（role 非 blogger） |
| 4 | 关注博主（对照组） | POST /api/users/B/follow | 200 + `{ followerId: C, followeeId: B }` |
| 5 | 重复关注博主 | 同步骤 4 | 200（幂等，follow store 无重复） |

**预期结果**
关注关系三类异常校验正确（自关注/不存在/非博主）；正常关注幂等；校验均走 user store。

**执行状态**
- [ ] 待执行

---

### IT-019

- 标题：关注→发布→feed 推送；取消关注后不再推送（跨模块）
- 优先级：高
- 关联需求/设计：REQ-020, REQ-012 / SD-003 → SD-002 / INTF-014, INTF-006
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：读者关注博主 → 博主发布新文章 → feed 出现该文（跨模块：SD-003 feed 经 SD-002 article store 读已发布文章）→ 取消关注 → 再发布 → feed 不含（REQ-020 取关语义）。

**前置条件**
- 认证状态：reader JWT（C）+ blogger JWT（B）
- 数据依赖：seed：博主 B（已关注关系可经步骤建立）、读者 C；B 有草稿 D1/D2
- 接口路径：POST /api/users/B/follow → POST /api/articles/D1/publish → GET /api/me/feed → DELETE /api/users/B/follow → 发布 D2 → GET /api/me/feed

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 读者关注博主 B | POST /api/users/B/follow | 200 |
| 2 | 博主发布 D1 | 携带 B JWT：POST /api/articles/D1/publish | 200 + published |
| 3 | 读者拉取 feed | 携带 C JWT：GET /api/me/feed | 200 + items 含 D1（publishedAt 降序） |
| 4 | 取消关注 | DELETE /api/users/B/follow | 200 |
| 5 | 博主再发布 D2 | POST /api/articles/D2/publish | 200 |
| 6 | 读者复查 feed | GET /api/me/feed | items 不含 D2（取关后不推送） |

**预期结果**
关注后 feed 推送新文章；取消关注后不再推送（REQ-020）。

**执行状态**
- [ ] 待执行

---

### IT-020

- 标题：热门文章：7 天阅读量 Top N（跨模块统计消费）
- 优先级：高
- 关联需求/设计：REQ-021, REQ-024 / SD-004 → SD-005 → SD-002 / INTF-015
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：多篇文章不同阅读量（构造 ReadingRecord store 数据）→ 热门接口按 7 天窗口阅读量降序返回 Top N；仅含 published 文章（跨模块：SD-004 经 SD-005 统计 + SD-002 文章）。

**前置条件**
- 认证状态：公开（无认证）
- 数据依赖：seed：3 篇已发布文章（阅读量 A1=10、A2=5、A3=0，经 ReadingRecord store 构造）；1 篇草稿 A4（高阅读量数据）
- 接口路径：GET /api/articles/hot?limit=N

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 热门 Top 3 | GET /api/articles/hot?limit=3 | 200 + 顺序 A1(10) > A2(5) > A3(0)；草稿 A4 不出现 |
| 2 | 默认 limit | GET /api/articles/hot | 200 + items ≤10（默认） |
| 3 | limit 越界 | GET /api/articles/hot?limit=0 | 400 + `error.code=40002` |
| 4 | 7 天窗口外数据 | seed 一条 8 天前阅读记录 | 不计入 viewCount7d |

**预期结果**
热门按 7 天窗口阅读量正确排序；仅 published；参数边界符合契约。

**执行状态**
- [ ] 待执行

---

### IT-021

- 标题：个性化推荐：标签偏好 vs 冷启动热门回退（跨模块）
- 优先级：中
- 关联需求/设计：REQ-022, REQ-024 / SD-004 → SD-005 → SD-002 / INTF-016
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：有阅读历史的用户获得标签偏好推荐（reason=tag-preference）；无历史/无 JWT 用户回退热门（reason=hot-fallback）（跨模块：SD-004 经 SD-005 ReadingRecord 读历史 + SD-002 文章）。

**前置条件**
- 认证状态：reader JWT（C，有历史）+ 匿名（无历史）
- 数据依赖：seed：读者 C 阅读过含 tag=t1 的文章；文章 A1（tag=t1）、A2（tag=t2）、热门文章 A3
- 接口路径：GET /api/me/recommendations?limit=

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 有历史用户推荐 | 携带 C JWT：GET /api/me/recommendations | 200 + 推荐含与 t1 相关文章，reason=tag-preference |
| 2 | 匿名冷启动 | 无 Authorization 请求 | 200 + reason=hot-fallback（回退热门） |
| 3 | 无历史新用户 | 携带新注册用户 JWT（无阅读记录） | 200 + reason=hot-fallback |
| 4 | 无效令牌 | 携带伪造 JWT | 401 + `error.code=40101` |

**预期结果**
推荐逻辑按「有历史→标签偏好 / 无历史→热门回退」正确分流；可选 JWT 语义成立。

**执行状态**
- [ ] 待执行

---

### IT-022

- 标题：全文搜索：四字段命中 + 分页 + 相关性排序
- 优先级：中
- 关联需求/设计：REQ-023 / SD-004 → SD-002 / INTF-017
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：关键词在标题/正文/摘要/标签四字段检索；标题命中排前（相关性权重：标题 > 标签 > 摘要 > 正文）；分页与 total 正确；仅 published（跨模块：SD-004 SearchIndex 消费 + SD-002 文章数据）。

**前置条件**
- 认证状态：公开（无认证）
- 数据依赖：seed：A1（标题含关键词 X）、A2（仅正文含 X）、A3（仅标签含 X）、A4（draft 含 X）
- 接口路径：GET /api/search?q=&page=&pageSize=

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 关键词检索 | GET /api/search?q=X | 200 + items 含 A1/A2/A3，不含 A4（draft） |
| 2 | 相关性排序 | 检查 score/顺序 | A1（标题命中）排最前 |
| 3 | 分页 | GET /api/search?q=X&page=1&pageSize=2 | 200 + total=3，items 长度=2 |
| 4 | 空关键词 | GET /api/search?q= | 400 + `error.code=40001`（q 必填） |
| 5 | 超长关键词 | q 长度 101 | 400 + `error.code=40002` |

**预期结果**
四字段检索、相关性排序、分页与参数校验均符合契约。

**执行状态**
- [ ] 待执行

---

### IT-023

- 标题：博主统计面板：跨模块聚合（文章/阅读/评论）
- 优先级：中
- 关联需求/设计：REQ-025 / SD-005 → SD-002 → SD-003 / INTF-019
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：博主面板聚合本博文章数、总阅读量、总评论数、近 7 天趋势（跨模块：SD-005 经 SD-002 article store 计数、经 SD-003 comment store 计数、本模块 ReadingRecord 聚合）；reader 调用 403。

**前置条件**
- 认证状态：blogger JWT（B）+ reader JWT（越权对照组）
- 数据依赖：seed：博主 B：2 篇文章（总阅读量=15）、3 条评论；7 天趋势数据（D1=5, D3=3）
- 接口路径：GET /api/blogger/stats

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 博主查面板 | 携带 B JWT：GET /api/blogger/stats | 200 + `articleCount=2, totalViews=15, totalComments=3` |
| 2 | 趋势断言 | 检查 trend | 7 项数组；D1=5、D3=3、无记录日补 0 |
| 3 | reader 越权 | 携带 reader JWT 调用 | 403 + `error.code=40301` |
| 4 | 未认证 | 无 Authorization | 401 + `error.code=40101` |

**预期结果**
面板四指标跨模块聚合正确；权限边界成立。

**执行状态**
- [ ] 待执行

---

### IT-024

- 标题：通知列表分页 + 标记已读 + 他人通知 404（防枚举）
- 优先级：高
- 关联需求/设计：REQ-026 / SD-005 / INTF-020
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：通知列表按时间降序、分页、unreadOnly 过滤；标记已读后 read 更新；访问他人通知 40401（异常路径 + 数据隔离）。

**前置条件**
- 认证状态：reader JWT（C）+ 另一用户 JWT（D）
- 数据依赖：seed：C 有 3 条通知（2 未读 1 已读，createdAt 递减）；通知 N1 未读
- 接口路径：GET /api/me/notifications；PATCH /api/me/notifications/:id/read

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 列表分页 | GET /api/me/notifications?page=1&pageSize=2 | 200 + items 长度 2，按 createdAt 降序，total=3 |
| 2 | 未读过滤 | GET /api/me/notifications?unreadOnly=true | 200 + 仅 2 条未读 |
| 3 | 标记已读 | PATCH /api/me/notifications/N1/read | 200 + `read=true` |
| 4 | 他人通知访问 | 携带 D JWT：PATCH /api/me/notifications/N1/read | 404 + `error.code=40401`（防枚举） |

**预期结果**
通知列表/已读/隔离语义正确；他人通知不可见。

**执行状态**
- [ ] 待执行

---

### IT-025

- 标题：RSS 只含已发布文章（跨模块）
- 优先级：中
- 关联需求/设计：REQ-027 / SD-006 → SD-002 → SD-001 / INTF-021
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：RSS 源返回博主已发布文章（标题/链接/摘要/发布时间），草稿/归档不暴露；博主不存在 404（跨模块：SD-006 经 SD-002 article store + SD-001 user store 校验）。

**前置条件**
- 认证状态：公开（RSS 阅读器拉取）
- 数据依赖：seed：博主 B：A1（published）、A2（draft）、A3（archived）
- 接口路径：GET /api/bloggers/:id/rss

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 拉取 RSS | GET /api/bloggers/B/rss | 200 + `Content-Type: application/rss+xml` |
| 2 | 断言 XML 内容 | 解析 RSS 2.0 | channel.title=博主名；items 仅 A1（无 A2/A3）；item 含 title/link/description/pubDate |
| 3 | 拉取不存在博主 RSS | GET /api/bloggers/u_ghost/rss | 404 + `error.code=40401` |
| 4 | 拉取非博主 RSS | GET /api/bloggers/R/rss（R 为 reader） | 404 + `error.code=40401` |

**预期结果**
RSS 仅含已发布文章；博主存在性与角色校验正确。

**执行状态**
- [ ] 待执行

---

### IT-026

- 标题：统一参数校验 40001/40002/60003（抽样覆盖全部接口）
- 优先级：高
- 关联需求/设计：REQ-007~028（参数面）/ SD-007 / INTF-001~022（CON-002）
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：对代表性接口做参数校验抽样：邮箱格式、密码长度、分页越界、标题超长、分类深度超限 60003、PATCH 资料非法字段——验证 zod 校验中间件统一映射错误码（参数校验 + 边界）。

**前置条件**
- 认证状态：公开或 JWT 视用例（注册/登录公开；PATCH 资料、创建文章需 JWT）
- 数据依赖：seed：博主 B、分类 c1（depth=3，可作父分类）
- 接口路径：POST /api/auth/register、PATCH /api/users/me、POST /api/articles、GET /api/articles?page=、POST /api/categories

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 非法邮箱注册 | `{"username":"u","email":"bad-email","password":"Passw0rd!x"}` | 400 + `error.code=40001` |
| 2 | 密码过短注册 | password="123" | 400 + `error.code=40001` 或 40002 |
| 3 | 分页越界 | GET /api/articles?page=0 | 400 + `error.code=40002` |
| 4 | 标题超长 | 创建文章 title=201 字符 | 400 + `error.code=40002` |
| 5 | PATCH 资料非法头像 | PATCH /api/users/me `{"avatarUrl":"ftp://x"}` | 400 + `error.code=40002` |
| 6 | 分类深度超限 | 在 depth=3 分类下创建子分类 | 400 + `error.code=60003` |

**预期结果**
参数错误统一映射 4xx 错误码（40001/40002）；分类深度业务约束 60003；无 500 误报。

**执行状态**
- [ ] 待执行

---

### IT-027

- 标题：统一错误响应结构 `{ error: { code, message } }`（CON-002 抽样）
- 优先级：高
- 关联需求/设计：CON-002 / SD-007 / 全部 INTF
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：对 4xx/5xx/业务错误抽样断言错误响应结构与错误码分层（4xx/5xx/6xxxx 三段位）一致；成功响应结构 `{ code:0, message, data }`（契约横切验证）。

**前置条件**
- 认证状态：混合（公开/认证各采样）
- 数据依赖：seed：博主 B、已发布文章 A1；触发各段位错误的数据
- 接口路径：POST /api/auth/register（409 路径）、POST /api/articles（403 路径）、GET /api/articles/A1（200）、GET /api/articles/A_draft（40402）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 4xx 错误抽样 | 重复注册（409）、越权发文（403）、分页越界（400） | 均 `{ error: { code, message } }`，code ∈ 40000-49999 |
| 2 | 业务错误抽样 | 状态机非法（60001） | `{ error: { code: 60001, message } }`，code ∈ 60000-69999 |
| 3 | 成功响应抽样 | 详情 200 | `{ code: 0, message, data }` |
| 4 | 错误码四元组一致性 | 对照接口设计 §0.3 | code↔httpStatus↔retryable 映射一致 |

**预期结果**
全接口错误结构统一（CON-002）；错误码分层三段位齐备。

**执行状态**
- [ ] 待执行

---

### IT-028

- 标题：令牌过期 40102 → 重新登录恢复（CON-003）
- 优先级：高
- 关联需求/设计：REQ-008, CON-003 / SD-001, SD-007 / INTF-002, INTF-005
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：签发 JWT 后模拟时间越过 24h（或注入过期 token）→ 访问受保护接口 40102 → 重新登录新 JWT 恢复访问（异常路径 + 认证生命周期）。

**前置条件**
- 认证状态：blogger JWT（将过期）+ 重新登录后的新 JWT
- 数据依赖：预置博主 B；测试注入过期 token（`JWT_SECRET=test-*` 可自行签发 exp 已过的 token，CON-003）
- 接口路径：POST /api/articles（携带过期 token）→ POST /api/auth/login → POST /api/articles（新 token）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 携带过期 token 创建文章 | 过期 JWT：POST /api/articles | 401 + `error.code=40102` |
| 2 | 重新登录 | `{"identifier":"B","password":"..."}` | 200 + 新 token |
| 3 | 新 token 重试 | 携带新 JWT：POST /api/articles | 201（恢复正常） |

**预期结果**
令牌过期被 40102 拦截；重新登录后可恢复访问（CON-003 24h 有效期语义）。

**执行状态**
- [ ] 待执行

---

### IT-029

- 标题：越权修改/删除他人文章 403（跨模块归属校验）
- 优先级：高
- 关联需求/设计：REQ-014 / SD-002 → SD-001 / INTF-008
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：博主 A 修改/删除博主 B 的文章被拒 40301——验证文章归属校验（跨模块：SD-002 经 SD-001 user store 比对作者身份）。

**前置条件**
- 认证状态：博主 A JWT（越权方）+ 博主 B JWT（作者）
- 数据依赖：seed：博主 A、博主 B + 文章 A1（作者 B，draft）
- 接口路径：PUT /api/articles/A1；DELETE /api/articles/A1

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 博主 A 修改 B 的文章 | 携带 A JWT：PUT /api/articles/A1 `{"title":"篡改"}` | 403 + `error.code=40301`；A1 内容不变 |
| 2 | 博主 A 删除 B 的文章 | 携带 A JWT：DELETE /api/articles/A1 | 403 + `error.code=40301` |
| 3 | 博主 B 管理列表隔离 | 携带 B JWT：GET /api/blogger/articles | 仅含 B 的文章（A1 在内，未被 A 影响） |
| 4 | 作者 B 正常删除 | 携带 B JWT：DELETE /api/articles/A1 | 204（对照组） |

**预期结果**
越权修改/删除被拒且数据未被污染；作者本人操作正常。

**执行状态**
- [ ] 待执行

---

### IT-030

- 标题：审计日志：登录/发布/删除留痕（CON-004）
- 优先级：中
- 关联需求/设计：CON-004 / SD-007 / INTF-002, INTF-006, INTF-008
- 关联 BDD feature：—（S-bdd 阶段产出后回填）
- 测试场景：执行登录、发布、删除三类关键操作后断言 AuditLog store 产生对应记录（操作类型/主体/资源/时间戳）；非关键操作（如浏览）不产生审计（横切中间件与业务链路集成）。

**前置条件**
- 认证状态：blogger JWT
- 数据依赖：seed：博主 B + 草稿 A1；seam-STORE 读 AuditLog store
- 接口路径：POST /api/auth/login → POST /api/articles/A1/publish → DELETE /api/articles/A2(draft) → GET /api/articles（对照组）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 登录 | POST /api/auth/login | 200 + AuditLog 新增 1 条（type=login，actor=B） |
| 2 | 发布文章 | POST /api/articles/A1/publish | 200 + AuditLog 新增 1 条（type=publish，resource=article:A1） |
| 3 | 删除草稿 | DELETE /api/articles/A2 | 204 + AuditLog 新增 1 条（type=delete，resource=article:A2） |
| 4 | 浏览列表（对照） | GET /api/articles | 200 + 不新增审计记录 |

**预期结果**
登录/发布/删除三类关键操作留痕（CON-004）；只读操作不误审计。

**执行状态**
- [ ] 待执行

---

## 用例汇总

| 用例 ID | 标题 | 优先级 | 关联 | 状态 |
|---|---|---|---|---|
| IT-001 | 注册→登录→申请博主 身份链路 + 409/401 | 高 | INTF-001~003 / SD-001 | 待执行 |
| IT-002 | 登录限流 10 次/分 → 429 | 高 | INTF-002 / SD-007 | 待执行 |
| IT-003 | 创建文章非博主 403（跨模块校验） | 高 | INTF-005 / SD-002→SD-001 | 待执行 |
| IT-004 | 标签/分类不存在 404 + 重名 409 | 高 | INTF-005/009/010 / SD-002 | 待执行 |
| IT-005 | 发布/归档状态机非法流转 60001 | 高 | INTF-006/007 / SD-002 | 待执行 |
| IT-006 | 发布→Webhook 回调成功（HMAC 验签） | 高 | INTF-006/022 / SD-002→SD-006 | 待执行 |
| IT-007 | Webhook 回调失败重试 ≤3 次 + 失败记录 | 高 | INTF-006/022 / SD-006（NFR-003） | 待执行 |
| IT-008 | 评论→Webhook comment.created 分发 | 高 | INTF-012/022 / SD-003→SD-006 | 待执行 |
| IT-009 | 归档→取消归档 状态机回 draft | 高 | INTF-007 / SD-002 | 待执行 |
| IT-010 | 删除已发布 409 / 删草稿 204 | 高 | INTF-008 / SD-002 | 待执行 |
| IT-011 | 浏览列表/详情 草稿归档不可见 | 高 | INTF-011 / SD-003→SD-002 | 待执行 |
| IT-012 | 详情阅读量 +1 同 IP 去重 | 高 | INTF-011/018 / SD-003→SD-005 | 待执行 |
| IT-013 | 评论未认证 401 / 草稿不可评论 404 | 高 | INTF-012 / SD-003→SD-002 | 待执行 |
| IT-014 | 评论删除非作者 403 | 高 | INTF-012 / SD-003→SD-001 | 待执行 |
| IT-015 | 回复→被回复通知 | 高 | INTF-012/020 / SD-003→SD-005 | 待执行 |
| IT-016 | 点赞幂等 + 被点赞通知 | 高 | INTF-013/020 / SD-003→SD-005 | 待执行 |
| IT-017 | 收藏/取消/收藏列表 幂等 | 中 | INTF-013 / SD-003 | 待执行 |
| IT-018 | 关注自关注 400 / 不存在 404 / 非博主 | 高 | INTF-014 / SD-003→SD-001 | 待执行 |
| IT-019 | 关注→发布→feed；取关后不推送 | 高 | INTF-014/006 / SD-003→SD-002 | 待执行 |
| IT-020 | 热门 7 天阅读量 Top N | 高 | INTF-015 / SD-004→SD-005 | 待执行 |
| IT-021 | 推荐标签偏好 vs 冷启动回退 | 中 | INTF-016 / SD-004→SD-005 | 待执行 |
| IT-022 | 搜索四字段 + 分页 + 相关性 | 中 | INTF-017 / SD-004→SD-002 | 待执行 |
| IT-023 | 博主统计面板跨模块聚合 | 中 | INTF-019 / SD-005→SD-002→SD-003 | 待执行 |
| IT-024 | 通知分页 + 已读 + 他人通知 404 | 高 | INTF-020 / SD-005 | 待执行 |
| IT-025 | RSS 只含已发布文章 | 中 | INTF-021 / SD-006→SD-002 | 待执行 |
| IT-026 | 统一参数校验 40001/40002/60003 | 高 | INTF-001~022 / SD-007 | 待执行 |
| IT-027 | 统一错误响应结构 CON-002 | 高 | 全部 INTF / SD-007 | 待执行 |
| IT-028 | 令牌过期 40102 → 重新登录 | 高 | INTF-002/005 / SD-001 | 待执行 |
| IT-029 | 越权修改/删除他人文章 403 | 高 | INTF-008 / SD-002→SD-001 | 待执行 |
| IT-030 | 审计日志 登录/发布/删除留痕 | 中 | INTF-002/006/008 / SD-007 | 待执行 |

## 测试用例覆盖说明

- 功能点覆盖：22/22 个接口方向（INTF-001~022 均有对应 IT 用例）；32/32 RTM 行（REQ 22 行 + NFR/CON 相关行已映射，见 RTM）
- 覆盖类型统计：
  - 跨模块调用（含事件数据流）：IT-001/003/006/007/008/011/012/015/016/018/019/020/021/023/025/029 = 16 条
  - 参数校验（非法/边界/必填）：IT-004/013/017/018/022/026 = 6 条
  - 异常路径（401/403/404/409/429/60001/60002/重试失败）：IT-002/005/007/009/010/013/014/018/024/025/028/029 = 12 条（与跨模块/参数校验部分重叠）
  - 幂等边界：IT-001(申请博主)/005(重复发布)/009(标记已读)/016(点赞)/017(收藏)/018(关注) = 6 条
- 边界条件覆盖：分页越界（IT-026）、分类深度 ≤3（IT-026）、阅读去重窗口（IT-012）、7 天热门窗口（IT-020）、JWT 24h 过期（IT-028）、Webhook 重试 ≤3（IT-007）
- 错误码三段位覆盖：4xx（IT-002/003/011/013/014/018/024/026/028/029）、5xx（IT-006/007 经投递记录、IT-027 抽样）、业务 6xxxx（IT-005/010/026）
