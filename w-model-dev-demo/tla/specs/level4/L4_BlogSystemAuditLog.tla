(*
  @system        blog-system::infrastructure_subsystem::audit_log
  @requirement   SD-007, CON-004, NFR-002
  @design        docs/phase4-detailed/blog-system-detailed-design.md:§DD-049
  @designIds     SD-007
  @parent        ../tla/specs/level3/L3_BlogSystemRateLimit.tla
  @sibling       ../tla/specs/level4/L4_BlogSystemArticleStore.tla, ../tla/specs/level4/L4_BlogSystemTokenStore.tla, ../tla/specs/level4/L4_BlogSystemRateLimitWindow.tla
  @child         null
  @level         L4
  @phase         4
*)
---- MODULE L4_BlogSystemAuditLog ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    RetentionDays,     \* 审计日志保留期（CON-004：保留 ≥90 天；模型缩尺）
    MaxLogs            \* 在库审计记录数模型边界（DD-049 AuditLogStore 容量上界）

ASSUME RetentionDays > 0 /\ MaxLogs > 0

(* ==================== 变量 ==================== *)
VARIABLES
    logAges,               \* 在库审计记录年龄序列（旧在前：logAges[1] 最旧；元素 0..RetentionDays，DD-049 prune 按 createdAt 清理）
    sensitiveRecorded      \* 在库记录是否含敏感字段（RH-01：DD-049 字段白名单 + DD-043 白名单提取——恒为 FALSE）

vars == <<logAges, sensitiveRecorded>>

(* ==================== 状态不变式（TypeOK） ==================== *)
\* Invariant: 全部状态变量的类型约束（年龄序列元素界 + 记录数上界 + 敏感标志）
\* @designRef docs/phase4-detailed/blog-system-detailed-design.md:§DD-049
TypeOK ==
    /\ logAges \in Seq(0..RetentionDays)
    /\ Len(logAges) <= MaxLogs
    /\ sensitiveRecorded \in BOOLEAN

(* ==================== 业务不变式 ==================== *)
\* Invariant: 任何在库记录年龄不超过保留期（CON-004：保留 ≥90 天，到达即清理）
\* @designRef docs/phase4-detailed/blog-system-detailed-design.md:§DD-049
AuditRetentionBounded ==
    \A i \in DOMAIN logAges : logAges[i] <= RetentionDays

\* Invariant: 在库记录数不超过模型边界（DD-049 append 容量受控）
\* @designRef docs/phase4-detailed/blog-system-detailed-design.md:§DD-049
LogsCountBounded ==
    Len(logAges) <= MaxLogs

\* Invariant: 记录按年龄非升序排列（旧在前：DD-049 prune 由最旧清理，保证 FIFO 保留语义）
\* @designRef docs/phase4-detailed/blog-system-detailed-design.md:§DD-049
OldestFirstOrdered ==
    \A i \in 1..(Len(logAges) - 1) : logAges[i] >= logAges[i + 1]

\* Invariant: 在库审计记录不含敏感字段（RH-01：DD-049 schema 白名单无 password/token/请求体；DD-043 仅提取白名单字段）
\* @designRef docs/phase4-detailed/blog-system-detailed-design.md:§DD-049
NoSensitiveFieldsLogged ==
    ~sensitiveRecorded

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合全部子不变式（含 TypeOK）；.cfg 的 INVARIANTS 列表须与此展开集合一致 *)
BusinessInvariant ==
    /\ TypeOK
    /\ AuditRetentionBounded
    /\ LogsCountBounded
    /\ OldestFirstOrdered
    /\ NoSensitiveFieldsLogged

(* ==================== 初始状态 ==================== *)
Init ==
    /\ logAges = <<>>
    /\ sensitiveRecorded = FALSE

(* ==================== 状态转移（Next，原子操作） ==================== *)
(* ---- DD-049 append：写入审计记录（DD-043 白名单字段；新记录年龄 0，追加于队尾） ---- *)
RecordAudit ==
    /\ Len(logAges) < MaxLogs
    /\ logAges' = Append(logAges, 0)
    /\ sensitiveRecorded' = FALSE

(* ---- CON-004：时间推进（记录年龄递增；到达保留期前持续有效） ---- *)
AdvanceTime ==
    /\ logAges # <<>>
    /\ \A i \in DOMAIN logAges : logAges[i] < RetentionDays
    /\ logAges' = [i \in DOMAIN logAges |-> logAges[i] + 1]
    /\ UNCHANGED <<sensitiveRecorded>>

(* ---- DD-049 prune：最旧记录到达保留期 -> 清理（保留 ≥90 天后删除） ---- *)
PurgeExpiredLog ==
    /\ logAges # <<>>
    /\ logAges[1] >= RetentionDays
    /\ logAges' = Tail(logAges)
    /\ UNCHANGED <<sensitiveRecorded>>

Next ==
    \/ RecordAudit
    \/ AdvanceTime
    \/ PurgeExpiredLog

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_vars

(* ==================== 拆解决策（variableCombination > 1000 时必填） ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积（MaxLogs=3、RetentionDays=3 时所有长度序列之和 x 敏感标志）：
   (4^0 + 4^1 + 4^2 + 4^3) x 2(sensitiveRecorded) = 170
   <= 1000: kept-below-threshold（原子行为粒度，未触及拆解阈值） *)
====
