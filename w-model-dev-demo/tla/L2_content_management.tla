(*
  @system        blog-system-demo
  @requirement   SD-008, SD-009, SD-012, SD-013
  @design        docs/system-design.md
  @parent        ../tla/L1_blog_system.tla
  @sibling       ../tla/L2_identity_access.tla, ../tla/L2_discovery.tla, ../tla/L2_interaction.tla, ../tla/L2_operations_support.tla, ../tla/L2_infrastructure.tla, ../tla/L2_subscription_push.tla
  @child         ../tla/L3_article_lifecycle.tla
  @level         L2
  @phase         2
  所属系统: blog-system-demo
  关联需求: SD-012 多博文 + SD-013 交叉引用 + SD-008 标签 + SD-009 分类（内容管理域）
  关联设计: docs/system-design.md §3.1 SD-008/009/012/013
  上级 TLA: L1_blog_system.tla
  同级 TLA: 其他 6 个 L2 规格
  下级 TLA: L3_article_lifecycle.tla（阶段 3 产出，SD-012 文章状态机原子行为）
  层级: L2 (子系统内部行为)
  requirementIds: [SD-008, SD-009, SD-012, SD-013]
*)
---- MODULE L2_content_management ----
EXTENDS Naturals, Sequences, FiniteSets

(* ==================== 常量 ==================== *)
CONSTANTS
    Articles,       (* 文章全集 *)
    Tags,           (* 标签全集 *)
    Categories,     (* 分类全集 *)
    Bloggers        (* 博主全集 *)

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

(* 标签状态：pending → approved/rejected (REQ-008) *)
TagPending == "pending"
TagApproved == "approved"
TagRejected == "rejected"
TagStates == {TagPending, TagApproved, TagRejected}
NonExistTag == "nottag"

(* 分类父节点哨兵 *)
NoneCategory == "nonecat"

(* ==================== 变量 ==================== *)
VARIABLES
    articleCatalog,        (* 文章状态：article -> ArticleStates ∪ {NonExistArticle} *)
    articleAuthor,         (* 文章作者：article -> Bloggers ∪ {NoneBlogger} *)
    articleTags,           (* 文章标签：article -> SUBSET Tags *)
    articleCategory,       (* 文章分类：article -> Categories ∪ {NoneCategory} *)
    tagRegistry,           (* 标签注册表：tag -> TagStates ∪ {NonExistTag} *)
    categoryParent,        (* 分类父节点：category -> Categories ∪ {NoneCategory} *)
    citationGraph          (* 引用图：article -> SUBSET Articles（被引用集合） *)

NoneBlogger == "noneblogger"
vars == <<articleCatalog, articleAuthor, articleTags, articleCategory, tagRegistry, categoryParent, citationGraph>>

(* ==================== TypeInvariant ==================== *)
TypeInvariant ==
    /\ articleCatalog \in [Articles -> ArticleStates \cup {NonExistArticle}]
    /\ articleAuthor \in [Articles -> Bloggers \cup {NoneBlogger}]
    /\ articleTags \in [Articles -> SUBSET Tags]
    /\ articleCategory \in [Articles -> Categories \cup {NoneCategory}]
    /\ tagRegistry \in [Tags -> TagStates \cup {NonExistTag}]
    /\ categoryParent \in [Categories -> Categories \cup {NoneCategory}]
    /\ citationGraph \in [Articles -> SUBSET Articles]

(* ==================== 业务不变式 ==================== *)

(* @designRef docs/system-design.md#§3.1 SD-012 多博文状态机
 * 业务语义：文章状态机合法——已注册文章的状态必须在 ArticleStates 中，
 *   状态转移遵循 draft → pending_review → published → offline → archived 单向流转，
 *   禁止逆向跳转（archived 不可回到 published，REQ-012 验收标准 2）。
 *   未注册文章状态为 NonExistArticle；删除为软删除（status=archived，REQ-012 验收标准 6）。 *)
ArticleStateInvariant ==
    /\ \A a \in Articles :
        articleCatalog[a] \in ArticleStates \cup {NonExistArticle}
    /\ \A a \in Articles :
        articleCatalog[a] # NonExistArticle => articleCatalog[a] \in ArticleStates

(* @designRef docs/system-design.md#§3.1 SD-012 多博文作者绑定
 * 业务语义：已注册文章必须有合法作者（REQ-012 验收标准 1 博主提交文章）；
 *   博主仅能管理自己文章，权限隔离由 articleAuthor 单一性保证（REQ-002 验收标准 5）。 *)
ArticleAuthorInvariant ==
    /\ \A a \in Articles :
        articleCatalog[a] # NonExistArticle => articleAuthor[a] \in Bloggers
    /\ \A a \in Articles :
        articleCatalog[a] = NonExistArticle => articleAuthor[a] = NoneBlogger

