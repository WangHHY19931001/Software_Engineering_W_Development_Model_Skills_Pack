(*
  @system        blog-system-demo::discovery
  @requirement   REQ-004,REQ-007,SD-005
  @design        docs/system-design.md
  @parent        ../tla/L1_blog_system.tla
  @sibling       ../tla/L2_identity_access.tla, ../tla/L2_content_management.tla, ../tla/L2_interaction.tla, ../tla/L2_operations_support.tla, ../tla/L2_infrastructure.tla
  @child         null
  @level         L2
  @phase         2
*)
---- MODULE L2_discovery ----
EXTENDS Naturals, Sequences, FiniteSets, TLC

(* ==========================================================================
   L2 Discovery Subsystem (W-Model Phase 2 / S-tla, SD-005)
   Implements REQ-004 (recommendation: feed/hot/slots, 7-day decay)
              + REQ-007 (search: full-text/tag/category/blogger, history).

   Recommendation feed and hot-articles are subsets of the search index
   (only indexed articles can be recommended or surfaced as hot). Search
   history records <<user, article>> edges for personalized ranking.
   CONSTANTS bound the state space so variable-combination <= 1000.
   ========================================================================== *)

CONSTANTS
    ArticleId,      (* set of article identifiers (model-checking bound) *)
    UserId          (* set of user identifiers (for search history) *)

ASSUME
    /\ ArticleId # {}
    /\ UserId # {}

(* --------------------------------------------------------------------------
   Variables
   -------------------------------------------------------------------------- *)
VARIABLES
    searchIndex,     (* subset of ArticleId: articles available for search *)
    recommendFeed,   (* subset of ArticleId: articles currently in feed *)
    hotArticles,     (* subset of ArticleId: hot articles (7-day decay) *)
    searchHistory    (* subset of <<UserId, ArticleId>>: user search records *)

vars == << searchIndex, recommendFeed, hotArticles, searchHistory >>

(* --------------------------------------------------------------------------
   Derived predicates
   -------------------------------------------------------------------------- *)
SearchHistoryEdge == UserId \times ArticleId

(* ==========================================================================
   Init
   ========================================================================== *)
Init ==
    /\ searchIndex   = {}
    /\ recommendFeed = {}
    /\ hotArticles   = {}
    /\ searchHistory = {}

(* ==========================================================================
   Transitions
   ========================================================================== *)

(* REQ-007: index an article for search. *)
IndexArticle(a) ==
    /\ a \in ArticleId
    /\ a \notin searchIndex
    /\ searchIndex' = searchIndex \cup {a}
    /\ UNCHANGED << recommendFeed, hotArticles, searchHistory >>

(* REQ-007: unindex an article. Cascades: remove from feed, hot, and history. *)
UnindexArticle(a) ==
    /\ a \in ArticleId
    /\ a \in searchIndex
    /\ searchIndex'   = searchIndex \ {a}
    /\ recommendFeed' = recommendFeed \ {a}
    /\ hotArticles'   = hotArticles \ {a}
    /\ searchHistory' = { e \in searchHistory : e[2] # a }

(* REQ-004: add an indexed article to the recommendation feed. *)
AddToRecommendFeed(a) ==
    /\ a \in ArticleId
    /\ a \in searchIndex
    /\ a \notin recommendFeed
    /\ recommendFeed' = recommendFeed \cup {a}
    /\ UNCHANGED << searchIndex, hotArticles, searchHistory >>

(* REQ-004: remove an article from the recommendation feed. *)
RemoveFromRecommendFeed(a) ==
    /\ a \in ArticleId
    /\ a \in recommendFeed
    /\ recommendFeed' = recommendFeed \ {a}
    /\ UNCHANGED << searchIndex, hotArticles, searchHistory >>

(* REQ-004: mark an indexed article as hot (7-day decay abstracted). *)
AddToHotArticles(a) ==
    /\ a \in ArticleId
    /\ a \in searchIndex
    /\ a \notin hotArticles
    /\ hotArticles' = hotArticles \cup {a}
    /\ UNCHANGED << searchIndex, recommendFeed, searchHistory >>

(* REQ-004: remove an article from hot list (decay expired). *)
RemoveFromHotArticles(a) ==
    /\ a \in ArticleId
    /\ a \in hotArticles
    /\ hotArticles' = hotArticles \ {a}
    /\ UNCHANGED << searchIndex, recommendFeed, searchHistory >>

(* REQ-007: record a search (user searched for and clicked an article). *)
RecordSearch(u, a) ==
    /\ u \in UserId
    /\ a \in ArticleId
    /\ a \in searchIndex
    /\ <<u, a>> \notin searchHistory
    /\ searchHistory' = searchHistory \cup { <<u, a>> }
    /\ UNCHANGED << searchIndex, recommendFeed, hotArticles >>

(* REQ-007: clear a user's search history. *)
ClearSearchHistory(u) ==
    /\ u \in UserId
    /\ searchHistory' = { e \in searchHistory : e[1] # u }
    /\ UNCHANGED << searchIndex, recommendFeed, hotArticles >>

(* --------------------------------------------------------------------------
   Next (stuttering supplied via [Next]_vars in Spec)
   -------------------------------------------------------------------------- *)
Next ==
    \/ \E a \in ArticleId : IndexArticle(a)
    \/ \E a \in ArticleId : UnindexArticle(a)
    \/ \E a \in ArticleId : AddToRecommendFeed(a)
    \/ \E a \in ArticleId : RemoveFromRecommendFeed(a)
    \/ \E a \in ArticleId : AddToHotArticles(a)
    \/ \E a \in ArticleId : RemoveFromHotArticles(a)
    \/ \E u \in UserId, a \in ArticleId : RecordSearch(u, a)
    \/ \E u \in UserId : ClearSearchHistory(u)

(* ==========================================================================
   Specification (stuttering: every state may stutter)
   ========================================================================== *)
Spec == Init /\ [][Next]_vars

(* ==========================================================================
   Invariants
   ========================================================================== *)

TypeInvariant ==
    /\ searchIndex \subseteq ArticleId
    /\ recommendFeed \subseteq ArticleId
    /\ hotArticles \subseteq ArticleId
    /\ searchHistory \subseteq SearchHistoryEdge

RecommendFeedIndexed ==
    recommendFeed \subseteq searchIndex

HotArticlesSubset ==
    hotArticles \subseteq searchIndex

SearchHistoryIndexed ==
    \A e \in searchHistory : e[2] \in searchIndex

BusinessInvariant ==
    /\ TypeInvariant
    /\ RecommendFeedIndexed
    /\ HotArticlesSubset
    /\ SearchHistoryIndexed

=============================================================================
