---- MODULE L3_category_cycle_check ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-014,INTF-014
  @design      docs/interface-design.md#INTF-014 分类管理接口 / docs/system-design.md#SD-014 分类管理模块
  @parent      tla/L2_taxonomy_subsystem.tla
  @sibling     null
  @child       null
  @level       L3
  @phase       3
*)

(*
 * L3 分类树无环校验原子行为规格：建模 DFS 检测 + 成环拒绝。
 * 状态流转：idle → adding_category → checking_cycle → no_cycle → committed
 *           checking_cycle → cycle_detected (60002, 拒绝成环)
 *           idle → updating_parent → checking_cycle → ...
 * 对应 INTF-014 (分类管理接口) / SD-014 (分类管理模块)。
 * 关键不变式：分类树无环（拒绝形成环的 parentCategoryId 修改）；DFS 三色染色检测。
 *)

VARIABLES state, hasCycle

\* 校验状态枚举：0=idle, 1=adding_category, 2=updating_parent, 3=checking_cycle, 4=no_cycle, 5=cycle_detected, 6=committed
States == 0..6

Init == state = 0 /\ hasCycle = FALSE

\* 添加分类（无父或父存在）
AddCategory ==
  /\ state = 0
  /\ state' = 1
  /\ hasCycle' = FALSE

\* 更新分类父节点（潜在成环风险）
UpdateParent ==
  /\ state = 0
  /\ state' = 2
  /\ hasCycle' = FALSE

\* 触发 DFS 三色染色检测
CheckCycle ==
  /\ state = 1 \/ state = 2
  /\ state' = 3
  /\ hasCycle' = hasCycle

\* DFS 检测无环
DetectNoCycle ==
  /\ state = 3
  /\ hasCycle = FALSE
  /\ state' = 4
  /\ hasCycle' = FALSE

\* DFS 检测到环
DetectCycle ==
  /\ state = 3
  /\ hasCycle = TRUE
  /\ state' = 5
  /\ hasCycle' = TRUE

\* 提交（无环时）
CommitChange ==
  /\ state = 4
  /\ state' = 6
  /\ hasCycle' = hasCycle

\* 提交完成回到 idle
ResetCommitted ==
  /\ state = 6
  /\ state' = 0
  /\ hasCycle' = FALSE

\* 成环拒绝回到 idle（恢复原 parentCategoryId）
ResetCycleDetected ==
  /\ state = 5
  /\ state' = 0
  /\ hasCycle' = FALSE

\* 无环但回退（撤销）
ResetNoCycle ==
  /\ state = 4
  /\ state' = 0
  /\ hasCycle' = FALSE

Next ==
  \/ AddCategory
  \/ UpdateParent
  \/ CheckCycle
  \/ DetectNoCycle
  \/ DetectCycle
  \/ CommitChange
  \/ ResetCommitted
  \/ ResetCycleDetected
  \/ ResetNoCycle

Spec == Init /\ [][Next]_<<state, hasCycle>>

\* @designRef docs/interface-design.md#INTF-014 校验状态始终在有效范围内
TypeInvariant == state \in States /\ hasCycle \in {TRUE, FALSE}

\* @designRef docs/interface-design.md#INTF-014 校验状态边界约束
ValidCheckState == state >= 0 /\ state <= 6

\* @designRef docs/interface-design.md#INTF-014 无环约束：committed 状态不允许 hasCycle=TRUE
NoCycleAllowed == state = 6 => hasCycle = FALSE

\* @designRef docs/interface-design.md#INTF-014 成环检测约束：cycle_detected 状态 hasCycle 必为 TRUE
CycleDetectionConsistency == state = 5 => hasCycle = TRUE

\* @designRef docs/interface-design.md#INTF-014 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ ValidCheckState
  /\ NoCycleAllowed
  /\ CycleDetectionConsistency

====
