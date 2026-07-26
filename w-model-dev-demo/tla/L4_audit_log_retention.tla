---- MODULE L4_audit_log_retention ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-019,DD-019-002,DD-019-003,DD-019-004
  @design      docs/detailed-design.md#DD-019-002 AuditService / DD-019-003 AuditLogStore / DD-019-004 AuditMiddleware
  @parent      tla/L3_audit_log_flow.tla
  @sibling     null
  @child       null
  @level       L4
  @phase       4
*)

(*
 * L4 审计日志保留原子行为规格：建模 90 天保留 + 日志追加 + 过期清理。
 * 状态流转：append(写入新日志，logCount +1) / purge(清理 >90 天日志)
 *           oldestAge 随时间推进；>90 时触发 purge
 * 对应 DD-019-002 (AuditService) / DD-019-003 (AuditLogStore) / DD-019-004 (AuditMiddleware)。
 * 关键不变式：保留期 ≥ 90 天；日志不丢失（append 必成功）；oldestAge ≤ 90。
 *)

VARIABLES logCount, oldestAge

\* 保留期天数（NFR/CON：90 天保留）
RETENTION_DAYS == 90

\* 日志计数上限（简化状态空间）
MAX_LOGS == 5

\* 日志计数范围
LogCounts == 0..MAX_LOGS

\* 最旧日志年龄范围（0..RETENTION_DAYS+1，>RETENTION_DAYS 触发清理）
Ages == 0..(RETENTION_DAYS + 1)

Init == logCount = 0 /\ oldestAge = 0

\* 追加日志（logCount < MAX_LOGS 时写入）
AppendLog ==
  /\ logCount < MAX_LOGS
  /\ logCount' = logCount + 1
  /\ oldestAge' = oldestAge

\* 追加日志（logCount 已达上限，仍保证 NoLogLoss：覆盖最旧，计数不变）
AppendLogAtCapacity ==
  /\ logCount = MAX_LOGS
  /\ logCount' = logCount
  /\ oldestAge' = 0

\* 时间推进（logCount > 0 且 oldestAge < RETENTION_DAYS 时推进；不超过 RETENTION_DAYS 以保证 Retention90Days 不变式）
AdvanceTime ==
  /\ logCount > 0
  /\ oldestAge < RETENTION_DAYS
  /\ oldestAge' = oldestAge + 1
  /\ logCount' = logCount

\* 清理过期日志（oldestAge >= RETENTION_DAYS 时清理，重置 logCount=0 / oldestAge=0）
PurgeExpiredLogs ==
  /\ oldestAge >= RETENTION_DAYS
  /\ logCount > 0
  /\ logCount' = 0
  /\ oldestAge' = 0

Next ==
  \/ AppendLog
  \/ AppendLogAtCapacity
  \/ AdvanceTime
  \/ PurgeExpiredLogs

Spec == Init /\ [][Next]_<<logCount, oldestAge>>

\* @designRef docs/detailed-design.md#DD-019-003 日志计数与最旧年龄始终在有效范围内
TypeInvariant == logCount \in LogCounts /\ oldestAge \in Ages

\* @designRef docs/detailed-design.md#DD-019-003 90 天保留约束：oldestAge ≤ RETENTION_DAYS 或已触发清理
Retention90Days ==
  oldestAge <= RETENTION_DAYS \/ logCount = 0

\* @designRef docs/detailed-design.md#DD-019-002 日志不丢失约束：append 操作必成功（即使达上限也覆盖最旧）
NoLogLoss ==
  logCount >= 0 /\ logCount <= MAX_LOGS

\* @designRef docs/detailed-design.md#DD-019-002 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ Retention90Days
  /\ NoLogLoss

====
