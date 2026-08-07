# @req: REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-011, REQ-012, REQ-013, REQ-014, REQ-015
# @design: docs/phase1-requirements/requirement-spec.md:§3
# @designIds: SD-004,SD-005,SD-006,SD-007,SD-008,SD-009,SD-010,SD-011,SD-018,SD-019
# @system: L1_blog_system
# @tla-spec: L1_BlogSystem
# @state-machine: SM-L1_BlogSystem
# @parent-features: (none)
# @sibling-features: (none)
# @child-features: (none)
# @scenario-id-prefix: BDD-L1
Feature: 博客系统内容管理端到端场景
  作为博客系统的博主与访客
  我希望完成文章、发布草稿、浏览、评论、审核、标签、分类、搜索、推荐与统计流程
  以便验证内容管理域满足需求

Background:
  # @states: visitor, user, blogger, admin
  # @initial-state: visitor
  # @terminal-states: ()
  # @accepting-states: user, blogger, admin
  # @rejecting-states: visitor
  # @transitions:
  #   blogger + ManageArticle -> blogger
  #   user + ManageArticle -> user
  #   visitor + ManageArticle -> visitor
  #   blogger + PublishArticle -> blogger
  #   visitor + BrowseArticle -> visitor
  #   user + ManageComment -> user
  #   blogger + ReviewComment -> blogger
  #   user + ReviewComment -> user
  #   blogger + ManageTag -> blogger
  #   blogger + ManageCategory -> blogger
  #   visitor + SearchArticle -> visitor
  #   visitor + RecommendArticle -> visitor
  #   blogger + QueryStats -> blogger
  # @invariants:
  #   TypeInvariant
  #   ProtectedSuccessRequiresAuth
  #   BloggerOnlyVisitorUnauthorized
  #   BloggerOnlyNonOwnerForbidden
  #   BrowseOkRequiresPublished
  #   AuditActionsAdminOnly
  Given 系统处于初始状态

@REQ-006 @UAT-016 @BDD-L1-012 @high
Scenario: 博主创建文章成功
  Given 系统处于 "blogger" 状态
  And 博主填写标题与内容
  When 用户执行文章管理 (ManageArticle)
  Then 系统应保持在 "blogger" 状态
  And 系统返回 201 且文章可按标识查询
  And 不变式 "TypeInvariant" 应成立

@REQ-006 @UAT-017 @BDD-L1-013 @high
Scenario: 非文章作者更新文章被拒绝
  Given 系统处于 "user" 状态
  And 用户非文章作者
  When 用户执行文章管理 (ManageArticle)
  Then 系统应保持在 "user" 状态
  And 系统返回 403 越权
  And 不变式 "BloggerOnlyNonOwnerForbidden" 应成立

@REQ-006 @UAT-069 @BDD-L1-032 @medium
Scenario: 未认证访客创建文章被拒绝
  Given 系统处于 "visitor" 状态
  And 用户未认证
  When 用户执行文章管理 (ManageArticle)
  Then 系统应保持在 "visitor" 状态
  And 系统返回 401 未认证
  And 不变式 "BloggerOnlyVisitorUnauthorized" 应成立

@REQ-007 @UAT-020 @BDD-L1-014 @high
Scenario: 博主发布文章成功且公开可见
  Given 系统处于 "blogger" 状态
  And 文章当前为草稿
  When 用户执行文章发布 (PublishArticle)
  Then 系统应保持在 "blogger" 状态
  And 文章状态变为已发布且公开可见
  And 不变式 "BrowseOkRequiresPublished" 应成立

@REQ-007 @UAT-019 @BDD-L1-015 @high
Scenario: 保存草稿后公开列表不可见
  Given 系统处于 "blogger" 状态
  And 文章保存为草稿
  When 用户执行文章发布 (PublishArticle)
  Then 系统应保持在 "blogger" 状态
  And 草稿在公开列表不可见
  And 不变式 "BrowseOkRequiresPublished" 应成立

@REQ-008 @UAT-022 @BDD-L1-016 @high
Scenario: 访客浏览公开文章且浏览量加一
  Given 系统处于 "visitor" 状态
  And 文章已发布
  When 用户执行文章浏览 (BrowseArticle)
  Then 系统应保持在 "visitor" 状态
  And 系统返回 200 且浏览量加一
  And 不变式 "BrowseOkRequiresPublished" 应成立

@REQ-008 @UAT-024 @BDD-L1-017 @high
Scenario: 访客浏览草稿被系统拒绝
  Given 系统处于 "visitor" 状态
  And 文章为草稿
  When 用户执行文章浏览 (BrowseArticle)
  Then 系统应保持在 "visitor" 状态
  And 系统返回 404 未找到
  And 不变式 "BrowseOkRequiresPublished" 应成立

@REQ-009 @UAT-025 @BDD-L1-018 @high
Scenario: 认证用户发表评论成功
  Given 系统处于 "user" 状态
  And 文章存在且已发布
  When 用户执行评论管理 (ManageComment)
  Then 系统应保持在 "user" 状态
  And 系统返回 201 评论
  And 不变式 "ProtectedSuccessRequiresAuth" 应成立

