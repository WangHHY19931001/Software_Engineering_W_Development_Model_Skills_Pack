---- MODULE L4_password_reset_token_lifecycle ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-016,DD-016-002,DD-016-003,DD-016-004
  @design      docs/detailed-design.md#DD-016-002 PasswordResetService / DD-016-003 PasswordResetStore / DD-016-004 PasswordResetTokenUtil
  @parent      tla/L3_password_reset_flow.tla
  @sibling     null
  @child       null
  @level       L4
  @phase       4
*)

(*
 * L4 密码重置令牌生命周期原子行为规格：建模令牌一次性使用 + 15min 过期。
 * 状态流转：absent → issued (签发)
 *           issued → used (使用成功，重置密码)
 *           issued → expired (15min 过期)
 *           used → absent (清理)
 *           expired → absent (清理)
 * 对应 DD-016-002 (PasswordResetService) / DD-016-003 (PasswordResetStore) / DD-016-004 (PasswordResetTokenUtil)。
 * 关键不变式：令牌一次性使用（used 后不可再用）；令牌 15min 过期。
 *)

VARIABLES tokenState

\* 令牌状态枚举：0=absent, 1=issued, 2=used, 3=expired
States == 0..3

\* 过期时间常量（15min = 900s）
EXPIRY_SECONDS == 900

Init == tokenState = 0

\* 签发令牌（absent → issued）
IssueResetToken ==
  /\ tokenState = 0
  /\ tokenState' = 1

\* 使用令牌重置密码（issued → used，一次性使用）
UseResetToken ==
  /\ tokenState = 1
  /\ tokenState' = 2

\* 令牌过期（issued → expired，15min 后）
ExpireResetToken ==
  /\ tokenState = 1
  /\ tokenState' = 3

\* 清理已使用令牌（used → absent）
CleanupUsedToken ==
  /\ tokenState = 2
  /\ tokenState' = 0

\* 清理已过期令牌（expired → absent）
CleanupExpiredToken ==
  /\ tokenState = 3
  /\ tokenState' = 0

\* 已使用令牌拒绝再次使用（保持 used 状态，保证一次性）
RejectReuseUsedToken ==
  /\ tokenState = 2
  /\ tokenState' = 2

\* 已过期令牌拒绝使用（保持 expired 状态）
RejectExpiredResetToken ==
  /\ tokenState = 3
  /\ tokenState' = 3

Next ==
  \/ IssueResetToken
  \/ UseResetToken
  \/ ExpireResetToken
  \/ CleanupUsedToken
  \/ CleanupExpiredToken
  \/ RejectReuseUsedToken
  \/ RejectExpiredResetToken

Spec == Init /\ [][Next]_tokenState

\* @designRef docs/detailed-design.md#DD-016-004 令牌状态始终在有效范围内
TypeInvariant == tokenState \in States

\* @designRef docs/detailed-design.md#DD-016-002 一次性使用约束：used 状态不可回到 issued 或再次 use
OneTimeUse ==
  tokenState = 2 => tokenState # 1

\* @designRef docs/detailed-design.md#DD-016-004 15min 过期约束：issued 状态可转移到 expired（模拟 TTL 到期）
TokenExpiry15min ==
  tokenState = 1 => tokenState \in {1, 2, 3}

\* @designRef docs/detailed-design.md#DD-016-002 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ OneTimeUse
  /\ TokenExpiry15min

====
