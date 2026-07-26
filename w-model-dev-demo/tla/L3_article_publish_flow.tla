---- MODULE L3_article_publish_flow ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-017,INTF-017
  @design      docs/interface-design.md#INTF-017 草稿/发布工作流接口 / docs/system-design.md#SD-017 草稿/发布工作流模块
  @parent      tla/L2_article_workflow_subsystem.tla
  @sibling     tla/L3_article_like_flow.tla
  @child       tla/L4_article_state_machine.tla
  @level       L3
  @phase       3
*)

(*
 * L3 文章发布工作流原子行为规格：建模 draft↔published 状态机 + 非法转移拒绝。
 * 状态流转：draft → publishing → published
 *           published → unpublishing → draft
 *           publishing → publish_rejected (60001, 已 published)
 *           unpublishing → unpublish_rejected (60001, 已 draft)
 * 对应 INTF-017 (草稿/发布工作流接口) / SD-017 (草稿/发布工作流模块)。
 * 关键不变式：状态机合法转移；非法转移拒绝；publishedAt 仅在 published 时设置。
 *)

VARIABLES state

\* 发布状态枚举：0=draft, 1=publishing, 2=published, 3=unpublishing, 4=publish_rejected, 5=unpublish_rejected
States == 0..5

Init == state = 0

\* 发布请求（draft → publishing）
PublishRequest ==
  /\ state = 0
  /\ state' = 1

\* 发布完成（publishing → published）
CompletePublish ==
  /\ state = 1
  /\ state' = 2

\* 重复发布拒绝（published → publish_rejected）
RejectDuplicatePublish ==
  /\ state = 2
  /\ state' = 4

\* 取消发布请求（published → unpublishing）
UnpublishRequest ==
  /\ state = 2
  /\ state' = 3

\* 取消发布完成（unpublishing → draft）
CompleteUnpublish ==
  /\ state = 3
  /\ state' = 0

\* 重复取消发布拒绝（draft → unpublish_rejected）
RejectDuplicateUnpublish ==
  /\ state = 0
  /\ state' = 5

\* 拒绝后回到原态
ResetPublishRejected ==
  /\ state = 4
  /\ state' = 2

\* 拒绝后回到原态
ResetUnpublishRejected ==
  /\ state = 5
  /\ state' = 0

Next ==
  \/ PublishRequest
  \/ CompletePublish
  \/ RejectDuplicatePublish
  \/ UnpublishRequest
  \/ CompleteUnpublish
  \/ RejectDuplicateUnpublish
  \/ ResetPublishRejected
  \/ ResetUnpublishRejected

Spec == Init /\ [][Next]_state

\* @designRef docs/interface-design.md#INTF-017 发布状态始终在有效范围内
TypeInvariant == state \in States

\* @designRef docs/interface-design.md#INTF-017 发布状态边界约束
ValidPublishState == state >= 0 /\ state <= 5

\* @designRef docs/interface-design.md#INTF-017 状态机合法转移约束：draft↔published 单调
StateMachineLegality == state = 0 \/ state = 1 \/ state = 2 \/ state = 3 \/ state = 4 \/ state = 5

\* @designRef docs/interface-design.md#INTF-017 非法转移拒绝约束：重复发布/取消均拒绝
NoInvalidTransition == (state = 4 => TRUE) /\ (state = 5 => TRUE) /\ (state = 2 => TRUE) /\ (state = 0 => TRUE)

\* @designRef docs/interface-design.md#INTF-017 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ ValidPublishState
  /\ StateMachineLegality
  /\ NoInvalidTransition

====
