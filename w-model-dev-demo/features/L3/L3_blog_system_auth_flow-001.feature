# @req: REQ-007, REQ-008, REQ-009
# @design: SD-001
# @designIds: SD-001
# @system: L3_blog_system_auth_flow
# @tla-spec: L3_BlogSystemAuthFlow
# @state-machine: SM-L3_BlogSystemAuthFlow
# @parent-features: L2_blog_system_auth-001.feature
# @sibling-features: L3_blog_system_article_state-001.feature, L3_blog_system_auth_flow-001.feature, L3_blog_system_comment_flow-001.feature, L3_blog_system_rate_limit-001.feature, L3_blog_system_webhook_retry-001.feature, L3_blog_system_reading_dedup-001.feature
# @child-features: L4_blog_system_token_store-001.feature
# @scenario-id-prefix: BDD-L3
Feature: 认证流 JWT 令牌生命周期原子行为（签发/过期/重新登录/申请博主）
  作为用户身份模块的认证流
  我希望完成令牌 none→active→expired 的原子状态流转（登录签发、24 小时过期、过期重登、申请博主不改令牌态）
  以便为受保护接口提供与 L3 TLA+ 规格等价的令牌生命周期基线（INTF-001~003）

Background:
  # @states: none, active, expired
  # @initial-state: none
  # @terminal-states: expired
  # @accepting-states: active
  # @rejecting-states: expired
  # @transitions:
  #   none + loginSuccess -> active [guard: credentialsValid] [action: issueJwt]
  #   expired + loginSuccess -> active [guard: credentialsValid] [action: issueJwt]
  #   active + tokenExpire -> expired [action: invalidateJwt]
  #   expired + reLogin -> active [guard: credentialsValid] [action: reissueJwt]
  # @invariants:
  #   active => registered
  #   expired => registered
  Given 系统处于初始状态

@REQ-007 @REQ-008 @IT-001 @BDD-L3-008 @high
Scenario: 已注册用户凭有效凭据登录签发 JWT
  Given 系统处于 "none" 状态
  And 用户已注册且凭据有效
  When 模块执行登录成功处理 (loginSuccess)
  Then 系统应转移到 "active" 状态
  And 不变式 "active => registered" 应成立

@REQ-008 @IT-028 @BDD-L3-009 @high
Scenario: JWT 超过 24 小时有效期后令牌过期
  Given 系统处于 "active" 状态
  And 请求携带的 JWT 已超过二十四小时有效期
  When 模块执行令牌过期处理 (tokenExpire)
  Then 系统应转移到 "expired" 状态

@REQ-008 @IT-028 @BDD-L3-010 @medium
Scenario: 令牌过期后重新登录恢复认证态
  Given 系统处于 "expired" 状态
  And 用户凭据仍然有效且账户已注册
  When 模块执行重新登录处理 (reLogin)
  Then 系统应转移到 "active" 状态
  And 不变式 "active => registered" 应成立

@REQ-007 @REQ-008 @IT-001 @IT-028 @BDD-L3-011 @medium
Scenario: 注册登录签发到令牌过期的完整认证生命周期
  Given 系统处于 "none" 状态
  When 模块执行登录成功处理 (loginSuccess)
  And 模块执行令牌过期处理 (tokenExpire)
  And 模块执行重新登录处理 (reLogin)
  Then 系统应转移到 "active" 状态

@REQ-009 @IT-001 @BDD-L3-012 @medium
Scenario: 已登录读者申请成为博主以认证态为前提
  Given 系统处于 "active" 状态
  And 当前用户角色为读者且已登录
  When 模块处理博主认证申请
  Then 系统应保持在 "active" 状态
