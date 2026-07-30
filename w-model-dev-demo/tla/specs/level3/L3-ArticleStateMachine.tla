(* @system        blog-system-demo
   @requirement   REQ-006,REQ-007,REQ-008
   @design        docs/phase4-design/detailed-design.md#DD-005
   @parent        tla/specs/level2/L2-AuthService.tla
   @sibling       null
   @child         tla/specs/level4/L4-WebhookDelivery.tla
   @level         L3
   @phase         4

   所属系统: blog-system-demo
   关联设计: docs/phase4-design/detailed-design.md#DD-005
   层级: L3 (原子行为)
   上级 TLA: tla/specs/level2/L2-AuthService.tla
   同级 TLA: 无
   下级 TLA: tla/specs/level4/L4-WebhookDelivery.tla
   状态机七要素:
     - initial    : NONE
     - terminal   : DELETED
     - accepting  : PUBLISHED, ARCHIVED
     - rejecting  : DELETED
     - transitions: 9
     - actions    : 8
     - invariants : 4
   公平性: WF_vars(PublishArticle \/ ArchiveArticle)

   状态变量含义:
     articleState   ∈ ArticleStates    博文状态
     ownerId        ∈ Nat              作者 id
     content        ∈ {"","valid","invalid"}  正文内容标识
     isAuth         ∈ BOOLEAN          是否已认证
     lastTransition ∈ ArticleStates ∪ {"NONE"}  上一次转移目标

   转移规则:
     NONE -> DRAFT          (CreateDraft, 需 isAuth=TRUE)
     DRAFT -> DRAFT         (ValidateContent, content 升级)
     DRAFT -> PUBLISHED     (PublishArticle, 需 isAuth + content≠"" + content≠"invalid")
     PUBLISHED -> ARCHIVED  (ArchiveArticle, 需 isAuth)
     PUBLISHED -> DRAFT     (UnpublishArticle, 需 isAuth)
     {DRAFT,PUBLISHED,ARCHIVED} -> DELETED  (DeleteArticle, 需 isAuth)
     任意非 NONE 状态自环   (RejectInvalidAuth, isAuth=FALSE)
*)
---- MODULE L3ArticleStateMachine ----

(***********************************************************************
  L3 博文状态机规格（DD-005.2 形式化）

  刻画 Article 状态：NONE/DRAFT/PUBLISHED/ARCHIVED/DELETED 转移。
  关联 SD-005（DD-005.1~DD-005.8）。

  关联 DD:
    - DD-005.1 Article
    - DD-005.2 ArticleStateMachine
    - DD-005.3 ArticleService
    - DD-005.4 ArticleRepository
    - DD-005.5 ArticleController
    - DD-005.6 ArticleValidator
    - DD-005.7 ArticleSearcher
    - DD-005.8 ArticleStatistics

  关联 BDD: features/article-state-transitions.feature
  关联 RTM: requirementId=REQ-006, REQ-007, REQ-008
***********************************************************************)

EXTENDS Naturals, FiniteSets

VARIABLES articleState, ownerId, content, isAuth, lastTransition

ArticleStates == {"NONE", "DRAFT", "PUBLISHED", "ARCHIVED", "DELETED"}

vars == <<articleState, ownerId, content, isAuth, lastTransition>>

\* =====================================================================
\* 类型约束
\* =====================================================================
TypeOK ==
  /\ articleState \in ArticleStates
  /\ ownerId \in Nat
  /\ content \in {"", "valid", "invalid"}
  /\ isAuth \in BOOLEAN
  /\ lastTransition \in ArticleStates \union {"NONE"}

\* =====================================================================
\* 初始状态
\* =====================================================================
Init ==
  /\ articleState = "NONE"
  /\ ownerId = 0
  /\ content = ""
  /\ isAuth = FALSE
  /\ lastTransition = "NONE"

\* =====================================================================
\* 转移 1: 创建草稿 NONE -> DRAFT
\* 触发: 外部 CreateDraft 事件
\* 守卫: 当前为 NONE；已认证
\* 动作: articleState := "DRAFT"
\* =====================================================================
CreateDraft ==
  /\ articleState = "NONE"
  /\ isAuth = TRUE
  /\ articleState' = "DRAFT"
  /\ lastTransition' = "DRAFT"
  /\ UNCHANGED <<ownerId, content, isAuth>>

