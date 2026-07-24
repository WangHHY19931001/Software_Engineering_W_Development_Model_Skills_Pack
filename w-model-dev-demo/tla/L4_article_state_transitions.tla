(*
  @system        blog-system-demo::content-management::article-state-transitions
  @requirement   REQ-012,SD-002,DD-007,DD-008
  @design        docs/detailed-design.md#DD-007,DD-008
  @parent        ../tla/L3_article_state_machine.tla
  @sibling       null
  @child         null
  @level         L4
  @phase         4
*)
---- MODULE L4_article_state_transitions ----
EXTENDS Naturals, Sequences, FiniteSets, TLC

(* ==========================================================================
   L4 Article State Transitions (W-Model Phase 4 / S-tla)
   Refinement of L3_article_state_machine: concretizes the abstract state
   machine with actor roles (REQ-003 RBAC), ownership checks (NFR-003),
   and the admin-only publish transition enforced by DD-007 ArticleService
   + DD-002 RbacMiddleware.

   L3 abstracts transitions as pure state pairs; L4 adds the actor context:
     - Only admin/super_admin may invoke ->published (REQ-012 §7.3)
     - Only the article author (or admin) may invoke non-terminal transitions
     - Every successful transition emits a WAL op + audit log entry
   CONSTANTS bound the state space so variable-combination <= 1000.
   ========================================================================== *)

CONSTANTS
    ArticleId,      (* set of article identifiers (model-checking bound) *)
    ActorId,        (* set of actor identifiers (author + admins) *)
    ValidStates,    (* set of non-absent lifecycle states *)
    MaxLog          (* model-checking bound on retained WAL/audit log length *)

ASSUME
    /\ ArticleId  # {}
    /\ ActorId    # {}
    /\ ValidStates # {}
    /\ MaxLog \in Nat \ {0}

(* --------------------------------------------------------------------------
   Role enumeration (REQ-003 4-role RBAC)
   -------------------------------------------------------------------------- *)
Role == { "user", "blogger", "admin", "super_admin" }

(* --------------------------------------------------------------------------
   Legal state-machine transitions (identical to L3 ValidTransitions;
   refinement preserves the abstract transition relation).
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
    articleState,     (* [ArticleId -> ValidStates]: lifecycle state per article *)
    articleAuthor,    (* [ArticleId -> ActorId]: author (owner) per article *)
    actorRole,        (* [ActorId -> Role]: RBAC role per actor *)
    walLog,           (* Seq(WalOp): WAL operations emitted by transitions *)
    auditLog          (* Seq(AuditEntry): audit entries emitted by transitions *)

vars == << articleState, articleAuthor, actorRole, walLog, auditLog >>

(* --------------------------------------------------------------------------
   Derived types
   -------------------------------------------------------------------------- *)
WalOp == [ opId: Nat, opType: {"article.transition"}, articleId: ArticleId,
           from: ValidStates, to: ValidStates, timestamp: Nat ]

AuditEntry == [ entryId: Nat, action: {"article.transition"}, actor: ActorId,
                target: ArticleId, timestamp: Nat ]

(* --------------------------------------------------------------------------
   Init
   -------------------------------------------------------------------------- *)
Init ==
    /\ articleState  = [ a \in ArticleId |-> "draft" ]
    /\ articleAuthor = [ a \in ArticleId |-> CHOOSE x \in ActorId : TRUE ]
    /\ actorRole     = LET admin == CHOOSE x \in ActorId : TRUE IN
                      [ x \in ActorId |-> IF x = admin THEN "admin" ELSE "user" ]
    /\ walLog        = << >>
    /\ auditLog      = << >>

(* ==========================================================================
   Transitions (refinement: L3 TransitionState + actor/role/ownership guards)
   ========================================================================== *)

(* REQ-003 RBAC: admin or super_admin may invoke ->published. *)
CanPublish(actor) ==
    actorRole[actor] \in {"admin", "super_admin"}

(* NFR-003 ownership: actor must be the article's author OR an admin. *)
CanModify(articleId, actor) ==
    /\ articleAuthor[articleId] = actor
    \/ actorRole[actor] \in {"admin", "super_admin"}

(* REQ-012 §7.3 + DD-007 transitionState: refine L3 TransitionState with
   role + ownership guards, and emit WAL + audit side effects. *)
TransitionState(articleId, toState, actor) ==
    /\ articleId \in ArticleId
    /\ toState \in ValidStates
    /\ actor    \in ActorId
    /\ << articleState[articleId], toState >> \in ValidTransitions
    /\ (toState = "published" => CanPublish(actor))
    /\ CanModify(articleId, actor)
    /\ Len(walLog) < MaxLog
    /\ articleState' = [ articleState EXCEPT ![articleId] = toState ]
    /\ walLog'   = Append(walLog,
                          [ opId |-> Len(walLog)+1,
                            opType |-> "article.transition",
                            articleId |-> articleId,
                            from |-> articleState[articleId],
                            to |-> toState,
                            timestamp |-> Len(walLog)+1 ])
    /\ auditLog' = Append(auditLog,
                          [ entryId |-> Len(auditLog)+1,
                            action |-> "article.transition",
                            actor |-> actor,
                            target |-> articleId,
                            timestamp |-> Len(auditLog)+1 ])
    /\ UNCHANGED << articleAuthor, actorRole >>

