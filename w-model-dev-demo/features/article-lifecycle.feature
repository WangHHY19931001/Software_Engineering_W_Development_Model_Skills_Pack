# @req: REQ-001,REQ-002,REQ-003
# @system: L2_auth_service
# @tla-spec: L2-AuthService
# @state-machine: SM-L2-auth_service
# @parent-features: ../../features/authentication.feature
# @sibling-features: (none)
# @child-features: ../../features/article-lifecycle.feature
# @scenario-id-prefix: BDD-L2
# 所属系统: blog-system-demo
# 关联需求: docs/phase1-requirements/requirement-spec.md (REQ-001, REQ-002, REQ-003)
# 层级: L2 (认证子系统)
# 上级 BDD: features/authentication.feature
# 同级 BDD: 无
# 下级 BDD: features/article-lifecycle.feature
# RTM 映射: requirementId=REQ-001, REQ-002, REQ-003
# TLA+ 等价: tla/specs/level2/L2-AuthService.tla
Feature: 认证子系统 L2 行为
  作为认证服务
  我希望完成注册/登录/登出/失败计数/锁定
  以便为上层提供安全会话

Background:
  # @states: UNAUTHENTICATED, AUTHENTICATED, AUTH_FAILED, LOCKED
  # @initial-state: UNAUTHENTICATED
  # @terminal-states: (none)
  # @accepting-states: AUTHENTICATED
  # @rejecting-states: AUTH_FAILED, LOCKED
  # @transitions:
  #   UNAUTHENTICATED + RegisterUser -> UNAUTHENTICATED [action: addUser]
  #   UNAUTHENTICATED + Login -> AUTHENTICATED [guard: userExists ∧ pwOK] [action: issueSession]
  #   UNAUTHENTICATED + LoginFail -> AUTH_FAILED [action: incrementFailCount]
  #   AUTH_FAILED + Login -> AUTHENTICATED [guard: failCount<5 ∧ userExists] [action: issueSession]
  #   AUTH_FAILED + LoginFail -> LOCKED [guard: failCount==5] [action: lockAccount]
  #   AUTH_FAILED + Reset -> UNAUTHENTICATED [action: clearFailCount]
  #   LOCKED + Unlock -> UNAUTHENTICATED [action: clearFailCount]
  #   AUTHENTICATED + Logout -> UNAUTHENTICATED [action: revokeSession]
  # @invariants:
  #   TypeInvariant: authState ∈ AuthStates
  #   AuthInvariant: authState = AUTHENTICATED => currentUser ∈ users ∧ currentUser ≠ ""
  #   SessionInvariant: authState = AUTHENTICATED => sessions ≠ {}
  #   LockInvariant: authState = LOCKED => failCount = 5
  Given 认证服务已实例化
  And users 集合初始为空

@REQ-001 @UAT-004 @BDD-L2-001 @high
Scenario: UNAUTHENTICATED 状态注册新用户
  Given 认证服务处于 "UNAUTHENTICATED" 状态
  And users 集合为空
  When 外部发起注册 RegisterUser("u1")
  Then 认证服务应保持在 "UNAUTHENTICATED" 状态
  And users 应包含 "u1"
  And 不变式 "TypeInvariant: authState ∈ AuthStates" 应成立

@REQ-001 @UAT-005 @BDD-L2-002 @high
Scenario: UNAUTHENTICATED 状态登录成功
  Given 认证服务处于 "UNAUTHENTICATED" 状态
  And users 包含 "u1"
  When 外部发起登录 Login("u1","t1")
  Then 认证服务应转移到 "AUTHENTICATED" 状态
  And currentUser 应等于 "u1"
  And sessions 应包含 "t1"
  And failCount 应等于 0
  And 不变式 "AuthInvariant: authState = AUTHENTICATED => currentUser ∈ users" 应成立
  And 不变式 "SessionInvariant: authState = AUTHENTICATED => sessions ≠ {}" 应成立

@REQ-002 @UAT-006 @BDD-L2-003 @high
Scenario: UNAUTHENTICATED 状态登录失败累加计数
  Given 认证服务处于 "UNAUTHENTICATED" 状态
  And users 包含 "u1"
  When 外部发起登录失败 LoginFail
  Then 认证服务应转移到 "AUTH_FAILED" 状态
  And failCount 应等于 1
  And 不变式 "TypeInvariant: authState ∈ AuthStates" 应成立

@REQ-002 @UAT-006 @BDD-L2-004 @high
Scenario: AUTH_FAILED 状态连续 5 次失败触发锁定
  Given 认证服务处于 "AUTH_FAILED" 状态
  And failCount 等于 4
  When 外部发起登录失败 LoginFail
  Then 认证服务应转移到 "LOCKED" 状态
  And failCount 应等于 5
  And 不变式 "LockInvariant: authState = LOCKED => failCount = 5" 应成立

@REQ-002 @UAT-007 @BDD-L2-005 @high
Scenario: LOCKED 状态管理员解锁
  Given 认证服务处于 "LOCKED" 状态
  And failCount 等于 5
  When 管理员执行 Unlock
  Then 认证服务应转移到 "UNAUTHENTICATED" 状态
  And failCount 应等于 0
  And 不变式 "TypeInvariant: authState ∈ AuthStates" 应成立

@REQ-003 @UAT-008 @BDD-L2-006 @high
Scenario: AUTHENTICATED 状态登出
  Given 认证服务处于 "AUTHENTICATED" 状态
  And currentUser 等于 "u1"
  And sessions 包含 "t1"
  When 外部发起登出 Logout("t1")
  Then 认证服务应转移到 "UNAUTHENTICATED" 状态
  And sessions 应不包含 "t1"
  And currentUser 应等于 ""
  And 不变式 "AuthInvariant: authState = AUTHENTICATED => currentUser ∈ users" 应成立

@REQ-002 @UAT-009 @BDD-L2-007 @medium
Scenario: AUTH_FAILED 状态重置失败计数
  Given 认证服务处于 "AUTH_FAILED" 状态
  And failCount 等于 3
  When 外部发起重置 Reset
  Then 认证服务应转移到 "UNAUTHENTICATED" 状态
  And failCount 应等于 0
  And 不变式 "TypeInvariant: authState ∈ AuthStates" 应成立
