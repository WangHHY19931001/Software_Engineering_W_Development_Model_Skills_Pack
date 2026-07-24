(*
  @system        blog-system-demo::identity-access
  @requirement   REQ-002,REQ-003,SD-001
  @design        docs/system-design.md
  @parent        ../tla/L1_blog_system.tla
  @sibling       ../tla/L2_content_management.tla, ../tla/L2_interaction.tla, ../tla/L2_operations_support.tla, ../tla/L2_discovery.tla, ../tla/L2_infrastructure.tla
  @child         ../tla/L3_rbac_enforcement.tla
  @level         L2
  @phase         2
*)
---- MODULE L2_identity_access ----
EXTENDS Naturals, Sequences, FiniteSets, TLC

(* ==========================================================================
   L2 Identity & Access Subsystem (W-Model Phase 2 / S-tla, SD-001)
   Implements REQ-002 (multi-blogger) + REQ-003 (multi-user).

   Models user/blogger registration, JWT issuance, RBAC role validation,
   ban/unban, and follow relations. CONSTANTS bound the state space so the
   variable-combination upper bound stays <= 1000 (kept-below-threshold).
   ========================================================================== *)

CONSTANTS
    UserId,        (* set of user identifiers (model-checking bound) *)
    BloggerId,     (* subset of UserId eligible to be promoted to blogger *)
    MaxBans,       (* model-checking bound on banned-user count *)
    MaxFollows     (* model-checking bound on follow-edge count *)

ASSUME
    /\ UserId # {}
    /\ BloggerId \subseteq UserId
    /\ BloggerId # {}
    /\ MaxBans    \in Nat
    /\ MaxFollows \in Nat

(* --------------------------------------------------------------------------
   State enumeration & derived sets
   -------------------------------------------------------------------------- *)
