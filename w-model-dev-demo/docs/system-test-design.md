# 测试用例文档（系统测试）

> 阶段 2 设计、阶段 7 执行。W 模型第 6 轮端到端调测。
> 用例 ID 格式：TC-DES-NNN（设计阶段系统测试用例）。
> 套用 `templates/test-case.md` 模板，`type=系统测试`，所有 `{{}}` 占位符已替换为实际内容。
> 设计依据：`docs/system-design.md` v1.0 + `docs/requirement-spec.md` v1.0（21 条需求）+ `docs/acceptance-test-cases.md`（49 条 UAT）。
> 覆盖原则：系统级端到端 + 跨子系统集成 + 性能基线 + 安全基线，本阶段只做设计，阶段 7 执行。

## 文档信息

- 项目名称：blog-system-demo（扩展博客系统后端）
- 测试类型：系统测试
- 设计来源阶段：阶段 2 系统设计
- 执行阶段：阶段 7 系统测试
- 文档版本：v1.0
- 编制日期：2026-07-24
- 编制者：W 模型阶段 2 子代理（S-doc 生产者-文档）
- 关联设计文档：`docs/system-design.md`
- 关联需求规格：`docs/requirement-spec.md`
- 用例总数：12（TC-DES-001 ~ TC-DES-012）

## 用例列表

### TC-DES-001

- 标题：架构设计验证
- 优先级：高
- 关联需求/设计：NFR-005 / SD-001~006 全部 / system-design.md §1 §3
- 测试场景：验证系统架构设计落地——分层结构（controller→service→store）+ 6 子系统跨切面 + SD-006 治理关系 + 数据流闭环

**前置条件**
- 项目源码已按 `docs/system-design.md` §3.3 目录结构初始化
- `tsc --noEmit` strict 模式编译通过（NFR-005）
- 依赖图工具 `madge` 可用

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 检查目录结构存在 | `src/controllers/` `src/services/` `src/stores/` `src/middlewares/` `src/utils/` | 5 个目录均存在 |
| 2 | 检查分层调用方向 | 静态分析 `controller` 不直接调用 `store` | controller 仅引用 service，无 `import.*store` 语句 |
| 3 | 检查 6 子系统目录 | `src/services/identity/ content/ interaction/ operation/ discovery/ infrastructure/` | 6 子目录均存在 |
| 4 | 检查 SD-006 governance | SD-006 被其他 5 子系统依赖，自身不依赖功能子系统 | madge 依赖图显示 SD-001~005 → SD-006，无反向 |
| 5 | 检测循环依赖 | `npx madge --circular --extensions ts src/` | 退出码 0，无循环依赖 |
| 6 | 校验数据流闭环 | EXT-IN → controller → service → store → controller → EXT-OUT | 静态分析显示请求-响应链路完整 |
| 7 | 校验 strict 编译 | `npm run build`（tsc --noEmit） | 退出码 0，0 错误 |

**预期结果**
架构落地符合 system-design.md §1：分层结构清晰、6 子系统跨切面、SD-006 治理 SD-001~005、无循环依赖、TS strict 0 错误。任何一项不达标 → 返工到设计。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：（待执行时填写）

---

### TC-DES-005

- 标题：系统测试用例生成（覆盖系统级功能）
- 优先级：高
- 关联需求/设计：REQ-001~013 / SD-001~005 / system-design.md §3
- 测试场景：验证系统级功能测试用例覆盖完整性——13 功能领域均有 ≥1 系统级测试入口

**前置条件**
- `docs/acceptance-test-cases.md`（49 条 UAT）已存在
- 系统测试用例集（本文档 + 阶段 7 补充）覆盖所有 SD 节点

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 枚举 REQ-001~013 | 13 条功能需求 | 列表完整 |
| 2 | 对每条 REQ 检索系统测试入口 | 在本文档及阶段 7 系统测试集中检索 | 每条 REQ 至少 1 条系统测试用例关联 |
| 3 | 检查关键功能 ≥3 条用例 | REQ-001/002/003/010/012 | 每个 ≥3 条（含端到端 + 异常 + 边界） |
| 4 | 检查覆盖 SD-001~006 | 6 子系统均有用例 | SD-006 至少有 TC-DES-008/009 覆盖 |
| 5 | 生成覆盖矩阵 | REQ × SD × TC-DES | 矩阵无空缺，覆盖率 100% |

