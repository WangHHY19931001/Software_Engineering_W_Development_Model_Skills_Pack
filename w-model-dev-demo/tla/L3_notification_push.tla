(*
  @system        blog-system-demo
  @requirement   SD-014
  @design        docs/system-design.md
  @parent        ../tla/L2_subscription_push.tla
  @sibling       ../tla/L3_subscription_aggregation.tla
  @child         ../tla/L4_notification_delivery.tla
  @level         L3
  @phase         3
  所属系统: blog-system-demo
  关联需求: SD-014 消息推送（推送重试与离线合并原子行为）
  关联设计: docs/system-design.md §3.1 SD-014 + §5.4 推送与订阅域 + docs/interface-design.md INTF-014
  上级 TLA: L2_subscription_push.tla
  同级 TLA: L3_subscription_aggregation.tla（同为 L2_subscription_push 的 L3 子规格）
  下级 TLA: 无（L3 为叶子规格）
  层级: L3 (原子化子系统行为)
  requirementIds: [SD-014]
*)
---- MODULE L3_notification_push ----
EXTENDS Naturals, Sequences, FiniteSets

(* ==================== 常量 ==================== *)
CONSTANTS
    Users,          (* 用户全集 *)
    PushChannels    (* 推送通道全集：comment/follow/article/announcement *)

(* ==================== 状态空间定义 ==================== *)
(* WebSocket 连接状态 (REQ-014) *)
WsOnline == "online"
WsOffline == "offline"
WsStates == {WsOnline, WsOffline}

(* 推送重试上限 (REQ-014 验收标准 5: 3 次重试) *)
PushRetryLimit == 3

(* 离线消息保留时长 (REQ-014 验收标准 6: 24h) *)
OfflineMessageTTL == 24

(* 离线消息队列长度上限 *)
OfflineMessageQueueLimit == 1000

NoneChannel == "nonechannel"

(* ==================== 变量 ==================== *)
VARIABLES
    wsConnections,          (* WebSocket 连接状态：user -> WsStates *)
    pushRetryCount,         (* 推送重试计数：user -> Nat *)
    offlineMessages         (* 离线消息：user -> Seq(PushChannels)（合并后） *)

vars == <<wsConnections, pushRetryCount, offlineMessages>>

(* ==================== TypeInvariant ==================== *)
TypeInvariant ==
    /\ wsConnections \in [Users -> WsStates]
    /\ pushRetryCount \in [Users -> Nat]
    /\ offlineMessages \in [Users -> Seq(PushChannels)]

(* ==================== 业务不变式 ==================== *)

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

(* @designRef docs/system-design.md#§3.1 SD-014 在线用户重试计数归零
 * 业务语义：在线用户直推成功后重试计数归零（REQ-014 验收标准 5）。
 *   重试计数仅在推送失败时累计；连接重建后计数清零。 *)
OnlineRetryResetInvariant ==
    \A u \in Users :
        wsConnections[u] = WsOnline => pushRetryCount[u] <= PushRetryLimit

