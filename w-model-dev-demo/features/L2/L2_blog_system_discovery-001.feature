# @req: REQ-013, REQ-017, REQ-020
# @design: docs/phase2-design/blog-system-system-design.md:§3
# @designIds: SD-010,SD-013,SD-015
# @system: L2_blog_system_discovery
# @tla-spec: L2_BlogSystemDiscovery
# @state-machine: SM-L2_BlogSystemDiscovery
# @parent-features: L1/L1_blog_system-002.feature, L1/L1_blog_system-003.feature
# @sibling-features: L2/L2_blog_system_auth-001.feature, L2/L2_blog_system_content-001.feature, L2/L2_blog_system_engagement-001.feature, L2/L2_blog_system_ops-001.feature, L2/L2_blog_system_infra-001.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L2
Feature: 博客系统发现子系统（M-010 搜索服务 / M-013 订阅服务 / M-015 RSS 服务）
  作为博客系统的发现子系统
  我希望完成关键词搜索、博主订阅与 RSS 订阅源生成的状态流转
  以便验证发现域（REQ-013/REQ-017/REQ-020）满足系统设计

Background:
  # @states: none, active
  # @initial-state: none
  # @terminal-states: ()
  # @accepting-states: active
  # @rejecting-states: none
  # @transitions:
  #   none + searchExecute -> none [guard: keywordValid] [action: searchArticles]
  #   none + subscribe -> active [action: createSubscription]
  #   active + receiveArticleUpdate -> active [guard: postPublishedEvent] [action: notifySubscriber]
  #   active + unsubscribe -> none [action: removeSubscription]
  #   active + generateRss -> active [guard: rssSourceAvailable] [action: generateXml]
  # @invariants:
  #   TypeInvariant
  #   searchDone => keywordValid
  #   subscriberUpdated => subscription = active
  #   rssGenerated => rssValid
  Given 系统处于初始状态

@REQ-013 @ST-011 @BDD-L2-020 @high
Scenario: 关键词非空时执行搜索返回命中列表
  Given 系统处于 "none" 状态
  And 关键词命中已发布文章
  When 用户执行文章搜索 (searchExecute)
  Then 系统应保持在 "none" 状态
  And 系统返回分页结果
  And 不变式 "searchDone => keywordValid" 应成立

@REQ-017 @ST-006 @BDD-L2-021 @high
Scenario: 用户订阅博主建立订阅关系
  Given 系统处于 "none" 状态
  And 目标博主存在且未订阅
  When 用户执行博主订阅 (subscribe)
  Then 系统应转移到 "active" 状态
  And 订阅关系建立
  And 不变式 "subscriberUpdated => subscription = active" 应成立

@REQ-017 @ST-006 @BDD-L2-022 @high
Scenario: 订阅者接收博主文章发布更新
  Given 系统处于 "active" 状态
  And 博主发布新文章事件到达
  When 订阅者接收文章更新 (receiveArticleUpdate)
  Then 系统应保持在 "active" 状态
  And 订阅者收到文章更新通知
  And 不变式 "subscriberUpdated => subscription = active" 应成立

@REQ-017 @ST-006 @BDD-L2-023 @medium
Scenario: 用户退订博主解除订阅关系
  Given 系统处于 "active" 状态
  And 订阅关系已建立
  When 用户执行博主退订 (unsubscribe)
  Then 系统应转移到 "none" 状态
  And 订阅关系解除且不再接收更新
  And 不变式 "TypeInvariant" 应成立

@REQ-020 @ST-007 @BDD-L2-024 @high
Scenario: 生成合法可解析的 RSS 订阅源
  Given 系统处于 "active" 状态
  And 存在已发布文章
  When 系统执行 RSS 生成 (generateRss)
  Then 系统应保持在 "active" 状态
  And 系统返回合法可解析的 XML 订阅源
  And 不变式 "rssGenerated => rssValid" 应成立
