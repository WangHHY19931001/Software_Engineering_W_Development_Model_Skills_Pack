(*
  @system        blog-system-demo
  @requirement   SD-003
  @design        docs/detailed-design.md
  @parent        ../tla/L3_auth_session.tla
  @sibling       null
  @child         null
  @level         L4
  @phase         4
  所属系统: blog-system-demo
  关联需求: SD-003 多用户（JWT token 生命周期原子行为）
  关联设计: docs/detailed-design.md §3.3 SD-003 + docs/interface-design.md INTF-003
  上级 TLA: L3_auth_session.tla
  同级 TLA: 无（L4 最细粒度原子行为规格，单一职责）
  下级 TLA: 无（L4 为叶子规格）
  层级: L4 (最细粒度原子行为)
  requirementIds: [SD-003]
*)
---- MODULE L4_auth_token_lifecycle ----
EXTENDS Naturals, Sequences, FiniteSets

(* ==================== 常量 ==================== *)
CONSTANTS
    Users,          (* 用户全集 *)
    Tokens,         (* Token 全集 *)
    Jtis            (* Token 唯一标识全集（用于吊销） *)

(* ==================== 状态空间定义 ==================== *)
(* 用户状态 (REQ-003 验收标准 5) *)
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
NoneJti == "nonejti"

(* ==================== 变量 ==================== *)
VARIABLES
    userState,          (* 用户状态：user -> UserStates ∪ {NonExistUser} *)
    tokenState,         (* Token 状态：token -> TokenStates ∪ {NonExistToken} *)
    tokenUser,          (* Token 绑定用户：token -> Users ∪ {NoneUser} *)
    tokenJti,           (* Token 唯一标识：token -> Jtis ∪ {NoneJti} *)
    tokenIssuedAt,      (* Token 签发时间：token -> Nat（秒级，0 表示未签发） *)
    revokedJtis,        (* 已吊销 jti 集合：Set<Jtis> *)
    now                 (* 当前时间戳：Nat（秒级） *)

vars == <<userState, tokenState, tokenUser, tokenJti, tokenIssuedAt, revokedJtis, now>>

(* ==================== TypeInvariant ==================== *)
TypeInvariant ==
    /\ userState \in [Users -> UserStates \cup {NonExistUser}]
    /\ tokenState \in [Tokens -> TokenStates \cup {NonExistToken}]
    /\ tokenUser \in [Tokens -> Users \cup {NoneUser}]
    /\ tokenJti \in [Tokens -> Jtis \cup {NoneJti}]
    /\ tokenIssuedAt \in [Tokens -> Nat]
    /\ revokedJtis \subseteq Jtis
    /\ now \in Nat

(* ==================== 业务不变式 ==================== *)

(* @designRef docs/detailed-design.md#§3.3 SD-003 Token 状态机合法
 * 业务语义：Token 生命周期（REQ-003 验收标准 4）：
 *   未签发 → valid (IssueToken)
 *   valid → expired (时间到达 TTL)
 *   valid → revoked (用户封禁或主动登出)
 *   expired/revoked 不可恢复为 valid（防止重用） *)
TokenStateInvariant ==
    /\ \A t \in Tokens :
        tokenState[t] \in TokenStates \cup {NonExistToken}
    /\ \A t \in Tokens :
        tokenState[t] = NonExistToken => tokenUser[t] = NoneUser
    /\ \A t \in Tokens :
        tokenState[t] = NonExistToken => tokenJti[t] = NoneJti

(* @designRef docs/detailed-design.md#§3.3 SD-003 Token 不可重用
 * 业务语义：已吊销/已过期的 Token 不可再次验证通过（REQ-003 验收标准 4）。
 *   jti 在 revokedJtis 集合中的 Token 必为 revoked 状态。 *)
TokenNotReusedInvariant ==
    /\ \A t \in Tokens :
        tokenJti[t] \in revokedJtis => tokenState[t] = TokenRevoked
    /\ \A t \in Tokens :
        tokenState[t] = TokenExpired => tokenIssuedAt[t] + TokenTTL <= now

(* @designRef docs/detailed-design.md#§3.3 SD-003 封禁使用户 Token 失效
 * 业务语义：用户被封禁后，其所有 valid Token 必须立即失效（REQ-003 验收标准 5）。
 *   ban 操作触发 revokeAllUserTokens，将用户所有 valid Token 的 jti 加入 revokedJtis。 *)
