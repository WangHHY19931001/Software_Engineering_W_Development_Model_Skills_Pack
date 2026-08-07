(*
  @system        blog-system::ops
  @requirement   REQ-016, REQ-018, REQ-019, REQ-021, REQ-022, CON-004, SD-012, SD-014, SD-016
  @design        docs/phase2-design/blog-system-system-design.md:§3
  @designIds     SD-012,SD-014,SD-016
  @parent        ../../../tla/specs/level1/L1_BlogSystem.tla
  @sibling       ../../../tla/specs/level2/L2_BlogSystemAuth.tla, ../../../tla/specs/level2/L2_BlogSystemContent.tla, ../../../tla/specs/level2/L2_BlogSystemEngagement.tla, ../../../tla/specs/level2/L2_BlogSystemDiscovery.tla, ../../../tla/specs/level2/L2_BlogSystemInfra.tla
  @child         null
  @level         L2
  @phase         2
*)
---- MODULE L2_BlogSystemOps ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    RETENTION_DAYS, \* 审计日志保留期（M-014，CON-004；.cfg 中赋值，模型值模拟 90 天）
    MAX_RETRIES     \* Webhook 投递失败最大重试次数（M-016，REQ-022 AC1：≤ 3 次）

(* ==================== 建模层次说明 ==================== *)
(* L2 粒度 = 子系统内部行为（设计级建模），与 L1 的粒度差异： *)
(*   - L1（L1_BlogSystem）：整体系统状态机，以请求-响应类别抽象全部 22 个 REQ。 *)
(*   - L2（本规格）：运维子系统内部状态机。基于系统设计文档 §3 模块划分，建模 *)
(*     M-012 通知服务（评论/关注事件生成通知、查询仅本人、标记已读，REQ-016）、 *)
(*     M-014 审计日志服务（关键操作记录 actor/action/timestamp/详情、条件查询分页、保留期清理，REQ-018/REQ-019/CON-004）、 *)
(*     M-016 Webhook 服务（CRUD、文章发布事件投递、失败重试 ≤3 次指数退避与 failed 标记，REQ-021/REQ-022）。 *)
(*   - L3/L4：原子化子系统行为（指数退避时序、审计查询筛选字段），由阶段 3/4 承担。 *)

(* ==================== 变量 ==================== *)
VARIABLES
    notifyState,          \* M-012 通知状态：none 无 / pending 事件入列可查 / read 已读（REQ-016 AC1/AC2）
    webhookConfigChanged, \* M-016 Webhook 配置是否发生变更（REQ-018 AC1：配置变更须审计）
    auditRecorded,        \* M-014 关键操作是否已写入审计日志（REQ-018 AC1/AC2）
    auditAge,             \* M-014 审计日志最旧记录年龄（CON-004：达保留期清理）
    webhookState,         \* M-016 Webhook 投递状态：idle 空闲 / pending 投递中 / success 成功 / failed 失败超限
    retries               \* M-016 Webhook 投递失败已重试次数（REQ-022 AC1：≤ MAX_RETRIES）

(* ==================== 取值域 ==================== *)
NOTIFY_STATES == {"none", "pending", "read"}

WEBHOOK_STATES == {"idle", "pending", "success", "failed"}

(* ==================== 状态不变式（TypeInvariant） ==================== *)
TypeInvariant ==
    /\ notifyState \in NOTIFY_STATES
    /\ webhookConfigChanged \in BOOLEAN
    /\ auditRecorded \in BOOLEAN
    /\ auditAge \in 0..RETENTION_DAYS
    /\ webhookState \in WEBHOOK_STATES
    /\ retries \in 0..MAX_RETRIES

(* ==================== 业务不变式 ==================== *)
\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-014 审计日志服务，REQ-018 AC1)
\* Webhook 配置变更必须已被审计记录（配置变更是 REQ-018 AC1 列明的关键操作）
ConfigChangeAudited ==
    webhookConfigChanged => auditRecorded

\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-014 审计日志服务，CON-004 AC1)
\* 审计日志保留期上界：最旧记录年龄不超过保留期（超期即清理，永不超期滞留）
AuditRetentionBound ==
    auditAge <= RETENTION_DAYS

\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-016 Webhook 服务，REQ-022 AC1)
\* Webhook 失败重试次数上限：retries ≤ MAX_RETRIES（投递失败自动重试 ≤ 3 次）
WebhookRetryBound ==
    retries <= MAX_RETRIES

\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-016 Webhook 服务，REQ-022 AC2)
\* 仅当重试次数达到上限仍失败才标记 failed（失败超限停止重试）
WebhookFailedAfterMaxRetries ==
    (webhookState = "failed") => (retries = MAX_RETRIES)

\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-016 Webhook 服务，REQ-022 AC3)
\* 投递成功不触发重试：success 状态重试计数必须归零
WebhookSuccessNoRetry ==
    (webhookState = "success") => (retries = 0)

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合所有子不变式；.cfg 的 INVARIANTS 列表须与此展开集合一致（tla-plus-guide.md §11） *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ ConfigChangeAudited
    /\ AuditRetentionBound
    /\ WebhookRetryBound
    /\ WebhookFailedAfterMaxRetries
    /\ WebhookSuccessNoRetry

(* ==================== 初始状态 ==================== *)
(* 系统空闲：无通知、无配置变更、无审计记录、无 Webhook 投递 *)
Init ==
    /\ notifyState = "none"
    /\ webhookConfigChanged = FALSE
    /\ auditRecorded = FALSE
    /\ auditAge = 0
    /\ webhookState = "idle"
    /\ retries = 0

