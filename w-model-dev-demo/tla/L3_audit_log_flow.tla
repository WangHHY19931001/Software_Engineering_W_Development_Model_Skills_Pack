---- MODULE L3_audit_log_flow ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-019,INTF-019
  @design      docs/interface-design.md#INTF-019 审计日志接口 / docs/system-design.md#SD-019 审计日志模块
  @parent      tla/L2_audit_subsystem.tla
  @sibling     null
  @child       tla/L4_audit_log_retention.tla
  @level       L3
  @phase       3
*)

(*
 * L3 审计日志原子行为规格：建模内部写入（best-effort，失败不阻断主流程）+ REST 查询双模式。
 * 状态流转：idle → receiving_log → writing → logged / write_failed
 *           idle → querying → queried
 *           write_failed → idle（best-effort，仅记 stderr，不阻断主流程）
 * 对应 INTF-019 (审计日志接口) / SD-019 (审计日志模块)。
 * 关键不变式：写入失败不阻断主流程；查询仅 admin 可访问；审计记录持久化到 EXT-OUT-002。
 *)

VARIABLES state, writeSuccess, isAdmin

\* 审计状态枚举：0=idle, 1=receiving_log, 2=writing, 3=logged, 4=write_failed, 5=querying, 6=queried, 7=forbidden
States == 0..7

Init == state = 0 /\ writeSuccess = FALSE /\ isAdmin = FALSE

\* 接收内部审计写入请求（来自 INTF-005/008/009/012/017 等）
ReceiveLogRequest ==
  /\ state = 0
  /\ state' = 1
  /\ writeSuccess' = writeSuccess
  /\ isAdmin' = isAdmin

\* 写入审计日志（持久化到 EXT-OUT-002）
WriteLog ==
  /\ state = 1
  /\ state' = 2
  /\ writeSuccess' = writeSuccess
  /\ isAdmin' = isAdmin

\* 写入成功
CompleteLogSuccess ==
  /\ state = 2
  /\ state' = 3
  /\ writeSuccess' = TRUE
  /\ isAdmin' = isAdmin

\* 写入失败（best-effort，不阻断主流程）
CompleteLogFailure ==
  /\ state = 2
  /\ state' = 4
  /\ writeSuccess' = FALSE
  /\ isAdmin' = isAdmin

\* 写入完成回到 idle（准备下一次写入）
ResetLogged ==
  /\ state = 3
  /\ state' = 0
  /\ writeSuccess' = FALSE
  /\ isAdmin' = isAdmin

\* 写入失败回到 idle（best-effort，仅记 stderr）
ResetWriteFailed ==
  /\ state = 4
  /\ state' = 0
  /\ writeSuccess' = FALSE
  /\ isAdmin' = isAdmin

\* 接收 REST 查询请求（admin only）
ReceiveQueryRequest ==
  /\ state = 0
  /\ isAdmin = TRUE
  /\ state' = 5
  /\ writeSuccess' = writeSuccess
  /\ isAdmin' = isAdmin

\* 非 admin 查询被拒绝
RejectNonAdminQuery ==
  /\ state = 0
  /\ isAdmin = FALSE
  /\ state' = 7
  /\ writeSuccess' = writeSuccess
  /\ isAdmin' = isAdmin

\* 查询审计日志
QueryLogs ==
  /\ state = 5
  /\ state' = 6
  /\ writeSuccess' = writeSuccess
  /\ isAdmin' = isAdmin

\* 查询完成回到 idle
ResetQueried ==
  /\ state = 6
  /\ state' = 0
  /\ writeSuccess' = writeSuccess
  /\ isAdmin' = isAdmin

\* 禁止访问回到 idle
ResetForbidden ==
  /\ state = 7
  /\ state' = 0
  /\ writeSuccess' = writeSuccess
  /\ isAdmin' = isAdmin

Next ==
  \/ ReceiveLogRequest
  \/ WriteLog
  \/ CompleteLogSuccess
  \/ CompleteLogFailure
  \/ ResetLogged
  \/ ResetWriteFailed
  \/ ReceiveQueryRequest
  \/ RejectNonAdminQuery
  \/ QueryLogs
  \/ ResetQueried
  \/ ResetForbidden

Spec == Init /\ [][Next]_<<state, writeSuccess, isAdmin>>

\* @designRef docs/interface-design.md#INTF-019 审计状态始终在有效范围内
TypeInvariant == state \in States /\ writeSuccess \in {TRUE, FALSE} /\ isAdmin \in {TRUE, FALSE}

\* @designRef docs/interface-design.md#INTF-019 审计状态边界约束
ValidAuditState == state >= 0 /\ state <= 7

\* @designRef docs/interface-design.md#INTF-019 best-effort 约束：写入失败不阻断主流程（state=4 后回到 idle）
BestEffortNoBlock == state # 4 \/ state' = 0

\* @designRef docs/interface-design.md#INTF-019 admin-only 查询约束：非 admin 查询被拒绝
AdminOnlyQuery == state = 5 => isAdmin = TRUE

\* @designRef docs/interface-design.md#INTF-019 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ ValidAuditState
  /\ BestEffortNoBlock
  /\ AdminOnlyQuery

====
