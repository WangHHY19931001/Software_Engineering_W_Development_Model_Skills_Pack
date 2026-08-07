(*
  @system        blog-system::discovery_subsystem
  @requirement   SD-004, REQ-021, REQ-022, REQ-023
  @design        docs/phase2-design/blog-system-system-design.md:§3.2
  @designIds     SD-004
  @parent        ../tla/specs/level1/L1_BlogSystem.tla
  @sibling       ../tla/specs/level2/L2_BlogSystemAuth.tla, ../tla/specs/level2/L2_BlogSystemContent.tla, ../tla/specs/level2/L2_BlogSystemInteraction.tla, ../tla/specs/level2/L2_BlogSystemAnalytics.tla, ../tla/specs/level2/L2_BlogSystemIntegration.tla, ../tla/specs/level2/L2_BlogSystemInfrastructure.tla
  @child         null
  @level         L2
  @phase         2
*)
---- MODULE L2_BlogSystemDiscovery ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    TopNDefault    \* 热门文章 Top N 上限（REQ-021：默认 10，小模型取 2）

ASSUME TopNDefault > 0

(* ==================== 变量 ==================== *)
VARIABLES
    statsSnapshot,         \* 阅读统计数据快照：none / stale / fresh（消费 SD-005，REQ-024）
    hotListState,          \* 热门列表状态：none / computed（REQ-021）
    hotTopN,               \* 热门列表条目数 limit（1..TopNDefault，REQ-021）
    recommendMode,         \* 推荐模式：cold_start / personalized（REQ-022）
    tagPreferenceKnown,    \* 读者标签偏好数据是否可用（REQ-022）
    searchIndexVersion,    \* 四字段搜索索引：0 未构建 / 1 已构建（REQ-023）
    searchResultsReady     \* 全文搜索是否已返回过结果（REQ-023）

vars == <<statsSnapshot, hotListState, hotTopN, recommendMode,
          tagPreferenceKnown, searchIndexVersion, searchResultsReady>>

(* ==================== 状态不变式（TypeOK） ==================== *)
\* Invariant: 全部状态变量的类型约束
\* @designRef docs/phase2-design/blog-system-system-design.md:§3.2
TypeOK ==
    /\ statsSnapshot \in {"none", "stale", "fresh"}
    /\ hotListState \in {"none", "computed"}
    /\ hotTopN \in 1..TopNDefault
    /\ recommendMode \in {"cold_start", "personalized"}
    /\ tagPreferenceKnown \in BOOLEAN
    /\ searchIndexVersion \in 0..1
    /\ searchResultsReady \in BOOLEAN

(* ==================== 业务不变式 ==================== *)
\* Invariant: 热门列表必基于新鲜阅读统计（REQ-021 depends-on REQ-024，7 天窗口）
\* @designRef docs/phase2-design/blog-system-system-design.md:§3.3 SD-004 -> SD-005
HotListRequiresFreshStats ==
    hotListState = "computed" => statsSnapshot = "fresh"

\* Invariant: 个性化推荐必已有标签偏好数据（REQ-022 标签偏好推荐）
\* @designRef docs/phase2-design/blog-system-system-design.md:§4 INTF-016
PersonalizedRequiresPreference ==
    recommendMode = "personalized" => tagPreferenceKnown

\* Invariant: 无标签偏好时回退热门（冷启动回退热门——REQ-022）
\* @designRef docs/phase2-design/blog-system-system-design.md:§3.1 SD-004 职责
ColdStartFallsBackToHot ==
    ~tagPreferenceKnown => recommendMode = "cold_start"

\* Invariant: 搜索结果必已构建四字段索引（标题+正文+摘要+标签——REQ-023）
\* @designRef docs/phase2-design/blog-system-system-design.md:§3.2 SearchIndex 四字段
SearchRequiresIndex ==
    searchResultsReady => searchIndexVersion = 1

