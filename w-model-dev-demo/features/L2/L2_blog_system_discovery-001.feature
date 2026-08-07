# @req: REQ-021, REQ-022, REQ-023
# @design: SD-004
# @designIds: SD-004
# @system: L2_blog_system_discovery
# @tla-spec: L2_BlogSystemDiscovery
# @state-machine: SM-L2_BlogSystemDiscovery
# @parent-features: L1_blog_system-002.feature
# @sibling-features: L2_blog_system_auth-001.feature, L2_blog_system_content-001.feature, L2_blog_system_interaction-001.feature, L2_blog_system_analytics-001.feature, L2_blog_system_integration-001.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L2
Feature: 发现推荐子系统统计快照生命周期行为
  作为发现推荐子系统
  我希望完成阅读统计快照的刷新与失效状态流转
  以便热门文章与个性化推荐始终基于最新统计数据（全文搜索独立执行不依赖统计快照）

Background:
  # @states: none, stale, fresh
  # @initial-state: none
  # @terminal-states: stale
  # @accepting-states: fresh
  # @rejecting-states: stale
  # @transitions:
  #   none + refreshStats -> fresh [action: loadStats]
  #   stale + refreshStats -> fresh [action: reloadStats]
  #   fresh + invalidateStats -> stale [action: dropHotList]
  # @invariants:
  #   fresh => hotListState = "computed"
  Given 系统处于初始状态

@REQ-021 @ST-017 @BDD-L2-018 @high
Scenario: 阅读统计刷新为最新后热门列表可计算
  Given 系统处于 "none" 状态
  And 消费方请求热门文章数据
  When 子系统执行统计快照刷新处理 (refreshStats)
  Then 系统应转移到 "fresh" 状态
  And 不变式 "fresh => hotListState = "computed"" 应成立

@REQ-021 @ST-038 @BDD-L2-019 @medium
Scenario: 阅读统计失效后热门列表作废
  Given 系统处于 "fresh" 状态
  And 阅读统计被新访问数据覆盖
  When 子系统执行统计失效处理 (invalidateStats)
  Then 系统应转移到 "stale" 状态

@REQ-021 @ST-004 @BDD-L2-020 @medium
Scenario: 陈旧统计重新刷新恢复最新
  Given 系统处于 "stale" 状态
  And 统计窗口重新聚合完成
  When 子系统执行统计快照刷新处理 (refreshStats)
  Then 系统应转移到 "fresh" 状态

@REQ-021 @ST-017 @BDD-L2-021 @medium
Scenario: 统计快照刷新失效再刷新的完整生命周期
  Given 系统处于 "none" 状态
  When 子系统执行统计快照刷新处理 (refreshStats)
  And 子系统执行统计失效处理 (invalidateStats)
  And 子系统执行统计快照刷新处理 (refreshStats)
  Then 系统应转移到 "fresh" 状态
  And 不变式 "fresh => hotListState = "computed"" 应成立

@REQ-022 @ST-018 @BDD-L2-022 @low
Scenario: 个性化推荐基于最新统计执行不改变快照
  Given 系统处于 "fresh" 状态
  And 读者标签偏好数据可用
  When 子系统执行个性化推荐处理
  Then 系统应保持在 "fresh" 状态
  And 不变式 "fresh => hotListState = "computed"" 应成立
