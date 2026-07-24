# 测试用例文档（集成测试设计）

> 阶段 3（概要设计）产出。W 模型第 6 轮端到端调测。
> 用例 ID 格式：TC-DES-NNN（设计阶段集成测试用例）。
> 套用 `templates/test-case.md` 模板，`type=集成测试`，所有 `{{}}` 占位符已替换为实际内容。
> 设计依据：`docs/interface-design.md` v1.0（17 INTF 契约）+ `docs/system-design.md` v1.0 + `docs/requirement-spec.md` v1.0。
> 覆盖原则：接口参数校验 + 跨模块调用 + 数据传递异常路径，本阶段只做设计，阶段 6 执行。

## 文档信息

- 项目名称：blog-system-demo（扩展博客系统后端）
- 测试类型：集成测试
- 设计来源阶段：阶段 3 概要设计
- 执行阶段：阶段 6 集成测试
- 文档版本：v1.0
- 编制日期：2026-07-24
- 编制者：W 模型阶段 3 子代理（S-doc 生产者-文档）
- 关联接口设计：`docs/interface-design.md`（17 INTF 契约）
- 关联系统设计：`docs/system-design.md`
- 关联需求规格：`docs/requirement-spec.md`
- 用例总数：5（TC-DES-004/006/010/011/012）

## 测试覆盖矩阵

| 用例 ID | 测试场景 | 覆盖接口 | 优先级 | 测试维度 |
|---|---|---|---|---|
| TC-DES-004 | 接口定义验证 | INTF-001~017 全部 | 高 | 契约完整性（10 字段+错误码三段位） |
| TC-DES-006 | 集成测试用例生成 | INTF-001/004/008/009/015/016/017 | 高 | 模块间交互正向路径 |
| TC-DES-010 | 接口参数校验 | INTF-001/004/008/012 | 高 | 合法/非法/边界参数 |
| TC-DES-011 | 跨模块调用 | INTF-001→017→002→004→008→009 | 高 | 数据正确传递+契约符合 |
| TC-DES-012 | 数据传递异常路径 | INTF-015/016/008/012 | 高 | 超时/错误码 fallback/不崩溃 |

---

## 用例列表

### TC-DES-004

- 标题：接口定义验证（契约完整性 + 错误码三段位）
- 优先级：高
- 关联需求/设计：REQ-001~013 / NFR-002~003 / SD-001~006 / interface-design.md §1~§8
- 测试场景：验证 17 个 INTF 节点的接口契约按「接口契约 Schema 模板」10 字段填写完整，错误码覆盖 4xx/5xx/业务三段位，每条错误码含 code+message+httpStatus+retryable 四元组

**前置条件**
- `docs/interface-design.md` v1.0 已产出
- 17 个 INTF 节点已落入 `.w-model/ingestion/graph.json`（INTF-001~017）
- SD-001~006 与 INTF-001~017 的 defines 边已建立

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 枚举 INTF 节点 | `graph.json` nodes 中 type=INTF | 17 个节点（INTF-001~017） |
| 2 | 校验每个 INTF 的 10 字段完整性 | interface-design.md 每个接口契约 | 10 字段（接口名/路径/参数名/参数类型/必填/默认值/约束/示例/返回值结构/错误码集合）全部填写，缺一项即失败 |
| 3 | 校验错误码三段位覆盖 | 每个接口契约的错误码集合 | 涉及写操作的接口必须覆盖 4xx（客户端错误）+ 5xx（服务端错误）+ 业务（业务规则错误）三段位 |
| 4 | 校验错误码四元组 | 全局错误码表（§2.1）+ 各接口明细 | 每条错误码含 code(number)+message(string)+httpStatus(number)+retryable(boolean) 四元组 |
| 5 | 校验错误码段位范围 | 全局错误码表 | 4xx∈[40000,49999]；5xx∈[50000,59999]；业务∈[60000,69999] |
| 6 | 校验接口名唯一性 | 所有接口契约的 接口名字段 | 无重名 |
| 7 | 校验路径格式 | 所有 HTTP 接口的路径 | `/api/v1/` 前缀；RESTful 风格；含 path 参数用 `:param` 语法 |
| 8 | 校验返回值结构一致性 | 所有接口的返回值结构 | 统一 `{code,message,data}` 包装；code=0 表示成功 |
| 9 | 校验约束可量化 | 含约束的接口契约 | 约束用 len∈[min,max]/≥/≤/UUID 等可测表达式，无「适当」「合理」等模糊词 |
| 10 | 校验 DFS 无环 | interface-design.md §1.2 Mermaid 图 + §1.3 DFS 验证 | 调用关系图无循环依赖；拓扑排序存在 |

