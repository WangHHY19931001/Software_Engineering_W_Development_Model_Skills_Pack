(*
  @system        blog-system::analytics_subsystem::reading_dedup
  @requirement   SD-005, REQ-024
  @design        docs/phase3-outline/blog-system-interface-design.md:§2.18
  @designIds     SD-005
  @parent        ../tla/specs/level2/L2_BlogSystemAnalytics.tla
  @sibling       ../tla/specs/level3/L3_BlogSystemArticleState.tla, ../tla/specs/level3/L3_BlogSystemAuthFlow.tla, ../tla/specs/level3/L3_BlogSystemCommentFlow.tla, ../tla/specs/level3/L3_BlogSystemRateLimit.tla, ../tla/specs/level3/L3_BlogSystemWebhookRetry.tla
  @child         null
  @level         L3
  @phase         3
*)
---- MODULE L3_BlogSystemReadingDedup ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    MaxViews,      \* 阅读量模型边界（REQ-024：阅读量 +1，去重后累计值）
    WindowSize     \* 去重窗口时长（INTF-018：同 IP + 文章 5 分钟窗口内重复访问不计数，窗口参数化）

ASSUME MaxViews > 0 /\ WindowSize > 0

(* ==================== 变量 ==================== *)
VARIABLES
    viewCount,         \* 去重后累计阅读量（0..MaxViews）
    recentlyViewed,    \* 当前 clientIp+articleId 是否在去重窗口内（INTF-018：窗口内重复访问不计数）
    windowAge          \* 去重窗口已推进时长（0..WindowSize，到达 WindowSize 后窗口滚动）

vars == <<viewCount, recentlyViewed, windowAge>>

(* ==================== 状态不变式（TypeOK） ==================== *)
\* Invariant: 全部状态变量的类型约束（阅读量 x 去重标志 x 窗口年龄）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§2.18
TypeOK ==
    /\ viewCount \in 0..MaxViews
    /\ recentlyViewed \in BOOLEAN
    /\ windowAge \in 0..WindowSize

(* ==================== 业务不变式 ==================== *)
\* Invariant: 去重窗口内必已计过阅读（recentlyViewed 仅由首次访问置位——REQ-024/INTF-018）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§2.18
RecentlyViewedImpliesCounted ==
    recentlyViewed => viewCount >= 1

\* Invariant: 阅读量不超过模型上限（去重后累计值受控——REQ-024）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§2.18
ViewCountBounded ==
    viewCount <= MaxViews

\* Invariant: 窗口年龄不超过去重窗口时长（5 分钟窗口参数化，到达即滚动——INTF-018）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§2.18
WindowAgeBounded ==
    windowAge <= WindowSize

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合全部子不变式（含 TypeOK）；.cfg 的 INVARIANTS 列表须与此展开集合一致 *)
BusinessInvariant ==
    /\ TypeOK
    /\ RecentlyViewedImpliesCounted
    /\ ViewCountBounded
    /\ WindowAgeBounded

(* ==================== 初始状态 ==================== *)
Init ==
    /\ viewCount = 0
    /\ recentlyViewed = FALSE
    /\ windowAge = 0

(* ==================== 状态转移（Next，原子操作） ==================== *)
(* ---- REQ-024/INTF-018：首次访问 -> 阅读量 +1 并进入去重窗口 ---- *)
ViewArticleFirstTime ==
    /\ ~recentlyViewed
    /\ viewCount < MaxViews
    /\ viewCount' = viewCount + 1
    /\ recentlyViewed' = TRUE
    /\ windowAge' = 0

(* ---- 模型边界：阅读量已达上限时首次访问仅进入去重窗口（不再计数） ---- *)
ViewArticleAtCapacity ==
    /\ ~recentlyViewed
    /\ viewCount = MaxViews
    /\ recentlyViewed' = TRUE
    /\ UNCHANGED <<viewCount, windowAge>>

(* ---- INTF-018：窗口内重复访问（同 IP + 文章）不计数（去重） ---- *)
RepeatView ==
    /\ recentlyViewed
    /\ UNCHANGED vars

(* ---- 窗口推进：时间 tick 前进（5 分钟窗口滚动） ---- *)
TickWindow ==
    /\ recentlyViewed
    /\ windowAge < WindowSize
    /\ windowAge' = windowAge + 1
    /\ UNCHANGED <<viewCount, recentlyViewed>>

(* ---- 窗口到期：到达 WindowSize 后滚动窗口，清除去重标志 ---- *)
ExpireWindow ==
    /\ recentlyViewed
    /\ windowAge = WindowSize
    /\ recentlyViewed' = FALSE
    /\ windowAge' = 0
    /\ UNCHANGED <<viewCount>>

Next ==
    \/ ViewArticleFirstTime
    \/ ViewArticleAtCapacity
    \/ RepeatView
    \/ TickWindow
    \/ ExpireWindow

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_vars

(* ==================== 拆解决策（variableCombination > 1000 时必填） ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积：
   4(viewCount 0..3) x 2(recentlyViewed) x 3(windowAge 0..2) = 24
   <= 1000: kept-below-threshold（原子行为粒度，未触及拆解阈值） *)
====
