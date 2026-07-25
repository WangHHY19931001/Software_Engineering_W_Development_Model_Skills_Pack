(*
  @system        blog-system-demo
  @requirement   SD-014, SD-016
  @design        docs/system-design.md
  @parent        ../tla/L1_blog_system.tla
  @sibling       ../tla/L2_content_management.tla, ../tla/L2_identity_access.tla, ../tla/L2_discovery.tla, ../tla/L2_interaction.tla, ../tla/L2_operations_support.tla, ../tla/L2_infrastructure.tla
  @child         ../tla/L3_notification_push.tla, ../tla/L3_subscription_aggregation.tla
  @level         L2
  @phase         2
  所属系统: blog-system-demo
  关联需求: SD-014 消息推送 + SD-016 订阅（订阅与推送域）
  关联设计: docs/system-design.md §3.1 SD-014/016 + §5.4 推送与订阅域
  上级 TLA: L1_blog_system.tla
  同级 TLA: 其他 6 个 L2 规格
  下级 TLA: L3_notification_push.tla（SD-014 推送重试原子行为）, L3_subscription_aggregation.tla（SD-016 订阅聚合并发行为）
  层级: L2 (子系统内部行为)
  requirementIds: [SD-014, SD-016]
*)
---- MODULE L2_subscription_push ----
EXTENDS Naturals, Sequences, FiniteSets

(* ==================== 常量 ==================== *)
CONSTANTS
    Subscriptions,       (* 订阅目标全集：博主/标签/分类 *)
    Users,               (* 用户全集 *)
    PushChannels         (* 推送通道全集：comment/follow/article/announcement *)

(* ==================== 状态空间定义 ==================== *)
(* WebSocket 连接状态 (REQ-014) *)
WsOnline == "online"
WsOffline == "offline"
WsStates == {WsOnline, WsOffline}

(* 订阅权限分级 (REQ-016 验收标准 4) *)
PermissionFree == "free"
PermissionPaid == "paid"
PermissionInvitation == "invitation"
PermissionTypes == {PermissionFree, PermissionPaid, PermissionInvitation}

(* 推送重试上限 (REQ-014 验收标准 5: 3 次重试) *)
PushRetryLimit == 3

(* 离线消息保留时长 (REQ-014 验收标准 6: 24h) *)
OfflineMessageTTL == 24

(* 订阅聚合窗口 (REQ-016 验收标准 7: 每小时聚合) *)
AggregateWindowHours == 1

(* 离线消息队列长度上限 *)
OfflineMessageQueueLimit == 1000

NonePermission == "noneperm"
NoneChannel == "nonechannel"

(* ==================== 变量 ==================== *)
VARIABLES
    subscriptionRegistry,         (* 订阅关系：user -> SUBSET Subscriptions *)
    subscriptionPermission,       (* 订阅权限：user -> Subscriptions -> PermissionTypes *)
    pushChannelSubscriptions,     (* 推送通道订阅：user -> SUBSET PushChannels *)
    wsConnections,                (* WebSocket 连接状态：user -> WsStates *)
    offlineMessages,              (* 离线消息：user -> Seq(PushChannels)（合并后） *)
    pushRetryCount                (* 推送重试计数：user -> Nat *)

vars == <<subscriptionRegistry, subscriptionPermission, pushChannelSubscriptions, wsConnections, offlineMessages, pushRetryCount>>

(* ==================== TypeInvariant ==================== *)
TypeInvariant ==
    /\ subscriptionRegistry \in [Users -> SUBSET Subscriptions]
    /\ subscriptionPermission \in [Users -> [Subscriptions -> PermissionTypes \cup {NonePermission}]]
    /\ pushChannelSubscriptions \in [Users -> SUBSET PushChannels]
    /\ wsConnections \in [Users -> WsStates]
    /\ offlineMessages \in [Users -> Seq(PushChannels)]
    /\ pushRetryCount \in [Users -> Nat]

(* ==================== 业务不变式 ==================== *)

(* @designRef docs/system-design.md#§3.1 SD-016 订阅关系合法
 * 业务语义：每个用户的订阅集合是 Subscriptions 的子集（REQ-016 验收标准 1）。
 *   订阅类型：blogger（博主订阅）、tag（标签订阅）、category（分类订阅），均为 Subscriptions 元素。
 *   订阅关系为有向边 subscriber → target，支持双向查询（REQ-016 验收标准 5）。 *)
SubscriptionSetInvariant ==
    \A u \in Users :
        subscriptionRegistry[u] \subseteq Subscriptions