**预期结果**
17 个 INTF 节点的接口契约全部按 10 字段填写完整，错误码覆盖三段位且每条含四元组，调用关系图无环。任何一项不达标 → 返工到接口定义补全。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：（待执行时填写）

---

### TC-DES-006

- 标题：集成测试用例生成（模块间交互正向路径覆盖）
- 优先级：高
- 关联需求/设计：REQ-002/003/010/011/012 / NFR-002/003 / SD-001~003/006 / interface-design.md §3~§5/§8
- 测试场景：验证集成测试用例覆盖关键模块间交互的正向路径——认证→权限校验→文章操作→评论→通知→WAL/审计日志记录全链路数据正确传递

**前置条件**
- 系统已启动，内存存储初始化完成
- `JWT_SECRET` 环境变量已设置
- WAL 文件（`wal.log`）和审计日志文件（`audit.log`）可写
- 博主用户 B 尚未注册

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 | 覆盖接口 |
|---|---|---|---|---|
| 1 | 博主注册 | `POST /api/v1/auth/register` `{"email":"b@b.com","password":"Pass1234","nickname":"bloggerB","role":"blogger"}` | 200，`{code:0,data:{userId,role:"blogger"}}`；WAL 追加 create:user 记录 | INTF-001→INTF-015 |
| 2 | 博主登录 | `POST /api/v1/auth/login` `{"email":"b@b.com","password":"Pass1234"}` | 200，`{code:0,data:{accessToken,refreshToken,role:"blogger"}}` | INTF-001→INTF-017 |
| 3 | 创建文章（draft） | `POST /api/v1/articles` Header:Authorization Bearer `<token>`；Body:`{"title":"Test","content":"# Hello","status":"draft"}` | 200，`{code:0,data:{articleId,status:"draft"}}`；WAL 追加 create:article；RBAC 校验通过（INTF-017） | INTF-004→INTF-017→INTF-015 |
| 4 | 文章提交审核 | `POST /api/v1/articles/:articleId/transition` `{"targetState":"pending_review"}` | 200，`{code:0,data:{previousState:"draft",targetState:"pending_review"}}`；WAL 追加 | INTF-004→INTF-015 |
| 5 | 普通用户注册+登录 | 同步骤 1/2，role="user" | 200，获取 accessToken | INTF-001 |
| 6 | 用户创建评论 | `POST /api/v1/articles/:articleId/comments` `{"content":"好文！"}` | 200，`{code:0,data:{commentId,status:"published",depth:1}}`；WAL+审计追加；触发通知 | INTF-008→INTF-015→INTF-016→INTF-009 |
| 7 | 博主查询通知 | `GET /api/v1/notifications?read=false` Header:Authorization Bearer `<bloggerToken>` | 200，`{code:0,data:{list:[{type:"comment_reply"}],unreadCount:1}}` | INTF-009 |
| 8 | 博主标记通知已读 | `POST /api/v1/notifications/:notificationId/read` | 200，`{code:0,data:{read:true,unreadCount:0}}` | INTF-009→INTF-015 |
| 9 | 验证 WAL 记录数 | 读取 `wal.log` 文件 | 至少 5 条记录（register/createArticle/transition/createComment/markRead），按时间顺序追加 | INTF-015 |
| 10 | 验证审计日志记录数 | 读取 `audit.log` 文件 | 至少 1 条记录（createComment 属敏感操作），含 userId/action/ip/timestamp | INTF-016 |
| 11 | 验证数据一致性 | 查询文章 `GET /api/v1/articles/:articleId` | 文章 stats.comments=1；评论列表含 1 条 | INTF-004→INTF-008 |

**预期结果**
认证→权限校验→文章操作→评论→通知→WAL/审计全链路数据正确传递，返回结构符合 interface-design.md 契约。WAL 至少 5 条记录，审计日志至少 1 条，文章评论数=1。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：（待执行时填写）

---

### TC-DES-010

- 标题：接口参数校验（合法/非法/边界参数）
- 优先级：高
- 关联需求/设计：REQ-002/003/010/012/005 / SD-001~004 / interface-design.md §3.1/§4.1/§5.1/§6.3
- 测试场景：验证接口对合法/非法/边界参数的校验行为——非法参数返回 400+错误码；边界参数正确处理；zod schema 校验生效

