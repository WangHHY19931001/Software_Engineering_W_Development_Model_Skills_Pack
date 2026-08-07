# 系统测试用例设计文档

> 阶段 2（系统设计）同步设计的系统测试用例（ST）。阶段 7（系统测试）执行。
> 套用 templates/test-case.md，type=系统测试。测试 seam：HTTP API（见系统设计文档 §6 测试 seam 决策，主 seam = S1）。
> 阶段产物验证用例（TC-DES-*）校验本阶段产出物合格，不登记 RTM；运行时测试用例（ST-*）登记 RTM systemTest 列。

## 文档信息

- 项目名称：博客系统后端（blog-system-demo-r34）
- 测试类型：系统测试
- 设计来源阶段：阶段 2（系统设计）
- 执行阶段：阶段 7（系统测试）
- 文档版本：v1.0
- 编制日期：2026-08-07
- 编制者：S-doc（阶段 2 系统设计子代理，dispatchId=phase2-S-doc-02）
- 关联系统设计文档：docs/phase2-design/blog-system-system-design.md
- 关联验收测试设计：docs/phase1-requirements/acceptance-test-design.md（91 UAT，阶段 8 执行）

## 用例列表

### TC-DES-001

- 标题：系统架构设计验证
- 优先级：高
- 关联需求/设计：需求规格说明书（32 需求）；系统设计文档 blog-system-system-design.md
- 关联 BDD feature：无（阶段产物验证用例）
- 测试场景：校验阶段 2 系统设计产出物是否合格（架构图/技术选型矩阵/模块划分/部署图/seam 决策）

**前置条件**

需求规格说明书已发布（32 需求 = 22 REQ + 6 NFR + 4 CON）；系统设计文档已产出。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 核对架构图 | 系统设计文档 §1.1 | Mermaid C4 组件图存在，体现分层（API 层/服务层/数据访问层）+ 组件依赖 + `-.->` 数据流标注，非纯模块框图 |
| 2 | 核对架构风格说明 | 系统设计文档 §1.2 | 明确分层单体 + 内存存储架构风格与选择理由 |
| 3 | 核对技术选型决策矩阵 | 系统设计文档 §2 | 每个候选技术按 5 维度（适用性/成熟度/可维护性/引入成本/风险敞口）评分 + 加权总分 + 一句话选型理由；覆盖 Web 框架（Express 4 最优且满足 CON-001）、校验（zod）、认证（jsonwebtoken）、存储（内存 Map，CON-002） |
| 4 | 核对模块划分 | 系统设计文档 §3 | 模块 ID M-001~M-021，职责 + 关联需求齐全，依赖方向单向无循环 |
| 5 | 核对部署架构 | 系统设计文档 §4 | Mermaid 部署图含节点 + 进程 + 数据流 |
| 6 | 核对测试 seam 决策 | 系统设计文档 §6 | 候选 seam 列表 + 选定主/辅 seam + 理由（to-spec fewer seams better） |

**预期结果**

全部 6 项核对通过：架构图含数据流标注、选型矩阵 5 维度评分完整、模块无循环依赖、部署图完整、seam 决策符合方法论。

**执行状态**

- [x] 待执行（阶段 2 自检通过）
- [ ] 通过（阶段门评审）
- [ ] 失败 —— 失败原因：{{}}

---

### TC-DES-005

- 标题：系统测试用例生成
- 优先级：高
- 关联需求/设计：系统设计文档 §5 系统测试用例索引
- 关联 BDD feature：无（阶段产物验证用例）
- 测试场景：校验系统测试用例文档是否覆盖系统级功能（端到端 + 性能基线 + 安全基线 + 跨模块集成），且与 RTM systemTest 列一致

**前置条件**

系统设计文档已产出；系统测试用例文档 blog-system-system-test.md 已产出。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 核对强制用例存在 | 系统测试用例文档 | TC-DES-007（端到端，ST-001）、TC-DES-008（性能基线，ST-002）、TC-DES-009（安全基线，ST-003）全部存在 |
| 2 | 核对跨模块集成覆盖 | 系统测试用例文档 | ST-004~ST-013 覆盖认证+文章、评论+审核、订阅+通知、审计+RSS、Webhook+重试、限流 429 等场景 |
| 3 | 核对用例格式 | 系统测试用例文档 | 每条 ST 含标题/优先级/关联需求/关联 BDD feature/场景/前置条件/步骤表/预期结果/执行状态 |
| 4 | 核对 RTM 一致性 | .w-model/rtm.json | 32 行 systemTest 列已登记 ST 用例 ID；设计文档 §5 索引与 RTM 登记一致 |