**预期结果**
13 功能需求 + 6 子系统均有系统级测试用例覆盖，关键功能（REQ-001/002/003/010/012）每个 ≥3 条用例。覆盖矩阵无空缺。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：（待执行时填写）

---

### TC-DES-007

- 标题：端到端流程（注册→登录→发文→评论→通知全链路）
- 优先级：高
- 关联需求/设计：REQ-002 / REQ-003 / REQ-010 / REQ-011 / REQ-012 / SD-001~003
- 测试场景：完整业务链路——用户注册→博主注册→登录→发文→他人评论→原作者收通知，验证 SD-001→SD-002→SD-003 跨子系统协作

**前置条件**
- 系统已启动，内存存储初始化完成
- 操作日志（WAL）和审计日志文件可写
- 用户 A（普通用户）与用户 B（博主）尚未注册
- JWT_SECRET 环境变量已设置

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 博主 B 注册 | `POST /api/auth/register` `{"email":"b@x.com","password":"Pass1234","role":"blogger","nickname":"BloggerB"}` | 201，返回 JWT（access exp=now+2h, refresh exp=now+7d），passwordHash 以 bcrypt 存储 |
| 2 | 博主 B 登录 | `POST /api/auth/login` `{"email":"b@x.com","password":"Pass1234"}` | 200，返回新 JWT |
| 3 | 博主 B 创建文章（草稿） | `POST /api/articles` `{"title":"E2E测试","content":"内容","summary":"摘要","status":"draft"}`（B 的 JWT） | 201，返回 article.id，status=draft，authorId=B |
| 4 | 博主 B 提交审核 | `PATCH /api/articles/{id}/status` `{"status":"pending_review"}`（B 的 JWT） | 200，status=pending_review |
| 5 | 管理员审核通过并立即发布 | `PATCH /api/articles/{id}/status` `{"status":"published"}`（admin JWT） | 200，status=published，publishedAt=now |
| 6 | 普通用户 A 注册 | `POST /api/auth/register` `{"email":"a@x.com","password":"Pass1234","role":"user","nickname":"UserA"}` | 201，返回 JWT，role=user |
| 7 | 用户 A 登录 | `POST /api/auth/login` `{"email":"a@x.com","password":"Pass1234"}` | 200，返回 JWT |
| 8 | 用户 A 评论文章 | `POST /api/articles/{id}/comments` `{"content":"好文！"}`（A 的 JWT） | 201，返回 comment.id，status=published（无敏感词），depth=1 |
| 9 | 验证博主 B 收到通知 | `GET /api/notifications`（B 的 JWT） | 200，列表含 1 条 `type=comment_reply`，read=false，refId=article.id |
| 10 | 验证未读数 | `GET /api/notifications/unread-count`（B 的 JWT） | 200，`{"count":1}` |
| 11 | 博主 B 标记全部已读 | `POST /api/notifications/read-all`（B 的 JWT） | 200 |
| 12 | 验证未读数归零 | `GET /api/notifications/unread-count`（B 的 JWT） | 200，`{"count":0}` |
| 13 | 验证评论写入 WAL | 读取 `wal.log` 最后一条记录 | 含 comment 创建操作，可重放 |
| 14 | 验证敏感操作写审计日志 | 读取 `audit.log` 最后记录 | 含步骤 5（管理员审核通过）操作记录 |
| 15 | 重启服务并重放 WAL | 停止进程 → 启动进程 → 读取状态 | 步骤 1~8 的文章/评论/通知状态全部恢复（UAT-042 一致性） |

**预期结果**
注册→登录→发文→审核→评论→通知→已读→崩溃恢复全链路畅通：JWT 签发正确（2h/7d）、状态机 draft→pending_review→published 转换合法、评论触发通知且未读数 +1、全部已读后归零、WAL 与审计日志均记录、崩溃重放后状态一致。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：（待执行时填写）

---

### TC-DES-008

- 标题：性能基线（P95≤200ms, 100 QPS 持续 10min）
- 优先级：高
- 关联需求/设计：NFR-001 / SD-006 / CON-002
- 测试场景：单实例 Node.js 20+ 在 100 QPS 持续 10 分钟负载下，验证通用接口 P95≤200ms、搜索 P95≤500ms（NFR-001），错误率≤0.1%（NFR-002）

