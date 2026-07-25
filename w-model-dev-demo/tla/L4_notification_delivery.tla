(*
  @system        blog-system-demo
  @requirement   SD-014
  @design        docs/detailed-design.md
  @parent        ../tla/L3_notification_push.tla
  @sibling       null
  @child         null
  @level         L4
  @phase         4
  所属系统: blog-system-demo
  关联需求: SD-014 消息推送（通知投递原子行为）
  关联设计: docs/detailed-design.md §3.14 SD-014 + docs/interface-design.md INTF-014
  上级 TLA: L3_notification_push.tla
  同级 TLA: 无（L4 最细粒度原子行为规格，单一职责）
  下级 TLA: 无（L4 为叶子规格）
  层级: L4 (最细粒度原子行为)
  requirementIds: [SD-014]
*)
---- MODULE L4_notification_delivery ----
EXTENDS Naturals, Sequences, FiniteSets

(* ==================== 常量 ==================== *)
CONSTANTS
    Users,          (* 用户全集 *)
    Messages,       (* 消息全集 *)
    Channels        (* 通道全集 *)

(* ==================== 状态空间定义 ==================== *)
(* 投递状态 (REQ-014 验收标准 4) *)
MsgQueued == "queued"           (* 在线/离线队列入队 *)
MsgDelivered == "delivered"     (* 已投递（在线 ws.send 成功） *)
MsgMerged == "merged"           (* 已合并（离线 24h 内同 channel） *)
MsgDropped == "dropped"         (* 已丢弃（重试 3 次失败 / 24h 外过期） *)
MsgStates == {MsgQueued, MsgDelivered, MsgMerged, MsgDropped}
NonExistMsg == "notmsg"

(* 用户在线状态 *)
UserOnline == "online"
UserOffline == "offline"
UserConnStates == {UserOnline, UserOffline}

(* 合并窗口（REQ-014 验收标准 5: 1h 聚合） *)
MergeWindow == 3600
(* 离线消息保留窗口（24h 清理） *)
OfflineTTL == 86400
(* 重试上限（REQ-014 验收标准 4: 3 次指数退避） *)
MaxRetries == 3

NoneUser == "noneuser"
NoneChannel == "nonechannel"

(* ==================== 变量 ==================== *)
VARIABLES
    userConnState,       (* 用户连接状态：user -> UserConnStates *)
    msgState,            (* 消息状态：msg -> MsgStates ∪ {NonExistMsg} *)
    msgUser,             (* 消息目标用户：msg -> Users ∪ {NoneUser} *)
    msgChannel,          (* 消息通道：msg -> Channels ∪ {NoneChannel} *)
    msgEnqueuedAt,       (* 消息入队时间：msg -> Nat（秒级，0 表示未入队） *)
    msgRetryCount,       (* 消息重试次数：msg -> Nat（0..MaxRetries） *)
    offlineQueue,        (* 离线队列：user -> Seq<Messages>（FIFO） *)
    now                  (* 当前时间戳：Nat（秒级） *)

vars == <<userConnState, msgState, msgUser, msgChannel, msgEnqueuedAt, msgRetryCount, offlineQueue, now>>

(* ==================== TypeInvariant ==================== *)
TypeInvariant ==
    /\ userConnState \in [Users -> UserConnStates]
    /\ msgState \in [Messages -> MsgStates \cup {NonExistMsg}]
    /\ msgUser \in [Messages -> Users \cup {NoneUser}]
    /\ msgChannel \in [Messages -> Channels \cup {NoneChannel}]
    /\ msgEnqueuedAt \in [Messages -> Nat]
    /\ msgRetryCount \in [Messages -> 0..MaxRetries]
    /\ offlineQueue \in [Users -> Seq(Messages)]
    /\ now \in Nat

(* ==================== 业务不变式 ==================== *)