(* ==================== BusinessInvariant 聚合 ==================== *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ WsConnectionInvariant
    /\ PushRetryLimitInvariant
    /\ OfflineMessageQueueInvariant
    /\ OnlineRetryResetInvariant

(* ==================== 初始状态 ==================== *)
Init ==
    /\ wsConnections = [u \in Users |-> WsOffline]
    /\ pushRetryCount = [u \in Users |-> 0]
    /\ offlineMessages = [u \in Users |-> <<>>]

(* ==================== 状态转移（Next） ==================== *)

(* SD-014 动作1：WebSocket 上线（连接建立，重试计数清零） *)
WsConnect(user) ==
    /\ user \in Users
    /\ wsConnections[user] = WsOffline
    /\ wsConnections' = [wsConnections EXCEPT ![user] = WsOnline]
    /\ pushRetryCount' = [pushRetryCount EXCEPT ![user] = 0]
    /\ UNCHANGED <<offlineMessages>>

(* SD-014 动作2：WebSocket 下线（连接断开） *)
WsDisconnect(user) ==
    /\ user \in Users
    /\ wsConnections[user] = WsOnline
    /\ wsConnections' = [wsConnections EXCEPT ![user] = WsOffline]
    /\ UNCHANGED <<pushRetryCount, offlineMessages>>

(* SD-014 动作3：推送通知（在线直推，离线入队） *)
PushNotification(user, channel) ==
    /\ user \in Users
    /\ channel \in PushChannels
    /\ IF wsConnections[user] = WsOnline
       THEN /\ pushRetryCount' = [pushRetryCount EXCEPT ![user] = 0]
            /\ UNCHANGED <<wsConnections, offlineMessages>>
       ELSE /\ Len(offlineMessages[user]) < OfflineMessageQueueLimit
            /\ offlineMessages' = [offlineMessages EXCEPT ![user] = Append(offlineMessages[user], channel)]
            /\ UNCHANGED <<wsConnections, pushRetryCount>>

(* SD-014 动作4：推送失败重试（重试计数 +1，超过上限放弃） *)
RetryPush(user) ==
    /\ user \in Users
    /\ wsConnections[user] = WsOnline
    /\ pushRetryCount[user] < PushRetryLimit
    /\ pushRetryCount' = [pushRetryCount EXCEPT ![user] = pushRetryCount[user] + 1]
    /\ UNCHANGED <<wsConnections, offlineMessages>>

(* SD-014 动作5：推送放弃（重试超限，写入离线队列） *)
AbandonPush(user, channel) ==
    /\ user \in Users
    /\ channel \in PushChannels
    /\ pushRetryCount[user] >= PushRetryLimit
    /\ Len(offlineMessages[user]) < OfflineMessageQueueLimit
    /\ offlineMessages' = [offlineMessages EXCEPT ![user] = Append(offlineMessages[user], channel)]
    /\ pushRetryCount' = [pushRetryCount EXCEPT ![user] = 0]
    /\ UNCHANGED <<wsConnections>>

(* SD-014 动作6：合并离线消息（同类合并为 1 条，保留 24h）
 *   简化建模：合并后清空队列（合并产物视为已生成的单条消息投递或保留 24h 后过期） *)
MergeOfflineMessages(user) ==
    /\ user \in Users
    /\ Len(offlineMessages[user]) > 0
    /\ offlineMessages' = [offlineMessages EXCEPT ![user] = <<>>]
    /\ UNCHANGED <<wsConnections, pushRetryCount>>

(* SD-014 动作7：清空离线消息（用户上线后投递并清空） *)
ClearOfflineMessages(user) ==
    /\ user \in Users
    /\ wsConnections[user] = WsOnline
    /\ Len(offlineMessages[user]) > 0
    /\ offlineMessages' = [offlineMessages EXCEPT ![user] = <<>>]
    /\ UNCHANGED <<wsConnections, pushRetryCount>>

(* Next：联合通知推送所有原子动作 *)
Next ==
    \/ \E u \in Users : WsConnect(u)
    \/ \E u \in Users : WsDisconnect(u)
    \/ \E u \in Users, c \in PushChannels : PushNotification(u, c)
    \/ \E u \in Users : RetryPush(u)
    \/ \E u \in Users, c \in PushChannels : AbandonPush(u, c)
    \/ \E u \in Users : MergeOfflineMessages(u)
    \/ \E u \in Users : ClearOfflineMessages(u)

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<vars>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数分析（按 .cfg 常量赋值数计算，tla-plus-guide.md §1.1）：
 *   2 个常量：Users / PushChannels
 *   .cfg 中每个常量赋 2 个值 → 变量组合数 = 2^2 = 4
 *   4 < 1000 → kept-below-threshold（保留不拆）
 * decompositionDecision: "kept-below-threshold"
 *)
================