(* ==================== 状态转移（Next） ==================== *)
(* 转移分支忠实于系统设计文档 §3 模块职责与需求 AC；不允许占位/简化/错误实现（反模式 #16） *)

(* ---- M-012 通知服务（REQ-016） ---- *)

\* REQ-016 AC1：评论/关注事件（经 M-021 事件总线）入列 → 通知 pending，用户 GET 可查
EnqueueNotification ==
    /\ notifyState = "none"
    /\ notifyState' = "pending"
    /\ UNCHANGED <<webhookConfigChanged, auditRecorded, auditAge, webhookState, retries>>

\* REQ-016 AC2：标记已读 → 通知状态变为 read（查询他人通知 403 属 M-017 鉴权横切，L1 已建模）
MarkNotificationRead ==
    /\ notifyState = "pending"
    /\ notifyState' = "read"
    /\ UNCHANGED <<webhookConfigChanged, auditRecorded, auditAge, webhookState, retries>>

(* ---- M-014 审计日志服务（REQ-018/REQ-019/CON-004） ---- *)

\* REQ-018 AC1：Webhook 配置变更（创建/更新/删除）→ 自动记录审计日志（含 actor/action/timestamp/详情字段）
ChangeWebhookConfig ==
    /\ webhookConfigChanged' = TRUE
    /\ auditRecorded' = TRUE
    /\ UNCHANGED <<notifyState, auditAge, webhookState, retries>>

\* REQ-018 AC1：其他关键操作（登录/删除文章等）→ 审计记录
RecordAudit ==
    /\ auditRecorded' = TRUE
    /\ UNCHANGED <<notifyState, webhookConfigChanged, auditAge, webhookState, retries>>

\* CON-004 AC1：时间推进——审计最旧记录年龄 +1（上限守卫 auditAge < RETENTION_DAYS，参照 tla-plus-guide.md §14）
AdvanceAuditAge ==
    /\ auditAge < RETENTION_DAYS
    /\ auditAge' = auditAge + 1
    /\ UNCHANGED <<notifyState, webhookConfigChanged, auditRecorded, webhookState, retries>>

\* CON-004 AC1：超期清理——最旧记录达到保留期 → 清理并重置计时（配置变更事件随审计记录一并过期）
PurgeExpiredAudit ==
    /\ auditAge >= RETENTION_DAYS
    /\ auditAge' = 0
    /\ auditRecorded' = FALSE
    /\ webhookConfigChanged' = FALSE
    /\ UNCHANGED <<notifyState, webhookState, retries>>

(* ---- M-016 Webhook 服务（REQ-021/REQ-022） ---- *)

\* REQ-021 AC1：文章发布事件（经 M-021 事件总线）触发 Webhook POST 投递
WebhookEnqueue ==
    /\ webhookState = "idle"
    /\ webhookState' = "pending"
    /\ UNCHANGED <<notifyState, webhookConfigChanged, auditRecorded, auditAge, retries>>

\* REQ-022 AC3：投递成功 → success，重试计数归零（成功不触发重试）
WebhookDeliverySuccess ==
    /\ webhookState = "pending"
    /\ webhookState' = "success"
    /\ retries' = 0
    /\ UNCHANGED <<notifyState, webhookConfigChanged, auditRecorded, auditAge>>

\* REQ-022 AC1：投递失败自动重试（≤ MAX_RETRIES 次；指数退避间隔为时序细节，L3/L4 细化）
WebhookDeliveryFail ==
    /\ webhookState = "pending"
    /\ retries < MAX_RETRIES
    /\ retries' = retries + 1
    /\ UNCHANGED <<notifyState, webhookConfigChanged, auditRecorded, auditAge, webhookState>>

\* REQ-022 AC2：重试仍失败，超限标记 failed 停止重试
WebhookGiveUp ==
    /\ webhookState = "pending"
    /\ retries = MAX_RETRIES
    /\ webhookState' = "failed"
    /\ UNCHANGED <<notifyState, webhookConfigChanged, auditRecorded, auditAge, retries>>

\* 投递生命周期复位（success/failed 后回到 idle，等待下一事件）
WebhookReset ==
    /\ webhookState \in {"success", "failed"}
    /\ webhookState' = "idle"
    /\ retries' = 0
    /\ UNCHANGED <<notifyState, webhookConfigChanged, auditRecorded, auditAge>>

Next ==
    \/ EnqueueNotification
    \/ MarkNotificationRead
    \/ ChangeWebhookConfig
    \/ RecordAudit
    \/ AdvanceAuditAge
    \/ PurgeExpiredAudit
    \/ WebhookEnqueue
    \/ WebhookDeliverySuccess
    \/ WebhookDeliveryFail
    \/ WebhookGiveUp
    \/ WebhookReset

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<notifyState, webhookConfigChanged, auditRecorded, auditAge, webhookState, retries>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积
   = |NOTIFY_STATES|3 × |webhookConfigChanged|2 × |auditRecorded|2 × |auditAge|(RETENTION_DAYS+1=3)
     × |WEBHOOK_STATES|4 × |retries|(MAX_RETRIES+1=4)
   = 3 × 2 × 2 × 3 × 4 × 4 = 576 *)
(* 576 ≤ 1000 → decompositionDecision = "kept-below-threshold"（契约指定值） *)
(* 保留理由：运维子系统 6 个变量对应通知/审计/Webhook 三个模块的强制状态（事件入列、 *)
(*   审计保留期、投递重试计数均为设计文档 §3 模块职责与需求 AC 的强制语义）， *)
(*   组合数低于拆解阈值；细粒度拆解（指数退避时序、审计查询筛选）由阶段 3/4 的 L3/L4 承担 *)
================
