(*
  @system        blog-system::integration_subsystem::webhook_retry
  @requirement   SD-006, REQ-028, NFR-003
  @design        docs/phase3-outline/blog-system-interface-design.md:§2.22
  @designIds     SD-006
  @parent        ../tla/specs/level2/L2_BlogSystemIntegration.tla
  @sibling       ../tla/specs/level3/L3_BlogSystemArticleState.tla, ../tla/specs/level3/L3_BlogSystemAuthFlow.tla, ../tla/specs/level3/L3_BlogSystemCommentFlow.tla, ../tla/specs/level3/L3_BlogSystemRateLimit.tla, ../tla/specs/level3/L3_BlogSystemReadingDedup.tla
  @child         null
  @level         L3
  @phase         3
*)
---- MODULE L3_BlogSystemWebhookRetry ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    MaxRetries    \* Webhook 回调最大重试次数（REQ-028/NFR-003：失败自动重试 ≤3 次，指数退避）

ASSUME MaxRetries > 0

(* ==================== 变量 ==================== *)
VARIABLES
    deliveryState,     \* 回调投递状态：idle / delivering / succeeded / failed（INTF-022）
    attempts,          \* 当前投递已重试次数（0..MaxRetries）
    failureRecorded    \* 重试耗尽后是否已写入 WebhookDelivery store 失败记录（NFR-003）

vars == <<deliveryState, attempts, failureRecorded>>

(* ==================== 状态不变式（TypeOK） ==================== *)
\* Invariant: 全部状态变量的类型约束（投递四态 x 重试计数 x 失败记录标志）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§2.22
TypeOK ==
    /\ deliveryState \in {"idle", "delivering", "succeeded", "failed"}
    /\ attempts \in 0..MaxRetries
    /\ failureRecorded \in BOOLEAN

(* ==================== 业务不变式 ==================== *)
\* Invariant: 重试次数不超过上限（REQ-028/NFR-003：回调失败自动重试 ≤3 次，指数退避——INTF-022）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§2.22
RetryLimit ==
    attempts <= MaxRetries

\* Invariant: 最终失败必留存失败记录（重试耗尽后写入 WebhookDelivery store 失败记录——NFR-003/INTF-022）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§2.22
FailureRecordedOnGiveUp ==
    deliveryState = "failed" => failureRecorded

\* Invariant: 放弃重试恰在次数耗尽（attempts=MaxRetries 才允许进入 failed 终态——REQ-028）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§2.22
GiveUpRequiresMaxAttempts ==
    deliveryState = "failed" => attempts = MaxRetries

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合全部子不变式（含 TypeOK）；.cfg 的 INVARIANTS 列表须与此展开集合一致 *)
BusinessInvariant ==
    /\ TypeOK
    /\ RetryLimit
    /\ FailureRecordedOnGiveUp
    /\ GiveUpRequiresMaxAttempts

(* ==================== 初始状态 ==================== *)
Init ==
    /\ deliveryState = "idle"
    /\ attempts = 0
    /\ failureRecorded = FALSE

(* ==================== 状态转移（Next，原子操作） ==================== *)
(* ---- INTF-022：事件触发投递（article.published / comment.created 事件订阅后分发；attempts 重置） ---- *)
DispatchWebhook ==
    /\ deliveryState \in {"idle", "succeeded", "failed"}
    /\ deliveryState' = "delivering"
    /\ attempts' = 0
    /\ UNCHANGED <<failureRecorded>>

(* ---- 回调成功：HMAC 验签通过，投递完成 ---- *)
DeliverSucceed ==
    /\ deliveryState = "delivering"
    /\ deliveryState' = "succeeded"
    /\ UNCHANGED <<attempts, failureRecorded>>

(* ---- INTF-022：回调失败自动重试（attempts < MaxRetries；指数退避后重试） ---- *)
RetryDelivery ==
    /\ deliveryState = "delivering"
    /\ attempts < MaxRetries
    /\ attempts' = attempts + 1
    /\ UNCHANGED <<deliveryState, failureRecorded>>

(* ---- INTF-022：重试耗尽 -> failed，写入 WebhookDelivery store 失败记录（NFR-003） ---- *)
GiveUpDelivery ==
    /\ deliveryState = "delivering"
    /\ attempts = MaxRetries
    /\ deliveryState' = "failed"
    /\ failureRecorded' = TRUE
    /\ UNCHANGED <<attempts>>

Next ==
    \/ DispatchWebhook
    \/ DeliverSucceed
    \/ RetryDelivery
    \/ GiveUpDelivery

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_vars

(* ==================== 拆解决策（variableCombination > 1000 时必填） ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积：
   4(deliveryState) x 4(attempts 0..3) x 2(failureRecorded) = 32
   <= 1000: kept-below-threshold（原子行为粒度，未触及拆解阈值） *)
====
