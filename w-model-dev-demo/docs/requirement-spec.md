# 需求规格说明书

> 阶段 1（需求分析）产出。覆盖 25 需求（17 REQ + 5 NFR + 3 CON）。

## 文档信息

- 项目名称：blog-system-demo
- 文档版本：v1.0
- 编制日期：2026-07-25
- 编制者：S-doc 子代理（第 8 轮 W 模型端到端调测）

## 1. 项目概述

### 1.1 项目背景

基于 blog-system-demo（Express 4 + TypeScript 5 strict + 内存存储）扩展为多博主协作博客平台。第 8 轮 W 模型端到端调测，在第 6 轮 21 需求基础上新增 4 个功能领域（消息推送、文件上传、订阅、数据导出与备份），验证 W 模型对扩展需求与多模块协作的处理能力，并验证 Part A 门禁增强（basePath/SD 覆盖/codeModule 时机）端到端可用性。

### 1.2 项目目标

- 构建支持多博主协作、多用户互动、内容管理的博客平台后端
- 新增实时消息推送（WebSocket）、流式文件上传、订阅聚合、数据导出与备份能力
- 验证 W 模型对 17 功能域 + 5 非功能 + 3 约束的完整覆盖能力
- TLA+ 全层级规格（1 L1 + 6-7 L2 + 4-5 L3 + 2-3 L4 = 13-15 规格）
- 图谱零违反收敛（预计 90+ 节点 450+ 边）

### 1.3 范围

- 包含：站点管理、多博主、多用户、推荐、广告、统计、搜索、标签、分类、评论、通知、多博文、交叉引用、消息推送、文件上传、订阅、数据导出与备份共 17 个功能域；5 项非功能需求；3 项约束需求
- 不包含：前端 UI 实现（仅后端 API）、真实对象存储集成（使用内存存储抽象）、付费支付集成（付费订阅为占位）

## 2. 需求清单

### 2.1 功能需求

#### REQ-001 站点管理（Site Management）

| 属性 | 值 |
|---|---|
| 需求 ID | REQ-001 |
| 模块 | 站点管理 |
| 优先级 | 高 |
| 场景 | 管理员配置站点级参数（站点名、描述、Logo、备案信息），控制站点开关（维护模式、注册开关、评论开关），管理全局公告（增删改查、定时发布），查看站点统计概览（用户数、文章数、评论数、访问量） |

**验收标准**

1. 管理员可创建/更新站点配置，字段包括 siteName（≤50 字符）、description（≤200 字符）、logoUrl、icpRecord（备案号）
2. 维护模式开启后，非管理员请求返回 503 且响应体含 maintenanceMessage
3. 注册开关关闭时，注册接口返回 403
4. 评论开关关闭时，评论提交接口返回 403
5. 公告支持定时发布：publishedAt 为未来时间时 status=pending，到达时间后自动转为 published
6. 站点统计概览返回 {userCount, articleCount, commentCount, visitCount}，数据实时反映内存存储状态

**数据约束**

- siteName: string, 1-50 字符, 非空
- description: string, 0-200 字符
- 公告 title: string, 1-100 字符
- 公告 content: string, 1-2000 字符
- 公告 status: enum(pending, published, archived)

---

#### REQ-002 多博主（Multi-Blogger）

| 属性 | 值 |
|---|---|
| 需求 ID | REQ-002 |
| 模块 | 多博主 |
| 优先级 | 高 |
| 场景 | 博主通过邮箱+密码注册认证，填写博主资料和头像；系统对博主角色分级（普通博主、认证博主、特邀博主）；博主主页展示文章列表、个人介绍、社交链接；博主之间可关注/取关；博主仅能编辑自己的文章，权限隔离 |

**验收标准**

1. 博主注册需邮箱+密码，密码经 bcrypt 哈希存储，邮箱全局唯一
2. 博主角色分级：normal（普通）、verified（认证）、invited（特邀），管理员可变更角色
3. 博主主页返回 {profile, articles[], socialLinks[]}，文章列表分页（默认 pageSize=10）
4. 关注/取关操作幂等，重复关注返回当前状态不报错
5. 博主 A 尝试编辑博主 B 的文章返回 403
6. 粉丝列表和关注列表支持分页查询

**数据约束**

- email: string, email 格式, 全局唯一
- password: string, ≥8 字符, bcrypt 哈希
- nickname: string, 1-30 字符
- role: enum(normal, verified, invited)
- avatarUrl: string, URL 格式, 可选

---

#### REQ-003 多用户（Multi-User）

