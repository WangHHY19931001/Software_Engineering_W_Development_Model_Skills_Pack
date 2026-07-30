(* @system        blog-system-demo
   @requirement   REQ-015
   @design        docs/phase4-design/detailed-design.md#DD-013
   @parent        tla/specs/level3/L3-ArticleStateMachine.tla
   @sibling       null
   @child         null
   @level         L4
   @phase         4

   所属系统: blog-system-demo
   关联设计: docs/phase4-design/detailed-design.md#DD-013
   层级: L4 (原子子行为)
   上级 TLA: tla/specs/level3/L3-ArticleStateMachine.tla
   同级 TLA: 无
   下级 TLA: 无
   状态机七要素:
     - initial    : PENDING
     - terminal   : DELIVERED, FAILED
     - accepting  : DELIVERED
     - rejecting  : FAILED
     - transitions: 8
     - actions    : 8
     - invariants : 4
   公平性: WF_vars(StartProcess \/ Success)
*)
---- MODULE L4WebhookDelivery ----

(***********************************************************************
  L4 Webhook 投递规格（DD-013.4 形式化）

  刻画 WebhookDeliveryEngine 状态机：
    PENDING -> INFLIGHT -> DELIVERED | RETRY (attempts<3) | FAILED (attempts>=3)
    RETRY -> INFLIGHT -> ... (backoff [1s,4s,16s])
    DELIVERED/FAILED -> PENDING (Reset)
  关联 SD-013（DD-013.1~DD-013.5）。
***********************************************************************)

EXTENDS Naturals, FiniteSets, Sequences

CONSTANTS MaxAttempts, Events

ASSUME /\ MaxAttempts \in Nat /\ MaxAttempts >= 1 /\ MaxAttempts <= 3
       /\ Events # {}

VARIABLES deliveryState, attempts, lastStatus, queue, delivered, lastError

DeliveryStates == {"PENDING", "INFLIGHT", "DELIVERED", "RETRY", "FAILED"}

vars == <<deliveryState, attempts, lastStatus, queue, delivered, lastError>>

* 类型约束
TypeOK ==
  /\ deliveryState \in DeliveryStates
  /\ attempts \in 0..MaxAttempts
  /\ lastStatus \in {0, 200, 201, 400, 500}
  /\ queue \in Seq(Events)
  /\ delivered \in BOOLEAN
  /\ lastError \in {"", "timeout", "non2xx", "unknown"}

* 初始状态
Init ==
  /\ deliveryState = "PENDING"
  /\ attempts = 0
  /\ lastStatus = 0
  /\ queue = <<>>
  /\ delivered = FALSE
  /\ lastError = ""

* 入队事件
Enqueue(e) ==
  /\ deliveryState = "PENDING"
  /\ e \in Events
  /\ queue' = Append(queue, e)
  /\ UNCHANGED <<deliveryState, attempts, lastStatus, delivered, lastError>>

* 开始处理：PENDING -> INFLIGHT
StartProcess ==
  /\ deliveryState = "PENDING"
  /\ Len(queue) > 0
  /\ deliveryState' = "INFLIGHT"
  /\ attempts' = attempts + 1
  /\ UNCHANGED <<lastStatus, queue, delivered, lastError>>

* 投递成功：INFLIGHT -> DELIVERED
Success ==
  /\ deliveryState = "INFLIGHT"
  /\ lastStatus' = 200
  /\ deliveryState' = "DELIVERED"
  /\ delivered' = TRUE
  /\ lastError' = ""
  /\ UNCHANGED <<attempts, queue>>

* 重试：INFLIGHT -> RETRY（attempts<MaxAttempts）
Retry ==
  /\ deliveryState = "INFLIGHT"
  /\ attempts < MaxAttempts
  /\ lastStatus \in {400, 500}
  /\ deliveryState' = "RETRY"
  /\ lastError' = "non2xx"
  /\ UNCHANGED <<attempts, lastStatus, queue, delivered>>

* 失败：INFLIGHT -> FAILED（attempts>=MaxAttempts）
Fail ==
  /\ deliveryState = "INFLIGHT"
  /\ attempts >= MaxAttempts
  /\ deliveryState' = "FAILED"
  /\ lastError' = "non2xx"
  /\ UNCHANGED <<attempts, lastStatus, queue, delivered>>

* 重试转处理：RETRY -> INFLIGHT
RetryToInflight ==
  /\ deliveryState = "RETRY"
  /\ deliveryState' = "INFLIGHT"
  /\ UNCHANGED <<attempts, lastStatus, queue, delivered, lastError>>

* 终态重置
Reset ==
  /\ deliveryState \in {"DELIVERED","FAILED"}
  /\ deliveryState' = "PENDING"
  /\ attempts' = 0
  /\ lastStatus' = 0
  /\ delivered' = FALSE
  /\ lastError' = ""
  /\ UNCHANGED queue

* 下一状态动作
Next ==
  \/ \E e \in Events : Enqueue(e)
  \/ StartProcess
  \/ Success
  \/ Retry
  \/ Fail
  \/ RetryToInflight
  \/ Reset

Spec == Init /\ [][Next]_vars /\ WF_vars(StartProcess \/ Success)

* 不变式
AttemptBound == attempts <= MaxAttempts
FinalConsistency == deliveryState = "DELIVERED" => delivered = TRUE
FailSafety == deliveryState = "FAILED" => attempts >= MaxAttempts
NoFalseDelivery == deliveryState \in {"PENDING","INFLIGHT","RETRY"} => delivered = FALSE

* 活性
Progress == [](deliveryState = "INFLIGHT" ~> deliveryState \in {"DELIVERED","FAILED","RETRY"})

Invariants ==
  /\ TypeOK
  /\ AttemptBound
  /\ FinalConsistency
  /\ FailSafety
  /\ NoFalseDelivery
PROPERTY Progress
====