**预期结果**

强制用例（TC-DES-007/008/009）存在；ST 用例覆盖全部系统级功能与跨模块集成；格式合规；RTM systemTest 列 32 行全覆盖。

**执行状态**

- [x] 待执行（阶段 2 自检通过）
- [ ] 通过（阶段门评审）
- [ ] 失败 —— 失败原因：{{}}

---

### TC-DES-007 端到端流程设计（产出 ST-001）

- 标题：端到端流程（注册→登录→发布文章→浏览→评论→通知全链路）
- 优先级：高
- 关联需求/设计：REQ-001, REQ-003, REQ-004, REQ-006, REQ-007, REQ-008, REQ-009, REQ-016；系统设计文档 §5（ST-001）
- 关联 BDD feature：BDD-L2-<pending>（待 S-bdd 补全）
- 测试场景：验证核心业务全链路（访客注册→登录→开通博主→发布文章→浏览→评论→通知）跨模块端到端正确性

**前置条件**

认证：混合（注册阶段无需认证，其后全部 Bearer token）；数据：无初始数据（全链路自造）；路径：POST /api/auth/register、POST /api/auth/login、POST /api/bloggers、POST /api/posts、GET /api/posts/:id、POST /api/posts/:id/comments、GET /api/notifications、PATCH /api/notifications/:id/read

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 访客注册（作者 A） | POST /api/auth/register `{"email":"author@ex.com","password":"pass123456"}` | 201，含 userId/tokenA |
| 2 | 作者 A 登录 | POST /api/auth/login 同上凭据 | 200，JWT 可访问受保护接口 |
| 3 | 作者 A 开通博主 | POST /api/bloggers `{"displayName":"博主甲"}`（Bearer tokenA） | 201，含 bloggerId |
| 4 | 作者 A 创建并发布文章 | POST /api/posts `{"title":"T1","content":"C1","status":"published"}`（Bearer tokenA） | 201，status=published |
| 5 | 访客浏览公开文章 | GET /api/posts/:id（无认证） | 200，文章内容，viewCount=1 |
| 6 | 用户 B 注册并评论文章 | POST /api/auth/register（用户 B）→ POST /api/posts/:id/comments `{"content":"好文"}`（Bearer tokenB） | 201，评论创建成功 |
| 7 | 作者 A 查询通知 | GET /api/notifications（Bearer tokenA） | 200，含「新评论」通知（unread） |
| 8 | 作者 A 标记通知已读 | PATCH /api/notifications/:id/read（Bearer tokenA） | 200，通知状态变为已读 |

**预期结果**

全链路各步骤状态码与数据一致：注册→登录→开通博主→发布→浏览（viewCount+1）→评论→通知生成→已读；跨模块数据（文章/评论/通知）可追溯。

**执行状态**

- [ ] 待执行（阶段 7 执行）
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### ST-001 端到端全链路（对应 TC-DES-007）

- 标题：端到端全链路（注册→登录→发布文章→浏览→评论→通知）
- 优先级：高
- 关联需求/设计：REQ-001, REQ-003, REQ-004, REQ-006, REQ-007, REQ-008, REQ-009, REQ-016（M-001/M-003/M-004/M-005/M-006/M-012）
- 关联 BDD feature：BDD-L2-<pending>（待 S-bdd 补全）
- 测试场景：系统级核心业务主链路端到端验证（同 TC-DES-007 详设，阶段 7 执行）

**前置条件**

服务已启动（或 supertest 加载 app）；无初始数据；Webhook 投递目标未配置（不影响本用例）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 访客注册作者 A | POST /api/auth/register | 201 + tokenA |
| 2 | 作者 A 登录 | POST /api/auth/login | 200 + JWT |
| 3 | 作者 A 开通博主 | POST /api/bloggers（Bearer tokenA） | 201 + bloggerId |
| 4 | 作者 A 发布文章 | POST /api/posts（Bearer tokenA, status=published） | 201 published |
| 5 | 访客浏览 | GET /api/posts/:id | 200 + viewCount 递增 |
| 6 | 用户 B 评论 | POST /api/auth/register（B）→ POST /api/posts/:id/comments | 201 评论 |
| 7 | 作者 A 查通知 | GET /api/notifications（Bearer tokenA） | 200 含未读评论通知 |
| 8 | 作者 A 标记已读 | PATCH /api/notifications/:id/read | 200 已读 |

