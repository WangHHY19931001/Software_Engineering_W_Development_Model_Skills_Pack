(*
  @system        blog-system::content
  @requirement   REQ-004, REQ-005, REQ-006, REQ-007, REQ-011, REQ-012, SD-003, SD-004, SD-008, SD-009
  @design        docs/phase2-design/blog-system-system-design.md:§3
  @designIds     SD-003,SD-004,SD-008,SD-009
  @parent        ../../../tla/specs/level1/L1_BlogSystem.tla
  @sibling       ../../../tla/specs/level2/L2_BlogSystemAuth.tla, ../../../tla/specs/level2/L2_BlogSystemEngagement.tla, ../../../tla/specs/level2/L2_BlogSystemDiscovery.tla, ../../../tla/specs/level2/L2_BlogSystemOps.tla, ../../../tla/specs/level2/L2_BlogSystemInfra.tla
  @child         null
  @level         L2
  @phase         2
*)
---- MODULE L2_BlogSystemContent ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 建模层次说明 ==================== *)
(* L2 粒度 = 子系统内部行为（设计级建模），与 L1 的粒度差异： *)
(*   - L1（L1_BlogSystem）：整体系统状态机，以请求-响应类别抽象全部 22 个 REQ。 *)
(*   - L2（本规格）：内容子系统内部状态机。基于系统设计文档 §3 模块划分，建模 *)
(*     M-003 博主子系统（身份开通/关注/粉丝计数幂等，REQ-004/REQ-005）、 *)
(*     M-004 文章管理服务（CRUD、draft/published 状态流转、依赖博主/标签/分类，REQ-006/REQ-007）、 *)
(*     M-008 标签服务（创建/查询/删除、引用保护，REQ-011）、 *)
(*     M-009 分类服务（创建/查询/更新/删除、父子层级、含文章删除保护，REQ-012）。 *)
(*   - L3/L4：原子化子系统行为（文章字段级约束、标签/分类层级树细节），由阶段 3/4 承担。 *)

(* ==================== 变量 ==================== *)
VARIABLES
    bloggerState,       \* M-003 博主身份：none 未开通 / open 已开通（REQ-004 AC1/AC2）
    followerCount,      \* M-003 粉丝计数（REQ-005 AC1/AC2：关注 +1 幂等 / 取关 -1）
    articleState,       \* M-004 文章状态：none 无文章 / draft 草稿 / published 已发布（REQ-006/REQ-007）
    tagState,           \* M-008 标签状态：none 无 / created 已创建 / deleted 已删除（REQ-011）
    tagReferenced,      \* M-008 标签是否被文章引用（REQ-011 AC3：被引用标签删除 → 409 保护）
    categoryState,      \* M-009 分类状态：none 无 / created 已创建 / deleted 已删除（REQ-012）
    categoryHasArticles \* M-009 分类是否含文章（REQ-012 AC2：含文章分类删除 → 409 保护）

(* ==================== 取值域 ==================== *)
BLOGGER_STATES == {"none", "open"}

ARTICLE_STATES == {"none", "draft", "published"}

TAXONOMY_STATES == {"none", "created", "deleted"}

(* ==================== 状态不变式（TypeInvariant） ==================== *)
TypeInvariant ==
    /\ bloggerState \in BLOGGER_STATES
    /\ followerCount \in 0..2
    /\ articleState \in ARTICLE_STATES
    /\ tagState \in TAXONOMY_STATES
    /\ tagReferenced \in BOOLEAN
    /\ categoryState \in TAXONOMY_STATES
    /\ categoryHasArticles \in BOOLEAN

(* ==================== 业务不变式 ==================== *)
\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-004 文章管理服务，REQ-006 AC1 / REQ-007 AC2)
\* 文章发布要求博主身份已开通（M-004 依赖 M-003；访客/普通用户无文章管理权）
PublishedRequiresBlogger ==
    (articleState = "published") => (bloggerState = "open")

\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-003 博主子系统，REQ-005 AC1/AC2)
\* 粉丝计数恒为非负（关注 +1 / 取关 -1，无负值状态）
FollowerCountNonNegative ==
    followerCount >= 0

