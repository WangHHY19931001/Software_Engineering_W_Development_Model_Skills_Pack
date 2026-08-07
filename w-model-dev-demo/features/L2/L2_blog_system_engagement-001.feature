# @req: REQ-008, REQ-009, REQ-010, REQ-014, REQ-015
# @design: docs/phase2-design/blog-system-system-design.md:§3
# @designIds: SD-005,SD-006,SD-007,SD-011
# @system: L2_blog_system_engagement
# @tla-spec: L2_BlogSystemEngagement
# @state-machine: SM-L2_BlogSystemEngagement
# @parent-features: L1/L1_blog_system-002.feature
# @sibling-features: L2/L2_blog_system_auth-001.feature, L2/L2_blog_system_content-001.feature, L2/L2_blog_system_discovery-001.feature, L2/L2_blog_system_ops-001.feature, L2/L2_blog_system_infra-001.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L2
Feature: 博客系统互动子系统（M-005 浏览与统计服务 / M-006 评论服务 / M-007 评论审核服务 / M-011 推荐服务）
  作为博客系统的互动子系统
  我希望完成浏览计数、评论发表与审核、统计查询与内容推荐的状态流转
  以便验证互动域（REQ-008/REQ-009/REQ-010/REQ-014/REQ-015）满足系统设计

Background:
  # @states: none, pending, approved, rejected
  # @initial-state: none
  # @terminal-states: ()
  # @accepting-states: approved
  # @rejecting-states: none
  # @transitions:
  #   none + submitComment -> pending [guard: commentLenOk] [action: enqueueComment]
  #   pending + approveComment -> approved [action: makePublic]
  #   pending + rejectComment -> rejected [action: hideComment]
  #   pending + recordView -> pending [action: incrementViewCount]
  #   approved + reportStats -> approved [action: reportZeroSemantics]
  #   approved + generateRecommendation -> approved [guard: publishedContent] [action: recommendArticles]
  # @invariants:
  #   TypeInvariant
  #   commentState # none => commentLenOk
  #   statsReported => viewCount >= 0
  #   recommendNoDraft => publishedContent
  Given 系统处于初始状态

@REQ-009 @ST-001 @BDD-L2-014 @high
Scenario: 认证用户发表合法评论进入待审核状态
  Given 系统处于 "none" 状态
  And 文章存在且评论长度合法
  When 用户执行评论发表 (submitComment)
  Then 系统应转移到 "pending" 状态
  And 评论进入待审核队列
  And 不变式 "commentState # none => commentLenOk" 应成立

@REQ-010 @ST-005 @BDD-L2-015 @high
Scenario: 博主审核通过评论使其公开可见
  Given 系统处于 "pending" 状态
  And 待审核评论存在
  When 博主执行评论审核通过 (approveComment)
  Then 系统应转移到 "approved" 状态
  And 评论公开可见
  And 不变式 "TypeInvariant" 应成立

@REQ-010 @ST-005 @BDD-L2-016 @high
Scenario: 博主审核拒绝评论使其隐藏
  Given 系统处于 "pending" 状态
  And 待审核评论存在
  When 博主执行评论审核拒绝 (rejectComment)
  Then 系统应转移到 "rejected" 状态
  And 评论被隐藏
  And 不变式 "TypeInvariant" 应成立

@REQ-008 @ST-012 @BDD-L2-017 @high
Scenario: 访客浏览公开文章且浏览量加一
  Given 系统处于 "pending" 状态
  And 文章已发布
  When 用户执行文章浏览 (recordView)
  Then 系统应保持在 "pending" 状态
  And 浏览量加一且持久化
  And 不变式 "statsReported => viewCount >= 0" 应成立

@REQ-015 @ST-012 @BDD-L2-018 @high
Scenario: 博主查询统计且无数据时返回零
  Given 系统处于 "approved" 状态
  And 文章存在浏览与评论数据
  When 用户执行统计查询 (reportStats)
  Then 系统应保持在 "approved" 状态
  And 统计返回正确数值且无数据返回零
  And 不变式 "statsReported => viewCount >= 0" 应成立

@REQ-014 @ST-011 @BDD-L2-019 @high
Scenario: 存在已发布内容时生成不含草稿的推荐
  Given 系统处于 "approved" 状态
  And 存在已发布文章
  When 系统执行内容推荐 (generateRecommendation)
  Then 系统应保持在 "approved" 状态
  And 推荐结果不超过十条且不含草稿
  And 不变式 "recommendNoDraft => publishedContent" 应成立
