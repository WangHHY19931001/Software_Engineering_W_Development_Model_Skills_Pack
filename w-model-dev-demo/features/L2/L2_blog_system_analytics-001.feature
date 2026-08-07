# @req: REQ-024, REQ-025, REQ-026
# @design: SD-005
# @designIds: SD-005
# @system: L2_blog_system_analytics
# @tla-spec: L2_BlogSystemAnalytics
# @state-machine: SM-L2_BlogSystemAnalytics
# @parent-features: L1_blog_system-003.feature
# @sibling-features: L2_blog_system_auth-001.feature, L2_blog_system_content-001.feature, L2_blog_system_interaction-001.feature, L2_blog_system_discovery-001.feature, L2_blog_system_integration-001.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L2
Feature: 统计通知子系统通知事件生命周期行为
  作为统计通知子系统
  我希望完成评论、点赞、关注发文三类互动事件产生通知的流转
  以便为用户提供及时的通知能力（阅读统计与统计面板不产生通知事件）

Background:
  # @states: none, comment, like, follow_publish
  # @initial-state: none
  # @terminal-states: comment, like, follow_publish
  # @accepting-states: comment, like, follow_publish
  # @rejecting-states: ()
  # @transitions:
  #   none + generateCommentEvent -> comment [action: createUnreadNotification]
  #   none + generateLikeEvent -> like [action: createUnreadNotification]
  #   none + generateFollowPublishEvent -> follow_publish [action: createUnreadNotification]
  # @invariants:
  #   comment => notificationProduced
  #   like => notificationProduced
  #   follow_publish => notificationProduced
  Given 系统处于初始状态

@REQ-026 @ST-002 @BDD-L2-023 @high
Scenario: 评论事件产生评论通知
  Given 系统处于 "none" 状态
  And 读者对文章发表评论
  When 子系统执行评论通知生成处理 (generateCommentEvent)
  Then 系统应转移到 "comment" 状态
  And 不变式 "comment => notificationProduced" 应成立

@REQ-026 @ST-003 @BDD-L2-024 @medium
Scenario: 点赞事件产生点赞通知
  Given 系统处于 "none" 状态
  And 读者点赞文章
  When 子系统执行点赞通知生成处理 (generateLikeEvent)
  Then 系统应转移到 "like" 状态
  And 不变式 "like => notificationProduced" 应成立

@REQ-026 @ST-022 @BDD-L2-025 @medium
Scenario: 关注博主发文事件产生通知
  Given 系统处于 "none" 状态
  And 关注的博主发布新文章
  When 子系统执行关注发文通知生成处理 (generateFollowPublishEvent)
  Then 系统应转移到 "follow_publish" 状态
  And 不变式 "follow_publish => notificationProduced" 应成立

@REQ-024 @ST-020 @BDD-L2-026 @medium
Scenario: 阅读统计记录不产生通知事件
  Given 系统处于 "none" 状态
  And 读者访问文章详情触发阅读计数
  When 子系统执行阅读计数处理
  Then 系统应保持在 "none" 状态

@REQ-025 @ST-021 @BDD-L2-027 @low
Scenario: 统计面板刷新不影响通知事件状态
  Given 系统处于 "none" 状态
  And 博主请求统计面板数据
  When 子系统执行统计面板刷新处理
  Then 系统应保持在 "none" 状态