BanInvalidatesTokenInvariant ==
    /\ \A u \in Users :
        userState[u] = UserBanned =>
            \A t \in Tokens :
                (tokenUser[t] = u /\ tokenState[t] # NonExistToken) =>
                    tokenState[t] = TokenRevoked
    /\ \A t \in Tokens :
        tokenState[t] = TokenValid => tokenUser[t] # NoneUser

(* @designRef docs/detailed-design.md#§3.3 SD-003 Token 绑定用户一致
 * 业务语义：Token 必须绑定到存在的活跃用户（REQ-003 验收标准 4）。 *)
TokenUserBindingInvariant ==
    /\ \A t \in Tokens :
        tokenState[t] = TokenValid =>
            tokenUser[t] \in Users /\ userState[tokenUser[t]] = UserActive
    /\ \A t \in Tokens :
        tokenState[t] = NonExistToken => tokenUser[t] = NoneUser

(* ==================== BusinessInvariant 聚合 ==================== *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ TokenStateInvariant
    /\ TokenNotReusedInvariant
    /\ BanInvalidatesTokenInvariant
    /\ TokenUserBindingInvariant

(* ==================== 初始状态 ==================== *)
Init ==
    /\ userState = [u \in Users |-> NonExistUser]
    /\ tokenState = [t \in Tokens |-> NonExistToken]
    /\ tokenUser = [t \in Tokens |-> NoneUser]
    /\ tokenJti = [t \in Tokens |-> NoneJti]
    /\ tokenIssuedAt = [t \in Tokens |-> 0]
    /\ revokedJtis = {}
    /\ now = 0

(* ==================== 状态转移（Next） ==================== *)

(* SD-003 原子动作1：注册用户（user 状态 active）
 * 守卫：user 未注册 *)
RegisterUser(user) ==
    /\ user \in Users
    /\ userState[user] = NonExistUser
    /\ userState' = [userState EXCEPT ![user] = UserActive]
    /\ UNCHANGED <<tokenState, tokenUser, tokenJti, tokenIssuedAt, revokedJtis, now>>

(* SD-003 原子动作2：签发 Token（login 成功）
 * 守卫：user 存在且 active + token 未签发 + jti 唯一 *)
IssueToken(user, token, jti) ==
    /\ user \in Users
    /\ userState[user] = UserActive
    /\ token \in Tokens
    /\ jti \in Jtis
    /\ tokenState[token] = NonExistToken
    /\ jti \notin revokedJtis
    /\ tokenState' = [tokenState EXCEPT ![token] = TokenValid]
    /\ tokenUser' = [tokenUser EXCEPT ![token] = user]
    /\ tokenJti' = [tokenJti EXCEPT ![token] = jti]
    /\ tokenIssuedAt' = [tokenIssuedAt EXCEPT ![token] = now]
    /\ UNCHANGED <<userState, revokedJtis, now>>

(* SD-003 原子动作3：验证 Token（verifyToken）
 * 守卫：token 为 valid + 未过期 + jti 未吊销 + 用户 active
 * 不改变状态（纯查询），但若过期则转为 expired *)
VerifyToken(token) ==
    /\ token \in Tokens
    /\ tokenState[token] = TokenValid
    /\ tokenJti[token] \notin revokedJtis
    /\ tokenUser[token] \in Users
    /\ userState[tokenUser[token]] = UserActive
    /\ UNCHANGED <<userState, tokenState, tokenUser, tokenJti, tokenIssuedAt, revokedJtis, now>>

(* SD-003 原子动作4：Token 过期（时间到达 TTL）
 * 守卫：token 为 valid + now - issuedAt >= TTL *)
ExpireToken(token) ==
    /\ token \in Tokens
    /\ tokenState[token] = TokenValid
    /\ now - tokenIssuedAt[token] >= TokenTTL
    /\ tokenState' = [tokenState EXCEPT ![token] = TokenExpired]
    /\ UNCHANGED <<userState, tokenUser, tokenJti, tokenIssuedAt, revokedJtis, now>>

(* SD-003 原子动作5：吊销单个 Token（主动登出）
 * 守卫：token 为 valid + jti 未在 revokedJtis *)
RevokeToken(token) ==
    /\ token \in Tokens
    /\ tokenState[token] = TokenValid
    /\ tokenJti[token] \in Jtis
    /\ tokenState' = [tokenState EXCEPT ![token] = TokenRevoked]
    /\ revokedJtis' = revokedJtis \cup {tokenJti[token]}
    /\ UNCHANGED <<userState, tokenUser, tokenJti, tokenIssuedAt, now>>

(* SD-003 原子动作6：封禁用户（ban 触发吊销该用户所有 Token）
 * 守卫：user 存在且 active + operator 为 admin（外部权限校验） *)
BanUser(user) ==
    /\ user \in Users
    /\ userState[user] = UserActive
    /\ userState' = [userState EXCEPT ![user] = UserBanned]
    /\ tokenState' = [t \in Tokens |->
        IF tokenUser[t] = user /\ tokenState[t] = TokenValid
        THEN TokenRevoked
        ELSE tokenState[t]]
    /\ revokedJtis' = revokedJtis \cup {tokenJti[t] : t \in {tt \in Tokens : tokenUser[tt] = user /\ tokenState[tt] = TokenValid}}
    /\ UNCHANGED <<tokenUser, tokenJti, tokenIssuedAt, now>>

(* SD-003 原子动作7：时间推进（系统时钟 tick）
 * 守卫：now 单调递增 *)
Tick(seconds) ==
    /\ seconds \in Nat
    /\ seconds > 0
    /\ now' = now + seconds
    /\ UNCHANGED <<userState, tokenState, tokenUser, tokenJti, tokenIssuedAt, revokedJtis>>

(* Next：联合 Token 生命周期所有原子动作 *)
Next ==
    \/ \E u \in Users : RegisterUser(u)
    \/ \E u \in Users, t \in Tokens, j \in Jtis : IssueToken(u, t, j)
    \/ \E t \in Tokens : VerifyToken(t)
    \/ \E t \in Tokens : ExpireToken(t)
    \/ \E t \in Tokens : RevokeToken(t)
    \/ \E u \in Users : BanUser(u)
    \/ \E s \in Nat : Tick(s)

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<vars>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数分析（按 .cfg 常量赋值数计算，tla-plus-guide.md §1.1）：
 *   3 个常量：Users / Tokens / Jtis
 *   .cfg 中每个常量赋 2 个值 → 变量组合数 = 2^3 = 8
 *   8 < 1000 → kept-below-threshold（保留不拆）
 * decompositionDecision: "kept-below-threshold"
 * L4 在 L3 基础上细化：增加 jti 吊销集合 + now 时间推进 + BanUser 联动吊销
 *)
================
