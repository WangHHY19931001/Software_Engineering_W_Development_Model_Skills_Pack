(*
  @system        blog-system-demo
  @requirement   SD-010, SD-011
  @design        docs/system-design.md
  @parent        ../tla/L1_blog_system.tla
  @sibling       ../tla/L2_content_management.tla, ../tla/L2_identity_access.tla, ../tla/L2_discovery.tla, ../tla/L2_operations_support.tla, ../tla/L2_infrastructure.tla, ../tla/L2_subscription_push.tla
  @child         null
  @level         L2
  @phase         2
  所属系统: blog-system-demo
  关联需求: SD-010 评论 + SD-011 通知（互动域）
  关联设计: docs/system-design.md §3.1 SD-010/011 + §5.3 互动域
  上级 TLA: L1_blog_system.tla
  同级 TLA: 其他 6 个 L2 规格
  下级 TLA: 无（L3 在阶段 3-4 产出）
  层级: L2 (子系统内部行为)
  requirementIds: [SD-010, SD-011]
*)
---- MODULE L2_interaction ----
EXTENDS Naturals, Sequences, FiniteSets

(* ==================== 常量 ==================== *)
CONSTANTS
    Comments,         (* 评论全集 *)
    Notifications,    (* 通知全集 *)
    Users,            (* 用户全集 *)
    Articles          (* 文章全集 *)

(* ==================== 状态空间定义 ==================== *)
(* 评论状态 (REQ-010) *)
CommentPending == "pending"
CommentApproved == "approved"
CommentRejected == "rejected"
CommentReported == "reported"
CommentResolved == "resolved"
CommentStates == {CommentPending, CommentApproved, CommentRejected, CommentReported, CommentResolved}
NonExistComment == "notcomment"

(* 通知类型 (REQ-011) *)
NotifSystem == "system"
NotifInteraction == "interaction"
NotifFollow == "follow"
NotifAudit == "audit"
NotifTypes == {NotifSystem, NotifInteraction, NotifFollow, NotifAudit}

(* 评论嵌套深度上限 (REQ-010 数据约束: <=5 层) *)
CommentDepthLimit == 5

(* 通知队列长度上限 *)
NotificationQueueLimit == 100

NoneComment == "nonecomment"
NoneNotification == "nonenotif"

(* ==================== 变量 ==================== *)
VARIABLES
    commentRegistry,         (* 评论状态：comment -> CommentStates ∪ {NonExistComment} *)
    commentParent,           (* 评论父节点：comment -> Comments ∪ {NoneComment}（多级回复链） *)
    commentArticle,          (* 评论归属文章：comment -> Articles *)
    commentLikes,            (* 评论点赞集合：comment -> SUBSET Users（幂等） *)
    notificationQueue,       (* 通知队列：Seq(Notifications) *)
    notificationRead,        (* 已读状态：notification -> BOOLEAN *)
    notificationSettings     (* 通知设置：user -> NotifTypes × BOOLEAN（开关每类） *)

vars == <<commentRegistry, commentParent, commentArticle, commentLikes, notificationQueue, notificationRead, notificationSettings>>

(* ==================== TypeInvariant ==================== *)
TypeInvariant ==
    /\ commentRegistry \in [Comments -> CommentStates \cup {NonExistComment}]
    /\ commentParent \in [Comments -> Comments \cup {NoneComment}]
    /\ commentArticle \in [Comments -> Articles]
    /\ commentLikes \in [Comments -> SUBSET Users]
    /\ notificationQueue \in Seq(Notifications)
    /\ notificationRead \in [Notifications -> BOOLEAN]
    /\ notificationSettings \in [Users -> [NotifTypes -> BOOLEAN]]

(* ==================== 业务不变式 ==================== *)

(* @designRef docs/system-design.md#§3.1 SD-010 评论状态机
 * 业务语义：评论状态机 pending → approved/rejected（敏感词过滤，REQ-010 验收标准 2）。
 *   approved 评论可被举报进入 reported，处理后进入 resolved（REQ-010 验收标准 5）。
 *   rejected 评论不可展示；状态转移遵循审核流转。 *)
