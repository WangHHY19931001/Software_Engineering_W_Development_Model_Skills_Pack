---- MODULE L2_article_workflow_subsystem ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-017,SD-018
  @design      docs/system-design.md#SD-017 草稿/发布工作流模块 / SD-018 文章点赞模块
  @parent      tla/L1_blog_system.tla
  @sibling     null
  @child       tla/L3_article_publish_flow.tla,tla/L3_article_like_flow.tla
  @level       L2
  @phase       2
*)

(*
 * L2 文章工作流子系统规格：建模草稿/发布状态机 + 点赞状态机。
 * articleStatus: 0=draft, 1=published
 * likeState: 0=unliked, 1=liked
 * 对应 SD-017 (草稿/发布) / SD-018 (点赞)。
 *)

VARIABLES articleStatus, likeState

\* 文章状态：0=draft, 1=published
ArticleStates == 0..1

\* 点赞状态：0=unliked, 1=liked
LikeStates == 0..1

Init == articleStatus = 0 /\ likeState = 0

\* 发布文章（draft → published）
Publish ==
  /\ articleStatus = 0
  /\ articleStatus' = 1
  /\ likeState' = likeState

\* 取消发布（published → draft）
Unpublish ==
  /\ articleStatus = 1
  /\ articleStatus' = 0
  /\ likeState' = likeState

\* 点赞（幂等，重复点赞不改变状态）
Like ==
  /\ articleStatus = 1
  /\ likeState' = 1
  /\ articleStatus' = articleStatus

\* 取消点赞
Unlike ==
  /\ articleStatus = 1
  /\ likeState = 1
  /\ likeState' = 0
  /\ articleStatus' = articleStatus

Next ==
  \/ Publish
  \/ Unpublish
  \/ Like
  \/ Unlike

Spec == Init /\ [][Next]_<<articleStatus, likeState>>

\* @designRef docs/system-design.md#SD-017 文章状态始终在有效范围内
TypeInvariant == articleStatus \in ArticleStates /\ likeState \in LikeStates

\* @designRef docs/system-design.md#SD-017 草稿/发布状态边界约束
ValidArticleStatus == articleStatus >= 0 /\ articleStatus <= 1

\* @designRef docs/system-design.md#SD-018 点赞状态边界约束
ValidLikeState == likeState >= 0 /\ likeState <= 1

\* @designRef docs/system-design.md#SD-017 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ ValidArticleStatus
  /\ ValidLikeState

====