**前置条件**
- 系统部署为单实例（CON-002），Node.js 20+
- 数据集：1000 篇已发布文章 + 200 用户（CON-003 系统测试规模上限）
- 压测工具：k6 / autocannon / hey 任一可用
- 搜索倒排索引或前缀树已初始化（RISK-012 缓解）
- 1000 文章中 50% 含标签、30% 含分类、20% 含交叉引用

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 预热数据集 | 批量插入 1000 文章 + 200 用户 | 插入完成，WAL 文件已生成 |
| 2 | 启动持续 10min 压测 | k6 脚本：100 QPS 持续 600s，混合场景（GET /api/articles 40% + GET /api/articles/{id} 20% + GET /api/search 10% + POST /api/comments 10% + POST /api/auth/login 10% + GET /api/notifications 10%） | 持续运行 600s |
| 3 | 采集通用接口 P95 | k6 输出统计（不含 /api/search） | 通用接口 P95 ≤ 200ms |
| 4 | 采集搜索接口 P95 | k6 输出统计（仅 /api/search?q=xxx） | 搜索 P95 ≤ 500ms |
| 5 | 采集 QPS | k6 输出 RPS | 平均 RPS ≥ 100，无显著下降 |
| 6 | 采集错误率 | k6 输出 failed requests / total | 错误率 ≤ 0.1%（即 ≤ 6 个失败 / 60000 请求） |
| 7 | 监控内存占用 | 进程内存监控（process.memoryUsage().heapUsed） | heapUsed ≤ 512MB，无 OOM |
| 8 | 监控事件循环延迟 | `perf_hooks.monitorEventLoopDelay` | P95 延迟 ≤ 50ms |
| 9 | 验证 WAL 同步性 | 压测期间写操作的 WAL 落盘延迟 | 异步追加，无丢失 |
| 10 | 压测后崩溃恢复 | 停止进程 → 重启 → 重放 WAL | 状态与压测前一致 |

**预期结果**
通用接口 P95≤200ms，搜索 P95≤500ms，平均 QPS≥100，错误率≤0.1%，无 OOM，事件循环 P95 延迟≤50ms。若不达标按 RISK-002 降级为 50 QPS 并向用户报备写入 maturity.json。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：（待执行时填写）

---

### TC-DES-009

- 标题：安全基线（原型链污染 / RBAC 越权 / JWT 篡改 / zod 校验）
- 优先级：高
- 关联需求/设计：NFR-003 / SD-006 / SD-001 / system-design.md §6 RBAC
- 测试场景：验证安全防御——原型链污染防护、RBAC 4 角色权限边界、JWT 篡改检测、zod 输入校验拦截非法 payload；SQL 注入因内存存储 N/A 但需验证 zod 校验等价防御

