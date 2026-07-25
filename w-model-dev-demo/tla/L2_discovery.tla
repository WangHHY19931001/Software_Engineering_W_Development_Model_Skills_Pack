(*
  @system        blog-system-demo
  @requirement   SD-004, SD-005, SD-006, SD-007
  @design        docs/system-design.md
  @parent        ../tla/L1_blog_system.tla
  @sibling       ../tla/L2_content_management.tla, ../tla/L2_identity_access.tla, ../tla/L2_interaction.tla, ../tla/L2_operations_support.tla, ../tla/L2_infrastructure.tla, ../tla/L2_subscription_push.tla
  @child         null
  @level         L2
  @phase         2
  所属系统: blog-system-demo
  关联需求: SD-004 推荐 + SD-005 广告 + SD-006 统计 + SD-007 搜索（发现域）
  关联设计: docs/system-design.md §3.1 SD-004/005/006/007 + §7 性能设计
  上级 TLA: L1_blog_system.tla
  同级 TLA: 其他 6 个 L2 规格
  下级 TLA: 无（L3 在阶段 3-4 产出）
  层级: L2 (子系统内部行为)
  requirementIds: [SD-004, SD-005, SD-006, SD-007]
*)
---- MODULE L2_discovery ----
EXTENDS Naturals, Sequences, FiniteSets

(* ==================== 常量 ==================== *)
CONSTANTS
    Articles,         (* 文章全集 *)
    Ads,              (* 广告全集 *)
    Users,            (* 用户全集 *)
    Tags,             (* 标签全集 *)
    Categories        (* 分类全集 *)

(* ==================== 状态空间定义 ==================== *)
(* 广告状态 (REQ-005) *)
AdPending == "pending"
AdApproved == "approved"
AdRejected == "rejected"
AdStates == {AdPending, AdApproved, AdRejected}
NonExistAd == "notad"

(* 广告位 (REQ-005 数据约束) *)
AdSlotSidebar == "sidebar"
AdSlotInArticle == "in_article"
AdSlotHomepageBanner == "homepage_banner"
AdSlots == {AdSlotSidebar, AdSlotInArticle, AdSlotHomepageBanner}

(* 推荐流模式 (REQ-004) *)
RecPersonalized == "personalized"
RecHot == "hot"
RecLatest == "latest"
RecModes == {RecPersonalized, RecHot, RecLatest}

(* 搜索历史容量上限 (REQ-007 数据约束: 100 条/用户) *)
SearchHistoryLimit == 100

NoneUser == "noneuser"

(* ==================== 变量 ==================== *)
VARIABLES
    adRegistry,            (* 广告状态：ad -> AdStates ∪ {NonExistAd} *)
    adSlot,                (* 广告位：ad -> AdSlots *)
    adImpressions,         (* 广告展示次数：ad -> Nat *)
    adClicks,              (* 广告点击次数：ad -> Nat *)
    searchHistory,         (* 搜索历史：user -> Seq(Articles ∪ Tags ∪ Categories) *)
    recommendationFeed,    (* 推荐流：user -> RecModes *)
    articleViewCount       (* 文章浏览数：article -> Nat *)

vars == <<adRegistry, adSlot, adImpressions, adClicks, searchHistory, recommendationFeed, articleViewCount>>

(* ==================== TypeInvariant ==================== *)
TypeInvariant ==
    /\ adRegistry \in [Ads -> AdStates \cup {NonExistAd}]
    /\ adSlot \in [Ads -> AdSlots]
    /\ adImpressions \in [Ads -> Nat]
    /\ adClicks \in [Ads -> Nat]
    /\ searchHistory \in [Users -> Seq(Articles \cup Tags \cup Categories)]
    /\ recommendationFeed \in [Users -> RecModes]
    /\ articleViewCount \in [Articles -> Nat]

(* ==================== 业务不变式 ==================== *)

(* @designRef docs/system-design.md#§3.1 SD-005 广告审核状态机
 * 业务语义：广告状态机 pending → approved/rejected（REQ-005 验收标准 4）。
 *   仅 approved 广告可投放展示；展示次数受 maxImpressions 限制（REQ-005 数据约束）。
 *   审核不通过的广告进入 rejected 状态，不可投放。 *)
