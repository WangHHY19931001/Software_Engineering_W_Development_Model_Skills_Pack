(* @system        blog-system-demo
   @requirement   REQ-001,REQ-002,REQ-003,NFR-003,CON-003
   @design        docs/phase4-design/detailed-design.md#DD-001
   @parent        tla/specs/level1/L1-BlogSystem.tla
   @sibling       null
   @child         tla/specs/level3/L3-ArticleStateMachine.tla
   @level         L2
   @phase         4

   所属系统: blog-system-demo
   关联设计: docs/phase4-design/detailed-design.md#DD-001
   层级: L2 (认证子系统)
   上级 TLA: tla/specs/level1/L1-BlogSystem.tla
   同级 TLA: 无
   下级 TLA: tla/specs/level3/L3-ArticleStateMachine.tla
   状态机七要素:
     - initial    : UNAUTHENTICATED
     - terminal   : (none, 永远可登录)
     - accepting  : AUTHENTICATED
     - rejecting  : AUTH_FAILED / LOCKED
     - transitions: 8
     - actions    : 8
     - invariants : 4
   公平性: WF_vars(\E u \in Users, t \in Tokens : Login(u, t))

   状态变量含义:
     authState     ∈ AuthStates                         认证状态机
     users         ⊆ Users                              已注册用户集合
     sessions      ⊆ Tokens                             活跃会话集合
     currentUser   ∈ Users ∪ {""}                       当前认证用户（未认证时为 ""）
     failCount     ∈ 0..MaxFailures                     连续失败计数
     registeredAt  ∈ [Users -> Nat]                     用户注册时间戳

   失败锁定策略:
     - 连续失败 MaxFailures 次（默认 3）后，authState 转入 LOCKED
     - LOCKED 须管理员调用 Unlock 才能恢复
     - 任何成功登录会重置 failCount 为 0
*)
---- MODULE L2AuthService ----

(***********************************************************************
  L2 认证子系统规格

  刻画 AuthService 的状态机：注册/登录/登出/失败计数/锁定/解锁。
  关联 SD-001（DD-001.1~DD-001.5）。

  关联 DD:
    - DD-001.1 User（实体）
    - DD-001.2 AuthService
    - DD-001.3 TokenManager
    - DD-001.4 BcryptUtil
    - DD-001.5 LoginAttempt

  关联 BDD: features/article-lifecycle.feature
  关联 RTM: requirementId=REQ-001, REQ-002, REQ-003
***********************************************************************)

EXTENDS Naturals, FiniteSets

CONSTANTS Users, Tokens, MaxFailures

ASSUME /\ Users # {}
       /\ Tokens # {}
       /\ MaxFailures \in Nat /\ MaxFailures >= 1

VARIABLES authState, users, sessions, currentUser, failCount, registeredAt

AuthStates == {"UNAUTHENTICATED", "AUTHENTICATED", "AUTH_FAILED", "LOCKED"}

vars == <<authState, users, sessions, currentUser, failCount, registeredAt>>

\* =====================================================================
\* 类型约束
\* =====================================================================
TypeOK ==
  /\ authState \in AuthStates
  /\ users \subseteq Users
  /\ sessions \subseteq Tokens
  /\ currentUser \in Users \union {""}
  /\ failCount \in 0..MaxFailures
  /\ registeredAt \in [Users -> Nat]

\* =====================================================================
\* 初始状态
\* =====================================================================
Init ==
  /\ authState = "UNAUTHENTICATED"
  /\ users = {}
  /\ sessions = {}
  /\ currentUser = ""
  /\ failCount = 0
  /\ registeredAt = [u \in Users |-> 0]

\* =====================================================================
\* 转移 1: 注册新用户
\* 触发: 外部 RegisterUser 事件
\* 守卫: u 是合法用户；u 未注册
\* 动作: u 并入 users；注册时间标记为 1
\* =====================================================================
RegisterUser(u) ==
  /\ u \in Users
  /\ u \notin users
  /\ users' = users \cup {u}
  /\ registeredAt' = [registeredAt EXCEPT ![u] = 1]
  /\ UNCHANGED <<authState, sessions, currentUser, failCount>>