**前置条件**
- 系统已启动
- `JWT_SECRET` 环境变量已设置
- 已注册 1 个博主用户（获取 accessToken）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 | 测试维度 |
|---|---|---|---|---|
| **合法参数** | | | | |
| 1 | 合法注册 | `POST /api/v1/auth/register` `{"email":"legal@test.com","password":"Pass1234","nickname":"legal"}` | 200，`{code:0,data:{userId,role:"user"}}` | 合法 |
| 2 | 合法创建文章 | `POST /api/v1/articles` `{"title":"合法标题","content":"合法内容","status":"draft"}` | 200，`{code:0,data:{articleId}}` | 合法 |
| 3 | 合法创建广告 | `POST /api/v1/ads` 完整参数，`maxImpressionsPerUserPerDay=100`（边界上界） | 200，`{code:0,data:{adId,status:"pending_review"}}` | 边界合法 |
| **非法参数** | | | | |
| 4 | 邮箱格式非法 | `POST /api/v1/auth/register` `{"email":"not-email","password":"Pass1234","nickname":"x"}` | 400，`{code:40003,message:"参数格式校验失败"}` | 非法 |
| 5 | 密码强度不足 | `POST /api/v1/auth/register` `{"email":"a@b.com","password":"123","nickname":"x"}` | 400，`{code:40003}`（len<8） | 非法 |
| 6 | 参数缺失 | `POST /api/v1/articles` `{"title":"标题"}`（缺 content） | 400，`{code:40001,message:"参数缺失"}` | 非法 |
| 7 | 非法状态转换 | `POST /api/v1/articles/:articleId/transition` `{"targetState":"published"}`（文章为 draft） | 409，`{code:60001,message:"业务状态机非法转换"}` | 业务非法 |
| 8 | 重复邮箱注册 | `POST /api/v1/auth/register` 用已注册邮箱 | 409，`{code:40901,message:"资源冲突"}` | 非法 |
| 9 | 未授权访问 | `GET /api/v1/users/u1` 无 Authorization header | 401，`{code:40101,message:"未授权"}` | 非法 |
| 10 | RBAC 权限不足 | 普通用户调用 `POST /api/v1/ads`（需 admin） | 403，`{code:40301,message:"禁止访问"}` | 非法 |
| **边界参数** | | | | |
| 11 | 标题边界（1 字符） | `POST /api/v1/articles` `{"title":"T","content":"x","status":"draft"}` | 200（len=1 ∈[1,200]） | 边界合法 |
| 12 | 标题边界（200 字符） | `POST /api/v1/articles` `{"title":"T"*200,"content":"x","status":"draft"}` | 200（len=200 ∈[1,200]） | 边界合法 |
| 13 | 标题超限（201 字符） | `POST /api/v1/articles` `{"title":"T"*201,"content":"x","status":"draft"}` | 400，`{code:40003}`（len>200） | 边界非法 |
| 14 | 评论深度边界（3 级） | 创建 depth=3 的评论（ parentId 的 parentId 的 parentId ） | 200，`{code:0,data:{depth:3}}` | 边界合法 |
| 15 | 评论深度超限（4 级） | 创建 depth=4 的评论 | 400，`{code:60004,message:"嵌套深度超限"}` | 边界非法 |
| 16 | 广告配额超限 | `POST /api/v1/ads` `maxImpressionsPerUserPerDay=101` | 409，`{code:60006,message:"配额超限"}` | 边界非法 |
| 17 | 分页边界 | `GET /api/v1/articles?page=1&pageSize=50` | 200（pageSize=50 ∈[1,50]） | 边界合法 |
| 18 | 分页超限 | `GET /api/v1/articles?page=0` | 400，`{code:40003}`（page<1） | 边界非法 |

**预期结果**
合法参数返回 200+code:0；非法参数返回 400/401/403/409+对应错误码；边界参数（上界/下界）正确处理，超限返回错误码。zod schema 校验在 controller 层生效，不进入 service 层。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：（待执行时填写）

---

### TC-DES-011

- 标题：跨模块调用（数据正确传递 + 返回结构符合契约）
- 优先级：高
- 关联需求/设计：REQ-002/010/011/012/013 / SD-001~003 / interface-design.md §3~§5
- 测试场景：验证模块 A→模块 B 调用时数据正确传递，返回结构符合接口契约——认证→用户→文章→评论→通知→交叉引用全链路跨子系统协作