\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-008 标签服务，REQ-011 AC3)
\* 被文章引用的标签不可删除（先解绑后删除，违反 → 409）
ReferencedTagNotDeleted ==
    tagReferenced => (tagState # "deleted")

\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-009 分类服务，REQ-012 AC2)
\* 含文章的分类不可删除（删除保护，违反 → 409）
CategoryWithArticlesNotDeleted ==
    categoryHasArticles => (categoryState # "deleted")

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合所有子不变式；.cfg 的 INVARIANTS 列表须与此展开集合一致（tla-plus-guide.md §11） *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ PublishedRequiresBlogger
    /\ FollowerCountNonNegative
    /\ ReferencedTagNotDeleted
    /\ CategoryWithArticlesNotDeleted

(* ==================== 初始状态 ==================== *)
(* 系统空闲：无博主身份、无粉丝、无文章、无标签/分类 *)
Init ==
    /\ bloggerState = "none"
    /\ followerCount = 0
    /\ articleState = "none"
    /\ tagState = "none"
    /\ tagReferenced = FALSE
    /\ categoryState = "none"
    /\ categoryHasArticles = FALSE

(* ==================== 状态转移（Next） ==================== *)
(* 转移分支忠实于系统设计文档 §3 模块职责与需求 AC；不允许占位/简化/错误实现（反模式 #16） *)

(* ---- M-003 博主子系统（REQ-004 身份开通 / REQ-005 关注与粉丝） ---- *)

\* REQ-004 AC1：认证用户开通博主身份（重复开通 → 409 由 L1 请求层表达）
OpenBlogger ==
    /\ bloggerState = "none"
    /\ bloggerState' = "open"
    /\ UNCHANGED <<followerCount, articleState, tagState, tagReferenced, categoryState, categoryHasArticles>>

\* REQ-005 AC1：关注博主粉丝数 +1，重复关注幂等（计数不变）；模型以取值集合表达两种结果
Follow ==
    /\ bloggerState = "open"
    /\ followerCount < 2
    /\ followerCount' \in {followerCount, followerCount + 1}
    /\ UNCHANGED <<bloggerState, articleState, tagState, tagReferenced, categoryState, categoryHasArticles>>

\* REQ-005 AC2：取关粉丝数 -1（有粉丝才可取关）
Unfollow ==
    /\ bloggerState = "open"
    /\ followerCount > 0
    /\ followerCount' = followerCount - 1
    /\ UNCHANGED <<bloggerState, articleState, tagState, tagReferenced, categoryState, categoryHasArticles>>

(* ---- M-004 文章管理服务（REQ-006 CRUD / REQ-007 草稿发布流转） ---- *)

\* REQ-006 AC1：博主创建文章 → 草稿态（M-004 依赖 M-003 博主身份）
CreateArticle ==
    /\ bloggerState = "open"
    /\ articleState = "none"
    /\ articleState' = "draft"
    /\ UNCHANGED <<bloggerState, followerCount, tagState, tagReferenced, categoryState, categoryHasArticles>>

\* REQ-007 AC2：发布 → published（公开列表可见）
PublishArticle ==
    /\ articleState = "draft"
    /\ articleState' = "published"
    /\ UNCHANGED <<bloggerState, followerCount, tagState, tagReferenced, categoryState, categoryHasArticles>>

\* REQ-007 AC1：draft/published 双向流转（保存回草稿 → 公开列表不可见）
UnpublishArticle ==
    /\ articleState = "published"
    /\ articleState' = "draft"
    /\ UNCHANGED <<bloggerState, followerCount, tagState, tagReferenced, categoryState, categoryHasArticles>>

\* REQ-006 AC1/AC3：删除文章（draft/published 均可删；不存在 → 404 由 L1 表达）
DeleteArticle ==
    /\ articleState \in {"draft", "published"}
    /\ articleState' = "none"
    /\ UNCHANGED <<bloggerState, followerCount, tagState, tagReferenced, categoryState, categoryHasArticles>>

(* ---- M-008 标签服务（REQ-011） ---- *)

\* REQ-011 AC1：创建标签（重复 → 409 由 L1 表达）
CreateTag ==
    /\ tagState = "none"
    /\ tagState' = "created"
    /\ UNCHANGED <<bloggerState, followerCount, articleState, tagReferenced, categoryState, categoryHasArticles>>

\* REQ-011 AC3：文章关联标签（引用后受删除保护）
ReferenceTag ==
    /\ tagState = "created"
    /\ tagReferenced' = TRUE
    /\ UNCHANGED <<bloggerState, followerCount, articleState, tagState, categoryState, categoryHasArticles>>

\* REQ-011 AC3：解绑标签引用（先解绑后删除）
UnreferenceTag ==
    /\ tagReferenced' = FALSE
    /\ UNCHANGED <<bloggerState, followerCount, articleState, tagState, categoryState, categoryHasArticles>>

\* REQ-011 AC3：删除未被引用的标签（被引用 → 409 保护，由不变式 ReferencedTagNotDeleted 守护）
DeleteTag ==
    /\ tagState = "created"
    /\ tagReferenced = FALSE
    /\ tagState' = "deleted"
    /\ UNCHANGED <<bloggerState, followerCount, articleState, tagReferenced, categoryState, categoryHasArticles>>

(* ---- M-009 分类服务（REQ-012） ---- *)

\* REQ-012 AC1：创建分类（父子层级字段细节由 L3/L4 承担）
CreateCategory ==
    /\ categoryState = "none"
    /\ categoryState' = "created"
    /\ UNCHANGED <<bloggerState, followerCount, articleState, tagState, tagReferenced, categoryHasArticles>>

\* REQ-012 AC2：分类关联文章（关联后受删除保护）
AddArticleToCategory ==
    /\ categoryState = "created"
    /\ categoryHasArticles' = TRUE
    /\ UNCHANGED <<bloggerState, followerCount, articleState, tagState, tagReferenced, categoryState>>

\* REQ-012 AC2：从分类移除文章（解除保护后可删除分类）
RemoveArticleFromCategory ==
    /\ categoryHasArticles' = FALSE
    /\ UNCHANGED <<bloggerState, followerCount, articleState, tagState, tagReferenced, categoryState>>

\* REQ-012 AC2：删除不含文章的分类（含文章 → 409 保护，由不变式 CategoryWithArticlesNotDeleted 守护）
DeleteCategory ==
    /\ categoryState = "created"
    /\ categoryHasArticles = FALSE
    /\ categoryState' = "deleted"
    /\ UNCHANGED <<bloggerState, followerCount, articleState, tagState, tagReferenced, categoryHasArticles>>

Next ==
    \/ OpenBlogger
    \/ Follow
    \/ Unfollow
    \/ CreateArticle
    \/ PublishArticle
    \/ UnpublishArticle
    \/ DeleteArticle
    \/ CreateTag
    \/ ReferenceTag
    \/ UnreferenceTag
    \/ DeleteTag
    \/ CreateCategory
    \/ AddArticleToCategory
    \/ RemoveArticleFromCategory
    \/ DeleteCategory

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<bloggerState, followerCount, articleState, tagState, tagReferenced, categoryState, categoryHasArticles>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积
   = |BLOGGER_STATES|2 × |followerCount|3 × |ARTICLE_STATES|3 × |TAXONOMY_STATES|3
     × |tagReferenced|2 × |TAXONOMY_STATES|3 × |categoryHasArticles|2
   = 2 × 3 × 3 × 3 × 2 × 3 × 2 = 648 *)
(* 648 ≤ 1000 → decompositionDecision = "kept-below-threshold"（契约指定值） *)
(* 保留理由：内容子系统 7 个变量分别对应博主/文章/标签/分类四个模块的强制状态， *)
(*   均为设计文档 §3 模块职责与需求 AC 的强制语义，无法在不省略关键状态的前提下缩减； *)
(*   细粒度拆解（标签/分类层级树、文章字段级约束）由阶段 3/4 的 L3/L4 承担 *)
================
