(*
  @system        blog-system::auth
  @requirement   REQ-001, REQ-002, REQ-003, NFR-002, SD-001, SD-002, SD-017
  @design        docs/phase2-design/blog-system-system-design.md:§3
  @designIds     SD-001,SD-002,SD-017
  @parent        ../../../tla/specs/level1/L1_BlogSystem.tla
  @sibling       ../../../tla/specs/level2/L2_BlogSystemContent.tla, ../../../tla/specs/level2/L2_BlogSystemEngagement.tla, ../../../tla/specs/level2/L2_BlogSystemDiscovery.tla, ../../../tla/specs/level2/L2_BlogSystemOps.tla, ../../../tla/specs/level2/L2_BlogSystemInfra.tla
  @child         null
  @level         L2
  @phase         2
*)
---- MODULE L2_BlogSystemAuth ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 建模层次说明 ==================== *)
(* L2 粒度 = 子系统内部行为（设计级建模），与 L1 的粒度差异： *)
(*   - L1（L1_BlogSystem）：整体系统状态机，以请求-响应类别抽象全部 22 个 REQ。 *)
(*   - L2（本规格）：认证子系统内部状态机。基于系统设计文档 §3 模块划分，建模 *)
(*     M-001 认证服务（注册/登录/JWT 签发、密码 bcrypt 哈希，REQ-001/REQ-003）、 *)
(*     M-002 用户资料服务（认证用户查看/更新资料，REQ-002）、 *)
(*     M-017 认证/授权中间件（JWT 校验、角色与资源属主鉴权，NFR-002，横切）。 *)
(*   - L3/L4：原子化子系统行为（token 过期时序、bcrypt 成本因子等），由阶段 3/4 承担。 *)

(* ==================== 变量 ==================== *)
VARIABLES
    authState,      \* M-001 认证状态：none 未注册 / registered 已注册 / loggedIn 已登录（REQ-001/REQ-003）
    tokenValid,     \* M-017 JWT 令牌有效性：FALSE=未签发/无效/过期/伪造（NFR-002 AC1）
    pwdHashed,      \* M-001 密码是否以 bcrypt 哈希存储（NFR-002 AC2：密码不存明文）
    profileActive,  \* M-002 用户资料是否已建立/更新（REQ-002 AC1）
    accessGranted   \* M-017 授权判定结果：TRUE=鉴权放行 / FALSE=401 未认证或 403 越权

(* ==================== 取值域 ==================== *)
AUTH_STATES == {"none", "registered", "loggedIn"}

(* ==================== 状态不变式（TypeInvariant） ==================== *)
TypeInvariant ==
    /\ authState \in AUTH_STATES
    /\ tokenValid \in BOOLEAN
    /\ pwdHashed \in BOOLEAN
    /\ profileActive \in BOOLEAN
    /\ accessGranted \in BOOLEAN

(* ==================== 业务不变式 ==================== *)
\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-001 认证服务，NFR-002 AC2)
\* 注册完成后密码必须已以 bcrypt 哈希存储（不存明文；REQ-001 AC1 注册成功即建立账号）
PasswordHashedWhenRegistered ==
    authState # "none" => pwdHashed

\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-017 认证/授权中间件，NFR-002 AC1)
\* 授权放行以 JWT 令牌有效为前提（未认证/无效/过期/伪造 token → 401）
AccessRequiresValidToken ==
    accessGranted => tokenValid

\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-001 认证服务，REQ-003 AC3)
\* 令牌有效仅当处于已登录状态（登录成功签发 JWT；无效/过期/伪造 token 一律 401）
TokenValidRequiresLogin ==
    tokenValid => (authState = "loggedIn")

