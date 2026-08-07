(*
  @system        blog-system
  @requirement   REQ-000, NFR-003, CON-001, CON-002, SD-000
  @design        docs/phase1-requirements/requirement-spec.md:§2
  @designIds     SD-000
  @parent        null
  @sibling       null
  @child         ../tla/specs/level2/L2_BlogSystemAuth.tla, ../tla/specs/level2/L2_BlogSystemContent.tla, ../tla/specs/level2/L2_BlogSystemInteraction.tla, ../tla/specs/level2/L2_BlogSystemDiscovery.tla, ../tla/specs/level2/L2_BlogSystemAnalytics.tla, ../tla/specs/level2/L2_BlogSystemIntegration.tla, ../tla/specs/level2/L2_BlogSystemInfrastructure.tla
  @level         L1
  @phase         1
*)
---- MODULE L1_BlogSystem ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    MaxWebhookRetries    \* Webhook 回调最大重试次数（REQ-028/NFR-003：3 次）

ASSUME MaxWebhookRetries > 0

(* ==================== 变量 ==================== *)
VARIABLES
    phase,               \* 系统生命周期阶段：init / ready / degraded / shutdown
    readyReached,        \* 系统是否曾进入 ready（生命周期单调性依据）
    webhookState,        \* Webhook 回调状态：idle / delivering / failed（EXT-OUT-002）
    webhookRetries,      \* Webhook 已重试次数（0..MaxWebhookRetries）
    failureRecorded,     \* Webhook 重试耗尽后是否留存失败记录（NFR-003）
    readersDelivered,    \* 是否已向读者（EXT-OUT-001）输出内容响应
    rssPublished         \* 是否已发布 RSS 源（EXT-OUT-002，REQ-027）

vars == <<phase, readyReached, webhookState, webhookRetries,
          failureRecorded, readersDelivered, rssPublished>>

(* ==================== 状态不变式（TypeInvariant） ==================== *)
\* Invariant: 全部状态变量的类型约束
\* @designRef docs/phase1-requirements/requirement-spec.md:§2
TypeOK ==
    /\ phase \in {"init", "ready", "degraded", "shutdown"}
    /\ readyReached \in BOOLEAN
    /\ webhookState \in {"idle", "delivering", "failed"}
    /\ webhookRetries \in 0..MaxWebhookRetries
    /\ failureRecorded \in BOOLEAN
    /\ readersDelivered \in BOOLEAN
    /\ rssPublished \in BOOLEAN

(* ==================== 业务不变式 ==================== *)
\* Invariant: Webhook 回调重试不超过上限（REQ-028：失败自动重试最多 3 次）
\* @designRef docs/phase1-requirements/requirement-spec.md:§2
WebhookRetryLimit ==
    webhookRetries <= MaxWebhookRetries

\* Invariant: 重试次数耗尽后必须留存失败记录（NFR-003：失败可重试且有失败记录）
\* @designRef docs/phase1-requirements/requirement-spec.md:§2
FailureRecordedOnExhaustion ==
    (webhookRetries = MaxWebhookRetries /\ webhookState = "failed") => failureRecorded

\* Invariant: degraded 阶段仅在系统进入过 ready 之后可达（生命周期单调性）
\* @designRef docs/phase1-requirements/requirement-spec.md:§2
DegradedRequiresReady ==
    phase = "degraded" => readyReached

\* Invariant: shutdown 仅在系统运营（ready/degraded）后可达
\* @designRef docs/phase1-requirements/requirement-spec.md:§2
ShutdownRequiresOperational ==
    phase = "shutdown" => readyReached

\* Invariant: 关停时不得有进行中的 Webhook 回调（优雅关停，NFR-003）
\* @designRef docs/phase1-requirements/requirement-spec.md:§2
GracefulShutdown ==
    phase = "shutdown" => webhookState # "delivering"

\* Invariant: EXT-OUT 输出（读者展示 / RSS 源）仅在系统运营阶段发生
\*（单调性表达：发生过输出 ⇒ 系统曾进入 ready；动作前置条件由
\*  ServeReaderRequest/PublishContent/PublishRssFeed 的 phase 守卫表达，
\*  允许带历史输出标志关停（与 ShutdownSystem 兼容））
\* @designRef docs/phase1-requirements/requirement-spec.md:§2
ExtOutRequiresOperational ==
    (readersDelivered \/ rssPublished) => readyReached

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合全部子不变式（含 TypeOK）；.cfg 的 INVARIANTS 列表须与此展开集合一致 *)
BusinessInvariant ==
    /\ TypeOK
    /\ WebhookRetryLimit
    /\ FailureRecordedOnExhaustion
    /\ DegradedRequiresReady
    /\ ShutdownRequiresOperational
    /\ GracefulShutdown
    /\ ExtOutRequiresOperational

