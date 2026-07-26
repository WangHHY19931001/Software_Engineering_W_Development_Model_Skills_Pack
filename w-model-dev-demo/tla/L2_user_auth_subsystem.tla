---- MODULE L2_user_auth_subsystem ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-002,SD-003,SD-016,SD-021
  @design      docs/system-design.md#SD-002 用户注册模块 / SD-003 用户登录模块 / SD-016 密码重置模块 / SD-021 用户资料管理模块
  @parent      tla/L1_blog_system.tla
  @sibling     null
  @child       tla/L3_register_flow.tla,tla/L3_login_flow.tla,tla/L3_password_reset_flow.tla
  @level       L2
  @phase       2
*)

(*
 * L2 用户认证子系统规格：建模注册/登录/密码重置/资料管理状态机。
 * 状态流转：idle → registering → registered → login_attempt → authenticated
 *           idle → reset_request → reset_done → idle
 * 对应 SD-002 (注册) / SD-003 (登录) / SD-016 (密码重置) / SD-021 (资料管理)。
 *)

VARIABLES state

\* 认证状态枚举：0=idle, 1=registering, 2=registered, 3=login_attempt, 4=authenticated, 5=reset_request, 6=reset_done, 7=profile_updating
States == 0..7

Init == state = 0

\* 用户注册（SD-002）
Register ==
  /\ state = 0
  /\ state' = 1

\* 注册完成
CompleteRegister ==
  /\ state = 1
  /\ state' = 2

\* 登录尝试（SD-003）
AttemptLogin ==
  /\ state = 2
  /\ state' = 3

\* 认证成功
Authenticate ==
  /\ state = 3
  /\ state' = 4

\* 退出登录，回到 idle
Logout ==
  /\ state = 4
  /\ state' = 0

\* 请求密码重置（SD-016）
RequestReset ==
  /\ state = 0
  /\ state' = 5

\* 完成密码重置
CompleteReset ==
  /\ state = 5
  /\ state' = 6

\* 重置完成回到 idle
ResetDone ==
  /\ state = 6
  /\ state' = 0

\* 更新用户资料（SD-021）
UpdateProfile ==
  /\ state = 4
  /\ state' = 7

\* 资料更新完成
CompleteProfileUpdate ==
  /\ state = 7
  /\ state' = 4

Next ==
  \/ Register
  \/ CompleteRegister
  \/ AttemptLogin
  \/ Authenticate
  \/ Logout
  \/ RequestReset
  \/ CompleteReset
  \/ ResetDone
  \/ UpdateProfile
  \/ CompleteProfileUpdate

Spec == Init /\ [][Next]_state

\* @designRef docs/system-design.md#SD-002 认证状态始终在有效范围内
TypeInvariant == state \in States

\* @designRef docs/system-design.md#SD-003 认证状态边界约束
ValidAuthState == state >= 0 /\ state <= 7

\* @designRef docs/system-design.md#SD-002 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ ValidAuthState

====
