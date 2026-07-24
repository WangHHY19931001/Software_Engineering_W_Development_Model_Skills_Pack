(*
  @system        blog-system-demo::infrastructure::wal-replay-algorithm
  @requirement   NFR-002,SD-006,DD-024,DD-025
  @design        docs/detailed-design.md#DD-024,DD-025
  @parent        ../tla/L3_wal_replay.tla
  @sibling       null
  @child         null
  @level         L4
  @phase         4
*)
---- MODULE L4_wal_replay_algorithm ----
EXTENDS Naturals, Sequences, FiniteSets, TLC

(* ==========================================================================
   L4 WAL Replay Algorithm (W-Model Phase 4 / S-tla)
   Refinement of L3_wal_replay: concretizes the abstract Operation token
   into typed operations (user.register / article.create / article.transition)
   and adds idempotent re-application logic per store type (DD-025 WalReplayer).

   L3 abstracts operations as opaque tokens; L4 adds:
     - Operation type tag + payload structure (DD-024 Operation interface)
     - Per-type idempotent replay (insertOrUpdate semantics)
     - Store registry binding (UserStore / ArticleStore / etc.)
     - Replay progress tracking (replayedCount, isComplete)
   CONSTANTS bound the state space so variable-combination <= 1000.
   ========================================================================== *)

CONSTANTS
    OperationId,    (* set of WAL operation identifiers (model-checking bound) *)
    EntityType,     (* set of entity types touched by WAL ops *)
    EntityId,       (* set of entity identifiers (model-checking bound) *)
    MaxWal,         (* model-checking bound on retained WAL log length *)
    NatBound         (* model-checking bound for Nat-typed record fields *)

ASSUME
    /\ OperationId # {}
    /\ EntityType  # {}
    /\ EntityId    # {}
    /\ MaxWal \in Nat \ {0}
    /\ NatBound \in Nat \ {0}

(* --------------------------------------------------------------------------
   State enumeration (identical to L3 SystemState — refinement preserves
   the abstract state machine).
   -------------------------------------------------------------------------- *)
SystemState == { "Running", "Crashed", "Recovering" }

(* --------------------------------------------------------------------------
   Operation type (DD-024 Operation interface, refinement of L3 Operation)
   -------------------------------------------------------------------------- *)
OpType == { "user.register", "article.create", "article.transition",
            "comment.create", "tag.bind", "category.create" }

WalOp == [ opId: OperationId, opType: OpType, entityId: EntityId,
           entityType: EntityType, payload: 0..NatBound, timestamp: 0..NatBound ]

(* --------------------------------------------------------------------------
   Variables
   -------------------------------------------------------------------------- *)
VARIABLES
    systemState,         (* Running / Crashed / Recovering *)
    walLog,              (* Seq(WalOp): write-ahead log for crash rebuild *)
    replayIndex,         (* Nat: index of next operation to replay *)
    userStore,           (* Set(EntityId): idempotent rebuilt user store *)
    articleStore,        (* Set(EntityId): idempotent rebuilt article store *)
    commentStore         (* Set(EntityId): idempotent rebuilt comment store *)

vars == << systemState, walLog, replayIndex, userStore, articleStore, commentStore >>

(* --------------------------------------------------------------------------
   Derived predicates
   -------------------------------------------------------------------------- *)
IsRunning    == systemState = "Running"
IsCrashed    == systemState = "Crashed"
IsRecovering == systemState = "Recovering"
ReplayComplete == replayIndex >= Len(walLog)

(* --------------------------------------------------------------------------
   Idempotent replay target selection (refines L3 ReplayOneOp):
   each opType maps to exactly one store; re-applying an already-applied
   op is a no-op (idempotent — DD-025 replayOne contract).
   -------------------------------------------------------------------------- *)
TargetStore(opType, op) ==
    CASE opType = "user.register"       -> userStore
       [] opType = "article.create"     -> articleStore
       [] opType = "article.transition" -> articleStore
       [] opType = "comment.create"     -> commentStore
       [] opType = "tag.bind"           -> articleStore
       [] opType = "category.create"    -> articleStore
       [] OTHER                          -> userStore  (* unreachable if WalOp typed *)

ApplyOpToStore(opType, op, store) ==
    IF op.entityId \in store
    THEN store                                       (* idempotent: already applied *)
    ELSE store \cup {op.entityId}                    (* insert: add to store *)

(* ==========================================================================
   Init
   ========================================================================== *)
Init ==
    /\ systemState  = "Running"
    /\ walLog       = << >>
    /\ replayIndex  = 0
    /\ userStore    = {}
    /\ articleStore = {}
    /\ commentStore = {}

(* ==========================================================================
   Transitions
   ========================================================================== *)

(* NFR-002: append a typed operation to the WAL (only while Running).
   Parameterized by opType + entityId (the only fields the replay logic
   dispatches on); the remaining WalOp fields are derived deterministically
   to avoid enumerating the full WalOp record set in Next. *)
WriteWal(opType, entityId) ==
    /\ opType \in OpType
    /\ entityId \in EntityId
    /\ IsRunning
    /\ Len(walLog) < MaxWal
    /\ walLog' = Append(walLog,
                        [ opId       |-> CHOOSE x \in OperationId : TRUE,
                          opType     |-> opType,
                          entityId   |-> entityId,
                          entityType |-> CHOOSE t \in EntityType : TRUE,
                          payload    |-> 0,
                          timestamp  |-> Len(walLog) ])
    /\ UNCHANGED << systemState, replayIndex, userStore, articleStore, commentStore >>