\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-002 用户资料服务，REQ-002 AC2 / §3.1 M-002 依赖 M-001)
\* 资料存在要求认证上下文（资料服务依赖认证服务；未注册/无认证上下文即无资料）
ProfileRequiresAuthContext ==
    profileActive => (authState # "none")

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合所有子不变式；.cfg 的 INVARIANTS 列表须与此展开集合一致（tla-plus-guide.md §11） *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ PasswordHashedWhenRegistered
    /\ AccessRequiresValidToken
    /\ TokenValidRequiresLogin
    /\ ProfileRequiresAuthContext

(* ==================== 初始状态 ==================== *)
(* 系统空闲：无注册用户、无令牌、无资料、无授权上下文 *)
Init ==
    /\ authState = "none"
    /\ tokenValid = FALSE
    /\ pwdHashed = FALSE
    /\ profileActive = FALSE
    /\ accessGranted = FALSE

(* ==================== 状态转移（Next） ==================== *)
(* 转移分支忠实于系统设计文档 §3 模块职责与需求 AC；不允许占位/简化/错误实现（反模式 #16） *)

\* M-001 用户注册（REQ-001 AC1/AC2/AC3）：合法注册 → registered 且密码 bcrypt 哈希存储
Register ==
    /\ authState = "none"
    /\ authState' = "registered"
    /\ pwdHashed' = TRUE
    /\ UNCHANGED <<tokenValid, profileActive, accessGranted>>

\* M-001 用户登录（REQ-003 AC1）：正确凭据 → 签发 JWT（tokenValid=TRUE）
LoginSuccess ==
    /\ authState = "registered"
    /\ authState' = "loggedIn"
    /\ tokenValid' = TRUE
    /\ UNCHANGED <<pwdHashed, profileActive, accessGranted>>

\* M-001/M-017 令牌失效（REQ-003 AC3）：无效/过期/伪造 token → 401（令牌与授权上下文一并作废）
TokenExpire ==
    /\ authState = "loggedIn"
    /\ tokenValid' = FALSE
    /\ accessGranted' = FALSE
    /\ UNCHANGED <<authState, pwdHashed, profileActive>>

\* M-001 退出登录（REQ-003 会话生命周期）：令牌作废、授权上下文清除，回到已注册状态
Logout ==
    /\ authState = "loggedIn"
    /\ authState' = "registered"
    /\ tokenValid' = FALSE
    /\ accessGranted' = FALSE
    /\ UNCHANGED <<pwdHashed, profileActive>>

\* M-002 资料维护（REQ-002 AC1/AC2/AC3）：仅持有有效令牌的登录用户可建立/更新资料
ProfileManage ==
    /\ authState = "loggedIn"
    /\ tokenValid = TRUE
    /\ profileActive' = TRUE
    /\ UNCHANGED <<authState, tokenValid, pwdHashed, accessGranted>>

\* M-017 认证通过 → 授权放行（NFR-002 AC1：有效令牌 + 角色/属主鉴权通过）
Authorize ==
    /\ tokenValid = TRUE
    /\ accessGranted' = TRUE
    /\ UNCHANGED <<authState, tokenValid, pwdHashed, profileActive>>

\* M-017 认证/授权拒绝（NFR-002 AC1：未认证 → 401；越权 → 403）
DenyAccess ==
    /\ tokenValid = FALSE
    /\ accessGranted' = FALSE
    /\ UNCHANGED <<authState, tokenValid, pwdHashed, profileActive>>

Next ==
    \/ Register
    \/ LoginSuccess
    \/ TokenExpire
    \/ Logout
    \/ ProfileManage
    \/ Authorize
    \/ DenyAccess

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<authState, tokenValid, pwdHashed, profileActive, accessGranted>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积
   = |AUTH_STATES|3 × |tokenValid|2 × |pwdHashed|2 × |profileActive|2 × |accessGranted|2
   = 3 × 2 × 2 × 2 × 2 = 48 *)
(* 48 ≤ 1000 → decompositionDecision = "kept-below-threshold"（契约指定值） *)
(* 保留理由：认证子系统状态维度有限（注册/登录/令牌/资料/授权），48 组合数远低于拆解阈值， *)
(*   L3/L4 再细化 token 过期时序与 bcrypt 细节（阶段 3/4 承担） *)
================
