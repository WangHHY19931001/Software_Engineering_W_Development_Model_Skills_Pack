(*
  @system        blog-system::discovery
  @requirement   REQ-013, REQ-017, REQ-020, SD-010, SD-013, SD-015
  @design        docs/phase2-design/blog-system-system-design.md:§3
  @designIds     SD-010,SD-013,SD-015
  @parent        ../../../tla/specs/level1/L1_BlogSystem.tla
  @sibling       ../../../tla/specs/level2/L2_BlogSystemAuth.tla, ../../../tla/specs/level2/L2_BlogSystemContent.tla, ../../../tla/specs/level2/L2_BlogSystemEngagement.tla, ../../../tla/specs/level2/L2_BlogSystemOps.tla, ../../../tla/specs/level2/L2_BlogSystemInfra.tla
  @child         null
  @level         L2
  @phase         2
*)
---- MODULE L2_BlogSystemDiscovery ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 建模层次说明 ==================== *)
(* L2 粒度 = 子系统内部行为（设计级建模），与 L1 的粒度差异： *)
(*   - L1（L1_BlogSystem）：整体系统状态机，以请求-响应类别抽象全部 22 个 REQ。 *)
(*   - L2（本规格）：发现子系统内部状态机。基于系统设计文档 §3 模块划分，建模 *)
(*     M-010 搜索服务（关键词搜索标题/内容/标签、分页元数据，REQ-013）、 *)
(*     M-013 订阅服务（订阅/退订幂等、订阅者接收文章更新，REQ-017）、 *)
(*     M-015 RSS 服务（系统级/博主级 RSS 订阅源 XML 生成，REQ-020）。 *)
(*   - L3/L4：原子化子系统行为（分页游标、RSS XML 字段细节），由阶段 3/4 承担。 *)

(* ==================== 变量 ==================== *)
VARIABLES
    searchDone,         \* M-010 搜索执行是否完成（REQ-013 AC1/AC2）
    searchHit,          \* M-010 搜索是否命中（TRUE=命中列表 / FALSE=空列表）
    keywordValid,       \* M-010 关键词非空校验（REQ-013 AC3：空关键词 → 400，不执行搜索）
    subscription,       \* M-013 订阅关系：none 未订阅 / active 已订阅（REQ-017 AC1/AC3）
    subscriberUpdated,  \* M-013 订阅者是否已接收博主文章更新（REQ-017 AC1）
    rssGenerated,       \* M-015 RSS 订阅源是否已生成（REQ-020 AC1/AC2）
    rssValid            \* M-015 生成结果是否合法（REQ-020 AC1/AC2：XML 合法可解析 / 空源同样合法）

(* ==================== 取值域 ==================== *)
SUBSCRIPTION_STATES == {"none", "active"}

(* ==================== 状态不变式（TypeInvariant） ==================== *)
TypeInvariant ==
    /\ searchDone \in BOOLEAN
    /\ searchHit \in BOOLEAN
    /\ keywordValid \in BOOLEAN
    /\ subscription \in SUBSCRIPTION_STATES
    /\ subscriberUpdated \in BOOLEAN
    /\ rssGenerated \in BOOLEAN
    /\ rssValid \in BOOLEAN

(* ==================== 业务不变式 ==================== *)
\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-010 搜索服务，REQ-013 AC3)
\* 搜索执行完成要求关键词非空（空关键词 → 400，不产出搜索结果）
SearchRequiresKeyword ==
    searchDone => keywordValid

\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-013 订阅服务，REQ-017 AC1)
\* 仅已订阅的订阅者接收博主文章更新（订阅关系是更新投递的前提）
SubscriptionActiveRequiredForUpdates ==
    subscriberUpdated => (subscription = "active")

\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-015 RSS 服务，REQ-020 AC1/AC2)
\* 生成的 RSS 订阅源必为合法 XML（空源同样合法可解析；不存在 → 404 由 L1 表达）
RssAlwaysValid ==
    rssGenerated => rssValid

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合所有子不变式；.cfg 的 INVARIANTS 列表须与此展开集合一致（tla-plus-guide.md §11） *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ SearchRequiresKeyword
    /\ SubscriptionActiveRequiredForUpdates
    /\ RssAlwaysValid

