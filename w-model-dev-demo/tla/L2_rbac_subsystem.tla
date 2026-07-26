---- MODULE L2_rbac_subsystem ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-004
  @design      docs/system-design.md#SD-004 角色权限模块
  @parent      tla/L1_blog_system.tla
  @sibling     null
  @child       null
  @level       L2
  @phase       2
*)

(*
 * L2 RBAC 子系统规格：建模角色权限校验状态机。
 * 状态流转：unauthorized → checking → authorized/denied → unauthorized
 * 对应 SD-004 (角色权限)。
 *)

VARIABLES state

\* RBAC 状态枚举：0=unauthorized, 1=checking, 2=authorized, 3=denied
States == 0..3

Init == state = 0

\* 发起权限校验
CheckPermission ==
  /\ state = 0
  /\ state' = 1

\* 权限通过
Grant ==
  /\ state = 1
  /\ state' = 2

\* 权限拒绝
Deny ==
  /\ state = 1
  /\ state' = 3

\* 回到未授权状态
Reset ==
  /\ state = 2
  /\ state' = 0

\* 拒绝后回到未授权状态
ResetDenied ==
  /\ state = 3
  /\ state' = 0

Next ==
  \/ CheckPermission
  \/ Grant
  \/ Deny
  \/ Reset
  \/ ResetDenied

Spec == Init /\ [][Next]_state

\* @designRef docs/system-design.md#SD-004 RBAC 状态始终在有效范围内
TypeInvariant == state \in States

\* @designRef docs/system-design.md#SD-004 RBAC 状态边界约束
ValidRbacState == state >= 0 /\ state <= 3

\* @designRef docs/system-design.md#SD-004 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ ValidRbacState

====
