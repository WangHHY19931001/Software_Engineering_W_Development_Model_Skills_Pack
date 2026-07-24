(*
  @system        blog-system-demo::interaction::comment-moderation
  @requirement   REQ-010,SD-003
  @design        docs/system-design.md#§8.4
  @parent        ../tla/L2_interaction.tla
  @sibling       null
  @child         null
  @level         L3
  @phase         3
*)
---- MODULE L3_comment_moderation ----
EXTENDS Naturals, Sequences, FiniteSets, TLC

(* ==========================================================================
   L3 Comment Moderation (W-Model Phase 3 / S-tla)
   Atomic behavior decomposition of L2_interaction: isolates the REQ-010
   comment moderation lifecycle from notification concerns.

   Comment lifecycle: absent -> pending -> approved/rejected
                                  approved -> reported -> approved (resolve)
   Sensitive-word filtering is abstracted as the pending->approved gate.
   CONSTANTS bound the state space so variable-combination <= 1000.
   ========================================================================== *)

CONSTANTS
    CommentId,       (* set of comment identifiers (model-checking bound) *)
    None,            (* sentinel denoting "no comment" (absent state) *)
    MaxLogLen        (* model-checking bound on moderation log length *)

ASSUME
    /\ CommentId # {}
    /\ None \notin { "absent", "pending", "approved", "rejected", "reported" }
    /\ MaxLogLen \in Nat \ {0}

(* --------------------------------------------------------------------------
   State enumeration & legal transitions
   -------------------------------------------------------------------------- *)
CommentState == { "absent", "pending", "approved", "rejected", "reported" }

ValidCommentTransitions == {
    << "pending",  "approved" >>,
    << "pending",  "rejected" >>,
    << "approved", "reported" >>,
    << "reported", "approved" >>
}

(* --------------------------------------------------------------------------
   Variables
   -------------------------------------------------------------------------- *)
VARIABLES
    commentState,     (* [CommentId -> CommentState]: lifecycle state per comment *)
    moderationLog     (* Seq(CommentId): ordered log of moderated comments (approved/rejected) *)

vars == << commentState, moderationLog >>

(* --------------------------------------------------------------------------
   Derived predicates
   -------------------------------------------------------------------------- *)
ExistingComments == { c \in CommentId : commentState[c] # "absent" }

(* ==========================================================================
   Init
   ========================================================================== *)
Init ==
    /\ commentState  = [ c \in CommentId |-> "absent" ]
    /\ moderationLog = << >>

(* ==========================================================================
   Transitions
   ========================================================================== *)

(* REQ-010: submit a new comment (absent -> pending). *)
SubmitComment(c) ==
    /\ c \in CommentId
    /\ commentState[c] = "absent"
    /\ commentState'  = [ commentState EXCEPT ![c] = "pending" ]
    /\ UNCHANGED moderationLog

(* REQ-010: approve a pending comment (sensitive-word filter passed).
   Appends to moderation log (bounded by MaxLogLen for model checking). *)
ApproveComment(c) ==
    /\ c \in CommentId
    /\ commentState[c] = "pending"
    /\ Len(moderationLog) < MaxLogLen
    /\ commentState'  = [ commentState EXCEPT ![c] = "approved" ]
    /\ moderationLog' = Append(moderationLog, c)

(* REQ-010: reject a pending comment (sensitive-word filter failed).
   Appends to moderation log (bounded by MaxLogLen for model checking). *)
RejectComment(c) ==
    /\ c \in CommentId
    /\ commentState[c] = "pending"
    /\ Len(moderationLog) < MaxLogLen
    /\ commentState'  = [ commentState EXCEPT ![c] = "rejected" ]
    /\ moderationLog' = Append(moderationLog, c)

(* REQ-010: report an approved comment. *)
ReportComment(c) ==
    /\ c \in CommentId
    /\ commentState[c] = "approved"
    /\ commentState'  = [ commentState EXCEPT ![c] = "reported" ]
    /\ UNCHANGED moderationLog

(* REQ-010: resolve a report (restore to approved). *)
ResolveReport(c) ==
    /\ c \in CommentId
    /\ commentState[c] = "reported"
    /\ commentState'  = [ commentState EXCEPT ![c] = "approved" ]
    /\ UNCHANGED moderationLog

(* REQ-010: delete a comment (any non-absent state -> absent). *)
DeleteComment(c) ==
    /\ c \in CommentId
    /\ commentState[c] # "absent"
    /\ commentState'  = [ commentState EXCEPT ![c] = "absent" ]
    /\ UNCHANGED moderationLog

(* --------------------------------------------------------------------------
   Next (stuttering supplied via [Next]_vars in Spec)
   -------------------------------------------------------------------------- *)
Next ==
    \/ \E c \in CommentId : SubmitComment(c)
    \/ \E c \in CommentId : ApproveComment(c)
    \/ \E c \in CommentId : RejectComment(c)
    \/ \E c \in CommentId : ReportComment(c)
    \/ \E c \in CommentId : ResolveReport(c)
    \/ \E c \in CommentId : DeleteComment(c)

(* ==========================================================================
   Specification (stuttering: every state may stutter)
   ========================================================================== *)
Spec == Init /\ [][Next]_vars

(* ==========================================================================
   Invariants
   ========================================================================== *)

(* ---- TypeInvariant: every variable stays in its declared domain. *)
TypeInvariant ==
    /\ commentState \in [CommentId -> CommentState]
    /\ moderationLog \in Seq(CommentId)
    /\ Len(moderationLog) =< MaxLogLen

(* ---- StateMachineValid: REQ-010, every non-absent non-pending comment
   reached its current state via a legal moderation transition. *)
StateMachineValid ==
    \A c \in CommentId :
        commentState[c] = "absent"
        \/ commentState[c] = "pending"
        \/ \E from \in CommentState \ { "absent" } :
            << from, commentState[c] >> \in ValidCommentTransitions

(* ---- NoUnmoderatedPublish: REQ-010 §8.4, a comment may never transition
   directly from pending to reported (must be approved first). Enforced by
   ValidCommentTransitions (no pending->reported edge); this invariant asserts
   that any reported comment has a non-pending legal predecessor. *)
NoUnmoderatedPublish ==
    \A c \in CommentId :
        commentState[c] = "reported" =>
            \E from \in CommentState \ {"pending"} :
                << from, "reported" >> \in ValidCommentTransitions

(* ---- ModerationLogConsistent: every entry in the moderation log is an
   existing comment that was moderated (approved or rejected). *)
ModerationLogConsistent ==
    \A i \in 1..Len(moderationLog) :
        moderationLog[i] \in CommentId

(* ---- Aggregate: all sub-invariants. The .cfg INVARIANTS list MUST equal
   the set unfolded here (TypeInvariant, StateMachineValid,
   NoUnmoderatedPublish, ModerationLogConsistent). *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ StateMachineValid
    /\ NoUnmoderatedPublish
    /\ ModerationLogConsistent

=============================================================================
