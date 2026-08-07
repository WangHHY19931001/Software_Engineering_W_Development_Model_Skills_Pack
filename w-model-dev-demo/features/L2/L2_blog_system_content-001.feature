# @req: REQ-004, REQ-005, REQ-006, REQ-007, REQ-011, REQ-012
# @design: docs/phase2-design/blog-system-system-design.md:§3
# @designIds: SD-003,SD-004,SD-008,SD-009
# @system: L2_blog_system_content
# @tla-spec: L2_BlogSystemContent
# @state-machine: SM-L2_BlogSystemContent
# @parent-features: L1/L1_blog_system-001.feature, L1/L1_blog_system-002.feature
# @sibling-features: L2/L2_blog_system_auth-001.feature, L2/L2_blog_system_engagement-001.feature, L2/L2_blog_system_discovery-001.feature, L2/L2_blog_system_ops-001.feature, L2/L2_blog_system_infra-001.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L2
Feature: 博客系统内容子系统（M-003 博主子系统 / M-004 文章管理服务 / M-008 标签服务 / M-009 分类服务）
  作为博客系统的内容子系统
  我希望完成博主身份、文章草稿发布流转、标签与分类的管理
  以便验证内容域（REQ-004/REQ-005/REQ-006/REQ-007/REQ-011/REQ-012）满足系统设计

Background:
  # @states: none, draft, published
  # @initial-state: none
  # @terminal-states: ()
  # @accepting-states: published
  # @rejecting-states: none
  # @transitions:
  #   none + openBlogger -> none [action: openBloggerIdentity]
  #   none + createArticle -> draft [guard: bloggerOpen] [action: createDraft]
  #   draft + publishArticle -> published [action: makePublic]
  #   published + unpublishArticle -> draft [action: revertToDraft]
  #   draft + deleteArticle -> none [action: removeArticle]
  #   published + deleteArticle -> none [action: removeArticle]
  #   draft + followBlogger -> draft [guard: bloggerOpen] [action: incrementFollowers]
  #   draft + createTag -> draft [action: createTag]
  #   draft + createCategory -> draft [action: createCategory]
  # @invariants:
  #   TypeInvariant
  #   published => bloggerState = open
  #   followerCount >= 0
  #   tagReferenced => tagState # deleted
  #   categoryHasArticles => categoryState # deleted
  Given 系统处于初始状态

@REQ-004 @ST-001 @BDD-L2-006 @high
Scenario: 认证用户开通博主身份且文章状态投影不变
  Given 系统处于 "none" 状态
  And 认证用户请求开通博主身份
  When 用户执行博主身份开通 (openBlogger)
  Then 系统应保持在 "none" 状态
  And 博主身份状态变为已开通
  And 不变式 "TypeInvariant" 应成立

@REQ-006 @ST-001 @BDD-L2-007 @high
Scenario: 博主创建文章进入草稿状态
  Given 系统处于 "none" 状态
  And 博主填写标题与内容且博主身份已开通
  When 用户执行文章创建 (createArticle)
  Then 系统应转移到 "draft" 状态
  And 文章以草稿状态保存
  And 不变式 "TypeInvariant" 应成立

@REQ-007 @ST-001 @BDD-L2-008 @high
Scenario: 博主发布草稿文章使其公开可见
  Given 系统处于 "draft" 状态
  And 文章当前为草稿
  When 用户执行文章发布 (publishArticle)
  Then 系统应转移到 "published" 状态
  And 文章公开可见
  And 不变式 "published => bloggerState = open" 应成立

@REQ-007 @ST-001 @BDD-L2-009 @high
Scenario: 博主撤回已发布文章回草稿
  Given 系统处于 "published" 状态
  And 文章当前已发布
  When 用户执行文章撤回 (unpublishArticle)
  Then 系统应转移到 "draft" 状态
  And 文章在公开列表不可见
  And 不变式 "TypeInvariant" 应成立

@REQ-006 @ST-004 @BDD-L2-010 @high
Scenario: 博主删除草稿文章使其回到无文章状态
  Given 系统处于 "draft" 状态
  And 文章存在且为草稿
  When 用户执行文章删除 (deleteArticle)
  Then 系统应转移到 "none" 状态
  And 文章被删除
  And 不变式 "TypeInvariant" 应成立

@REQ-005 @ST-006 @BDD-L2-011 @medium
Scenario: 用户关注博主且粉丝计数非负
  Given 系统处于 "draft" 状态
  And 目标博主已开通且存在
  When 用户执行关注博主 (followBlogger)
  Then 系统应保持在 "draft" 状态
  And 粉丝计数加一
  And 不变式 "followerCount >= 0" 应成立

@REQ-011 @ST-010 @BDD-L2-012 @medium
Scenario: 博主创建标签且被引用标签受删除保护
  Given 系统处于 "draft" 状态
  And 标签名称合法且未创建
  When 用户执行标签创建 (createTag)
  Then 系统应保持在 "draft" 状态
  And 标签创建成功
  And 不变式 "tagReferenced => tagState # deleted" 应成立

@REQ-012 @ST-010 @BDD-L2-013 @medium
Scenario: 博主创建含父级分类且含文章分类受删除保护
  Given 系统处于 "draft" 状态
  And 父分类存在且分类未创建
  When 用户执行分类创建 (createCategory)
  Then 系统应保持在 "draft" 状态
  And 分类创建成功
  And 不变式 "categoryHasArticles => categoryState # deleted" 应成立
