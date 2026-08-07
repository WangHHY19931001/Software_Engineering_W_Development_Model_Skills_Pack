# @req: REQ-011, REQ-012, REQ-013, REQ-014, REQ-015, REQ-016
# @design: SD-002
# @designIds: SD-002
# @system: L2_blog_system_content
# @tla-spec: L2_BlogSystemContent
# @state-machine: SM-L2_BlogSystemContent
# @parent-features: L1_blog_system-001.feature
# @sibling-features: L2_blog_system_auth-001.feature, L2_blog_system_interaction-001.feature, L2_blog_system_discovery-001.feature, L2_blog_system_analytics-001.feature, L2_blog_system_integration-001.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L2
Feature: 内容发布子系统文章生命周期行为
  作为内容发布子系统
  我希望完成文章创建、发布、编辑、归档、取消归档与删除的生命周期状态流转
  以便为读者提供已发布文章的可见性，并为博主提供可靠的文章状态管理（标签与分类随创建维护）

Background:
  # @states: none, draft, published, archived
  # @initial-state: none
  # @terminal-states: archived
  # @accepting-states: published
  # @rejecting-states: none
  # @transitions:
  #   none + createDraft -> draft [guard: creatorIsBlogger] [action: persistDraft]
  #   draft + publishArticle -> published [guard: creatorIsBlogger] [action: makeVisible]
  #   published + editPublishedArticle -> draft [action: reopenDraft]
  #   published + archiveArticle -> archived [action: hideFromReaders]
  #   archived + unarchiveArticle -> draft [action: restoreDraft]
  #   draft + deleteDraft -> none [action: removeArticle]
  # @invariants:
  #   archived => hasPublished
  #   none => ~hasPublished
  Given 系统处于初始状态

@REQ-011 @REQ-015 @REQ-016 @ST-007 @BDD-L2-007 @high
Scenario: 博主创建含标签与分类的文章进入草稿态
  Given 系统处于 "none" 状态
  And 博主提供标题正文摘要及唯一标签与嵌套分类
  When 子系统执行创建草稿处理 (createDraft)
  Then 系统应转移到 "draft" 状态

@REQ-012 @ST-001 @BDD-L2-008 @high
Scenario: 发布草稿文章进入已发布态对读者可见
  Given 系统处于 "draft" 状态
  And 博主确认草稿内容无误
  When 子系统执行发布处理 (publishArticle)
  Then 系统应转移到 "published" 状态

@REQ-012 @REQ-014 @ST-010 @BDD-L2-009 @medium
Scenario: 已发布文章编辑后回草稿态需重新发布
  Given 系统处于 "published" 状态
  And 博主更新文章内容
  When 子系统执行已发布文章编辑处理 (editPublishedArticle)
  Then 系统应转移到 "draft" 状态

@REQ-013 @ST-008 @BDD-L2-010 @medium
Scenario: 归档已发布文章进入归档态
  Given 系统处于 "published" 状态
  And 博主对已发布文章执行归档
  When 子系统执行归档处理 (archiveArticle)
  Then 系统应转移到 "archived" 状态
  And 不变式 "archived => hasPublished" 应成立

@REQ-013 @ST-009 @BDD-L2-011 @medium
Scenario: 取消归档回草稿态不可直接发布
  Given 系统处于 "archived" 状态
  And 博主取消文章归档
  When 子系统执行取消归档处理 (unarchiveArticle)
  Then 系统应转移到 "draft" 状态

@REQ-014 @ST-009 @BDD-L2-012 @medium
Scenario: 删除草稿文章回到无文章态
  Given 系统处于 "draft" 状态
  And 博主删除尚未发布的草稿
  When 子系统执行删除草稿处理 (deleteDraft)
  Then 系统应转移到 "none" 状态
  And 不变式 "none => ~hasPublished" 应成立
