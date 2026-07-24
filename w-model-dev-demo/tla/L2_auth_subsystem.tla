(*
  @system        blog-system::auth-subsystem
  @requirement   REQ-001, REQ-002
  @design        docs/system-design.md#SD-AUTH
  @parent        ../tla/L1_blog_system.tla
  @sibling       ../tla/L2_article_subsystem.tla, ../tla/L2_comment_subsystem.tla, ../tla/L2_review_subsystem.tla
  @child         ../tla/L3_auth_flow.tla
  @level         L2
  @phase         2
*)
---- MODULE L2_auth_subsystem ----
EXTENDS Naturals, TLC

(* ==================== 变量 ==================== *)
VARIABLES
    registeredUsers,   (* 已注册用户集合：SUBSET {"u1", "admin"} *)
    session,           (* 当前会话用户："nobody" / "u1" / "admin" *)
    tokenIssued        (* JWT 是否已签发：0 / 1 *)

(* ==================== 状态不变式（TypeInvariant） ==================== *)
TypeInvariant ==
    /\ registeredUsers \subseteq {"u1", "admin"}
    /\ session \in {"nobody", "u1", "admin"}
    /\ tokenIssued \in {0, 1}

(* ==================== 业务不变式 ==================== *)

(* BI-1：会话用户须已注册（除非 nobody）—— 对应 REQ-002 登录前置 *)
SessionUserRegistered ==
    session = "nobody" \/ session \in registeredUsers

(* BI-2：JWT 仅在登录状态下签发 —— 对应 REQ-002/NFR-002 JWT 鉴权约束 *)
TokenIssuedRequiresLogin ==
    tokenIssued = 1 => session # "nobody"

(* 综合 BusinessInvariant（展开为子不变式合取，含 TypeInvariant）
   .cfg INVARIANTS 列表须与此处展开集合完全一致（check-tla-model.ts §11 cfg-tla 一致性） *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ SessionUserRegistered
    /\ TokenIssuedRequiresLogin

(* ==================== 初始状态 ==================== *)
Init ==
    /\ registeredUsers = {}
    /\ session = "nobody"
    /\ tokenIssued = 0

(* ==================== 状态转移（Next） ==================== *)

(* 注册：将候选用户加入集合 —— 对应 REQ-002 注册（bcrypt 哈希在实现层保证） *)
Register(u) ==
    /\ u \in {"u1", "admin"}
    /\ u \notin registeredUsers
    /\ registeredUsers' = registeredUsers \cup {u}
    /\ UNCHANGED <<session, tokenIssued>>

(* 登录：已注册用户设为会话并签发 JWT —— 对应 REQ-002 登录 *)
Login(u) ==
    /\ u \in registeredUsers
    /\ session' = u
    /\ tokenIssued' = 1
    /\ UNCHANGED registeredUsers

(* 登出：清除会话并注销 JWT *)
Logout ==
    /\ session # "nobody"
    /\ session' = "nobody"
    /\ tokenIssued' = 0
    /\ UNCHANGED registeredUsers

(* Next：所有可能转移的析取 *)
Next ==
    \/ \E u \in {"u1", "admin"} : Register(u)
    \/ \E u \in {"u1", "admin"} : Login(u)
    \/ Logout

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<registeredUsers, session, tokenIssued>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数 = |SUBSET{u1,admin}| × |{nobody,u1,admin}| × |{0,1}| = 4 × 3 × 2 = 24
   ≤ 1000，kept-below-threshold，无需拆解。 *)
================
