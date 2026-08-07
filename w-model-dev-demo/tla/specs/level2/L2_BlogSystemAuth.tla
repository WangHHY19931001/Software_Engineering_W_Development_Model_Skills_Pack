(*
  @system        blog-system::auth_subsystem
  @requirement   SD-001, REQ-007, REQ-008, REQ-009, REQ-010
  @design        docs/phase2-design/blog-system-system-design.md:§3.2
  @designIds     SD-001
  @parent        ../tla/specs/level1/L1_BlogSystem.tla
  @sibling       ../tla/specs/level2/L2_BlogSystemContent.tla, ../tla/specs/level2/L2_BlogSystemInteraction.tla, ../tla/specs/level2/L2_BlogSystemDiscovery.tla, ../tla/specs/level2/L2_BlogSystemAnalytics.tla, ../tla/specs/level2/L2_BlogSystemIntegration.tla, ../tla/specs/level2/L2_BlogSystemInfrastructure.tla
  @child         ../tla/specs/level3/L3_BlogSystemAuthFlow.tla
  @level         L2
  @phase         2
*)
---- MODULE L2_BlogSystemAuth ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    MaxLoginFailures    \* 登录失败次数上限（REQ-008/NFR-006：错误凭据 401、限流约束）

ASSUME MaxLoginFailures > 0

(* ==================== 变量 ==================== *)
VARIABLES
    authState,           \* 认证状态：unauthenticated / authenticated / token_expired（REQ-008）
    registered,          \* 是否已完成注册（REQ-007）
    role,                \* 用户角色：reader / blogger（REQ-009）
    hasAuthenticated,    \* 是否曾成功登录（博主认证前提依据）
    tokenIssued,         \* 是否曾签发 JWT（REQ-008：登录签发带过期时间的令牌）
    passwordChanged,     \* 是否曾修改密码（REQ-010：修改后会话失效需重新登录）
    loginFailures        \* 当前登录失败次数（0..MaxLoginFailures，REQ-008）

vars == <<authState, registered, role, hasAuthenticated, tokenIssued,
          passwordChanged, loginFailures>>

(* ==================== 状态不变式（TypeOK） ==================== *)
\* Invariant: 全部状态变量的类型约束
\* @designRef docs/phase2-design/blog-system-system-design.md:§3.2
TypeOK ==
    /\ authState \in {"unauthenticated", "authenticated", "token_expired"}
    /\ registered \in BOOLEAN
    /\ role \in {"reader", "blogger"}
    /\ hasAuthenticated \in BOOLEAN
    /\ tokenIssued \in BOOLEAN
    /\ passwordChanged \in BOOLEAN
    /\ loginFailures \in 0..MaxLoginFailures

(* ==================== 业务不变式 ==================== *)
\* Invariant: 已认证必已注册（登录须先注册——REQ-007/REQ-008）
\* @designRef docs/phase2-design/blog-system-system-design.md:§4 INTF-001/INTF-002
AuthenticatedRequiresRegistered ==
    authState = "authenticated" => registered

\* Invariant: 令牌过期必曾签发（JWT 带过期时间，过期后重新登录——REQ-008）
\* @designRef docs/phase2-design/blog-system-system-design.md:§2.4 认证令牌 jsonwebtoken
TokenExpiredRequiresTokenIssued ==
    authState = "token_expired" => tokenIssued

\* Invariant: 博主角色必曾成功认证（博主申请须登录后发起——REQ-009）
\* @designRef docs/phase2-design/blog-system-system-design.md:§4 INTF-003
BloggerRoleRequiresAuthHistory ==
    role = "blogger" => hasAuthenticated

\* Invariant: 登录失败次数不超过限流上限（错误凭据 401 计数受控——REQ-008/NFR-006）
\* @designRef docs/phase2-design/blog-system-system-design.md:§3.1 SD-007 限流 10 次/分/IP
LoginFailuresBounded ==
    loginFailures <= MaxLoginFailures