\* =====================================================================
\* 转移 2: 内容校验 DRAFT -> DRAFT（自环升级 content）
\* 触发: 外部 ValidateContent 事件
\* 守卫: 当前为 DRAFT
\* 动作: content 由 "" 升级为 "valid"（若已是 valid/invalid 保持）
\* =====================================================================
ValidateContent ==
  /\ articleState = "DRAFT"
  /\ content' = IF content = "" THEN "valid" ELSE content
  /\ UNCHANGED <<articleState, ownerId, isAuth, lastTransition>>

\* =====================================================================
\* 转移 3: 发布 DRAFT -> PUBLISHED
\* 触发: 外部 PublishArticle 事件
\* 守卫: 已认证；content 非空且非 "invalid"
\* 动作: articleState := "PUBLISHED"
\* =====================================================================
PublishArticle ==
  /\ articleState = "DRAFT"
  /\ isAuth = TRUE
  /\ content # ""
  /\ content # "invalid"
  /\ articleState' = "PUBLISHED"
  /\ lastTransition' = "PUBLISHED"
  /\ UNCHANGED <<ownerId, content, isAuth>>

\* =====================================================================
\* 转移 4: 归档 PUBLISHED -> ARCHIVED
\* 触发: 外部 ArchiveArticle 事件
\* 守卫: 已认证
\* 动作: articleState := "ARCHIVED"
\* =====================================================================
ArchiveArticle ==
  /\ articleState = "PUBLISHED"
  /\ isAuth = TRUE
  /\ articleState' = "ARCHIVED"
  /\ lastTransition' = "ARCHIVED"
  /\ UNCHANGED <<ownerId, content, isAuth>>

\* =====================================================================
\* 转移 5: 撤回 PUBLISHED -> DRAFT
\* 触发: 外部 UnpublishArticle 事件
\* 守卫: 已认证
\* 动作: articleState := "DRAFT"
\* =====================================================================
UnpublishArticle ==
  /\ articleState = "PUBLISHED"
  /\ isAuth = TRUE
  /\ articleState' = "DRAFT"
  /\ lastTransition' = "DRAFT"
  /\ UNCHANGED <<ownerId, content, isAuth>>

\* =====================================================================
\* 转移 6: 删除 {DRAFT, PUBLISHED, ARCHIVED} -> DELETED
\* 触发: 外部 DeleteArticle 事件
\* 守卫: 已认证；非 NONE 非 DELETED
\* 动作: articleState := "DELETED"；content 清空
\* =====================================================================
DeleteArticle ==
  /\ articleState \in {"DRAFT", "PUBLISHED", "ARCHIVED"}
  /\ isAuth = TRUE
  /\ articleState' = "DELETED"
  /\ content' = ""
  /\ lastTransition' = "DELETED"
  /\ UNCHANGED <<ownerId, isAuth>>

\* =====================================================================
\* 转移 7: 拒绝未认证（自环）
\* =====================================================================
RejectInvalidAuth ==
  /\ isAuth = FALSE
  /\ UNCHANGED vars

\* =====================================================================
\* 下一状态动作
\* =====================================================================
Next ==
  \/ CreateDraft
  \/ ValidateContent
  \/ PublishArticle
  \/ ArchiveArticle
  \/ UnpublishArticle
  \/ DeleteArticle
  \/ RejectInvalidAuth

Spec == Init /\ [][Next]_vars /\ WF_vars(PublishArticle \/ ArchiveArticle)

\* =====================================================================
\* 不变式
\* =====================================================================
AuthInvariant == articleState \in {"DRAFT","PUBLISHED","ARCHIVED"} => isAuth = TRUE
ContentInvariant == articleState = "PUBLISHED" => content # "" /\ content # "invalid"
TerminalInvariant == articleState = "DELETED" => content = ""

\* 活性：进入 DRAFT 后必最终进入 PUBLISHED 或 DELETED
ProgressInvariant == [](articleState = "DRAFT" ~> articleState \in {"PUBLISHED","DELETED"})

Invariants ==
  /\ TypeOK
  /\ AuthInvariant
  /\ ContentInvariant
  /\ TerminalInvariant
PROPERTY ProgressInvariant
====
