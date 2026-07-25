(*
  @system        blog-system-demo
  @requirement   SD-012
  @design        docs/system-design.md
  @parent        ../tla/L2_content_management.tla
  @sibling       null
  @child         ../tla/L4_article_state_machine.tla
  @level         L3
  @phase         3
  所属系统: blog-system-demo
  关联需求: SD-012 多博文（文章状态机原子行为）
  关联设计: docs/system-design.md §3.1 SD-012 文章状态机 + docs/interface-design.md INTF-012
  上级 TLA: L2_content_management.tla
  同级 TLA: 无（L3 原子行为规格，单一职责）
  下级 TLA: 无（L3 为叶子规格）
  层级: L3 (原子化子系统行为)
  requirementIds: [SD-012]
*)
---- MODULE L3_article_lifecycle ----
EXTENDS Naturals, Sequences, FiniteSets

(* ==================== 常量 ==================== *)
CONSTANTS
    Articles,       (* 文章全集 *)
    Bloggers        (* 博主全集（作者） *)

(* ==================== 状态空间定义 ==================== *)
(* 文章状态机：draft → pending_review → published → offline → archived (REQ-012 验收标准 2)
   禁止逆向跳转（archived 不可回到 published） *)
ArticleDraft == "draft"
ArticlePendingReview == "pending_review"
ArticlePublished == "published"
ArticleOffline == "offline"
ArticleArchived == "archived"
ArticleStates == {ArticleDraft, ArticlePendingReview, ArticlePublished, ArticleOffline, ArticleArchived}
NonExistArticle == "notexist"

(* 定时发布调度状态 *)
SchedulePending == "schedule_pending"
ScheduleFired == "schedule_fired"
ScheduleStates == {SchedulePending, ScheduleFired}

NoneBlogger == "noneblogger"
NoneSchedule == "noneschedule"

(* ==================== 变量 ==================== *)
VARIABLES
    articleState,           (* 文章状态：article -> ArticleStates ∪ {NonExistArticle} *)
    articleAuthor,          (* 文章作者：article -> Bloggers ∪ {NoneBlogger} *)
    publishSchedule         (* 定时发布调度：article -> ScheduleStates ∪ {NoneSchedule} *)

vars == <<articleState, articleAuthor, publishSchedule>>

(* ==================== TypeInvariant ==================== *)
TypeInvariant ==
    /\ articleState \in [Articles -> ArticleStates \cup {NonExistArticle}]
    /\ articleAuthor \in [Articles -> Bloggers \cup {NoneBlogger}]
    /\ publishSchedule \in [Articles -> ScheduleStates \cup {NoneSchedule}]

(* ==================== 业务不变式 ==================== *)

(* @designRef docs/system-design.md#§3.1 SD-012 文章状态机合法
 * 业务语义：文章状态机合法——已注册文章的状态必须在 ArticleStates 中，
 *   状态转移遵循 draft → pending_review → published → offline → archived 单向流转，
 *   禁止逆向跳转（archived 不可回到 published，REQ-012 验收标准 2）。
 *   未注册文章状态为 NonExistArticle；删除为软删除（status=archived，REQ-012 验收标准 6）。 *)
ArticleStateInvariant ==
    /\ \A a \in Articles :
        articleState[a] \in ArticleStates \cup {NonExistArticle}
    /\ \A a \in Articles :
        articleState[a] = NonExistArticle => articleAuthor[a] = NoneBlogger

(* @designRef docs/system-design.md#§3.1 SD-012 作者绑定单一性
 * 业务语义：已注册文章必有合法作者（REQ-012 验收标准 1）。
 *   博主仅能编辑自己文章，权限隔离由 articleAuthor 单一性保证（REQ-002 验收标准 5）。
 *   未注册文章作者为 NoneBlogger。 *)
ArticleAuthorInvariant ==
    /\ \A a \in Articles :
        articleState[a] # NonExistArticle => articleAuthor[a] \in Bloggers
    /\ \A a \in Articles :
        articleState[a] = NonExistArticle => articleAuthor[a] = NoneBlogger

(* @designRef docs/system-design.md#§3.1 SD-012 定时发布调度一致
 * 业务语义：定时发布仅在 published 状态前生效（REQ-012 验收标准 4）。
 *   schedule_pending 状态的文章必须处于 draft 或 pending_review；
 *   已发布/下线/归档文章的调度状态为 NoneSchedule 或 schedule_fired。 *)
ScheduleConsistencyInvariant ==
    /\ \A a \in Articles :
        publishSchedule[a] = SchedulePending =>
            articleState[a] \in {ArticleDraft, ArticlePendingReview}
    /\ \A a \in Articles :
        articleState[a] \in {ArticlePublished, ArticleOffline, ArticleArchived} =>
            publishSchedule[a] \in {NoneSchedule, ScheduleFired}