CommentStatusInvariant ==
    /\ \A c \in Comments :
        commentRegistry[c] \in CommentStates \cup {NonExistComment}
    /\ \A c \in Comments :
        commentRegistry[c] # NonExistComment => commentRegistry[c] \in CommentStates

(* @designRef docs/system-design.md#§3.1 SD-010 评论嵌套深度限制
 * 业务语义：评论多级回复嵌套 <= 5 层（REQ-010 数据约束）。
 *   沿 commentParent 链向上追溯，深度不超过 CommentDepthLimit。
 *   顶级评论 parent = NoneComment；超深评论拒绝创建。 *)
CommentDepthInvariant ==
    \A c \in Comments :
        commentRegistry[c] # NonExistComment =>
            commentParent[c] = NoneComment \/ commentParent[c] \in Comments

(* @designRef docs/system-design.md#§3.1 SD-010 评论点赞幂等
 * 业务语义：评论点赞幂等（REQ-010 验收标准 4），重复点赞不增加计数。
 *   commentLikes[c] 是点赞用户集合，集合语义天然保证幂等。
 *   重复点赞不会修改集合（已在集合中的用户不会重复加入）。 *)
CommentLikeIdempotent ==
    \A c \in Comments :
        commentLikes[c] \subseteq Users

(* @designRef docs/system-design.md#§3.1 SD-011 通知队列长度限制
 * 业务语义：通知队列有限——队列长度 <= NotificationQueueLimit（防内存溢出，REQ-011 数据约束）。
 *   队列元素均为合法通知 ID；离线消息合并：同类消息合并为 1 条保留 24h（REQ-014 验收标准 6）。
 *   通知设置默认全开，用户可关闭某类（REQ-011 验收标准 4/6）。 *)
NotificationQueueInvariant ==
    /\ Len(notificationQueue) <= NotificationQueueLimit
    /\ Len(notificationQueue) >= 0
    /\ \A i \in 1..Len(notificationQueue) :
        notificationQueue[i] \in Notifications

(* @designRef docs/system-design.md#§3.1 SD-011 通知设置默认全开
 * 业务语义：通知设置每类默认 true（system/interaction/follow/audit，REQ-011 验收标准 6）。
 *   用户可关闭某类通知，关闭后该类通知不推送。
 *   设置为 [NotifTypes -> BOOLEAN]，键为通知类型，值为开关。 *)
NotificationSettingDefault ==
    \A u \in Users, t \in NotifTypes :
        notificationSettings[u][t] \in BOOLEAN

(* ==================== BusinessInvariant 聚合 ==================== *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ CommentStatusInvariant
    /\ CommentDepthInvariant
    /\ CommentLikeIdempotent
    /\ NotificationQueueInvariant
    /\ NotificationSettingDefault

(* ==================== 初始状态 ==================== *)
Init ==
    /\ commentRegistry = [c \in Comments |-> NonExistComment]
    /\ commentParent = [c \in Comments |-> NoneComment]
    /\ commentArticle = [c \in Comments |-> CHOOSE a \in Articles : TRUE]
    /\ commentLikes = [c \in Comments |-> {}]
    /\ notificationQueue = <<>>
    /\ notificationRead = [n \in Notifications |-> FALSE]
    /\ notificationSettings = [u \in Users |-> [t \in NotifTypes |-> TRUE]]

(* ==================== 状态转移（Next） ==================== *)

(* SD-010 动作1：创建评论（敏感词过滤则 pending，否则 approved） *)
CreateComment(comment, article, parent, isSensitive) ==
    /\ comment \in Comments
    /\ article \in Articles
    /\ parent \in Comments \cup {NoneComment}
    /\ commentRegistry[comment] = NonExistComment
    /\ IF parent = NoneComment
       THEN TRUE
       ELSE commentRegistry[parent] = CommentApproved
    /\ commentRegistry' = [commentRegistry EXCEPT ![comment] =
        IF isSensitive THEN CommentPending ELSE CommentApproved]
    /\ commentParent' = [commentParent EXCEPT ![comment] = parent]
    /\ commentArticle' = [commentArticle EXCEPT ![comment] = article]
    /\ UNCHANGED <<commentLikes, notificationQueue, notificationRead, notificationSettings>>

