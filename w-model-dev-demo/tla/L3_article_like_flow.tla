---- MODULE L3_article_like_flow ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-018,INTF-018
  @design      docs/interface-design.md#INTF-018 文章点赞接口 / docs/system-design.md#SD-018 文章点赞模块
  @parent      tla/L2_article_workflow_subsystem.tla
  @sibling     tla/L3_article_publish_flow.tla
  @child       null
  @level       L3
  @phase       3
*)

(*
 * L3 文章点赞原子行为规格：建模去重 + 计数 + 幂等。
 * 状态流转：unliked → liking → liked（首次点赞，likeCount+1）
 *           liked → liking_again → liked（重复点赞，likeCount 不变，幂等）
 * 对应 INTF-018 (文章点赞接口) / SD-018 (文章点赞模块)。
 * 关键不变式：likeCount 非负；重复点赞幂等（不重复计数）；liked 状态与 likeCount 一致。
 *)

VARIABLES state, likeCount, userLiked

\* 点赞状态枚举：0=unliked, 1=liking, 2=liked, 3=liking_again
States == 0..3

\* likeCount 上限（防御性，避免状态爆炸）
MAX_LIKES == 100

LikeCounts == 0..MAX_LIKES

Init == state = 0 /\ likeCount = 0 /\ userLiked = FALSE

\* 首次点赞请求（unliked → liking）
FirstLikeRequest ==
  /\ state = 0
  /\ userLiked = FALSE
  /\ state' = 1
  /\ likeCount' = likeCount
  /\ userLiked' = userLiked

\* 完成首次点赞（liking → liked，likeCount+1）
CompleteFirstLike ==
  /\ state = 1
  /\ state' = 2
  /\ likeCount' = likeCount + 1
  /\ userLiked' = TRUE

\* 重复点赞请求（liked → liking_again，幂等）
RepeatLikeRequest ==
  /\ state = 2
  /\ userLiked = TRUE
  /\ state' = 3
  /\ likeCount' = likeCount
  /\ userLiked' = userLiked

\* 完成重复点赞（liking_again → liked，likeCount 不变）
CompleteRepeatLike ==
  /\ state = 3
  /\ state' = 2
  /\ likeCount' = likeCount
  /\ userLiked' = userLiked

\* 取消点赞（liked → unliked，likeCount-1）
Unlike ==
  /\ state = 2
  /\ userLiked = TRUE
  /\ likeCount > 0
  /\ state' = 0
  /\ likeCount' = likeCount - 1
  /\ userLiked' = FALSE

\* 从 liked 回到 unliked（重置）
ResetToUnliked ==
  /\ state = 2
  /\ userLiked = FALSE
  /\ state' = 0
  /\ likeCount' = likeCount
  /\ userLiked' = userLiked

Next ==
  \/ FirstLikeRequest
  \/ CompleteFirstLike
  \/ RepeatLikeRequest
  \/ CompleteRepeatLike
  \/ Unlike
  \/ ResetToUnliked

Spec == Init /\ [][Next]_<<state, likeCount, userLiked>>

\* @designRef docs/interface-design.md#INTF-018 点赞状态始终在有效范围内
TypeInvariant == state \in States /\ likeCount \in LikeCounts /\ userLiked \in {TRUE, FALSE}

\* @designRef docs/interface-design.md#INTF-018 点赞状态边界约束
ValidLikeState == state >= 0 /\ state <= 3

\* @designRef docs/interface-design.md#INTF-018 likeCount 非负约束
LikeCountNonNegative == likeCount >= 0

\* @designRef docs/interface-design.md#INTF-018 幂等约束：重复点赞不增加 likeCount
IdempotentLike == state = 3 => likeCount' = likeCount

\* @designRef docs/interface-design.md#INTF-018 userLiked 与 likeCount 一致性约束
LikeStateConsistency == (userLiked = TRUE => likeCount > 0) \/ state = 0

\* @designRef docs/interface-design.md#INTF-018 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ ValidLikeState
  /\ LikeCountNonNegative
  /\ IdempotentLike
  /\ LikeStateConsistency

====
