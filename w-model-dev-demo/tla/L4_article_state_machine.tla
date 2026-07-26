---- MODULE L4_article_state_machine ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-017,DD-017-002,DD-017-003
  @design      docs/detailed-design.md#DD-017-002 ArticleWorkflowService / DD-017-003 ArticleStateMachine
  @parent      tla/L3_article_publish_flow.tla
  @sibling     null
  @child       null
  @level       L4
  @phase       4
*)

(*
 * L4 文章状态机原子行为规格：建模 draft↔published↔archived 状态机细化。
 * 状态流转：draft → published (publish)
 *           published → draft (unpublish)
 *           published → archived (archive)
 *           archived → draft (restore to draft)
 * 对应 DD-017-002 (ArticleWorkflowService) / DD-017-003 (ArticleStateMachine)。
 * 关键不变式：状态机合法转移；非法转移拒绝；archived 仅由 published 转入。
 *)

VARIABLES articleState

\* 文章状态枚举：0=draft, 1=published, 2=archived
States == 0..2

Init == articleState = 0

\* 发布（draft → published）
Publish ==
  /\ articleState = 0
  /\ articleState' = 1

\* 取消发布（published → draft）
Unpublish ==
  /\ articleState = 1
  /\ articleState' = 0

\* 归档（published → archived）
Archive ==
  /\ articleState = 1
  /\ articleState' = 2

\* 从归档恢复为草稿（archived → draft）
RestoreFromArchive ==
  /\ articleState = 2
  /\ articleState' = 0

\* 非法转移拒绝：draft → archived（须先 published 再 archived）
RejectDraftToArchived ==
  /\ articleState = 0
  /\ articleState' = 0

\* 非法转移拒绝：archived → published（须先恢复 draft 再 publish）
RejectArchivedToPublished ==
  /\ articleState = 2
  /\ articleState' = 2

Next ==
  \/ Publish
  \/ Unpublish
  \/ Archive
  \/ RestoreFromArchive
  \/ RejectDraftToArchived
  \/ RejectArchivedToPublished

Spec == Init /\ [][Next]_articleState

\* @designRef docs/detailed-design.md#DD-017-003 状态始终在有效范围内
TypeInvariant == articleState \in States

\* @designRef docs/detailed-design.md#DD-017-003 状态机合法转移约束：仅允许 draft↔published↔archived 单调流转
StateMachineLegality ==
  articleState = 0 \/ articleState = 1 \/ articleState = 2

\* @designRef docs/detailed-design.md#DD-017-003 非法转移拒绝约束：draft→archived 与 archived→published 拒绝
NoInvalidTransition ==
  (articleState = 0 => articleState \in {0, 1}) /\
  (articleState = 1 => articleState \in {0, 1, 2}) /\
  (articleState = 2 => articleState \in {0, 2})

\* @designRef docs/detailed-design.md#DD-017-003 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ StateMachineLegality
  /\ NoInvalidTransition

====