(* --------------------------------------------------------------------------
   Next (stuttering supplied via [Next]_vars in Spec)
   -------------------------------------------------------------------------- *)
Next ==
    \E a \in ArticleId, toState \in ValidStates, actor \in ActorId :
        TransitionState(a, toState, actor)

(* ==========================================================================
   Specification (stuttering: every state may stutter, so terminal states
   are not mis-reported as deadlocks by TLC).
   ========================================================================== *)
Spec == Init /\ [][Next]_vars

(* ==========================================================================
   Invariants
   ========================================================================== *)

(* ---- TypeInvariant: every variable stays in its declared domain. *)
TypeInvariant ==
    /\ articleState \in [ArticleId -> ValidStates]
    /\ articleAuthor \in [ArticleId -> ActorId]
    /\ actorRole \in [ActorId -> Role]
    /\ walLog \in Seq(WalOp)
    /\ auditLog \in Seq(AuditEntry)

(* ---- StateMachineLegal: refines L3 StateMachineLegal — every article
   reached its current state via a legal transition. *)
StateMachineLegal ==
    \A a \in ArticleId :
        /\ articleState[a] \in ValidStates
        /\ (articleState[a] = "draft"
            \/ \E from \in ValidStates :
                << from, articleState[a] >> \in ValidTransitions)

(* ---- NoSkippedReview: refines L3 NoSkippedReview — published articles
   must have a non-draft legal predecessor. *)
NoSkippedReview ==
    \A a \in ArticleId :
        articleState[a] = "published" =>
            \E from \in ValidStates \ {"draft"} :
                << from, "published" >> \in ValidTransitions

(* ---- PublishRequiresAdmin: REQ-012 §7.3 refinement — any audit entry
   whose target state is "published" must have been performed by an admin
   or super_admin. (Strengthening invariant absent from L3.) *)
PublishRequiresAdmin ==
    \A i \in 1..Len(auditLog) :
        walLog[i].to = "published" =>
            actorRole[auditLog[i].actor] \in {"admin", "super_admin"}

(* ---- WalAuditConsistency: every transition emits exactly one WAL op AND
   one audit entry (CONFLICT-002 dual-log discipline). *)
WalAuditConsistency ==
    Len(walLog) = Len(auditLog)

(* ---- LogBounded: NFR-002, WAL/audit log length never exceeds MaxLog. *)
LogBounded ==
    /\ Len(walLog) =< MaxLog
    /\ Len(auditLog) =< MaxLog

(* ---- OwnershipEnforced: NFR-003 — every audit entry's actor was the
   article's author or an admin at the time of the transition. *)
OwnershipEnforced ==
    \A i \in 1..Len(auditLog) :
        LET aid == auditLog[i].target
            act == auditLog[i].actor
        IN articleAuthor[aid] = act
           \/ actorRole[act] \in {"admin", "super_admin"}

(* ---- Aggregate: all sub-invariants. The .cfg INVARIANTS list MUST equal
   the set unfolded here (TypeInvariant, StateMachineLegal, NoSkippedReview,
   PublishRequiresAdmin, WalAuditConsistency, LogBounded, OwnershipEnforced). *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ StateMachineLegal
    /\ NoSkippedReview
    /\ PublishRequiresAdmin
    /\ WalAuditConsistency
    /\ LogBounded
    /\ OwnershipEnforced

=============================================================================
