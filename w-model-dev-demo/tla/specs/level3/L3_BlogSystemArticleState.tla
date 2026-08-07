(*
  @system        blog-system::content_subsystem::article_state_machine
  @requirement   SD-002, REQ-011, REQ-012, REQ-013, REQ-014
  @design        docs/phase3-outline/blog-system-interface-design.md:§2.5
  @designIds     SD-002
  @parent        ../tla/specs/level2/L2_BlogSystemContent.tla
  @sibling       ../tla/specs/level3/L3_BlogSystemAuthFlow.tla, ../tla/specs/level3/L3_BlogSystemCommentFlow.tla, ../tla/specs/level3/L3_BlogSystemRateLimit.tla, ../tla/specs/level3/L3_BlogSystemWebhookRetry.tla, ../tla/specs/level3/L3_BlogSystemReadingDedup.tla
  @child         ../tla/specs/level4/L4_BlogSystemArticleStore.tla
  @level         L3
  @phase         3
*)
---- MODULE L3_BlogSystemArticleState ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    ArticleIds    \* 文章 ID 域（INTF-005：article store 主键；两篇示例文章验证独立原子状态）

ASSUME ArticleIds # {}

(* ==================== 变量 ==================== *)
VARIABLES
    articleState,    \* 每篇文章生命周期：none / draft / published / archived（REQ-011~013）
    hasPublished,    \* 每篇是否曾发布（REQ-013/014：已发布不可删除、仅可归档）
    isBlogger        \* 当前操作者是否博主（REQ-011：非博主创建/发布 40301）

vars == <<articleState, hasPublished, isBlogger>>

(* ==================== 状态不变式（TypeOK） ==================== *)
\* Invariant: 全部状态变量的类型约束（文章状态机四态 x 每篇发布历史 x 博主身份）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§2.5
TypeOK ==
    /\ articleState \in [ArticleIds -> {"none", "draft", "published", "archived"}]
    /\ hasPublished \in [ArticleIds -> BOOLEAN]
    /\ isBlogger \in BOOLEAN

(* ==================== 业务不变式 ==================== *)
\* Invariant: 归档必曾发布（状态机 draft→published→archived，不存在 draft→archived 直跳——REQ-013/INTF-007 60001）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§2.7
ArchivedRequiresPublishedHistory ==
    \A a \in ArticleIds : articleState[a] = "archived" => hasPublished[a]

\* Invariant: published 态必曾发布（发布动作置 hasPublished——REQ-012/INTF-006）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§2.6
PublishedStateRequiresHistory ==
    \A a \in ArticleIds : articleState[a] = "published" => hasPublished[a]

\* Invariant: 未发布过的文章绝不处于 published/archived（删除仅限未发布草稿；published/archived 删除 60001——REQ-013/014/INTF-008）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§2.8
NeverPublishedOnlyDraftOrNone ==
    \A a \in ArticleIds : ~hasPublished[a] => articleState[a] \in {"none", "draft"}

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合全部子不变式（含 TypeOK）；.cfg 的 INVARIANTS 列表须与此展开集合一致 *)
BusinessInvariant ==
    /\ TypeOK
    /\ ArchivedRequiresPublishedHistory
    /\ PublishedStateRequiresHistory
    /\ NeverPublishedOnlyDraftOrNone

(* ==================== 初始状态 ==================== *)
Init ==
    /\ articleState = [a \in ArticleIds |-> "none"]
    /\ hasPublished = [a \in ArticleIds |-> FALSE]
    /\ isBlogger = FALSE

(* ==================== 状态转移（Next，原子操作） ==================== *)
(* ---- 身份上下文：博主认证完成（非博主创建/发布被拒 40301——REQ-009/REQ-011） ---- *)
BecomeBlogger ==
    /\ isBlogger = FALSE
    /\ isBlogger' = TRUE
    /\ UNCHANGED <<articleState, hasPublished>>

(* ---- INTF-005：创建文章 -> draft（201；作者须 role=blogger 否则 40301） ---- *)
CreateDraft ==
    /\ \E a \in ArticleIds : articleState[a] = "none"
    /\ isBlogger
    /\ articleState' = [a \in ArticleIds |-> IF articleState[a] = "none" THEN "draft" ELSE articleState[a]]
    /\ UNCHANGED <<hasPublished, isBlogger>>

(* ---- INTF-006：发布草稿 draft -> published，读者可见（200；archived->published 直跳 60001 由无此转移保证） ---- *)
PublishArticle ==
    /\ \E a \in ArticleIds : articleState[a] = "draft"
    /\ isBlogger
    /\ articleState' = [a \in ArticleIds |-> IF articleState[a] = "draft" THEN "published" ELSE articleState[a]]
    /\ hasPublished' = [a \in ArticleIds |-> IF articleState[a] = "draft" THEN TRUE ELSE hasPublished[a]]
    /\ UNCHANGED <<isBlogger>>

(* ---- INTF-008：编辑已发布文章后状态置回 draft（须重新发布——REQ-012/REQ-014） ---- *)
EditPublishedArticle ==
    /\ \E a \in ArticleIds : articleState[a] = "published"
    /\ articleState' = [a \in ArticleIds |-> IF articleState[a] = "published" THEN "draft" ELSE articleState[a]]
    /\ UNCHANGED <<hasPublished, isBlogger>>

(* ---- INTF-007：归档 published -> archived（仅已发布可归档；draft->archived 60001 由无此转移保证） ---- *)
ArchiveArticle ==
    /\ \E a \in ArticleIds : articleState[a] = "published"
    /\ articleState' = [a \in ArticleIds |-> IF articleState[a] = "published" THEN "archived" ELSE articleState[a]]
    /\ UNCHANGED <<hasPublished, isBlogger>>

(* ---- INTF-007：取消归档 archived -> draft（archived 不可直接发布，须先 unarchive 回 draft——REQ-013） ---- *)
UnarchiveArticle ==
    /\ \E a \in ArticleIds : articleState[a] = "archived"
    /\ articleState' = [a \in ArticleIds |-> IF articleState[a] = "archived" THEN "draft" ELSE articleState[a]]
    /\ UNCHANGED <<hasPublished, isBlogger>>

(* ---- INTF-008：删除草稿 -> none（204；已发布/曾发布仅可归档不可删除——REQ-014/INTF-008 60001） ---- *)
DeleteDraft ==
    /\ \E a \in ArticleIds : articleState[a] = "draft" /\ ~hasPublished[a]
    /\ articleState' = [a \in ArticleIds |-> IF articleState[a] = "draft" /\ ~hasPublished[a] THEN "none" ELSE articleState[a]]
    /\ UNCHANGED <<hasPublished, isBlogger>>

Next ==
    \/ BecomeBlogger
    \/ CreateDraft
    \/ PublishArticle
    \/ EditPublishedArticle
    \/ ArchiveArticle
    \/ UnarchiveArticle
    \/ DeleteDraft

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_vars

(* ==================== 拆解决策（variableCombination > 1000 时必填） ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积：
   4^2(articleState，2 篇文章) x 2^2(hasPublished) x 2(isBlogger) = 128
   <= 1000: kept-below-threshold（原子行为粒度，未触及拆解阈值） *)
====
