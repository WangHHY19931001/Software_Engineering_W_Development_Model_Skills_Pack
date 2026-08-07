# @req: REQ-016, REQ-017, REQ-018, REQ-019, REQ-020, REQ-021, REQ-022
# @design: docs/phase1-requirements/requirement-spec.md:§3
# @designIds: SD-012,SD-013,SD-014,SD-015,SD-016,SD-020,SD-021
# @system: L1_blog_system
# @tla-spec: L1_BlogSystem
# @state-machine: SM-L1_BlogSystem
# @parent-features: (none)
# @sibling-features: (none)
# @child-features: (none)
# @scenario-id-prefix: BDD-L1
Feature: 博客系统互动与运营端到端场景
  作为博客系统的用户、管理员与博主
  我希望完成通知、订阅、审计日志、RSS 订阅源与 Webhook 流程
  以便验证互动与运营域满足需求

Background:
  # @states: visitor, user, blogger, admin
  # @initial-state: visitor
  # @terminal-states: ()
  # @accepting-states: user, blogger, admin
  # @rejecting-states: visitor
  # @transitions:
  #   user + ManageNotification -> user
  #   user + SubscribeBlogger -> user
  #   admin + RecordAuditLog -> admin
  #   user + RecordAuditLog -> user
  #   admin + QueryAuditLog -> admin
  #   user + QueryAuditLog -> user
  #   visitor + GetRssFeed -> visitor
  #   blogger + ManageWebhook -> blogger
  #   blogger + RetryWebhook -> blogger
  # @invariants:
  #   TypeInvariant
  #   ProtectedSuccessRequiresAuth
  #   BloggerOnlyVisitorUnauthorized
  #   BloggerOnlyNonOwnerForbidden
  #   BrowseOkRequiresPublished
  #   AuditActionsAdminOnly
  Given 系统处于初始状态

@REQ-016 @UAT-046 @BDD-L1-033 @high
Scenario: 用户查询收到的通知列表
  Given 系统处于 "user" 状态
  And 存在评论或关注事件通知
  When 用户执行通知管理 (ManageNotification)
  Then 系统应保持在 "user" 状态
  And 系统返回通知列表
  And 不变式 "ProtectedSuccessRequiresAuth" 应成立

@REQ-016 @UAT-047 @BDD-L1-034 @high
Scenario: 用户标记通知为已读
  Given 系统处于 "user" 状态
  And 存在未读通知
  When 用户执行通知管理 (ManageNotification)
  Then 系统应保持在 "user" 状态
  And 通知状态变为已读
  And 不变式 "TypeInvariant" 应成立

@REQ-017 @UAT-049 @BDD-L1-035 @high
Scenario: 用户订阅博主成功
  Given 系统处于 "user" 状态
  And 目标博主存在
  When 用户执行博主订阅 (SubscribeBlogger)
  Then 系统应保持在 "user" 状态
  And 系统返回 200 且订阅关系建立
  And 不变式 "ProtectedSuccessRequiresAuth" 应成立

@REQ-017 @UAT-050 @BDD-L1-036 @medium
Scenario: 重复订阅博主保持幂等
  Given 系统处于 "user" 状态
  And 已订阅目标博主
  When 用户执行博主订阅 (SubscribeBlogger)
  Then 系统应保持在 "user" 状态
  And 系统返回 200 且订阅不重复
  And 不变式 "TypeInvariant" 应成立

@REQ-018 @UAT-052 @BDD-L1-037 @high
Scenario: 管理员记录审计日志成功
  Given 系统处于 "admin" 状态
  And 登录删除或配置变更事件发生
  When 用户执行审计日志记录 (RecordAuditLog)
  Then 系统应保持在 "admin" 状态
  And 审计日志新增记录且字段完整
  And 不变式 "AuditActionsAdminOnly" 应成立

@REQ-018 @UAT-054 @BDD-L1-038 @high
Scenario: 普通用户读审计日志被拒绝
  Given 系统处于 "user" 状态
  And 用户非管理员
  When 用户执行审计日志记录 (RecordAuditLog)
  Then 系统应保持在 "user" 状态
  And 系统返回 403 越权
  And 不变式 "AuditActionsAdminOnly" 应成立

@REQ-019 @UAT-055 @BDD-L1-039 @high
Scenario: 管理员筛选查询审计日志成功
  Given 系统处于 "admin" 状态
  And 存在审计日志数据
  When 用户执行审计日志查询 (QueryAuditLog)
  Then 系统应保持在 "admin" 状态
  And 系统返回分页且筛选正确
  And 不变式 "AuditActionsAdminOnly" 应成立

@REQ-019 @UAT-057 @BDD-L1-040 @high
Scenario: 非管理员查询审计日志被拒绝
  Given 系统处于 "user" 状态
  And 用户非管理员
  When 用户执行审计日志查询 (QueryAuditLog)
  Then 系统应保持在 "user" 状态
  And 系统返回 403 越权
  And 不变式 "AuditActionsAdminOnly" 应成立

@REQ-020 @UAT-058 @BDD-L1-041 @high
Scenario: 访客获取 RSS 订阅源成功
  Given 系统处于 "visitor" 状态
  And 存在已发布文章
  When 用户获取 RSS 订阅源 (GetRssFeed)
  Then 系统应保持在 "visitor" 状态
  And 系统返回合法可解析的 XML 数据
  And 不变式 "BrowseOkRequiresPublished" 应成立

@REQ-020 @UAT-059 @BDD-L1-042 @medium
Scenario: 无文章时获取 RSS 返回合法空源
  Given 系统处于 "visitor" 状态
  And 无已发布文章
  When 用户获取 RSS 订阅源 (GetRssFeed)
  Then 系统应保持在 "visitor" 状态
  And 系统返回 200 合法空源
  And 不变式 "TypeInvariant" 应成立

@REQ-021 @UAT-061 @BDD-L1-043 @high
Scenario: 博主创建 Webhook 并触发投递
  Given 系统处于 "blogger" 状态
  And 提供合法目标网址
  When 用户执行 Webhook 配置 (ManageWebhook)
  Then 系统应保持在 "blogger" 状态
  And 系统返回 201 且发布事件触发投递
  And 不变式 "TypeInvariant" 应成立

@REQ-021 @UAT-063 @BDD-L1-044 @medium
Scenario: 非法网址配置 Webhook 被拒绝
  Given 系统处于 "blogger" 状态
  And 提供非法目标网址
  When 用户执行 Webhook 配置 (ManageWebhook)
  Then 系统应保持在 "blogger" 状态
  And 系统返回 400 参数错误
  And 不变式 "TypeInvariant" 应成立

@REQ-022 @UAT-064 @BDD-L1-045 @high
Scenario: Webhook 投递失败触发自动重试
  Given 系统处于 "blogger" 状态
  And 上次投递失败且重试未超限
  When 用户执行 Webhook 重试 (RetryWebhook)
  Then 系统应保持在 "blogger" 状态
  And 系统自动重试并按指数退避
  And 不变式 "TypeInvariant" 应成立

@REQ-022 @UAT-065 @BDD-L1-046 @high
Scenario: Webhook 重试超限标记失败
  Given 系统处于 "blogger" 状态
  And 重试次数已超限
  When 用户执行 Webhook 重试 (RetryWebhook)
  Then 系统应保持在 "blogger" 状态
  And Webhook 标记为失败并停止重试
  And 不变式 "TypeInvariant" 应成立