| 属性 | 值 |
|---|---|
| 需求 ID | REQ-003 |
| 模块 | 多用户 |
| 优先级 | 高 |
| 场景 | 普通用户注册登录（邮箱+密码、JWT 认证）；用户角色分四级（普通用户、博主、管理员、超级管理员）；用户管理资料（昵称、头像、个人简介）；管理员可封禁/解禁用户并记录原因；关键操作记录审计日志 |

**验收标准**

1. 用户注册返回 JWT token，有效期 24h，后续请求携带 Authorization: Bearer <token>
2. 角色权限：普通用户仅能操作自己资源；博主可管理自己文章；管理员可管理用户和内容；超级管理员可管理管理员
3. 封禁用户后该用户 token 立即失效，登录返回 403 并附封禁原因
4. 审计日志记录：用户ID、操作类型、目标资源、时间戳，支持按时间范围查询
5. 资料更新：nickname（1-30 字符）、avatarUrl、bio（≤200 字符）

**数据约束**

- email: string, email 格式, 全局唯一
- role: enum(user, blogger, admin, super_admin)
- status: enum(active, banned)
- banReason: string, 封禁时必填, 1-200 字符
- JWT expiry: 86400s (24h)

---

#### REQ-004 推荐（Recommendations）

| 属性 | 值 |
|---|---|
| 需求 ID | REQ-004 |
| 模块 | 推荐 |
| 优先级 | 中 |
| 场景 | 基于热度、新鲜度、用户偏好的文章推荐算法；首页推荐流（个性化/热门/最新三种模式）；博主推荐（相似博主、热门博主）；管理员可配置推荐位 |

**验收标准**

1. 推荐算法综合热度（阅读量×0.4 + 点赞数×0.3 + 评论数×0.3）、新鲜度（发布时间 7 天内权重递减）、用户偏好（用户历史阅读标签匹配）
2. 三种推荐模式：personalized（需登录）、hot（无需登录）、latest（无需登录），各返回 ≤20 篇文章
3. 博主推荐返回相似博主（基于共同标签）和热门博主（粉丝数排序），各 ≤10 个
4. 推荐位管理：管理员可增删推荐位，推荐位含 {id, name, type, position, active}
5. 推荐结果不包含已下架/已归档文章

**数据约束**

- 推荐列表大小: 1-20
- 热度权重: hotness=0.4, likes=0.3, comments=0.3
- 新鲜度衰减: 7 天内线性衰减至 0
- 推荐位 position: enum(sidebar, homepage, article_detail)

---

#### REQ-005 广告（Advertising）

| 属性 | 值 |
|---|---|
| 需求 ID | REQ-005 |
| 模块 | 广告 |
| 优先级 | 中 |
| 场景 | 广告位管理（侧边栏、文章内、首页 banner）；广告投放按时间范围、目标用户、展示频次控制；广告点击统计（CTR、展示次数、点击次数）；管理员审核广告上下架 |

**验收标准**

1. 广告位类型：sidebar（侧边栏）、in_article（文章内）、homepage_banner（首页 banner）
2. 广告投放字段：title、imageUrl、targetUrl、startTime、endTime、targetAudience、maxImpressions
3. 广告仅在 startTime ≤ 当前时间 ≤ endTime 且 impressions < maxImpressions 时展示
4. 点击统计：每次展示 impressions+1，每次点击 clicks+1，CTR = clicks / impressions
5. 广告审核状态：pending → approved/rejected，仅 approved 状态广告可展示

**数据约束**

- title: string, 1-100 字符
- imageUrl: string, URL 格式
- targetUrl: string, URL 格式
- maxImpressions: number, >0
- status: enum(pending, approved, rejected)
- targetAudience: enum(all, logged_in, specific_role)

---

#### REQ-006 统计（Statistics）

| 属性 | 值 |
|---|---|
| 需求 ID | REQ-006 |
| 模块 | 统计 |
| 优先级 | 中 |
| 场景 | 文章统计（阅读量、点赞数、评论数、分享数）；用户统计（注册趋势、活跃度、留存率）；博主统计（文章产出、互动率、粉丝增长）；站点统计（访问量、PV/UV、来源分析） |

**验收标准**

1. 文章统计返回 {viewCount, likeCount, commentCount, shareCount}，数据实时反映内存存储
2. 用户统计按日/周/月聚合，返回注册趋势数组 [{date, count}]
3. 博主统计返回 {articleCount, avgInteractionRate, followerGrowth}，互动率 = (likes + comments) / articleCount
4. 站点统计返回 {totalPV, totalUV, topSources[]}，UV 按用户 ID 去重
5. 统计接口仅管理员可访问，返回 403 给非管理员

**数据约束**

- 聚合粒度: enum(daily, weekly, monthly)
- 趋势数组长度: ≤90（最多 90 天数据）
- 互动率计算: interactionRate = (likes + comments) / max(articleCount, 1)

