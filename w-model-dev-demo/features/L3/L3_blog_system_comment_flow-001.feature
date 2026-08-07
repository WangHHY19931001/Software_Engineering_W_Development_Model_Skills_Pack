# @req: REQ-018
# @design: SD-003
# @designIds: SD-003
# @system: L3_blog_system_comment_flow
# @tla-spec: L3_BlogSystemCommentFlow
# @state-machine: SM-L3_BlogSystemCommentFlow
# @parent-features: L2_blog_system_interaction-001.feature
# @sibling-features: L3_blog_system_article_state-001.feature, L3_blog_system_auth_flow-001.feature, L3_blog_system_comment_flow-001.feature, L3_blog_system_rate_limit-001.feature, L3_blog_system_webhook_retry-001.feature, L3_blog_system_reading_dedup-001.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L3
Feature: 评论流原子行为（发表/回复/作者删除/越权拒绝）
  作为读者互动模块的评论流
  我希望完成评论 none→active 的原子状态流转（已认证读者发表、回复、作者删除、越权与未认证拒绝）
  以便在已发布文章上提供与 L3 TLA+ 规格等价的评论生命周期基线（INTF-012）

Background:
  # @states: none, active
  # @initial-state: none
  # @terminal-states: ()
  # @accepting-states: active
  # @rejecting-states: ()
  # @transitions:
  #   none + createComment -> active [guard: articlePublished, authenticated] [action: persistComment]
  #   active + replyComment -> active [guard: articlePublished, authenticated] [action: persistReply]
  #   active + deleteComment -> none [guard: deletionAuthorized] [action: removeComment]
  # @invariants:
  #   active => articlePublished
  #   active => authenticated
  Given 系统处于初始状态

@REQ-018 @IT-013 @BDD-L3-013 @high
Scenario: 已认证读者在已发布文章发表评论进入有评论态
  Given 系统处于 "none" 状态
  And 目标文章已发布且评论者已认证
  When 模块执行发表评论处理 (createComment)
  Then 系统应转移到 "active" 状态
  And 不变式 "active => articlePublished" 应成立

@REQ-018 @IT-015 @BDD-L3-014 @medium
Scenario: 对已有评论回复保持有评论态
  Given 系统处于 "active" 状态
  And 文章已发布且存在可回复评论
  When 模块执行回复评论处理 (replyComment)
  Then 系统应保持在 "active" 状态
  And 不变式 "active => authenticated" 应成立

@REQ-018 @IT-014 @BDD-L3-015 @medium
Scenario: 文章作者删除最后一条评论回到无评论态
  Given 系统处于 "active" 状态
  And 操作者为文章作者且当前仅有一条评论
  When 模块执行作者删除评论处理 (deleteComment)
  Then 系统应转移到 "none" 状态

@REQ-018 @IT-014 @BDD-L3-016 @medium
Scenario: 非文章作者删除评论被拒保持原态
  Given 系统处于 "active" 状态
  And 操作者不是该文章作者
  When 模块拒绝越权删除评论请求
  Then 系统应保持在 "active" 状态

@REQ-018 @IT-013 @BDD-L3-017 @medium
Scenario: 未认证或文章未发布时发表评论被拒
  Given 系统处于 "none" 状态
  And 评论者未认证或目标文章未发布
  When 模块拒绝发表评论请求
  Then 系统应保持在 "none" 状态

@REQ-018 @IT-013 @IT-014 @IT-015 @BDD-L3-018 @low
Scenario: 发表回复删除的完整评论生命周期
  Given 系统处于 "none" 状态
  And 当前仅有一条评论
  When 模块执行发表评论处理 (createComment)
  And 模块执行回复评论处理 (replyComment)
  And 模块执行作者删除评论处理 (deleteComment)
  Then 系统应转移到 "none" 状态
