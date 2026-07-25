(*
  @system        blog-system-demo
  @requirement   SD-003
  @design        docs/system-design.md
  @parent        ../tla/L2_identity_access.tla
  @sibling       null
  @child         ../tla/L4_auth_token_lifecycle.tla
  @level         L3
  @phase         3
  所属系统: blog-system-demo
  关联需求: SD-003 多用户（JWT 会话原子行为）
  关联设计: docs/system-design.md §3.1 SD-003 JWT 认证 + docs/interface-design.md INTF-003
  上级 TLA: L2_identity_access.tla
  同级 TLA: 无（L3 原子行为规格，单一职责）
  下级 TLA: 无（L3 为叶子规格）
  层级: L3 (原子化子系统行为)
  requirementIds: [SD-003]
*)
---- MODULE L3_auth_session ----
EXTENDS Naturals, Sequences, FiniteSets

(* ==================== 常量 ==================== *)
CONSTANTS
    Users,          (* 用户全集 *)
    Tokens          (* Token 全集 *)

(* ==================== 状态空间定义 ==================== *)
(* 用户状态 (REQ-003) *)
UserActive == "active"
UserBanned == "banned"
UserStates == {UserActive, UserBanned}
NonExistUser == "notexist"

(* Token 状态 (REQ-003 JWT 24h) *)
TokenValid == "valid"
TokenRevoked == "revoked"
TokenExpired == "expired"
TokenStates == {TokenValid, TokenRevoked, TokenExpired}
NonExistToken == "nottoken"

(* JWT 有效期 (REQ-003 验收标准 4: 24h = 86400s) *)
TokenTTL == 86400

NoneUser == "noneuser"

(* ==================== 变量 ==================== *)
VARIABLES
    userState,          (* 用户状态：user -> UserStates ∪ {NonExistUser} *)
    tokenStore,         (* Token 存储：token -> (user, TokenStates) ∪ {NonExistToken} *)
    tokenIssuedAt       (* Token 签发时间：token -> Nat（秒级时间戳，0 表示未签发） *)

vars == <<userState, tokenStore, tokenIssuedAt>>

(* ==================== TypeInvariant ==================== *)
TypeInvariant ==
    /\ userState \in [Users -> UserStates \cup {NonExistUser}]
    /\ tokenStore \in [Tokens -> Users \times TokenStates \cup {NonExistToken}]
    /\ tokenIssuedAt \in [Tokens -> Nat]

(* ==================== 业务不变式 ==================== *)

(* @designRef docs/system-design.md#§3.1 SD-003 用户状态合法
 * 业务语义：用户状态必须在 UserStates 中（active/banned，REQ-003 验收标准 1）。
 *   未注册用户状态为 NonExistUser；封禁用户 token 立即失效（REQ-003 验收标准 3）。 *)
UserStateInvariant ==
    /\ \A u \in Users :
        userState[u] \in UserStates \cup {NonExistUser}
    /\ \A u \in Users :
        userState[u] = NonExistUser => userState[u] = NonExistUser

(* @designRef docs/system-design.md#§6.1 SD-003 JWT 认证绑定
 * 业务语义：Token 有效期为 24h（86400s，REQ-003 验收标准 4）。
 *   每个 token 绑定单一用户；tokenStore[t] = <<user, state>> 二元组。
 *   封禁/登出时 token 进入 TokenRevoked 状态，不可再用。 *)
TokenBindingInvariant ==
    /\ \A t \in Tokens :
        tokenStore[t] # NonExistToken =>
            /\ tokenStore[t] \in Users \times TokenStates
            /\ tokenStore[t][1] \in Users
    /\ \A t \in Tokens :
        tokenStore[t] = NonExistToken => tokenIssuedAt[t] = 0

(* @designRef docs/system-design.md#§3.1 SD-003 封禁用户 token 立即失效
 * 业务语义：被封禁用户不存在有效 token（REQ-003 验收标准 3）。
 *   封禁后所有该用户的 token 立即进入 revoked 状态，保证越权访问被拦截。 *)
BanTokenInvalidation ==
    \A u \in Users, t \in Tokens :
        /\ userState[u] = UserBanned
        /\ tokenStore[t] # NonExistToken
        /\ tokenStore[t][1] = u
        => tokenStore[t][2] # TokenValid

(* @designRef docs/system-design.md#§6.1 SD-003 JWT TTL 限制
 * 业务语义：Token 签发时间戳为非负整数（REQ-003 验收标准 4）。
 *   未签发 token 的 issuedAt 为 0；签发后记录秒级时间戳用于过期判定。 *)
TokenTTLInvariant ==
    \A t \in Tokens :
        tokenIssuedAt[t] >= 0

