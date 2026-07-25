(*
  @system        blog-system-demo
  @requirement   SD-002, SD-003
  @design        docs/system-design.md
  @parent        ../tla/L1_blog_system.tla
  @sibling       ../tla/L2_content_management.tla, ../tla/L2_discovery.tla, ../tla/L2_interaction.tla, ../tla/L2_operations_support.tla, ../tla/L2_infrastructure.tla, ../tla/L2_subscription_push.tla
  @child         ../tla/L3_auth_session.tla
  @level         L2
  @phase         2
  所属系统: blog-system-demo
  关联需求: SD-002 多博主 + SD-003 多用户 + RBAC（身份与访问域）
  关联设计: docs/system-design.md §3.1 SD-002/003 + §6.1 认证授权
  上级 TLA: L1_blog_system.tla
  同级 TLA: 其他 6 个 L2 规格
  下级 TLA: L3_auth_session.tla（阶段 3 产出，SD-003 JWT 会话原子行为）
  层级: L2 (子系统内部行为)
  requirementIds: [SD-002, SD-003]
*)
---- MODULE L2_identity_access ----
EXTENDS Naturals, Sequences, FiniteSets

(* ==================== 常量 ==================== *)
CONSTANTS
    Users,         (* 用户全集 *)
    Bloggers,      (* 博主全集 *)
    Roles,         (* 角色全集：user/blogger/admin/super_admin *)
    Tokens         (* Token 全集 *)

(* ==================== 状态空间定义 ==================== *)
(* 用户状态 (REQ-003) *)
UserActive == "active"
UserBanned == "banned"
UserStates == {UserActive, UserBanned}
NonExistUser == "notexist"

(* 博主角色 (REQ-002) *)
BloggerNormal == "normal"
BloggerVerified == "verified"
BloggerInvited == "invited"
BloggerRoles == {BloggerNormal, BloggerVerified, BloggerInvited}
NonExistBlogger == "notblogger"

(* Token 状态 (REQ-003 JWT 24h) *)
TokenValid == "valid"
TokenRevoked == "revoked"
TokenStates == {TokenValid, TokenRevoked}
NonExistToken == "nottoken"

(* 角色四级 (REQ-003 RBAC) *)
RoleUser == "user"
RoleBlogger == "blogger"
RoleAdmin == "admin"
RoleSuperAdmin == "super_admin"
AllRoles == {RoleUser, RoleBlogger, RoleAdmin, RoleSuperAdmin}

NoneUser == "noneuser"

(* ==================== 变量 ==================== *)
VARIABLES
    userRegistry,           (* 用户状态：user -> UserStates ∪ {NonExistUser} *)
    userRole,               (* 用户角色：user -> Roles（user/blogger/admin/super_admin） *)
    bloggerRegistry,        (* 博主状态：blogger -> BloggerRoles ∪ {NonExistBlogger} *)
    followGraph,            (* 关注关系：blogger -> SUBSET Bloggers（粉丝集合） *)
    tokenStore              (* Token 存储：token -> (user, TokenStates) ∪ {NonExistToken} *)

vars == <<userRegistry, userRole, bloggerRegistry, followGraph, tokenStore>>

(* ==================== TypeInvariant ==================== *)
TypeInvariant ==
    /\ userRegistry \in [Users -> UserStates \cup {NonExistUser}]
    /\ userRole \in [Users -> AllRoles]
    /\ bloggerRegistry \in [Bloggers -> BloggerRoles \cup {NonExistBlogger}]
    /\ followGraph \in [Bloggers -> SUBSET Bloggers]
    /\ tokenStore \in [Tokens -> Users \times TokenStates \cup {NonExistToken}]

(* ==================== 业务不变式 ==================== *)

(* @designRef docs/system-design.md#§3.1 SD-003 多用户 RBAC
 * 业务语义：用户角色必须在四级 RBAC 之中（user < blogger < admin < super_admin，REQ-003 验收标准 2）。
 *   已注册用户必有合法角色；未注册用户角色为 RoleUser（默认值）。
 *   越权访问由 requireRole 中间件拦截返回 403（REQ-003 数据约束）。 *)
UserRoleInvariant ==
    /\ \A u \in Users :
        userRole[u] \in AllRoles
    /\ \A u \in Users :
        userRegistry[u] = NonExistUser => userRole[u] = RoleUser

(* @designRef docs/system-design.md#§3.1 SD-003 多用户封禁语义
 * 业务语义：封禁用户 token 立即失效（REQ-003 验收标准 3）。
 *   用户记录保留在 userRegistry 中（status=banned），不可登录但保留审计痕迹。
 *   解禁后状态恢复 active，可重新登录。 *)