(* @designRef docs/system-design.md#§3.1 SD-016 订阅权限分级
 * 业务语义：订阅权限必须在 PermissionTypes 中（free/paid/invitation，REQ-016 验收标准 4）。
 *   invitation 必填邀请码 8-32 字符；free 默认；paid 占位。
 *   已订阅目标必有合法权限；未订阅目标权限为 NonePermission。 *)
SubscriptionPermissionInvariant ==
    /\ \A u \in Users, s \in Subscriptions :
        s \in subscriptionRegistry[u] =>
            subscriptionPermission[u][s] \in PermissionTypes
    /\ \A u \in Users, s \in Subscriptions :
        s \notin subscriptionRegistry[u] =>
            subscriptionPermission[u][s] = NonePermission

(* @designRef docs/system-design.md#§3.1 SD-014 推送通道合法
 * 业务语义：推送通道订阅集合是 PushChannels 的子集（comment/follow/article/announcement，REQ-014 数据约束）。
 *   默认全开（pushChannelSubscriptions[u] = PushChannels）。
 *   用户可关闭某类通道，关闭后该类推送不送达。 *)
PushChannelInvariant ==
    \A u \in Users :
        pushChannelSubscriptions[u] \subseteq PushChannels

(* @designRef docs/system-design.md#§3.1 SD-014 WebSocket 连接状态一致
 * 业务语义：WebSocket 连接状态在 WsStates 中（online/offline，REQ-014 验收标准 1）。
 *   在线用户通过 WebSocket 直推；离线用户消息进入 offlineMessages 合并队列。
 *   连接状态由 connectionId → userId 映射维护（§5.4 WsConnection）。 *)
WsConnectionInvariant ==
    \A u \in Users :
        wsConnections[u] \in WsStates

(* @designRef docs/system-design.md#§3.1 SD-014 推送重试上限
 * 业务语义：推送重试次数 <= PushRetryLimit（3 次，REQ-014 验收标准 5）。
 *   重试间隔 1s/2s/4s 指数退避；超过 3 次放弃并写入离线合并队列。
 *   防止推送洪水与无限重试导致资源耗尽。 *)
PushRetryLimitInvariant ==
    \A u \in Users :
        pushRetryCount[u] <= PushRetryLimit

(* @designRef docs/system-design.md#§3.1 SD-014 离线消息队列限制
 * 业务语义：离线消息队列有限——每个用户队列长度 <= OfflineMessageQueueLimit（防内存溢出）。
 *   同类消息合并为 1 条保留 24h（REQ-014 验收标准 6）。
 *   队列元素均为合法 PushChannels。 *)
OfflineMessageQueueInvariant ==
    /\ \A u \in Users :
        Len(offlineMessages[u]) <= OfflineMessageQueueLimit
    /\ \A u \in Users :
        \A i \in 1..Len(offlineMessages[u]) :
            offlineMessages[u][i] \in PushChannels

(* ==================== BusinessInvariant 聚合 ==================== *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ SubscriptionSetInvariant
    /\ SubscriptionPermissionInvariant
    /\ PushChannelInvariant
    /\ WsConnectionInvariant
    /\ PushRetryLimitInvariant
    /\ OfflineMessageQueueInvariant

(* ==================== 初始状态 ==================== *)
Init ==
    /\ subscriptionRegistry = [u \in Users |-> {}]
    /\ subscriptionPermission = [u \in Users |-> [s \in Subscriptions |-> NonePermission]]
    /\ pushChannelSubscriptions = [u \in Users |-> PushChannels]
    /\ wsConnections = [u \in Users |-> WsOffline]
    /\ offlineMessages = [u \in Users |-> <<>>]
    /\ pushRetryCount = [u \in Users |-> 0]

(* ==================== 状态转移（Next） ==================== *)

(* SD-016 动作1：订阅目标（建立订阅关系，权限分级） *)
Subscribe(user, target, permission) ==
    /\ user \in Users
    /\ target \in Subscriptions
    /\ permission \in PermissionTypes
    /\ target \notin subscriptionRegistry[user]
    /\ subscriptionRegistry' = [subscriptionRegistry EXCEPT ![user] = subscriptionRegistry[user] \cup {target}]
    /\ subscriptionPermission' = [subscriptionPermission EXCEPT ![user] =
        [subscriptionPermission[user] EXCEPT ![target] = permission]]
    /\ UNCHANGED <<pushChannelSubscriptions, wsConnections, offlineMessages, pushRetryCount>>

(* SD-016 动作2：取消订阅（幂等，重复取消返回当前状态不报错） *)
Unsubscribe(user, target) ==
    /\ user \in Users
    /\ target \in Subscriptions
    /\ target \in subscriptionRegistry[user]
    /\ subscriptionRegistry' = [subscriptionRegistry EXCEPT ![user] = subscriptionRegistry[user] \ {target}]
    /\ subscriptionPermission' = [subscriptionPermission EXCEPT ![user] =
        [subscriptionPermission[user] EXCEPT ![target] = NonePermission]]
    /\ UNCHANGED <<pushChannelSubscriptions, wsConnections, offlineMessages, pushRetryCount>>

