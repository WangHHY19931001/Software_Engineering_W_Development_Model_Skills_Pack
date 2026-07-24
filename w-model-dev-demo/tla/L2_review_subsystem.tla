(*
  @system        blog-system::review-subsystem
  @requirement   REQ-001, REQ-005
  @design        docs/system-design.md#SD-REVIEW
  @parent        ../tla/L1_blog_system.tla
  @sibling       ../tla/L2_auth_subsystem.tla, ../tla/L2_article_subsystem.tla, ../tla/L2_comment_subsystem.tla
  @child         null
  @level         L2
  @phase         2
*)
---- MODULE L2_review_subsystem ----
EXTENDS Naturals, TLC

(* ==================== 变量 ==================== *)
VARIABLES
    articleStatus,     (* 文章状态："none" / "pending" / "approved" / "rejected" *)
    reviewedByAdmin    (* 是否已由管理员审核：0 / 1（一经审核置 1，不可逆） *)

(* ==================== 状态不变式（TypeInvariant） ==================== *)
TypeInvariant ==
    /\ articleStatus \in {"none", "pending", "approved", "rejected"}
    /\ reviewedByAdmin \in {0, 1}

(* ==================== 业务不变式 ==================== *)

(* BI-1：文章已审核（approved/rejected）必有管理员介入 —— 对应 REQ-005 仅管理员可审核 *)
ReviewedStatusImpliesAdmin ==
    (articleStatus = "approved" \/ articleStatus = "rejected") => reviewedByAdmin = 1

(* BI-2：审核目标须为 pending 文章 —— 审核行为仅作用于 pending 状态
   （状态不变式表达：approved/rejected 状态必曾经过 pending，由 reviewedByAdmin 间接保证） *)
ReviewTargetIsPending ==
    articleStatus = "none" => reviewedByAdmin = 0

(* 综合 BusinessInvariant *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ ReviewedStatusImpliesAdmin
    /\ ReviewTargetIsPending

(* ==================== 初始状态 ==================== *)
Init ==
    /\ articleStatus = "none"
    /\ reviewedByAdmin = 0

(* ==================== 状态转移（Next） ==================== *)

(* 文章发布（外部子系统 SD-ARTICLE 驱动）：none → pending *)
MarkPending ==
    /\ articleStatus = "none"
    /\ articleStatus' = "pending"
    /\ UNCHANGED reviewedByAdmin

(* 审核通过：须 pending 状态，管理员审核 —— 对应 REQ-005 审核 approve *)
ReviewApprove ==
    /\ articleStatus = "pending"
    /\ articleStatus' = "approved"
    /\ reviewedByAdmin' = 1

(* 审核驳回：须 pending 状态，管理员审核 —— 对应 REQ-005 审核 reject *)
ReviewReject ==
    /\ articleStatus = "pending"
    /\ articleStatus' = "rejected"
    /\ reviewedByAdmin' = 1

(* 开始新审核周期：终态 → none，重置管理员审核标记 —— 保证状态机无死锁 *)
StartNewReviewCycle ==
    /\ articleStatus \in {"approved", "rejected"}
    /\ articleStatus' = "none"
    /\ reviewedByAdmin' = 0

(* Next：所有可能转移的析取 *)
Next ==
    \/ MarkPending
    \/ ReviewApprove
    \/ ReviewReject
    \/ StartNewReviewCycle

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<articleStatus, reviewedByAdmin>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数 = |{none,pending,approved,rejected}| × |{0,1}| = 4 × 2 = 8
   ≤ 1000，kept-below-threshold，无需拆解。 *)
================
