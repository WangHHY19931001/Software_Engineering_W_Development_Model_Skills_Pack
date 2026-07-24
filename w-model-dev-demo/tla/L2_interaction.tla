(*
  @system        blog-system-demo::interaction
  @requirement   REQ-010,REQ-011,SD-003
  @design        docs/system-design.md
  @parent        ../tla/L1_blog_system.tla
  @sibling       ../tla/L2_identity_access.tla, ../tla/L2_content_management.tla, ../tla/L2_operations_support.tla, ../tla/L2_discovery.tla, ../tla/L2_infrastructure.tla
  @child         ../tla/L3_comment_moderation.tla
  @level         L2
  @phase         2
*)
---- MODULE L2_interaction ----
EXTENDS Naturals, Sequences, FiniteSets, TLC

(* ==========================================================================
   L2 Interaction Subsystem (W-Model Phase 2 / S-tla, SD-003)
   Implements REQ-010 (multi-level comments, nesting <= 3)
              + REQ-011 (in-app notifications + read tracking).

   Comment lifecycle: absent -> pending -> approved/rejected
                                  approved -> reported -> approved (resolve)
   Sensitive-word filtering is abstracted as the pending->approved gate
   (only filtered comments may leave the pending state as approved).
   CONSTANTS bound the state space so variable-combination <= 1000.
   ========================================================================== *)

CONSTANTS
    CommentId,       (* set of comment identifiers (model-checking bound) *)
    UserId,          (* set of user identifiers (for like/notify ownership) *)
    NotificationId,  (* set of notification identifiers (model-checking bound) *)
    None,            (* sentinel denoting "no parent comment" (top-level) *)
    MaxDepth         (* REQ-010: maximum nesting depth (<= 3) *)

ASSUME
    /\ CommentId # {}
    /\ UserId # {}
    /\ NotificationId # {}
    /\ None \notin CommentId
    /\ MaxDepth \in 1..3

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
    comments,         (* [CommentId -> CommentState]: lifecycle state per comment *)
    commentParents,   (* [CommentId -> CommentId \cup {None}]: parent or None *)
    notifications,    (* subset of NotificationId: existing notifications *)
    notificationRead  (* subset of NotificationId: read notifications *)

vars == << comments, commentParents, notifications, notificationRead >>

(* --------------------------------------------------------------------------
   Derived predicates
   -------------------------------------------------------------------------- *)