---

#### REQ-007 搜索（Search）

| 属性 | 值 |
|---|---|
| 需求 ID | REQ-007 |
| 模块 | 搜索 |
| 优先级 | 高 |
| 场景 | 文章全文搜索（标题、内容、摘要）；标签/分类/博主搜索；搜索结果按相关度/时间/热度排序；搜索建议（自动补全、热门搜索）；搜索历史按用户维度记录 |

**验收标准**

1. 全文搜索匹配标题、内容、摘要三个字段，支持分词（按空格和标点分割）
2. 多维度搜索：tags（按标签名）、categories（按分类名）、bloggers（按博主昵称），各返回分页结果
3. 排序模式：relevance（匹配度降序）、time（发布时间降序）、hotness（热度降序）
4. 自动补全返回 ≤10 条建议，热门搜索返回 ≤10 个关键词
5. 搜索历史按用户记录，最多保留 100 条，超出时 FIFO 淘汰
6. 搜索响应 P95 ≤ 500ms（NFR-001）

**数据约束**

- 搜索关键词: string, 1-100 字符
- 分页 pageSize: 1-50, 默认 10
- 自动补全建议数: ≤10
- 搜索历史上限: 100 条/用户
- 排序模式: enum(relevance, time, hotness)

---

#### REQ-008 标签（Tags）

| 属性 | 值 |
|---|---|
| 需求 ID | REQ-008 |
| 模块 | 标签 |
| 优先级 | 中 |
| 场景 | 标签创建与绑定（文章可多标签）；标签云（热门标签按使用频次排序）；标签关注（用户关注标签后推荐相关文章）；标签合并与管理员审核（防重标签、合并相似标签） |

**验收标准**

1. 文章可绑定多个标签（≤10 个），标签名全局唯一（大小写不敏感）
2. 标签云返回 {tag, count}[] 按 count 降序，最多 50 个
3. 用户关注标签后，推荐流包含该标签文章
4. 管理员可合并相似标签：源标签文章迁移到目标标签，源标签删除
5. 新标签创建需管理员审核（pending → approved），approved 标签才可被文章使用
6. 标签名: 1-20 字符，禁止特殊字符（仅允许中文、字母、数字、连字符）

**数据约束**

- tagName: string, 1-20 字符, 大小写不敏感唯一
- 文章标签数: ≤10
- 标签云大小: ≤50
- status: enum(pending, approved, rejected)

---

#### REQ-009 分类（Categories）

| 属性 | 值 |
|---|---|
| 需求 ID | REQ-009 |
| 模块 | 分类 |
| 优先级 | 中 |
| 场景 | 分类树（多级分类、父子关系）；分类下文章列表（分页排序）；分类导航（菜单、面包屑）；分类管理（增删改查、排序、合并） |

**验收标准**

1. 分类树支持多级（≤5 层），每个分类有 parentId（根分类 parentId=null）
2. 分类下文章列表分页返回，可按 time/hotness 排序
3. 面包屑返回从根到当前分类的完整路径 [{id, name, parentId}]
4. 分类管理：增删改查，删除时子分类一并删除（级联删除），文章归类到未分类
5. 分类合并：源分类文章迁移到目标分类，源分类删除
6. 分类排序：管理员可设置 sortOrder（数字，升序排列）

**数据约束**

- categoryName: string, 1-30 字符, 同级唯一
- 分类树深度: ≤5 层
- parentId: string | null
- sortOrder: number, ≥0

---

#### REQ-010 评论（Comments）

| 属性 | 值 |
|---|---|
| 需求 ID | REQ-010 |
| 模块 | 评论 |
| 优先级 | 高 |
| 场景 | 文章评论支持多级回复（楼中楼）；评论审核（管理员审核、敏感词过滤）；评论点赞；评论举报与处理；评论分页与排序（按时间/热度） |

**验收标准**

1. 评论支持多级回复（≤5 层嵌套），每条评论有 parentId（顶级评论 parentId=null）
2. 评论审核：含敏感词的评论自动标记 pending，管理员审核后 approved/rejected
3. 评论点赞：每用户每评论仅能点赞一次，再次点击取消点赞，返回点赞数
4. 举报评论：举报者填写 reason（1-200 字符），状态为 reported，管理员处理后标记 resolved
5. 分页排序：按 time（创建时间降序）或 hotness（点赞数降序），默认 pageSize=20
6. 评论内容: 1-1000 字符

**数据约束**

- content: string, 1-1000 字符
- 嵌套深度: ≤5 层
- status: enum(pending, approved, rejected, reported, resolved)
- reason（举报）: string, 1-200 字符
- pageSize: 1-50, 默认 20

---

#### REQ-011 通知（Notifications）

