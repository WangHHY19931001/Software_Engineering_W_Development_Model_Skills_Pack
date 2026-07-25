(*
  @system        blog-system-demo
  @requirement   SD-012
  @design        docs/detailed-design.md
  @parent        ../tla/L3_article_lifecycle.tla
  @sibling       null
  @child         null
  @level         L4
  @phase         4
  所属系统: blog-system-demo
  关联需求: SD-012 多博文（文章状态机完整原子行为）
  关联设计: docs/detailed-design.md §3.12 SD-012 + docs/interface-design.md INTF-012
  上级 TLA: L3_article_lifecycle.tla
  同级 TLA: 无（L4 最细粒度原子行为规格，单一职责）
  下级 TLA: 无（L4 为叶子规格）
  层级: L4 (最细粒度原子行为)
  requirementIds: [SD-012]
*)
---- MODULE L4_article_state_machine ----
EXTENDS Naturals, Sequences, FiniteSets

(* ==================== 常量 ==================== *)
CONSTANTS
    Articles,       (* 文章全集 *)
    Bloggers,       (* 博主全集（作者） *)
    Admins          (* 管理员全集（批量操作权限） *)

(* ==================== 状态空间定义 ==================== *)
(* 文章状态机：draft → pending_review → published → offline → archived (REQ-012 验收标准 2)
   禁止逆向跳转（archived 不可回到 published）
   L4 在 L3 基础上细化：所有状态转移的守卫条件 + 不变式完整化 *)
ArticleDraft == "draft"
ArticlePendingReview == "pending_review"
ArticlePublished == "published"
ArticleOffline == "offline"
ArticleArchived == "archived"
ArticleStates == {ArticleDraft, ArticlePendingReview, ArticlePublished, ArticleOffline, ArticleArchived}
NonExistArticle == "notexist"

(* 定时发布调度状态 *)
ScheduleNone == "schedule_none"
SchedulePending == "schedule_pending"
ScheduleFired == "schedule_fired"
ScheduleStates == {ScheduleNone, SchedulePending, ScheduleFired}

(* 操作者类型 *)
OpBlogger == "blogger"
OpAdmin == "admin"
OpTypes == {OpBlogger, OpAdmin}

NoneBlogger == "noneblogger"
NoneAdmin == "noneadmin"

(* ==================== 变量 ==================== *)
VARIABLES
    articleState,           (* 文章状态：article -> ArticleStates ∪ {NonExistArticle} *)
    articleAuthor,          (* 文章作者：article -> Bloggers ∪ {NoneBlogger} *)
    publishSchedule,        (* 定时发布调度：article -> ScheduleStates ∪ {ScheduleNone} *)
    publishedAt,            (* 发布时间戳：article -> Nat（0 表示未发布） *)
    archivedAt              (* 归档时间戳：article -> Nat（0 表示未归档） *)

vars == <<articleState, articleAuthor, publishSchedule, publishedAt, archivedAt>>

(* ==================== TypeInvariant ==================== *)
TypeInvariant ==
    /\ articleState \in [Articles -> ArticleStates \cup {NonExistArticle}]
    /\ articleAuthor \in [Articles -> Bloggers \cup {NoneBlogger}]
    /\ publishSchedule \in [Articles -> ScheduleStates \cup {ScheduleNone}]
    /\ publishedAt \in [Articles -> Nat]
    /\ archivedAt \in [Articles -> Nat]

(* ==================== 业务不变式 ==================== *)

(* @designRef docs/detailed-design.md#§3.12 SD-012 文章状态机合法转移
 * 业务语义：状态机合法转移集合（REQ-012 验收标准 2）：
 *   draft → pending_review (SubmitForReview)
 *   pending_review → published (PublishArticle / FireScheduledPublish)
 *   pending_review → schedule_pending (SchedulePublish)
 *   published → offline (OfflineArticle / BatchOffline)
 *   offline → archived (ArchiveArticle)
 *   offline → published (RepublishArticle，仅未归档可重新上线)
 *   禁止：archived → 任何状态（软删除不可恢复，REQ-012 验收标准 6）
 *   禁止：published → draft（不可回退到草稿） *)
ValidTransitions ==
    /\ \A a \in Articles :
        articleState[a] = ArticleDraft =>
            articleState'[a] \in {ArticlePendingReview, ArticleDraft, NonExistArticle}
    /\ \A a \in Articles :
        articleState[a] = ArticlePendingReview =>
            articleState'[a] \in {ArticlePublished, ArticlePendingReview, NonExistArticle}
    /\ \A a \in Articles :
        articleState[a] = ArticlePublished =>
            articleState'[a] \in {ArticleOffline, ArticlePublished, NonExistArticle}
    /\ \A a \in Articles :
        articleState[a] = ArticleOffline =>
            articleState'[a] \in {ArticleArchived, ArticlePublished, ArticleOffline, NonExistArticle}
    /\ \A a \in Articles :
        articleState[a] = ArticleArchived =>
            articleState'[a] \in {ArticleArchived, NonExistArticle}