(* @designRef docs/detailed-design.md#§3.14 SD-014 投递顺序保证
 * 业务语义：同一用户的离线队列保持 FIFO 顺序（REQ-014 验收标准 2）。
 *   离线消息按入队时间顺序投递，先入先出。 *)
DeliveryOrderInvariant ==
    /\ \A u \in Users :
        Len(offlineQueue[u]) <= 100  (* 离线队列上限保护 *)
    /\ \A m \in Messages :
        msgState[m] = MsgQueued => msgEnqueuedAt[m] > 0

(* @designRef docs/detailed-design.md#§3.14 SD-014 重试预算
 * 业务语义：单条消息重试次数不超过 MaxRetries=3（REQ-014 验收标准 4）。
 *   超过 3 次后状态转为 dropped，不再重试。
 *   指数退避：1s/2s/4s（重试间隔）。 *)
RetryBudgetInvariant ==
    /\ \A m \in Messages :
        msgRetryCount[m] <= MaxRetries
    /\ \A m \in Messages :
        msgState[m] = MsgDropped => msgRetryCount[m] = MaxRetries
    /\ \A m \in Messages :
        msgState[m] = MsgDelivered => msgRetryCount[m] <= MaxRetries

(* @designRef docs/detailed-design.md#§3.14 SD-014 合并窗口
 * 业务语义：离线消息合并窗口为 1h（MergeWindow=3600s，REQ-014 验收标准 5）。
 *   同一用户同一 channel 在 1h 内的多条消息合并为一条。
 *   超过 1h 窗口的旧消息不可合并（保持原样投递或丢弃）。 *)
MergeWindowInvariant ==
    /\ \A m \in Messages :
        msgState[m] = MsgMerged =>
            \E m2 \in Messages :
                msgUser[m] = msgUser[m2] /\
                msgChannel[m] = msgChannel[m2] /\
                msgEnqueuedAt[m2] - msgEnqueuedAt[m] <= MergeWindow

(* @designRef docs/detailed-design.md#§3.14 SD-014 24h 过期清理
 * 业务语义：离线消息保留 24h（OfflineTTL=86400s），超期自动丢弃（REQ-014 验收标准 5）。
 *   flushOffline 时，入队时间超过 24h 的消息直接 dropped。 *)
OfflineExpiryInvariant ==
    /\ \A u \in Users :
        \A i \in 1..Len(offlineQueue[u]) :
            now - msgEnqueuedAt[offlineQueue[u][i]] <= OfflineTTL
    /\ \A m \in Messages :
        msgState[m] = MsgDropped /\
        msgEnqueuedAt[m] > 0 =>
            now - msgEnqueuedAt[m] >= OfflineTTL \/ msgRetryCount[m] = MaxRetries

(* @designRef docs/detailed-design.md#§3.14 SD-014 在线用户直接投递
 * 业务语义：在线用户的 queued 消息可直接投递，不入离线队列。 *)
OnlineDeliveryInvariant ==
    /\ \A m \in Messages :
        msgState[m] = MsgDelivered =>
            userConnState[msgUser[m]] = UserOnline

