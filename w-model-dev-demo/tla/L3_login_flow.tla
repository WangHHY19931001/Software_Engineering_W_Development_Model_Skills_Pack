---- MODULE L3_login_flow ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-003,INTF-003
  @design      docs/interface-design.md#INTF-003 用户登录接口 / docs/system-design.md#SD-003 用户登录模块
  @parent      tla/L2_user_auth_subsystem.tla
  @sibling     tla/L3_register_flow.tla,tla/L3_password_reset_flow.tla
  @child       tla/L4_auth_token_lifecycle.tla,tla/L4_rate_limiter_token_bucket.tla
  @level       L3
  @phase       3
*)

(*
 * L3 用户登录原子行为规格：建模 JWT 签发 + 失败计数 + 限流（5次失败/分钟）。
 * 状态流转：idle → validating_credentials → checking_password → issuing_jwt → authenticated
 *           validating_credentials → credentials_invalid (40101)
 *           checking_password → credentials_invalid (40101)
 *           idle → rate_limited (42901, 当 failCount >= 5)
 * 对应 INTF-003 (用户登录接口) / SD-003 (用户登录模块)。
 * 关键不变式：失败计数 ≤ 5；达到 5 触发限流；JWT 仅在凭据有效时签发。
 *)

VARIABLES state, failCount

\* 登录状态枚举：0=idle, 1=validating_credentials, 2=checking_password, 3=issuing_jwt, 4=authenticated, 5=credentials_invalid, 6=rate_limited
States == 0..6

\* 失败计数上限（限流阈值）
MAX_FAIL == 5

FailCounts == 0..MAX_FAIL

Init == state = 0 /\ failCount = 0

\* 接收登录请求
ReceiveLoginRequest ==
  /\ state = 0
  /\ failCount < MAX_FAIL
  /\ state' = 1
  /\ failCount' = failCount

\* 限流触发（failCount 已达上限）
TriggerRateLimit ==
  /\ state = 0
  /\ failCount >= MAX_FAIL
  /\ state' = 6
  /\ failCount' = failCount

\* 参数与凭据校验
ValidateCredentials ==
  /\ state = 1
  /\ state' = 2
  /\ failCount' = failCount

\* 密码比对成功
PasswordMatched ==
  /\ state = 2
  /\ state' = 3
  /\ failCount' = 0

\* 密码比对失败（failCount 未达上限，进入凭据无效状态）
PasswordMismatch ==
  /\ state = 2
  /\ failCount + 1 < MAX_FAIL
  /\ state' = 5
  /\ failCount' = failCount + 1

\* 密码比对失败且达限流阈值（直接进入限流状态，保证 RateLimitThreshold 不变式成立）
PasswordMismatchToRateLimit ==
  /\ state = 2
  /\ failCount + 1 >= MAX_FAIL
  /\ state' = 6
  /\ failCount' = failCount + 1

\* JWT 签发
IssueJwt ==
  /\ state = 3
  /\ state' = 4
  /\ failCount' = failCount

\* 认证完成回到 idle
ResetAuthenticated ==
  /\ state = 4
  /\ state' = 0
  /\ failCount' = failCount

\* 凭据无效回到 idle
ResetCredentialsInvalid ==
  /\ state = 5
  /\ state' = 0
  /\ failCount' = failCount

\* 限流状态回到 idle（需等待 1 分钟后重置）
ResetRateLimited ==
  /\ state = 6
  /\ state' = 0
  /\ failCount' = 0

Next ==
  \/ ReceiveLoginRequest
  \/ TriggerRateLimit
  \/ ValidateCredentials
  \/ PasswordMatched
  \/ PasswordMismatch
  \/ PasswordMismatchToRateLimit
  \/ IssueJwt
  \/ ResetAuthenticated
  \/ ResetCredentialsInvalid
  \/ ResetRateLimited

Spec == Init /\ [][Next]_<<state, failCount>>

\* @designRef docs/interface-design.md#INTF-003 登录状态始终在有效范围内
TypeInvariant == state \in States /\ failCount \in FailCounts

\* @designRef docs/interface-design.md#INTF-003 登录状态边界约束
ValidLoginState == state >= 0 /\ state <= 6

\* @designRef docs/interface-design.md#INTF-003 失败计数边界约束：failCount ∈ [0, 5]
FailureCountBound == failCount >= 0 /\ failCount <= MAX_FAIL

\* @designRef docs/interface-design.md#INTF-003 限流阈值约束：failCount 达到 5 触发限流
RateLimitThreshold == failCount < MAX_FAIL \/ state = 6

\* @designRef docs/interface-design.md#INTF-003 JWT 签发约束：仅凭据有效时签发
JwtIssuanceGuard == state = 3 => failCount = 0

\* @designRef docs/interface-design.md#INTF-003 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ ValidLoginState
  /\ FailureCountBound
  /\ RateLimitThreshold
  /\ JwtIssuanceGuard

====
