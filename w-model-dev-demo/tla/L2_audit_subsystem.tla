---- MODULE L2_audit_subsystem ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-019
  @design      docs/system-design.md#SD-019 审计日志模块
  @parent      tla/L1_blog_system.tla
  @sibling     null
  @child       tla/L3_audit_log_flow.tla
  @level       L2
  @phase       2
*)

(*
 * L2 审计日志子系统规格：建模审计日志写入/查询状态机。
 * 状态流转：idle → logging → logged → idle
 *           idle → querying → queried → idle
 * 对应 SD-019 (审计日志)。
 *)

VARIABLES state

\* 审计状态枚举：0=idle, 1=logging, 2=logged, 3=querying, 4=queried
States == 0..4

Init == state = 0

\* 写入审计日志
LogAction ==
  /\ state = 0
  /\ state' = 1

\* 写入完成
CompleteLog ==
  /\ state = 1
  /\ state' = 2

\* 回到 idle
ResetLog ==
  /\ state = 2
  /\ state' = 0

\* 查询审计日志
QueryLogs ==
  /\ state = 0
  /\ state' = 3

\* 查询完成
CompleteQuery ==
  /\ state = 3
  /\ state' = 4

\* 回到 idle
ResetQuery ==
  /\ state = 4
  /\ state' = 0

Next ==
  \/ LogAction
  \/ CompleteLog
  \/ ResetLog
  \/ QueryLogs
  \/ CompleteQuery
  \/ ResetQuery

Spec == Init /\ [][Next]_state

\* @designRef docs/system-design.md#SD-019 审计状态始终在有效范围内
TypeInvariant == state \in States

\* @designRef docs/system-design.md#SD-019 审计状态边界约束
ValidAuditState == state >= 0 /\ state <= 4

\* @designRef docs/system-design.md#SD-019 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ ValidAuditState

====