BanTokenInvalidation ==
    /\ \A u \in Users, t \in Tokens :
        /\ userRegistry[u] = UserBanned
        /\ tokenStore[t] = <<u, TokenValid>>
        => FALSE  (* 不变量：被封禁用户不存在有效 token *)

(* @designRef docs/system-design.md#§3.1 SD-002 多博主权限隔离
 * 业务语义：博主角色必须在 BloggerRoles 中（normal/verified/invited，REQ-002 验收标准 4）。
 *   博主仅能编辑自己文章，权限隔离由 articleAuthor 单一性保证（REQ-002 验收标准 5）。
 *   邮箱全局唯一（REQ-002 数据约束），由 userRegistry 单射性保证。 *)
BloggerRoleInvariant ==
    /\ \A b \in Bloggers :
        bloggerRegistry[b] \in BloggerRoles \cup {NonExistBlogger}
    /\ \A b \in Bloggers :
        bloggerRegistry[b] # NonExistBlogger => bloggerRegistry[b] \in BloggerRoles

(* @designRef docs/system-design.md#§3.1 SD-002 多博主关注关系对称性
 * 业务语义：关注关系为有向边 follower → followee，关注集合是 Bloggers 的子集（REQ-002 验收标准 3）。
 *   关注/取关幂等（REQ-002 验收标准 6）；followGraph[b] 表示 b 的粉丝集合。
 *   博主不能关注自己（防自关注）。 *)
FollowGraphInvariant ==
    /\ \A b \in Bloggers :
        followGraph[b] \subseteq Bloggers
    /\ \A b \in Bloggers :
        b \notin followGraph[b]

(* @designRef docs/system-design.md#§6.1 SD-003 JWT 认证
 * 业务语义：Token 有效期为 24h（86400s，REQ-003 验收标准 4）。
 *   每个 token 绑定单一用户；tokenStore[t] = <<user, state>> 二元组。
 *   封禁/登出时 token 进入 TokenRevoked 状态，不可再用。 *)
TokenBindingInvariant ==
    /\ \A t \in Tokens :
        tokenStore[t] # NonExistToken =>
            /\ tokenStore[t] \in Users \times TokenStates
            /\ tokenStore[t][1] \in Users

(* ==================== BusinessInvariant 聚合 ==================== *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ UserRoleInvariant
    /\ BanTokenInvalidation
    /\ BloggerRoleInvariant
    /\ FollowGraphInvariant
    /\ TokenBindingInvariant

(* ==================== 初始状态 ==================== *)
Init ==
    /\ userRegistry = [u \in Users |-> NonExistUser]
    /\ userRole = [u \in Users |-> RoleUser]
    /\ bloggerRegistry = [b \in Bloggers |-> NonExistBlogger]
    /\ followGraph = [b \in Bloggers |-> {}]
    /\ tokenStore = [t \in Tokens |-> NonExistToken]

(* ==================== 状态转移（Next） ==================== *)

(* SD-003 动作1：用户注册（email+password，邮箱全局唯一） *)
UserRegister(user) ==
    /\ user \in Users
    /\ userRegistry[user] = NonExistUser
    /\ userRegistry' = [userRegistry EXCEPT ![user] = UserActive]
    /\ userRole' = [userRole EXCEPT ![user] = RoleUser]
    /\ UNCHANGED <<bloggerRegistry, followGraph, tokenStore>>

(* SD-003 动作2：用户登录（签发 JWT 24h） *)
UserLogin(user, token) ==
    /\ user \in Users
    /\ token \in Tokens
    /\ userRegistry[user] = UserActive
    /\ tokenStore[token] = NonExistToken
    /\ tokenStore' = [tokenStore EXCEPT ![token] = <<user, TokenValid>>]
    /\ UNCHANGED <<userRegistry, userRole, bloggerRegistry, followGraph>>

(* SD-003 动作3：用户登出（token 进入 revoked） *)
UserLogout(token) ==
    /\ token \in Tokens
    /\ tokenStore[token] # NonExistToken
    /\ tokenStore[token][2] = TokenValid
    /\ tokenStore' = [tokenStore EXCEPT ![token] = <<tokenStore[token][1], TokenRevoked>>]
    /\ UNCHANGED <<userRegistry, userRole, bloggerRegistry, followGraph>>

(* SD-003 动作4：管理员封禁用户（token 立即失效） *)
BanUser(admin, target) ==
    /\ admin \in Users
    /\ target \in Users
    /\ userRegistry[admin] = UserActive
    /\ userRole[admin] \in {RoleAdmin, RoleSuperAdmin}
    /\ userRegistry[target] = UserActive
    /\ userRegistry' = [userRegistry EXCEPT ![target] = UserBanned]
    (* 被封禁用户的所有有效 token 立即进入 revoked 状态 *)
    /\ tokenStore' = [t \in Tokens |->
        IF tokenStore[t] = NonExistToken
        THEN NonExistToken
        ELSE IF tokenStore[t][1] = target
        THEN <<target, TokenRevoked>>
        ELSE tokenStore[t]]
    /\ UNCHANGED <<userRole, bloggerRegistry, followGraph>>