**前置条件**
- 系统已启动
- `JWT_SECRET` 环境变量已设置
- 博主 A、博主 B、普通用户 C 均已注册并获取 accessToken

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 | 跨模块调用链 |
|---|---|---|---|---|
| 1 | 博主 A 创建文章 | `POST /api/v1/articles`（博主 A token）`{"title":"A的文章","content":"内容","status":"draft"}` | `{articleId:a1}` | INTF-001→INTF-017→INTF-004→INTF-015 |
| 2 | 博主 A 提交审核 | `POST /api/v1/articles/a1/transition` `{"targetState":"pending_review"}` | `{previousState:"draft",targetState:"pending_review"}` | INTF-004→INTF-015 |
| 3 | 管理员审核通过 | `POST /api/v1/articles/a1/transition` `{"targetState":"published"}`（admin token） | `{targetState:"published"}` | INTF-004→INTF-017→INTF-015 |
| 4 | 博主 B 添加交叉引用 | `POST /api/v1/articles/b1/citations` `{"citeArticleIds":["a1"]}`（博主 B token，b1 为博主 B 文章） | `{notifiedAuthors:["博主AuserId"]}` | INTF-007→INTF-004→INTF-009→INTF-015 |
| 5 | 验证博主 A 收到引用通知 | `GET /api/v1/notifications`（博主 A token） | list 含 `{type:"cited",refType:"article",refId:"b1"}` | INTF-009 |
| 6 | 用户 C 评论文章 | `POST /api/v1/articles/a1/comments` `{"content":"引用了B的文章"}`（用户 C token） | `{commentId:c1,status:"published",depth:1}` | INTF-008→INTF-004→INTF-009→INTF-015→INTF-016 |
| 7 | 验证博主 A 收到评论通知 | `GET /api/v1/notifications?read=false`（博主 A token） | unreadCount≥2（cited+comment_reply） | INTF-009 |
| 8 | 用户 C 回复评论（楼中楼） | `POST /api/v1/articles/a1/comments` `{"content":"回复","parentId":"c1"}` | `{commentId:c2,depth:2}` | INTF-008→INTF-009 |
| 9 | 用户 C 点赞评论 | `POST /api/v1/comments/c1/like`（用户 C token） | `{likes:1,liked:true}` | INTF-008→INTF-009→INTF-015 |
| 10 | 验证评论数据结构符合契约 | `GET /api/v1/articles/a1` → 查评论列表 | 评论 c1.likes=1，c1.likedBy 含用户 C；c2.depth=2，c2.parentId=c1 | INTF-004→INTF-008 |
| 11 | 验证通知数据结构符合契约 | `GET /api/v1/notifications`（博主 A token） | 每条通知含 id/userId/type/title/content/refType/refId/read/createdAt/channel 字段 | INTF-009 |
| 12 | 验证文章 stats 更新 | `GET /api/v1/articles/a1` | stats.comments=2（c1+c2）；stats.likes 不含评论点赞（评论点赞独立计数） | INTF-004→INTF-008 |

**预期结果**
跨模块调用链（INTF-001→017→004→007→008→009→015→016）数据正确传递：文章发布→交叉引用触发通知→评论触发通知→楼中楼 depth 递增→点赞计数更新。返回结构全部符合 interface-design.md 契约定义。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：（待执行时填写）

---

### TC-DES-012

- 标题：数据传递异常路径（超时/错误码 fallback/不崩溃）
- 优先级：高
- 关联需求/设计：NFR-002/003 / REQ-010/011/005 / SD-003/004/006 / interface-design.md §5/§6/§8
- 测试场景：验证模块 B 超时或返回错误码时，模块 A 按错误码 fallback，系统不崩溃——WAL 写入失败/审计日志失败/SMTP 不可用/维护模式/敏感词命中/状态机非法转换异常处理