(* SD-014 动作3：WebSocket 上线（连接建立） *)
WsConnect(user) ==
    /\ user \in Users
    /\ wsConnections[user] = WsOffline
    /\ wsConnections' = [wsConnections EXCEPT ![user] = WsOnline]
    /\ pushRetryCount' = [pushRetryCount EXCEPT ![user] = 0]
    /\ UNCHANGED <<subscriptionRegistry, subscriptionPermission, pushChannelSubscriptions, offlineMessages>>

(* SD-014 动作4：WebSocket 下线（连接断开） *)
WsDisconnect(user) ==
    /\ user \in Users
    /\ wsConnections[user] = WsOnline
    /\ wsConnections' = [wsConnections EXCEPT ![user] = WsOffline]
    /\ UNCHANGED <<subscriptionRegistry, subscriptionPermission, pushChannelSubscriptions, offlineMessages, pushRetryCount>>

(* SD-014 动作5：推送通知（在线直推，离线入队） *)
PushNotification(user, channel) ==
    /\ user \in Users
    /\ channel \in PushChannels
    /\ channel \in pushChannelSubscriptions[user]
    /\ IF wsConnections[user] = WsOnline
       THEN /\ pushRetryCount' = [pushRetryCount EXCEPT ![user] = 0]
            /\ UNCHANGED <<subscriptionRegistry, subscriptionPermission, pushChannelSubscriptions, wsConnections, offlineMessages>>
       ELSE /\ Len(offlineMessages[user]) < OfflineMessageQueueLimit
            /\ offlineMessages' = [offlineMessages EXCEPT ![user] = Append(offlineMessages[user], channel)]
            /\ UNCHANGED <<subscriptionRegistry, subscriptionPermission, pushChannelSubscriptions, wsConnections, pushRetryCount>>

(* SD-014 动作6：推送失败重试（重试计数 +1，超过上限放弃） *)
RetryPush(user) ==
    /\ user \in Users
    /\ wsConnections[user] = WsOnline
    /\ pushRetryCount[user] < PushRetryLimit
    /\ pushRetryCount' = [pushRetryCount EXCEPT ![user] = pushRetryCount[user] + 1]
    /\ UNCHANGED <<subscriptionRegistry, subscriptionPermission, pushChannelSubscriptions, wsConnections, offlineMessages>>

(* SD-014 动作7：合并离线消息（同类合并为 1 条，保留 24h）
 *   简化建模：合并后清空队列（合并产物视为已生成的单条消息投递或保留 24h 后过期） *)
MergeOfflineMessages(user) ==
    /\ user \in Users
    /\ Len(offlineMessages[user]) > 0
    /\ offlineMessages' = [offlineMessages EXCEPT ![user] = <<>>]
    /\ UNCHANGED <<subscriptionRegistry, subscriptionPermission, pushChannelSubscriptions, wsConnections, pushRetryCount>>

(* SD-016 动作8：清空离线消息（用户上线后投递并清空） *)
ClearOfflineMessages(user) ==
    /\ user \in Users
    /\ wsConnections[user] = WsOnline
    /\ Len(offlineMessages[user]) > 0
    /\ offlineMessages' = [offlineMessages EXCEPT ![user] = <<>>]
    /\ UNCHANGED <<subscriptionRegistry, subscriptionPermission, pushChannelSubscriptions, wsConnections, pushRetryCount>>

(* Next：联合订阅与推送域所有动作 *)
Next ==
    \/ \E u \in Users, t \in Subscriptions, p \in PermissionTypes : Subscribe(u, t, p)
    \/ \E u \in Users, t \in Subscriptions : Unsubscribe(u, t)
    \/ \E u \in Users : WsConnect(u)
    \/ \E u \in Users : WsDisconnect(u)
    \/ \E u \in Users, c \in PushChannels : PushNotification(u, c)
    \/ \E u \in Users : RetryPush(u)
    \/ \E u \in Users : MergeOfflineMessages(u)
    \/ \E u \in Users : ClearOfflineMessages(u)

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<vars>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数分析（按 .cfg 常量赋值数计算，tla-plus-guide.md §1.1）：
 *   3 个常量：Subscriptions / Users / PushChannels
 *   .cfg 中每个常量赋 2 个值 → 变量组合数 = 2^3 = 8
 *   8 < 1000 → kept-below-threshold（保留不拆）
 * decompositionDecision: "kept-below-threshold"
 *)
================
