---- MODULE L2_search_archive_subsystem ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-015,SD-022
  @design      docs/system-design.md#SD-015 文章搜索模块 / SD-022 文章归档查询模块
  @parent      tla/L1_blog_system.tla
  @sibling     null
  @child       null
  @level       L2
  @phase       2
*)

(*
 * L2 搜索归档子系统规格：建模搜索/归档查询状态机。
 * 状态流转：idle → searching → search_done → idle
 *           idle → archiving → archive_done → idle
 * 对应 SD-015 (文章搜索) / SD-022 (文章归档)。
 *)

VARIABLES state

\* 搜索归档状态枚举：0=idle, 1=searching, 2=search_done, 3=archiving, 4=archive_done
States == 0..4

Init == state = 0

\* 执行搜索（SD-015）
Search ==
  /\ state = 0
  /\ state' = 1

\* 搜索完成
CompleteSearch ==
  /\ state = 1
  /\ state' = 2

\* 搜索结果返回
ResetSearch ==
  /\ state = 2
  /\ state' = 0

\* 执行归档查询（SD-022）
Archive ==
  /\ state = 0
  /\ state' = 3

\* 归档查询完成
CompleteArchive ==
  /\ state = 3
  /\ state' = 4

\* 归档结果返回
ResetArchive ==
  /\ state = 4
  /\ state' = 0

Next ==
  \/ Search
  \/ CompleteSearch
  \/ ResetSearch
  \/ Archive
  \/ CompleteArchive
  \/ ResetArchive

Spec == Init /\ [][Next]_state

\* @designRef docs/system-design.md#SD-015 搜索归档状态始终在有效范围内
TypeInvariant == state \in States

\* @designRef docs/system-design.md#SD-015 搜索归档状态边界约束
ValidSearchState == state >= 0 /\ state <= 4

\* @designRef docs/system-design.md#SD-015 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ ValidSearchState

====
