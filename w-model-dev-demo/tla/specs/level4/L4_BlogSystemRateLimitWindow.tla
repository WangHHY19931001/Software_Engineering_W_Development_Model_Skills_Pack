(*
  @system        blog-system::infrastructure_subsystem::rate_limit_window
  @requirement   SD-007, NFR-006, REQ-008
  @design        docs/phase4-detailed/blog-system-detailed-design.md:§DD-042
  @designIds     SD-007
  @parent        ../tla/specs/level3/L3_BlogSystemRateLimit.tla
  @sibling       ../tla/specs/level4/L4_BlogSystemArticleStore.tla, ../tla/specs/level4/L4_BlogSystemTokenStore.tla, ../tla/specs/level4/L4_BlogSystemAuditLog.tla
  @child         null
  @level         L4
  @phase         4
*)
---- MODULE L4_BlogSystemRateLimitWindow ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    MaxRequests,     \* 单窗口请求上限（NFR-006：认证接口 10 次/分/IP，通用 100 次/分/IP——DD-042 参数化 limit）
    WindowMs,        \* 滑动窗口时长（DD-042：windowMs=60s；模型缩尺为 tick）
    MaxTicks         \* 时钟模型边界（now 上限，保证 TLC 有限状态）

ASSUME MaxRequests > 0 /\ WindowMs > 0 /\ MaxTicks > 0

(* ==================== 变量 ==================== *)
VARIABLES
    now,               \* 时钟（请求到达时刻，0..MaxTicks）
    windowStart,       \* 当前滑动窗口起点（DD-042 RateLimitCounter.windowStart）
    requestCount,      \* 窗口内已受理请求计数（0..MaxRequests，DD-042 RateLimitCounter.count）
    windowState        \* 窗口状态：open（放行）/ limited（窗口内超限，后续请求 42901）

vars == <<now, windowStart, requestCount, windowState>>

(* ==================== 状态不变式（TypeOK） ==================== *)
\* Invariant: 全部状态变量的类型约束（时钟 x 窗口起点 x 请求计数 x 窗口两态）
\* @designRef docs/phase4-detailed/blog-system-detailed-design.md:§DD-042
TypeOK ==
    /\ now \in 0..MaxTicks
    /\ windowStart \in 0..MaxTicks
    /\ requestCount \in 0..MaxRequests
    /\ windowState \in {"open", "limited"}

(* ==================== 业务不变式 ==================== *)
\* Invariant: 窗口起点不晚于当前时钟（滑动窗口推进受控——DD-042）
\* @designRef docs/phase4-detailed/blog-system-detailed-design.md:§DD-042
WindowStartNotAfterNow ==
    windowStart <= now

\* Invariant: 窗口请求计数不超过限流上限（NFR-006：10/100 次/分/IP——超限 42901）
\* @designRef docs/phase4-detailed/blog-system-detailed-design.md:§DD-042
RequestCountBounded ==
    requestCount <= MaxRequests

\* Invariant: limited 态必因窗口计数达上限（42901 触发条件：窗口内超限才拒绝——NFR-006）
\* @designRef docs/phase4-detailed/blog-system-detailed-design.md:§DD-042
LimitedImpliesFull ==
    windowState = "limited" => requestCount = MaxRequests

\* Invariant: limited 态仅存于有效窗口期内（窗口滚动后恢复 open，不残留限流——DD-042）
\* @designRef docs/phase4-detailed/blog-system-detailed-design.md:§DD-042
LimitedWithinActiveWindow ==
    windowState = "limited" => windowStart + WindowMs > now

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合全部子不变式（含 TypeOK）；.cfg 的 INVARIANTS 列表须与此展开集合一致 *)
BusinessInvariant ==
    /\ TypeOK
    /\ WindowStartNotAfterNow
    /\ RequestCountBounded
    /\ LimitedImpliesFull
    /\ LimitedWithinActiveWindow

(* ==================== 初始状态 ==================== *)
Init ==
    /\ now = 0
    /\ windowStart = 0
    /\ requestCount = 0
    /\ windowState = "open"

(* ==================== 状态转移（Next，原子操作） ==================== *)
(* ---- 时钟推进：请求时刻前进；窗口到期（now 越过 windowStart+windowMs）同步滚动（起点前移、计数清零、恢复 open——DD-042 请求边界滚动语义） ---- *)
ClockTick ==
    /\ now < MaxTicks
    /\ now' = now + 1
    /\ windowStart' = IF windowStart + WindowMs <= now' THEN now' ELSE windowStart
    /\ requestCount' = IF windowStart + WindowMs <= now' THEN 0 ELSE requestCount
    /\ windowState' = IF windowStart + WindowMs <= now' THEN "open" ELSE windowState

(* ---- DD-042 rateLimit：窗口期内未超限 -> 受理请求，计数 +1 ---- *)
AllowRequest ==
    /\ windowState = "open"
    /\ windowStart + WindowMs > now
    /\ requestCount < MaxRequests
    /\ requestCount' = requestCount + 1
    /\ UNCHANGED <<now, windowStart, windowState>>

(* ---- NFR-006：窗口期内计数已达上限 -> 42901，窗口进入 limited（窗口滚动前持续拒绝） ---- *)
RejectRequest ==
    /\ windowStart + WindowMs > now
    /\ requestCount = MaxRequests
    /\ windowState' = "limited"
    /\ UNCHANGED <<now, windowStart, requestCount>>

Next ==
    \/ ClockTick
    \/ AllowRequest
    \/ RejectRequest

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_vars

(* ==================== 拆解决策（variableCombination > 1000 时必填） ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积：
   7(now 0..6) x 7(windowStart 0..6) x 5(requestCount 0..4) x 2(windowState) = 490
   <= 1000: kept-below-threshold（原子行为粒度，未触及拆解阈值） *)
====