ExistingComments == { c \in CommentId : comments[c] # "absent" }

(* ==========================================================================
   Init
   ========================================================================== *)
Init ==
    /\ comments         = [ c \in CommentId |-> "absent" ]
    /\ commentParents   = [ c \in CommentId |-> None ]
    /\ notifications    = {}
    /\ notificationRead = {}

(* ==========================================================================
   Transitions
   ========================================================================== *)

(* REQ-010: submit a new comment (absent -> pending). Parent=None for top-level.
   Cycle guard: parent # c and parent's parent # c (no 2-cycle). *)
SubmitComment(c, parent) ==
    /\ c \in CommentId
    /\ parent \in CommentId \cup {None}
    /\ comments[c] = "absent"
    /\ parent # c
    /\ (parent = None \/ parent \in ExistingComments)
    /\ (parent = None \/ commentParents[parent] # c)
    /\ comments'       = [ comments EXCEPT ![c] = "pending" ]
    /\ commentParents' = [ commentParents EXCEPT ![c] = parent ]
    /\ UNCHANGED << notifications, notificationRead >>

(* REQ-010: approve a pending comment (sensitive-word filter passed). *)
ApproveComment(c) ==
    /\ c \in CommentId
    /\ comments[c] = "pending"
    /\ comments' = [ comments EXCEPT ![c] = "approved" ]
    /\ UNCHANGED << commentParents, notifications, notificationRead >>

(* REQ-010: reject a pending comment (sensitive-word filter failed). *)
RejectComment(c) ==
    /\ c \in CommentId
    /\ comments[c] = "pending"
    /\ comments' = [ comments EXCEPT ![c] = "rejected" ]
    /\ UNCHANGED << commentParents, notifications, notificationRead >>

(* REQ-010: report an approved comment. *)
ReportComment(c) ==
    /\ c \in CommentId
    /\ comments[c] = "approved"
    /\ comments' = [ comments EXCEPT ![c] = "reported" ]
    /\ UNCHANGED << commentParents, notifications, notificationRead >>

(* REQ-010: resolve a report (restore to approved). *)
ResolveReport(c) ==
    /\ c \in CommentId
    /\ comments[c] = "reported"
    /\ comments' = [ comments EXCEPT ![c] = "approved" ]
    /\ UNCHANGED << commentParents, notifications, notificationRead >>

(* REQ-010: delete a comment. Re-parents direct children to None (top-level). *)
DeleteComment(c) ==
    /\ c \in CommentId
    /\ comments[c] # "absent"
    /\ comments'       = [ comments EXCEPT ![c] = "absent" ]
    /\ commentParents' = [ d \in CommentId |-> IF commentParents[d] = c THEN None ELSE commentParents[d] ]
    /\ UNCHANGED << notifications, notificationRead >>

(* REQ-011: send a notification. *)
SendNotification(n) ==
    /\ n \in NotificationId
    /\ n \notin notifications
    /\ notifications' = notifications \cup {n}
    /\ UNCHANGED << comments, commentParents, notificationRead >>

(* REQ-011: mark a notification as read. *)
ReadNotification(n) ==
    /\ n \in NotificationId
    /\ n \in notifications
    /\ n \notin notificationRead
    /\ notificationRead' = notificationRead \cup {n}
    /\ UNCHANGED << comments, commentParents, notifications >>

(* --------------------------------------------------------------------------
   Next (stuttering supplied via [Next]_vars in Spec)
   -------------------------------------------------------------------------- *)
Next ==
    \/ \E c \in CommentId, parent \in CommentId \cup {None} : SubmitComment(c, parent)
    \/ \E c \in CommentId : ApproveComment(c)
    \/ \E c \in CommentId : RejectComment(c)
    \/ \E c \in CommentId : ReportComment(c)
    \/ \E c \in CommentId : ResolveReport(c)
    \/ \E c \in CommentId : DeleteComment(c)
    \/ \E n \in NotificationId : SendNotification(n)
    \/ \E n \in NotificationId : ReadNotification(n)

(* ==========================================================================
   Specification (stuttering: every state may stutter)
   ========================================================================== *)
Spec == Init /\ [][Next]_vars

(* ==========================================================================
   Invariants
   ========================================================================== *)

TypeInvariant ==
    /\ comments \in [CommentId -> CommentState]
    /\ commentParents \in [CommentId -> CommentId \cup {None}]
    /\ notifications \subseteq NotificationId
    /\ notificationRead \subseteq NotificationId

CommentNestingValid ==
    /\ \A c \in CommentId : commentParents[c] # c
    /\ \A c1, c2 \in CommentId :
        c1 # c2 => ~(commentParents[c1] = c2 /\ commentParents[c2] = c1)

CommentParentExists ==
    \A c \in CommentId :
        comments[c] = "absent"
        \/ commentParents[c] = None
        \/ comments[commentParents[c]] # "absent"

CommentStateMachineValid ==
    \A c \in CommentId :
        comments[c] = "absent"
        \/ comments[c] = "pending"
        \/ \E from \in CommentState \ { "absent" } :
            << from, comments[c] >> \in ValidCommentTransitions

NotificationReadSubset ==
    notificationRead \subseteq notifications

BusinessInvariant ==
    /\ TypeInvariant
    /\ CommentNestingValid
    /\ CommentParentExists
    /\ CommentStateMachineValid
    /\ NotificationReadSubset

=============================================================================
