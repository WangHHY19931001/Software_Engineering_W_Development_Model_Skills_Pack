(*
  @system        blog-system::interaction_subsystem
  @requirement   SD-003, REQ-017, REQ-018, REQ-019, REQ-020
  @design        docs/phase2-design/blog-system-system-design.md:§3.2
  @designIds     SD-003
  @parent        ../tla/specs/level1/L1_BlogSystem.tla
  @sibling       ../tla/specs/level2/L2_BlogSystemAuth.tla, ../tla/specs/level2/L2_BlogSystemContent.tla, ../tla/specs/level2/L2_BlogSystemDiscovery.tla, ../tla/specs/level2/L2_BlogSystemAnalytics.tla, ../tla/specs/level2/L2_BlogSystemIntegration.tla, ../tla/specs/level2/L2_BlogSystemInfrastructure.tla
  @child         ../tla/specs/level3/L3_BlogSystemCommentFlow.tla
  @level         L2
  @phase         2
*)
---- MODULE L2_BlogSystemInteraction ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    MaxFeedItems    \* 关注 feed 保留的新文章条数上限（REQ-020，小模型取 2）

ASSUME MaxFeedItems > 0

(* ==================== 变量 ==================== *)
VARIABLES
    articleVisible,          \* 目标文章对读者是否可见（已发布；草稿对读者 404——REQ-017）
    commentState,            \* 评论生命周期：none / active / deleted（REQ-018）
    operatorIsAuthor,        \* 操作者是否为作者（删除评论权限判定输入，REQ-018）
    commentDeleterIsAuthor,  \* 评论删除者是否作者（删除动作留痕，REQ-018）
    likeState,               \* 点赞状态：unliked / liked（重复点赞幂等——REQ-019）
    favoriteState,           \* 收藏状态：unfavorited / favorited（REQ-019）
    followState,             \* 关注状态：unfollowed / followed（REQ-020）
    feedItemCount            \* feed 中新文章条数（0..MaxFeedItems——REQ-020）

vars == <<articleVisible, commentState, operatorIsAuthor, commentDeleterIsAuthor,
          likeState, favoriteState, followState, feedItemCount>>

(* ==================== 状态不变式（TypeOK） ==================== *)
\* Invariant: 全部状态变量的类型约束
\* @designRef docs/phase2-design/blog-system-system-design.md:§3.2
TypeOK ==
    /\ articleVisible \in BOOLEAN
    /\ commentState \in {"none", "active", "deleted"}
    /\ operatorIsAuthor \in BOOLEAN
    /\ commentDeleterIsAuthor \in BOOLEAN
    /\ likeState \in {"unliked", "liked"}
    /\ favoriteState \in {"unfavorited", "favorited"}
    /\ followState \in {"unfollowed", "followed"}
    /\ feedItemCount \in 0..MaxFeedItems

(* ==================== 业务不变式 ==================== *)
\* Invariant: 评论必针对读者可见（已发布）文章（草稿对读者 404——REQ-017/REQ-018）
\* @designRef docs/phase2-design/blog-system-system-design.md:§4 INTF-011/INTF-012
CommentRequiresVisibleArticle ==
    commentState # "none" => articleVisible

\* Invariant: 已删除评论必由作者删除（非作者删除 403——REQ-018）
\* @designRef docs/phase2-design/blog-system-system-design.md:§4 INTF-012
DeletedCommentRequiresAuthorDelete ==
    commentState = "deleted" => commentDeleterIsAuthor

\* Invariant: 点赞/收藏必针对读者可见（已发布）文章（REQ-017/REQ-019）
\* @designRef docs/phase2-design/blog-system-system-design.md:§4 INTF-013
LikeAndFavoriteRequireVisibleArticle ==
    (likeState = "liked" \/ favoriteState = "favorited") => articleVisible

\* Invariant: feed 有新文章必当前仍关注博主（取消关注即清空 feed，feed 仅含当前关注博主文章——REQ-020/US-26）
\* @designRef docs/phase2-design/blog-system-system-design.md:§4 INTF-014
FeedRequiresFollowing ==
    feedItemCount >= 1 => followState = "followed"

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合全部子不变式（含 TypeOK）；.cfg 的 INVARIANTS 列表须与此展开集合一致 *)
BusinessInvariant ==
    /\ TypeOK
    /\ CommentRequiresVisibleArticle
    /\ DeletedCommentRequiresAuthorDelete
    /\ LikeAndFavoriteRequireVisibleArticle
    /\ FeedRequiresFollowing