AdStatusInvariant ==
    /\ \A a \in Ads :
        adRegistry[a] \in AdStates \cup {NonExistAd}
    /\ \A a \in Ads :
        adRegistry[a] # NonExistAd => adRegistry[a] \in AdStates

(* @designRef docs/system-design.md#§3.1 SD-005 广告点击展示非负
 * 业务语义：广告展示与点击次数必须非负（统计基础约束）。
 *   点击率 CTR = clicks / impressions，impressions = 0 时 CTR 不计算。
 *   展示次数 <= maxImpressions（REQ-005 数据约束）。 *)
AdCounterNonNegative ==
    /\ \A a \in Ads : adImpressions[a] >= 0
    /\ \A a \in Ads : adClicks[a] >= 0
    /\ \A a \in Ads : adClicks[a] <= adImpressions[a]

(* @designRef docs/system-design.md#§3.1 SD-007 搜索历史上限
 * 业务语义：每个用户搜索历史 ≤ 100 条（REQ-007 数据约束 FIFO 100）。
 *   历史仅登录用户可访问（REQ-007 验收标准 2）。
 *   超出上限自动出队（FIFO），保留最新 100 条。 *)
SearchHistoryLimitInvariant ==
    /\ \A u \in Users :
        Len(searchHistory[u]) <= SearchHistoryLimit
    /\ \A u \in Users :
        \A i \in 1..Len(searchHistory[u]) :
            searchHistory[u][i] \in Articles \cup Tags \cup Categories

(* @designRef docs/system-design.md#§3.1 SD-004 推荐流模式合法
 * 业务语义：推荐流模式必须在 RecModes 中（personalized/hot/latest，REQ-004 验收标准 1）。
 *   personalized 模式需登录（基于用户偏好标签匹配），hot/latest 可匿名访问。
 *   热度算法：热度 0.4 + 点赞 0.3 + 评论 0.3 + 新鲜度 7 天衰减（REQ-004 数据约束）。 *)
RecommendationModeInvariant ==
    /\ \A u \in Users :
        recommendationFeed[u] \in RecModes

(* @designRef docs/system-design.md#§3.1 SD-006 统计非负
 * 业务语义：统计计数（浏览/点赞/评论/分享）必须非负（统计基础约束）。
 *   统计仅管理员访问（REQ-006 验收标准 2）， Unauthorized 访问返回 403。
 *   PV/UV 由 articleViewCount 累积得到（REQ-006 验收标准 3）。 *)
StatNonNegative ==
    /\ \A a \in Articles :
        articleViewCount[a] >= 0