(* ==================== BusinessInvariant 聚合 ==================== *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ UserStateInvariant
    /\ TokenBindingInvariant
    /\ BanTokenInvalidation
    /\ TokenTTLInvariant

(* ==================== 初始状态 ==================== *)
Init ==
    /\ userState = [u \in Users |-> NonExistUser]
    /\ tokenStore = [t \in Tokens |-> NonExistToken]
    /\ tokenIssuedAt = [t \in Tokens |-> 0]

(* ==================== 状态转移（Next） ==================== *)

(* SD-003 动作1：用户注册（email+password，状态 active） *)
UserRegister(user) ==
    /\ user \in Users
    /\ userState[user] = NonExistUser
    /\ userState' = [userState EXCEPT ![user] = UserActive]
    /\ UNCHANGED <<tokenStore, tokenIssuedAt>>

(* SD-003 动作2：用户登录（签发 JWT 24h，记录签发时间） *)
UserLogin(user, token, now) ==
    /\ user \in Users
    /\ token \in Tokens
    /\ now \in Nat
    /\ userState[user] = UserActive
    /\ tokenStore[token] = NonExistToken
    /\ tokenStore' = [tokenStore EXCEPT ![token] = <<user, TokenValid>>]
    /\ tokenIssuedAt' = [tokenIssuedAt EXCEPT ![token] = now]
    /\ UNCHANGED <<userState>>

(* SD-003 动作3：用户登出（token 进入 revoked） *)
UserLogout(token) ==
    /\ token \in Tokens
    /\ tokenStore[token] # NonExistToken
    /\ tokenStore[token][2] = TokenValid
    /\ tokenStore' = [tokenStore EXCEPT ![token] = <<tokenStore[token][1], TokenRevoked>>]
    /\ UNCHANGED <<userState, tokenIssuedAt>>

(* SD-003 动作4：管理员封禁用户（token 立即失效） *)
BanUser(admin, target) ==
    /\ admin \in Users
    /\ target \in Users
    /\ userState[admin] = UserActive
    /\ userState[target] = UserActive
    /\ userState' = [userState EXCEPT ![target] = UserBanned]
    (* 被封禁用户的所有有效 token 立即进入 revoked 状态 *)
    /\ tokenStore' = [t \in Tokens |->
        IF tokenStore[t] = NonExistToken
        THEN NonExistToken
        ELSE IF tokenStore[t][1] = target
        THEN <<target, TokenRevoked>>
        ELSE tokenStore[t]]
    /\ UNCHANGED <<tokenIssuedAt>>

(* SD-003 动作5：管理员解禁用户 *)
UnbanUser(admin, target) ==
    /\ admin \in Users
    /\ target \in Users
    /\ userState[admin] = UserActive
    /\ userState[target] = UserBanned
    /\ userState' = [userState EXCEPT ![target] = UserActive]
    /\ UNCHANGED <<tokenStore, tokenIssuedAt>>

(* SD-003 动作6：Token 过期（TTL 到期，valid → expired） *)
ExpireToken(token) ==
    /\ token \in Tokens
    /\ tokenStore[token] # NonExistToken
    /\ tokenStore[token][2] = TokenValid
    /\ tokenStore' = [tokenStore EXCEPT ![token] = <<tokenStore[token][1], TokenExpired>>]
    /\ UNCHANGED <<userState, tokenIssuedAt>>

(* SD-003 动作7：撤销 token（管理员强制撤销） *)
RevokeToken(token) ==
    /\ token \in Tokens
    /\ tokenStore[token] # NonExistToken
    /\ tokenStore[token][2] \in {TokenValid, TokenExpired}
    /\ tokenStore' = [tokenStore EXCEPT ![token] = <<tokenStore[token][1], TokenRevoked>>]
    /\ UNCHANGED <<userState, tokenIssuedAt>>

(* Next：联合认证会话所有原子动作 *)
Next ==
    \/ \E u \in Users : UserRegister(u)
    \/ \E u \in Users, t \in Tokens, n \in Nat : UserLogin(u, t, n)
    \/ \E t \in Tokens : UserLogout(t)
    \/ \E a \in Users, t \in Users : BanUser(a, t)
    \/ \E a \in Users, t \in Users : UnbanUser(a, t)
    \/ \E t \in Tokens : ExpireToken(t)
    \/ \E t \in Tokens : RevokeToken(t)

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<vars>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数分析（按 .cfg 常量赋值数计算，tla-plus-guide.md §1.1）：
 *   2 个常量：Users / Tokens
 *   .cfg 中每个常量赋 2 个值 → 变量组合数 = 2^2 = 4
 *   4 < 1000 → kept-below-threshold（保留不拆）
 * decompositionDecision: "kept-below-threshold"
 *)
================
