(*
  @system        blog-system-demo
  @requirement   SD-001, SD-002, SD-003, SD-004, SD-005, SD-006, SD-007, SD-008, SD-009, SD-010, SD-011, SD-012, SD-013, SD-014, SD-015, SD-016, SD-017
  @design        docs/requirement-spec.md
  @parent        null
  @sibling       null
  @child         ../tla/L2_content_management.tla, ../tla/L2_identity_access.tla, ../tla/L2_discovery.tla, ../tla/L2_interaction.tla, ../tla/L2_operations_support.tla, ../tla/L2_infrastructure.tla, ../tla/L2_subscription_push.tla
  @level         L1
  @phase         1
  所属系统: blog-system-demo
  关联需求: requirement-spec.md (25 需求, 17 SD 子系统)
  关联设计: system-design.md (阶段 2 已产出)
  上级 TLA: 无（L1 为顶层）
  同级 TLA: 无
  下级 TLA: 7 个 L2 规格（阶段 2 S-tla 产出，覆盖 17 SD 子系统）
    - L2_content_management.tla   (SD-008/009/012/013 内容管理域)
    - L2_identity_access.tla      (SD-002/003 身份与访问域)
    - L2_discovery.tla            (SD-004/005/006/007 发现域)
    - L2_interaction.tla          (SD-010/011 互动域)
    - L2_operations_support.tla   (SD-001/017 运营支撑域)
    - L2_infrastructure.tla       (SD-015 + WAL + 审计 基础设施域)
    - L2_subscription_push.tla    (SD-014/016 订阅与推送域)
  层级: L1 (系统内外交互)
  requirementIds: [SD-001, SD-002, SD-003, SD-004, SD-005, SD-006, SD-007, SD-008, SD-009, SD-010, SD-011, SD-012, SD-013, SD-014, SD-015, SD-016, SD-017]
*)
---- MODULE L1_blog_system ----
EXTENDS Naturals, Sequences, FiniteSets

(* ==================== 常量 ==================== *)
CONSTANTS
    Users,          (* 用户全集：普通用户/博主/管理员/超级管理员 *)
    Articles,       (* 文章全集 *)
    Categories,     (* 分类全集 *)
    Tags,           (* 标签全集 *)
    Ads,            (* 广告全集 *)
    Notifications,  (* 通知全集 *)
    Files,          (* 文件全集 *)
    Subscriptions,  (* 订阅目标全集：博主/标签/分类 *)
    Backups         (* 备份任务全集 *)

(* ==================== 状态空间定义 ==================== *)
(* 系统运行状态：running 正常运行 / maintenance 维护模式 (REQ-001 验收标准 2) *)
RunningState == "running"
MaintenanceState == "maintenance"
SystemStates == {RunningState, MaintenanceState}

(* 文章状态机：draft → pending_review → published → offline → archived (REQ-012 验收标准 2)
   禁止逆向跳转（archived 不可回到 published） *)
ArticleDraft == "draft"
ArticlePendingReview == "pending_review"
ArticlePublished == "published"
ArticleOffline == "offline"
ArticleArchived == "archived"
ArticleStates == {ArticleDraft, ArticlePendingReview, ArticlePublished, ArticleOffline, ArticleArchived}
NonExistArticle == "notexist"

(* 文件状态：uploaded 已上传 / notexist 未上传 (REQ-015) *)
FileUploaded == "uploaded"
FileNotExist == "notexist"
FileStates == {FileUploaded, FileNotExist}

(* ==================== 变量 ==================== *)
VARIABLES
    systemState,           (* 系统运行状态 *)
    activeUsers,           (* 已注册用户集合 *)
    articleCatalog,        (* 文章目录：article -> 状态 *)
    notificationQueue,     (* 通知队列：待推送通知序列 *)
    fileStore,             (* 文件存储：file -> 状态 *)
    subscriptionRegistry,  (* 订阅注册表：user -> 订阅目标集合 *)
    backupSchedule         (* 备份调度：已调度备份任务集合 *)

vars == <<systemState, activeUsers, articleCatalog, notificationQueue, fileStore, subscriptionRegistry, backupSchedule>>

