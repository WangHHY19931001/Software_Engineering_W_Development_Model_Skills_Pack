---- MODULE L2_comment_subsystem ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-010,SD-011,SD-012
  @design      docs/system-design.md#SD-010 评论创建模块 / SD-011 评论列表查询模块 / SD-012 评论删除模块
  @parent      tla/L1_blog_system.tla
  @sibling     null
  @child       null
  @level       L2
  @phase       2
*)

(*
 * L2 评论子系统规格：建模评论增删查状态机。
 * 状态流转：idle → creating → created → listing/deleting → idle
 * 对应 SD-010 (评论创建) / SD-011 (评论列表) / SD-012 (评论删除)。
 *)

VARIABLES state

\* 评论状态枚举：0=idle, 1=creating, 2=created, 3=listing, 4=deleting, 5=deleted
States == 0..5

Init == state = 0

\* 创建评论（SD-010）
CreateComment ==
  /\ state = 0
  /\ state' = 1

\* 创建完成
CompleteCreateComment ==
  /\ state = 1
  /\ state' = 2

\* 查询评论列表（SD-011）
ListComments ==
  /\ state = 2
  /\ state' = 3

\* 查询完成
CompleteListComments ==
  /\ state = 3
  /\ state' = 2

\* 删除评论（SD-012）
DeleteComment ==
  /\ state = 2
  /\ state' = 4

\* 删除完成
CompleteDeleteComment ==
  /\ state = 4
  /\ state' = 5

\* 删除后回到 idle
ResetDeletedComment ==
  /\ state = 5
  /\ state' = 0

\* 从 created 回到 idle
ResetCreatedComment ==
  /\ state = 2
  /\ state' = 0

Next ==
  \/ CreateComment
  \/ CompleteCreateComment
  \/ ListComments
  \/ CompleteListComments
  \/ DeleteComment
  \/ CompleteDeleteComment
  \/ ResetDeletedComment
  \/ ResetCreatedComment

Spec == Init /\ [][Next]_state

\* @designRef docs/system-design.md#SD-010 评论状态始终在有效范围内
TypeInvariant == state \in States

\* @designRef docs/system-design.md#SD-010 评论状态边界约束
ValidCommentState == state >= 0 /\ state <= 5

\* @designRef docs/system-design.md#SD-010 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ ValidCommentState

====