| 属性 | 值 |
|---|---|
| 需求 ID | REQ-011 |
| 模块 | 通知 |
| 优先级 | 高 |
| 场景 | 站内通知（系统通知、互动通知、关注通知）；通知触发（评论回复、点赞、关注、审核结果）；通知已读管理（标记已读、全部已读、未读数）；通知设置（用户可关闭某类通知） |

**验收标准**

1. 通知类型：system（系统通知）、interaction（互动通知：评论回复/点赞）、follow（关注通知）、audit（审核结果通知）
2. 事件触发：评论被回复→interaction 通知、被关注→follow 通知、文章审核完成→audit 通知
3. 标记已读：单条标记和全部已读，未读数实时返回
4. 通知设置：用户可开关每类通知 {system, interaction, follow, audit}，默认全开
5. 通知列表分页返回，按 createdAt 降序
6. 被关闭的通知类型不创建通知记录

**数据约束**

- type: enum(system, interaction, follow, audit)
- title: string, 1-100 字符
- content: string, 1-500 字符
- isRead: boolean, 默认 false
- pageSize: 1-50, 默认 20

---

#### REQ-012 多博文（Multiple Articles）

| 属性 | 值 |
|---|---|
| 需求 ID | REQ-012 |
| 模块 | 多博文 |
| 优先级 | 高 |
| 场景 | 文章 CRUD（标题、内容、摘要、封面图、状态）；文章状态机（草稿→待审核→已发布→已下架→已归档）；文章系列（多篇归属一个系列、系列顺序）；文章定时发布；管理员批量管理（下架、归档） |

**验收标准**

1. 文章字段：title（1-200 字符）、content（1-50000 字符）、summary（0-500 字符）、coverImageUrl、status
2. 状态机：draft → pending_review → published → offline → archived，禁止逆向跳转（archived 不可回到 published）
3. 定时发布：scheduledAt 为未来时间时，到达时间后自动从 draft → pending_review
4. 文章系列：创建 series（name, description），文章可归属系列并设置 order
5. 批量管理：管理员可批量下架/归档，操作需确认，记录操作日志
6. 文章删除为软删除（status=archived），不物理删除

**数据约束**

- title: string, 1-200 字符
- content: string, 1-50000 字符
- summary: string, 0-500 字符
- status: enum(draft, pending_review, published, offline, archived)
- scheduledAt: ISO 8601, 未来时间, 可选
- seriesOrder: number, ≥0

---

#### REQ-013 交叉引用（Cross-References）

| 属性 | 值 |
|---|---|
| 需求 ID | REQ-013 |
| 模块 | 交叉引用 |
| 优先级 | 中 |
| 场景 | 文章间显式引用链接、自动反向链接；引用关系图谱（被引用数、引用其他文章数）；相关文章推荐（基于共同标签/分类/引用关系）；被引用时通知原作者 |

**验收标准**

1. 文章 A 显式引用文章 B 时，系统自动为 B 创建反向链接（B 的"被引用"列表包含 A）
2. 引用关系图谱：每篇文章返回 {citedByCount, citingCount, citedBy[], citing[]}
3. 相关文章推荐：基于共同标签（权重 0.5）、共同分类（权重 0.3）、引用关系（权重 0.2）综合计算，返回 ≤10 篇
4. 被引用时自动触发通知给原作者（引用通知，类型 interaction）
5. 禁止自引用（文章不能引用自己），返回 400
6. 引用目标必须为 published 状态文章

**数据约束**

- 引用关系: 有向边 A → B
- 相关文章数: ≤10
- 推荐权重: tag=0.5, category=0.3, citation=0.2
- 禁止自引用

---

#### REQ-014 消息推送（Message Push）★ 第 8 轮新增

| 属性 | 值 |
|---|---|
| 需求 ID | REQ-014 |
| 模块 | 消息推送 |
| 优先级 | 高 |
| 场景 | 基于 WebSocket 长连接的实时消息推送；推送场景包括新评论、新关注、新文章发布、系统公告；用户可订阅/取消订阅推送通道；在线状态感知（上线/下线广播给关注者）；推送失败重试与离线消息合并 |

**验收标准**

1. WebSocket 连接建立后维持长连接，客户端通过 ws:// 连接，服务端维护 connectionId → userId 映射
2. 推送场景触发：新评论→通知文章作者、新关注→通知被关注者、新文章发布→通知订阅者、系统公告→广播全体在线用户
3. 推送订阅管理：用户可订阅/取消订阅通道 {comment, follow, article, announcement}，默认全订阅
4. 在线状态感知：用户上线时广播给其关注者（上线事件），下线时同样广播（下线事件）
5. 推送失败重试：最多 3 次重试，间隔 1s/2s/4s（指数退避），3 次失败后转为离线消息
6. 离线消息合并：用户离线期间的同类消息合并为 1 条，保留 24h，用户上线后推送
7. 推送延迟 ≤ 100ms（NFR-001）