**预期结果**

全链路成功，各步骤状态码符合验收标准（201/200），通知经事件总线（M-021）正确生成与流转；无 5xx。

**执行状态**

- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### TC-DES-008 性能基线设计（产出 ST-002）

- 标题：性能基线（P95 < 2s，100 QPS 持续 10min）
- 优先级：高
- 关联需求/设计：NFR-001, NFR-003, NFR-005（系统设计文档 §5，ST-002）
- 关联 BDD feature：BDD-L2-<pending>（待 S-bdd 补全）
- 测试场景：系统级性能基线验证——100 QPS 持续 10 分钟混合读负载下 P95 响应时间达标、零 5xx、峰值内存可控

**前置条件**

认证：无需（读接口）；数据：≥10 篇公开文章；路径：GET /api/posts（列表）、GET /api/posts/:id（详情）、GET /api/search（搜索）；工具：压测脚本（autocannon 或自定义并发循环）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 预热 | 200 次混合读请求 | 无超时，建立稳定状态 |
| 2 | 加载持续压测 | 100 QPS 持续 10min（列表/详情/搜索混合） | 压测完成无中断 |
| 3 | 采集 P95 | 压测工具输出的响应时间分布 | P95 < 2s（系统级粗基线；NFR-001 细粒度阈值按 testThreshold：CI ≤ 400ms 判定） |
| 4 | 统计 5xx | 压测工具错误计数 | 5xx 错误率 = 0%（NFR-003） |
| 5 | 测量峰值内存 | process.memoryUsage 采样 | 峰值内存 ≤ 150MB（CI 阈值，NFR-005） |

**预期结果**

100 QPS 持续 10min 下 P95 < 2s、5xx 错误率 0%、峰值内存 ≤ 150MB（CI）。注：NFR-001 生产目标 P95 ≤ 200ms 属验收级细粒度基线，本用例为系统级压力基线，阶段 7 实测数据回填后按双阈值（targetValue/testThreshold）综合判定。

**执行状态**

- [ ] 待执行（阶段 7 执行）
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### ST-002 性能基线（对应 TC-DES-008）

- 标题：性能基线（P95 < 2s，100 QPS 持续 10min）
- 优先级：高
- 关联需求/设计：NFR-001, NFR-003, NFR-005（横切，M-017/M-018/M-020）
- 关联 BDD feature：BDD-L2-<pending>（待 S-bdd 补全）
- 测试场景：系统级性能/可靠性/内存基线（同 TC-DES-008 详设，阶段 7 执行）

**前置条件**

服务以生产模式启动（JWT_SECRET 注入）；≥10 篇公开文章；压测脚本就绪。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 预热 | 200 次混合读 | 稳定响应 |
| 2 | 持续压测 | 100 QPS × 10min | 完成无中断 |
| 3 | 采集 P95 | 响应时间分布 | P95 < 2s |
| 4 | 统计 5xx | 错误计数 | 5xx 错误率 = 0% |
| 5 | 测峰值内存 | 内存采样 | ≤ 150MB（CI 阈值） |

**预期结果**

P95 < 2s、5xx = 0%、峰值内存 ≤ 150MB；数据记录至系统测试报告供 NFR 双阈值判定。

**执行状态**

- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### TC-DES-009 安全基线设计（产出 ST-003）

- 标题：安全基线（SQL 注入 / XSS / CSRF 防御验证）
- 优先级：高
- 关联需求/设计：NFR-002（系统设计文档 §5，ST-003）
- 关联 BDD feature：BDD-L2-<pending>（待 S-bdd 补全）
- 测试场景：系统级安全基线——注入攻击、XSS 载荷、CSRF 攻击面与越权（401/403）防御验证

**前置条件**