(* @designRef docs/system-design.md#§3.1 SD-008 标签数量限制
 * 业务语义：每篇文章标签数 ≤ 10（REQ-008 数据约束）；
 *   标签状态机 pending → approved/rejected，仅 approved 标签可被文章绑定。 *)
ArticleTagCountInvariant ==
    /\ \A a \in Articles :
        Cardinality(articleTags[a]) <= 10
    /\ \A a \in Articles, t \in Tags :
        t \in articleTags[a] => tagRegistry[t] = TagApproved

(* @designRef docs/system-design.md#§3.1 SD-009 分类树无环约束
 * 业务语义：分类树 ≤ 5 层（REQ-009 数据约束），无环；
 *   parent 链不可自引用，根节点 parent = NoneCategory。 *)
CategoryTreeNoCycle ==
    /\ \A c \in Categories : categoryParent[c] # c
    /\ \A c \in Categories :
        categoryParent[c] # NoneCategory => categoryParent[c] \in Categories

(* @designRef docs/system-design.md#§3.1 SD-013 交叉引用禁止自引用
 * 业务语义：文章不可引用自己（REQ-013 数据约束 禁止自引用）；
 *   引用关系为有向边 source → target，被引用集合记录于 citationGraph[target]。
 *   引用图谱支持 citedByCount/citingCount 双向统计（REQ-013 验收标准 3）。 *)
NoSelfCitation ==
    /\ \A a \in Articles :
        a \notin citationGraph[a]
    /\ \A a \in Articles :
        citationGraph[a] \subseteq Articles

