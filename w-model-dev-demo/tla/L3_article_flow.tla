(*
  @system        blog-system::article-subsystem::article-flow
  @requirement   REQ-003, REQ-005
  @design        docs/detailed-design.md#DD-ARTICLE-SVC, docs/detailed-design.md#DD-ARTICLE-CTRL, docs/detailed-design.md#DD-REVIEW-SVC, docs/detailed-design.md#DD-ARTICLE-STORE
  @parent        ../tla/L2_article_subsystem.tla
  @sibling       ../tla/L3_auth_flow.tla, ../tla/L3_comment_flow.tla
  @child         null
  @level         L3
  @phase         4
*)
---- MODULE L3_article_flow ----
EXTENDS Naturals, TLC

(* ==================== 变量 ==================== *)
VARIABLES
    articleFlow,       (* 文章流程步骤："idle" / "pending" / "approved" / "rejected" *)
    reviewActionTaken  (* 是否已执行审核动作：0 / 1（一经审核置 1，不可逆） *)

(* ==================== 状态不变式（TypeInvariant） ==================== *)
TypeInvariant ==
    /\ articleFlow \in {"idle", "pending", "approved", "rejected"}
    /\ reviewActionTaken \in {0, 1}

(* ==================== 业务不变式 ==================== *)

(* BI-1：文章已审核（approved/rejected）必有审核动作 —— 对应 REQ-005 仅管理员可审核
   对应 DD-REVIEW-SVC.review 契约：审核后才进入 approved/rejected *)
ReviewedImpliesAction ==
    (articleFlow = "approved" \/ articleFlow = "rejected") => reviewActionTaken = 1

(* BI-2：idle 状态下无审核动作 —— 对应 DD-ARTICLE-SVC.publish 前置约束 *)
IdleImpliesNoReview ==
    articleFlow = "idle" => reviewActionTaken = 0

(* BI-3：pending 状态下审核动作尚未执行 —— 审核目标须为 pending 文章
   对应 DD-REVIEW-SVC.review 契约：action 作用于 pending 文章（60002 状态非法） *)
PendingImpliesPreReview ==
    articleFlow = "pending" => reviewActionTaken = 0

(* 综合 BusinessInvariant（展开为子不变式合取，含 TypeInvariant）
   .cfg INVARIANTS 列表须与此处展开集合完全一致（check-tla-model.ts §11 cfg-tla 一致性） *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ ReviewedImpliesAction
    /\ IdleImpliesNoReview
    /\ PendingImpliesPreReview

(* ==================== 初始状态 ==================== *)
Init ==
    /\ articleFlow = "idle"
    /\ reviewActionTaken = 0

(* ==================== 状态转移（Next） ==================== *)

(* 发布文章原子步：idle → pending —— 对应 DD-ARTICLE-CTRL.publishArticle → DD-ARTICLE-SVC.publish
   原子步序列：生成 articleId → 创建 Article 对象（status=pending）→ DD-ARTICLE-STORE.save 存入
   文章初始状态为 pending（待审核），存入 ArticleStore *)
PublishArticle ==
    /\ articleFlow = "idle"
    /\ articleFlow' = "pending"
    /\ UNCHANGED reviewActionTaken

(* 审核通过原子步：pending → approved —— 对应 DD-ARTICLE-CTRL.reviewArticle → DD-REVIEW-SVC.review(action=approve)
   原子步序列：DD-ARTICLE-STORE.findById 校验存在 → 校验 status=pending → DD-ARTICLE-STORE.updateStatus 更新
   管理员审核后回写 ArticleStore.updateStatus *)
ReviewApprove ==
    /\ articleFlow = "pending"
    /\ articleFlow' = "approved"
    /\ reviewActionTaken' = 1

(* 审核驳回原子步：pending → rejected —— 对应 DD-ARTICLE-CTRL.reviewArticle → DD-REVIEW-SVC.review(action=reject)
   原子步序列：DD-ARTICLE-STORE.findById 校验存在 → 校验 status=pending → DD-ARTICLE-STORE.updateStatus 更新
   管理员审核后回写 ArticleStore.updateStatus，rejected 对普通用户不可见（DD-ARTICLE-SVC.list 过滤） *)
ReviewReject ==
    /\ articleFlow = "pending"
    /\ articleFlow' = "rejected"
    /\ reviewActionTaken' = 1

(* 重置周期：approved/rejected → idle —— 允许新的发布-审核周期，保证状态机无死锁 *)
ResetCycle ==
    /\ articleFlow \in {"approved", "rejected"}
    /\ articleFlow' = "idle"
    /\ reviewActionTaken' = 0

(* Next：所有可能转移的析取 *)
Next ==
    \/ PublishArticle
    \/ ReviewApprove
    \/ ReviewReject
    \/ ResetCycle

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<articleFlow, reviewActionTaken>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数 = |{idle,pending,approved,rejected}| × |{0,1}| = 4 × 2 = 8
   ≤ 1000，kept-below-threshold，无需拆解。
   注：本规格聚焦文章发布-审核原子流（idle→pending→(approved|rejected)→idle 循环），
   含发布（DD-ARTICLE-SVC.publish）+ 审核（DD-REVIEW-SVC.review）+ 状态更新（DD-ARTICLE-STORE.updateStatus）原子步，
   对应 DD-ARTICLE-SVC/DD-ARTICLE-CTRL/DD-REVIEW-SVC 接口契约的状态语义。 *)
================
