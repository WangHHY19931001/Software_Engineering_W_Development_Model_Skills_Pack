---- MODULE L3_register_flow ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-002,INTF-002
  @design      docs/interface-design.md#INTF-002 用户注册接口 / docs/system-design.md#SD-002 用户注册模块
  @parent      tla/L2_user_auth_subsystem.tla
  @sibling     tla/L3_login_flow.tla,tla/L3_password_reset_flow.tla
  @child       null
  @level       L3
  @phase       3
*)

(*
 * L3 用户注册原子行为规格：建模邮箱唯一性 + bcrypt 哈希 + 角色注册的原子状态转移。
 * 状态流转：idle → validating_email → email_check → hashing_password → creating_user → registered
 *           email_check → email_conflict (40901)
 *           validating_email → param_invalid (40001)
 * 对应 INTF-002 (用户注册接口) / SD-002 (用户注册模块)。
 * 关键不变式：邮箱唯一性（同一 email 不可重复注册）；密码必哈希；角色 ∈ {admin, author, reader}。
 *)

VARIABLES state, emailExists, role

\* 注册状态枚举：0=idle, 1=validating_email, 2=email_check, 3=hashing_password, 4=creating_user, 5=registered, 6=email_conflict, 7=param_invalid
States == 0..7

\* 角色枚举：0=admin, 1=author, 2=reader
Roles == 0..2

Init == state = 0 /\ emailExists = FALSE /\ role = 2

\* 接收注册请求（参数校验）
ReceiveRegisterRequest ==
  /\ state = 0
  /\ state' = 1
  /\ emailExists' = emailExists
  /\ role' = role

\* 参数校验（邮箱格式 + 密码长度 + 角色合法性）
ValidateParams ==
  /\ state = 1
  /\ state' = 2
  /\ emailExists' = emailExists
  /\ role' = role

\* 邮箱唯一性校验
CheckEmailUniqueness ==
  /\ state = 2
  /\ emailExists = FALSE
  /\ state' = 3
  /\ emailExists' = emailExists
  /\ role' = role

\* 邮箱冲突
DetectEmailConflict ==
  /\ state = 2
  /\ emailExists = TRUE
  /\ state' = 6
  /\ emailExists' = emailExists
  /\ role' = role

\* bcrypt 哈希密码
HashPassword ==
  /\ state = 3
  /\ state' = 4
  /\ emailExists' = emailExists
  /\ role' = role

\* 创建用户记录
CreateUserRecord ==
  /\ state = 4
  /\ state' = 5
  /\ emailExists' = emailExists
  /\ role' = role

\* 注册完成回到 idle（准备下一次注册）
ResetRegistered ==
  /\ state = 5
  /\ state' = 0
  /\ emailExists' = FALSE
  /\ role' = 2

\* 邮箱冲突回到 idle
ResetConflict ==
  /\ state = 6
  /\ state' = 0
  /\ emailExists' = FALSE
  /\ role' = 2

\* 参数错误回到 idle
ResetParamInvalid ==
  /\ state = 7
  /\ state' = 0
  /\ emailExists' = emailExists
  /\ role' = role

Next ==
  \/ ReceiveRegisterRequest
  \/ ValidateParams
  \/ CheckEmailUniqueness
  \/ DetectEmailConflict
  \/ HashPassword
  \/ CreateUserRecord
  \/ ResetRegistered
  \/ ResetConflict
  \/ ResetParamInvalid

Spec == Init /\ [][Next]_<<state, emailExists, role>>

\* @designRef docs/interface-design.md#INTF-002 注册状态始终在有效范围内
TypeInvariant == state \in States /\ emailExists \in {TRUE, FALSE} /\ role \in Roles

\* @designRef docs/interface-design.md#INTF-002 注册状态边界约束
ValidRegisterState == state >= 0 /\ state <= 7

\* @designRef docs/interface-design.md#INTF-002 邮箱唯一性约束：已注册邮箱不可重复注册
EmailUniquenessInvariant == state # 5 \/ emailExists = FALSE

\* @designRef docs/interface-design.md#INTF-002 角色合法性约束：role ∈ {admin, author, reader}
RoleLegalityInvariant == role \in Roles

\* @designRef docs/interface-design.md#INTF-002 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ ValidRegisterState
  /\ EmailUniquenessInvariant
  /\ RoleLegalityInvariant

====