(* ==================== 初始状态 ==================== *)
(* 系统空闲：无搜索、无订阅、无 RSS 源（keywordValid 初始为 TRUE，等待首个搜索请求） *)
Init ==
    /\ searchDone = FALSE
    /\ searchHit = FALSE
    /\ keywordValid = TRUE
    /\ subscription = "none"
    /\ subscriberUpdated = FALSE
    /\ rssGenerated = FALSE
    /\ rssValid = FALSE

(* ==================== 状态转移（Next） ==================== *)
(* 转移分支忠实于系统设计文档 §3 模块职责与需求 AC；不允许占位/简化/错误实现（反模式 #16） *)

(* ---- M-010 搜索服务（REQ-013） ---- *)

\* REQ-013 AC3：新搜索请求携带关键词并复位上次搜索结果（空关键词 → 400，不产出新结果）
SubmitKeyword ==
    /\ keywordValid' \in BOOLEAN
    /\ searchDone' = FALSE
    /\ UNCHANGED <<searchHit, subscription, subscriberUpdated, rssGenerated, rssValid>>

\* REQ-013 AC1/AC2：关键词非空 → 执行搜索（命中 → 结果列表 / 无命中 → 空列表，均 200）
SearchExecute ==
    /\ keywordValid = TRUE
    /\ searchDone' = TRUE
    /\ searchHit' \in BOOLEAN
    /\ UNCHANGED <<keywordValid, subscription, subscriberUpdated, rssGenerated, rssValid>>

(* ---- M-013 订阅服务（REQ-017） ---- *)

\* REQ-017 AC1/AC2：订阅博主（重复订阅幂等 → 200；订阅不存在博主 → 404 由 L1 表达）
Subscribe ==
    /\ subscription = "none"
    /\ subscription' = "active"
    /\ UNCHANGED <<searchDone, searchHit, keywordValid, subscriberUpdated, rssGenerated, rssValid>>

\* REQ-017 AC3：退订 → 订阅关系解除，更新投递标记复位（不再接收博主文章更新）
Unsubscribe ==
    /\ subscription = "active"
    /\ subscription' = "none"
    /\ subscriberUpdated' = FALSE
    /\ UNCHANGED <<searchDone, searchHit, keywordValid, rssGenerated, rssValid>>

\* REQ-017 AC1：订阅者接收博主文章更新（post.published 事件经 M-021 事件总线投递，由 infra 子系统建模总线）
ReceiveArticleUpdate ==
    /\ subscription = "active"
    /\ subscriberUpdated' = TRUE
    /\ UNCHANGED <<searchDone, searchHit, keywordValid, subscription, rssGenerated, rssValid>>

(* ---- M-015 RSS 服务（REQ-020） ---- *)

\* REQ-020 AC1/AC2：生成 RSS 订阅源（有文章 → 合法 XML；无文章 → 合法空源；均 rssValid=TRUE）
GenerateRss ==
    /\ rssGenerated = FALSE
    /\ rssGenerated' = TRUE
    /\ rssValid' = TRUE
    /\ UNCHANGED <<searchDone, searchHit, keywordValid, subscription, subscriberUpdated>>

Next ==
    \/ SubmitKeyword
    \/ SearchExecute
    \/ Subscribe
    \/ Unsubscribe
    \/ ReceiveArticleUpdate
    \/ GenerateRss

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<searchDone, searchHit, keywordValid, subscription, subscriberUpdated, rssGenerated, rssValid>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积 = 2^7 = 128 *)
(* 128 ≤ 1000 → decompositionDecision = "kept-below-threshold"（契约指定值） *)
(* 保留理由：发现子系统 7 个布尔/双值状态对应搜索/订阅/RSS 三个模块的强制语义， *)
(*   组合数远低于拆解阈值；细粒度拆解（分页游标、RSS XML 字段）由阶段 3/4 的 L3/L4 承担 *)
================
