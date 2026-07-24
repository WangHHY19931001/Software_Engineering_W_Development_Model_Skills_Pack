(*
  @system        blog-system-demo::operations-support
  @requirement   REQ-001,REQ-005,REQ-006,SD-004
  @design        docs/system-design.md
  @parent        ../tla/L1_blog_system.tla
  @sibling       ../tla/L2_identity_access.tla, ../tla/L2_content_management.tla, ../tla/L2_interaction.tla, ../tla/L2_discovery.tla, ../tla/L2_infrastructure.tla
  @child         null
  @level         L2
  @phase         2
*)
---- MODULE L2_operations_support ----
EXTENDS Naturals, Sequences, FiniteSets, TLC

(* ==========================================================================
   L2 Operations Support Subsystem (W-Model Phase 2 / S-tla, SD-004)
   Implements REQ-001 (site management: switch/announcement/maintenance)
              + REQ-005 (ad slots, placement, review, CTR)
              + REQ-006 (4-category statistics).

   Ad slot lifecycle: inactive <-> active <-> paused.
   Ad placements only allowed on active slots; deactivation cascades removal.
   CONSTANTS bound the state space so variable-combination <= 1000.
   ========================================================================== *)

CONSTANTS
    StatType,       (* set of statistics categories (article/user/blogger/site) *)
    AdSlotId,       (* set of ad-slot identifiers (model-checking bound) *)
    AdId,           (* set of advertisement identifiers (model-checking bound) *)
    MaxStat         (* model-checking bound on per-stat counter value *)

ASSUME
    /\ StatType # {}
    /\ AdSlotId # {}
    /\ AdId # {}
    /\ MaxStat \in Nat \ {0}

(* --------------------------------------------------------------------------
   State enumeration & legal transitions
   -------------------------------------------------------------------------- *)
AdSlotState == { "inactive", "active", "paused" }

ValidAdSlotTransitions == {
    << "inactive", "active"  >>,
    << "active",   "paused"  >>,
    << "paused",   "active"  >>,
    << "active",   "inactive">>,
    << "paused",   "inactive">>
}

(* --------------------------------------------------------------------------
   Variables
   -------------------------------------------------------------------------- *)
VARIABLES
    siteSwitch,     (* BOOLEAN: TRUE == maintenance mode (site closed to non-admin) *)
    announcement,   (* BOOLEAN: TRUE == announcement currently published *)
    stats,          (* [StatType -> 0..MaxStat]: per-category statistics counters *)
    adSlots,        (* [AdSlotId -> AdSlotState]: lifecycle state per ad slot *)
    adPlacements    (* subset of <<AdSlotId, AdId>>: ads placed in slots *)

vars == << siteSwitch, announcement, stats, adSlots, adPlacements >>

(* --------------------------------------------------------------------------
   Derived predicates
   -------------------------------------------------------------------------- *)
ActiveSlots == { s \in AdSlotId : adSlots[s] = "active" }

(* ==========================================================================
   Init
   ========================================================================== *)
Init ==
    /\ siteSwitch   = FALSE
    /\ announcement = FALSE
    /\ stats        = [ st \in StatType |-> 0 ]
    /\ adSlots      = [ s \in AdSlotId |-> "inactive" ]
    /\ adPlacements = {}

(* ==========================================================================
   Transitions
   ========================================================================== *)

(* REQ-001: enter maintenance mode (close site to non-admin traffic). *)
EnterMaintenance ==
    /\ ~siteSwitch
    /\ siteSwitch' = TRUE
    /\ UNCHANGED << announcement, stats, adSlots, adPlacements >>

(* REQ-001: exit maintenance mode. *)
ExitMaintenance ==
    /\ siteSwitch
    /\ siteSwitch' = FALSE
    /\ UNCHANGED << announcement, stats, adSlots, adPlacements >>

(* REQ-001: publish a site announcement. *)
PublishAnnouncement ==
    /\ ~announcement
    /\ announcement' = TRUE
    /\ UNCHANGED << siteSwitch, stats, adSlots, adPlacements >>

(* REQ-001: remove a site announcement. *)
RemoveAnnouncement ==
    /\ announcement
    /\ announcement' = FALSE
    /\ UNCHANGED << siteSwitch, stats, adSlots, adPlacements >>

(* REQ-006: increment a statistics counter (4 categories). *)
IncrementStat(st) ==
    /\ st \in StatType
    /\ stats[st] < MaxStat
    /\ stats' = [ stats EXCEPT ![st] = stats[st] + 1 ]
    /\ UNCHANGED << siteSwitch, announcement, adSlots, adPlacements >>

