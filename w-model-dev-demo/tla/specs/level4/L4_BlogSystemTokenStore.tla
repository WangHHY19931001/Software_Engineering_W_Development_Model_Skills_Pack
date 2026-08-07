(*
  @system        blog-system::auth_subsystem::token_store
  @requirement   SD-001, REQ-008, REQ-009, CON-003
  @design        docs/phase4-detailed/blog-system-detailed-design.md:§DD-046
  @designIds     SD-001
  @parent        ../tla/specs/level3/L3_BlogSystemAuthFlow.tla
  @sibling       ../tla/specs/level4/L4_BlogSystemArticleStore.tla, ../tla/specs/level4/L4_BlogSystemRateLimitWindow.tla, ../tla/specs/level4/L4_BlogSystemAuditLog.tla
  @child         null
  @level         L4
  @phase         4
*)
---- MODULE L4_BlogSystemTokenStore ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    MaxAgeHours      \* JWT 有效期模型边界（CON-003：exp−iat ≤ 86400s；模型缩尺为小时刻度）

ASSUME MaxAgeHours > 0

(* ==================== 变量 ==================== *)
VARIABLES
    tokenState,        \* 令牌生命周期：none / active / expired（DD 状态定义 §0.2：none→active→expired，RH-02）
    tokenAge,          \* 当前令牌已存活时长（0..MaxAgeHours，CON-003 24h 有效）
    tokenIssued,       \* 是否曾签发 JWT（DD-046 jwtUtil.sign 调用过——DD-002 issueToken 后置）
    userRegistered,    \* userId 是否已注册（DD-002 issueToken 前置不变式：active ⇒ registered，RH-02）
    verifyResult       \* jwtUtil.verify 校验结果：none / valid / invalid（40101 签名非法、40102 过期）

vars == <<tokenState, tokenAge, tokenIssued, userRegistered, verifyResult>>

(* ==================== 状态不变式（TypeOK） ==================== *)
\* Invariant: 全部状态变量的类型约束（令牌三态 x 年龄 x 签发历史 x 注册标志 x 校验结果）
\* @designRef docs/phase4-detailed/blog-system-detailed-design.md:§DD-046
TypeOK ==
    /\ tokenState \in {"none", "active", "expired"}
    /\ tokenAge \in 0..MaxAgeHours
    /\ tokenIssued \in BOOLEAN
    /\ userRegistered \in BOOLEAN
    /\ verifyResult \in {"none", "valid", "invalid"}

(* ==================== 业务不变式 ==================== *)
\* Invariant: active 令牌必已注册（RH-02：issueToken 前置 userId 必须已注册，非法态 active ∧ ¬registered 不可达）
\* @designRef docs/phase4-detailed/blog-system-detailed-design.md:§0.2
ActiveTokenRequiresRegistered ==
    tokenState = "active" => userRegistered

\* Invariant: 令牌非 none 必曾签发（JWT 签发后才可能进入 active/expired——DD-002 issueToken 后置）
\* @designRef docs/phase4-detailed/blog-system-detailed-design.md:§DD-002
TokenLifecycleRequiresIssuance ==
    tokenState \in {"active", "expired"} => tokenIssued

\* Invariant: 令牌年龄不超过 24h 有效期（CON-003：exp−iat ≤ 86400s，到达即过期）
\* @designRef docs/phase4-detailed/blog-system-detailed-design.md:§DD-046
TokenAgeBounded ==
    tokenAge <= MaxAgeHours

\* Invariant: expired 令牌必达有效期上限（到期判定 exp 触发 40102——DD-046 jwtUtil.verify）
\* @designRef docs/phase4-detailed/blog-system-detailed-design.md:§DD-046
ExpiredRequiresFullAge ==
    tokenState = "expired" => tokenAge = MaxAgeHours

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合全部子不变式（含 TypeOK）；.cfg 的 INVARIANTS 列表须与此展开集合一致 *)
BusinessInvariant ==
    /\ TypeOK
    /\ ActiveTokenRequiresRegistered
    /\ TokenLifecycleRequiresIssuance
    /\ TokenAgeBounded
    /\ ExpiredRequiresFullAge

