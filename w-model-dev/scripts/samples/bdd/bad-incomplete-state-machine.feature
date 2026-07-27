# features/L1/L1_blog_system-001.feature (sample - bad-incomplete-state-machine)
# 故意删除 # @rejecting-states: 行，触发 D3 七要素完整性校验失败
# @req: REQ-001
# @design: SD-3.2.1
# @system: L1_blog_system
# @tla-spec: L1_blog_system
# @state-machine: SM-L1-blog_system
# @parent-features: (none)
# @sibling-features: (none)
# @child-features: (none)
# @scenario-id-prefix: BDD-L1
Feature: 博客系统端到端场景
  作为博客系统用户
  我希望完成登录
  以便验证系统满足用户需求

Background:
  # @states: Unauthenticated, Authenticated
  # @initial-state: Unauthenticated
  # @terminal-states: Authenticated
  # @accepting-states: Authenticated
  # @transitions:
  #   Unauthenticated + login -> Authenticated
  # @invariants:
  #   Authenticated => sessionValid
  Given 系统处于初始状态

@REQ-001 @UAT-001 @BDD-L1-001
Scenario: 用户登录成功
  Given 系统处于 "Unauthenticated" 状态
  When 用户执行 login
  Then 系统应转移到 "Authenticated" 状态
  And 不变式 "Authenticated => sessionValid" 应成立
