(*
  @system        blog-system::auth_subsystem::auth_flow
  @requirement   SD-001, REQ-007, REQ-008, REQ-009
  @design        docs/phase3-outline/blog-system-interface-design.md:§2.1
  @designIds     SD-001
  @parent        ../tla/specs/level2/L2_BlogSystemAuth.tla
  @sibling       ../tla/specs/level3/L3_BlogSystemArticleState.tla, ../tla/specs/level3/L3_BlogSystemCommentFlow.tla, ../tla/specs/level3/L3_BlogSystemRateLimit.tla, ../tla/specs/level3/L3_BlogSystemWebhookRetry.tla, ../tla/specs/level3/L3_BlogSystemReadingDedup.tla
  @child         ../tla/specs/level4/L4_BlogSystemTokenStore.tla
  @level         L3
  @phase         3
*)
---- MODULE L3_BlogSystemAuthFlow ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    MaxLoginFailures    \* 登录失败次数上限（INTF-001/002：错误凭据 401；NFR-006 限流 10 次/分/IP）

ASSUME MaxLoginFailures > 0

(* ==================== 变量 ==================== *)
VARIABLES
    registered,        \* 是否已完成注册（INTF-001：用户名/邮箱全局唯一，重复 40901）
    tokenState,        \* JWT 生命周期：none / active / expired（INTF-002：签发-有效-过期，CON-003 24h）
    role,              \* 用户角色：reader / blogger（INTF-003：申请博主 reader -> blogger）
    tokenIssued,       \* 是否曾签发 JWT（INTF-002：登录成功签发令牌）
    loginFailures      \* 当前登录失败次数（0..MaxLoginFailures，INTF-002 错误凭据 401）

vars == <<registered, tokenState, role, tokenIssued, loginFailures>>

(* ==================== 状态不变式（TypeOK） ==================== *)
\* Invariant: 全部状态变量的类型约束（注册标志 x 令牌三态 x 角色 x 签发历史 x 失败计数）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§2.1
TypeOK ==
    /\ registered \in BOOLEAN
    /\ tokenState \in {"none", "active", "expired"}
    /\ role \in {"reader", "blogger"}
    /\ tokenIssued \in BOOLEAN
    /\ loginFailures \in 0..MaxLoginFailures

(* ==================== 业务不变式 ==================== *)
\* Invariant: 令牌非 none 必已注册（登录须先注册——REQ-007/REQ-008/INTF-001/INTF-002）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§2.2
ActiveTokenRequiresRegistered ==
    tokenState # "none" => registered

\* Invariant: active/expired 令牌必曾签发（JWT 签发后才可能进入过期——REQ-008/CON-003/INTF-002）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§2.2
TokenLifecycleRequiresIssuance ==
    tokenState \in {"active", "expired"} => tokenIssued

\* Invariant: 博主角色必曾成功登录（申请博主须持有效 JWT——REQ-009/INTF-003）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§2.3
BloggerRequiresAuthHistory ==
    role = "blogger" => tokenIssued

\* Invariant: 登录失败次数不超过限流上限（NFR-006：认证接口 10 次/分/IP——INTF-002 42901）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§0.3
LoginFailuresBounded ==
    loginFailures <= MaxLoginFailures

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合全部子不变式（含 TypeOK）；.cfg 的 INVARIANTS 列表须与此展开集合一致 *)
BusinessInvariant ==
    /\ TypeOK
    /\ ActiveTokenRequiresRegistered
    /\ TokenLifecycleRequiresIssuance
    /\ BloggerRequiresAuthHistory
    /\ LoginFailuresBounded

(* ==================== 初始状态 ==================== *)
Init ==
    /\ registered = FALSE
    /\ tokenState = "none"
    /\ role = "reader"
    /\ tokenIssued = FALSE
    /\ loginFailures = 0

(* ==================== 状态转移（Next，原子操作） ==================== *)
(* ---- INTF-001：注册账号（用户名/邮箱/密码；重复注册 40901 由 guard 拒绝） ---- *)
RegisterUser ==
    /\ registered = FALSE
    /\ registered' = TRUE
    /\ UNCHANGED <<tokenState, role, tokenIssued, loginFailures>>

(* ---- INTF-002：登录成功 -> 签发 JWT（tokenState=active，24h 有效——CON-003） ---- *)
LoginSuccess ==
    /\ registered
    /\ tokenState \in {"none", "expired"}
    /\ loginFailures < MaxLoginFailures
    /\ tokenState' = "active"
    /\ tokenIssued' = TRUE
    /\ loginFailures' = 0
    /\ UNCHANGED <<registered, role>>

(* ---- INTF-002：错误凭据 -> 40101，登录失败计数 +1 ---- *)
LoginFailure ==
    /\ registered
    /\ tokenState = "none"
    /\ loginFailures < MaxLoginFailures
    /\ loginFailures' = loginFailures + 1
    /\ UNCHANGED <<registered, tokenState, role, tokenIssued>>

(* ---- NFR-006：限流窗口重置（1 分钟窗口滚动，失败计数清零） ---- *)
RateLimitWindowReset ==
    /\ loginFailures > 0
    /\ loginFailures' = 0
    /\ UNCHANGED <<registered, tokenState, role, tokenIssued>>

(* ---- CON-003：JWT 24h 过期 -> tokenState=expired ---- *)
TokenExpire ==
    /\ tokenState = "active"
    /\ tokenState' = "expired"
    /\ UNCHANGED <<registered, role, tokenIssued, loginFailures>>

(* ---- INTF-002：令牌过期后重新登录（重新签发 JWT） ---- *)
ReLogin ==
    /\ tokenState = "expired"
    /\ loginFailures < MaxLoginFailures
    /\ tokenState' = "active"
    /\ loginFailures' = 0
    /\ UNCHANGED <<registered, role, tokenIssued>>

(* ---- INTF-003：申请成为博主（reader -> blogger，幂等由 stuttering 表达） ---- *)
ApplyBlogger ==
    /\ tokenState = "active"
    /\ role = "reader"
    /\ role' = "blogger"
    /\ UNCHANGED <<registered, tokenState, tokenIssued, loginFailures>>

Next ==
    \/ RegisterUser
    \/ LoginSuccess
    \/ LoginFailure
    \/ RateLimitWindowReset
    \/ TokenExpire
    \/ ReLogin
    \/ ApplyBlogger

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_vars

(* ==================== 拆解决策（variableCombination > 1000 时必填） ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积：
   2(registered) x 3(tokenState) x 2(role) x 2(tokenIssued) x 6(loginFailures 0..5) = 144
   <= 1000: kept-below-threshold（原子行为粒度，未触及拆解阈值） *)
====