\* =====================================================================
\* 转移 2: 登录成功
\* 触发: 外部 Login(u, t) 事件，t 是 JWT
\* 守卫: u 已注册；t 是合法 token；未锁定（failCount < MaxFailures）
\* 动作: 创建 session，authState 转入 AUTHENTICATED，重置 failCount
\* =====================================================================
Login(u, t) ==
  /\ authState \in {"UNAUTHENTICATED", "AUTH_FAILED"}
  /\ u \in users
  /\ t \in Tokens
  /\ failCount < MaxFailures
  /\ sessions' = sessions \cup {t}
  /\ currentUser' = u
  /\ authState' = "AUTHENTICATED"
  /\ failCount' = 0
  /\ UNCHANGED <<users, registeredAt>>

\* =====================================================================
\* 转移 3: 登录失败
\* 触发: 外部 LoginFail 事件
\* 守卫: 未锁定
\* 动作: failCount 累加；达 MaxFailures 时转入 LOCKED
\* =====================================================================
LoginFail ==
  /\ authState \in {"UNAUTHENTICATED", "AUTH_FAILED"}
  /\ failCount < MaxFailures
  /\ failCount' = failCount + 1
  /\ IF failCount' = MaxFailures
       THEN authState' = "LOCKED"
       ELSE authState' = "AUTH_FAILED"
  /\ UNCHANGED <<users, sessions, currentUser, registeredAt>>

\* =====================================================================
\* 转移 4: 登出
\* 触发: 外部 Logout(t) 事件
\* 守卫: t 是当前活跃 session
\* 动作: 移除 session，清空 currentUser
\* =====================================================================
Logout(t) ==
  /\ authState = "AUTHENTICATED"
  /\ t \in sessions
  /\ sessions' = sessions \ {t}
  /\ currentUser' = ""
  /\ authState' = "UNAUTHENTICATED"
  /\ UNCHANGED <<users, failCount, registeredAt>>

\* =====================================================================
\* 转移 5: 失败计数重置
\* 触发: 外部 Reset 事件（用户重置密码 / 验证码校验）
\* 守卫: 当前为 AUTH_FAILED 状态
\* 动作: authState 转 UNAUTHENTICATED，failCount 清零
\* =====================================================================
Reset ==
  /\ authState = "AUTH_FAILED"
  /\ authState' = "UNAUTHENTICATED"
  /\ failCount' = 0
  /\ UNCHANGED <<users, sessions, currentUser, registeredAt>>

\* =====================================================================
\* 转移 6: 解锁账户
\* 触发: 管理员 Unlock 事件
\* 守卫: 当前为 LOCKED 状态
\* 动作: authState 转 UNAUTHENTICATED，failCount 清零
\* =====================================================================
Unlock ==
  /\ authState = "LOCKED"
  /\ authState' = "UNAUTHENTICATED"
  /\ failCount' = 0
  /\ UNCHANGED <<users, sessions, currentUser, registeredAt>>

\* =====================================================================
\* 下一状态动作
\* =====================================================================
Next ==
  \/ \E u \in Users : RegisterUser(u)
  \/ \E u \in Users, t \in Tokens : Login(u, t)
  \/ LoginFail
  \/ \E t \in Tokens : Logout(t)
  \/ Reset
  \/ Unlock

Spec == Init /\ [][Next]_vars /\ WF_vars(\E u \in Users, t \in Tokens : Login(u, t))

\* =====================================================================
\* 不变式
\* =====================================================================
AuthInvariant == authState = "AUTHENTICATED" => currentUser \in users /\ currentUser # ""
SessionInvariant == authState = "AUTHENTICATED" => sessions # {}
LockInvariant == authState = "LOCKED" => failCount = MaxFailures
UserExistsInvariant == \A u \in users : registeredAt[u] >= 1

Invariants ==
  /\ TypeOK
  /\ AuthInvariant
  /\ SessionInvariant
  /\ LockInvariant
  /\ UserExistsInvariant
====