\* Invariant: 修改密码必曾认证（修改密码校验原密码——REQ-010）
\* @designRef docs/phase2-design/blog-system-system-design.md:§4 INTF-004
PasswordChangedRequiresAuthHistory ==
    passwordChanged => hasAuthenticated

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合全部子不变式（含 TypeOK）；.cfg 的 INVARIANTS 列表须与此展开集合一致 *)
BusinessInvariant ==
    /\ TypeOK
    /\ AuthenticatedRequiresRegistered
    /\ TokenExpiredRequiresTokenIssued
    /\ BloggerRoleRequiresAuthHistory
    /\ LoginFailuresBounded
    /\ PasswordChangedRequiresAuthHistory

(* ==================== 初始状态 ==================== *)
Init ==
    /\ authState = "unauthenticated"
    /\ registered = FALSE
    /\ role = "reader"
    /\ hasAuthenticated = FALSE
    /\ tokenIssued = FALSE
    /\ passwordChanged = FALSE
    /\ loginFailures = 0

(* ==================== 状态转移（Next） ==================== *)
(* ---- 认证状态机：unauthenticated -> authenticated -> token_expired ---- *)
(* REQ-007：注册账号（用户名/邮箱/密码，密码加密存储、邮箱唯一） *)
RegisterUser ==
    /\ registered = FALSE
    /\ registered' = TRUE
    /\ UNCHANGED <<authState, role, hasAuthenticated, tokenIssued, passwordChanged, loginFailures>>

(* REQ-008：登录成功 -> 签发 JWT（24h 过期） *)
LoginSuccess ==
    /\ registered
    /\ authState \in {"unauthenticated", "token_expired"}
    /\ loginFailures < MaxLoginFailures
    /\ authState' = "authenticated"
    /\ hasAuthenticated' = TRUE
    /\ tokenIssued' = TRUE
    /\ loginFailures' = 0
    /\ UNCHANGED <<registered, role, passwordChanged>>

(* REQ-008：错误凭据 -> 401，登录失败计数 +1 *)
LoginFailure ==
    /\ registered
    /\ authState = "unauthenticated"
    /\ loginFailures < MaxLoginFailures
    /\ loginFailures' = loginFailures + 1
    /\ UNCHANGED <<authState, registered, role, hasAuthenticated, tokenIssued, passwordChanged>>

(* NFR-006：限流窗口重置（登录失败计数清零） *)
RateLimitWindowReset ==
    /\ loginFailures > 0
    /\ loginFailures' = 0
    /\ UNCHANGED <<authState, registered, role, hasAuthenticated, tokenIssued, passwordChanged>>

(* REQ-008：JWT 24h 过期 -> token_expired *)
TokenExpire ==
    /\ authState = "authenticated"
    /\ authState' = "token_expired"
    /\ UNCHANGED <<registered, role, hasAuthenticated, tokenIssued, passwordChanged, loginFailures>>

(* REQ-008：令牌过期后重新登录 *)
ReLogin ==
    /\ authState = "token_expired"
    /\ loginFailures < MaxLoginFailures
    /\ authState' = "authenticated"
    /\ loginFailures' = 0
    /\ UNCHANGED <<registered, role, hasAuthenticated, tokenIssued, passwordChanged>>

(* REQ-009：申请成为博主（角色 reader -> blogger） *)
ApplyBlogger ==
    /\ authState = "authenticated"
    /\ role = "reader"
    /\ role' = "blogger"
    /\ UNCHANGED <<authState, registered, hasAuthenticated, tokenIssued, passwordChanged, loginFailures>>

(* REQ-010：修改密码（校验原密码后会话失效，需重新登录） *)
ChangePassword ==
    /\ authState = "authenticated"
    /\ authState' = "unauthenticated"
    /\ passwordChanged' = TRUE
    /\ UNCHANGED <<registered, role, hasAuthenticated, tokenIssued, loginFailures>>

Next ==
    \/ RegisterUser
    \/ LoginSuccess
    \/ LoginFailure
    \/ RateLimitWindowReset
    \/ TokenExpire
    \/ ReLogin
    \/ ApplyBlogger
    \/ ChangePassword

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_vars

(* ==================== 拆解决策（variableCombination > 1000 时必填） ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积：
   3(authState) x 2(registered) x 2(role) x 2(hasAuthenticated)
   x 2(tokenIssued) x 2(passwordChanged) x 6(loginFailures 0..5) = 576
   <= 1000: kept-below-threshold（子系统粒度，未触及拆解阈值） *)
====
