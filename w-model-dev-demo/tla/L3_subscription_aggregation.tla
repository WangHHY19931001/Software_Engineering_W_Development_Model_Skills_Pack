(*
  @system        blog-system-demo
  @requirement   SD-016
  @design        docs/system-design.md
  @parent        ../tla/L2_subscription_push.tla
  @sibling       ../tla/L3_notification_push.tla
  @child         null
  @level         L3
  @phase         3
  所属系统: blog-system-demo
  关联需求: SD-016 订阅（订阅聚合与权限分级原子行为）
  关联设计: docs/system-design.md §3.1 SD-016 + §5.4 推送与订阅域 + docs/interface-design.md INTF-016
  上级 TLA: L2_subscription_push.tla
  同级 TLA: L3_notification_push.tla（同为 L2_subscription_push 的 L3 子规格）
  下级 TLA: 无（L3 为叶子规格）
  层级: L3 (原子化子系统行为)
  requirementIds: [SD-016]
*)
---- MODULE L3_subscription_aggregation ----
EXTENDS Naturals, Sequences, FiniteSets

(* ==================== 常量 ==================== *)
CONSTANTS
    Subscriptions,      (* 订阅目标全集：博主/标签/分类 *)
    Users               (* 用户全集 *)

(* ==================== 状态空间定义 ==================== *)
(* 订阅权限分级 (REQ-016 验收标准 4) *)
PermissionFree == "free"
PermissionPaid == "paid"
PermissionInvitation == "invitation"
PermissionTypes == {PermissionFree, PermissionPaid, PermissionInvitation}

(* 订阅聚合窗口 (REQ-016 验收标准 7: 每小时聚合) *)
AggregateWindowHours == 1

(* 聚合消息队列长度上限 *)
AggregateQueueLimit == 100

NonePermission == "noneperm"
NoneSubscription == "nonesub"

(* ==================== 变量 ==================== *)
VARIABLES
    subscriptionRegistry,        (* 订阅关系：user -> SUBSET Subscriptions *)
    subscriptionPermission,      (* 订阅权限：user -> Subscriptions -> PermissionTypes *)
    aggregateQueue               (* 聚合消息队列：user -> Seq(Subscriptions)（待聚合事件） *)

vars == <<subscriptionRegistry, subscriptionPermission, aggregateQueue>>

(* ==================== TypeInvariant ==================== *)
TypeInvariant ==
    /\ subscriptionRegistry \in [Users -> SUBSET Subscriptions]
    /\ subscriptionPermission \in [Users -> [Subscriptions -> PermissionTypes \cup {NonePermission}]]
    /\ aggregateQueue \in [Users -> Seq(Subscriptions)]

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

(* @designRef docs/system-design.md#§3.1 SD-016 聚合队列限制
 * 业务语义：聚合队列有限——每个用户队列长度 <= AggregateQueueLimit（防内存溢出）。
 *   每小时聚合一次（REQ-016 验收标准 7），队列元素均为合法 Subscriptions。 *)
AggregateQueueInvariant ==
    /\ \A u \in Users :
        Len(aggregateQueue[u]) <= AggregateQueueLimit
    /\ \A u \in Users :
        \A i \in 1..Len(aggregateQueue[u]) :
            aggregateQueue[u][i] \in Subscriptions

(* @designRef docs/system-design.md#§3.1 SD-016 聚合消息来源合法
 * 业务语义：聚合队列中的事件源必须是用户已订阅的目标（防越权推送）。
 *   未订阅目标的事件不进入聚合队列，保证权限隔离。 *)
AggregateSourceInvariant ==
    \A u \in Users :
        \A i \in 1..Len(aggregateQueue[u]) :
            aggregateQueue[u][i] \in subscriptionRegistry[u]

(* ==================== BusinessInvariant 聚合 ==================== *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ SubscriptionSetInvariant
    /\ SubscriptionPermissionInvariant
    /\ AggregateQueueInvariant
    /\ AggregateSourceInvariant

(* ==================== 初始状态 ==================== *)
Init ==
    /\ subscriptionRegistry = [u \in Users |-> {}]
    /\ subscriptionPermission = [u \in Users |-> [s \in Subscriptions |-> NonePermission]]
    /\ aggregateQueue = [u \in Users |-> <<>>]

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
    /\ UNCHANGED <<aggregateQueue>>

(* SD-016 动作2：取消订阅（幂等，重复取消返回当前状态不报错） *)
Unsubscribe(user, target) ==
    /\ user \in Users
    /\ target \in Subscriptions
    /\ target \in subscriptionRegistry[user]
    /\ subscriptionRegistry' = [subscriptionRegistry EXCEPT ![user] = subscriptionRegistry[user] \ {target}]
    /\ subscriptionPermission' = [subscriptionPermission EXCEPT ![user] =
        [subscriptionPermission[user] EXCEPT ![target] = NonePermission]]
    /\ UNCHANGED <<aggregateQueue>>

(* SD-016 动作3：升级订阅权限（free → paid/invitation） *)
UpgradePermission(user, target, newPermission) ==
    /\ user \in Users
    /\ target \in Subscriptions
    /\ newPermission \in PermissionTypes
    /\ target \in subscriptionRegistry[user]
    /\ subscriptionPermission' = [subscriptionPermission EXCEPT ![user] =
        [subscriptionPermission[user] EXCEPT ![target] = newPermission]]
    /\ UNCHANGED <<subscriptionRegistry, aggregateQueue>>

(* SD-016 动作4：入队订阅事件（新文章/评论触发，仅已订阅目标入队） *)
EnqueueSubscriptionEvent(user, target) ==
    /\ user \in Users
    /\ target \in Subscriptions
    /\ target \in subscriptionRegistry[user]
    /\ Len(aggregateQueue[user]) < AggregateQueueLimit
    /\ aggregateQueue' = [aggregateQueue EXCEPT ![user] = Append(aggregateQueue[user], target)]
    /\ UNCHANGED <<subscriptionRegistry, subscriptionPermission>>

(* SD-016 动作5：聚合队列消息（每小时聚合一次，合并同类事件） *)
AggregateQueue(user) ==
    /\ user \in Users
    /\ Len(aggregateQueue[user]) > 0
    /\ aggregateQueue' = [aggregateQueue EXCEPT ![user] = <<>>]
    /\ UNCHANGED <<subscriptionRegistry, subscriptionPermission>>

(* Next：联合订阅聚合所有原子动作 *)
Next ==
    \/ \E u \in Users, t \in Subscriptions, p \in PermissionTypes : Subscribe(u, t, p)
    \/ \E u \in Users, t \in Subscriptions : Unsubscribe(u, t)
    \/ \E u \in Users, t \in Subscriptions, p \in PermissionTypes : UpgradePermission(u, t, p)
    \/ \E u \in Users, t \in Subscriptions : EnqueueSubscriptionEvent(u, t)
    \/ \E u \in Users : AggregateQueue(u)

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<vars>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数分析（按 .cfg 常量赋值数计算，tla-plus-guide.md §1.1）：
 *   2 个常量：Subscriptions / Users
 *   .cfg 中每个常量赋 2 个值 → 变量组合数 = 2^2 = 4
 *   4 < 1000 → kept-below-threshold（保留不拆）
 * decompositionDecision: "kept-below-threshold"
 *)
================