认证：混合（部分用例需 token）；数据：≥1 篇公开文章 + 1 个认证用户；路径：GET /api/search、GET /api/posts/:id、POST /api/posts/:id/comments、GET /api/users/me

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | SQL 注入探测 | `GET /api/search?q=' OR 1=1--`、`q='; DROP TABLE posts;--` | 不返回非预期数据/无 500（内存存储无 SQL 面，注入载荷被按普通关键词处理或 400 拒绝） |
| 2 | XSS 载荷存储与回显 | POST /api/posts（content 含 `<script>alert(1)</script>`）后 GET 详情 | 内容按纯文本/转义输出，无脚本执行面 |
| 3 | CSRF 攻击面验证 | 无 Cookie 会话模型：未带 Authorization 头调用变更接口（POST /api/posts/:id/comments） | 401 拒绝（JWT Bearer 模式不自动携带凭据，跨站伪造请求无法通过认证） |
| 4 | 越权防护 | 他人 token 访问 GET /api/users/me、DELETE 他人文章 | 未认证 401；越权 403（NFR-002 AC1） |
| 5 | 密码存储 | 注册后检查存储 | 密码为 bcrypt 哈希非明文（NFR-002 AC2） |
| 6 | 密钥治理 | 静态检查 JWT_SECRET 来源与日志 | JWT_SECRET 经环境变量注入、无硬编码默认值、密钥不入日志（NFR-002 AC3 / UAT-091） |

**预期结果**

注入载荷不产生非预期数据访问；XSS 载荷无执行面；CSRF 无可利用面（Bearer token + 无 Cookie 会话）；未认证 401 / 越权 403 全覆盖；密码哈希存储；密钥治理合规。

**执行状态**

- [ ] 待执行（阶段 7 执行）
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### ST-003 安全基线（对应 TC-DES-009）

- 标题：安全基线（SQL 注入 / XSS / CSRF 防御验证）
- 优先级：高
- 关联需求/设计：NFR-002（M-001/M-017/M-019）
- 关联 BDD feature：BDD-L2-<pending>（待 S-bdd 补全）
- 测试场景：系统级安全防御验证（同 TC-DES-009 详设，阶段 7 执行）

**前置条件**

服务启动；公开文章 + 认证用户就绪；压测/探测脚本就绪。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | SQL 注入探测 | 搜索/筛选接口注入载荷 | 无越权数据/无 500 |
| 2 | XSS 载荷回显 | 文章内容含 `<script>` | 转义/纯文本输出，无执行 |
| 3 | CSRF 验证 | 变更接口无 Authorization | 401 拒绝 |
| 4 | 越权验证 | 他人 token / 无 token | 401 / 403 精确拒绝 |
| 5 | 密码哈希检查 | 注册后存储检查 | bcrypt 哈希 |
| 6 | JWT_SECRET 治理 | 静态检查 | 环境变量注入、无默认值、不入日志 |

**预期结果**

与 TC-DES-009 相同：注入/XSS/CSRF 防御有效；401/403 全覆盖；哈希存储与密钥治理合规。

**执行状态**

- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### ST-004 认证+文章集成

- 标题：认证与文章管理的跨模块集成（未认证/越权/404 全链路）
- 优先级：高
- 关联需求/设计：REQ-002, REQ-003, REQ-006, REQ-007（M-001/M-002/M-004/M-017）
- 关联 BDD feature：BDD-L2-<pending>（待 S-bdd 补全）
- 测试场景：认证上下文在文章管理链路中的强制生效——无 token、伪造 token、非作者操作、不存在资源

**前置条件**

认证：作者 A token + 用户 B token；数据：博主 A 已发布文章 P1、草稿 D1；路径：GET /api/users/me、POST /api/posts、PUT /api/posts/:id、PATCH /api/posts/:id/status、DELETE /api/posts/:id

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 未认证访问资料 | GET /api/users/me（无 Authorization） | 401 |
| 2 | 伪造/过期 token | GET /api/users/me（Bearer invalid） | 401 |
| 3 | 非作者更新文章 | PUT /api/posts/P1（Bearer B） | 403 越权 |
| 4 | 非作者改状态 | PATCH /api/posts/D1/status（Bearer B） | 403 |
| 5 | 操作不存在文章 | PUT /api/posts/99999（Bearer A） | 404 |
| 6 | 认证用户更新资料 | PUT /api/users/me（Bearer A，合法字段） | 200 生效 |