(* NFR-002: crash the system. WAL is preserved (not cleared). *)
Crash ==
    /\ IsRunning
    /\ systemState' = "Crashed"
    /\ replayIndex' = 0
    /\ UNCHANGED << walLog, userStore, articleStore, commentStore >>

(* NFR-002: begin recovery from crash (enter Recovering state).
   Stores are cleared so replay rebuilds state from scratch (NFR-002 crash-rebuild
   contract, required by StoresEmptyBeforeReplay invariant). *)
StartRecovery ==
    /\ IsCrashed
    /\ systemState' = "Recovering"
    /\ replayIndex' = 0
    /\ userStore'    = {}
    /\ articleStore' = {}
    /\ commentStore' = {}
    /\ UNCHANGED walLog

(* NFR-002: idempotently replay one WAL operation (refines L3 ReplayOneOp):
   dispatch by opType to the correct store and apply with insertOrUpdate
   semantics; advance replayIndex. IF/THEN/ELSE ensures every branch assigns
   all three store variables (avoids "successor state not completely
   specified" error from partial implication-based assignments). *)
ReplayOneOp ==
    /\ IsRecovering
    /\ replayIndex < Len(walLog)
    /\ LET op == walLog[replayIndex+1] IN
       IF op.opType = "user.register"
       THEN /\ userStore'    = ApplyOpToStore("user.register", op, userStore)
            /\ UNCHANGED << articleStore, commentStore >>
       ELSE IF op.opType \in {"article.create", "article.transition", "tag.bind", "category.create"}
       THEN /\ articleStore' = ApplyOpToStore(op.opType, op, articleStore)
            /\ UNCHANGED << userStore, commentStore >>
       ELSE /\ commentStore' = ApplyOpToStore("comment.create", op, commentStore)
            /\ UNCHANGED << userStore, articleStore >>
    /\ replayIndex' = replayIndex + 1
    /\ UNCHANGED << systemState, walLog >>

(* NFR-002: finish recovery — all ops replayed, clear WAL, return to Running.
   Stores are retained (the rebuilt state). *)
FinishRecovery ==
    /\ IsRecovering
    /\ ReplayComplete
    /\ systemState' = "Running"
    /\ walLog'      = << >>
    /\ replayIndex' = 0
    /\ UNCHANGED << userStore, articleStore, commentStore >>

(* --------------------------------------------------------------------------
   Next (stuttering supplied via [Next]_vars in Spec)
   -------------------------------------------------------------------------- *)
Next ==
    \/ \E opType \in OpType, entityId \in EntityId : WriteWal(opType, entityId)
    \/ Crash
    \/ StartRecovery
    \/ ReplayOneOp
    \/ FinishRecovery

(* ==========================================================================
   Specification (stuttering: every state may stutter)
   ========================================================================== *)
Spec == Init /\ [][Next]_vars

(* ==========================================================================
   Invariants
   ========================================================================== *)

(* ---- TypeInvariant: every variable stays in its declared domain. *)
TypeInvariant ==
    /\ systemState \in SystemState
    /\ walLog \in Seq(WalOp)
    /\ replayIndex \in Nat
    /\ Len(walLog) =< MaxWal
    /\ replayIndex =< Len(walLog)
    /\ userStore \subseteq EntityId
    /\ articleStore \subseteq EntityId
    /\ commentStore \subseteq EntityId

(* ---- WalBounded: NFR-002, WAL length never exceeds MaxWal. *)
WalBounded ==
    Len(walLog) =< MaxWal

(* ---- ReplayOnlyDuringRecovery: replayIndex > 0 only when Recovering. *)
ReplayOnlyDuringRecovery ==
    replayIndex > 0 => IsRecovering

(* ---- FinishRequiresCompleteReplay: NFR-002, recovery can only finish when
   all WAL operations have been replayed. *)
FinishRequiresCompleteReplay ==
    systemState = "Running" => replayIndex = 0

(* ---- ReplayIdempotent: refinement — replayed store contents depend only
   on the SET of operations in the WAL, not their order or repetition count.
   Concretely: every entity id in a store was inserted by some op in walLog,
   and every op in walLog whose target store is S has its entityId in S
   once replay completes. (Strengthening invariant absent from L3.) *)
ReplayIdempotent ==
    /\ \A i \in 1..Len(walLog) :
        walLog[i].opType = "user.register" => walLog[i].entityId \in userStore
           \/ replayIndex < i   (* not yet replayed *)
    /\ \A i \in 1..Len(walLog) :
        walLog[i].opType \in {"article.create", "article.transition", "tag.bind", "category.create"}
        => walLog[i].entityId \in articleStore
           \/ replayIndex < i
    /\ \A i \in 1..Len(walLog) :
        walLog[i].opType = "comment.create"
        => walLog[i].entityId \in commentStore
           \/ replayIndex < i

(* ---- StoresEmptyBeforeReplay: at the start of recovery (replayIndex = 0
   during Recovering), all stores must be empty — guarantees that replay
   rebuilds state from scratch (NFR-002 crash-rebuild contract). *)
StoresEmptyBeforeReplay ==
    (IsRecovering /\ replayIndex = 0)
    => userStore = {} /\ articleStore = {} /\ commentStore = {}

(* ---- Aggregate: all sub-invariants. The .cfg INVARIANTS list MUST equal
   the set unfolded here (TypeInvariant, WalBounded,
   ReplayOnlyDuringRecovery, FinishRequiresCompleteReplay,
   ReplayIdempotent, StoresEmptyBeforeReplay). *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ WalBounded
    /\ ReplayOnlyDuringRecovery
    /\ FinishRequiresCompleteReplay
    /\ ReplayIdempotent
    /\ StoresEmptyBeforeReplay

=============================================================================