**前置条件**
- 系统已部署，4 类角色账号（user/blogger/admin/super_admin）均已注册
- JWT_SECRET 已设置
- 测试工具：curl / supertest / 自定义脚本

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 原型链污染测试 | `POST /api/auth/register` `{"email":"p@x.com","password":"Pass1234","__proto__":{"isAdmin":true}}` | 400，zod 拒绝；验证 `({} as any).isAdmin !== true`（对象未被污染） |
| 2 | 原型链污染变种 | `POST /api/articles` `{"title":"x","content":"y","constructor":{"prototype":{"role":"super_admin"}}}`（blogger JWT） | 400，zod strip 未知字段；`req.user.role` 仍为 blogger |
| 3 | RBAC 越权：user 调 admin 接口 | `PUT /api/site/config`（user JWT） | 403，错误码 `FORBIDDEN` |
| 4 | RBAC 越权：blogger 编辑他人文章 | `PATCH /api/articles/{他人id}` `{"title":"hack"}`（blogger A 的 JWT，文章属于 blogger B） | 403，错误码 `FORBIDDEN`（UAT-007） |
| 5 | RBAC 越权：admin 封禁用户 | `POST /api/admin/users/{id}/ban` `{"reason":"test"}`（admin JWT，非 super_admin） | 403，封禁仅 super_admin 可操作 |
| 6 | RBAC 越权：被封禁用户登录 | 先 super_admin 封禁 user A，再 `POST /api/auth/login`（A 凭证） | 403，错误码 `USER_BANNED`，返回 banReason |
| 7 | JWT 篡改：修改 payload | 拿到合法 JWT，修改 payload `role` 为 `super_admin` 后重签 | 401，错误码 `INVALID_TOKEN`（签名校验失败） |
| 8 | JWT 篡改：过期 token | 拿到 access token，等待 2h1min 后请求 | 401，错误码 `TOKEN_EXPIRED` |
| 9 | JWT 篡改：refresh 过期 | 使用 7d+1min 的 refresh token 刷新 | 401，错误码 `TOKEN_EXPIRED` |
| 10 | JWT 算法降级 | 修改 JWT header `alg=none` | 401，拒绝 none 算法 |
| 11 | zod 校验：非法 email | `POST /api/auth/register` `{"email":"not-email","password":"Pass1234"}` | 400，错误码 `VALIDATION_ERROR`，返回字段错误详情 |
| 12 | zod 校验：弱密码 | `POST /api/auth/register` `{"email":"x@x.com","password":"123"}` | 400，密码不满足 8 字符+1 字母+1 数字（GAP-001） |
| 13 | zod 校验：SQL 注入 payload（验证等价防御） | `GET /api/search?q=' OR 1=1 --` | 200，返回空结果（zod 将 query 作为字符串处理，无注入面，内存 Map 查询） |
| 14 | zod 校验：XSS payload | `POST /api/articles` `{"title":"<script>alert(1)</script>","content":"y","status":"draft"}`（blogger JWT） | 201 或 400（取决于是否过滤 HTML）；存储后 GET 返回时 script 标签被转义或剥离 |
| 15 | bcrypt 哈希验证 | 注册后读取 userStore，验证 passwordHash 不等于明文 | passwordHash 是 bcrypt 哈希（$2b$10$...），cost≥10 |
| 16 | 审计日志完整性 | 完成上述操作后读取 `audit.log` | 所有敏感操作（封禁/越权尝试/JWT 篡改）均记录，含 userId/action/timestamp |

**预期结果**
原型链污染被 zod 拦截且不污染全局对象；RBAC 4 角色权限边界严格（user/blogger/admin/super_admin 各自只能访问授权接口）；JWT 篡改（payload/过期/算法降级）均被拒；zod 校验拦截非法 email/弱密码/SQL 注入 payload（内存存储无 SQL 注入面，验证等价防御）；bcrypt cost≥10；审计日志完整记录敏感操作。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：（待执行时填写）

---

### TC-DES-010

- 标题：跨子系统集成——发文→触发统计→影响推荐流
- 优先级：高
- 关联需求/设计：REQ-012 / REQ-006 / REQ-004 / SD-002 + SD-004 + SD-005
- 测试场景：文章发布后触发统计聚合（SD-002→SD-004），并因热度变化影响推荐流排序（SD-002→SD-005），验证 3 子系统数据流一致性

**前置条件**
- 已有 10 篇已发布文章，各有初始热度
- 推荐流配置 active=true
- 热度公式：`(likes×2 + comments×3 + views×1) × 7天衰减`（GAP-006）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 记录初始推荐流 | `GET /api/recommend/hot?limit=10` | 返回 10 篇文章按 heat 降序 |
| 2 | 记录初始统计 | `GET /api/stats/articles` | 返回 totalArticles=10, totalViews=X |
| 3 | 博主发布新文章 | `POST /api/articles` + 提交审核 + 管理员发布 | 新文章 status=published |
| 4 | 用户浏览新文章 100 次 | 100 次 `GET /api/articles/{newId}` | views=100 |
| 5 | 用户点赞新文章 50 次 | 50 次 `POST /api/articles/{newId}/like` | likes=50 |
| 6 | 用户评论新文章 20 次 | 20 次 `POST /api/articles/{newId}/comments` | comments=20 |
| 7 | 验证统计聚合更新 | `GET /api/stats/articles` | totalArticles=11, totalViews=X+100, totalLikes=Y+50, totalComments=Z+20 |
| 8 | 验证热度计算 | `GET /api/articles/{newId}` | stats.heat = (50×2 + 20×3 + 100×1) × decay = 260 × decay |
| 9 | 验证推荐流排序更新 | `GET /api/recommend/hot?limit=10` | 新文章因 heat=260（最高）排在第 1 位 |
| 10 | 验证热门博主推荐 | `GET /api/recommend/bloggers` | 新文章作者因互动率上升排名提升 |
| 11 | 验证搜索可命中 | `GET /api/search?q=新文章标题关键词` | 返回新文章，按热度排序 |