(* ==================== 状态不变式（TypeInvariant） ==================== *)
TypeInvariant ==
    /\ systemState \in SystemStates
    /\ activeUsers \subseteq Users
    /\ articleCatalog \in [Articles -> ArticleStates \cup {NonExistArticle}]
    /\ notificationQueue \in Seq(Notifications)
    /\ fileStore \in [Files -> FileStates]
    /\ subscriptionRegistry \in [Users -> SUBSET Subscriptions]
    /\ backupSchedule \subseteq Backups

(* ==================== 业务不变式 ==================== *)

(* @designRef docs/requirement-spec.md#§2.1 REQ-001 站点管理
 * 业务语义：系统状态必须始终合法（running 或 maintenance）。
 *   维护模式下非管理员请求返回 503 且响应体含 maintenanceMessage（REQ-001 验收标准 2）。
 *   系统不得处于未定义状态；状态切换由管理员控制，保证站点可运维性。 *)
SystemInvariant ==
    /\ systemState \in SystemStates
    /\ systemState = MaintenanceState => activeUsers \subseteq Users

(* @designRef docs/requirement-spec.md#§2.1 REQ-003 多用户
 * 业务语义：已注册用户数必须非负且不超过用户全集。
 *   activeUsers 是 Users 的子集，注册用户数 = Cardinality(activeUsers) >= 0 恒成立。
 *   封禁用户后 token 立即失效，但用户记录保留在 activeUsers 中（REQ-003 验收标准 3）。
 *   用户角色分四级：普通用户/博主/管理员/超级管理员，均属于 Users 全集。 *)
UserCountInvariant ==
    /\ activeUsers \subseteq Users
    /\ Cardinality(activeUsers) >= 0

(* @designRef docs/requirement-spec.md#§2.1 REQ-012 多博文
 * 业务语义：文章状态机合法——已注册文章的状态必须在 ArticleStates 中，
 *   且状态转移遵循 draft → pending_review → published → offline → archived 单向流转，
 *   禁止逆向跳转（archived 不可回到 published，REQ-012 验收标准 2）。
 *   未注册文章状态为 NonExistArticle；文章删除为软删除（status=archived，REQ-012 验收标准 6）。 *)
ArticleStateInvariant ==
    /\ \A a \in Articles :
        articleCatalog[a] \in ArticleStates \cup {NonExistArticle}
    /\ \A a \in Articles :
        articleCatalog[a] # NonExistArticle => articleCatalog[a] \in ArticleStates

(* @designRef docs/requirement-spec.md#§2.1 REQ-011 通知 + REQ-014 消息推送
 * 业务语义：通知队列有限——队列元素均为合法通知 ID，且队列长度不超过 Notifications 全集大小。
 *   防止通知洪水导致内存溢出；用户可通过通知设置关闭某类通知（REQ-011 验收标准 4/6）。
 *   离线消息合并：同类消息合并为 1 条，保留 24h（REQ-014 验收标准 6）。
 *   队列长度上界 = Cardinality(Notifications)，对应离线消息合并语义。 *)
NotificationQueueInvariant ==
    /\ \A n \in 1..Len(notificationQueue) : notificationQueue[n] \in Notifications
    /\ Len(notificationQueue) <= Cardinality(Notifications)
    /\ Len(notificationQueue) >= 0

(* @designRef docs/requirement-spec.md#§2.1 REQ-015 文件上传
 * 业务语义：文件存储一致——fileStore 中每个文件的状态必须在 FileStates 中。
 *   已上传文件（uploaded）的元数据完整：MIME 类型、大小、上传者、SHA-256 摘要（REQ-015 验收标准 4/7）。
 *   配额管理确保站点总存储不超过限制（用户日配额 50MB、博主月配额 500MB、站点总配额 10GB，
 *   REQ-015 验收标准 3）；单文件 <=10MB（REQ-015 数据约束）。 *)
FileStoreInvariant ==
    /\ fileStore \in [Files -> FileStates]
    /\ \A f \in Files : fileStore[f] = FileUploaded => f \in Files

(* @designRef docs/requirement-spec.md#§2.1 REQ-016 订阅
 * 业务语义：订阅关系双向一致——每个用户的订阅集合是 Subscriptions 的子集。
 *   订阅类型：blogger（博主订阅）、tag（标签订阅）、category（分类订阅），均为 Subscriptions 元素。
 *   订阅关系为有向边 subscriber → target，支持双向查询（REQ-016 验收标准 5）。
 *   取消订阅幂等，重复取消返回当前状态不报错（REQ-016 验收标准 6）。
 *   订阅权限分级：free/paid/invitation（REQ-016 验收标准 4）。 *)
