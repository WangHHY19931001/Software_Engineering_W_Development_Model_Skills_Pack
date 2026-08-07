(*
  @system        blog-system::infrastructure_subsystem::rate_limit
  @requirement   SD-007, NFR-006, REQ-008
  @design        docs/phase3-outline/blog-system-interface-design.md:§0.3
  @designIds     SD-007
  @parent        ../tla/specs/level2/L2_BlogSystemInfrastructure.tla
  @sibling       ../tla/specs/level3/L3_BlogSystemArticleState.tla, ../tla/specs/level3/L3_BlogSystemAuthFlow.tla, ../tla/specs/level3/L3_BlogSystemCommentFlow.tla, ../tla/specs/level3/L3_BlogSystemWebhookRetry.tla, ../tla/specs/level3/L3_BlogSystemReadingDedup.tla
  @child         ../tla/specs/level4/L4_BlogSystemRateLimitWindow.tla, ../tla/specs/level4/L4_BlogSystemAuditLog.tla
  @level         L3
  @phase         3
*)
---- MODULE L3_BlogSystemRateLimit ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    MaxRequests,     \* 单窗口请求上限（NFR-006：认证接口 10 次/分/IP，通用 100 次/分/IP）
    MaxResets        \* 窗口重置次数模型边界（滚动窗口推进计数）

ASSUME MaxRequests > 0 /\ MaxResets > 0

(* ==================== 变量 ==================== *)
VARIABLES
    windowState,         \* 限流窗口状态：open（放行）/ limited（限流，后续请求 42901）
    windowRequests,      \* 当前窗口已受理请求计数（0..MaxRequests）
    windowResetCount     \* 窗口重置次数（0..MaxResets，滚动窗口推进）

vars == <<windowState, windowRequests, windowResetCount>>

(* ==================== 状态不变式（TypeOK） ==================== *)
\* Invariant: 全部状态变量的类型约束（窗口两态 x 请求计数 x 重置次数）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§0.3
TypeOK ==
    /\ windowState \in {"open", "limited"}
    /\ windowRequests \in 0..MaxRequests
    /\ windowResetCount \in 0..MaxResets

(* ==================== 业务不变式 ==================== *)
\* Invariant: 窗口请求计数不超过限流上限（NFR-006：认证 10 次/分/IP、通用 100 次/分/IP——INTF-001/002）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§0.3
WindowRequestsBounded ==
    windowRequests <= MaxRequests

\* Invariant: 限流状态必因计数达上限（42901 触发条件：超限才拒绝，未超限不放行拒绝——NFR-006）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§0.3
LimitedImpliesFull ==
    windowState = "limited" => windowRequests = MaxRequests

\* Invariant: 窗口重置次数不超过模型边界（滚动窗口推进受控）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§0.1
ResetCountBounded ==
    windowResetCount <= MaxResets

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合全部子不变式（含 TypeOK）；.cfg 的 INVARIANTS 列表须与此展开集合一致 *)
BusinessInvariant ==
    /\ TypeOK
    /\ WindowRequestsBounded
    /\ LimitedImpliesFull
    /\ ResetCountBounded

(* ==================== 初始状态 ==================== *)
Init ==
    /\ windowState = "open"
    /\ windowRequests = 0
    /\ windowResetCount = 0

(* ==================== 状态转移（Next，原子操作） ==================== *)
(* ---- 请求放行：窗口未满时受理并计数（限额内正常放行） ---- *)
AllowRequest ==
    /\ windowState = "open"
    /\ windowRequests < MaxRequests
    /\ windowRequests' = windowRequests + 1
    /\ UNCHANGED <<windowState, windowResetCount>>

(* ---- NFR-006：窗口已满 -> 限流（超限请求 42901，窗口进入 limited 后本窗口不再放行） ---- *)
RejectRequest ==
    /\ windowState = "open"
    /\ windowRequests = MaxRequests
    /\ windowState' = "limited"
    /\ UNCHANGED <<windowRequests, windowResetCount>>

(* ---- 窗口滚动：1 分钟窗口重置（计数清零恢复 open；重置次数饱和于模型边界） ---- *)
WindowReset ==
    /\ windowState = "limited" \/ windowRequests > 0
    /\ windowState' = "open"
    /\ windowRequests' = 0
    /\ windowResetCount' = IF windowResetCount < MaxResets THEN windowResetCount + 1 ELSE windowResetCount

Next ==
    \/ AllowRequest
    \/ RejectRequest
    \/ WindowReset

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_vars

(* ==================== 拆解决策（variableCombination > 1000 时必填） ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积：
   2(windowState) x 6(windowRequests 0..5) x 3(windowResetCount 0..2) = 36
   <= 1000: kept-below-threshold（原子行为粒度，未触及拆解阈值） *)
====
