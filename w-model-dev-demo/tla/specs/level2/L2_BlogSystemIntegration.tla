(*
  @system        blog-system::integration_subsystem
  @requirement   SD-006, REQ-027, REQ-028
  @design        docs/phase2-design/blog-system-system-design.md:§3.2
  @designIds     SD-006
  @parent        ../tla/specs/level1/L1_BlogSystem.tla
  @sibling       ../tla/specs/level2/L2_BlogSystemAuth.tla, ../tla/specs/level2/L2_BlogSystemContent.tla, ../tla/specs/level2/L2_BlogSystemInteraction.tla, ../tla/specs/level2/L2_BlogSystemDiscovery.tla, ../tla/specs/level2/L2_BlogSystemAnalytics.tla, ../tla/specs/level2/L2_BlogSystemInfrastructure.tla
  @child         ../tla/specs/level3/L3_BlogSystemWebhookRetry.tla
  @level         L2
  @phase         2
*)
---- MODULE L2_BlogSystemIntegration ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    MaxWebhookRetries    \* Webhook 回调失败最大重试次数（REQ-028/NFR-003：≤3 次）

ASSUME MaxWebhookRetries > 0

(* ==================== 变量 ==================== *)
VARIABLES
    articleExposure,     \* 文章可见性：draft / published（RSS 仅含已发布——REQ-027）
    rssState,            \* RSS 源状态：idle / published（REQ-027）
    webhookConfigured,   \* Webhook 回调是否已配置（REQ-028）
    webhookState,        \* 回调投递状态：idle / delivering / failed（REQ-028）
    webhookRetries,      \* 已重试次数（0..MaxWebhookRetries，REQ-028）
    failureRecorded      \* 重试耗尽后是否留存失败记录（NFR-003）

vars == <<articleExposure, rssState, webhookConfigured, webhookState,
          webhookRetries, failureRecorded>>

(* ==================== 状态不变式（TypeOK） ==================== *)
\* Invariant: 全部状态变量的类型约束
\* @designRef docs/phase2-design/blog-system-system-design.md:§3.2
TypeOK ==
    /\ articleExposure \in {"draft", "published"}
    /\ rssState \in {"idle", "published"}
    /\ webhookConfigured \in BOOLEAN
    /\ webhookState \in {"idle", "delivering", "failed"}
    /\ webhookRetries \in 0..MaxWebhookRetries
    /\ failureRecorded \in BOOLEAN

(* ==================== 业务不变式 ==================== *)
\* Invariant: RSS 源仅含已发布文章（草稿/归档不暴露——REQ-027）
\* @designRef docs/phase2-design/blog-system-system-design.md:§1.4 RSS 拉取数据流
RssExposesPublishedOnly ==
    rssState = "published" => articleExposure = "published"

\* Invariant: Webhook 回调重试不超过上限（失败自动重试最多 3 次——REQ-028/NFR-003）
\* @designRef docs/phase2-design/blog-system-system-design.md:§3.3 SD-006 依赖 / D-04
WebhookRetryLimit ==
    webhookRetries <= MaxWebhookRetries

\* Invariant: 重试耗尽后必须留存失败记录（失败可重试且有失败记录——NFR-003）
\* @designRef docs/phase2-design/blog-system-system-design.md:§3.1 SD-006 职责
FailureRecordedOnExhaustion ==
    webhookState = "failed" => failureRecorded

\* Invariant: 回调投递必已配置 Webhook（发布/评论事件触发回调——REQ-028）
\* @designRef docs/phase2-design/blog-system-system-design.md:§4 INTF-022
DeliveryRequiresConfiguration ==
    webhookState = "delivering" => webhookConfigured

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合全部子不变式（含 TypeOK）；.cfg 的 INVARIANTS 列表须与此展开集合一致 *)
BusinessInvariant ==
    /\ TypeOK
    /\ RssExposesPublishedOnly
    /\ WebhookRetryLimit
    /\ FailureRecordedOnExhaustion
    /\ DeliveryRequiresConfiguration

(* ==================== 初始状态 ==================== *)
Init ==
    /\ articleExposure = "draft"
    /\ rssState = "idle"
    /\ webhookConfigured = FALSE
    /\ webhookState = "idle"
    /\ webhookRetries = 0
    /\ failureRecorded = FALSE

(* ==================== 状态转移（Next） ==================== *)
(* ---- RSS（REQ-027）：博主 RSS 源仅含已发布文章 ---- *)
(* SD-002 联动：文章发布（草稿不暴露于 RSS） *)
ExposeArticle ==
    /\ articleExposure = "draft"
    /\ articleExposure' = "published"
    /\ UNCHANGED <<rssState, webhookConfigured, webhookState, webhookRetries, failureRecorded>>

GenerateRss ==
    /\ articleExposure = "published"
    /\ rssState = "idle"
    /\ rssState' = "published"
    /\ UNCHANGED <<articleExposure, webhookConfigured, webhookState, webhookRetries, failureRecorded>>

(* ---- Webhook（REQ-028）：配置/禁用 + 事件分发（HMAC 签名、失败重试 ≤3 次） ---- *)
ConfigureWebhook ==
    /\ webhookConfigured = FALSE
    /\ webhookConfigured' = TRUE
    /\ UNCHANGED <<articleExposure, rssState, webhookState, webhookRetries, failureRecorded>>

DisableWebhook ==
    /\ webhookConfigured
    /\ webhookConfigured' = FALSE
    /\ webhookState' = "idle"
    /\ webhookRetries' = 0
    /\ UNCHANGED <<articleExposure, rssState, failureRecorded>>

TriggerWebhook ==
    /\ webhookConfigured
    /\ webhookState = "idle"
    /\ webhookState' = "delivering"
    /\ UNCHANGED <<articleExposure, rssState, webhookConfigured, webhookRetries, failureRecorded>>

DeliverWebhook ==
    /\ webhookState = "delivering"
    /\ webhookState' = "idle"
    /\ webhookRetries' = 0
    /\ UNCHANGED <<articleExposure, rssState, webhookConfigured, failureRecorded>>

RetryWebhook ==
    /\ webhookState = "delivering"
    /\ webhookRetries < MaxWebhookRetries
    /\ webhookRetries' = webhookRetries + 1
    /\ UNCHANGED <<articleExposure, rssState, webhookConfigured, webhookState, failureRecorded>>

FailWebhook ==
    /\ webhookState = "delivering"
    /\ webhookRetries = MaxWebhookRetries
    /\ webhookState' = "failed"
    /\ failureRecorded' = TRUE
    /\ UNCHANGED <<articleExposure, rssState, webhookConfigured, webhookRetries>>

RecoverWebhook ==
    /\ webhookState = "failed"
    /\ webhookState' = "idle"
    /\ webhookRetries' = 0
    /\ UNCHANGED <<articleExposure, rssState, webhookConfigured, failureRecorded>>

Next ==
    \/ ExposeArticle
    \/ GenerateRss
    \/ ConfigureWebhook
    \/ DisableWebhook
    \/ TriggerWebhook
    \/ DeliverWebhook
    \/ RetryWebhook
    \/ FailWebhook
    \/ RecoverWebhook

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_vars

(* ==================== 拆解决策（variableCombination > 1000 时必填） ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积：
   2(articleExposure) x 2(rssState) x 2(webhookConfigured) x 3(webhookState)
   x 4(webhookRetries 0..3) x 2(failureRecorded) = 192
   <= 1000: kept-below-threshold（子系统粒度，未触及拆解阈值） *)
====
