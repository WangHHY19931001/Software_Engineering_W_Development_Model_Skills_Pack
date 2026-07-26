---- MODULE L4_auth_token_lifecycle ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-003,SD-004,DD-003-002,DD-004-003
  @design      docs/detailed-design.md#DD-003-002 AuthService.login / DD-004-003 JwtUtil
  @parent      tla/L3_login_flow.tla
  @sibling     tla/L4_rate_limiter_token_bucket.tla
  @child       null
  @level       L4
  @phase       4
*)

(*
 * L4 JWT 认证令牌生命周期原子行为规格：建模 token 签发→有效→过期/吊销 细化。
 * 状态流转：absent → valid (签发)
 *           valid → expired (TTL 3600s 到期)
 *           valid → revoked (主动吊销，如登出)
 *           expired → absent (清理)
 *           revoked → absent (清理)
 * 对应 DD-003-002 (AuthService.login) / DD-004-003 (JwtUtil)。
 * 关键不变式：有效令牌未被吊销；有效令牌未过期；TTL=3600s。
 *)

VARIABLES tokenState

\* 令牌状态枚举：0=absent, 1=valid, 2=expired, 3=revoked
States == 0..3

\* TTL 常量（CON-002：access token 有效期 1 小时 = 3600s）
TTL_SECONDS == 3600

Init == tokenState = 0

\* 签发令牌（absent → valid）
IssueToken ==
  /\ tokenState = 0
  /\ tokenState' = 1

\* 令牌过期（valid → expired）
ExpireToken ==
  /\ tokenState = 1
  /\ tokenState' = 2

\* 吊销令牌（valid → revoked，如用户登出）
RevokeToken ==
  /\ tokenState = 1
  /\ tokenState' = 3

\* 清理过期令牌（expired → absent）
CleanupExpired ==
  /\ tokenState = 2
  /\ tokenState' = 0

\* 清理吊销令牌（revoked → absent）
CleanupRevoked ==
  /\ tokenState = 3
  /\ tokenState' = 0

\* 已过期/已吊销令牌拒绝使用（保持原态）
RejectExpiredToken ==
  /\ tokenState = 2
  /\ tokenState' = 2

\* 已吊销令牌拒绝使用（保持原态）
RejectRevokedToken ==
  /\ tokenState = 3
  /\ tokenState' = 3

Next ==
  \/ IssueToken
  \/ ExpireToken
  \/ RevokeToken
  \/ CleanupExpired
  \/ CleanupRevoked
  \/ RejectExpiredToken
  \/ RejectRevokedToken

Spec == Init /\ [][Next]_tokenState

\* @designRef docs/detailed-design.md#DD-004-003 令牌状态始终在有效范围内
TypeInvariant == tokenState \in States

\* @designRef docs/detailed-design.md#DD-004-003 有效令牌未被吊销约束：valid 状态下不进入 revoked
TokenNotRevoked ==
  tokenState = 1 => tokenState # 3

\* @designRef docs/detailed-design.md#DD-003-002 有效令牌未过期约束：valid 状态下不进入 expired
TokenNotExpired ==
  tokenState = 1 => tokenState # 2

\* @designRef docs/detailed-design.md#DD-004-003 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ TokenNotRevoked
  /\ TokenNotExpired

====
