(*
  @system        blog-system-demo::infrastructure
  @requirement   NFR-001,NFR-002,NFR-003,NFR-004,NFR-005,CON-001,CON-002,CON-003,SD-006
  @design        docs/system-design.md
  @parent        ../tla/L1_blog_system.tla
  @sibling       ../tla/L2_identity_access.tla, ../tla/L2_content_management.tla, ../tla/L2_interaction.tla, ../tla/L2_operations_support.tla, ../tla/L2_discovery.tla
  @child         ../tla/L3_wal_replay.tla
  @level         L2
  @phase         2
*)
---- MODULE L2_infrastructure ----
EXTENDS Naturals, Sequences, FiniteSets, TLC

(* ==========================================================================
   L2 Infrastructure Subsystem (W-Model Phase 2 / S-tla, SD-006)
   Governance node (governance=true): governs SD-001~005.
   Implements NFR-001~005 (performance/availability/security/testability/
   maintainability) + CON-001~003 (tech-stack/deployment/data-scale).

   Models the cross-cutting infrastructure: WAL operation log (crash rebuild,
   NFR-002), audit log (independent storage, CONFLICT-002), RBAC role
   assignments, and system run-state (Running/Crashed/Recovering).
   CONSTANTS bound the state space so variable-combination <= 1000.
   ========================================================================== *)

CONSTANTS
    UserId,       (* set of user identifiers (model-checking bound) *)
    Operation,    (* set of WAL operation tokens (model-checking bound) *)
    AuditEntry,   (* set of audit-entry tokens (model-checking bound) *)
    MaxWal,       (* model-checking bound on retained WAL log length *)
    MaxAudit      (* model-checking bound on retained audit log length *)

ASSUME
    /\ UserId # {}
    /\ Operation # {}
    /\ AuditEntry # {}
    /\ MaxWal \in Nat \ {0}
    /\ MaxAudit \in Nat \ {0}

(* --------------------------------------------------------------------------
   State enumeration
   -------------------------------------------------------------------------- *)
SystemState == { "Running", "Crashed", "Recovering" }
Role == { "none", "user", "blogger", "admin" }

(* --------------------------------------------------------------------------
   Variables
   -------------------------------------------------------------------------- *)
VARIABLES
    systemState,      (* Running / Crashed / Recovering *)
    walLog,           (* Seq(Operation): write-ahead log for crash rebuild *)
    auditLog,         (* Seq(AuditEntry): independent audit trail *)
    rbacAssignments   (* [UserId -> Role]: role per user *)

vars == << systemState, walLog, auditLog, rbacAssignments >>

(* --------------------------------------------------------------------------
   Derived predicates
   -------------------------------------------------------------------------- *)
IsRunning    == systemState = "Running"
IsCrashed    == systemState = "Crashed"
IsRecovering == systemState = "Recovering"

(* ==========================================================================
   Init
   ========================================================================== *)
Init ==
    /\ systemState     = "Running"
    /\ walLog          = << >>
    /\ auditLog        = << >>
    /\ rbacAssignments = [ u \in UserId |-> "none" ]

(* ==========================================================================
   Transitions
   ========================================================================== *)

(* NFR-002: append an operation to the WAL (only while Running). *)
WriteWal(op) ==
    /\ op \in Operation
    /\ IsRunning
    /\ Len(walLog) < MaxWal
    /\ walLog' = Append(walLog, op)
    /\ UNCHANGED << systemState, auditLog, rbacAssignments >>

(* CONFLICT-002: append an audit entry (independent of WAL; allowed during
   Running and Crashed, since audit must survive crashes). *)
WriteAudit(ae) ==
    /\ ae \in AuditEntry
    /\ ~IsRecovering
    /\ Len(auditLog) < MaxAudit
    /\ auditLog' = Append(auditLog, ae)
    /\ UNCHANGED << systemState, walLog, rbacAssignments >>

(* NFR-002: crash the system. WAL and audit log are preserved (not cleared). *)
Crash ==
    /\ IsRunning
    /\ systemState' = "Crashed"
    /\ UNCHANGED << walLog, auditLog, rbacAssignments >>

(* NFR-002: begin recovery from crash (enter Recovering state). *)
StartRecovery ==
    /\ IsCrashed
    /\ systemState' = "Recovering"
    /\ UNCHANGED << walLog, auditLog, rbacAssignments >>

(* NFR-002: finish recovery — replay WAL and clear it. System returns to Running.
   Audit log is NOT cleared (independent storage, CONFLICT-002). *)
FinishRecovery ==
    /\ IsRecovering
    /\ systemState' = "Running"
    /\ walLog'      = << >>
    /\ UNCHANGED << auditLog, rbacAssignments >>

(* RBAC: assign a role to a user (only while Running). *)
AssignRole(u, role) ==
    /\ u \in UserId
    /\ role \in Role
    /\ IsRunning
    /\ rbacAssignments[u] # role
    /\ rbacAssignments' = [ rbacAssignments EXCEPT ![u] = role ]
    /\ UNCHANGED << systemState, walLog, auditLog >>

(* --------------------------------------------------------------------------
   Next (stuttering supplied via [Next]_vars in Spec)
   -------------------------------------------------------------------------- *)
Next ==
    \/ \E op \in Operation : WriteWal(op)
    \/ \E ae \in AuditEntry : WriteAudit(ae)
    \/ Crash
    \/ StartRecovery
    \/ FinishRecovery
    \/ \E u \in UserId, role \in Role : AssignRole(u, role)

(* ==========================================================================
   Specification (stuttering: every state may stutter)
   ========================================================================== *)
Spec == Init /\ [][Next]_vars

(* ==========================================================================
   Invariants
   ========================================================================== *)

TypeInvariant ==
    /\ systemState \in SystemState
    /\ walLog \in Seq(Operation)
    /\ auditLog \in Seq(AuditEntry)
    /\ rbacAssignments \in [UserId -> Role]
    /\ Len(walLog)   =< MaxWal
    /\ Len(auditLog) =< MaxAudit

WalBounded ==
    Len(walLog) =< MaxWal

AuditBounded ==
    Len(auditLog) =< MaxAudit

AuditLogPersists ==
    /\ systemState \in SystemState
    /\ auditLog \in Seq(AuditEntry)

RbacRoleValid ==
    \A u \in UserId : rbacAssignments[u] \in Role

BusinessInvariant ==
    /\ TypeInvariant
    /\ WalBounded
    /\ AuditBounded
    /\ AuditLogPersists
    /\ RbacRoleValid

=============================================================================
