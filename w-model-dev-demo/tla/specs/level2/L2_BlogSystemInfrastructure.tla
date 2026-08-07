(*
  @system        blog-system::infrastructure_subsystem
  @requirement   SD-007, NFR-003, NFR-006, CON-001, CON-002, CON-003, CON-004
  @design        docs/phase2-design/blog-system-system-design.md:§3.1
  @designIds     SD-007
  @parent        ../tla/specs/level1/L1_BlogSystem.tla
  @sibling       ../tla/specs/level2/L2_BlogSystemAuth.tla, ../tla/specs/level2/L2_BlogSystemContent.tla, ../tla/specs/level2/L2_BlogSystemInteraction.tla, ../tla/specs/level2/L2_BlogSystemDiscovery.tla, ../tla/specs/level2/L2_BlogSystemAnalytics.tla, ../tla/specs/level2/L2_BlogSystemIntegration.tla
  @child         ../tla/specs/level3/L3_BlogSystemRateLimit.tla
  @level         L2
  @phase         2
*)
---- MODULE L2_BlogSystemInfrastructure ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    MaxRateLimit    \* 限流窗口内请求次数上限（NFR-006：认证 10 次/分/IP、通用 100 次/分/IP → 429；小模型取 1，测试环境阈值可配置）

ASSUME MaxRateLimit > 0

(* ==================== 变量 ==================== *)
VARIABLES
    rateCount,           \* 当前限流窗口内请求计数（0..MaxRateLimit——NFR-006，超限 429）
    tokenIssued,         \* 是否曾签发 JWT（CON-003：签发即带 24h 有效期）
    tokenValid,          \* JWT 当前是否有效（24h 内有效，过期后需重新登录——CON-003）
    auditLogged,         \* 关键操作（登录/发布/删除）是否已记录审计日志（CON-004）
    auditRetained,       \* 审计记录是否已进入保留（≥90 天——CON-004）
    errorState,          \* 错误响应状态：none / wrapped（统一契约）/ unwrapped（未包裹，禁态——CON-002）
    txState,             \* 存储事务状态机：idle / open / committed / aborted（CON-001/NFR-003）
    txApplied            \* 事务数据是否已应用（提交后应用、中止后回滚——NFR-003）

vars == <<rateCount, tokenIssued, tokenValid, auditLogged, auditRetained,
          errorState, txState, txApplied>>

(* ==================== 状态不变式（TypeOK） ==================== *)
\* Invariant: 全部状态变量的类型约束
\* @designRef docs/phase2-design/blog-system-system-design.md:§3.1
TypeOK ==
    /\ rateCount \in 0..MaxRateLimit
    /\ tokenIssued \in BOOLEAN
    /\ tokenValid \in BOOLEAN
    /\ auditLogged \in BOOLEAN
    /\ auditRetained \in BOOLEAN
    /\ errorState \in {"none", "wrapped", "unwrapped"}
    /\ txState \in {"idle", "open", "committed", "aborted"}
    /\ txApplied \in BOOLEAN

(* ==================== 业务不变式 ==================== *)
\* Invariant: 限流计数不超过窗口上限（超限请求被拒 429——NFR-006）
\* @designRef docs/phase2-design/blog-system-system-design.md:§3.1 限流中间件（认证 10 次/分、通用 100 次/分/IP → 429）
RateLimitBounded ==
    rateCount <= MaxRateLimit

\* Invariant: JWT 有效必已签发（有效令牌必来自签发动作——CON-003）
\* @designRef docs/phase2-design/blog-system-system-design.md:§3.1 认证中间件（JWT 解析/有效期校验 24h）
TokenValidRequiresIssued ==
    tokenValid => tokenIssued

\* Invariant: 审计记录必已保留（关键操作留痕且保留 ≥90 天——CON-004）
\* @designRef docs/phase2-design/blog-system-system-design.md:§3.1 审计中间件（登录/发布/删除留痕）
AuditRetentionPolicy ==
    auditLogged => auditRetained

\* Invariant: 错误响应必为统一契约（unwrapped 为禁态——CON-002）
\* @designRef docs/phase2-design/blog-system-system-design.md:§4 横切接口契约（CON-002）
ErrorContractUniform ==
    errorState # "unwrapped"

\* Invariant: 事务提交必已应用数据（发布不产生部分状态——NFR-003）
\* @designRef docs/phase2-design/blog-system-system-design.md:§3.1 内存存储基座（进程内事务）
CommittedTxAppliesData ==
    txState = "committed" => txApplied

\* Invariant: 事务中止必回滚数据（中止后无残留写入——NFR-003）
\* @designRef docs/phase2-design/blog-system-system-design.md:§3.1 内存存储基座（进程内事务）
AbortedTxRollsBack ==
    txState = "aborted" => ~txApplied

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合全部子不变式（含 TypeOK）；.cfg 的 INVARIANTS 列表须与此展开集合一致 *)
BusinessInvariant ==
    /\ TypeOK
    /\ RateLimitBounded
    /\ TokenValidRequiresIssued
    /\ AuditRetentionPolicy
    /\ ErrorContractUniform
    /\ CommittedTxAppliesData
    /\ AbortedTxRollsBack

