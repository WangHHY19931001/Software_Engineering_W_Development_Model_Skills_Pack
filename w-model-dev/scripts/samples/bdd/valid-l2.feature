# features/L2/L2_blog_system_auth-001.feature (sample)
# @req: REQ-001
# @design: SD-3.2.2
# @system: L2_blog_system_auth
# @tla-spec: L2_blog_system_auth
# @state-machine: SM-L2-blog_system_auth
# @parent-features: L1_blog_system-001
# @sibling-features: (none)
# @child-features: (none)
# @scenario-id-prefix: BDD-L2
Feature: 博客系统认证子系统场景
  作为博客系统用户
  我希望完成登录认证
  以便验证认证子系统满足用户需求

Background:
  # @states: LoggedOut, LoggedIn
  # @initial-state: LoggedOut
  # @terminal-states: LoggedIn
  # @accepting-states: LoggedIn
  # @rejecting-states: LoggedOut
  # @transitions:
  #   LoggedOut + login -> LoggedIn
  # @invariants:
  #   LoggedIn => sessionValid
  Given 系统处于初始状态

@REQ-001 @ST-001 @BDD-L2-001
Scenario: 用户登录认证成功
  Given 系统处于 "LoggedOut" 状态
  When 用户执行 login
  Then 系统应转移到 "LoggedIn" 状态
  And 不变式 "LoggedIn => sessionValid" 应成立
