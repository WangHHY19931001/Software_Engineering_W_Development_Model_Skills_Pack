---- MODULE L2_article_crud_subsystem ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-005,SD-006,SD-007,SD-008,SD-009
  @design      docs/system-design.md#SD-005 文章创建模块 / SD-006 文章列表查询模块 / SD-007 文章详情查询模块 / SD-008 文章更新模块 / SD-009 文章删除模块
  @parent      tla/L1_blog_system.tla
  @sibling     null
  @child       null
  @level       L2
  @phase       2
*)

(*
 * L2 文章 CRUD 子系统规格：建模文章增删改查状态机。
 * 状态流转：idle → creating → created → reading/updating/deleting → idle
 * 对应 SD-005~SD-009 (文章 CRUD)。
 *)

VARIABLES state

\* CRUD 状态枚举：0=idle, 1=creating, 2=created, 3=reading, 4=updating, 5=deleting, 6=deleted
States == 0..6

Init == state = 0

\* 创建文章（SD-005）
Create ==
  /\ state = 0
  /\ state' = 1

\* 创建完成
CompleteCreate ==
  /\ state = 1
  /\ state' = 2

\* 查询文章列表/详情（SD-006, SD-007）
Read ==
  /\ state = 2
  /\ state' = 3

\* 查询完成
CompleteRead ==
  /\ state = 3
  /\ state' = 2

\* 更新文章（SD-008）
Update ==
  /\ state = 2
  /\ state' = 4

\* 更新完成
CompleteUpdate ==
  /\ state = 4
  /\ state' = 2

\* 删除文章（SD-009）
Delete ==
  /\ state = 2
  /\ state' = 5

\* 删除完成
CompleteDelete ==
  /\ state = 5
  /\ state' = 6

\* 删除后回到 idle
ResetDeleted ==
  /\ state = 6
  /\ state' = 0

\* 从 created 回到 idle
ResetCreated ==
  /\ state = 2
  /\ state' = 0

Next ==
  \/ Create
  \/ CompleteCreate
  \/ Read
  \/ CompleteRead
  \/ Update
  \/ CompleteUpdate
  \/ Delete
  \/ CompleteDelete
  \/ ResetDeleted
  \/ ResetCreated

Spec == Init /\ [][Next]_state

\* @designRef docs/system-design.md#SD-005 CRUD 状态始终在有效范围内
TypeInvariant == state \in States

\* @designRef docs/system-design.md#SD-005 CRUD 状态边界约束
ValidCrudState == state >= 0 /\ state <= 6

\* @designRef docs/system-design.md#SD-005 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ ValidCrudState

====