**数据约束**

- WebSocket 协议: ws（基于 ws 库）
- 推送通道: enum(comment, follow, article, announcement)
- 最大重试次数: 3
- 重试间隔: 1s, 2s, 4s（指数退避）
- 离线消息保留: 24h
- 离线消息合并: 同类消息合并为 1 条
- 在线状态: enum(online, offline)

---

#### REQ-015 文件上传（File Upload）★ 第 8 轮新增

| 属性 | 值 |
|---|---|
| 需求 ID | REQ-015 |
| 模块 | 文件上传 |
| 优先级 | 高 |
| 场景 | 图片上传（封面图、头像、文章内图片，支持 JPG/PNG/WebP/GIF）；文件附件上传（PDF/Markdown/ZIP，单文件 ≤10MB）；上传配额管理（用户日配额、博主月配额、站点总配额）；文件元数据管理；文件安全校验（魔数校验、文件名消毒）；文件存储抽象（内存存储 + 元数据索引） |

**验收标准**

1. 图片上传支持 MIME 白名单：image/jpeg、image/png、image/webp、image/gif
2. 附件上传支持 MIME 白名单：application/pdf、text/markdown、application/zip，单文件 ≤10MB
3. 上传配额：用户日配额默认 50MB、博主月配额默认 500MB、站点总配额默认 10GB，超限返回 413
4. 文件元数据：{id, originalName, sanitized name, mimeType, size, uploaderId, sha256, uploadedAt}
5. 安全校验：魔数校验（验证文件头与 MIME 类型一致）、文件名消毒（去除路径穿越字符 ../ 和特殊字符）
6. 流式处理：使用 Node.js stream 不引入 multer，内存存储为 Buffer + 元数据 Map
7. SHA-256 摘要：上传后计算文件内容摘要，用于去重和完整性校验

**数据约束**

- 图片 MIME: image/jpeg, image/png, image/webp, image/gif
- 附件 MIME: application/pdf, text/markdown, application/zip
- 单文件大小: ≤10MB (10485760 bytes)
- 用户日配额: 50MB (默认)
- 博主月配额: 500MB (默认)
- 站点总配额: 10GB (默认)
- SHA-256: 64 字符 hex 字符串
- 存储方式: 内存 Buffer + Map 元数据索引

---

#### REQ-016 订阅（Subscriptions）★ 第 8 轮新增

| 属性 | 值 |
|---|---|
| 需求 ID | REQ-016 |
| 模块 | 订阅 |
| 优先级 | 高 |
| 场景 | 博主订阅（订阅后新文章推送）、标签订阅（相关文章聚合推送）、分类订阅（新文章推送）；订阅权限分级（免费/付费占位/邀请制）；订阅通知聚合（每小时聚合一次避免洪水）；订阅关系图谱（双向查询） |

**验收标准**

1. 订阅类型：blogger（博主订阅）、tag（标签订阅）、category（分类订阅）
2. 订阅博主后，博主发布新文章时触发推送（通过 REQ-014 消息推送通道）
3. 标签订阅：该标签下有新文章时聚合推送，每小时聚合一次（避免通知洪水）
4. 订阅权限分级：free（免费，默认）、paid（付费占位，预留接口）、invitation（邀请制，需邀请码）
5. 订阅关系图谱：支持双向查询——查询用户订阅列表、查询被订阅者粉丝列表
6. 取消订阅幂等，重复取消返回当前状态不报错
7. 聚合推送：同小时内多个新文章合并为 1 条通知

**数据约束**

- 订阅类型: enum(blogger, tag, category)
- 权限级别: enum(free, paid, invitation)
- 聚合窗口: 1 小时
- 订阅关系: 有向边 subscriber → target
- 邀请码: string, 8-32 字符 (invitation 类型必填)

---

#### REQ-017 数据导出与备份（Data Export & Backup）★ 第 8 轮新增

| 属性 | 值 |
|---|---|
| 需求 ID | REQ-017 |
| 模块 | 数据导出与备份 |
| 优先级 | 高 |
| 场景 | 用户数据导出（个人资料/文章/评论/订阅，CSV/JSON）；博主数据导出（文章/系列/统计/粉丝）；管理员站点备份（全量快照 JSON 含版本号）；备份恢复（含完整性校验）；增量导出（按时间范围）；导出任务管理（异步/进度/下载）；GDPR 合规占位 |

**验收标准**