**预期结果**

401/403/404 精确返回；认证上下文正确传递；越权零放行。

**执行状态**

- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### ST-005 评论+审核集成

- 标题：评论发表与博主审核的可见性流转
- 优先级：高
- 关联需求/设计：REQ-009, REQ-010（M-006/M-007）
- 关联 BDD feature：BDD-L2-<pending>（待 S-bdd 补全）
- 测试场景：评论创建 → 审核通过/拒绝 → 公开可见性变化；越权/边界拒绝

**前置条件**

认证：博主 A token + 用户 B token；数据：博主 A 公开文章 P1；路径：POST /api/posts/:id/comments、DELETE /api/comments/:id、PATCH /api/comments/:id/review、GET /api/posts/:id

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 用户 B 评论 P1 | POST /api/posts/P1/comments（Bearer B） | 201 |
| 2 | 博主 A 审核通过 | PATCH /api/comments/:id/review（Bearer A, `{"action":"approve"}`） | 200，评论公开可见 |
| 3 | 审核拒绝隐藏 | 新评论 → `{"action":"reject"}` | 200，评论公开列表不可见 |
| 4 | 非博主审核 | PATCH /api/comments/:id/review（Bearer B） | 403 |
| 5 | 空/超长评论 | content 为空 / 1001 字符 | 400 |
| 6 | 评论不存在文章 | POST /api/posts/99999/comments | 404 |
| 7 | 非评论作者删除 | DELETE /api/comments/:id（Bearer B 删 A 的评论） | 403 |

**预期结果**

审核状态驱动可见性正确流转；400/403/404 边界齐全。

**执行状态**

- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### ST-006 订阅+通知集成

- 标题：订阅博主、关注/评论事件生成通知与已读流转
- 优先级：高
- 关联需求/设计：REQ-005, REQ-016, REQ-017（M-003/M-012/M-013）
- 关联 BDD feature：BDD-L2-<pending>（待 S-bdd 补全）
- 测试场景：订阅关系与通知事件链路——关注事件、评论事件入通知；已读流转；越权查询他人通知 403

**前置条件**

认证：用户 B token（订阅者）、博主 A token；数据：博主 A 已开通 + 公开文章 P1；路径：POST /api/subscriptions、POST /api/bloggers/:id/follow、POST /api/posts/:id/comments、GET /api/notifications、PATCH /api/notifications/:id/read、DELETE /api/subscriptions/:id

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 用户 B 订阅博主 A | POST /api/subscriptions（Bearer B, `{"bloggerId":A}`） | 200 订阅建立 |
| 2 | 重复订阅幂等 | 再次 POST /api/subscriptions | 200 幂等，无重复 |
| 3 | 用户 B 关注博主 A | POST /api/bloggers/A/follow（Bearer B） | 200，粉丝数 +1 |
| 4 | 博主 A 查通知 | GET /api/notifications（Bearer A） | 200 含「新关注」通知 |
| 5 | 用户 B 评论 P1 | POST /api/posts/P1/comments（Bearer B） | 201 |
| 6 | 博主 A 查通知 | GET /api/notifications（Bearer A） | 200 含「新评论」通知（unread） |
| 7 | 标记已读 | PATCH /api/notifications/:id/read（Bearer A） | 200 已读 |
| 8 | 越权查询他人通知 | GET /api/notifications?userId=<B>（Bearer A） | 403（REQ-016 AC3 语义） |
| 9 | 退订 | DELETE /api/subscriptions/:id（Bearer B） | 200 解除 |
| 10 | 订阅不存在博主 | POST /api/subscriptions `{"bloggerId":9999}` | 404 |

**预期结果**

订阅/关注/评论事件经事件总线（M-021）正确生成通知；已读流转生效；越权 403；幂等与 404 正确。

**执行状态**

- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### ST-007 审计+RSS 集成

- 标题：关键操作审计记录/查询与 RSS 订阅源生成
- 优先级：高
- 关联需求/设计：REQ-018, REQ-019, REQ-020, CON-004（M-014/M-015）
- 关联 BDD feature：BDD-L2-<pending>（待 S-bdd 补全）
- 测试场景：审计日志记录/筛选/权限 + 系统级/博主级 RSS 生成与合法性