**预期结果**
发文→浏览/点赞/评论→统计聚合实时更新→热度公式正确计算→推荐流排序实时反映热度变化→搜索可命中。3 子系统数据流一致，无延迟或丢失。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：（待执行时填写）

---

### TC-DES-011

- 标题：跨子系统集成——评论→触发通知→影响热度→影响搜索排序
- 优先级：中
- 关联需求/设计：REQ-010 / REQ-011 / REQ-004 / REQ-007 / SD-002 + SD-003 + SD-005
- 测试场景：评论触发通知（SD-003→SD-003）+ 评论计入热度（SD-003→SD-002）+ 热度变化影响搜索排序（SD-002→SD-005），验证 4 子系统联动

**前置条件**
- 已有 1 篇已发布文章（heat 初值低）
- 文章作者与评论者不同
- 通知设置默认开启

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 记录初始热度与搜索排序 | `GET /api/articles/{id}` + `GET /api/search?q=关键词&sort=heat` | heat 初值低，搜索排序靠后 |
| 2 | 用户评论文章 | `POST /api/articles/{id}/comments` `{"content":"很棒"}` | 201，comment.status=published |
| 3 | 验证作者收到通知 | `GET /api/notifications`（作者 JWT） | 含 type=comment_reply，未读数 +1 |
| 4 | 验证热度更新 | `GET /api/articles/{id}` | stats.heat 增加 comments×3=3 |
| 5 | 验证搜索排序变化 | `GET /api/search?q=关键词&sort=heat` | 文章排序上升 |
| 6 | 用户回复评论（楼中楼 2 级） | `POST /api/comments/{commentId}/replies` `{"content":"回复"}` | 201，depth=2 |
| 7 | 验证评论者收到回复通知 | `GET /api/notifications`（评论者 JWT） | 含 type=comment_reply |
| 8 | 用户回复 3 级 | `POST /api/comments/{replyId}/replies` | 201，depth=3 |
| 9 | 验证 4 级被拒 | `POST /api/comments/{3级id}/replies` | 400，错误码 `MAX_DEPTH_EXCEEDED`（GAP-008 ≤3 级） |
| 10 | 敏感词评论测试 | `POST /api/articles/{id}/comments` `{"content":"<敏感词1>"}` | 201，comment.status=pending_review，sensitiveHit 含命中词 |
| 11 | 验证敏感词评论不计入热度 | `GET /api/articles/{id}` | stats.heat 未增加（pending_review 不计） |

**预期结果**
评论触发通知、评论计入热度（×3 权重）、热度变化反映到搜索排序、楼中楼 3 级限制生效、敏感词评论进入待审核且不计入热度。4 子系统联动正确。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：（待执行时填写）

---

### TC-DES-012

- 标题：崩溃恢复——WAL 重放后状态一致
- 优先级：高
- 关联需求/设计：NFR-002 / SD-006 / CONFLICT-002 / UAT-042
- 测试场景：系统在持续写操作期间崩溃，重启后通过 WAL 重放恢复所有状态，验证与崩溃前一致；审计日志独立存储不参与重放

**前置条件**
- 系统已启动，已有初始数据
- `wal.log` 与 `audit.log` 文件可读写
- 操作日志覆盖所有写操作（CONFLICT-002）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 记录崩溃前状态快照 | 对所有 store 执行 JSON 序列化 | 快照 S0 保存 |
| 2 | 执行 50 次写操作 | 注册 5 用户 + 发文 10 篇 + 评论 20 + 点赞 15 | 全部成功，wal.log 追加 50 条 |
| 3 | 记录崩溃前状态快照 | 序列化所有 store | 快照 S1 保存 |
| 4 | 模拟崩溃（kill -9） | 强制终止进程 | 进程退出，无优雅关闭 |
| 5 | 重启服务 | `npm run dev` | 进程启动，读取 wal.log 重放 |
| 6 | 验证重放后状态 | 序列化所有 store | 快照 S2 与 S1 完全一致 |
| 7 | 验证用户可登录 | 用步骤 2 注册的用户登录 | 200，返回 JWT |
| 8 | 验证文章状态机恢复 | `GET /api/articles/{id}` | status 与崩溃前一致 |
| 9 | 验证审计日志未参与重放 | 对比 audit.log 与 wal.log | audit.log 不在重放流程中被读取，独立存储 |
| 10 | 验证审计日志完整 | 读取 audit.log | 步骤 2 的敏感操作均记录，未因崩溃丢失（异步追加） |
| 11 | 持续写 + 多次崩溃 | 重复步骤 2~6 共 3 轮 | 每轮重放后状态一致 |
| 12 | 验证 WAL 滚动 | 模拟 90 天前的记录 | 旧记录被滚动覆盖（GAP-009） |

