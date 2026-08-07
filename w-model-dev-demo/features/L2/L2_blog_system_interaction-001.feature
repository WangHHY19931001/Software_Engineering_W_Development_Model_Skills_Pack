# @req: REQ-017, REQ-018, REQ-019, REQ-020
# @design: SD-003
# @designIds: SD-003
# @system: L2_blog_system_interaction
# @tla-spec: L2_BlogSystemInteraction
# @state-machine: SM-L2_BlogSystemInteraction
# @parent-features: L1_blog_system-002.feature
# @sibling-features: L2_blog_system_auth-001.feature, L2_blog_system_content-001.feature, L2_blog_system_discovery-001.feature, L2_blog_system_analytics-001.feature, L2_blog_system_integration-001.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L2
Feature: 读者互动子系统评论生命周期行为
  作为读者互动子系统
  我希望完成评论发表、作者删除与越权拒绝的评论状态流转
  以便在已发布文章上提供可控的互动能力（浏览、点赞收藏与关注不改变评论状态）

Background:
  # @states: none, active, deleted
  # @initial-state: none
  # @terminal-states: deleted
  # @accepting-states: active
  # @rejecting-states: deleted
  # @transitions:
  #   none + postComment -> active [guard: articleVisible] [action: persistComment]
  #   active + deleteCommentByAuthor -> deleted [guard: operatorIsAuthor] [action: removeComment]
  # @invariants:
  #   none => articleVisible
  #   deleted => commentDeleterIsAuthor
  Given 系统处于初始状态

@REQ-018 @ST-002 @BDD-L2-013 @high
Scenario: 读者对已发布文章发表评论立即可见
  Given 系统处于 "none" 状态
  And 目标文章已发布对读者可见
  When 子系统执行发表评论处理 (postComment)
  Then 系统应转移到 "active" 状态
  And 不变式 "none => articleVisible" 应成立

@REQ-018 @ST-014 @BDD-L2-014 @high
Scenario: 文章作者删除评论进入删除态
  Given 系统处于 "active" 状态
  And 操作者为该文章作者
  When 子系统执行作者删除评论处理 (deleteCommentByAuthor)
  Then 系统应转移到 "deleted" 状态
  And 不变式 "deleted => commentDeleterIsAuthor" 应成立

@REQ-018 @ST-014 @BDD-L2-015 @medium
Scenario: 非文章作者删除评论被拒保持原态
  Given 系统处于 "active" 状态
  And 操作者不是该文章作者
  When 子系统拒绝越权删除评论请求
  Then 系统应保持在 "active" 状态

@REQ-018 @ST-014 @BDD-L2-016 @medium
Scenario: 评论发表到作者删除的完整生命周期
  Given 系统处于 "none" 状态
  When 子系统执行发表评论处理 (postComment)
  And 子系统执行作者删除评论处理 (deleteCommentByAuthor)
  Then 系统应转移到 "deleted" 状态
  And 不变式 "deleted => commentDeleterIsAuthor" 应成立

@REQ-017 @ST-013 @BDD-L2-017 @low
Scenario: 读者浏览已发布文章不改变评论状态
  Given 系统处于 "none" 状态
  And 系统存在已发布文章
  When 子系统执行文章详情浏览处理
  Then 系统应保持在 "none" 状态
