(*
  @system        blog-system-demo::infrastructure::wal-replay
  @requirement   NFR-002,SD-006
  @design        docs/system-design.md#§4.2
  @parent        ../tla/L2_infrastructure.tla
  @sibling       null
  @child         ../tla/L4_wal_replay_algorithm.tla
  @level         L3
  @phase         3
*)
---- MODULE L3_wal_replay ----
EXTENDS Naturals, Sequences, FiniteSets, TLC

(* ==========================================================================
   L3 WAL Replay (W-Model Phase 3 / S-tla)
   Atomic behavior decomposition of L2_infrastructure: isolates the
   NFR-002 WAL write -> crash -> replay -> recover cycle from audit/RBAC.

   Models the write-ahead log lifecycle:
     Running (append ops) -> Crashed -> Recovering (replay ops) -> Running
   CONSTANTS bound the state space so variable-combination <= 1000.
   ========================================================================== *)

CONSTANTS
    Operation,       (* set of WAL operation tokens (model-checking bound) *)
    MaxWal           (* model-checking bound on retained WAL log length *)

ASSUME
    /\ Operation # {}
    /\ MaxWal \in Nat \ {0}

(* --------------------------------------------------------------------------
   State enumeration
   -------------------------------------------------------------------------- *)
SystemState == { "Running", "Crashed", "Recovering" }

(* --------------------------------------------------------------------------
   Variables
   -------------------------------------------------------------------------- *)
VARIABLES
    systemState,     (* Running / Crashed / Recovering *)
    walLog,          (* Seq(Operation): write-ahead log for crash rebuild *)
    replayIndex      (* Nat: index of next operation to replay (0 = not started) *)

vars == << systemState, walLog, replayIndex >>

(* --------------------------------------------------------------------------
   Derived predicates
   -------------------------------------------------------------------------- *)
IsRunning    == systemState = "Running"
IsCrashed    == systemState = "Crashed"
IsRecovering == systemState = "Recovering"
ReplayComplete == replayIndex >= Len(walLog)

(* ==========================================================================
   Init
   ========================================================================== *)
Init ==
    /\ systemState  = "Running"
    /\ walLog       = << >>
    /\ replayIndex  = 0

(* ==========================================================================
   Transitions
   ========================================================================== *)

(* NFR-002: append an operation to the WAL (only while Running). *)
WriteWal(op) ==
    /\ op \in Operation
    /\ IsRunning
    /\ Len(walLog) < MaxWal
    /\ walLog'      = Append(walLog, op)
    /\ UNCHANGED << systemState, replayIndex >>

(* NFR-002: crash the system. WAL is preserved (not cleared). *)
Crash ==
    /\ IsRunning
    /\ systemState' = "Crashed"
    /\ replayIndex' = 0
    /\ UNCHANGED walLog

(* NFR-002: begin recovery from crash (enter Recovering state). *)
StartRecovery ==
    /\ IsCrashed
    /\ systemState' = "Recovering"
    /\ replayIndex' = 0
    /\ UNCHANGED walLog

(* NFR-002: replay one WAL operation (advance replayIndex). Only while
   Recovering and replay not yet complete. *)
ReplayOneOp ==
    /\ IsRecovering
    /\ replayIndex < Len(walLog)
    /\ replayIndex' = replayIndex + 1
    /\ UNCHANGED << systemState, walLog >>

(* NFR-002: finish recovery — all ops replayed, clear WAL, return to Running. *)
FinishRecovery ==
    /\ IsRecovering
    /\ ReplayComplete
    /\ systemState' = "Running"
    /\ walLog'      = << >>
    /\ replayIndex' = 0

(* --------------------------------------------------------------------------
   Next (stuttering supplied via [Next]_vars in Spec)
   -------------------------------------------------------------------------- *)
Next ==
    \/ \E op \in Operation : WriteWal(op)
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
    /\ walLog \in Seq(Operation)
    /\ replayIndex \in Nat
    /\ Len(walLog) =< MaxWal
    /\ replayIndex =< Len(walLog)

(* ---- WalBounded: NFR-002, WAL length never exceeds MaxWal. *)
WalBounded ==
    Len(walLog) =< MaxWal

(* ---- ReplayOnlyDuringRecovery: replayIndex > 0 only when Recovering. *)
ReplayOnlyDuringRecovery ==
    replayIndex > 0 => IsRecovering

(* ---- FinishRequiresCompleteReplay: NFR-002, recovery can only finish when
   all WAL operations have been replayed (FinishRecovery guard). When Running,
   no replay is in progress (replayIndex = 0); WriteWal may grow walLog during
   normal operation but replayIndex stays 0 until the next crash/recovery. *)
FinishRequiresCompleteReplay ==
    systemState = "Running" => replayIndex = 0

(* ---- Aggregate: all sub-invariants. The .cfg INVARIANTS list MUST equal
   the set unfolded here (TypeInvariant, WalBounded,
   ReplayOnlyDuringRecovery, FinishRequiresCompleteReplay). *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ WalBounded
    /\ ReplayOnlyDuringRecovery
    /\ FinishRequiresCompleteReplay

=============================================================================