**前置条件**

认证：管理员 token（M-014 数据预置管理员）、普通用户 token、博主 token；数据：≥1 篇公开文章；路径：POST /api/auth/login（触发审计）、GET /api/admin/audit-logs、GET /api/rss、GET /api/bloggers/:id/rss

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 管理员登录并删除文章 | 触发关键操作 | 审计日志新增记录，含 actor/action/timestamp/详情四字段 |
| 2 | 管理员分页查询 | GET /api/admin/audit-logs?page=1&pageSize=10 | 200，日志列表 + 分页元数据 |
| 3 | 条件筛选 | GET /api/admin/audit-logs?action=delete_post | 200，仅返回 delete_post 记录 |
| 4 | 普通用户读审计 | GET /api/admin/audit-logs（普通 token） | 403 |
| 5 | 系统级 RSS | GET /api/rss | 200，Content-Type application/xml，XML 可解析含文章条目 |
| 6 | 空源合法 | 清空文章后 GET /api/rss | 200 合法空源 |
| 7 | 博主 RSS 404 | GET /api/bloggers/99999/rss | 404 |
| 8 | 保留策略（CON-004） | 配置 AUDIT_RETENTION_DAYS=90，模拟超期记录 | 超期记录被清理/不可查 |

**预期结果**

审计链路完整（记录→查询→筛选→权限）；RSS 合法可解析；保留策略生效。

**执行状态**

- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### ST-008 Webhook+重试集成

- 标题：Webhook 配置、事件触发投递与失败重试
- 优先级：高
- 关联需求/设计：REQ-021, REQ-022（M-016/M-021）
- 关联 BDD feature：BDD-L2-<pending>（待 S-bdd 补全）
- 测试场景：Webhook CRUD + 文章发布事件触发投递 + 失败重试（≤3 次指数退避）/超限 failed/成功不重试

**前置条件**

认证：博主 token；数据：mock 投递目标（可配置 200/5xx）；路径：POST /api/webhooks、PUT/DELETE /api/webhooks/:id、POST /api/posts（发布触发）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 创建 Webhook | POST /api/webhooks `{"url":"https://mock/hook","event":"post.published"}` | 201 |
| 2 | 发布文章触发投递 | POST /api/posts（status=published）（mock 返回 200） | mock 收到 1 次 POST，无重试 |
| 3 | 失败自动重试 | mock 配置返回 500 → 再发布一篇文章 | 自动重试 ≤ 3 次，间隔指数退避（日志可证） |
| 4 | 重试超限标记 failed | mock 持续 500 | 重试 3 次后停止，Webhook 状态标记 failed |
| 5 | 更新/删除 Webhook | PUT /api/webhooks/:id、DELETE /api/webhooks/:id | 200，配置变更/删除生效 |
| 6 | 非法 URL 拒绝 | POST /api/webhooks `{"url":"not-a-url"}` | 400 |

**预期结果**

投递成功不重试；失败自动重试 ≤3 次且指数退避；超限 failed；CRUD 与 400 边界正确。

**执行状态**

- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### ST-009 限流 429

- 标题：单 IP 限流阈值内放行与超限 429
- 优先级：高
- 关联需求/设计：NFR-006（M-018）
- 关联 BDD feature：BDD-L2-<pending>（待 S-bdd 补全）
- 测试场景：单 IP 100 req/min 限流——阈值内全部放行，第 101 次 429 + Retry-After

**前置条件**

认证：无需；数据：≥1 篇公开文章；路径：GET /api/posts（任意 API）；限流窗口 60s

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 阈值内请求 | 60s 内 ≤ 100 次 GET /api/posts | 全部 2xx，无 429 |
| 2 | 超限请求 | 60s 内第 101 次 GET /api/posts | 429 限流 + Retry-After 头 |
| 3 | 窗口重置放行 | 窗口期过后再次请求 | 恢复正常 2xx |

**预期结果**

限流阈值精确（100 req/min）；429 附带 Retry-After；窗口重置后恢复。

**执行状态**

- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### ST-010 标签+分类集成

