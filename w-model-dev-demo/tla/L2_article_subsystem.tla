(*
  @system        blog-system::article-subsystem
  @requirement   REQ-001, REQ-003
  @design        docs/system-design.md#SD-ARTICLE
  @parent        ../tla/L1_blog_system.tla
  @sibling       ../tla/L2_auth_subsystem.tla, ../tla/L2_comment_subsystem.tla, ../tla/L2_review_subsystem.tla
  @child         ../tla/L3_article_flow.tla
  @level         L2
  @phase         2
*)
---- MODULE L2_article_subsystem ----
EXTENDS Naturals, TLC

(* ==================== 变量 ==================== *)
VARIABLES
    articleStatus,    (* 文章状态："none" / "pending" / "approved" / "rejected" *)
    publishedCount    (* 已发布文章数：0..2（受限控制状态空间） *)

(* ==================== 状态不变式（TypeInvariant） ==================== *)
TypeInvariant ==
    /\ articleStatus \in {"none", "pending", "approved", "rejected"}
    /\ publishedCount \in 0..2

(* ==================== 业务不变式 ==================== *)

(* BI-1：文章已发布（非 none）必有发布计数 —— 对应 REQ-003 发布前置 *)
ArticleExistsImpliesPublished ==
    articleStatus # "none" => publishedCount > 0

(* BI-2：发布计数不超过上限 —— 对应状态空间受限约束 *)
PublishedCountBounded ==
    publishedCount <= 2

(* 综合 BusinessInvariant *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ ArticleExistsImpliesPublished
    /\ PublishedCountBounded

(* ==================== 初始状态 ==================== *)
Init ==
    /\ articleStatus = "none"
    /\ publishedCount = 0

(* ==================== 状态转移（Next） ==================== *)

(* 发布文章：文章须不存在，计数未达上限 —— 对应 REQ-003 发布
   初始状态为 pending（待审核），审核状态流转由 SD-REVIEW 子系统驱动 *)
PublishArticle ==
    /\ articleStatus = "none"
    /\ publishedCount < 2
    /\ articleStatus' = "pending"
    /\ publishedCount' = publishedCount + 1

(* 审核通过：pending → approved（由 SD-REVIEW 子系统驱动）—— 对应 REQ-005 approve *)
ReviewApprove ==
    /\ articleStatus = "pending"
    /\ articleStatus' = "approved"
    /\ UNCHANGED <<publishedCount>>

(* 审核驳回：pending → rejected（由 SD-REVIEW 子系统驱动）—— 对应 REQ-005 reject *)
ReviewReject ==
    /\ articleStatus = "pending"
    /\ articleStatus' = "rejected"
    /\ UNCHANGED <<publishedCount>>

(* 开始新文章周期：终态 → none，重置发布计数 —— 保证状态机无死锁 *)
StartNewArticle ==
    /\ articleStatus \in {"approved", "rejected"}
    /\ articleStatus' = "none"
    /\ publishedCount' = 0

(* Next：所有可能转移的析取 *)
Next ==
    \/ PublishArticle
    \/ ReviewApprove
    \/ ReviewReject
    \/ StartNewArticle

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<articleStatus, publishedCount>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数 = |{none,pending,approved,rejected}| × |0..2| = 4 × 3 = 12
   ≤ 1000，kept-below-threshold，无需拆解。
   注：approved/rejected 状态由 SD-REVIEW 子系统状态机驱动（L2_review_subsystem），
   本规格聚焦文章状态机：none→pending→(approved|rejected)→none 循环，无死锁。 *)
================