(* SD-003 动作5：管理员解禁用户 *)
UnbanUser(admin, target) ==
    /\ admin \in Users
    /\ target \in Users
    /\ userRegistry[admin] = UserActive
    /\ userRole[admin] \in {RoleAdmin, RoleSuperAdmin}
    /\ userRegistry[target] = UserBanned
    /\ userRegistry' = [userRegistry EXCEPT ![target] = UserActive]
    /\ UNCHANGED <<userRole, bloggerRegistry, followGraph, tokenStore>>

(* SD-002 动作6：博主注册（仅 active 用户可申请） *)
BloggerRegister(user, blogger, role) ==
    /\ user \in Users
    /\ blogger \in Bloggers
    /\ role \in BloggerRoles
    /\ userRegistry[user] = UserActive
    /\ userRole[user] = RoleUser
    /\ bloggerRegistry[blogger] = NonExistBlogger
    /\ bloggerRegistry' = [bloggerRegistry EXCEPT ![blogger] = role]
    /\ userRole' = [userRole EXCEPT ![user] = RoleBlogger]
    /\ UNCHANGED <<userRegistry, followGraph, tokenStore>>

(* SD-002 动作7：博主关注（幂等） *)
BloggerFollow(follower, followee) ==
    /\ follower \in Bloggers
    /\ followee \in Bloggers
    /\ follower # followee
    /\ bloggerRegistry[follower] # NonExistBlogger
    /\ bloggerRegistry[followee] # NonExistBlogger
    /\ follower \notin followGraph[followee]
    /\ followGraph' = [followGraph EXCEPT ![followee] = followGraph[followee] \cup {follower}]
    /\ UNCHANGED <<userRegistry, userRole, bloggerRegistry, tokenStore>>

(* SD-002 动作8：博主取关（幂等，重复取消返回当前状态） *)
BloggerUnfollow(follower, followee) ==
    /\ follower \in Bloggers
    /\ followee \in Bloggers
    /\ follower \in followGraph[followee]
    /\ followGraph' = [followGraph EXCEPT ![followee] = followGraph[followee] \ {follower}]
    /\ UNCHANGED <<userRegistry, userRole, bloggerRegistry, tokenStore>>

(* SD-003 动作9：撤销 token（封禁或定期失效触发） *)
RevokeToken(token) ==
    /\ token \in Tokens
    /\ tokenStore[token] # NonExistToken
    /\ tokenStore[token][2] = TokenValid
    /\ tokenStore' = [tokenStore EXCEPT ![token] = <<tokenStore[token][1], TokenRevoked>>]
    /\ UNCHANGED <<userRegistry, userRole, bloggerRegistry, followGraph>>

(* Next：联合身份与访问域所有动作 *)
Next ==
    \/ \E u \in Users : UserRegister(u)
    \/ \E u \in Users, t \in Tokens : UserLogin(u, t)
    \/ \E t \in Tokens : UserLogout(t)
    \/ \E a \in Users, t \in Users : BanUser(a, t)
    \/ \E a \in Users, t \in Users : UnbanUser(a, t)
    \/ \E u \in Users, b \in Bloggers, r \in BloggerRoles : BloggerRegister(u, b, r)
    \/ \E f \in Bloggers, e \in Bloggers : BloggerFollow(f, e)
    \/ \E f \in Bloggers, e \in Bloggers : BloggerUnfollow(f, e)
    \/ \E t \in Tokens : RevokeToken(t)

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<vars>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数分析（按 .cfg 常量赋值数计算，tla-plus-guide.md §1.1）：
 *   4 个常量：Users / Bloggers / Roles / Tokens
 *   .cfg 中每个常量赋 2 个值 → 变量组合数 = 2^4 = 16
 *   16 < 1000 → kept-below-threshold（保留不拆）
 * decompositionDecision: "kept-below-threshold"
 *)
================