- 标题：标签与分类的内容组织集成（关联/层级/删除保护）
- 优先级：高
- 关联需求/设计：REQ-011, REQ-012（M-008/M-009）
- 关联 BDD feature：BDD-L2-<pending>（待 S-bdd 补全）
- 测试场景：标签/分类 CRUD + 文章关联 + 父子层级 + 引用保护 409

**前置条件**

认证：博主 token；数据：博主已开通；路径：POST /api/tags、DELETE /api/tags/:id、POST /api/categories、DELETE /api/categories/:id、POST /api/posts（关联）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 创建标签 | POST /api/tags `{"name":"Node.js"}` | 201 |
| 2 | 重复标签 | 再次创建同名 | 409 |
| 3 | 文章关联标签后删除标签 | 文章引用标签 → DELETE /api/tags/:id | 409（先解绑后删除） |
| 4 | 创建分类含父级 | POST /api/categories `{"name":"前端","parentId":1}` | 201 含层级 |
| 5 | parent 不存在 | `{"name":"x","parentId":9999}` | 400 |
| 6 | 删除含文章分类 | 分类下有文章 → DELETE /api/categories/:id | 409 |

**预期结果**

标签/分类 CRUD 与关联正确；引用保护 409、parent 校验 400 边界齐全。

**执行状态**

- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### ST-011 搜索+推荐集成

- 标题：关键词搜索与内容推荐的内容发现集成
- 优先级：高
- 关联需求/设计：REQ-013, REQ-014（M-010/M-011）
- 关联 BDD feature：BDD-L2-<pending>（待 S-bdd 补全）
- 测试场景：搜索命中/分页/空关键词 400 + 推荐 ≤10 条不含草稿/空列表

**前置条件**

认证：无需；数据：≥1 篇公开文章（含标签）、1 篇草稿；路径：GET /api/search?q=、GET /api/recommendations

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 关键词命中搜索 | GET /api/search?q=TypeScript&page=1&pageSize=10 | 200，命中文章列表 + 分页元数据 |
| 2 | 标签命中搜索 | q=标签名 | 200，含关联标签文章 |
| 3 | 无命中 | q=zzzz | 200 空列表 |
| 4 | 空关键词 | q=（空） | 400 |
| 5 | 推荐内容 | GET /api/recommendations | 200，≤10 条且不含草稿 |
| 6 | 无内容推荐 | 无公开文章时请求 | 200 空列表 |

**预期结果**

搜索命中/分页/空关键词 400 正确；推荐数量上限与草稿排除约束成立。

**执行状态**

- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### ST-012 浏览+统计集成

- 标题：浏览计数持久化与文章统计（0 语义）
- 优先级：高
- 关联需求/设计：REQ-008, REQ-015（M-005）
- 关联 BDD feature：BDD-L2-<pending>（待 S-bdd 补全）
- 测试场景：浏览 viewCount+1 持久化、草稿 404、统计正确/0 语义/404

**前置条件**

认证：无需（浏览）/ 博主 token（统计）；数据：公开文章 P1 + 草稿 D1；路径：GET /api/posts/:id、GET /api/posts/:id/stats

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 浏览公开文章 | GET /api/posts/P1（两次） | 200，第二次 viewCount=2（+1 持久化） |
| 2 | 浏览草稿 | GET /api/posts/D1（访客） | 404（草稿仅作者可见） |
| 3 | 浏览不存在文章 | GET /api/posts/99999 | 404 |
| 4 | 查询文章统计 | GET /api/posts/P1/stats（博主 token） | 200，viewCount/commentCount 与实测一致 |
| 5 | 无数据统计 | 新建无浏览无评论文章 → stats | 200，viewCount=0、commentCount=0（非 null） |
| 6 | 统计不存在文章 | GET /api/posts/99999/stats | 404 |

**预期结果**

浏览计数持久化；草稿 404 语义正确；统计 0 语义与 404 边界齐全。

**执行状态**

- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### ST-013 约束与横切集成

- 标题：技术栈/内存存储/校验约束与覆盖率复核
- 优先级：中
- 关联需求/设计：CON-001, CON-002, CON-003, NFR-004（M-019/M-020 + 静态验证）
- 关联 BDD feature：BDD-L2-<pending>（待 S-bdd 补全）
- 测试场景：系统级验证技术约束（CON-001/002/003）落地与 NFR-004 覆盖率复核

**前置条件**

