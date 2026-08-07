# @req: REQ-011, REQ-012, REQ-013, REQ-014
# @design: SD-002
# @designIds: SD-002
# @system: L3_blog_system_article_state
# @tla-spec: L3_BlogSystemArticleState
# @state-machine: SM-L3_BlogSystemArticleState
# @parent-features: L2_blog_system_content-001.feature
# @sibling-features: L3_blog_system_article_state-001.feature, L3_blog_system_auth_flow-001.feature, L3_blog_system_comment_flow-001.feature, L3_blog_system_rate_limit-001.feature, L3_blog_system_webhook_retry-001.feature, L3_blog_system_reading_dedup-001.feature
# @child-features: L4_blog_system_article_store-001.feature
# @scenario-id-prefix: BDD-L3
Feature: 文章状态机原子行为（创建/发布/编辑/归档/取消归档/删除）
  作为内容发布模块的文章状态机
  我希望按 REQ-011~014 的原子操作完成文章生命周期状态流转（draft→published→archived，删除仅限未发布草稿）
  以便为文章生命周期提供与 L3 TLA+ 规格等价的原子行为基线（INTF-005~008）

Background:
  # @states: none, draft, published, archived
  # @initial-state: none
  # @terminal-states: archived
  # @accepting-states: published
  # @rejecting-states: none
  # @transitions:
  #   none + createDraft -> draft [guard: isBlogger] [action: persistDraft]
  #   draft + publishArticle -> published [guard: isBlogger] [action: makeVisible]
  #   published + editPublishedArticle -> draft [action: reopenDraft]
  #   published + archiveArticle -> archived [action: hideFromReaders]
  #   archived + unarchiveArticle -> draft [action: restoreDraft]
  #   draft + deleteDraft -> none [guard: ~hasPublished] [action: removeArticle]
  # @invariants:
  #   archived => hasPublished
  #   published => hasPublished
  #   none => ~hasPublished
  Given 系统处于初始状态

@REQ-011 @IT-003 @BDD-L3-001 @high
Scenario: 博主创建文章进入草稿态
  Given 系统处于 "none" 状态
  And 博主已完成认证并提交标题正文标签分类
  When 模块执行创建草稿处理 (createDraft)
  Then 系统应转移到 "draft" 状态

@REQ-012 @IT-005 @BDD-L3-002 @high
Scenario: 发布草稿文章进入已发布态对读者可见
  Given 系统处于 "draft" 状态
  And 博主确认草稿内容无误
  When 模块执行发布处理 (publishArticle)
  Then 系统应转移到 "published" 状态
  And 不变式 "published => hasPublished" 应成立

@REQ-012 @REQ-014 @IT-005 @BDD-L3-003 @medium
Scenario: 编辑已发布文章回草稿态需重新发布
  Given 系统处于 "published" 状态
  And 博主更新已发布文章内容
  When 模块执行已发布文章编辑处理 (editPublishedArticle)
  Then 系统应转移到 "draft" 状态

@REQ-013 @IT-005 @BDD-L3-004 @high
Scenario: 归档已发布文章进入归档态且保留发布历史
  Given 系统处于 "published" 状态
  And 博主对已发布文章执行归档
  When 模块执行归档处理 (archiveArticle)
  Then 系统应转移到 "archived" 状态
  And 不变式 "archived => hasPublished" 应成立

@REQ-013 @IT-009 @BDD-L3-005 @medium
Scenario: 取消归档回草稿态不可直接发布
  Given 系统处于 "archived" 状态
  And 博主对归档文章执行取消归档
  When 模块执行取消归档处理 (unarchiveArticle)
  Then 系统应转移到 "draft" 状态

@REQ-014 @IT-010 @BDD-L3-006 @medium
Scenario: 删除未发布草稿回到无文章态
  Given 系统处于 "draft" 状态
  And 博主删除尚未发布且未标记发布历史的草稿
  When 模块执行删除草稿处理 (deleteDraft)
  Then 系统应转移到 "none" 状态
  And 不变式 "none => ~hasPublished" 应成立

@REQ-011 @REQ-012 @REQ-013 @IT-005 @IT-009 @BDD-L3-007 @low
Scenario: 创建发布归档取消归档再发布的完整生命周期
  Given 系统处于 "none" 状态
  When 模块执行创建草稿处理 (createDraft)
  And 模块执行发布处理 (publishArticle)
  And 模块执行归档处理 (archiveArticle)
  And 模块执行取消归档处理 (unarchiveArticle)
  And 模块执行发布处理 (publishArticle)
  Then 系统应转移到 "published" 状态
  And 不变式 "published => hasPublished" 应成立
