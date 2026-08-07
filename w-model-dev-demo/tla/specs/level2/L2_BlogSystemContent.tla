(*
  @system        blog-system::content_subsystem
  @requirement   SD-002, REQ-011, REQ-012, REQ-013, REQ-014, REQ-015, REQ-016
  @design        docs/phase2-design/blog-system-system-design.md:§3.2
  @designIds     SD-002
  @parent        ../tla/specs/level1/L1_BlogSystem.tla
  @sibling       ../tla/specs/level2/L2_BlogSystemAuth.tla, ../tla/specs/level2/L2_BlogSystemInteraction.tla, ../tla/specs/level2/L2_BlogSystemDiscovery.tla, ../tla/specs/level2/L2_BlogSystemAnalytics.tla, ../tla/specs/level2/L2_BlogSystemIntegration.tla, ../tla/specs/level2/L2_BlogSystemInfrastructure.tla
  @child         ../tla/specs/level3/L3_BlogSystemArticleState.tla
  @level         L2
  @phase         2
*)
---- MODULE L2_BlogSystemContent ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    MaxCategoryDepth    \* 分类嵌套最大深度（REQ-016：深度 ≤3 层，超深 400）

ASSUME MaxCategoryDepth > 0

(* ==================== 变量 ==================== *)
VARIABLES
    articleState,        \* 文章生命周期：none / draft / published / archived（REQ-011~013）
    hasPublished,        \* 是否曾发布（REQ-013/014：已发布不可删除、仅可归档）
    creatorIsBlogger,    \* 创建/发布者是否博主（REQ-009/011：非博主 403）
    tagCount,            \* 标签创建计数（0/1：名称唯一，重名 409——REQ-015）
    categoryDepth        \* 分类嵌套深度（1..MaxCategoryDepth——REQ-016）

vars == <<articleState, hasPublished, creatorIsBlogger, tagCount, categoryDepth>>

(* ==================== 状态不变式（TypeOK） ==================== *)
\* Invariant: 全部状态变量的类型约束
\* @designRef docs/phase2-design/blog-system-system-design.md:§3.2
TypeOK ==
    /\ articleState \in {"none", "draft", "published", "archived"}
    /\ hasPublished \in BOOLEAN
    /\ creatorIsBlogger \in BOOLEAN
    /\ tagCount \in 0..1
    /\ categoryDepth \in 1..MaxCategoryDepth

(* ==================== 业务不变式 ==================== *)
\* Invariant: 归档必曾发布（状态机 draft→published→archived，已归档不可直接发布——REQ-013）
\* @designRef docs/phase2-design/blog-system-system-design.md:§4 INTF-006/INTF-007
ArchivedRequiresPublishedHistory ==
    articleState = "archived" => hasPublished

\* Invariant: 曾发布必由博主操作（发布权限校验：非博主 403——REQ-009/REQ-011）
\* @designRef docs/phase2-design/blog-system-system-design.md:§4 INTF-005/INTF-006
PublishedRequiresBloggerCreator ==
    hasPublished => creatorIsBlogger

\* Invariant: 文章不存在必从未发布（已发布仅可归档、不可删除——REQ-013/REQ-014）
\* @designRef docs/phase2-design/blog-system-system-design.md:§4 INTF-008
DeletionOnlyForUnpublished ==
    articleState = "none" => ~hasPublished

\* Invariant: 标签名称唯一（重名创建被拒——REQ-015）
\* @designRef docs/phase2-design/blog-system-system-design.md:§4 INTF-009
TagUniqueCreation ==
    tagCount <= 1

\* Invariant: 分类嵌套深度不超过上限（超深创建被拒——REQ-016）
\* @designRef docs/phase2-design/blog-system-system-design.md:§4 INTF-010
CategoryDepthAtMostMax ==
    categoryDepth <= MaxCategoryDepth

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合全部子不变式（含 TypeOK）；.cfg 的 INVARIANTS 列表须与此展开集合一致 *)
BusinessInvariant ==
    /\ TypeOK
    /\ ArchivedRequiresPublishedHistory
    /\ PublishedRequiresBloggerCreator
    /\ DeletionOnlyForUnpublished
    /\ TagUniqueCreation
    /\ CategoryDepthAtMostMax