@REQ-009 @UAT-026 @BDD-L1-019 @high
Scenario: 非评论作者删除评论被拒绝
  Given 系统处于 "user" 状态
  And 用户非评论作者
  When 用户执行评论管理 (ManageComment)
  Then 系统应保持在 "user" 状态
  And 系统返回 403 越权
  And 不变式 "TypeInvariant" 应成立

@REQ-010 @UAT-028 @BDD-L1-020 @high
Scenario: 博主审核通过评论使其公开可见
  Given 系统处于 "blogger" 状态
  And 待审核评论存在
  When 用户执行评论审核 (ReviewComment)
  Then 系统应保持在 "blogger" 状态
  And 评论审核通过且公开可见
  And 不变式 "TypeInvariant" 应成立

@REQ-010 @UAT-030 @BDD-L1-021 @high
Scenario: 非博主执行评论审核被拒绝
  Given 系统处于 "user" 状态
  And 用户非博主
  When 用户执行评论审核 (ReviewComment)
  Then 系统应保持在 "user" 状态
  And 系统返回 403 越权
  And 不变式 "BloggerOnlyNonOwnerForbidden" 应成立

@REQ-011 @UAT-031 @BDD-L1-022 @high
Scenario: 博主创建标签成功
  Given 系统处于 "blogger" 状态
  And 标签名称合法
  When 用户执行标签管理 (ManageTag)
  Then 系统应保持在 "blogger" 状态
  And 系统返回 201 标签
  And 不变式 "TypeInvariant" 应成立

@REQ-011 @UAT-032 @BDD-L1-023 @medium
Scenario: 重复创建标签被系统拒绝
  Given 系统处于 "blogger" 状态
  And 标签已存在
  When 用户执行标签管理 (ManageTag)
  Then 系统应保持在 "blogger" 状态
  And 系统返回 409 冲突
  And 不变式 "TypeInvariant" 应成立

@REQ-012 @UAT-034 @BDD-L1-024 @high
Scenario: 博主创建含父级分类成功
  Given 系统处于 "blogger" 状态
  And 父分类存在
  When 用户执行分类管理 (ManageCategory)
  Then 系统应保持在 "blogger" 状态
  And 系统返回 201 分类
  And 不变式 "TypeInvariant" 应成立

@REQ-012 @UAT-036 @BDD-L1-025 @medium
Scenario: 父分类不存在时创建分类被拒绝
  Given 系统处于 "blogger" 状态
  And 父分类不存在
  When 用户执行分类管理 (ManageCategory)
  Then 系统应保持在 "blogger" 状态
  And 系统返回 400 参数错误
  And 不变式 "TypeInvariant" 应成立

@REQ-013 @UAT-037 @BDD-L1-026 @high
Scenario: 关键词命中文章返回分页结果
  Given 系统处于 "visitor" 状态
  And 关键词命中已发布文章
  When 用户执行文章搜索 (SearchArticle)
  Then 系统应保持在 "visitor" 状态
  And 系统返回 200 分页结果
  And 不变式 "BrowseOkRequiresPublished" 应成立

@REQ-013 @UAT-038 @BDD-L1-027 @medium
Scenario: 关键词无命中返回空列表
  Given 系统处于 "visitor" 状态
  And 关键词无命中
  When 用户执行文章搜索 (SearchArticle)
  Then 系统应保持在 "visitor" 状态
  And 系统返回 200 空列表
  And 不变式 "TypeInvariant" 应成立

@REQ-014 @UAT-040 @BDD-L1-028 @high
Scenario: 访客获取推荐文章列表
  Given 系统处于 "visitor" 状态
  And 存在已发布文章
  When 用户执行内容推荐 (RecommendArticle)
  Then 系统应保持在 "visitor" 状态
  And 系统返回不超过十条推荐文章
  And 不变式 "BrowseOkRequiresPublished" 应成立

@REQ-014 @UAT-041 @BDD-L1-029 @medium
Scenario: 系统无内容时返回空推荐列表
  Given 系统处于 "visitor" 状态
  And 系统暂无内容
  When 用户执行内容推荐 (RecommendArticle)
  Then 系统应保持在 "visitor" 状态
  And 系统返回 200 空列表
  And 不变式 "TypeInvariant" 应成立

@REQ-015 @UAT-043 @BDD-L1-030 @high
Scenario: 博主查询文章统计成功
  Given 系统处于 "blogger" 状态
  And 文章存在浏览与评论数据
  When 用户执行统计查询 (QueryStats)
  Then 系统应保持在 "blogger" 状态
  And 系统返回正确浏览量与评论数
  And 不变式 "TypeInvariant" 应成立

@REQ-015 @UAT-044 @BDD-L1-031 @medium
Scenario: 无浏览数据时统计返回零
  Given 系统处于 "blogger" 状态
  And 文章无浏览数据
  When 用户执行统计查询 (QueryStats)
  Then 系统应保持在 "blogger" 状态
  And 系统返回 0 而非空值
  And 不变式 "TypeInvariant" 应成立