**预期结果**
崩溃后通过 WAL 重放恢复所有写操作状态，S2=S1（状态完全一致）；审计日志独立存储不参与重放（CONFLICT-002）；WAL 90 天滚动覆盖生效（GAP-009）；多次崩溃-恢复循环均一致。

**执行状态**
- [ ] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：（待执行时填写）

---

## 用例汇总

| 用例 ID | 标题 | 优先级 | 关联 | 状态 |
|---|---|---|---|---|
| TC-DES-001 | 架构设计验证 | 高 | NFR-005 / SD-001~006 | 待执行 |
| TC-DES-005 | 系统测试用例生成（覆盖系统级功能） | 高 | REQ-001~013 / SD-001~005 | 待执行 |
| TC-DES-007 | 端到端流程（注册→登录→发文→评论→通知） | 高 | REQ-002/003/010/011/012 / SD-001~003 | 待执行 |
| TC-DES-008 | 性能基线（P95≤200ms, 100QPS 10min） | 高 | NFR-001 / SD-006 / CON-002 | 待执行 |
| TC-DES-009 | 安全基线（原型链/RBAC/JWT/zod） | 高 | NFR-003 / SD-001/006 | 待执行 |
| TC-DES-010 | 跨子系统：发文→统计→推荐流 | 高 | REQ-004/006/012 / SD-002/004/005 | 待执行 |
| TC-DES-011 | 跨子系统：评论→通知→热度→搜索 | 中 | REQ-004/007/010/011 / SD-002/003/005 | 待执行 |
| TC-DES-012 | 崩溃恢复：WAL 重放状态一致 | 高 | NFR-002 / SD-006 / CONFLICT-002 | 待执行 |

## 测试用例覆盖说明

### 功能点覆盖（13 功能需求）

| REQ | 关联 TC-DES | 覆盖状态 |
|---|---|---|
| REQ-001 站点管理 | TC-DES-005（间接）、TC-DES-009（维护模式 RBAC） | 部分覆盖（详见于 acceptance-test-cases.md UAT-001~004） |
| REQ-002 多博主 | TC-DES-007（注册发文）、TC-DES-009（RBAC） | 覆盖 |
| REQ-003 多用户 | TC-DES-007（注册登录）、TC-DES-009（4 角色 RBAC） | 覆盖 |
| REQ-004 推荐 | TC-DES-010（推荐流）、TC-DES-011（热度影响搜索） | 覆盖 |
| REQ-005 广告 | TC-DES-005（间接） | 部分覆盖（详见于 UAT-016~018） |
| REQ-006 统计 | TC-DES-010（统计聚合） | 覆盖 |
| REQ-007 搜索 | TC-DES-008（P95≤500ms）、TC-DES-010、TC-DES-011（排序） | 覆盖 |
| REQ-008 标签 | TC-DES-005（间接） | 部分覆盖（详见于 UAT-024~025） |
| REQ-009 分类 | TC-DES-005（间接） | 部分覆盖（详见于 UAT-026~027） |
| REQ-010 评论 | TC-DES-007（评论）、TC-DES-011（楼中楼+敏感词） | 覆盖 |
| REQ-011 通知 | TC-DES-007（通知全链路）、TC-DES-011（评论触发） | 覆盖 |
| REQ-012 多博文 | TC-DES-007（状态机）、TC-DES-010（发文）、TC-DES-012（崩溃恢复） | 覆盖 |
| REQ-013 交叉引用 | TC-DES-005（间接） | 部分覆盖（详见于 UAT-039~040） |