(* ==================== BusinessInvariant 聚合 ==================== *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ ArticleStateInvariant
    /\ ArticleAuthorInvariant
    /\ ScheduleConsistencyInvariant

(* ==================== 初始状态 ==================== *)
Init ==
    /\ articleState = [a \in Articles |-> NonExistArticle]
    /\ articleAuthor = [a \in Articles |-> NoneBlogger]
    /\ publishSchedule = [a \in Articles |-> NoneSchedule]

(* ==================== 状态转移（Next） ==================== *)

(* SD-012 动作1：创建文章（draft 状态，绑定作者） *)
CreateArticle(article, author) ==
    /\ article \in Articles
    /\ author \in Bloggers
    /\ articleState[article] = NonExistArticle
    /\ articleState' = [articleState EXCEPT ![article] = ArticleDraft]
    /\ articleAuthor' = [articleAuthor EXCEPT ![article] = author]
    /\ UNCHANGED <<publishSchedule>>

(* SD-012 动作2：提交审核（draft → pending_review） *)
SubmitForReview(article) ==
    /\ article \in Articles
    /\ articleState[article] = ArticleDraft
    /\ articleState' = [articleState EXCEPT ![article] = ArticlePendingReview]
    /\ UNCHANGED <<articleAuthor, publishSchedule>>

(* SD-012 动作3：审核通过发布（pending_review → published） *)
PublishArticle(article) ==
    /\ article \in Articles
    /\ articleState[article] = ArticlePendingReview
    /\ publishSchedule[article] = NoneSchedule
    /\ articleState' = [articleState EXCEPT ![article] = ArticlePublished]
    /\ publishSchedule' = [publishSchedule EXCEPT ![article] = ScheduleFired]
    /\ UNCHANGED <<articleAuthor>>

(* SD-012 动作4：定时发布调度（pending_review + schedule_pending，等待触发） *)
SchedulePublish(article) ==
    /\ article \in Articles
    /\ articleState[article] = ArticlePendingReview
    /\ publishSchedule[article] = NoneSchedule
    /\ publishSchedule' = [publishSchedule EXCEPT ![article] = SchedulePending]
    /\ UNCHANGED <<articleState, articleAuthor>>

(* SD-012 动作5：定时发布触发（schedule_pending → published） *)
FireScheduledPublish(article) ==
    /\ article \in Articles
    /\ articleState[article] = ArticlePendingReview
    /\ publishSchedule[article] = SchedulePending
    /\ articleState' = [articleState EXCEPT ![article] = ArticlePublished]
    /\ publishSchedule' = [publishSchedule EXCEPT ![article] = ScheduleFired]
    /\ UNCHANGED <<articleAuthor>>

(* SD-012 动作6：下线文章（published → offline） *)
OfflineArticle(article) ==
    /\ article \in Articles
    /\ articleState[article] = ArticlePublished
    /\ articleState' = [articleState EXCEPT ![article] = ArticleOffline]
    /\ UNCHANGED <<articleAuthor, publishSchedule>>

(* SD-012 动作7：归档文章（offline → archived，软删除） *)
ArchiveArticle(article) ==
    /\ article \in Articles
    /\ articleState[article] = ArticleOffline
    /\ articleState' = [articleState EXCEPT ![article] = ArticleArchived]
    /\ UNCHANGED <<articleAuthor, publishSchedule>>

(* SD-012 动作8：重新上线（offline → published，仅未归档可重新上线） *)
RepublishArticle(article) ==
    /\ article \in Articles
    /\ articleState[article] = ArticleOffline
    /\ articleState' = [articleState EXCEPT ![article] = ArticlePublished]
    /\ UNCHANGED <<articleAuthor, publishSchedule>>

(* Next：联合文章生命周期所有原子动作 *)
Next ==
    \/ \E a \in Articles, b \in Bloggers : CreateArticle(a, b)
    \/ \E a \in Articles : SubmitForReview(a)
    \/ \E a \in Articles : PublishArticle(a)
    \/ \E a \in Articles : SchedulePublish(a)
    \/ \E a \in Articles : FireScheduledPublish(a)
    \/ \E a \in Articles : OfflineArticle(a)
    \/ \E a \in Articles : ArchiveArticle(a)
    \/ \E a \in Articles : RepublishArticle(a)

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<vars>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数分析（按 .cfg 常量赋值数计算，tla-plus-guide.md §1.1）：
 *   2 个常量：Articles / Bloggers
 *   .cfg 中每个常量赋 2 个值 → 变量组合数 = 2^2 = 4
 *   4 < 1000 → kept-below-threshold（保留不拆）
 * decompositionDecision: "kept-below-threshold"
 *)
================
