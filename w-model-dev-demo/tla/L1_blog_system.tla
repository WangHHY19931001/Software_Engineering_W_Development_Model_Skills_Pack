(*
  @system        blog-system
  @requirement   REQ-001, REQ-002, REQ-003, REQ-004, REQ-005
  @design        docs/requirement-spec.md#§2
  @parent        null
  @sibling       null
  @child         ../tla/L2_auth_subsystem.tla, ../tla/L2_article_subsystem.tla, ../tla/L2_comment_subsystem.tla, ../tla/L2_review_subsystem.tla
  @level         L1
  @phase         1
*)
---- MODULE L1_blog_system ----
EXTENDS Naturals, TLC

(* ==================== 变量 ==================== *)
VARIABLES
    users,           (* 已注册用户集合：SUBSET {"u1", "admin"} *)
    session,         (* 当前会话用户："nobody" / "u1" / "admin" *)
    articleStatus,   (* 文章状态："none" / "pending" / "approved" / "rejected" *)
    commentCount     (* 评论数：0..2（受限以控制状态空间） *)

(* ==================== 状态不变式（TypeInvariant） ==================== *)
TypeInvariant ==
    /\ users \subseteq {"u1", "admin"}
    /\ session \in {"nobody", "u1", "admin"}
    /\ articleStatus \in {"none", "pending", "approved", "rejected"}
    /\ commentCount \in 0..2

(* ==================== 业务不变式 ==================== *)

(* BI-1：会话用户须已注册（除非 nobody）—— 对应 REQ-002 登录前置
   状态不变式：session != "nobody" 蕴含 session \in users *)
SessionUserRegistered ==
    session = "nobody" \/ session \in users

(* BI-2：文章已发布（非 none）必有用户曾注册 —— 对应 REQ-003 发布前置
   状态不变式：articleStatus != "none" 蕴含 users 非空 *)
ArticlePublishedRequiresRegisteredUser ==
    articleStatus # "none" => users # {}

(* BI-3：评论存在蕴含文章已发布 —— 对应 REQ-004 评论依赖文章
   状态不变式：commentCount > 0 蕴含 articleStatus # "none"
   （评论只能在文章 pending/approved 时增加；文章状态不会回退到 none；
    即使文章后续被 rejected，评论保留但文章仍非 none） *)
CommentRequiresArticleExists ==
    commentCount > 0 => articleStatus # "none"

(* 综合 BusinessInvariant（展开为子不变式合取，含类型不变式 TypeInvariant）
   .cfg INVARIANTS 列表须与此处展开集合完全一致（check-tla-model.ts §11 cfg-tla 一致性） *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ SessionUserRegistered
    /\ ArticlePublishedRequiresRegisteredUser
    /\ CommentRequiresArticleExists

(* ==================== 初始状态 ==================== *)
Init ==
    /\ users = {}
    /\ session = "nobody"
    /\ articleStatus = "none"
    /\ commentCount = 0

(* ==================== 状态转移（Next） ==================== *)

(* 注册：将候选用户加入 users 集合 —— 对应 REQ-002 注册 *)
Register(u) ==
    /\ u \in {"u1", "admin"}
    /\ u \notin users
    /\ users' = users \cup {u}
    /\ UNCHANGED <<session, articleStatus, commentCount>>

(* 登录：已注册用户设为当前会话 —— 对应 REQ-002 登录 *)
Login(u) ==
    /\ u \in users
    /\ session' = u
    /\ UNCHANGED <<users, articleStatus, commentCount>>

(* 登出：清除会话 *)
Logout ==
    /\ session # "nobody"
    /\ session' = "nobody"
    /\ UNCHANGED <<users, articleStatus, commentCount>>

(* 发布文章：须登录，文章须不存在 —— 对应 REQ-003 发布 *)
PublishArticle ==
    /\ session # "nobody"
    /\ articleStatus = "none"
    /\ articleStatus' = "pending"
    /\ UNCHANGED <<users, session, commentCount>>

(* 添加评论：须登录，文章须可见（pending 或 approved），评论数未达上限 —— 对应 REQ-004 *)
AddComment ==
    /\ session # "nobody"
    /\ articleStatus \in {"pending", "approved"}
    /\ commentCount < 2
    /\ commentCount' = commentCount + 1
    /\ UNCHANGED <<users, session, articleStatus>>

(* 审核文章：须管理员会话，文章须 pending，目标状态为 approved 或 rejected —— 对应 REQ-005 *)
ReviewArticle(newStatus) ==
    /\ session = "admin"
    /\ articleStatus = "pending"
    /\ newStatus \in {"approved", "rejected"}
    /\ articleStatus' = newStatus
    /\ UNCHANGED <<users, session, commentCount>>

(* Next：所有可能转移的析取 *)
Next ==
    \/ \E u \in {"u1", "admin"} : Register(u)
    \/ \E u \in {"u1", "admin"} : Login(u)
    \/ Logout
    \/ PublishArticle
    \/ AddComment
    \/ \E s \in {"approved", "rejected"} : ReviewArticle(s)

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<users, session, articleStatus, commentCount>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数 = |SUBSET{u1,admin}| × |{nobody,u1,admin}| × |{none,pending,approved,rejected}| × |0..2|
            = 4 × 3 × 4 × 3 = 144
   ≤ 1000，kept-below-threshold，无需拆解。 *)
================
