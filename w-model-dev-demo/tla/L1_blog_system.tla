---- MODULE L1_blog_system ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement REQ-001,SD-001
  @design      docs/requirement-spec.md
  @parent      null
  @sibling     null
  @child       tla/L2_user_auth_subsystem.tla,tla/L2_rbac_subsystem.tla,tla/L2_article_crud_subsystem.tla,tla/L2_article_workflow_subsystem.tla,tla/L2_comment_subsystem.tla,tla/L2_taxonomy_subsystem.tla,tla/L2_search_archive_subsystem.tla,tla/L2_audit_subsystem.tla,tla/L2_rss_subsystem.tla
  @level       L1
  @phase       1
*)

(*
 * L1 系统交互规格：建模博客系统后端的系统级状态机。
 * 状态流转：idle(0) → receiving(1) → processing(2) → responding(3) → idle(0)
 * 对应 EXT-IN（HTTP 请求）→ System（处理）→ EXT-OUT（HTTP 响应）的信息流。
 *)

VARIABLES state

\* 系统状态枚举：0=idle, 1=receiving, 2=processing, 3=responding
States == 0..3

Init == state = 0

\* 外部请求到达（EXT-IN → System）
ReceiveRequest ==
  /\ state = 0
  /\ state' = 1

\* 系统确认请求
AcknowledgeRequest ==
  /\ state = 1
  /\ state' = 2

\* 系统处理请求
ProcessRequest ==
  /\ state = 2
  /\ state' = 3

\* 系统发送响应（System → EXT-OUT）
SendResponse ==
  /\ state = 3
  /\ state' = 0

Next ==
  \/ ReceiveRequest
  \/ AcknowledgeRequest
  \/ ProcessRequest
  \/ SendResponse

Spec == Init /\ [][Next]_state

\* @designRef docs/requirement-spec.md#§1.2 系统状态始终在有效范围内
TypeInvariant == state \in States

\* @designRef docs/requirement-spec.md#§1.2 系统状态边界约束
ValidState == state >= 0 /\ state <= 3

\* @designRef docs/requirement-spec.md#§1.2 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ ValidState

====
