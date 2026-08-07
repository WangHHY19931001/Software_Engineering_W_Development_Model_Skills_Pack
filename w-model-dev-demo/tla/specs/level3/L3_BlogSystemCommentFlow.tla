(*
  @system        blog-system::interaction_subsystem::comment_flow
  @requirement   SD-003, REQ-018
  @design        docs/phase3-outline/blog-system-interface-design.md:§2.12
  @designIds     SD-003
  @parent        ../tla/specs/level2/L2_BlogSystemInteraction.tla
  @sibling       ../tla/specs/level3/L3_BlogSystemArticleState.tla, ../tla/specs/level3/L3_BlogSystemAuthFlow.tla, ../tla/specs/level3/L3_BlogSystemRateLimit.tla, ../tla/specs/level3/L3_BlogSystemWebhookRetry.tla, ../tla/specs/level3/L3_BlogSystemReadingDedup.tla
  @child         null
  @level         L3
  @phase         3
*)
---- MODULE L3_BlogSystemCommentFlow ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    MaxComments    \* 评论数模型边界（INTF-012：content 长度 1..2000，发表即自动审核通过立即可见）

ASSUME MaxComments > 0

(* ==================== 变量 ==================== *)
VARIABLES
    articlePublished,    \* 上下文：文章是否已发布（INTF-012：草稿/归档文章不可评论 40402）
    commentCount,        \* 当前文章评论数（0..MaxComments，含回复）
    authenticated,       \* 评论者会话是否已认证（INTF-012：未认证 40101）
    deletionAuthorized   \* 删除请求授权上下文（INTF-012：仅文章作者可删，非作者 40301）

vars == <<articlePublished, commentCount, authenticated, deletionAuthorized>>

(* ==================== 状态不变式（TypeOK） ==================== *)
\* Invariant: 全部状态变量的类型约束（发布上下文 x 评论数 x 会话认证 x 删除授权）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§2.12
TypeOK ==
    /\ articlePublished \in BOOLEAN
    /\ commentCount \in 0..MaxComments
    /\ authenticated \in BOOLEAN
    /\ deletionAuthorized \in BOOLEAN

(* ==================== 业务不变式 ==================== *)
\* Invariant: 评论必附着于已发布文章（草稿/归档文章对读者不可见且不可评论——REQ-018/INTF-012 40402）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§2.12
CommentRequiresPublishedArticle ==
    commentCount > 0 => articlePublished

\* Invariant: 评论必由已认证用户发表（发表/回复须 JWT，未认证 40101——INTF-012）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§2.12
CommentRequiresAuthentication ==
    commentCount > 0 => authenticated

\* Invariant: 评论数不超过模型边界（发表/回复后计数受控——REQ-018）
\* @designRef docs/phase3-outline/blog-system-interface-design.md:§2.12
CommentCountBounded ==
    commentCount <= MaxComments

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合全部子不变式（含 TypeOK）；.cfg 的 INVARIANTS 列表须与此展开集合一致 *)
BusinessInvariant ==
    /\ TypeOK
    /\ CommentRequiresPublishedArticle
    /\ CommentRequiresAuthentication
    /\ CommentCountBounded

(* ==================== 初始状态 ==================== *)
Init ==
    /\ articlePublished = FALSE
    /\ commentCount = 0
    /\ authenticated = FALSE
    /\ deletionAuthorized = FALSE

(* ==================== 状态转移（Next，原子操作） ==================== *)
(* ---- 上下文：文章发布（INTF-006 发布事件后评论方可发表；草稿/归档不可评论） ---- *)
PublishArticleContext ==
    /\ articlePublished = FALSE
    /\ articlePublished' = TRUE
    /\ UNCHANGED <<commentCount, authenticated, deletionAuthorized>>

(* ---- 会话认证：登录成功（INTF-012 发表/回复须 JWT——40101） ---- *)
Authenticate ==
    /\ authenticated = FALSE
    /\ authenticated' = TRUE
    /\ UNCHANGED <<articlePublished, commentCount, deletionAuthorized>>

(* ---- INTF-012：发表评论（201；文章须已发布 + 已认证） ---- *)
CreateComment ==
    /\ articlePublished
    /\ authenticated
    /\ commentCount < MaxComments
    /\ commentCount' = commentCount + 1
    /\ UNCHANGED <<articlePublished, authenticated, deletionAuthorized>>

(* ---- INTF-012：回复评论（parentId 指向的评论须存在且属同一文章——guard commentCount > 0） ---- *)
ReplyComment ==
    /\ articlePublished
    /\ authenticated
    /\ commentCount > 0
    /\ commentCount < MaxComments
    /\ commentCount' = commentCount + 1
    /\ UNCHANGED <<articlePublished, authenticated, deletionAuthorized>>

(* ---- INTF-012：删除授权判定（作者→授权 TRUE→DeleteComment 可达；非作者→拒绝 40301 保持原态——BDD-L3-015/016） ---- *)
AuthorizeDeletion ==
    \/ /\ ~deletionAuthorized
       /\ deletionAuthorized' = TRUE
       /\ UNCHANGED <<articlePublished, commentCount, authenticated>>
    \/ /\ ~deletionAuthorized
       /\ UNCHANGED vars

(* ---- INTF-012：删除评论（204；仅文章作者可删，非作者 40301） ---- *)
DeleteComment ==
    /\ deletionAuthorized
    /\ commentCount > 0
    /\ commentCount' = commentCount - 1
    /\ UNCHANGED <<articlePublished, authenticated, deletionAuthorized>>

Next ==
    \/ PublishArticleContext
    \/ Authenticate
    \/ CreateComment
    \/ ReplyComment
    \/ AuthorizeDeletion
    \/ DeleteComment

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_vars

(* ==================== 拆解决策（variableCombination > 1000 时必填） ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积：
   2(articlePublished) x 3(commentCount 0..2) x 2(authenticated) x 2(deletionAuthorized) = 24
   <= 1000: kept-below-threshold（原子行为粒度，未触及拆解阈值） *)
====
