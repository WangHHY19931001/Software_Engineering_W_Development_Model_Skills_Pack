# @req: REQ-007, REQ-008, REQ-009, REQ-010
# @design: SD-001, SD-007
# @designIds: SD-001, SD-007
# @system: L2_blog_system_auth
# @tla-spec: L2_BlogSystemAuth
# @state-machine: SM-L2_BlogSystemAuth
# @parent-features: L1_blog_system-001.feature
# @sibling-features: L2_blog_system_content-001.feature, L2_blog_system_interaction-001.feature, L2_blog_system_discovery-001.feature, L2_blog_system_analytics-001.feature, L2_blog_system_integration-001.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L2
Feature: 用户身份子系统认证生命周期行为
  作为用户身份子系统
  我希望完成注册、登录签发、令牌过期、重新登录与修改密码会话失效的认证状态流转
  以便为上层业务子系统提供可靠的认证生命周期（JWT 24 小时过期与登录失败限流由基础设施中间件保障）

Background:
  # @states: unauthenticated, authenticated, token_expired
  # @initial-state: unauthenticated
  # @terminal-states: token_expired
  # @accepting-states: authenticated
  # @rejecting-states: token_expired
  # @transitions:
  #   unauthenticated + loginSuccess -> authenticated [guard: credentialsValid] [action: issueJwt]
  #   token_expired + loginSuccess -> authenticated [guard: credentialsValid] [action: issueJwt]
  #   authenticated + tokenExpire -> token_expired [action: invalidateJwt]
  #   token_expired + reLogin -> authenticated [guard: credentialsValid] [action: reissueJwt]
  #   authenticated + changePassword -> unauthenticated [action: invalidateSession]
  # @invariants:
  #   authenticated => registered
  #   token_expired => tokenIssued
  Given 系统处于初始状态

@REQ-007 @REQ-008 @ST-036 @BDD-L2-001 @high
Scenario: 已注册用户凭有效凭据登录成功并签发 JWT
  Given 系统处于 "unauthenticated" 状态
  And 用户已完成注册且凭据有效
  When 子系统执行登录成功处理 (loginSuccess)
  Then 系统应转移到 "authenticated" 状态
  And 不变式 "authenticated => registered" 应成立

@REQ-008 @ST-006 @BDD-L2-002 @high
Scenario: JWT 超过 24 小时有效期后令牌过期
  Given 系统处于 "authenticated" 状态
  And 请求携带的 JWT 已超过二十四小时有效期
  When 子系统执行令牌过期处理 (tokenExpire)
  Then 系统应转移到 "token_expired" 状态
  And 不变式 "token_expired => tokenIssued" 应成立

@REQ-008 @ST-026 @BDD-L2-003 @medium
Scenario: 令牌过期后重新登录恢复认证状态
  Given 系统处于 "token_expired" 状态
  And 用户凭据仍然有效且账户已注册
  When 子系统执行重新登录处理 (reLogin)
  Then 系统应转移到 "authenticated" 状态
  And 不变式 "authenticated => registered" 应成立

@REQ-010 @ST-037 @BDD-L2-004 @medium
Scenario: 修改密码后会话失效需重新登录
  Given 系统处于 "authenticated" 状态
  And 用户校验原密码成功后修改密码
  When 子系统执行修改密码处理 (changePassword)
  Then 系统应转移到 "unauthenticated" 状态

@REQ-007 @REQ-008 @ST-001 @BDD-L2-005 @high
Scenario: 登录签发到令牌过期的完整认证生命周期
  Given 系统处于 "unauthenticated" 状态
  When 子系统执行登录成功处理 (loginSuccess)
  And 子系统执行令牌过期处理 (tokenExpire)
  And 子系统执行重新登录处理 (reLogin)
  Then 系统应转移到 "authenticated" 状态
  And 不变式 "authenticated => registered" 应成立

@REQ-009 @ST-007 @BDD-L2-006 @medium
Scenario: 已登录读者申请成为博主以认证态为前提
  Given 系统处于 "authenticated" 状态
  And 当前用户角色为读者且已登录
  When 子系统处理博主认证申请
  Then 系统应保持在 "authenticated" 状态
  And 不变式 "authenticated => registered" 应成立
