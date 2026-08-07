# @req: REQ-001, REQ-002, REQ-003, NFR-002
# @design: docs/phase2-design/blog-system-system-design.md:§3
# @designIds: SD-001,SD-002,SD-017
# @system: L2_blog_system_auth
# @tla-spec: L2_BlogSystemAuth
# @state-machine: SM-L2_BlogSystemAuth
# @parent-features: L1/L1_blog_system-001.feature
# @sibling-features: L2/L2_blog_system_content-001.feature, L2/L2_blog_system_engagement-001.feature, L2/L2_blog_system_discovery-001.feature, L2/L2_blog_system_ops-001.feature, L2/L2_blog_system_infra-001.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L2
Feature: 博客系统认证子系统（M-001 认证服务 / M-002 用户资料服务 / M-017 认证授权中间件）
  作为博客系统的认证子系统
  我希望完成注册、登录换发 JWT、令牌失效、登出与资料维护的状态流转
  以便验证认证与授权域（REQ-001/REQ-002/REQ-003/NFR-002）满足系统设计

Background:
  # @states: none, registered, loggedIn
  # @initial-state: none
  # @terminal-states: ()
  # @accepting-states: registered, loggedIn
  # @rejecting-states: none
  # @transitions:
  #   none + register -> registered [guard: validCredentials] [action: hashPassword]
  #   registered + loginSuccess -> loggedIn [guard: correctCredentials] [action: issueJwt]
  #   loggedIn + tokenExpire -> loggedIn [guard: tokenInvalidOrExpired] [action: revokeToken]
  #   loggedIn + logout -> registered [action: revokeSession]
  #   loggedIn + profileManage -> loggedIn [guard: tokenValid] [action: updateProfile]
  # @invariants:
  #   TypeInvariant
  #   authState # none => pwdHashed
  #   tokenValid => authState = loggedIn
  #   accessGranted => tokenValid
  #   profileActive => authState # none
  Given 系统处于初始状态

@REQ-001 @ST-001 @BDD-L2-001 @high
Scenario: 访客合法注册后认证状态进入已注册且密码哈希存储
  Given 系统处于 "none" 状态
  And 用户提供合法邮箱与不小于六位密码
  When 用户执行注册 (register)
  Then 系统应转移到 "registered" 状态
  And 密码以 bcrypt 哈希存储
  And 不变式 "authState # none => pwdHashed" 应成立

@REQ-003 @ST-001 @BDD-L2-002 @high
Scenario: 已注册用户凭正确凭据登录换发 JWT 令牌
  Given 系统处于 "registered" 状态
  And 用户提供正确密码
  When 用户执行登录 (loginSuccess)
  Then 系统应转移到 "loggedIn" 状态
  And 系统签发有效 JWT 令牌
  And 不变式 "tokenValid => authState = loggedIn" 应成立

@REQ-003 @ST-001 @BDD-L2-003 @high
Scenario: 已登录用户退出登录会话并作废令牌
  Given 系统处于 "loggedIn" 状态
  And 会话携带有效令牌
  When 用户执行登出 (logout)
  Then 系统应转移到 "registered" 状态
  And 令牌与授权上下文被作废
  And 不变式 "tokenValid => authState = loggedIn" 应成立

@REQ-003 @ST-003 @BDD-L2-004 @high
Scenario: 无效过期令牌使会话失效并撤销授权上下文
  Given 系统处于 "loggedIn" 状态
  And 令牌过期或伪造
  When 系统执行令牌失效 (tokenExpire)
  Then 系统应保持在 "loggedIn" 状态
  And 令牌失效且授权上下文被清除
  And 不变式 "accessGranted => tokenValid" 应成立

@REQ-002 @ST-004 @BDD-L2-005 @high
Scenario: 持有有效令牌的登录用户维护个人资料
  Given 系统处于 "loggedIn" 状态
  And 用户携带有效令牌
  When 用户执行资料维护 (profileManage)
  Then 系统应保持在 "loggedIn" 状态
  And 资料字段更新生效且持久化
  And 不变式 "profileActive => authState # none" 应成立