(* ==================== 初始状态 ==================== *)
Init ==
    /\ articleVisible = FALSE
    /\ commentState = "none"
    /\ operatorIsAuthor \in BOOLEAN
    /\ commentDeleterIsAuthor = FALSE
    /\ likeState = "unliked"
    /\ favoriteState = "unfavorited"
    /\ followState = "unfollowed"
    /\ feedItemCount = 0

(* ==================== 状态转移（Next） ==================== *)
(* ---- 浏览：draft 对读者不可见（404），发布后可见（REQ-017） ---- *)
PublishArticleForReaders ==
    /\ articleVisible = FALSE
    /\ articleVisible' = TRUE
    /\ UNCHANGED <<commentState, operatorIsAuthor, commentDeleterIsAuthor,
                   likeState, favoriteState, followState, feedItemCount>>

(* ---- 评论（REQ-018）：发表 201 立即可见；作者可删除；非作者 403 ---- *)
PostComment ==
    /\ articleVisible
    /\ commentState = "none"
    /\ commentState' = "active"
    /\ UNCHANGED <<articleVisible, operatorIsAuthor, commentDeleterIsAuthor,
                   likeState, favoriteState, followState, feedItemCount>>

DeleteCommentByAuthor ==
    /\ commentState = "active"
    /\ operatorIsAuthor
    /\ commentState' = "deleted"
    /\ commentDeleterIsAuthor' = TRUE
    /\ UNCHANGED <<articleVisible, operatorIsAuthor,
                   likeState, favoriteState, followState, feedItemCount>>

(* ---- 点赞收藏（REQ-019）：重复点赞幂等（重复请求状态不变） ---- *)
LikeArticle ==
    /\ articleVisible
    /\ likeState = "unliked"
    /\ likeState' = "liked"
    /\ UNCHANGED <<articleVisible, commentState, operatorIsAuthor, commentDeleterIsAuthor,
                   favoriteState, followState, feedItemCount>>

UnlikeArticle ==
    /\ likeState = "liked"
    /\ likeState' = "unliked"
    /\ UNCHANGED <<articleVisible, commentState, operatorIsAuthor, commentDeleterIsAuthor,
                   favoriteState, followState, feedItemCount>>

FavoriteArticle ==
    /\ articleVisible
    /\ favoriteState = "unfavorited"
    /\ favoriteState' = "favorited"
    /\ UNCHANGED <<articleVisible, commentState, operatorIsAuthor, commentDeleterIsAuthor,
                   likeState, followState, feedItemCount>>

UnfavoriteArticle ==
    /\ favoriteState = "favorited"
    /\ favoriteState' = "unfavorited"
    /\ UNCHANGED <<articleVisible, commentState, operatorIsAuthor, commentDeleterIsAuthor,
                   likeState, followState, feedItemCount>>

(* ---- 关注与 feed（REQ-020） ---- *)
FollowBlogger ==
    /\ followState = "unfollowed"
    /\ followState' = "followed"
    /\ UNCHANGED <<articleVisible, commentState, operatorIsAuthor, commentDeleterIsAuthor,
                   likeState, favoriteState, feedItemCount>>

UnfollowBlogger ==
    /\ followState = "followed"
    /\ followState' = "unfollowed"
    /\ feedItemCount' = 0    \* 方案 A（US-26）：取消关注清空 feed，feed 仅含当前关注博主新文章
    /\ UNCHANGED <<articleVisible, commentState, operatorIsAuthor, commentDeleterIsAuthor,
                   likeState, favoriteState>>

FeedUpdateOnNewArticle ==
    /\ followState = "followed"
    /\ feedItemCount < MaxFeedItems
    /\ feedItemCount' = feedItemCount + 1
    /\ UNCHANGED <<articleVisible, commentState, operatorIsAuthor, commentDeleterIsAuthor,
                   likeState, favoriteState, followState>>

Next ==
    \/ PublishArticleForReaders
    \/ PostComment
    \/ DeleteCommentByAuthor
    \/ LikeArticle
    \/ UnlikeArticle
    \/ FavoriteArticle
    \/ UnfavoriteArticle
    \/ FollowBlogger
    \/ UnfollowBlogger
    \/ FeedUpdateOnNewArticle

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_vars

(* ==================== 拆解决策（variableCombination > 1000 时必填） ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积：
   2(articleVisible) x 3(commentState) x 2(operatorIsAuthor) x 2(commentDeleterIsAuthor)
   x 2(likeState) x 2(favoriteState) x 2(followState) x 3(feedItemCount 0..2) = 576
   <= 1000: kept-below-threshold（子系统粒度，未触及拆解阈值） *)
====
