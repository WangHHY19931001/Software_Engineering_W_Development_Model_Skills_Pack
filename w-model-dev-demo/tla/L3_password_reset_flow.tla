---- MODULE L3_password_reset_flow ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-016,INTF-016
  @design      docs/interface-design.md#INTF-016 密码重置接口 / docs/system-design.md#SD-016 密码重置模块
  @parent      tla/L2_user_auth_subsystem.tla
  @sibling     tla/L3_register_flow.tla,tla/L3_login_flow.tla
  @child       tla/L4_password_reset_token_lifecycle.tla
  @level       L3
  @phase       3
*)

(*
 * L3 密码重置原子行为规格：建模令牌一次性使用 + 过期校验。
 * 状态流转：idle → reset_request → token_generated → token_validated → password_updated
 *           token_validated → token_expired (41001, 过期)
 *           token_validated → token_used (60004, 重复使用)
 *           reset_request → user_not_found (40401)
 * 对应 INTF-016 (密码重置接口) / SD-016 (密码重置模块)。
 * 关键不变式：令牌一次性（使用后不可再用）；过期令牌拒绝；成功后 failCount/usedToken 重置。
 *)

VARIABLES state, tokenUsed, tokenExpired

\* 重置状态枚举：0=idle, 1=reset_request, 2=token_generated, 3=token_validated, 4=password_updated, 5=token_expired, 6=token_used, 7=user_not_found
States == 0..7

Init == state = 0 /\ tokenUsed = FALSE /\ tokenExpired = FALSE

\* 接收重置请求
ReceiveResetRequest ==
  /\ state = 0
  /\ state' = 1
  /\ tokenUsed' = tokenUsed
  /\ tokenExpired' = tokenExpired

\* 用户存在校验通过，生成令牌
GenerateToken ==
  /\ state = 1
  /\ state' = 2
  /\ tokenUsed' = FALSE
  /\ tokenExpired' = FALSE

\* 用户不存在
UserNotFound ==
  /\ state = 1
  /\ state' = 7
  /\ tokenUsed' = tokenUsed
  /\ tokenExpired' = tokenExpired

\* 令牌校验（未使用且未过期）
ValidateToken ==
  /\ state = 2
  /\ tokenUsed = FALSE
  /\ tokenExpired = FALSE
  /\ state' = 3
  /\ tokenUsed' = tokenUsed
  /\ tokenExpired' = tokenExpired

\* 令牌已过期
DetectTokenExpired ==
  /\ state = 2
  /\ tokenExpired = TRUE
  /\ state' = 5
  /\ tokenUsed' = tokenUsed
  /\ tokenExpired' = tokenExpired

\* 令牌已使用（一次性违反）
DetectTokenUsed ==
  /\ state = 2
  /\ tokenUsed = TRUE
  /\ state' = 6
  /\ tokenUsed' = tokenUsed
  /\ tokenExpired' = tokenExpired

\* 更新密码
UpdatePassword ==
  /\ state = 3
  /\ state' = 4
  /\ tokenUsed' = TRUE
  /\ tokenExpired' = tokenExpired

\* 重置完成回到 idle
ResetCompleted ==
  /\ state = 4
  /\ state' = 0
  /\ tokenUsed' = FALSE
  /\ tokenExpired' = FALSE

\* 令牌过期回到 idle
ResetTokenExpired ==
  /\ state = 5
  /\ state' = 0
  /\ tokenUsed' = FALSE
  /\ tokenExpired' = FALSE

\* 令牌已使用回到 idle
ResetTokenUsed ==
  /\ state = 6
  /\ state' = 0
  /\ tokenUsed' = FALSE
  /\ tokenExpired' = FALSE

\* 用户不存在回到 idle
ResetUserNotFound ==
  /\ state = 7
  /\ state' = 0
  /\ tokenUsed' = tokenUsed
  /\ tokenExpired' = tokenExpired

Next ==
  \/ ReceiveResetRequest
  \/ GenerateToken
  \/ UserNotFound
  \/ ValidateToken
  \/ DetectTokenExpired
  \/ DetectTokenUsed
  \/ UpdatePassword
  \/ ResetCompleted
  \/ ResetTokenExpired
  \/ ResetTokenUsed
  \/ ResetUserNotFound

Spec == Init /\ [][Next]_<<state, tokenUsed, tokenExpired>>

\* @designRef docs/interface-design.md#INTF-016 重置状态始终在有效范围内
TypeInvariant == state \in States /\ tokenUsed \in {TRUE, FALSE} /\ tokenExpired \in {TRUE, FALSE}

\* @designRef docs/interface-design.md#INTF-016 重置状态边界约束
ValidResetState == state >= 0 /\ state <= 7

\* @designRef docs/interface-design.md#INTF-016 令牌一次性使用约束：使用后 tokenUsed=TRUE 不可再用
TokenOneTimeUse == state = 4 => tokenUsed = TRUE

\* @designRef docs/interface-design.md#INTF-016 令牌校验守卫：仅在未使用且未过期时通过
TokenValidationGuard == state = 3 => (tokenUsed = FALSE /\ tokenExpired = FALSE)

\* @designRef docs/interface-design.md#INTF-016 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ ValidResetState
  /\ TokenOneTimeUse
  /\ TokenValidationGuard

====