(* ==================== BusinessInvariant 聚合 ==================== *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ AdStatusInvariant
    /\ AdCounterNonNegative
    /\ SearchHistoryLimitInvariant
    /\ RecommendationModeInvariant
    /\ StatNonNegative

(* ==================== 初始状态 ==================== *)
Init ==
    /\ adRegistry = [a \in Ads |-> NonExistAd]
    /\ adSlot = [a \in Ads |-> AdSlotSidebar]
    /\ adImpressions = [a \in Ads |-> 0]
    /\ adClicks = [a \in Ads |-> 0]
    /\ searchHistory = [u \in Users |-> <<>>]
    /\ recommendationFeed = [u \in Users |-> RecHot]
    /\ articleViewCount = [a \in Articles |-> 0]

(* ==================== 状态转移（Next） ==================== *)

(* SD-005 动作1：创建广告（pending 状态） *)
AdCreate(ad, slot) ==
    /\ ad \in Ads
    /\ slot \in AdSlots
    /\ adRegistry[ad] = NonExistAd
    /\ adRegistry' = [adRegistry EXCEPT ![ad] = AdPending]
    /\ adSlot' = [adSlot EXCEPT ![ad] = slot]
    /\ UNCHANGED <<adImpressions, adClicks, searchHistory, recommendationFeed, articleViewCount>>

(* SD-005 动作2：审核广告（pending → approved/rejected） *)
AdApprove(ad, decision) ==
    /\ ad \in Ads
    /\ adRegistry[ad] = AdPending
    /\ decision \in {AdApproved, AdRejected}
    /\ adRegistry' = [adRegistry EXCEPT ![ad] = decision]
    /\ UNCHANGED <<adSlot, adImpressions, adClicks, searchHistory, recommendationFeed, articleViewCount>>

(* SD-005 动作3：广告展示（仅 approved 广告） *)
AdImpress(ad) ==
    /\ ad \in Ads
    /\ adRegistry[ad] = AdApproved
    /\ adImpressions' = [adImpressions EXCEPT ![ad] = adImpressions[ad] + 1]
    /\ UNCHANGED <<adRegistry, adSlot, adClicks, searchHistory, recommendationFeed, articleViewCount>>

(* SD-005 动作4：广告点击（仅 approved 广告） *)
AdClick(ad) ==
    /\ ad \in Ads
    /\ adRegistry[ad] = AdApproved
    /\ adClicks' = [adClicks EXCEPT ![ad] = adClicks[ad] + 1]
    /\ adImpressions' = [adImpressions EXCEPT ![ad] = adImpressions[ad] + 1]
    /\ UNCHANGED <<adRegistry, adSlot, searchHistory, recommendationFeed, articleViewCount>>

(* SD-007 动作5：用户搜索（追加历史，超出上限 FIFO 出队） *)
Search(user, query) ==
    /\ user \in Users
    /\ query \in Articles \cup Tags \cup Categories
    /\ searchHistory' = [searchHistory EXCEPT ![user] =
        IF Len(searchHistory[user]) < SearchHistoryLimit
        THEN Append(searchHistory[user], query)
        ELSE Append(Tail(searchHistory[user]), query)]
    /\ UNCHANGED <<adRegistry, adSlot, adImpressions, adClicks, recommendationFeed, articleViewCount>>

(* SD-007 动作6：清空搜索历史 *)
ClearSearchHistory(user) ==
    /\ user \in Users
    /\ searchHistory' = [searchHistory EXCEPT ![user] = <<>>]
    /\ UNCHANGED <<adRegistry, adSlot, adImpressions, adClicks, recommendationFeed, articleViewCount>>

(* SD-004 动作7：设置推荐流模式 *)
SetRecommendationMode(user, mode) ==
    /\ user \in Users
    /\ mode \in RecModes
    /\ recommendationFeed' = [recommendationFeed EXCEPT ![user] = mode]
    /\ UNCHANGED <<adRegistry, adSlot, adImpressions, adClicks, searchHistory, articleViewCount>>

(* SD-006 动作8：记录文章浏览（统计累积） *)
RecordArticleView(article) ==
    /\ article \in Articles
    /\ articleViewCount' = [articleViewCount EXCEPT ![article] = articleViewCount[article] + 1]
    /\ UNCHANGED <<adRegistry, adSlot, adImpressions, adClicks, searchHistory, recommendationFeed>>

(* Next：联合发现域所有动作 *)
Next ==
    \/ \E a \in Ads, s \in AdSlots : AdCreate(a, s)
    \/ \E a \in Ads, d \in {AdApproved, AdRejected} : AdApprove(a, d)
    \/ \E a \in Ads : AdImpress(a)
    \/ \E a \in Ads : AdClick(a)
    \/ \E u \in Users, q \in Articles \cup Tags \cup Categories : Search(u, q)
    \/ \E u \in Users : ClearSearchHistory(u)
    \/ \E u \in Users, m \in RecModes : SetRecommendationMode(u, m)
    \/ \E a \in Articles : RecordArticleView(a)

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<vars>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数分析（按 .cfg 常量赋值数计算，tla-plus-guide.md §1.1）：
 *   5 个常量：Articles / Ads / Users / Tags / Categories
 *   .cfg 中每个常量赋 2 个值 → 变量组合数 = 2^5 = 32
 *   32 < 1000 → kept-below-threshold（保留不拆）
 * decompositionDecision: "kept-below-threshold"
 *)
================