(* ==================== 初始状态 ==================== *)
Init ==
    /\ articleState = "none"
    /\ hasPublished = FALSE
    /\ creatorIsBlogger = FALSE
    /\ tagCount = 0
    /\ categoryDepth = 1

(* ==================== 状态转移（Next） ==================== *)
(* ---- 文章状态机：draft -> published -> archived ---- *)
(* SD-001 联动：博主认证完成（非博主创建/发布动作被拒 403——REQ-009/REQ-011） *)
BecomeBlogger ==
    /\ creatorIsBlogger = FALSE
    /\ creatorIsBlogger' = TRUE
    /\ UNCHANGED <<articleState, hasPublished, tagCount, categoryDepth>>

(* REQ-011：创建文章 -> draft（201；非博主 403） *)
CreateDraft ==
    /\ articleState = "none"
    /\ creatorIsBlogger
    /\ articleState' = "draft"
    /\ UNCHANGED <<hasPublished, creatorIsBlogger, tagCount, categoryDepth>>

(* REQ-012：发布草稿 -> published，读者可见（200） *)
PublishArticle ==
    /\ articleState = "draft"
    /\ creatorIsBlogger
    /\ articleState' = "published"
    /\ hasPublished' = TRUE
    /\ UNCHANGED <<creatorIsBlogger, tagCount, categoryDepth>>

(* REQ-012/REQ-014：已发布文章更新后需重新发布（回 draft） *)
EditPublishedArticle ==
    /\ articleState = "published"
    /\ articleState' = "draft"
    /\ UNCHANGED <<hasPublished, creatorIsBlogger, tagCount, categoryDepth>>

(* REQ-013：归档 -> archived（仅已发布可归档） *)
ArchiveArticle ==
    /\ articleState = "published"
    /\ articleState' = "archived"
    /\ UNCHANGED <<hasPublished, creatorIsBlogger, tagCount, categoryDepth>>

(* REQ-013：取消归档回 draft（archived 不可直接发布，需先取消归档） *)
UnarchiveArticle ==
    /\ articleState = "archived"
    /\ articleState' = "draft"
    /\ UNCHANGED <<hasPublished, creatorIsBlogger, tagCount, categoryDepth>>

(* REQ-014：删除草稿 -> 204（已发布不可删，仅可归档——由 ~hasPublished 守卫保证） *)
DeleteDraft ==
    /\ articleState = "draft"
    /\ ~hasPublished    \* REQ-014/INTF-008：已发布（含曾发布）仅可归档不可删除
    /\ articleState' = "none"
    /\ UNCHANGED <<hasPublished, creatorIsBlogger, tagCount, categoryDepth>>

(* REQ-015：创建名称唯一标签（重名 409 被拒） *)
CreateTag ==
    /\ tagCount = 0
    /\ tagCount' = 1
    /\ UNCHANGED <<articleState, hasPublished, creatorIsBlogger, categoryDepth>>

(* REQ-016：创建嵌套分类（深度 ≤ MaxCategoryDepth，超深 400 被拒） *)
CreateCategory ==
    /\ categoryDepth < MaxCategoryDepth
    /\ categoryDepth' = categoryDepth + 1
    /\ UNCHANGED <<articleState, hasPublished, creatorIsBlogger, tagCount>>

Next ==
    \/ BecomeBlogger
    \/ CreateDraft
    \/ PublishArticle
    \/ EditPublishedArticle
    \/ ArchiveArticle
    \/ UnarchiveArticle
    \/ DeleteDraft
    \/ CreateTag
    \/ CreateCategory

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_vars

(* ==================== 拆解决策（variableCombination > 1000 时必填） ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积：
   4(articleState) x 2(hasPublished) x 2(creatorIsBlogger)
   x 2(tagCount) x 3(categoryDepth 1..3) = 96
   <= 1000: kept-below-threshold（子系统粒度，未触及拆解阈值） *)
====
