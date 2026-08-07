(*
  @system        blog-system::content_subsystem::article_store
  @requirement   SD-002, REQ-011, REQ-012, REQ-013, REQ-014
  @design        docs/phase4-detailed/blog-system-detailed-design.md:§DD-011
  @designIds     SD-002
  @parent        ../tla/specs/level3/L3_BlogSystemArticleState.tla
  @sibling       ../tla/specs/level4/L4_BlogSystemTokenStore.tla, ../tla/specs/level4/L4_BlogSystemRateLimitWindow.tla, ../tla/specs/level4/L4_BlogSystemAuditLog.tla
  @child         null
  @level         L4
  @phase         4
*)
---- MODULE L4_BlogSystemArticleStore ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    ArticleIds,      \* 文章 ID 域（DD-011 ArticleStore 主键域）
    MaxVersion       \* 记录写版本模型边界（DD-011 store update 原子写：每次写操作版本 +1，饱和于上界）

ASSUME ArticleIds # {} /\ MaxVersion >= 1

(* ==================== 变量 ==================== *)
VARIABLES
    articleStatus,      \* 记录生命周期：none（未落库）/ draft / published / archived（DD-011 状态字段，DD-008 状态机裁决）
    recordVersion,      \* 记录写版本 0..MaxVersion（DD-011 update 原子性：创建=0，每次写操作 +1，饱和于上界）
    hasPublished        \* 记录是否曾发布（DD-007 publishedAt 非空派生；删除仅限未发布草稿——REQ-014）

vars == <<articleStatus, recordVersion, hasPublished>>

(* ==================== 状态不变式（TypeOK） ==================== *)
\* Invariant: 全部状态变量的类型约束（记录四态 x 写版本 x 发布历史）
\* @designRef docs/phase4-detailed/blog-system-detailed-design.md:§DD-011
TypeOK ==
    /\ articleStatus \in [ArticleIds -> {"none", "draft", "published", "archived"}]
    /\ recordVersion \in [ArticleIds -> 0..MaxVersion]
    /\ hasPublished \in [ArticleIds -> BOOLEAN]

(* ==================== 业务不变式 ==================== *)
\* Invariant: 归档记录必曾发布（DD-008 合法迁移表 published --archive--> archived，draft->archived 非法 60001）
\* @designRef docs/phase4-detailed/blog-system-detailed-design.md:§DD-008
ArchivedRequiresPublishedHistory ==
    \A a \in ArticleIds : articleStatus[a] = "archived" => hasPublished[a]

\* Invariant: published 记录必曾发布（DD-007 publishArticle 写 publishedAt 后置——REQ-012）
\* @designRef docs/phase4-detailed/blog-system-detailed-design.md:§DD-007
PublishedRequiresPublishedHistory ==
    \A a \in ArticleIds : articleStatus[a] = "published" => hasPublished[a]

\* Invariant: 未发布过的记录绝不处于 published/archived（DD-007 deleteArticle 仅 draft 可删，published/archived 删除 60001——REQ-014）
\* @designRef docs/phase4-detailed/blog-system-detailed-design.md:§DD-007
NeverPublishedOnlyDraftOrNone ==
    \A a \in ArticleIds : ~hasPublished[a] => articleStatus[a] \in {"none", "draft"}

\* Invariant: 记录写版本不超过模型边界（store 原子写版本单调受控——DD-011）
\* @designRef docs/phase4-detailed/blog-system-detailed-design.md:§DD-011
RecordVersionBounded ==
    \A a \in ArticleIds : recordVersion[a] <= MaxVersion

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合全部子不变式（含 TypeOK）；.cfg 的 INVARIANTS 列表须与此展开集合一致 *)
BusinessInvariant ==
    /\ TypeOK
    /\ ArchivedRequiresPublishedHistory
    /\ PublishedRequiresPublishedHistory
    /\ NeverPublishedOnlyDraftOrNone
    /\ RecordVersionBounded

(* ==================== 初始状态 ==================== *)
Init ==
    /\ articleStatus = [a \in ArticleIds |-> "none"]
    /\ recordVersion = [a \in ArticleIds |-> 0]
    /\ hasPublished = [a \in ArticleIds |-> FALSE]

(* ==================== 状态转移（Next，原子操作） ==================== *)
(* ---- DD-011 create：落库新记录 -> draft（作者 role=blogger 校验在服务层；此处建模 store 写入原子性） ---- *)
StoreCreateRecord ==
    /\ \E a \in ArticleIds : articleStatus[a] = "none"
    /\ articleStatus' = [a \in ArticleIds |-> IF articleStatus[a] = "none" THEN "draft" ELSE articleStatus[a]]
    /\ recordVersion' = [a \in ArticleIds |-> IF articleStatus[a] = "none" THEN 0 ELSE recordVersion[a]]
    /\ UNCHANGED <<hasPublished>>