(* ==================== 初始状态 ==================== *)
Init ==
    /\ rateCount = 0
    /\ tokenIssued = FALSE
    /\ tokenValid = FALSE
    /\ auditLogged = FALSE
    /\ auditRetained = FALSE
    /\ errorState = "none"
    /\ txState = "idle"
    /\ txApplied = FALSE

(* ==================== 状态转移（Next） ==================== *)
(* ---- 限流中间件（NFR-006）：计数递增、达限拒绝 429、窗口重置 ---- *)
ConsumeRateLimit ==
    /\ rateCount < MaxRateLimit
    /\ rateCount' = rateCount + 1
    /\ UNCHANGED <<tokenIssued, tokenValid, auditLogged, auditRetained,
                   errorState, txState, txApplied>>

RejectRateLimitedRequest ==
    /\ rateCount = MaxRateLimit
    /\ errorState' = "wrapped"
    /\ UNCHANGED <<rateCount, tokenIssued, tokenValid, auditLogged, auditRetained,
                   txState, txApplied>>

RateLimitWindowReset ==
    /\ rateCount > 0
    /\ rateCount' = 0
    /\ UNCHANGED <<tokenIssued, tokenValid, auditLogged, auditRetained,
                   errorState, txState, txApplied>>

(* ---- 认证中间件（CON-003）：签发 JWT（24h 有效）、过期、过期后重新登录签发 ---- *)
IssueToken ==
    /\ ~tokenIssued
    /\ tokenIssued' = TRUE
    /\ tokenValid' = TRUE
    /\ UNCHANGED <<rateCount, auditLogged, auditRetained, errorState, txState, txApplied>>

ExpireToken ==
    /\ tokenValid
    /\ tokenValid' = FALSE
    /\ UNCHANGED <<rateCount, tokenIssued, auditLogged, auditRetained,
                   errorState, txState, txApplied>>

ReissueToken ==
    /\ tokenIssued
    /\ ~tokenValid
    /\ tokenValid' = TRUE
    /\ UNCHANGED <<rateCount, auditLogged, auditRetained, errorState, txState, txApplied>>

(* ---- 审计中间件（CON-004）：关键操作（登录/发布/删除）留痕并进入保留 ---- *)
LogAuditEvent ==
    /\ ~auditLogged
    /\ auditLogged' = TRUE
    /\ auditRetained' = TRUE
    /\ UNCHANGED <<rateCount, tokenIssued, tokenValid, errorState, txState, txApplied>>

(* ---- 统一错误处理（CON-002）：错误一律包裹为 {error:{code,message}} ---- *)
RaiseWrappedError ==
    /\ errorState = "none"
    /\ errorState' = "wrapped"
    /\ UNCHANGED <<rateCount, tokenIssued, tokenValid, auditLogged, auditRetained,
                   txState, txApplied>>

ClearError ==
    /\ errorState = "wrapped"
    /\ errorState' = "none"
    /\ UNCHANGED <<rateCount, tokenIssued, tokenValid, auditLogged, auditRetained,
                   txState, txApplied>>

(* ---- 存储事务状态机（CON-001/NFR-003）：idle -> open -> committed/aborted -> idle ---- *)
BeginTx ==
    /\ txState = "idle"
    /\ txState' = "open"
    /\ UNCHANGED <<rateCount, tokenIssued, tokenValid, auditLogged, auditRetained,
                   errorState, txApplied>>

ApplyTxWrite ==
    /\ txState = "open"
    /\ txApplied' = TRUE
    /\ UNCHANGED <<rateCount, tokenIssued, tokenValid, auditLogged, auditRetained,
                   errorState, txState>>

CommitTx ==
    /\ txState = "open"
    /\ txState' = "committed"
    /\ txApplied' = TRUE
    /\ UNCHANGED <<rateCount, tokenIssued, tokenValid, auditLogged, auditRetained,
                   errorState>>

AbortTx ==
    /\ txState = "open"
    /\ txState' = "aborted"
    /\ txApplied' = FALSE
    /\ UNCHANGED <<rateCount, tokenIssued, tokenValid, auditLogged, auditRetained,
                   errorState>>

ResetTx ==
    /\ txState \in {"committed", "aborted"}
    /\ txState' = "idle"
    /\ txApplied' = FALSE
    /\ UNCHANGED <<rateCount, tokenIssued, tokenValid, auditLogged, auditRetained,
                   errorState>>

Next ==
    \/ ConsumeRateLimit
    \/ RejectRateLimitedRequest
    \/ RateLimitWindowReset
    \/ IssueToken
    \/ ExpireToken
    \/ ReissueToken
    \/ LogAuditEvent
    \/ RaiseWrappedError
    \/ ClearError
    \/ BeginTx
    \/ ApplyTxWrite
    \/ CommitTx
    \/ AbortTx
    \/ ResetTx

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_vars

(* ==================== 拆解决策（variableCombination > 1000 时必填） ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积：
   2(rateCount 0..1) x 2(tokenIssued) x 2(tokenValid) x 2(auditLogged) x 2(auditRetained)
   x 3(errorState) x 4(txState) x 2(txApplied) = 768
   <= 1000: kept-below-threshold（子系统粒度，未触及拆解阈值） *)
====