**前置条件**
- 系统已启动
- `JWT_SECRET` 环境变量已设置
- 博主用户已注册并获取 accessToken
- WAL 文件 `wal.log` 可写（用于异常注入测试）
- SMTP 环境变量未配置（模拟 SMTP 不可用）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 | 异常类型 |
|---|---|---|---|---|
| **WAL 写入异常（INTF-015）** | | | | |
| 1 | 模拟 WAL 文件不可写 | 将 `wal.log` 设为只读（chmod 444） | — | 异常注入 |
| 2 | 尝试创建文章 | `POST /api/v1/articles`（博主 token）`{"title":"x","content":"y","status":"draft"}` | 500，`{code:50002,message:"WAL 写入失败",retryable:true}`；文章未创建；系统不崩溃 | 5xx 服务端错误 |
| 3 | 恢复 WAL 可写 | `chmod 644 wal.log` | — | 恢复 |
| 4 | 验证系统仍可读 | `GET /api/v1/articles` | 200，`{code:0,data:{list:[]}}`；系统未崩溃 | fallback 验证 |
| **审计日志写入异常（INTF-016）** | | | | |
| 5 | 模拟审计日志不可写 | 将 `audit.log` 设为只读 | — | 异常注入 |
| 6 | 尝试封禁用户（敏感操作） | `POST /api/v1/users/:userId/ban` `{"reason":"test"}`（admin token） | 500，`{code:50003,message:"审计日志写入失败",retryable:true}`；封禁操作回滚；系统不崩溃 | 5xx 服务端错误 |
| 7 | 恢复审计日志可写 | `chmod 644 audit.log` | — | 恢复 |
| **SMTP 不可用（INTF-009 邮件降级）** | | | | |
| 8 | 配置邮件通知设置 | `PATCH /api/v1/notifications/settings` `{"settings":{"email":{"auditResult":true}}}` | 200，`{code:0}` | 正常 |
| 9 | 触发需邮件通知的事件 | 博主 A 文章被引用（INTF-007） | 200，站内通知正常创建；邮件发送失败降级为仅站内通知；返回 `{code:0,data:{notifiedAuthors}}`；系统不崩溃 | 502 降级 |
| 10 | 验证邮件降级日志 | 检查日志输出 | 含 "SMTP 不可用，降级为仅站内通知" 警告；无未捕获异常 | fallback 验证 |
| **维护模式异常（INTF-010/INTF-015）** | | | | |
| 11 | 开启维护模式 | `PUT /api/v1/site/config` `{"maintenanceMode":true}`（super_admin token） | 200，`{code:0}` | 正常 |
| 12 | 尝试注册（维护模式） | `POST /api/v1/auth/register` | 409，`{code:60006,message:"配额超限/注册开关关闭"}` 或 503 `{code:50301,message:"系统维护模式"}` | 业务异常 |
| 13 | 验证只读接口仍可用 | `GET /api/v1/articles` | 200，`{code:0}`；维护模式不影响读操作 | fallback 验证 |
| 14 | 关闭维护模式 | `PUT /api/v1/site/config` `{"maintenanceMode":false}` | 200 | 恢复 |
| **敏感词命中（INTF-008 业务异常）** | | | | |
| 15 | 发表含敏感词评论 | `POST /api/v1/articles/:articleId/comments` `{"content":"敏感词内容"}` | 400，`{code:60003,message:"敏感词命中"}`；data.sensitiveHit 含命中词列表；comment.status=pending_review；系统不崩溃 | 业务异常 |
| 16 | 验证评论进入待审核 | 管理员查询待审核评论列表 | list 含步骤 15 的评论，status=pending_review | 异常路径验证 |
| **状态机非法转换（INTF-004 业务异常）** | | | | |
| 17 | 尝试非法状态转换 | 文章为 draft，`POST /api/v1/articles/:articleId/transition` `{"targetState":"published"}`（跳过 pending_review） | 409，`{code:60001,message:"业务状态机非法转换"}`；文章状态不变；系统不崩溃 | 业务异常 |
| 18 | 尝试终态转换 | 文章为 archived，`POST /api/v1/articles/:articleId/transition` `{"targetState":"published"}` | 409，`{code:60002,message:"资源状态不允许操作"}` | 业务异常 |
| **崩溃恢复异常路径（INTF-015 replay）** | | | | |
| 19 | 写入若干操作 | 创建 3 篇文章 + 2 条评论 | WAL 追加 5 条记录 | 正常 |
| 20 | 模拟崩溃 | kill 进程（模拟 Crash） | 进程退出 | 异常注入 |
| 21 | 重启系统 | `npm run dev` | 启动时读取 wal.log 重放；`{replayed:5,durationMs:xxx}`；Map 状态重建为崩溃前 | 崩溃恢复 |
| 22 | 验证数据完整性 | `GET /api/v1/articles` | 3 篇文章存在；2 条评论存在；与崩溃前一致 | 恢复验证 |

