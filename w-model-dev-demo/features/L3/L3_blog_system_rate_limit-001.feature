# @req: REQ-008, NFR-006
# @design: SD-007
# @designIds: SD-007
# @system: L3_blog_system_rate_limit
# @tla-spec: L3_BlogSystemRateLimit
# @state-machine: SM-L3_BlogSystemRateLimit
# @parent-features: L2_blog_system_auth-001.feature
# @sibling-features: L3_blog_system_article_state-001.feature, L3_blog_system_auth_flow-001.feature, L3_blog_system_comment_flow-001.feature, L3_blog_system_rate_limit-001.feature, L3_blog_system_webhook_retry-001.feature, L3_blog_system_reading_dedup-001.feature
# @child-features: L4_blog_system_rate_limit_window-001.feature, L4_blog_system_audit_log-001.feature
# @scenario-id-prefix: BDD-L3
Feature: 限流窗口原子行为（放行/限流/窗口重置）
  作为基础设施模块的限流窗口
  我希望完成窗口 open→limited 的原子状态流转（限额内放行、超限 429、窗口滚动重置恢复）
  以便为认证接口提供与 L3 TLA+ 规格等价的限流行为基线（NFR-006/INTF-001~002）

Background:
  # @states: open, limited
  # @initial-state: open
  # @terminal-states: limited
  # @accepting-states: open
  # @rejecting-states: limited
  # @transitions:
  #   open + rejectRequest -> limited [guard: windowRequests = MaxRequests] [action: return429]
  #   limited + windowReset -> open [action: resetWindow]
  # @invariants:
  #   limited => windowRequests = MaxRequests
  Given 系统处于初始状态

@REQ-008 @NFR-006 @IT-002 @BDD-L3-019 @high
Scenario: 窗口请求数达上限后超限请求被限流
  Given 系统处于 "open" 状态
  And 窗口内已受理请求数达到限流上限
  When 模块执行超限请求拒绝处理 (rejectRequest)
  Then 系统应转移到 "limited" 状态
  And 不变式 "limited => windowRequests = MaxRequests" 应成立

@NFR-006 @IT-002 @BDD-L3-020 @medium
Scenario: 限流窗口滚动重置恢复放行
  Given 系统处于 "limited" 状态
  And 一分钟窗口周期已到
  When 模块执行窗口重置处理 (windowReset)
  Then 系统应转移到 "open" 状态

@NFR-006 @IT-002 @BDD-L3-021 @medium
Scenario: 窗口未满时正常请求放行保持开放
  Given 系统处于 "open" 状态
  And 窗口内请求数未达限流上限
  When 模块执行请求放行处理
  Then 系统应保持在 "open" 状态

@REQ-008 @NFR-006 @IT-002 @BDD-L3-022 @low
Scenario: 达上限限流到窗口重置恢复的完整窗口生命周期
  Given 系统处于 "open" 状态
  When 模块执行超限请求拒绝处理 (rejectRequest)
  And 模块执行窗口重置处理 (windowReset)
  Then 系统应转移到 "open" 状态