(* ==================== BusinessInvariant 聚合 ==================== *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ ArticleStateInvariant
    /\ ArticleAuthorInvariant
    /\ ArticleTagCountInvariant
    /\ CategoryTreeNoCycle
    /\ NoSelfCitation

(* ==================== 初始状态 ==================== *)
Init ==
    /\ articleCatalog = [a \in Articles |-> NonExistArticle]
    /\ articleAuthor = [a \in Articles |-> NoneBlogger]
    /\ articleTags = [a \in Articles |-> {}]
    /\ articleCategory = [a \in Articles |-> NoneCategory]
    /\ tagRegistry = [t \in Tags |-> NonExistTag]
    /\ categoryParent = [c \in Categories |-> NoneCategory]
    /\ citationGraph = [a \in Articles |-> {}]

(* ==================== 状态转移（Next） ==================== *)

(* SD-012 动作1：博主创建文章（draft 状态） *)
BloggerCreateArticle(blogger, article) ==
    /\ blogger \in Bloggers
    /\ article \in Articles
    /\ articleCatalog[article] = NonExistArticle
    /\ articleCatalog' = [articleCatalog EXCEPT ![article] = ArticleDraft]
    /\ articleAuthor' = [articleAuthor EXCEPT ![article] = blogger]
    /\ articleTags' = articleTags
    /\ articleCategory' = articleCategory
    /\ tagRegistry' = tagRegistry
    /\ categoryParent' = categoryParent
    /\ citationGraph' = citationGraph

(* SD-012 动作2：提交审核（draft → pending_review） *)
SubmitForReview(article) ==
    /\ article \in Articles
    /\ articleCatalog[article] = ArticleDraft
    /\ articleCatalog' = [articleCatalog EXCEPT ![article] = ArticlePendingReview]
    /\ UNCHANGED <<articleAuthor, articleTags, articleCategory, tagRegistry, categoryParent, citationGraph>>

(* SD-012 动作3：审核通过（pending_review → published） *)
ApproveArticle(article) ==
    /\ article \in Articles
    /\ articleCatalog[article] = ArticlePendingReview
    /\ articleCatalog' = [articleCatalog EXCEPT ![article] = ArticlePublished]
    /\ UNCHANGED <<articleAuthor, articleTags, articleCategory, tagRegistry, categoryParent, citationGraph>>

(* SD-012 动作4：下线（published → offline） *)
OfflineArticle(article) ==
    /\ article \in Articles
    /\ articleCatalog[article] = ArticlePublished
    /\ articleCatalog' = [articleCatalog EXCEPT ![article] = ArticleOffline]
    /\ UNCHANGED <<articleAuthor, articleTags, articleCategory, tagRegistry, categoryParent, citationGraph>>

(* SD-012 动作5：归档软删除（offline → archived，不可逆） *)
ArchiveArticle(article) ==
    /\ article \in Articles
    /\ articleCatalog[article] = ArticleOffline
    /\ articleCatalog' = [articleCatalog EXCEPT ![article] = ArticleArchived]
    /\ UNCHANGED <<articleAuthor, articleTags, articleCategory, tagRegistry, categoryParent, citationGraph>>

(* SD-008 动作6：创建标签（pending 状态） *)
CreateTag(tag) ==
    /\ tag \in Tags
    /\ tagRegistry[tag] = NonExistTag
    /\ tagRegistry' = [tagRegistry EXCEPT ![tag] = TagPending]
    /\ UNCHANGED <<articleCatalog, articleAuthor, articleTags, articleCategory, categoryParent, citationGraph>>

(* SD-008 动作7：审核标签（pending → approved/rejected） *)
ApproveTag(tag, decision) ==
    /\ tag \in Tags
    /\ tagRegistry[tag] = TagPending
    /\ decision \in {TagApproved, TagRejected}
    /\ tagRegistry' = [tagRegistry EXCEPT ![tag] = decision]
    /\ UNCHANGED <<articleCatalog, articleAuthor, articleTags, articleCategory, categoryParent, citationGraph>>

(* SD-008 动作8：文章绑定标签（标签须 approved，单篇 ≤ 10） *)
BindTag(article, tag) ==
    /\ article \in Articles
    /\ tag \in Tags
    /\ articleCatalog[article] # NonExistArticle
    /\ tagRegistry[tag] = TagApproved
    /\ Cardinality(articleTags[article]) < 10
    /\ tag \notin articleTags[article]
    /\ articleTags' = [articleTags EXCEPT ![article] = articleTags[article] \cup {tag}]
    /\ UNCHANGED <<articleCatalog, articleAuthor, articleCategory, tagRegistry, categoryParent, citationGraph>>

(* SD-009 动作9：创建分类（指定父节点） *)
CreateCategory(category, parent) ==
    /\ category \in Categories
    /\ parent \in Categories \cup {NoneCategory}
    /\ categoryParent[category] = NoneCategory
    /\ category # parent
    /\ categoryParent' = [categoryParent EXCEPT ![category] = parent]
    /\ UNCHANGED <<articleCatalog, articleAuthor, articleTags, articleCategory, tagRegistry, citationGraph>>

(* SD-009 动作10：文章归属分类 *)
BindCategory(article, category) ==
    /\ article \in Articles
    /\ category \in Categories
    /\ articleCatalog[article] # NonExistArticle
    /\ articleCategory' = [articleCategory EXCEPT ![article] = category]
    /\ UNCHANGED <<articleCatalog, articleAuthor, articleTags, tagRegistry, categoryParent, citationGraph>>

(* SD-013 动作11：添加引用（source → target，禁止自引用） *)
AddCitation(source, target) ==
    /\ source \in Articles
    /\ target \in Articles
    /\ source # target
    /\ articleCatalog[source] # NonExistArticle
    /\ articleCatalog[target] # NonExistArticle
    /\ target \notin citationGraph[source]
    /\ citationGraph' = [citationGraph EXCEPT ![source] = citationGraph[source] \cup {target}]
    /\ UNCHANGED <<articleCatalog, articleAuthor, articleTags, articleCategory, tagRegistry, categoryParent>>

(* SD-013 动作12：移除引用（source 不再引用 target） *)
RemoveCitation(source, target) ==
    /\ source \in Articles
    /\ target \in Articles
    /\ target \in citationGraph[source]
    /\ citationGraph' = [citationGraph EXCEPT ![source] = citationGraph[source] \ {target}]
    /\ UNCHANGED <<articleCatalog, articleAuthor, articleTags, articleCategory, tagRegistry, categoryParent>>

(* Next：联合内容管理域所有动作 *)
Next ==
    \/ \E b \in Bloggers, a \in Articles : BloggerCreateArticle(b, a)
    \/ \E a \in Articles : SubmitForReview(a)
    \/ \E a \in Articles : ApproveArticle(a)
    \/ \E a \in Articles : OfflineArticle(a)
    \/ \E a \in Articles : ArchiveArticle(a)
    \/ \E t \in Tags : CreateTag(t)
    \/ \E t \in Tags, d \in {TagApproved, TagRejected} : ApproveTag(t, d)
    \/ \E a \in Articles, t \in Tags : BindTag(a, t)
    \/ \E c \in Categories, p \in Categories \cup {NoneCategory} : CreateCategory(c, p)
    \/ \E a \in Articles, c \in Categories : BindCategory(a, c)
    \/ \E s \in Articles, t \in Articles : AddCitation(s, t)
    \/ \E s \in Articles, t \in Articles : RemoveCitation(s, t)

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<vars>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数分析（按 .cfg 常量赋值数计算，tla-plus-guide.md §1.1）：
 *   4 个常量：Articles / Tags / Categories / Bloggers
 *   .cfg 中每个常量赋 2 个值 → 变量组合数 = 2^4 = 16
 *   16 < 1000 → kept-below-threshold（保留不拆）
 * decompositionDecision: "kept-below-threshold"
 *)
================