UserState  == { "absent", "present" }
FollowEdge == { <<src, dst>> \in UserId \times BloggerId : src # dst }

(* --------------------------------------------------------------------------
   Variables
   -------------------------------------------------------------------------- *)
VARIABLES
    users,           (* [UserId -> UserState]: registration state per user *)
    bloggers,        (* subset of UserId: users promoted to blogger role *)
    jwtTokens,       (* subset of UserId: users holding an unexpired JWT *)
    bans,            (* subset of UserId: banned users *)
    follows,         (* subset of FollowEdge: directed follow relations *)
    passwordHashed   (* BOOLEAN: TRUE iff all stored passwords are bcrypt-hashed *)

vars == << users, bloggers, jwtTokens, bans, follows, passwordHashed >>

(* --------------------------------------------------------------------------
   Derived predicates
   -------------------------------------------------------------------------- *)
RegisteredUsers == { u \in UserId : users[u] = "present" }

(* ==========================================================================
   Init
   ========================================================================== *)
Init ==
    /\ users          = [ u \in UserId |-> "absent" ]
    /\ bloggers       = {}
    /\ jwtTokens      = {}
    /\ bans           = {}
    /\ follows        = {}
    /\ passwordHashed = TRUE

(* ==========================================================================
   Transitions
   ========================================================================== *)

(* REQ-003: register a new user. Password is bcrypt-hashed (GAP-001). *)
RegisterUser(u) ==
    /\ u \in UserId
    /\ users[u] = "absent"
    /\ users'          = [ users EXCEPT ![u] = "present" ]
    /\ passwordHashed' = TRUE
    /\ UNCHANGED << bloggers, jwtTokens, bans, follows >>

(* REQ-003: login a registered, non-banned user; issue a JWT (GAP-004). *)
LoginUser(u) ==
    /\ u \in UserId
    /\ users[u] = "present"
    /\ u \notin bans
    /\ u \notin jwtTokens
    /\ passwordHashed
    /\ jwtTokens' = jwtTokens \cup {u}
    /\ UNCHANGED << users, bloggers, bans, follows, passwordHashed >>

(* REQ-002: promote a registered user to blogger role. *)
RegisterBlogger(u) ==
    /\ u \in BloggerId
    /\ users[u] = "present"
    /\ u \notin bloggers
    /\ bloggers' = bloggers \cup {u}
    /\ UNCHANGED << users, jwtTokens, bans, follows, passwordHashed >>

(* REQ-002: blogger login (extends LoginUser with blogger-role check). *)
LoginBlogger(u) ==
    /\ u \in BloggerId
    /\ users[u] = "present"
    /\ u \notin bans
    /\ u \in bloggers
    /\ u \notin jwtTokens
    /\ passwordHashed
    /\ jwtTokens' = jwtTokens \cup {u}
    /\ UNCHANGED << users, bloggers, bans, follows, passwordHashed >>

(* REQ-003: ban a user (super_admin only, abstracted). Revokes JWT. *)
BanUser(u) ==
    /\ u \in UserId
    /\ users[u] = "present"
    /\ u \notin bans
    /\ Cardinality(bans) < MaxBans
    /\ bans'      = bans \cup {u}
    /\ jwtTokens' = jwtTokens \ {u}
    /\ UNCHANGED << users, bloggers, follows, passwordHashed >>

(* REQ-003: unban a user. *)
UnbanUser(u) ==
    /\ u \in UserId
    /\ u \in bans
    /\ bans' = bans \ {u}
    /\ UNCHANGED << users, bloggers, jwtTokens, follows, passwordHashed >>

(* REQ-002: follow relation (user follows blogger). *)
Follow(edge) ==
    /\ edge \in FollowEdge
    /\ edge[1] \in RegisteredUsers
    /\ edge[2] \in bloggers
    /\ edge \notin follows
    /\ Cardinality(follows) < MaxFollows
    /\ follows' = follows \cup {edge}
    /\ UNCHANGED << users, bloggers, jwtTokens, bans, passwordHashed >>

(* REQ-002: unfollow. *)
Unfollow(edge) ==
    /\ edge \in FollowEdge
    /\ edge \in follows
    /\ follows' = follows \ {edge}
    /\ UNCHANGED << users, bloggers, jwtTokens, bans, passwordHashed >>

(* NFR-003: JWT expiry (time abstraction; a token may expire nondeterministically). *)
ExpireJwt(u) ==
    /\ u \in UserId
    /\ u \in jwtTokens
    /\ jwtTokens' = jwtTokens \ {u}
    /\ UNCHANGED << users, bloggers, bans, follows, passwordHashed >>

(* --------------------------------------------------------------------------
   Next (stuttering supplied via [Next]_vars in Spec)
   -------------------------------------------------------------------------- *)
Next ==
    \/ \E u \in UserId : RegisterUser(u)
    \/ \E u \in UserId : LoginUser(u)
    \/ \E u \in BloggerId : RegisterBlogger(u)
    \/ \E u \in BloggerId : LoginBlogger(u)
    \/ \E u \in UserId : BanUser(u)
    \/ \E u \in UserId : UnbanUser(u)
    \/ \E edge \in FollowEdge : Follow(edge)
    \/ \E edge \in FollowEdge : Unfollow(edge)
    \/ \E u \in UserId : ExpireJwt(u)

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
    /\ users \in [UserId -> UserState]
    /\ bloggers  \subseteq UserId
    /\ jwtTokens \subseteq UserId
    /\ bans      \subseteq UserId
    /\ follows   \subseteq FollowEdge
    /\ passwordHashed \in BOOLEAN
    /\ Cardinality(bans)   =< MaxBans
    /\ Cardinality(follows) =< MaxFollows

(* ---- PasswordBcryptHashed: GAP-001, all stored passwords are bcrypt-hashed. *)
PasswordBcryptHashed ==
    passwordHashed = TRUE

(* ---- JwtNotExpired: NFR-003, JWT set only contains unexpired tokens held
   by registered users. *)
JwtNotExpired ==
    jwtTokens \subseteq RegisteredUsers

(* ---- BannedUserCannotLogin: REQ-003 UAT-012, banned users hold no JWT. *)
BannedUserCannotLogin ==
    jwtTokens \cap bans = {}

(* ---- RoleHierarchyValid: REQ-002, bloggers are a subset of registered users
   and stay within the eligible BloggerId set. *)
RoleHierarchyValid ==
    bloggers \subseteq RegisteredUsers
    /\ bloggers \subseteq BloggerId

(* ---- FollowConsistency: REQ-002, every follow edge originates from a
   registered user and targets a current blogger. *)
FollowConsistency ==
    \A edge \in follows :
        /\ edge[1] \in RegisteredUsers
        /\ edge[2] \in bloggers

(* ---- Aggregate: all sub-invariants. The .cfg INVARIANTS list MUST equal
   the set unfolded here (TypeInvariant, PasswordBcryptHashed, JwtNotExpired,
   BannedUserCannotLogin, RoleHierarchyValid, FollowConsistency). *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ PasswordBcryptHashed
    /\ JwtNotExpired
    /\ BannedUserCannotLogin
    /\ RoleHierarchyValid
    /\ FollowConsistency

=============================================================================
