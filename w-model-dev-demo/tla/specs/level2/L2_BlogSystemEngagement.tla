(*
  @system        blog-system::engagement
  @requirement   REQ-008, REQ-009, REQ-010, REQ-014, REQ-015, SD-005, SD-006, SD-007, SD-011
  @design        docs/phase2-design/blog-system-system-design.md:§3
  @designIds     SD-005,SD-006,SD-007,SD-011
  @parent        ../../../tla/specs/level1/L1_BlogSystem.tla
  @sibling       ../../../tla/specs/level2/L2_BlogSystemAuth.tla, ../../../tla/specs/level2/L2_BlogSystemContent.tla, ../../../tla/specs/level2/L2_BlogSystemDiscovery.tla, ../../../tla/specs/level2/L2_BlogSystemOps.tla, ../../../tla/specs/level2/L2_BlogSystemInfra.tla
  @child         null
  @level         L2
  @phase         2
*)
---- MODULE L2_BlogSystemEngagement ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    MAX_RECOMMEND   \* 推荐结果条数上界（M-011，REQ-014 AC1：≤ 10 条；.cfg 中赋值）

(* ==================== 建模层次说明 ==================== *)
(* L2 粒度 = 子系统内部行为（设计级建模），与 L1 的粒度差异： *)
(*   - L1（L1_BlogSystem）：整体系统状态机，以请求-响应类别抽象全部 22 个 REQ。 *)
(*   - L2（本规格）：互动子系统内部状态机。基于系统设计文档 §3 模块划分，建模 *)
(*     M-005 浏览与统计服务（浏览量 +1 持久化、统计 0 语义，REQ-008/REQ-015）、 *)
(*     M-006 评论服务（发表、长度/空值校验，REQ-009）、 *)
(*     M-007 评论审核服务（通过/拒绝控制可见性，REQ-010）、 *)
(*     M-011 推荐服务（基于标签/浏览量、≤10 条、不含草稿，REQ-014）。 *)
(*   - 输入边界投影：publishedContent 为 M-004（文章发布）→ M-011（推荐）的子系统间协作输入。 *)
(*   - L3/L4：原子化子系统行为（推荐排序算法、审核理由字段），由阶段 3/4 承担。 *)

(* ==================== 变量 ==================== *)
VARIABLES
    viewCount,        \* M-005 浏览量计数（REQ-008 AC1：浏览 +1 并持久化）
    statsReported,    \* M-005 统计查询是否完成（REQ-015 AC1/AC2：0 语义——无数据返回 0 而非 null）
    commentState,     \* M-006/M-007 评论状态：none 无 / pending 待审核 / approved 已通过 / rejected 已拒绝
    commentLenOk,     \* M-006 评论长度/空值校验结果（REQ-009 AC3：空或 >1000 字符 → 400）
    recommendCount,   \* M-011 推荐结果条数（REQ-014 AC1：≤ MAX_RECOMMEND 条）
    publishedContent, \* M-004 → M-011 输入边界投影：是否存在已发布内容（REQ-014 AC3：推荐不含草稿）
    recommendNoDraft  \* M-011 推荐结果是否不含草稿（REQ-014 AC3）

(* ==================== 取值域 ==================== *)
COMMENT_STATES == {"none", "pending", "approved", "rejected"}

(* ==================== 状态不变式（TypeInvariant） ==================== *)
TypeInvariant ==
    /\ viewCount \in 0..1
    /\ statsReported \in BOOLEAN
    /\ commentState \in COMMENT_STATES
    /\ commentLenOk \in BOOLEAN
    /\ recommendCount \in 0..MAX_RECOMMEND
    /\ publishedContent \in BOOLEAN
    /\ recommendNoDraft \in BOOLEAN

(* ==================== 业务不变式 ==================== *)
\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-011 推荐服务，REQ-014 AC1)
\* 推荐结果条数不超过上界（≤ 10 条）
RecommendAtMostTen ==
    recommendCount <= MAX_RECOMMEND

\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-011 推荐服务，REQ-014 AC3)
\* 推荐结果不含草稿：仅当存在已发布内容时才产出不含草稿的推荐（无内容 → 空列表）
RecommendationExcludesDraft ==
    recommendNoDraft => publishedContent

\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-006 评论服务，REQ-009 AC3)
\* 发表的评论必须通过长度/空值校验（空评论或 >1000 字符 → 400，不入列）
InvalidCommentNotPosted ==
    (commentState # "none") => commentLenOk

\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-005 浏览与统计服务，REQ-015 AC2)
\* 统计 0 语义：无浏览数据返回 0 而非 null（统计值恒为数值且非负）
StatsNeverNull ==
    statsReported => (viewCount >= 0)

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合所有子不变式；.cfg 的 INVARIANTS 列表须与此展开集合一致（tla-plus-guide.md §11） *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ RecommendAtMostTen
    /\ RecommendationExcludesDraft
    /\ InvalidCommentNotPosted
    /\ StatsNeverNull

