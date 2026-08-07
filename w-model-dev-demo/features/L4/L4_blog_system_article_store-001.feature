# @req: REQ-011, REQ-012, REQ-013, REQ-014
# @design: SD-002
# @designIds: SD-002
# @system: L4_blog_system_article_store
# @tla-spec: L4_BlogSystemArticleStore
# @state-machine: SM-L4_BlogSystemArticleStore
# @parent-features: L3_blog_system_article_state-001.feature
# @sibling-features: L4_blog_system_article_store-001.feature, L4_blog_system_audit_log-001.feature, L4_blog_system_rate_limit_window-001.feature, L4_blog_system_token_store-001.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L4
Feature: 文章存储原子方法行为（落库/发布/编辑/归档/取消归档/删除）
  作为内容发布模块的文章存储（DD-011 ArticleStore + DD-008 状态机裁决）
  我希望完成文章记录 none→draft→published→archived 的原子写方法流转（每次写操作版本递增、删除仅限未发布草稿）
  以便为文章生命周期提供与 L4 TLA+ 规格等价的存储原子行为基线（REQ-011~014）

Background:
  # @states: none, draft, published, archived
  # @initial-state: none
  # @terminal-states: archived
  # @accepting-states: published
  # @rejecting-states: none
  # @transitions:
  #   none + storeCreateRecord -> draft [action: writeRecord]
  #   draft + storePublishRecord -> published [action: setPublishedAt]
  #   published + storeUpdatePublished -> draft [action: reopenDraft]
  #   draft + storeUpdateDraftOrArchived -> draft [action: bumpVersion]
  #   archived + storeUpdateDraftOrArchived -> draft [action: bumpVersion]
  #   published + storeArchiveRecord -> archived [action: hideRecord]
  #   archived + storeUnarchiveRecord -> draft [action: restoreDraft]
  #   draft + storeDeleteRecord -> none [guard: ~hasPublished] [action: removeRecord]
  # @invariants:
  #   archived => hasPublished
  #   published => hasPublished
  #   none => ~hasPublished
  Given 系统处于初始状态

@REQ-011 @UT-007 @BDD-L4-001 @high
Scenario: 落库新文章记录进入草稿态
  Given 系统处于 "none" 状态
  And 博主提交标题正文摘要标签与分类
  When 模块执行文章记录落库处理 (storeCreateRecord)
  Then 系统应转移到 "draft" 状态

@REQ-012 @UT-008 @BDD-L4-002 @high
Scenario: 发布草稿记录进入已发布态并记录发布历史
  Given 系统处于 "draft" 状态
  And 博主确认草稿内容无误
  When 模块执行文章发布写处理 (storePublishRecord)
  Then 系统应转移到 "published" 状态
  And 不变式 "published => hasPublished" 应成立

@REQ-012 @UT-008 @BDD-L4-003 @medium
Scenario: 编辑已发布记录置回草稿态
  Given 系统处于 "published" 状态
  And 博主更新已发布文章内容
  When 模块执行已发布记录编辑写处理 (storeUpdatePublished)
  Then 系统应转移到 "draft" 状态

@REQ-013 @UT-008 @BDD-L4-004 @high
Scenario: 归档已发布记录进入归档态且保留发布历史
  Given 系统处于 "published" 状态
  And 博主对已发布文章执行归档
  When 模块执行文章归档写处理 (storeArchiveRecord)
  Then 系统应转移到 "archived" 状态
  And 不变式 "archived => hasPublished" 应成立

@REQ-013 @UT-008 @BDD-L4-005 @medium
Scenario: 取消归档记录回草稿态
  Given 系统处于 "archived" 状态
  And 博主对归档文章执行取消归档
  When 模块执行取消归档写处理 (storeUnarchiveRecord)
  Then 系统应转移到 "draft" 状态

@REQ-014 @UT-052 @BDD-L4-006 @medium
Scenario: 删除未发布草稿记录回到无记录态
  Given 系统处于 "draft" 状态
  And 记录从未发布且为草稿态
  When 模块执行未发布草稿删除处理 (storeDeleteRecord)
  Then 系统应转移到 "none" 状态
  And 不变式 "none => ~hasPublished" 应成立

@REQ-014 @UT-008 @BDD-L4-007 @medium
Scenario: 编辑草稿或归档记录内容保持草稿态
  Given 系统处于 "draft" 状态
  And 博主更新草稿内容
  When 模块执行草稿或归档记录编辑写处理 (storeUpdateDraftOrArchived)
  Then 系统应保持在 "draft" 状态

@REQ-011 @REQ-012 @REQ-013 @REQ-014 @UT-008 @UT-052 @BDD-L4-008 @low
Scenario: 落库发布归档取消归档再发布的完整存储生命周期
  Given 系统处于 "none" 状态
  When 模块执行文章记录落库处理 (storeCreateRecord)
  And 模块执行文章发布写处理 (storePublishRecord)
  And 模块执行文章归档写处理 (storeArchiveRecord)
  And 模块执行取消归档写处理 (storeUnarchiveRecord)
  And 模块执行文章发布写处理 (storePublishRecord)
  Then 系统应转移到 "published" 状态
  And 不变式 "published => hasPublished" 应成立
