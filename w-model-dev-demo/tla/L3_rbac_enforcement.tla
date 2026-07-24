(*
  @system        blog-system-demo::identity-access::rbac-enforcement
  @requirement   REQ-003,NFR-003,SD-001
  @design        docs/system-design.md#§6
  @parent        ../tla/L2_identity_access.tla
  @sibling       null
  @child         null
  @level         L3
  @phase         3
*)
---- MODULE L3_rbac_enforcement ----
EXTENDS Naturals, Sequences, FiniteSets, TLC

(* ==========================================================================
   L3 RBAC Enforcement (W-Model Phase 3 / S-tla)
   Atomic behavior decomposition of L2_identity_access: isolates the
   REQ-003 / NFR-003 RBAC 4-role permission matrix from JWT/follow concerns.

   Roles: user < blogger < admin < super_admin (strict hierarchy).
   Permission checks return granted/denied based on role vs required level.
   CONSTANTS bound the state space so variable-combination <= 1000.
   ========================================================================== *)

CONSTANTS
    UserId,         (* set of user identifiers (model-checking bound) *)
    Resource,        (* set of protected resources *)
    None             (* sentinel for "no role assigned" *)

ASSUME
    /\ UserId   # {}
    /\ Resource # {}
    /\ None \notin { "user", "blogger", "admin", "super_admin" }

(* --------------------------------------------------------------------------
   Role enumeration & hierarchy (REQ-003 §6.1)
   -------------------------------------------------------------------------- *)
Role == { "user", "blogger", "admin", "super_admin" }

(* Role rank: user=1 < blogger=2 < admin=3 < super_admin=4 *)
RoleRank == {
    <<"user", 1>>,
    <<"blogger", 2>>,
    <<"admin", 3>>,
    <<"super_admin", 4>>
}

(* Required minimum rank per resource (simplified: each resource requires
   blogger-level (rank 2) write access). *)
RequiredRank == [ r \in Resource |-> 2 ]

(* --------------------------------------------------------------------------
   Variables
   -------------------------------------------------------------------------- *)
VARIABLES
    userRoles,       (* [UserId -> Role \cup {None}]: assigned role per user *)
    accessGrants,    (* subset of UserId: users whose last check was granted *)
    accessDenials    (* subset of UserId: users whose last check was denied *)

vars == << userRoles, accessGrants, accessDenials >>

(* --------------------------------------------------------------------------
   Derived predicates
   -------------------------------------------------------------------------- *)
AssignedUsers == { u \in UserId : userRoles[u] # None }

(* ==========================================================================
   Init
   ========================================================================== *)
Init ==
    /\ userRoles     = [ u \in UserId |-> None ]
    /\ accessGrants  = {}
    /\ accessDenials = {}

(* ==========================================================================
   Transitions
   ========================================================================== *)

(* REQ-003: assign a role to a user (super_admin only, abstracted). *)
AssignRole(u, role) ==
    /\ u \in UserId
    /\ role \in Role
    /\ userRoles[u] # role
    /\ userRoles'      = [ userRoles EXCEPT ![u] = role ]
    /\ accessGrants'   = {}
    /\ accessDenials'  = {}

(* REQ-003: revoke a user's role (super_admin only, abstracted). *)
RevokeRole(u) ==
    /\ u \in UserId
    /\ userRoles[u] # None
    /\ userRoles'      = [ userRoles EXCEPT ![u] = None ]
    /\ accessGrants'   = {}
    /\ accessDenials'  = {}

(* NFR-003: check write permission on a resource. Granted iff user's role
   rank >= resource's required rank. Records result in grants/denials. *)
CheckPermission(u, res) ==
    /\ u \in UserId
    /\ res \in Resource
    /\ userRoles[u] # None
    /\ LET rank == CHOOSE r \in 1..4 : <<userRoles[u], r>> \in RoleRank
           req  == RequiredRank[res]
       IN  IF rank >= req
           THEN /\ accessGrants'  = {u}
                /\ accessDenials' = {}
           ELSE /\ accessGrants'  = {}
                /\ accessDenials' = {u}
    /\ UNCHANGED userRoles

(* --------------------------------------------------------------------------
   Next (stuttering supplied via [Next]_vars in Spec)
   -------------------------------------------------------------------------- *)
Next ==
    \/ \E u \in UserId, role \in Role : AssignRole(u, role)
    \/ \E u \in UserId : RevokeRole(u)
    \/ \E u \in UserId, res \in Resource : CheckPermission(u, res)

(* ==========================================================================
   Specification (stuttering: every state may stutter)
   ========================================================================== *)
Spec == Init /\ [][Next]_vars

(* ==========================================================================
   Invariants
   ========================================================================== *)

(* ---- TypeInvariant: every variable stays in its declared domain. *)
TypeInvariant ==
    /\ userRoles \in [UserId -> Role \cup {None}]
    /\ accessGrants  \subseteq UserId
    /\ accessDenials \subseteq UserId

(* ---- RoleHierarchyValid: REQ-003, every assigned role is a valid Role. *)
RoleHierarchyValid ==
    \A u \in UserId :
        userRoles[u] = None \/ userRoles[u] \in Role

(* ---- NoPrivilegeEscalation: NFR-003, a user with no role (None) can never
   appear in accessGrants (cannot self-elevate). *)
NoPrivilegeEscalation ==
    \A u \in accessGrants : userRoles[u] # None

(* ---- GrantDenialMutualExclusion: a user cannot be both granted and denied
   in the same state. *)
GrantDenialMutualExclusion ==
    accessGrants \cap accessDenials = {}

(* ---- Aggregate: all sub-invariants. The .cfg INVARIANTS list MUST equal
   the set unfolded here (TypeInvariant, RoleHierarchyValid,
   NoPrivilegeEscalation, GrantDenialMutualExclusion). *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ RoleHierarchyValid
    /\ NoPrivilegeEscalation
    /\ GrantDenialMutualExclusion

=============================================================================
