# @req: REQ-001, REQ-002, REQ-003, REQ-004, REQ-005
# @design: docs/phase1-requirements/requirement-spec.md:§3
# @designIds: SD-001,SD-002,SD-003,SD-017
# @system: L1_blog_system
# @tla-spec: L1_BlogSystem
# @state-machine: SM-L1_BlogSystem
# @parent-features: (none)
# @sibling-features: (none)
# @child-features: (none)
# @scenario-id-prefix: BDD-L1
Feature: 博客系统用户与博主身份端到端场景
  作为博客系统的用户与博主
  我希望完成注册、资料管理、登录会话、开通博主与关注流程
  以便验证用户与博主身份域满足需求

Background:
  # @states: visitor, user, blogger, admin
  # @initial-state: visitor
  # @terminal-states: ()
  # @accepting-states: user, blogger, admin
  # @rejecting-states: visitor
  # @transitions:
  #   visitor + Register -> user
  #   user + Register -> user
  #   user + ManageProfile -> user
  #   visitor + ManageProfile -> visitor
  #   user + Login -> user
  #   visitor + Login -> visitor
  #   user + OpenBlogger -> blogger
  #   blogger + OpenBlogger -> blogger
  #   user + FollowBlogger -> user
  #   visitor + FollowBlogger -> visitor
  # @invariants:
  #   TypeInvariant
  #   ProtectedSuccessRequiresAuth
  #   BloggerOnlyVisitorUnauthorized
  #   BloggerOnlyNonOwnerForbidden
  #   BrowseOkRequiresPublished
  #   AuditActionsAdminOnly
  Given 系统处于初始状态

@REQ-001 @UAT-001 @BDD-L1-001 @high
Scenario: 访客使用合法邮箱与密码注册成功
  Given 系统处于 "visitor" 状态
  And 用户输入合法邮箱与密码
  When 用户执行注册 (Register)
  Then 系统应转移到 "user" 状态
  And 系统返回 201 创建成功且含令牌
  And 不变式 "TypeInvariant" 应成立

@REQ-001 @UAT-002 @BDD-L1-002 @high
Scenario: 已注册邮箱重复注册被拒绝
  Given 系统处于 "user" 状态
  And 邮箱已注册
  When 用户执行注册 (Register)
  Then 系统应保持在 "user" 状态
  And 系统返回 409 冲突
  And 不变式 "TypeInvariant" 应成立

@REQ-002 @UAT-004 @BDD-L1-003 @high
Scenario: 认证用户更新个人资料成功
  Given 系统处于 "user" 状态
  And 用户携带有效令牌
  When 用户执行资料管理 (ManageProfile)
  Then 系统应保持在 "user" 状态
  And 系统返回 200 且更新字段持久化
  And 不变式 "ProtectedSuccessRequiresAuth" 应成立

@REQ-002 @UAT-005 @BDD-L1-004 @high
Scenario: 未携带令牌访问个人资料被拒绝
  Given 系统处于 "visitor" 状态
  And 用户未携带令牌
  When 用户执行资料管理 (ManageProfile)
  Then 系统应保持在 "visitor" 状态
  And 系统返回 401 未认证
  And 不变式 "ProtectedSuccessRequiresAuth" 应成立

@REQ-003 @UAT-007 @BDD-L1-005 @high
Scenario: 访客注册后登录换取 JWT 成功
  Given 系统处于 "visitor" 状态
  And 用户已注册账号
  When 用户执行注册 (Register)
  And 用户执行登录 (Login)
  Then 系统应转移到 "user" 状态
  And 系统返回 200 与 JWT 令牌
  And 不变式 "ProtectedSuccessRequiresAuth" 应成立

@REQ-003 @UAT-008 @BDD-L1-006 @high
Scenario: 错误密码登录被系统拒绝
  Given 系统处于 "visitor" 状态
  And 用户输入错误密码
  When 用户执行登录 (Login)
  Then 系统应保持在 "visitor" 状态
  And 系统返回 401 未认证
  And 不变式 "ProtectedSuccessRequiresAuth" 应成立

@REQ-004 @UAT-010 @BDD-L1-007 @high
Scenario: 认证用户开通博主身份成功
  Given 系统处于 "user" 状态
  And 用户已认证
  When 用户执行开通博主 (OpenBlogger)
  Then 系统应转移到 "blogger" 状态
  And 系统返回 201 博主信息
  And 不变式 "ProtectedSuccessRequiresAuth" 应成立

@REQ-004 @UAT-011 @BDD-L1-008 @medium
Scenario: 博主重复开通身份被拒绝
  Given 系统处于 "blogger" 状态
  And 博主身份已存在
  When 用户执行开通博主 (OpenBlogger)
  Then 系统应保持在 "blogger" 状态
  And 系统返回 409 冲突
  And 不变式 "TypeInvariant" 应成立

@REQ-005 @UAT-013 @BDD-L1-009 @high
Scenario: 用户关注博主且粉丝数加一
  Given 系统处于 "user" 状态
  And 目标博主存在
  When 用户执行关注博主 (FollowBlogger)
  Then 系统应保持在 "user" 状态
  And 系统返回 200 且粉丝数加一
  And 不变式 "ProtectedSuccessRequiresAuth" 应成立

@REQ-005 @UAT-014 @BDD-L1-010 @high
Scenario: 重复关注博主保持幂等
  Given 系统处于 "user" 状态
  And 已关注目标博主
  When 用户执行关注博主 (FollowBlogger)
  Then 系统应保持在 "user" 状态
  And 系统返回 200 且粉丝数不变
  And 不变式 "TypeInvariant" 应成立

@REQ-005 @UAT-069 @BDD-L1-011 @medium
Scenario: 未认证访客关注博主被拒绝
  Given 系统处于 "visitor" 状态
  And 用户未认证
  When 用户执行关注博主 (FollowBlogger)
  Then 系统应保持在 "visitor" 状态
  And 系统返回 401 未认证
  And 不变式 "ProtectedSuccessRequiresAuth" 应成立
