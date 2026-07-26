---- MODULE L2_taxonomy_subsystem ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-013,SD-014
  @design      docs/system-design.md#SD-013 标签管理模块 / SD-014 分类管理模块
  @parent      tla/L1_blog_system.tla
  @sibling     null
  @child       tla/L3_category_cycle_check.tla
  @level       L2
  @phase       2
*)

(*
 * L2 分类法子系统规格：建模标签/分类 CRUD + 分类树无环约束状态机。
 * 状态流转：idle → creating → created → updating → created → deleting → idle
 * 对应 SD-013 (标签管理) / SD-014 (分类管理)。
 *)

VARIABLES state

\* 分类法状态枚举：0=idle, 1=creating, 2=created, 3=updating, 4=deleting, 5=checking_cycle
States == 0..5

Init == state = 0

\* 创建标签/分类（SD-013, SD-014）
CreateTaxonomy ==
  /\ state = 0
  /\ state' = 1

\* 创建完成
CompleteCreate ==
  /\ state = 1
  /\ state' = 2

\* 更新标签/分类
UpdateTaxonomy ==
  /\ state = 2
  /\ state' = 3

\* 更新完成
CompleteUpdate ==
  /\ state = 3
  /\ state' = 2

\* 删除标签/分类
DeleteTaxonomy ==
  /\ state = 2
  /\ state' = 4

\* 删除完成
CompleteDelete ==
  /\ state = 4
  /\ state' = 0

\* 分类树无环校验（SD-014 无环约束）
CheckCycle ==
  /\ state = 3
  /\ state' = 5

\* 校验完成（无环）
CompleteCheckCycle ==
  /\ state = 5
  /\ state' = 3

Next ==
  \/ CreateTaxonomy
  \/ CompleteCreate
  \/ UpdateTaxonomy
  \/ CompleteUpdate
  \/ DeleteTaxonomy
  \/ CompleteDelete
  \/ CheckCycle
  \/ CompleteCheckCycle

Spec == Init /\ [][Next]_state

\* @designRef docs/system-design.md#SD-013 分类法状态始终在有效范围内
TypeInvariant == state \in States

\* @designRef docs/system-design.md#SD-013 分类法状态边界约束
ValidTaxonomyState == state >= 0 /\ state <= 5

\* @designRef docs/system-design.md#SD-014 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ ValidTaxonomyState

====