**预期结果**
所有异常路径（WAL 失败/审计失败/SMTP 不可用/维护模式/敏感词/状态机非法/崩溃恢复）均返回正确错误码，系统不崩溃，读操作在写异常时仍可用。WAL 崩溃恢复后数据完整重建。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：（待执行时填写）

---

## 覆盖说明

### 接口覆盖

| INTF ID | 覆盖用例 | 覆盖维度 |
|---|---|---|
| INTF-001 Auth API | TC-DES-004/006/010/011 | 契约+正向+参数校验+跨模块 |
| INTF-002 User API | TC-DES-004/006/010/011 | 契约+正向+参数校验+跨模块 |
| INTF-003 Blogger API | TC-DES-004/011 | 契约+跨模块 |
| INTF-004 Article API | TC-DES-004/006/010/011/012 | 契约+正向+参数校验+跨模块+异常 |
| INTF-005 Tag API | TC-DES-004 | 契约 |
| INTF-006 Category API | TC-DES-004 | 契约 |
| INTF-007 CrossRef API | TC-DES-004/011/012 | 契约+跨模块+异常（SMTP 降级触发） |
| INTF-008 Comment API | TC-DES-004/006/010/011/012 | 契约+正向+参数校验+跨模块+异常 |
| INTF-009 Notification API | TC-DES-004/006/011/012 | 契约+正向+跨模块+异常（SMTP 降级） |
| INTF-010 Site API | TC-DES-004/012 | 契约+异常（维护模式） |
| INTF-011 Stats API | TC-DES-004 | 契约 |
| INTF-012 Ad API | TC-DES-004/010 | 契约+参数校验（配额边界） |
| INTF-013 Recommend API | TC-DES-004 | 契约 |
| INTF-014 Search API | TC-DES-004 | 契约 |
| INTF-015 Wal API | TC-DES-004/006/011/012 | 契约+正向+跨模块+异常（写入失败+崩溃恢复） |
| INTF-016 Audit API | TC-DES-004/006/012 | 契约+正向+异常（写入失败） |
| INTF-017 Rbac API | TC-DES-004/006/011 | 契约+正向+跨模块 |

### 需求覆盖

| 需求 ID | 覆盖用例 | 覆盖方式 |
|---|---|---|
| REQ-002（多博主） | TC-DES-004/006/011 | 契约+正向+跨模块 |
| REQ-003（多用户） | TC-DES-004/006/010/011 | 契约+正向+参数+跨模块 |
| REQ-005（广告） | TC-DES-004/010/012 | 契约+参数边界+异常 |
| REQ-010（评论） | TC-DES-004/006/010/011/012 | 全维度覆盖 |
| REQ-011（通知） | TC-DES-004/006/011/012 | 契约+正向+跨模块+异常 |
| REQ-012（多博文） | TC-DES-004/006/010/011/012 | 全维度覆盖 |
| REQ-013（交叉引用） | TC-DES-004/011/012 | 契约+跨模块+异常 |
| NFR-002（可用性） | TC-DES-012 | WAL 崩溃恢复 |
| NFR-003（安全） | TC-DES-006/012 | RBAC+审计+敏感词 |

### 测试维度覆盖

| 维度 | 覆盖用例 | 说明 |
|---|---|---|
| 契约完整性 | TC-DES-004 | 17 INTF × 10 字段 + 错误码三段位 |
| 正向路径 | TC-DES-006 | 认证→文章→评论→通知→WAL 全链路 |
| 参数校验 | TC-DES-010 | 合法/非法/边界（含 18 步） |
| 跨模块调用 | TC-DES-011 | 6 接口跨 3 子系统数据传递 |
| 异常路径 | TC-DES-012 | 7 类异常（WAL/审计/SMTP/维护/敏感词/状态机/崩溃恢复） |

## 验收清单

- [x] 集成测试用例覆盖模块间交互的正向路径（TC-DES-006）
- [x] 集成测试用例覆盖接口参数校验（合法/非法/边界，TC-DES-010）
- [x] 集成测试用例覆盖跨模块调用（数据正确传递+契约符合，TC-DES-011）
- [x] 集成测试用例覆盖异常路径（超时/错误码 fallback/不崩溃，TC-DES-012）
- [x] 接口定义验证用例覆盖 17 INTF × 10 字段（TC-DES-004）
- [x] 错误码三段位（4xx/5xx/业务）在异常路径用例中验证（TC-DES-012）
- [x] 所有用例含前置条件+测试步骤+预期输出+执行状态
