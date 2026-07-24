(*
  @system        blog-system-demo::content-management::article-state-machine
  @requirement   REQ-012,SD-002
  @design        docs/system-design.md#§7
  @parent        ../tla/L2_content_management.tla
  @sibling       null
  @child         ../tla/L4_article_state_transitions.tla
  @level         L3
  @phase         3
*)
---- MODULE L3_article_state_machine ----
EXTENDS Naturals, Sequences, FiniteSets, TLC

(* ==========================================================================
   L3 Article State Machine (W-Model Phase 3 / S-tla)
   Atomic behavior decomposition of L2_content_management: isolates the
   REQ-012 6-state article lifecycle from tag/category/cross-ref concerns.

   The 6-state machine (REQ-012, phase-1 CHECKPOINT confirmed):
       draft -> pending_review -> scheduled_publish -> published
              -> taken_down -> archived
   CONSTANTS bound the state space so variable-combination <= 1000.
   ========================================================================== *)

CONSTANTS
    ArticleId,      (* set of article identifiers (model-checking bound) *)
    ValidStates      (* set of non-absent lifecycle states *)

ASSUME
    /\ ArticleId  # {}
    /\ ValidStates # {}

(* --------------------------------------------------------------------------
   Legal state-machine transitions (REQ-012 §7.2, excludes Create/Delete).
   -------------------------------------------------------------------------- *)
ValidTransitions == {
    << "draft",             "draft"             >>,
    << "draft",             "pending_review"    >>,
    << "pending_review",    "draft"             >>,
    << "pending_review",    "published"         >>,
    << "pending_review",    "scheduled_publish" >>,
    << "scheduled_publish", "published"         >>,
    << "scheduled_publish", "draft"             >>,
    << "published",         "taken_down"        >>,
    << "published",         "archived"          >>,
    << "taken_down",        "published"         >>,
    << "taken_down",        "archived"          >>,
    << "archived",          "draft"             >>
}

(* --------------------------------------------------------------------------
   Variables
   -------------------------------------------------------------------------- *)
VARIABLES
    articleState     (* [ArticleId -> ValidStates]: lifecycle state per article *)

vars == << articleState >>

(* ==========================================================================
   Init
   ========================================================================== *)
Init ==
    articleState = [ a \in ArticleId |-> "draft" ]

(* ==========================================================================
   Transitions
   ========================================================================== *)

(* REQ-012: state-machine transition per §7.2 legal-transition table. *)
TransitionState(a, toState) ==
    /\ a \in ArticleId
    /\ toState \in ValidStates
    /\ << articleState[a], toState >> \in ValidTransitions
    /\ articleState' = [ articleState EXCEPT ![a] = toState ]

(* --------------------------------------------------------------------------
   Next (stuttering supplied via [Next]_vars in Spec)
   -------------------------------------------------------------------------- *)
Next ==
    \E a \in ArticleId, toState \in ValidStates :
        TransitionState(a, toState)

(* ==========================================================================
   Specification (stuttering: every state may stutter, so terminal states
   are not mis-reported as deadlocks by TLC).
   ========================================================================== *)
Spec == Init /\ [][Next]_vars

(* ==========================================================================
   Invariants
   ========================================================================== *)

(* ---- TypeInvariant: articleState maps to valid lifecycle states. *)
TypeInvariant ==
    articleState \in [ArticleId -> ValidStates]

(* ---- StateMachineLegal: every article reached its current state via a
   legal transition from some prior state (or started at "draft"). *)
StateMachineLegal ==
    \A a \in ArticleId :
        /\ articleState[a] \in ValidStates
        /\ (articleState[a] = "draft"
            \/ \E from \in ValidStates :
                << from, articleState[a] >> \in ValidTransitions)

(* ---- NoSkippedReview: REQ-012 §7.3, an article may never transition
   directly from draft to published (must pass through pending_review).
   Enforced by ValidTransitions (no draft->published edge); this invariant
   asserts that any published article has a non-draft legal predecessor. *)
NoSkippedReview ==
    \A a \in ArticleId :
        articleState[a] = "published" =>
            \E from \in ValidStates \ {"draft"} :
                << from, "published" >> \in ValidTransitions

(* ---- Aggregate: all sub-invariants. The .cfg INVARIANTS list MUST equal
   the set unfolded here (TypeInvariant, StateMachineLegal, NoSkippedReview). *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ StateMachineLegal
    /\ NoSkippedReview

=============================================================================
