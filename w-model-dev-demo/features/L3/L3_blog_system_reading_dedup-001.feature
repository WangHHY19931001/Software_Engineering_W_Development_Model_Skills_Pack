# @req: REQ-024
# @design: SD-005
# @designIds: SD-005
# @system: L3_blog_system_reading_dedup
# @tla-spec: L3_BlogSystemReadingDedup
# @state-machine: SM-L3_BlogSystemReadingDedup
# @parent-features: L2_blog_system_analytics-001.feature
# @sibling-features: L3_blog_system_article_state-001.feature, L3_blog_system_auth_flow-001.feature, L3_blog_system_comment_flow-001.feature, L3_blog_system_rate_limit-001.feature, L3_blog_system_webhook_retry-001.feature, L3_blog_system_reading_dedup-001.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L3
Feature: 阅读去重窗口原子行为（首次计数/重复访问/窗口推进/窗口到期）
  作为统计通知模块的阅读去重器
  我希望完成去重窗口 unseen→windowed 的原子状态流转（首次访问加一、窗口内重复访问去重、五分钟窗口到期滚动）
  以便阅读量与 L3 TLA+ 规格等价地按同 IP 短窗口去重累计（REQ-024/INTF-018）

Background:
  # @states: unseen, windowed
  # @initial-state: unseen
  # @terminal-states: ()
  # @accepting-states: windowed
  # @rejecting-states: ()
  # @transitions:
  #   unseen + viewArticle -> windowed [guard: viewCount < capacity] [action: incrementView]
  #   windowed + repeatView -> windowed [guard: sameWindow] [action: skipCount]
  #   windowed + tickWindow -> windowed [action: advanceAge]
  #   windowed + expireWindow -> unseen [action: resetWindow]
  # @invariants:
  #   windowed => viewCount >= 1
  Given 系统处于初始状态

@REQ-024 @IT-012 @BDD-L3-029 @high
Scenario: 首次访问详情阅读量加一进入去重窗口
  Given 系统处于 "unseen" 状态
  And 该 clientIp 与文章在去重窗口内无访问记录
  When 模块执行首次阅读计数处理 (viewArticle)
  Then 系统应转移到 "windowed" 状态
  And 不变式 "windowed => viewCount >= 1" 应成立

@REQ-024 @IT-012 @BDD-L3-030 @high
Scenario: 窗口内重复访问不重复计数
  Given 系统处于 "windowed" 状态
  And 同一 clientIp 与文章在五分钟窗口内再次访问
  When 模块执行重复访问去重处理 (repeatView)
  Then 系统应保持在 "windowed" 状态
  And 不变式 "windowed => viewCount >= 1" 应成立

@REQ-024 @IT-012 @BDD-L3-031 @low
Scenario: 窗口时间推进未到期保持去重窗口
  Given 系统处于 "windowed" 状态
  And 去重窗口尚未到达五分钟时长
  When 模块执行窗口时间推进处理 (tickWindow)
  Then 系统应保持在 "windowed" 状态

@REQ-024 @IT-012 @BDD-L3-032 @medium
Scenario: 窗口到期滚动后恢复未去重态
  Given 系统处于 "windowed" 状态
  And 去重窗口到达五分钟时长
  When 模块执行窗口到期处理 (expireWindow)
  Then 系统应转移到 "unseen" 状态

@REQ-024 @IT-012 @BDD-L3-033 @medium
Scenario: 首次计数窗口过期后再访问再次计数的完整窗口生命周期
  Given 系统处于 "unseen" 状态
  When 模块执行首次阅读计数处理 (viewArticle)
  And 模块执行重复访问去重处理 (repeatView)
  And 模块执行窗口到期处理 (expireWindow)
  And 模块执行首次阅读计数处理 (viewArticle)
  Then 系统应转移到 "windowed" 状态
  And 不变式 "windowed => viewCount >= 1" 应成立