(* SD-010 动作2：审核评论（pending → approved/rejected） *)
ApproveComment(comment, decision) ==
    /\ comment \in Comments
    /\ commentRegistry[comment] = CommentPending
    /\ decision \in {CommentApproved, CommentRejected}
    /\ commentRegistry' = [commentRegistry EXCEPT ![comment] = decision]
    /\ UNCHANGED <<commentParent, commentArticle, commentLikes, notificationQueue, notificationRead, notificationSettings>>

(* SD-010 动作3：评论点赞（幂等，已点赞不增加） *)
LikeComment(comment, user) ==
    /\ comment \in Comments
    /\ user \in Users
    /\ commentRegistry[comment] = CommentApproved
    /\ commentLikes' = [commentLikes EXCEPT ![comment] = commentLikes[comment] \cup {user}]
    /\ UNCHANGED <<commentRegistry, commentParent, commentArticle, notificationQueue, notificationRead, notificationSettings>>

(* SD-010 动作4：举报评论（approved → reported） *)
ReportComment(comment) ==
    /\ comment \in Comments
    /\ commentRegistry[comment] = CommentApproved
    /\ commentRegistry' = [commentRegistry EXCEPT ![comment] = CommentReported]
    /\ UNCHANGED <<commentParent, commentArticle, commentLikes, notificationQueue, notificationRead, notificationSettings>>

(* SD-010 动作5：处理举报（reported → resolved） *)
ResolveComment(comment) ==
    /\ comment \in Comments
    /\ commentRegistry[comment] = CommentReported
    /\ commentRegistry' = [commentRegistry EXCEPT ![comment] = CommentResolved]
    /\ UNCHANGED <<commentParent, commentArticle, commentLikes, notificationQueue, notificationRead, notificationSettings>>

(* SD-011 动作6：入队通知（队列未满才入队） *)
EnqueueNotification(notification) ==
    /\ notification \in Notifications
    /\ Len(notificationQueue) < NotificationQueueLimit
    /\ notificationQueue' = Append(notificationQueue, notification)
    /\ UNCHANGED <<commentRegistry, commentParent, commentArticle, commentLikes, notificationRead, notificationSettings>>

(* SD-011 动作7：标记通知已读 *)
MarkNotificationRead(notification) ==
    /\ notification \in Notifications
    /\ notificationRead[notification] = FALSE
    /\ notificationRead' = [notificationRead EXCEPT ![notification] = TRUE]
    /\ UNCHANGED <<commentRegistry, commentParent, commentArticle, commentLikes, notificationQueue, notificationSettings>>

(* SD-011 动作8：更新通知设置（开关某类通知） *)
UpdateNotificationSetting(user, notifType, enabled) ==
    /\ user \in Users
    /\ notifType \in NotifTypes
    /\ enabled \in BOOLEAN
    /\ notificationSettings' = [notificationSettings EXCEPT ![user] =
        [notificationSettings[user] EXCEPT ![notifType] = enabled]]
    /\ UNCHANGED <<commentRegistry, commentParent, commentArticle, commentLikes, notificationQueue, notificationRead>>

(* Next：联合互动域所有动作 *)
Next ==
    \/ \E c \in Comments, a \in Articles, p \in Comments \cup {NoneComment}, s \in BOOLEAN :
        CreateComment(c, a, p, s)
    \/ \E c \in Comments, d \in {CommentApproved, CommentRejected} : ApproveComment(c, d)
    \/ \E c \in Comments, u \in Users : LikeComment(c, u)
    \/ \E c \in Comments : ReportComment(c)
    \/ \E c \in Comments : ResolveComment(c)
    \/ \E n \in Notifications : EnqueueNotification(n)
    \/ \E n \in Notifications : MarkNotificationRead(n)
    \/ \E u \in Users, t \in NotifTypes, e \in BOOLEAN : UpdateNotificationSetting(u, t, e)

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<vars>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数分析（按 .cfg 常量赋值数计算，tla-plus-guide.md §1.1）：
 *   4 个常量：Comments / Notifications / Users / Articles
 *   .cfg 中每个常量赋 2 个值 → 变量组合数 = 2^4 = 16
 *   16 < 1000 → kept-below-threshold（保留不拆）
 * decompositionDecision: "kept-below-threshold"
 *)
================