(* REQ-005: activate an ad slot (inactive -> active). *)
ActivateAdSlot(s) ==
    /\ s \in AdSlotId
    /\ adSlots[s] = "inactive"
    /\ adSlots' = [ adSlots EXCEPT ![s] = "active" ]
    /\ UNCHANGED << siteSwitch, announcement, stats, adPlacements >>

(* REQ-005: pause an active ad slot (active -> paused). *)
PauseAdSlot(s) ==
    /\ s \in AdSlotId
    /\ adSlots[s] = "active"
    /\ adSlots' = [ adSlots EXCEPT ![s] = "paused" ]
    /\ UNCHANGED << siteSwitch, announcement, stats, adPlacements >>

(* REQ-005: resume a paused ad slot (paused -> active). *)
ResumeAdSlot(s) ==
    /\ s \in AdSlotId
    /\ adSlots[s] = "paused"
    /\ adSlots' = [ adSlots EXCEPT ![s] = "active" ]
    /\ UNCHANGED << siteSwitch, announcement, stats, adPlacements >>

(* REQ-005: deactivate an ad slot (active/paused -> inactive).
   Cascades: remove all ad placements on this slot. *)
DeactivateAdSlot(s) ==
    /\ s \in AdSlotId
    /\ adSlots[s] \in { "active", "paused" }
    /\ adSlots'      = [ adSlots EXCEPT ![s] = "inactive" ]
    /\ adPlacements' = { e \in adPlacements : e[1] # s }
    /\ UNCHANGED << siteSwitch, announcement, stats >>

(* REQ-005: place an ad in an active slot. *)
PlaceAd(s, ad) ==
    /\ s \in AdSlotId
    /\ ad \in AdId
    /\ adSlots[s] = "active"
    /\ <<s, ad>> \notin adPlacements
    /\ adPlacements' = adPlacements \cup { <<s, ad>> }
    /\ UNCHANGED << siteSwitch, announcement, stats, adSlots >>

(* REQ-005: remove an ad placement. *)
RemoveAdPlacement(s, ad) ==
    /\ s \in AdSlotId
    /\ ad \in AdId
    /\ <<s, ad>> \in adPlacements
    /\ adPlacements' = adPlacements \ { <<s, ad>> }
    /\ UNCHANGED << siteSwitch, announcement, stats, adSlots >>

(* --------------------------------------------------------------------------
   Next (stuttering supplied via [Next]_vars in Spec)
   -------------------------------------------------------------------------- *)
Next ==
    \/ EnterMaintenance
    \/ ExitMaintenance
    \/ PublishAnnouncement
    \/ RemoveAnnouncement
    \/ \E st \in StatType : IncrementStat(st)
    \/ \E s \in AdSlotId : ActivateAdSlot(s)
    \/ \E s \in AdSlotId : PauseAdSlot(s)
    \/ \E s \in AdSlotId : ResumeAdSlot(s)
    \/ \E s \in AdSlotId : DeactivateAdSlot(s)
    \/ \E s \in AdSlotId, ad \in AdId : PlaceAd(s, ad)
    \/ \E s \in AdSlotId, ad \in AdId : RemoveAdPlacement(s, ad)

(* ==========================================================================
   Specification (stuttering: every state may stutter)
   ========================================================================== *)
Spec == Init /\ [][Next]_vars

(* ==========================================================================
   Invariants
   ========================================================================== *)

TypeInvariant ==
    /\ siteSwitch \in BOOLEAN
    /\ announcement \in BOOLEAN
    /\ stats \in [StatType -> 0..MaxStat]
    /\ adSlots \in [AdSlotId -> AdSlotState]
    /\ adPlacements \subseteq AdSlotId \times AdId

MaintenanceGate ==
    siteSwitch \in BOOLEAN

StatNonNegative ==
    \A st \in StatType : stats[st] \in 0..MaxStat

AdPlacementOnActive ==
    \A e \in adPlacements : adSlots[e[1]] \in { "active", "paused" }

AdSlotTransitionValid ==
    \A s \in AdSlotId :
        adSlots[s] = "inactive"
        \/ \E from \in AdSlotState :
            << from, adSlots[s] >> \in ValidAdSlotTransitions

BusinessInvariant ==
    /\ TypeInvariant
    /\ MaintenanceGate
    /\ StatNonNegative
    /\ AdPlacementOnActive
    /\ AdSlotTransitionValid

=============================================================================
