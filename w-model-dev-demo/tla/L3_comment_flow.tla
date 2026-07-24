(*
  @system        blog-system::comment-subsystem::comment-flow
  @requirement   REQ-004
  @design        docs/detailed-design.md#DD-COMMENT-SVC, docs/detailed-design.md#DD-COMMENT-CTRL, docs/detailed-design.md#DD-COMMENT-STORE
  @parent        ../tla/L2_comment_subsystem.tla
  @sibling       ../tla/L3_auth_flow.tla, ../tla/L3_article_flow.tla
  @child         null
  @level         L3
  @phase         4
*)
---- MODULE L3_comment_flow ----
EXTENDS Naturals, TLC

(* ==================== 变量 ==================== *)
VARIABLES
    commentStep,     (* 评论流程步骤："idle" / "article_verified" / "comment_added" *)
    commentCount     (* 评论数：0..2（受限控制状态空间） *)

(* ==================== 状态不变式（TypeVariant） ==================== *)
TypeInvariant ==
    /\ commentStep \in {"idle", "article_verified", "comment_added"}
    /\ commentCount \in 0..2

(* ==================== 业务不变式 ==================== *)

(* BI-1：评论已添加蕴含评论数 > 0 —— 对应 REQ-004 添加评论后计数递增
   对应 DD-COMMENT-SVC.add 契约：add 成功后 CommentStore 含新评论且 commentCount 递增 *)
CommentAddedImpliesCountPositive ==
    commentStep = "comment_added" => commentCount > 0

(* BI-2：评论数不超过上限 —— 对应状态空间受限约束（L2_comment_subsystem BI-2 继承） *)
CommentCountBounded ==
    commentCount <= 2

(* BI-3：idle 状态下无评论 —— 对应 DD-COMMENT-SVC.add 前置：须先校验文章存在 *)
IdleImpliesNoComment ==
    commentStep = "idle" => commentCount = 0

(* BI-4：article_verified 状态下评论可为 0 —— 校验文章存在但尚未添加评论
   对应 DD-COMMENT-SVC.add 原子步：先 DD-ARTICLE-SVC.getById 校验，再 DD-COMMENT-STORE.save 添加 *)
ArticleVerifiedAllowsZeroOrMore ==
    commentStep = "article_verified" => commentCount >= 0

(* 综合 BusinessInvariant（展开为子不变式合取，含 TypeInvariant）
   .cfg INVARIANTS 列表须与此处展开集合完全一致（check-tla-model.ts §11 cfg-tla 一致性） *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ CommentAddedImpliesCountPositive
    /\ CommentCountBounded
    /\ IdleImpliesNoComment
    /\ ArticleVerifiedAllowsZeroOrMore

(* ==================== 初始状态 ==================== *)
Init ==
    /\ commentStep = "idle"
    /\ commentCount = 0

(* ==================== 状态转移（Next） ==================== *)

(* 验证文章存在原子步：idle → article_verified —— 对应 DD-COMMENT-SVC.add 调用 DD-ARTICLE-SVC.getById
   原子步序列：DD-ARTICLE-SVC.getById(articleId, role) 校验文章存在且非 rejected
   文章存在且可评论时进入 article_verified 状态，准备添加评论 *)
VerifyArticleExists ==
    /\ commentStep = "idle"
    /\ commentStep' = "article_verified"
    /\ UNCHANGED commentCount

(* 添加评论原子步：article_verified → comment_added，计数递增 —— 对应 DD-COMMENT-CTRL.addComment → DD-COMMENT-SVC.add
   原子步序列：生成 commentId → DD-COMMENT-STORE.save 存入评论 → commentCount 递增
   首条评论从 article_verified 转入 comment_added *)
AddComment ==
    /\ commentStep = "article_verified"
    /\ commentCount < 2
    /\ commentStep' = "comment_added"
    /\ commentCount' = commentCount + 1

(* 继续添加评论原子步：comment_added → comment_added，计数递增 —— 对应 DD-COMMENT-SVC.add 多次调用
   评论数未达上限时允许继续添加，commentCount 递增 *)
AddMoreComment ==
    /\ commentStep = "comment_added"
    /\ commentCount < 2
    /\ commentCount' = commentCount + 1
    /\ UNCHANGED commentStep

(* 重置周期：comment_added → idle —— 允许新的文章-评论周期，保证状态机无死锁
   对应 L2_comment_subsystem ArchiveArticle：文章归档时评论一并清零 *)
ResetCycle ==
    /\ commentStep = "comment_added"
    /\ commentStep' = "idle"
    /\ commentCount' = 0

(* Next：所有可能转移的析取 *)
Next ==
    \/ VerifyArticleExists
    \/ AddComment
    \/ AddMoreComment
    \/ ResetCycle

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<commentStep, commentCount>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数 = |{idle,article_verified,comment_added}| × |0..2| = 3 × 3 = 9
   ≤ 1000，kept-below-threshold，无需拆解。
   注：本规格聚焦评论原子流（idle→article_verified→comment_added→idle 循环），
   含验证文章存在（DD-ARTICLE-SVC.getById）+ 添加评论（DD-COMMENT-STORE.save）+ 计数递增原子步，
   对应 DD-COMMENT-SVC/DD-COMMENT-CTRL 接口契约的状态语义。 *)
================
