# @req: REQ-008, REQ-009, CON-003, NFR-002
# @design: SD-001, SD-007
# @designIds: SD-001, SD-007
# @system: L4_blog_system_token_store
# @tla-spec: L4_BlogSystemTokenStore
# @state-machine: SM-L4_BlogSystemTokenStore
# @parent-features: L3_blog_system_auth_flow-001.feature
# @sibling-features: L4_blog_system_article_store-001.feature, L4_blog_system_audit_log-001.feature, L4_blog_system_rate_limit_window-001.feature, L4_blog_system_token_store-001.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L4
Feature: 令牌存储原子方法行为（签发/过期/重签/验签）
  作为用户身份模块的令牌存储（DD-046 jwtUtil + DD-002 issueToken）
  我希望完成令牌 none→active→expired 的原子方法流转（签发、24 小时过期、过期重签、验签放行与拒绝）
  以便为认证接口提供与 L4 TLA+ 规格等价的令牌生命周期基线（REQ-008/CON-003/NFR-002）

Background:
  # @states: none, active, expired
  # @initial-state: none
  # @terminal-states: expired
  # @accepting-states: active
  # @rejecting-states: expired
  # @transitions:
  #   none + issueToken -> active [guard: userRegistered] [action: signJwt]
  #   expired + issueToken -> active [guard: userRegistered] [action: signJwt]
  #   active + tokenExpire -> expired [action: invalidateJwt]
  #   expired + reIssueToken -> active [action: reissueJwt]
  #   active + verifyValidToken -> active [guard: tokenAge < MaxAgeHours] [action: returnPayload]
  #   none + verifyInvalidToken -> none [action: return40101]
  #   expired + verifyExpiredToken -> expired [action: return40102]
  # @invariants:
  #   active => userRegistered
  #   expired => tokenAge = MaxAgeHours
  Given 系统处于初始状态

@REQ-008 @REQ-009 @UT-046 @UT-051 @BDD-L4-001 @high
Scenario: 已注册用户调用签发令牌进入有效态
  Given 系统处于 "none" 状态
  And 用户已注册且登录凭据有效
  When 模块执行令牌签发处理 (issueToken)
  Then 系统应转移到 "active" 状态
  And 不变式 "active => userRegistered" 应成立

@REQ-008 @CON-003 @UT-046 @BDD-L4-002 @high
Scenario: 令牌年龄达到二十四小时上限触发过期
  Given 系统处于 "active" 状态
  And 令牌年龄已达有效期上限二十四小时
  When 模块执行令牌过期处理 (tokenExpire)
  Then 系统应转移到 "expired" 状态
  And 不变式 "expired => tokenAge = MaxAgeHours" 应成立

@REQ-008 @UT-051 @BDD-L4-003 @medium
Scenario: 过期令牌重签新令牌恢复有效态
  Given 系统处于 "expired" 状态
  And 用户凭据有效且账户仍注册
  When 模块执行重新签发处理 (reIssueToken)
  Then 系统应转移到 "active" 状态

@REQ-008 @NFR-002 @UT-046 @BDD-L4-004 @high
Scenario: 有效令牌验签通过返回载荷
  Given 系统处于 "active" 状态
  And 令牌未过期且签名合法
  When 模块执行令牌验签处理 (verifyValidToken)
  Then 系统应保持在 "active" 状态

@REQ-008 @NFR-002 @UT-041 @UT-056 @BDD-L4-005 @high
Scenario: 缺失或伪造令牌验签拒绝并返回未授权
  Given 系统处于 "none" 状态
  And 请求未携带令牌或令牌签名被篡改
  When 模块执行无效令牌验签处理 (verifyInvalidToken)
  Then 系统应保持在 "none" 状态

@REQ-008 @CON-003 @NFR-002 @UT-041 @BDD-L4-006 @medium
Scenario: 过期令牌验签拒绝并返回令牌过期错误
  Given 系统处于 "expired" 状态
  And 令牌已过有效期
  When 模块执行过期令牌验签处理 (verifyExpiredToken)
  Then 系统应保持在 "expired" 状态

@REQ-008 @CON-003 @UT-046 @BDD-L4-007 @low
Scenario: 签发过期重签的完整令牌生命周期
  Given 系统处于 "none" 状态
  When 模块执行令牌签发处理 (issueToken)
  And 模块执行令牌过期处理 (tokenExpire)
  And 模块执行重新签发处理 (reIssueToken)
  Then 系统应转移到 "active" 状态