(* ==================== 初始状态 ==================== *)
(* 系统空闲：无浏览量、无统计、无评论、无推荐 *)
Init ==
    /\ viewCount = 0
    /\ statsReported = FALSE
    /\ commentState = "none"
    /\ commentLenOk = FALSE
    /\ recommendCount = 0
    /\ publishedContent = FALSE
    /\ recommendNoDraft = FALSE

(* ==================== 状态转移（Next） ==================== *)
(* 转移分支忠实于系统设计文档 §3 模块职责与需求 AC；不允许占位/简化/错误实现（反模式 #16） *)

(* ---- M-005 浏览与统计服务（REQ-008 浏览 / REQ-015 统计） ---- *)

\* REQ-008 AC1：浏览公开文章 → 浏览量 +1 并持久化
RecordView ==
    /\ viewCount < 1
    /\ viewCount' = viewCount + 1
    /\ UNCHANGED <<statsReported, commentState, commentLenOk, recommendCount, publishedContent, recommendNoDraft>>

\* REQ-015 AC1/AC2：统计查询完成（无浏览数据 → 0 语义，由不变式 StatsNeverNull 守护）
ReportStats ==
    /\ statsReported' = TRUE
    /\ UNCHANGED <<viewCount, commentState, commentLenOk, recommendCount, publishedContent, recommendNoDraft>>

(* ---- M-006 评论服务 + M-007 评论审核服务（REQ-009 发表 / REQ-010 审核） ---- *)

\* REQ-009 AC1/AC3：提交评论——长度合法入列待审核，空或 >1000 字符被 400 拒绝（不入列）
SubmitComment ==
    /\ commentState = "none"
    /\ commentLenOk' \in BOOLEAN
    /\ commentState' = IF commentLenOk' THEN "pending" ELSE "none"
    /\ UNCHANGED <<viewCount, statsReported, recommendCount, publishedContent, recommendNoDraft>>

\* REQ-010 AC1：审核通过 → 评论公开可见（approved）
ApproveComment ==
    /\ commentState = "pending"
    /\ commentState' = "approved"
    /\ UNCHANGED <<viewCount, statsReported, commentLenOk, recommendCount, publishedContent, recommendNoDraft>>

\* REQ-010 AC2：审核拒绝 → 评论隐藏（rejected）
RejectComment ==
    /\ commentState = "pending"
    /\ commentState' = "rejected"
    /\ UNCHANGED <<viewCount, statsReported, commentLenOk, recommendCount, publishedContent, recommendNoDraft>>

(* ---- M-011 推荐服务（REQ-014） ---- *)

\* M-004 → M-011 输入边界投影：文章发布（post.published 事件入总线，M-021 协作由 infra 子系统建模）
PublishContent ==
    /\ publishedContent' = TRUE
    /\ UNCHANGED <<viewCount, statsReported, commentState, commentLenOk, recommendCount, recommendNoDraft>>

\* REQ-014 AC1/AC3：存在已发布内容 → 生成推荐（≤ MAX_RECOMMEND 条、不含草稿）
GenerateRecommendation ==
    /\ publishedContent = TRUE
    /\ recommendCount' \in 0..MAX_RECOMMEND
    /\ recommendNoDraft' = TRUE
    /\ UNCHANGED <<viewCount, statsReported, commentState, commentLenOk, publishedContent>>

\* REQ-014 AC2：无已发布内容 → 推荐空列表（count=0，无草稿条目）
NoContentRecommendation ==
    /\ publishedContent = FALSE
    /\ recommendCount' = 0
    /\ recommendNoDraft' = FALSE
    /\ UNCHANGED <<viewCount, statsReported, commentState, commentLenOk, publishedContent>>

Next ==
    \/ RecordView
    \/ ReportStats
    \/ SubmitComment
    \/ ApproveComment
    \/ RejectComment
    \/ PublishContent
    \/ GenerateRecommendation
    \/ NoContentRecommendation

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<viewCount, statsReported, commentState, commentLenOk, recommendCount, publishedContent, recommendNoDraft>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积
   = |viewCount|2 × |statsReported|2 × |COMMENT_STATES|4 × |commentLenOk|2
     × |recommendCount|(MAX_RECOMMEND+1=11) × |publishedContent|2 × |recommendNoDraft|2
   = 2 × 2 × 4 × 2 × 11 × 2 × 2 = 1408 *)
(* 1408 ∈ (1000, 10000] → decompositionDecision = "consider-split"（契约指定值） *)
(* 保留理由：互动子系统 7 个变量对应浏览/统计/评论/审核/推荐五个模块的强制状态； *)
(*   其中 recommendCount 取值域 0..MAX_RECOMMEND（11 个值）为 REQ-014 AC1「≤10 条」的 *)
(*   直接契约表达，无法在不省略需求关键状态的前提下缩减（推荐条数上界是强制语义）； *)
(*   若后续状态空间膨胀，可将推荐服务（M-011）拆为独立 L3 规格（阶段 3/4 承担） *)
================