1. 用户导出：导出个人资料、文章、评论、订阅列表，格式 CSV 或 JSON（用户选择）
2. 博主导出：导出文章、系列、统计摘要、粉丝列表，格式 CSV 或 JSON
3. 管理员备份：全量数据快照（users, bloggers, articles, comments, tags, categories, notifications, subscriptions），JSON 格式，含 version 和 timestamp
4. 备份恢复：从备份文件恢复到内存存储，恢复前校验数据完整性（SHA-256 校验和），不一致返回 422
5. 增量导出：按 startTime/endTime 时间范围导出新增/修改数据
6. 导出任务异步执行：创建任务返回 taskId，支持查询进度（pending/running/completed/failed），完成后提供下载
7. GDPR 占位：用户数据删除请求接口（标记删除，30 天后物理清除），数据可携带性（导出接口即满足）

**数据约束**

- 导出格式: enum(csv, json)
- 备份版本: string, 格式 "v{timestamp}"
- 备份文件大小: ≤10MB（集成测试规模，CON-003）
- 增量导出时间范围: startTime, endTime (ISO 8601)
- 任务状态: enum(pending, running, completed, failed)
- 任务保留: 7 天后自动清理
- GDPR 删除延迟: 30 天

---

### 2.2 非功能需求

| 需求 ID | 类别 | 描述 | 指标 |
|---|---|---|---|
| NFR-001 | 性能 | 接口响应 P95 ≤ 200ms（不含外部网络）；单实例并发 ≥ 100 QPS；搜索响应 P95 ≤ 500ms；文件上传响应 P95 ≤ 1s（10MB 以内）；WebSocket 推送延迟 ≤ 100ms | P95 ≤ 200ms / QPS ≥ 100 / 搜索 P95 ≤ 500ms / 上传 P95 ≤ 1s / 推送 ≤ 100ms |
| NFR-002 | 可用性 | 内存存储崩溃后可从持久化日志重建（操作日志可选）；错误率 ≤ 0.1%；备份恢复成功率 ≥ 99% | 错误率 ≤ 0.1% / 恢复成功率 ≥ 99% |
| NFR-003 | 安全 | JWT 认证 + bcrypt 密码哈希；RBAC 角色权限分级；zod 输入校验；防原型链污染；敏感操作审计日志；文件上传安全校验（魔数/大小/MIME 白名单） | bcrypt 哈希 / RBAC 4 级 / zod 校验全覆盖 / 魔数校验 |
| NFR-004 | 可测试性 | 单元测试覆盖率 ≥ 80%（lines）；集成测试覆盖核心业务链路；系统测试覆盖端到端场景；验收测试覆盖所有功能点 | 覆盖率 ≥ 80% / 四级测试全覆盖 |
| NFR-005 | 可维护性 | TypeScript strict 模式 0 错误；模块化分层（controller → service → store）；公共工具复用（auth、validate、error-handler） | strict 0 错误 / 三层分层 / 公共工具复用 |

### 2.3 约束需求

| 需求 ID | 类别 | 描述 |
|---|---|---|
| CON-001 | 技术栈 | Express 4 + TypeScript 5 (strict)；内存存储（Map）不引入数据库；vitest 测试框架；zod 校验；bcrypt + jsonwebtoken；WebSocket 使用 ws 库（仅消息推送模块）；文件上传使用流式处理（不引入 multer，自行实现） |
| CON-002 | 部署 | 单实例部署；Node.js 20+ 运行时 |
| CON-003 | 数据规模 | 单元测试阶段：≤100 篇文章、≤50 用户、≤50 文件；集成测试阶段：≤1000 篇文章、≤200 用户、≤200 文件；备份文件大小：≤10MB（集成测试规模） |

## 3. 需求完整性检查

| 检查项 | 状态 | 说明 |
|---|---|---|
| 功能需求闭环 | ✅ | 17 个功能需求（REQ-001~017）均有完整场景、验收标准、数据约束；新增 4 个需求（REQ-014~017）覆盖消息推送/文件上传/订阅/数据导出与备份 |
| 非功能需求覆盖 | ✅ | 5 个 NFR 覆盖性能/可用性/安全/可测试性/可维护性，指标均可量化 |
| 约束需求覆盖 | ✅ | 3 个 CON 覆盖技术栈/部署/数据规模 |
| 冲突检测 | ✅ | 0 冲突——所有需求间无矛盾描述；REQ-014 推送与 REQ-011 通知协同（推送是传输层，通知是业务层），不冲突 |
| 缺失项检测 | ✅ | 0 缺失——密码策略已在 REQ-002/003 隐含（≥8 字符 + bcrypt）；文件上传安全已在 REQ-015 + NFR-003 覆盖 |
| 第 8 轮新增覆盖 | ✅ | REQ-014 消息推送 / REQ-015 文件上传 / REQ-016 订阅 / REQ-017 数据导出与备份 4 个新需求完整 |