ArticleStateMachineInvariant ==
    /\ \A a \in Articles :
        articleState[a] \in ArticleStates \cup {NonExistArticle}
    /\ \A a \in Articles :
        articleState[a] = NonExistArticle => articleAuthor[a] = NoneBlogger
    /\ \A a \in Articles :
        articleState[a] = ArticleArchived => archivedAt[a] > 0
    /\ \A a \in Articles :
        articleState[a] = ArticlePublished => publishedAt[a] > 0

(* @designRef docs/detailed-design.md#§3.12 SD-012 作者绑定单一性
 * 业务语义：已注册文章必有合法作者（REQ-012 验收标准 1）。
 *   博主仅能编辑自己文章，权限隔离由 articleAuthor 单一性保证（REQ-002 验收标准 5）。 *)
ArticleAuthorInvariant ==
    /\ \A a \in Articles :
        articleState[a] # NonExistArticle => articleAuthor[a] \in Bloggers
    /\ \A a \in Articles :
        articleState[a] = NonExistArticle => articleAuthor[a] = NoneBlogger

(* @designRef docs/detailed-design.md#§3.12 SD-012 定时发布调度守卫
 * 业务语义：定时发布仅在 pending_review 状态生效（REQ-012 验收标准 3/4）。
 *   schedule_pending 必须对应 pending_review；published 后调度必须 fired 或 none。 *)
ScheduleGuardInvariant ==
    /\ \A a \in Articles :
        publishSchedule[a] = SchedulePending =>
            articleState[a] = ArticlePendingReview
    /\ \A a \in Articles :
        articleState[a] \in {ArticlePublished, ArticleOffline, ArticleArchived} =>
            publishSchedule[a] \in {ScheduleNone, ScheduleFired}
    /\ \A a \in Articles :
        articleState[a] = ArticleDraft =>
            publishSchedule[a] = ScheduleNone

(* @designRef docs/detailed-design.md#§3.12 SD-012 归档不可恢复
 * 业务语义：archived 状态为终态（REQ-012 验收标准 6 软删除），
 *   任何状态转移动作不得将 archived 文章变为其他状态。 *)
ArchiveFinalityInvariant ==
    /\ \A a \in Articles :
        articleState[a] = ArticleArchived =>
            articleState'[a] \in {ArticleArchived, NonExistArticle}