(* ==================== 初始状态 ==================== *)
Init ==
    /\ tokenState = "none"
    /\ tokenAge = 0
    /\ tokenIssued = FALSE
    /\ userRegistered = FALSE
    /\ verifyResult = "none"

(* ==================== 状态转移（Next，原子操作） ==================== *)
(* ---- 上下文使能：用户注册落库（DD-002 register：role=reader；issueToken 前置 userId 存在） ---- *)
UserRegisters ==
    /\ userRegistered = FALSE
    /\ userRegistered' = TRUE
    /\ UNCHANGED <<tokenState, tokenAge, tokenIssued, verifyResult>>

(* ---- DD-002 issueToken：签发 JWT -> active（前置 userId 已注册；exp−iat ≤ 24h） ---- *)
IssueToken ==
    /\ userRegistered
    /\ tokenState \in {"none", "expired"}
    /\ tokenState' = "active"
    /\ tokenAge' = 0
    /\ tokenIssued' = TRUE
    /\ UNCHANGED <<userRegistered, verifyResult>>

(* ---- CON-003：24h 时间流逝（active 令牌年龄推进；到达上限前持续有效） ---- *)
AdvanceTokenAge ==
    /\ tokenState = "active"
    /\ tokenAge < MaxAgeHours
    /\ tokenAge' = tokenAge + 1
    /\ UNCHANGED <<tokenState, tokenIssued, userRegistered, verifyResult>>

(* ---- CON-003：到期判定 -> expired（DD-046 verify 检测 exp 已过，40102） ---- *)
TokenExpire ==
    /\ tokenState = "active"
    /\ tokenAge = MaxAgeHours
    /\ tokenState' = "expired"
    /\ UNCHANGED <<tokenAge, tokenIssued, userRegistered, verifyResult>>

(* ---- DD-046 jwtUtil.verify：有效令牌验签通过 -> valid ---- *)
VerifyValidToken ==
    /\ tokenState = "active"
    /\ tokenAge < MaxAgeHours
    /\ verifyResult' = "valid"
    /\ UNCHANGED <<tokenState, tokenAge, tokenIssued, userRegistered>>

(* ---- DD-046 jwtUtil.verify：缺失/伪造令牌 -> invalid（40101） ---- *)
VerifyInvalidToken ==
    /\ tokenState = "none"
    /\ verifyResult' = "invalid"
    /\ UNCHANGED <<tokenState, tokenAge, tokenIssued, userRegistered>>

(* ---- DD-046 jwtUtil.verify：过期令牌 -> invalid（40102，§0.2 active→expired） ---- *)
VerifyExpiredToken ==
    /\ tokenState = "expired"
    /\ verifyResult' = "invalid"
    /\ UNCHANGED <<tokenState, tokenAge, tokenIssued, userRegistered>>

(* ---- DD-002 reLogin：过期后重签新令牌 -> active（§0.2 expired → reLogin → active） ---- *)
ReIssueToken ==
    /\ tokenState = "expired"
    /\ tokenState' = "active"
    /\ tokenAge' = 0
    /\ UNCHANGED <<tokenIssued, userRegistered, verifyResult>>

Next ==
    \/ UserRegisters
    \/ IssueToken
    \/ AdvanceTokenAge
    \/ TokenExpire
    \/ VerifyValidToken
    \/ VerifyInvalidToken
    \/ VerifyExpiredToken
    \/ ReIssueToken

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_vars

(* ==================== 拆解决策（variableCombination > 1000 时必填） ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积：
   3(tokenState) x 4(tokenAge 0..3) x 2(tokenIssued) x 2(userRegistered) x 3(verifyResult) = 144
   <= 1000: kept-below-threshold（原子行为粒度，未触及拆解阈值） *)
====