## 4. 需求风险评估

| 风险 ID | 风险描述 | 等级 | 缓解措施 |
|---|---|---|---|
| RISK-001 | WebSocket 长连接在内存存储下的并发管理复杂（REQ-014） | 高 | 使用 ws 库 + Map 维护连接池；连接断开时清理资源；离线消息合并减少存储压力 |
| RISK-002 | 文件上传流式处理 + 内存存储可能导致内存溢出（REQ-015） | 高 | 限制单文件 ≤10MB；配额管理限制总量；大文件分片处理；CON-003 限制测试数据规模 |
| RISK-003 | 订阅通知聚合的定时任务在单实例内存存储下的可靠性（REQ-016） | 中 | 使用 setInterval 定时聚合；崩溃后从操作日志重建（NFR-002）；聚合窗口 1h 可配置 |
| RISK-004 | 数据备份恢复的完整性校验在内存存储下的实现复杂度（REQ-017） | 中 | SHA-256 校验和；备份文件 ≤10MB（CON-003）；恢复前全量校验 |
| RISK-005 | 17 个功能域的模块间依赖复杂度高（跨模块协作） | 中 | 图谱校验确保依赖清晰；governs/collaborates-with 边明确治理与协作关系；分层架构（controller→service→store）降低耦合 |
| RISK-006 | TLA+ 全层级规格（13-15 个）的建模工作量大 | 中 | L1 系统级→L2 子系统级→L3 原子行为级→L4 按需；拆解阈值 >1k 考虑拆/>1w 必须拆 |
| RISK-007 | 搜索全文检索在内存存储下性能瓶颈（REQ-007, NFR-001） | 中 | 倒排索引 Map 预构建；搜索 P95 ≤500ms 为独立指标；数据规模受 CON-003 限制 |

## 5. 验收测试用例索引

> 详细用例见 `docs/acceptance-test-cases.md`。共 56 个 UAT 用例（51 个功能 + 5 个非功能）。

| 用例 ID | 关联需求 | 场景 | 优先级 |
|---|---|---|---|
| UAT-001 | REQ-001 | 站点配置正常更新 | 高 |
| UAT-002 | REQ-001 | 维护模式开关验证 | 高 |
| UAT-003 | REQ-001 | 公告定时发布边界 | 中 |
| UAT-004 | REQ-002 | 博主注册正常流程 | 高 |
| UAT-005 | REQ-002 | 重复邮箱注册异常 | 高 |
| UAT-006 | REQ-002 | 权限隔离边界（跨博主编辑） | 高 |
| UAT-007 | REQ-003 | 用户登录 JWT 正常 | 高 |
| UAT-008 | REQ-003 | 封禁用户 token 失效 | 高 |
| UAT-009 | REQ-003 | 角色权限越权异常 | 高 |
| UAT-010 | REQ-004 | 热门推荐正常返回 | 中 |
| UAT-011 | REQ-004 | 个性化推荐需登录 | 中 |
| UAT-012 | REQ-004 | 推荐位管理异常（非管理员） | 中 |
| UAT-013 | REQ-005 | 广告投放正常流程 | 中 |
| UAT-014 | REQ-005 | 广告时间范围边界 | 中 |
| UAT-015 | REQ-005 | 广告审核状态异常 | 中 |
| UAT-016 | REQ-006 | 文章统计正常返回 | 中 |
| UAT-017 | REQ-006 | 用户统计趋势聚合 | 中 |
| UAT-018 | REQ-006 | 非管理员访问统计异常 | 高 |
| UAT-019 | REQ-007 | 全文搜索正常 | 高 |
| UAT-020 | REQ-007 | 搜索排序模式切换 | 中 |
| UAT-021 | REQ-007 | 搜索历史 FIFO 淘汰边界 | 中 |
| UAT-022 | REQ-008 | 标签创建与绑定 | 中 |
| UAT-023 | REQ-008 | 标签合并管理员操作 | 中 |
| UAT-024 | REQ-008 | 标签名特殊字符异常 | 中 |
| UAT-025 | REQ-009 | 分类树多级创建 | 中 |
| UAT-026 | REQ-009 | 分类级联删除边界 | 中 |
| UAT-027 | REQ-009 | 分类排序正常 | 低 |
| UAT-028 | REQ-010 | 评论多级回复正常 | 高 |
| UAT-029 | REQ-010 | 敏感词评论审核 | 高 |
| UAT-030 | REQ-010 | 评论点赞幂等性 | 中 |
| UAT-031 | REQ-011 | 通知触发正常 | 高 |
| UAT-032 | REQ-011 | 通知全部已读 | 中 |
| UAT-033 | REQ-011 | 通知设置关闭某类 | 中 |
| UAT-034 | REQ-012 | 文章状态机正常流转 | 高 |
| UAT-035 | REQ-012 | 状态机逆向跳转异常 | 高 |
| UAT-036 | REQ-012 | 定时发布到达触发 | 中 |
| UAT-037 | REQ-013 | 交叉引用正常建立 | 中 |
| UAT-038 | REQ-013 | 自引用异常 | 中 |
| UAT-039 | REQ-013 | 相关文章推荐计算 | 中 |
| UAT-040 | REQ-014 | WebSocket 连接与推送 | 高 |
| UAT-041 | REQ-014 | 推送失败重试与离线合并 | 高 |
| UAT-042 | REQ-014 | 在线状态广播 | 中 |
| UAT-043 | REQ-015 | 图片上传正常 | 高 |
| UAT-044 | REQ-015 | 文件超 10MB 异常 | 高 |
| UAT-045 | REQ-015 | 魔数校验不匹配异常 | 高 |
| UAT-046 | REQ-016 | 博主订阅与推送 | 高 |
| UAT-047 | REQ-016 | 标签订阅聚合推送 | 中 |
| UAT-048 | REQ-016 | 订阅权限分级 | 中 |
| UAT-049 | REQ-017 | 用户数据导出 JSON | 高 |
| UAT-050 | REQ-017 | 管理员备份与恢复 | 高 |
| UAT-051 | REQ-017 | 增量导出时间范围 | 中 |
| UAT-052 | NFR-001 | 接口响应 P95 性能 | 高 |
| UAT-053 | NFR-002 | 备份恢复成功率 | 高 |
| UAT-054 | NFR-003 | 安全校验（JWT/bcrypt/魔数） | 高 |
| UAT-055 | NFR-004 | 单元测试覆盖率 ≥80% | 高 |
| UAT-056 | NFR-005 | TypeScript strict 0 错误 | 高 |

