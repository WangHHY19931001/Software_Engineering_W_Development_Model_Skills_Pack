# @req: REQ-008, NFR-006
# @design: SD-007
# @designIds: SD-007
# @system: L4_blog_system_rate_limit_window
# @tla-spec: L4_BlogSystemRateLimitWindow
# @state-machine: SM-L4_BlogSystemRateLimitWindow
# @parent-features: L3_blog_system_rate_limit-001.feature
# @sibling-features: L4_blog_system_article_store-001.feature, L4_blog_system_audit_log-001.feature, L4_blog_system_rate_limit_window-001.feature, L4_blog_system_token_store-001.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L4
Feature: 限流滑动窗口原子方法行为（放行/超限拒绝/窗口滚动）
  作为基础设施模块的限流中间件（DD-042 rateLimitMiddleware）
  我希望完成滑动窗口 open→limited 的原子方法流转（限额内放行、计数达上限 429 拒绝、窗口滚动恢复放行）
  以便为认证与通用接口提供与 L4 TLA+ 规格等价的限流窗口基线（NFR-006/REQ-008）

Background:
  # @states: open, limited
  # @initial-state: open
  # @terminal-states: limited
  # @accepting-states: open
  # @rejecting-states: limited
  # @transitions:
  #   open + allowRequest -> open [guard: requestCount < MaxRequests] [action: incrementCount]
  #   open + rejectRequest -> limited [guard: requestCount = MaxRequests] [action: return429]
  #   limited + clockTick -> open [guard: windowExpired] [action: resetWindow]
  # @invariants:
  #   limited => requestCount = MaxRequests
  #   limited => windowStart + WindowMs > now
  Given 系统处于初始状态

@NFR-006 @UT-042 @BDD-L4-001 @high
Scenario: 窗口内请求未超限正常放行
  Given 系统处于 "open" 状态
  And 窗口内请求计数未达限流上限
  When 模块执行请求放行计数处理 (allowRequest)
  Then 系统应保持在 "open" 状态

@NFR-006 @UT-042 @BDD-L4-002 @high
Scenario: 窗口内计数达上限后超限请求被拒绝
  Given 系统处于 "open" 状态
  And 窗口内已受理请求数达到限流上限
  When 模块执行超限请求拒绝处理 (rejectRequest)
  Then 系统应转移到 "limited" 状态
  And 不变式 "limited => requestCount = MaxRequests" 应成立

@NFR-006 @UT-042 @BDD-L4-003 @medium
Scenario: 窗口到期滚动后恢复放行
  Given 系统处于 "limited" 状态
  And 滑动窗口周期已到
  When 模块执行窗口滚动处理 (clockTick)
  Then 系统应转移到 "open" 状态

@REQ-008 @NFR-006 @UT-042 @BDD-L4-004 @low
Scenario: 达上限限流到窗口滚动恢复的完整窗口生命周期
  Given 系统处于 "open" 状态
  When 模块执行超限请求拒绝处理 (rejectRequest)
  And 模块执行窗口滚动处理 (clockTick)
  Then 系统应转移到 "open" 状态