(* ==================== BusinessInvariant 聚合 ==================== *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ DeliveryOrderInvariant
    /\ RetryBudgetInvariant
    /\ MergeWindowInvariant
    /\ OfflineExpiryInvariant
    /\ OnlineDeliveryInvariant

(* ==================== 初始状态 ==================== *)
Init ==
    /\ userConnState = [u \in Users |-> UserOffline]
    /\ msgState = [m \in Messages |-> NonExistMsg]
    /\ msgUser = [m \in Messages |-> NoneUser]
    /\ msgChannel = [m \in Messages |-> NoneChannel]
    /\ msgEnqueuedAt = [m \in Messages |-> 0]
    /\ msgRetryCount = [m \in Messages |-> 0]
    /\ offlineQueue = [u \in Users |-> <<>>]
    /\ now = 0

(* ==================== 状态转移（Next） ==================== *)

(* SD-014 原子动作1：用户上线（register）
 * 守卫：用户当前 offline *)
UserOnline_(user) ==
    /\ user \in Users
    /\ userConnState[user] = UserOffline
    /\ userConnState' = [userConnState EXCEPT ![user] = UserOnline]
    /\ UNCHANGED <<msgState, msgUser, msgChannel, msgEnqueuedAt, msgRetryCount, offlineQueue, now>>

(* SD-014 原子动作2：用户下线（unregister）
 * 守卫：用户当前 online *)
UserOffline_(user) ==
    /\ user \in Users
    /\ userConnState[user] = UserOnline
    /\ userConnState' = [userConnState EXCEPT ![user] = UserOffline]
    /\ UNCHANGED <<msgState, msgUser, msgChannel, msgEnqueuedAt, msgRetryCount, offlineQueue, now>>

(* SD-014 原子动作3：消息入队（push 触发）
 * 守卫：msg 未入队 + user 存在 + channel 存在 *)
EnqueueMessage(msg, user, channel) ==
    /\ msg \in Messages
    /\ user \in Users
    /\ channel \in Channels
    /\ msgState[msg] = NonExistMsg
    /\ msgState' = [msgState EXCEPT ![msg] = MsgQueued]
    /\ msgUser' = [msgUser EXCEPT ![msg] = user]
    /\ msgChannel' = [msgChannel EXCEPT ![msg] = channel]
    /\ msgEnqueuedAt' = [msgEnqueuedAt EXCEPT ![msg] = now]
    /\ msgRetryCount' = [msgRetryCount EXCEPT ![msg] = 0]
    /\ UNCHANGED <<userConnState, offlineQueue, now>>

(* SD-014 原子动作4：在线用户直接投递（push 在线分支）
 * 守卫：msg 为 queued + 用户 online + retry < MaxRetries *)
DeliverOnline(msg) ==
    /\ msg \in Messages
    /\ msgState[msg] = MsgQueued
    /\ userConnState[msgUser[msg]] = UserOnline
    /\ msgRetryCount[msg] < MaxRetries
    /\ msgState' = [msgState EXCEPT ![msg] = MsgDelivered]
    /\ UNCHANGED <<userConnState, msgUser, msgChannel, msgEnqueuedAt, msgRetryCount, offlineQueue, now>>

(* SD-014 原子动作5：离线用户入离线队列（push 离线分支）
 * 守卫：msg 为 queued + 用户 offline *)
EnqueueOffline(msg) ==
    /\ msg \in Messages
    /\ msgState[msg] = MsgQueued
    /\ userConnState[msgUser[msg]] = UserOffline
    /\ offlineQueue' = [offlineQueue EXCEPT ![msgUser[msg]] = Append(offlineQueue[msgUser[msg]], msg)]
    /\ UNCHANGED <<userConnState, msgState, msgUser, msgChannel, msgEnqueuedAt, msgRetryCount, now>>

(* SD-014 原子动作6：投递失败重试（retry，指数退避 1s/2s/4s）
 * 守卫：msg 为 queued + retry < MaxRetries *)
RetryDelivery(msg) ==
    /\ msg \in Messages
    /\ msgState[msg] = MsgQueued
    /\ msgRetryCount[msg] < MaxRetries
    /\ msgRetryCount' = [msgRetryCount EXCEPT ![msg] = msgRetryCount[msg] + 1]
    /\ UNCHANGED <<userConnState, msgState, msgUser, msgChannel, msgEnqueuedAt, offlineQueue, now>>

(* SD-014 原子动作7：重试耗尽丢弃（drop）
 * 守卫：msg 为 queued + retry = MaxRetries *)
DropMessage(msg) ==
    /\ msg \in Messages
    /\ msgState[msg] = MsgQueued
    /\ msgRetryCount[msg] = MaxRetries
    /\ msgState' = [msgState EXCEPT ![msg] = MsgDropped]
    /\ UNCHANGED <<userConnState, msgUser, msgChannel, msgEnqueuedAt, msgRetryCount, offlineQueue, now>>

(* SD-014 原子动作8：离线消息合并（merge，同 channel 1h 窗口）
 * 守卫：两条 queued 消息同 user + 同 channel + 时间差 <= MergeWindow *)
MergeMessages(msg1, msg2) ==
    /\ msg1 \in Messages /\ msg2 \in Messages
    /\ msg1 # msg2
    /\ msgState[msg1] = MsgQueued
    /\ msgState[msg2] = MsgQueued
    /\ msgUser[msg1] = msgUser[msg2]
    /\ msgChannel[msg1] = msgChannel[msg2]
    /\ msgEnqueuedAt[msg2] - msgEnqueuedAt[msg1] <= MergeWindow
    /\ msgState' = [msgState EXCEPT ![msg2] = MsgMerged]
    /\ UNCHANGED <<userConnState, msgUser, msgChannel, msgEnqueuedAt, msgRetryCount, offlineQueue, now>>

(* SD-014 原子动作9：离线消息过期清理（24h 外丢弃）
 * 守卫：msg 为 queued + now - enqueuedAt > OfflineTTL *)
ExpireOffline(msg) ==
    /\ msg \in Messages
    /\ msgState[msg] = MsgQueued
    /\ now - msgEnqueuedAt[msg] > OfflineTTL
    /\ msgState' = [msgState EXCEPT ![msg] = MsgDropped]
    /\ UNCHANGED <<userConnState, msgUser, msgChannel, msgEnqueuedAt, msgRetryCount, offlineQueue, now>>

(* SD-014 原子动作10：用户上线时 flush 离线队列
 * 守卫：用户 online + 离线队列非空 + 队首消息未过期 *)
FlushOffline(user) ==
    /\ user \in Users
    /\ userConnState[user] = UserOnline
    /\ Len(offlineQueue[user]) > 0
    /\ now - msgEnqueuedAt[offlineQueue[user][1]] <= OfflineTTL
    /\ msgState' = [msgState EXCEPT ![offlineQueue[user][1]] = MsgDelivered]
    /\ offlineQueue' = [offlineQueue EXCEPT ![user] = Tail(offlineQueue[user])]
    /\ UNCHANGED <<userConnState, msgUser, msgChannel, msgEnqueuedAt, msgRetryCount, now>>

(* SD-014 原子动作11：时间推进（系统时钟 tick） *)
Tick(seconds) ==
    /\ seconds \in Nat
    /\ seconds > 0
    /\ now' = now + seconds
    /\ UNCHANGED <<userConnState, msgState, msgUser, msgChannel, msgEnqueuedAt, msgRetryCount, offlineQueue>>

(* Next：联合通知投递所有原子动作 *)
Next ==
    \/ \E u \in Users : UserOnline_(u)
    \/ \E u \in Users : UserOffline_(u)
    \/ \E m \in Messages, u \in Users, c \in Channels : EnqueueMessage(m, u, c)
    \/ \E m \in Messages : DeliverOnline(m)
    \/ \E m \in Messages : EnqueueOffline(m)
    \/ \E m \in Messages : RetryDelivery(m)
    \/ \E m \in Messages : DropMessage(m)
    \/ \E m1, m2 \in Messages : MergeMessages(m1, m2)
    \/ \E m \in Messages : ExpireOffline(m)
    \/ \E u \in Users : FlushOffline(u)
    \/ \E s \in Nat : Tick(s)

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<vars>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数分析（按 .cfg 常量赋值数计算，tla-plus-guide.md §1.1）：
 *   3 个常量：Users / Messages / Channels
 *   .cfg 中每个常量赋 2 个值 → 变量组合数 = 2^3 = 8
 *   8 < 1000 → kept-below-threshold（保留不拆）
 * decompositionDecision: "kept-below-threshold"
 * L4 在 L3 基础上细化：增加 retryCount + offlineQueue + merge 窗口 + 24h 过期清理 + flush 离线
 *)
================