(* ==================== 初始状态 ==================== *)
Init ==
    /\ phase = "init"
    /\ readyReached = FALSE
    /\ webhookState = "idle"
    /\ webhookRetries = 0
    /\ failureRecorded = FALSE
    /\ readersDelivered = FALSE
    /\ rssPublished = FALSE

(* ==================== 状态转移（Next） ==================== *)
(* ---- 系统生命周期：init -> ready -> degraded -> shutdown ---- *)
BecomeReady ==
    /\ phase = "init"
    /\ phase' = "ready"
    /\ readyReached' = TRUE
    /\ UNCHANGED <<webhookState, webhookRetries, failureRecorded, readersDelivered, rssPublished>>

EnterDegraded ==
    /\ phase = "ready"
    /\ phase' = "degraded"
    /\ UNCHANGED <<readyReached, webhookState, webhookRetries, failureRecorded, readersDelivered, rssPublished>>

RecoverToReady ==
    /\ phase = "degraded"
    /\ phase' = "ready"
    /\ UNCHANGED <<readyReached, webhookState, webhookRetries, failureRecorded, readersDelivered, rssPublished>>

ShutdownSystem ==
    /\ phase \in {"ready", "degraded"}
    /\ webhookState # "delivering"
    /\ phase' = "shutdown"
    /\ UNCHANGED <<readyReached, webhookState, webhookRetries, failureRecorded, readersDelivered, rssPublished>>

(* ---- 生命周期终态：shutdown 后保持停驻（显式自环，TLC 死锁检测忽略 stuttering） ---- *)
StayShutdown ==
    /\ phase = "shutdown"
    /\ UNCHANGED vars

(* ---- EXT-IN -> System -> EXT-OUT 端到端交互 ---- *)
(* EXT-IN-001：读者浏览/访问请求 -> EXT-OUT-001：内容响应（REQ-017/REQ-024） *)
ServeReaderRequest ==
    /\ phase \in {"ready", "degraded"}
    /\ readersDelivered' = TRUE
    /\ UNCHANGED <<phase, readyReached, webhookState, webhookRetries, failureRecorded, rssPublished>>

(* EXT-IN-001：博主发布 -> 读者可见 + 触发 Webhook（REQ-012/REQ-028） *)
PublishContent ==
    /\ phase = "ready"
    /\ webhookState = "idle"
    /\ readersDelivered' = TRUE
    /\ webhookState' = "delivering"
    /\ webhookRetries' = 0
    /\ UNCHANGED <<phase, readyReached, failureRecorded, rssPublished>>

(* EXT-IN-002：RSS 订阅请求 -> EXT-OUT-002：RSS 源（REQ-027） *)
PublishRssFeed ==
    /\ phase = "ready"
    /\ rssPublished' = TRUE
    /\ UNCHANGED <<phase, readyReached, webhookState, webhookRetries, failureRecorded, readersDelivered>>

(* ---- EXT-OUT-002：Webhook 回调投递与重试（REQ-028/NFR-003） ---- *)
DeliverWebhook ==
    /\ webhookState = "delivering"
    /\ webhookRetries <= MaxWebhookRetries
    /\ webhookState' = "idle"
    /\ webhookRetries' = 0
    /\ UNCHANGED <<phase, readyReached, failureRecorded, readersDelivered, rssPublished>>

RetryWebhook ==
    /\ webhookState = "delivering"
    /\ webhookRetries < MaxWebhookRetries
    /\ webhookRetries' = webhookRetries + 1
    /\ UNCHANGED <<phase, readyReached, webhookState, failureRecorded, readersDelivered, rssPublished>>

FailWebhook ==
    /\ webhookState = "delivering"
    /\ webhookRetries = MaxWebhookRetries
    /\ webhookState' = "failed"
    /\ failureRecorded' = TRUE
    /\ UNCHANGED <<phase, readyReached, webhookRetries, readersDelivered, rssPublished>>

Next ==
    \/ BecomeReady
    \/ EnterDegraded
    \/ RecoverToReady
    \/ ShutdownSystem
    \/ StayShutdown
    \/ ServeReaderRequest
    \/ PublishContent
    \/ PublishRssFeed
    \/ DeliverWebhook
    \/ RetryWebhook
    \/ FailWebhook

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_vars

(* ==================== 拆解决策（variableCombination > 1000 时必填） ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积：
   4(phase) x 2(readyReached) x 3(webhookState) x 4(webhookRetries)
   x 2(failureRecorded) x 2(readersDelivered) x 2(rssPublished) = 768
   <= 1000: kept-below-threshold（系统级抽象粒度，未触及拆解阈值） *)
====