## 6. 需求依赖关系

### 6.1 模块间依赖

| 上游模块 | 下游模块 | 依赖类型 | 说明 |
|---|---|---|---|
| REQ-003 多用户 | REQ-002 多博主 | depends-on | 博主是特殊用户角色 |
| REQ-003 多用户 | REQ-011 通知 | depends-on | 通知需用户身份 |
| REQ-012 多博文 | REQ-010 评论 | depends-on | 评论归属文章 |
| REQ-012 多博文 | REQ-008 标签 | depends-on | 标签绑定文章 |
| REQ-012 多博文 | REQ-009 分类 | depends-on | 文章归属分类 |
| REQ-012 多博文 | REQ-013 交叉引用 | depends-on | 引用关系基于文章 |
| REQ-011 通知 | REQ-014 消息推送 | depends-on | 推送是通知的传输层 |
| REQ-012 多博文 | REQ-016 订阅 | depends-on | 订阅博主的新文章推送 |
| REQ-015 文件上传 | REQ-012 多博文 | depends-on | 文章封面图/内图依赖上传 |
| REQ-015 文件上传 | REQ-002 多博主 | depends-on | 博主头像依赖上传 |
| REQ-006 统计 | REQ-017 数据导出 | depends-on | 导出含统计数据 |

### 6.2 新增需求协作关系（第 8 轮）

| 模块 A | 模块 B | 协作类型 | 说明 |
|---|---|---|---|
| REQ-014 消息推送 | REQ-011 通知 | collaborates-with | 通知触发推送，推送是通知传输层 |
| REQ-014 消息推送 | REQ-016 订阅 | collaborates-with | 订阅新文章通过推送送达 |
| REQ-015 文件上传 | REQ-012 多博文 | collaborates-with | 文章封面/内图通过上传 |
| REQ-016 订阅 | REQ-011 通知 | collaborates-with | 订阅触发通知（聚合后） |
| REQ-017 数据导出 | REQ-006 统计 | collaborates-with | 导出含统计数据 |

### 6.3 非功能需求治理关系

| NFR | 治理模块 | 说明 |
|---|---|---|
| NFR-001 性能 | REQ-001, REQ-007, REQ-012, REQ-014 | 性能关键模块 |
| NFR-002 可用性 | REQ-001, REQ-012, REQ-017 | 可用性关键模块 |
| NFR-003 安全 | REQ-003, REQ-010, REQ-014, REQ-015, REQ-017 | 安全关键模块 |
| NFR-004 可测试性 | REQ-001, REQ-002, REQ-003 | 可测试性关键模块 |
| NFR-005 可维护性 | REQ-001, REQ-002, REQ-003 | 可维护性关键模块 |
