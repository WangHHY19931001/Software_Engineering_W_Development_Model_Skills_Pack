(*
  @system        blog-system::comment-subsystem
  @requirement   REQ-001, REQ-004
  @design        docs/system-design.md#SD-COMMENT
  @parent        ../tla/L1_blog_system.tla
  @sibling       ../tla/L2_auth_subsystem.tla, ../tla/L2_article_subsystem.tla, ../tla/L2_review_subsystem.tla
  @child         ../tla/L3_comment_flow.tla
  @level         L2
  @phase         2
*)
---- MODULE L2_comment_subsystem ----
EXTENDS Naturals, TLC

(* ==================== 变量 ==================== *)
VARIABLES
    commentCount,     (* 评论数：0..2（受限控制状态空间） *)
    articleExists     (* 目标文章是否存在：0 / 1 *)

(* ==================== 状态不变式（TypeInvariant） ==================== *)
TypeInvariant ==
    /\ commentCount \in 0..2
    /\ articleExists \in {0, 1}

(* ==================== 业务不变式 ==================== *)

(* BI-1：评论存在蕴含文章存在 —— 对应 REQ-004 评论依赖文章 *)
CommentRequiresArticleExists ==
    commentCount > 0 => articleExists = 1

(* BI-2：评论数不超过上限 —— 对应状态空间受限约束 *)
CommentCountBounded ==
    commentCount <= 2

(* 综合 BusinessInvariant *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ CommentRequiresArticleExists
    /\ CommentCountBounded

(* ==================== 初始状态 ==================== *)
Init ==
    /\ commentCount = 0
    /\ articleExists = 0

(* ==================== 状态转移（Next） ==================== *)

(* 文章发布（外部子系统 SD-ARTICLE 驱动）：标记文章存在 *)
ArticlePublished ==
    /\ articleExists = 0
    /\ articleExists' = 1
    /\ UNCHANGED commentCount

(* 添加评论：文章须存在，评论数未达上限 —— 对应 REQ-004 添加评论
   登录前置由 SD-AUTH 子系统保证（此处以 articleExists 守卫表达文章可见性） *)
AddComment ==
    /\ articleExists = 1
    /\ commentCount < 2
    /\ commentCount' = commentCount + 1
    /\ UNCHANGED articleExists

(* 归档文章：文章归档时评论一并清零 —— 允许新的文章-评论周期，保证状态机无死锁 *)
ArchiveArticle ==
    /\ articleExists = 1
    /\ articleExists' = 0
    /\ commentCount' = 0

(* Next：所有可能转移的析取 *)
Next ==
    \/ ArticlePublished
    \/ AddComment
    \/ ArchiveArticle

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<commentCount, articleExists>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数 = |0..2| × |{0,1}| = 3 × 2 = 6
   ≤ 1000，kept-below-threshold，无需拆解。 *)
================