SubscriptionInvariant ==
    /\ subscriptionRegistry \in [Users -> SUBSET Subscriptions]
    /\ \A u \in Users : subscriptionRegistry[u] \subseteq Subscriptions

(* @designRef docs/requirement-spec.md#§2.1 REQ-017 数据导出与备份
 * 业务语义：备份调度合法——backupSchedule 中的备份任务必须属于 Backups 全集。
 *   任务状态流转：pending → running → completed/failed（REQ-017 验收标准 6）。
 *   备份文件 <=10MB（CON-003），恢复前校验数据完整性（SHA-256 校验和，REQ-017 验收标准 4）。
 *   备份恢复成功率 >= 99%（NFR-002）；导出任务异步执行，支持进度查询。 *)
BackupScheduleInvariant ==
    /\ backupSchedule \subseteq Backups
    /\ Cardinality(backupSchedule) <= Cardinality(Backups)

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 须聚合所有子不变式（含 TypeInvariant）；.cfg 的 INVARIANTS 列表须与此展开集合一致 *)
(* 见 tla-plus-guide.md §11 cfg-tla 一致性规则；check-tla-model.ts 强制校验集合相等 *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ SystemInvariant
    /\ UserCountInvariant
    /\ ArticleStateInvariant
    /\ NotificationQueueInvariant
    /\ FileStoreInvariant
    /\ SubscriptionInvariant
    /\ BackupScheduleInvariant

(* ==================== 初始状态 ==================== *)
Init ==
    /\ systemState = RunningState
    /\ activeUsers = {}
    /\ articleCatalog = [a \in Articles |-> NonExistArticle]
    /\ notificationQueue = <<>>
    /\ fileStore = [f \in Files |-> FileNotExist]
    /\ subscriptionRegistry = [u \in Users |-> {}]
    /\ backupSchedule = {}

(* ==================== 状态转移（Next） ==================== *)
(* 系统内外交互：EXT-IN（用户请求）→ System 状态转移 → EXT-OUT（响应/推送/导出）
 * 9 个 Next 动作对应 17 SD 子系统的核心外部交互入口
 * 动作命名 PascalCase，与后续代码 camelCase 方法名映射（如 UserRegister ↔ userRegister） *)

(* 动作1：用户注册（SD-003 多用户子系统）
 * 对应代码方法名：userRegister
 * EXT-IN: 用户提交注册请求（邮箱+密码，REQ-003 验收标准 1）
 * EXT-OUT: 返回 JWT token，有效期 24h
 * 约束：邮箱全局唯一，密码经 bcrypt 哈希存储（REQ-003 数据约束） *)
UserRegister(user) ==
    /\ user \in Users
    /\ user \notin activeUsers
    /\ activeUsers' = activeUsers \cup {user}
    /\ systemState' = systemState
    /\ articleCatalog' = articleCatalog
    /\ notificationQueue' = notificationQueue
    /\ fileStore' = fileStore
    /\ subscriptionRegistry' = subscriptionRegistry
    /\ backupSchedule' = backupSchedule

(* 动作2：博主发文（SD-012 多博文子系统）
 * 对应代码方法名：bloggerPublishArticle
 * EXT-IN: 博主提交文章（标题/内容/摘要/封面图，REQ-012 验收标准 1）
 * EXT-OUT: 文章进入 draft 状态，可定时发布（REQ-012 验收标准 3）
 * 约束：博主仅能发布自己文章，权限隔离（REQ-002 验收标准 5） *)
BloggerPublishArticle(blogger, article) ==
    /\ blogger \in activeUsers
    /\ article \in Articles
    /\ articleCatalog[article] = NonExistArticle
    /\ articleCatalog' = [articleCatalog EXCEPT ![article] = ArticleDraft]
    /\ systemState' = systemState
    /\ activeUsers' = activeUsers
    /\ notificationQueue' = notificationQueue
    /\ fileStore' = fileStore
    /\ subscriptionRegistry' = subscriptionRegistry
    /\ backupSchedule' = backupSchedule

(* 动作3：读者评论（SD-010 评论子系统 → SD-011 通知子系统）
 * 对应代码方法名：readerComment
 * EXT-IN: 读者提交评论（文章ID/内容，REQ-010 验收标准 1）
 * EXT-OUT: 触发通知入队（评论被回复→interaction 通知，REQ-011 验收标准 2）
 * 约束：评论支持多级回复（<=5 层），敏感词评论自动标记 pending（REQ-010 验收标准 2）
 *   通知队列长度受限于 Cardinality(Notifications)，对应离线消息合并语义 *)
ReaderComment(reader, comment) ==
    /\ reader \in activeUsers
    /\ comment \in Notifications
    /\ Len(notificationQueue) < Cardinality(Notifications)
    /\ notificationQueue' = Append(notificationQueue, comment)
    /\ systemState' = systemState
    /\ activeUsers' = activeUsers
    /\ articleCatalog' = articleCatalog
    /\ fileStore' = fileStore
    /\ subscriptionRegistry' = subscriptionRegistry
    /\ backupSchedule' = backupSchedule

(* 动作4：管理员审核（SD-001 站点管理 + SD-005 广告 + SD-008 标签 + SD-010 评论）
 * 对应代码方法名：adminModerate
 * EXT-IN: 管理员审核文章（pending_review → published，REQ-012 验收标准 2 状态机）
 * EXT-OUT: 审核结果通知（audit 类型通知，REQ-011 验收标准 2）
 * 约束：仅管理员/超级管理员可操作（REQ-003 验收标准 2 RBAC）
 *   文章状态机单向流转：draft → pending_review → published → offline → archived *)
AdminModerate(admin, target) ==
    /\ admin \in activeUsers
    /\ target \in Articles
    /\ articleCatalog[target] = ArticlePendingReview
    /\ articleCatalog' = [articleCatalog EXCEPT ![target] = ArticlePublished]
    /\ systemState' = systemState
    /\ activeUsers' = activeUsers
    /\ notificationQueue' = notificationQueue
    /\ fileStore' = fileStore
    /\ subscriptionRegistry' = subscriptionRegistry
    /\ backupSchedule' = backupSchedule

(* 动作5：搜索请求（SD-007 搜索子系统）
 * 对应代码方法名：searchQuery
 * EXT-IN: 用户输入搜索关键词（全文/标签/分类/博主搜索，REQ-007 验收标准 1-2）
 * EXT-OUT: 返回搜索结果（分页/排序，REQ-007 验收标准 3-4）
 * 约束：搜索响应 P95 <= 500ms（NFR-001）；搜索历史上限 100 条/用户
 *   此动作为只读查询，不修改持久状态（L1 抽象层级） *)
SearchQuery(user, query) ==
    /\ user \in activeUsers
    /\ query \in Tags \cup Categories \cup Articles
    /\ UNCHANGED vars

(* 动作6：推送通知（SD-014 消息推送子系统）
 * 对应代码方法名：pushNotification
 * EXT-IN: 系统事件触发推送（新评论/新关注/新文章/公告，REQ-014 验收标准 2）
 * EXT-OUT: WebSocket 推送到在线用户，延迟 <= 100ms（NFR-001）
 * 约束：推送通道 {comment, follow, article, announcement}（REQ-014 数据约束）
 *   最多 3 次重试，间隔 1s/2s/4s 指数退避（REQ-014 验收标准 5）
 *   通知队列长度受限于 Cardinality(Notifications)，对应离线消息合并语义 *)
PushNotification(user, notification) ==
    /\ user \in activeUsers
    /\ notification \in Notifications
    /\ Len(notificationQueue) < Cardinality(Notifications)
    /\ notificationQueue' = Append(notificationQueue, notification)
    /\ systemState' = systemState
    /\ activeUsers' = activeUsers
    /\ articleCatalog' = articleCatalog
    /\ fileStore' = fileStore
    /\ subscriptionRegistry' = subscriptionRegistry
    /\ backupSchedule' = backupSchedule

(* 动作7：文件上传（SD-015 文件上传子系统）
 * 对应代码方法名：fileUpload
 * EXT-IN: 用户上传文件（图片 JPG/PNG/WebP/GIF 或附件 PDF/MD/ZIP，REQ-015 验收标准 1-2）
 * EXT-OUT: 返回文件元数据（id/originalName/mimeType/size/sha256，REQ-015 验收标准 4）
 * 约束：单文件 <=10MB（REQ-015 数据约束）；魔数校验 + 文件名消毒（REQ-015 验收标准 5）
 *   流式处理不引入 multer（CON-001）；SHA-256 摘要去重（REQ-015 验收标准 7） *)
FileUpload(user, file) ==
    /\ user \in activeUsers
    /\ file \in Files
    /\ fileStore[file] = FileNotExist
    /\ fileStore' = [fileStore EXCEPT ![file] = FileUploaded]
    /\ systemState' = systemState
    /\ activeUsers' = activeUsers
    /\ articleCatalog' = articleCatalog
    /\ notificationQueue' = notificationQueue
    /\ subscriptionRegistry' = subscriptionRegistry
    /\ backupSchedule' = backupSchedule

(* 动作8：订阅（SD-016 订阅子系统）
 * 对应代码方法名：subscribe
 * EXT-IN: 用户订阅目标（博主/标签/分类，REQ-016 验收标准 1）
 * EXT-OUT: 订阅关系建立，触发聚合推送（每小时聚合一次，REQ-016 验收标准 7）
 * 约束：订阅权限分级 free/paid/invitation（REQ-016 验收标准 4）
 *   取消订阅幂等（REQ-016 验收标准 6）；订阅关系双向查询（REQ-016 验收标准 5） *)
Subscribe(user, target) ==
    /\ user \in activeUsers
    /\ target \in Subscriptions
    /\ subscriptionRegistry' = [subscriptionRegistry EXCEPT ![user] = subscriptionRegistry[user] \cup {target}]
    /\ systemState' = systemState
    /\ activeUsers' = activeUsers
    /\ articleCatalog' = articleCatalog
    /\ notificationQueue' = notificationQueue
    /\ fileStore' = fileStore
    /\ backupSchedule' = backupSchedule

(* 动作9：数据导出（SD-017 数据导出与备份子系统）
 * 对应代码方法名：exportData
 * EXT-IN: 用户/管理员请求导出（个人/博主/全量备份，REQ-017 验收标准 1-3）
 * EXT-OUT: 异步任务创建，返回 taskId（REQ-017 验收标准 6）
 * 约束：导出格式 CSV/JSON（REQ-017 数据约束）；备份文件 <=10MB（CON-003）
 *   备份恢复前校验完整性（SHA-256，REQ-017 验收标准 4）
 *   GDPR 占位：用户数据删除请求，30 天后物理清除（REQ-017 验收标准 7） *)
ExportData(user, scope) ==
    /\ user \in activeUsers
    /\ scope \in Backups
    /\ scope \notin backupSchedule
    /\ backupSchedule' = backupSchedule \cup {scope}
    /\ systemState' = systemState
    /\ activeUsers' = activeUsers
    /\ articleCatalog' = articleCatalog
    /\ notificationQueue' = notificationQueue
    /\ fileStore' = fileStore
    /\ subscriptionRegistry' = subscriptionRegistry

(* Next：联合所有外部交互动作 *)
Next ==
    \/ \E user \in Users : UserRegister(user)
    \/ \E blogger \in activeUsers, article \in Articles : BloggerPublishArticle(blogger, article)
    \/ \E reader \in activeUsers, comment \in Notifications : ReaderComment(reader, comment)
    \/ \E admin \in activeUsers, target \in Articles : AdminModerate(admin, target)
    \/ \E user \in activeUsers, query \in Tags \cup Categories \cup Articles : SearchQuery(user, query)
    \/ \E user \in activeUsers, notification \in Notifications : PushNotification(user, notification)
    \/ \E user \in activeUsers, file \in Files : FileUpload(user, file)
    \/ \E user \in activeUsers, target \in Subscriptions : Subscribe(user, target)
    \/ \E user \in activeUsers, scope \in Backups : ExportData(user, scope)

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<vars>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数分析（按 .cfg 常量赋值数计算，tla-plus-guide.md §1.1）：
 *   9 个常量：Users / Articles / Categories / Tags / Ads / Notifications / Files / Subscriptions / Backups
 *   .cfg 中每个常量赋 2 个值 → 变量组合数 = 2^9 = 512
 *   512 < 1000 → kept-below-threshold（保留不拆）
 * L1 保持系统级视角，仅建模外部交互入口，不展开子系统内部状态。
 * decompositionDecision: "kept-below-threshold"
 * 拆解决策: variableCombination=512 < 1000，保留不拆（kept-below-threshold）
 *)
================