(* ---- DD-007 publishArticle：draft -> published（写 publishedAt，版本 +1） ---- *)
StorePublishRecord ==
    /\ \E a \in ArticleIds : articleStatus[a] = "draft"
    /\ articleStatus' = [a \in ArticleIds |-> IF articleStatus[a] = "draft" THEN "published" ELSE articleStatus[a]]
    /\ hasPublished' = [a \in ArticleIds |-> IF articleStatus[a] = "draft" THEN TRUE ELSE hasPublished[a]]
    /\ recordVersion' = [a \in ArticleIds |-> IF articleStatus[a] = "draft" /\ recordVersion[a] < MaxVersion THEN recordVersion[a] + 1 ELSE recordVersion[a]]

(* ---- DD-007 updateArticle：编辑已发布记录 published -> draft（置回草稿须重新发布，版本 +1） ---- *)
StoreUpdatePublished ==
    /\ \E a \in ArticleIds : articleStatus[a] = "published"
    /\ articleStatus' = [a \in ArticleIds |-> IF articleStatus[a] = "published" THEN "draft" ELSE articleStatus[a]]
    /\ recordVersion' = [a \in ArticleIds |-> IF articleStatus[a] = "published" /\ recordVersion[a] < MaxVersion THEN recordVersion[a] + 1 ELSE recordVersion[a]]
    /\ UNCHANGED <<hasPublished>>

(* ---- DD-008 合法迁移 draft/archived --update--> draft：编辑草稿/归档记录（内容写，版本 +1） ---- *)
StoreUpdateDraftOrArchived ==
    /\ \E a \in ArticleIds : articleStatus[a] \in {"draft", "archived"}
    /\ articleStatus' = [a \in ArticleIds |-> IF articleStatus[a] \in {"draft", "archived"} THEN "draft" ELSE articleStatus[a]]
    /\ recordVersion' = [a \in ArticleIds |-> IF articleStatus[a] \in {"draft", "archived"} /\ recordVersion[a] < MaxVersion THEN recordVersion[a] + 1 ELSE recordVersion[a]]
    /\ UNCHANGED <<hasPublished>>

(* ---- DD-007 archiveArticle：published -> archived（仅已发布可归档，版本 +1） ---- *)
StoreArchiveRecord ==
    /\ \E a \in ArticleIds : articleStatus[a] = "published"
    /\ articleStatus' = [a \in ArticleIds |-> IF articleStatus[a] = "published" THEN "archived" ELSE articleStatus[a]]
    /\ recordVersion' = [a \in ArticleIds |-> IF articleStatus[a] = "published" /\ recordVersion[a] < MaxVersion THEN recordVersion[a] + 1 ELSE recordVersion[a]]
    /\ UNCHANGED <<hasPublished>>

(* ---- DD-007 unarchiveArticle：archived -> draft（取消归档回草稿，版本 +1） ---- *)
StoreUnarchiveRecord ==
    /\ \E a \in ArticleIds : articleStatus[a] = "archived"
    /\ articleStatus' = [a \in ArticleIds |-> IF articleStatus[a] = "archived" THEN "draft" ELSE articleStatus[a]]
    /\ recordVersion' = [a \in ArticleIds |-> IF articleStatus[a] = "archived" /\ recordVersion[a] < MaxVersion THEN recordVersion[a] + 1 ELSE recordVersion[a]]
    /\ UNCHANGED <<hasPublished>>

(* ---- DD-007 deleteArticle：仅未发布草稿可删（记录移除；published/archived 删除 60001——REQ-014） ---- *)
StoreDeleteRecord ==
    /\ \E a \in ArticleIds : articleStatus[a] = "draft" /\ ~hasPublished[a]
    /\ articleStatus' = [a \in ArticleIds |-> IF articleStatus[a] = "draft" /\ ~hasPublished[a] THEN "none" ELSE articleStatus[a]]
    /\ recordVersion' = [a \in ArticleIds |-> IF articleStatus[a] = "draft" /\ ~hasPublished[a] THEN 0 ELSE recordVersion[a]]
    /\ UNCHANGED <<hasPublished>>

Next ==
    \/ StoreCreateRecord
    \/ StorePublishRecord
    \/ StoreUpdatePublished
    \/ StoreUpdateDraftOrArchived
    \/ StoreArchiveRecord
    \/ StoreUnarchiveRecord
    \/ StoreDeleteRecord

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_vars

(* ==================== 拆解决策（variableCombination > 1000 时必填） ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积：
   4^2(articleStatus，2 篇文章) x 3^2(recordVersion 0..2) x 2^2(hasPublished) = 576
   <= 1000: kept-below-threshold（原子行为粒度，未触及拆解阈值） *)
====