\* Invariant: 热门列表条目数不超过 Top N 上限（REQ-021：7 天阅读量降序 Top N）
\* @designRef docs/phase2-design/blog-system-system-design.md:§4 INTF-015
HotTopNBounded ==
    hotTopN <= TopNDefault

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合全部子不变式（含 TypeOK）；.cfg 的 INVARIANTS 列表须与此展开集合一致 *)
BusinessInvariant ==
    /\ TypeOK
    /\ HotListRequiresFreshStats
    /\ PersonalizedRequiresPreference
    /\ ColdStartFallsBackToHot
    /\ SearchRequiresIndex
    /\ HotTopNBounded

(* ==================== 初始状态 ==================== *)
Init ==
    /\ statsSnapshot = "none"
    /\ hotListState = "none"
    /\ hotTopN = 1
    /\ recommendMode = "cold_start"
    /\ tagPreferenceKnown = FALSE
    /\ searchIndexVersion = 0
    /\ searchResultsReady = FALSE

(* ==================== 状态转移（Next） ==================== *)
(* ---- 热门（REQ-021）：消费 SD-005 阅读统计，统计失效热门作废 ---- *)
RefreshStats ==
    /\ statsSnapshot \in {"none", "stale"}
    /\ statsSnapshot' = "fresh"
    /\ UNCHANGED <<hotListState, hotTopN, recommendMode, tagPreferenceKnown,
                   searchIndexVersion, searchResultsReady>>

InvalidateStats ==
    /\ statsSnapshot = "fresh"
    /\ statsSnapshot' = "stale"
    /\ hotListState' = "none"
    /\ UNCHANGED <<hotTopN, recommendMode, tagPreferenceKnown,
                   searchIndexVersion, searchResultsReady>>

ComputeHotList ==
    /\ statsSnapshot = "fresh"
    /\ hotListState = "none"
    /\ hotListState' = "computed"
    /\ UNCHANGED <<statsSnapshot, hotTopN, recommendMode, tagPreferenceKnown,
                   searchIndexVersion, searchResultsReady>>

(* REQ-021：GET limit 参数（默认 TopNDefault，可调小） *)
SetHotLimit ==
    /\ hotTopN' \in 1..TopNDefault
    /\ UNCHANGED <<statsSnapshot, hotListState, recommendMode, tagPreferenceKnown,
                   searchIndexVersion, searchResultsReady>>

(* ---- 推荐（REQ-022）：标签偏好 -> 个性化；无偏好冷启动回退热门 ---- *)
LearnPreference ==
    /\ tagPreferenceKnown = FALSE
    /\ tagPreferenceKnown' = TRUE
    /\ UNCHANGED <<statsSnapshot, hotListState, hotTopN, recommendMode,
                   searchIndexVersion, searchResultsReady>>

RecommendPersonalized ==
    /\ tagPreferenceKnown
    /\ recommendMode = "cold_start"
    /\ recommendMode' = "personalized"
    /\ UNCHANGED <<statsSnapshot, hotListState, hotTopN, tagPreferenceKnown,
                   searchIndexVersion, searchResultsReady>>

(* ---- 全文搜索（REQ-023）：四字段索引 + 分页相关性 ---- *)
IndexSearch ==
    /\ searchIndexVersion = 0
    /\ searchIndexVersion' = 1
    /\ UNCHANGED <<statsSnapshot, hotListState, hotTopN, recommendMode,
                   tagPreferenceKnown, searchResultsReady>>

SearchQuery ==
    /\ searchIndexVersion = 1
    /\ searchResultsReady = FALSE
    /\ searchResultsReady' = TRUE
    /\ UNCHANGED <<statsSnapshot, hotListState, hotTopN, recommendMode,
                   tagPreferenceKnown, searchIndexVersion>>

Next ==
    \/ RefreshStats
    \/ InvalidateStats
    \/ ComputeHotList
    \/ SetHotLimit
    \/ LearnPreference
    \/ RecommendPersonalized
    \/ IndexSearch
    \/ SearchQuery

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_vars

(* ==================== 拆解决策（variableCombination > 1000 时必填） ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积：
   3(statsSnapshot) x 2(hotListState) x 2(hotTopN) x 2(recommendMode)
   x 2(tagPreferenceKnown) x 2(searchIndexVersion) x 2(searchResultsReady) = 192
   <= 1000: kept-below-threshold（子系统粒度，未触及拆解阈值） *)
====