(* ==================== BusinessInvariant 聚合 ==================== *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ ArticleStateMachineInvariant
    /\ ArticleAuthorInvariant
    /\ ScheduleGuardInvariant
    /\ ArchiveFinalityInvariant

(* ==================== 初始状态 ==================== *)
Init ==
    /\ articleState = [a \in Articles |-> NonExistArticle]
    /\ articleAuthor = [a \in Articles |-> NoneBlogger]
    /\ publishSchedule = [a \in Articles |-> ScheduleNone]
    /\ publishedAt = [a \in Articles |-> 0]
    /\ archivedAt = [a \in Articles |-> 0]

(* ==================== 状态转移（Next） ==================== *)

(* SD-012 原子动作1：创建文章（draft 状态，绑定作者）
 * 守卫：article 未注册 + author 为合法博主 *)
CreateArticle(article, author) ==
    /\ article \in Articles
    /\ author \in Bloggers
    /\ articleState[article] = NonExistArticle
    /\ articleState' = [articleState EXCEPT ![article] = ArticleDraft]
    /\ articleAuthor' = [articleAuthor EXCEPT ![article] = author]
    /\ publishSchedule' = [publishSchedule EXCEPT ![article] = ScheduleNone]
    /\ publishedAt' = [publishedAt EXCEPT ![article] = 0]
    /\ archivedAt' = [archivedAt EXCEPT ![article] = 0]

(* SD-012 原子动作2：提交审核（draft → pending_review）
 * 守卫：当前为 draft *)
SubmitForReview(article) ==
    /\ article \in Articles
    /\ articleState[article] = ArticleDraft
    /\ articleState' = [articleState EXCEPT ![article] = ArticlePendingReview]
    /\ UNCHANGED <<articleAuthor, publishSchedule, publishedAt, archivedAt>>

(* SD-012 原子动作3：审核通过发布（pending_review → published）
 * 守卫：当前为 pending_review + 调度为 None（无定时） *)
PublishArticle(article) ==
    /\ article \in Articles
    /\ articleState[article] = ArticlePendingReview
    /\ publishSchedule[article] = ScheduleNone
    /\ articleState' = [articleState EXCEPT ![article] = ArticlePublished]
    /\ publishSchedule' = [publishSchedule EXCEPT ![article] = ScheduleFired]
    /\ publishedAt' = [publishedAt EXCEPT ![article] = 1]
    /\ UNCHANGED <<articleAuthor, archivedAt>>

(* SD-012 原子动作4：定时发布调度（pending_review + schedule_pending）
 * 守卫：当前为 pending_review + 调度为 None *)
SchedulePublish(article) ==
    /\ article \in Articles
    /\ articleState[article] = ArticlePendingReview
    /\ publishSchedule[article] = ScheduleNone
    /\ publishSchedule' = [publishSchedule EXCEPT ![article] = SchedulePending]
    /\ UNCHANGED <<articleState, articleAuthor, publishedAt, archivedAt>>

(* SD-012 原子动作5：定时发布触发（schedule_pending → published）
 * 守卫：当前为 pending_review + 调度为 pending *)
FireScheduledPublish(article) ==
    /\ article \in Articles
    /\ articleState[article] = ArticlePendingReview
    /\ publishSchedule[article] = SchedulePending
    /\ articleState' = [articleState EXCEPT ![article] = ArticlePublished]
    /\ publishSchedule' = [publishSchedule EXCEPT ![article] = ScheduleFired]
    /\ publishedAt' = [publishedAt EXCEPT ![article] = 1]
    /\ UNCHANGED <<articleAuthor, archivedAt>>

(* SD-012 原子动作6：下线文章（published → offline）
 * 守卫：当前为 published *)
OfflineArticle(article) ==
    /\ article \in Articles
    /\ articleState[article] = ArticlePublished
    /\ articleState' = [articleState EXCEPT ![article] = ArticleOffline]
    /\ UNCHANGED <<articleAuthor, publishSchedule, publishedAt, archivedAt>>

(* SD-012 原子动作7：归档文章（offline → archived，软删除）
 * 守卫：当前为 offline + 未归档（archivedAt=0） *)
ArchiveArticle(article) ==
    /\ article \in Articles
    /\ articleState[article] = ArticleOffline
    /\ archivedAt[article] = 0
    /\ articleState' = [articleState EXCEPT ![article] = ArticleArchived]
    /\ archivedAt' = [archivedAt EXCEPT ![article] = 1]
    /\ UNCHANGED <<articleAuthor, publishSchedule, publishedAt>>

(* SD-012 原子动作8：重新上线（offline → published，仅未归档可重新上线）
 * 守卫：当前为 offline + archivedAt=0（未归档） *)
RepublishArticle(article) ==
    /\ article \in Articles
    /\ articleState[article] = ArticleOffline
    /\ archivedAt[article] = 0
    /\ articleState' = [articleState EXCEPT ![article] = ArticlePublished]
    /\ UNCHANGED <<articleAuthor, publishSchedule, publishedAt, archivedAt>>

(* SD-012 原子动作9：管理员批量下架（published → offline，批量）
 * 守卫：operator 为 admin + 所有 article 当前为 published *)
BatchOffline(operator, articleSet) ==
    /\ operator \in Admins
    /\ articleSet \subseteq Articles
    /\ \A a \in articleSet : articleState[a] = ArticlePublished
    /\ articleState' = [a \in Articles |->
        IF a \in articleSet THEN ArticleOffline ELSE articleState[a]]
    /\ UNCHANGED <<articleAuthor, publishSchedule, publishedAt, archivedAt>>

(* SD-012 原子动作10：管理员批量归档（offline → archived，批量）
 * 守卫：operator 为 admin + 所有 article 当前为 offline + 未归档 *)
BatchArchive(operator, articleSet) ==
    /\ operator \in Admins
    /\ articleSet \subseteq Articles
    /\ \A a \in articleSet : articleState[a] = ArticleOffline
    /\ \A a \in articleSet : archivedAt[a] = 0
    /\ articleState' = [a \in Articles |->
        IF a \in articleSet THEN ArticleArchived ELSE articleState[a]]
    /\ archivedAt' = [a \in Articles |->
        IF a \in articleSet THEN 1 ELSE archivedAt[a]]
    /\ UNCHANGED <<articleAuthor, publishSchedule, publishedAt>>

(* Next：联合文章状态机所有原子动作 *)
Next ==
    \/ \E a \in Articles, b \in Bloggers : CreateArticle(a, b)
    \/ \E a \in Articles : SubmitForReview(a)
    \/ \E a \in Articles : PublishArticle(a)
    \/ \E a \in Articles : SchedulePublish(a)
    \/ \E a \in Articles : FireScheduledPublish(a)
    \/ \E a \in Articles : OfflineArticle(a)
    \/ \E a \in Articles : ArchiveArticle(a)
    \/ \E a \in Articles : RepublishArticle(a)
    \/ \E op \in Admins, s \in SUBSET Articles : BatchOffline(op, s)
    \/ \E op \in Admins, s \in SUBSET Articles : BatchArchive(op, s)

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<vars>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数分析（按 .cfg 常量赋值数计算，tla-plus-guide.md §1.1）：
 *   3 个常量：Articles / Bloggers / Admins
 *   .cfg 中每个常量赋 2 个值 → 变量组合数 = 2^3 = 8
 *   8 < 1000 → kept-below-threshold（保留不拆）
 * decompositionDecision: "kept-below-threshold"
 * L4 在 L3 基础上细化：增加 publishedAt/archivedAt 时间戳 + 批量操作 + 守卫条件完整化
 *)
================