- 功能点覆盖：13/13（100%），其中 8 条由系统测试 TC-DES 直接覆盖，5 条由 acceptance-test-cases.md UAT 补充覆盖
- 边界条件覆盖：状态机非法转换（UAT-035）、楼中楼 3 级上限（TC-DES-011 步骤 9）、JWT 过期边界（TC-DES-009 步骤 8/9）、WAL 90 天滚动（TC-DES-012 步骤 12）

### 子系统覆盖（6 SD）

| SD | 关联 TC-DES | 覆盖状态 |
|---|---|---|
| SD-001 身份与访问 | TC-DES-007（注册登录）、TC-DES-009（RBAC） | 覆盖 |
| SD-002 内容管理 | TC-DES-007（状态机）、TC-DES-010（发文统计）、TC-DES-011（热度） | 覆盖 |
| SD-003 互动 | TC-DES-007（评论通知）、TC-DES-011（楼中楼敏感词） | 覆盖 |
| SD-004 运营支撑 | TC-DES-010（统计聚合） | 覆盖 |
| SD-005 发现 | TC-DES-010（推荐流）、TC-DES-011（搜索排序） | 覆盖 |
| SD-006 基础设施 governance | TC-DES-001（架构）、TC-DES-008（性能）、TC-DES-009（安全）、TC-DES-012（WAL） | 覆盖 |

### 非功能需求覆盖（5 NFR）

| NFR | 关联 TC-DES | 覆盖状态 |
|---|---|---|
| NFR-001 性能 | TC-DES-008（P95/QPS） | 覆盖 |
| NFR-002 可用性 | TC-DES-012（崩溃恢复） | 覆盖 |
| NFR-003 安全 | TC-DES-009（原型链/RBAC/JWT/zod） | 覆盖 |
| NFR-004 可测试性 | TC-DES-005（覆盖矩阵） + vitest coverage 报告 | 覆盖 |
| NFR-005 可维护性 | TC-DES-001（分层/strict/无循环依赖） | 覆盖 |

### 阶段 1 决策验证覆盖

| 决策 | 关联 TC-DES |
|---|---|
| CONFLICT-001 邮件通知必需 | TC-DES-007 步骤 9（通知验证，邮件 channel 在 UAT-032 验证） |
| CONFLICT-002 操作日志WAL vs 审计日志 | TC-DES-012 步骤 9（审计不参与重放） |
| GAP-001 密码策略 | TC-DES-009 步骤 12/15 |
| GAP-002 推荐等权 | TC-DES-010 步骤 8/9 |
| GAP-003 秒级定时 | TC-DES-007 步骤 5（publishedAt=now） |
| GAP-004 JWT 2h+7d | TC-DES-009 步骤 8/9 |
| GAP-005 敏感词词库 | TC-DES-011 步骤 10 |
| GAP-006 热度公式 | TC-DES-010 步骤 8 / TC-DES-011 步骤 4 |
| GAP-008 评论嵌套≤3级 | TC-DES-011 步骤 9 |
| GAP-009 操作日志90天 | TC-DES-012 步骤 12 |

## 阶段门自检

- [x] 套用 `templates/test-case.md` 模板，`type=系统测试`
- [x] 含 TC-DES-001 架构设计验证
- [x] 含 TC-DES-005 系统测试用例生成
- [x] 含 TC-DES-007 端到端流程（注册→登录→发文→评论→通知全链路）
- [x] 含 TC-DES-008 性能基线（P95≤200ms, 100QPS 持续 10min）
- [x] 含 TC-DES-009 安全基线（原型链污染/RBAC越权/JWT篡改/SQL注入 N/A 验证 zod 校验）
- [x] 含跨子系统集成场景测试用例（TC-DES-010 发文→统计→推荐流；TC-DES-011 评论→通知→热度→搜索；TC-DES-012 崩溃恢复）
- [x] 用例汇总表完整
- [x] 测试用例覆盖说明（功能点 13/13 + 子系统 6/6 + NFR 5/5 + 阶段1决策验证）
- [x] 无 `{{}}` 占位符残留
- [x] 未创建 TLA+ 文件，未修改 graph.json / tla-manifest.json

> 🔴 **CHECKPOINT · 阶段门放行**：本系统测试设计需用户在阶段门评审中确认「TC-DES-007 端到端 / TC-DES-008 性能基线 / TC-DES-009 安全基线 / 跨子系统集成场景」后方可放行进入阶段 3（概要设计）。性能或安全基线用例缺失 → 一律返工。