认证：博主 token（行为验证部分）；数据：无；路径：静态检查 + POST /api/posts → GET /api/posts/:id

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 技术栈静态检查（CON-001） | 检查 package.json/tsconfig + tsc 编译 + 启动 | 依赖清单无 Express 之外 Web 框架；编译通过；路由基于 Express 4 |
| 2 | 无外部连接（CON-002） | 启动服务观察连接 | 启动无外部数据库/中间件连接；数据进程内存读写闭环（创建→读回） |
| 3 | zod 校验（CON-003） | POST /api/posts 空标题/空内容 | 400 + 结构化错误体（zod schema 校验） |
| 4 | 覆盖率复核（NFR-004） | 运行 vitest coverage | 单元测试行覆盖率 ≥ 80% |

**预期结果**

CON-001/002/003 落地可验证；覆盖率报告 ≥80% 可复现。

**执行状态**

- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

## 用例汇总

| 用例 ID | 标题 | 优先级 | 关联 | 状态 |
|---|---|---|---|---|
| TC-DES-001 | 系统架构设计验证 | 高 | 系统设计文档 | 待执行（阶段门） |
| TC-DES-005 | 系统测试用例生成 | 高 | 系统测试文档 | 待执行（阶段门） |
| TC-DES-007 | 端到端流程设计（→ ST-001） | 高 | REQ-001/003/004/006/007/008/009/016 | 待执行（阶段 7） |
| TC-DES-008 | 性能基线设计（→ ST-002） | 高 | NFR-001/003/005 | 待执行（阶段 7） |
| TC-DES-009 | 安全基线设计（→ ST-003） | 高 | NFR-002 | 待执行（阶段 7） |
| ST-001 | 端到端全链路 | 高 | REQ-001/003/004/006/007/008/009/016 | 待执行 |
| ST-002 | 性能基线 | 高 | NFR-001/003/005 | 待执行 |
| ST-003 | 安全基线 | 高 | NFR-002 | 待执行 |
| ST-004 | 认证+文章集成 | 高 | REQ-002/003/006/007 | 待执行 |
| ST-005 | 评论+审核集成 | 高 | REQ-009/010 | 待执行 |
| ST-006 | 订阅+通知集成 | 高 | REQ-005/016/017 | 待执行 |
| ST-007 | 审计+RSS 集成 | 高 | REQ-018/019/020, CON-004 | 待执行 |
| ST-008 | Webhook+重试集成 | 高 | REQ-021/022 | 待执行 |
| ST-009 | 限流 429 | 高 | NFR-006 | 待执行 |
| ST-010 | 标签+分类集成 | 高 | REQ-011/012 | 待执行 |
| ST-011 | 搜索+推荐集成 | 高 | REQ-013/014 | 待执行 |
| ST-012 | 浏览+统计集成 | 高 | REQ-008/015 | 待执行 |
| ST-013 | 约束与横切集成 | 中 | CON-001/002/003, NFR-004 | 待执行 |

## 测试用例覆盖说明

- 功能点覆盖：22/22 REQ 全覆盖（每需求 ≥1 条系统级用例，ST-001 端到端 + ST-004~012 跨模块集成）
- 非功能覆盖：6/6 NFR（ST-002 性能/可靠性/内存、ST-003 安全、ST-009 限流、ST-013 覆盖率复核）
- 约束覆盖：4/4 CON（ST-013 技术栈/存储/校验 + ST-007 保留策略）
- 跨模块集成覆盖：认证+文章（ST-004）、评论+审核（ST-005）、订阅+通知（ST-006）、审计+RSS（ST-007）、Webhook+重试（ST-008）、标签+分类（ST-010）、搜索+推荐（ST-011）、浏览+统计（ST-012）
- 系统级质量属性：端到端（TC-DES-007/ST-001）、性能基线（TC-DES-008/ST-002，100 QPS × 10min，P95 < 2s）、安全基线（TC-DES-009/ST-003，SQL 注入/XSS/CSRF/越权）
- 测试 seam：全部 ST 经 HTTP API seam（S1，supertest 驱动）执行，与阶段 1 UAT 用例格式/断言语义一致
- BDD-L2 引用：待 S-bdd 补全（当前为 `BDD-L2-<pending>` 占位，S-bdd 产出后回填至 RTM systemTest 列）
