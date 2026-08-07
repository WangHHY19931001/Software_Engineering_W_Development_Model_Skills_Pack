# @req: REQ-016, REQ-018, REQ-019, REQ-021, REQ-022, CON-004
# @design: docs/phase2-design/blog-system-system-design.md:§3
# @designIds: SD-012,SD-014,SD-016
# @system: L2_blog_system_ops
# @tla-spec: L2_BlogSystemOps
# @state-machine: SM-L2_BlogSystemOps
# @parent-features: L1/L1_blog_system-003.feature
# @sibling-features: L2/L2_blog_system_auth-001.feature, L2/L2_blog_system_content-001.feature, L2/L2_blog_system_engagement-001.feature, L2/L2_blog_system_discovery-001.feature, L2/L2_blog_system_infra-001.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L2
Feature: 博客系统运维子系统（M-012 通知服务 / M-014 审计日志服务 / M-016 Webhook 服务）
  作为博客系统的运维子系统
  我希望完成通知入列与已读、审计记录与保留期清理、Webhook 投递与失败重试的状态流转
  以便验证运维域（REQ-016/REQ-018/REQ-019/REQ-021/REQ-022/CON-004）满足系统设计

Background:
  # @states: idle, pending, success, failed
  # @initial-state: idle
  # @terminal-states: ()
  # @accepting-states: success
  # @rejecting-states: failed
  # @transitions:
  #   idle + webhookEnqueue -> pending [guard: postPublishedEvent] [action: postDelivery]
  #   pending + webhookDeliverySuccess -> success [action: resetRetries]
  #   pending + webhookDeliveryFail -> pending [guard: retriesBelowMax] [action: incrementRetries]
  #   pending + webhookGiveUp -> failed [guard: retriesAtMax] [action: markFailed]
  #   success + webhookReset -> idle [action: resetDelivery]
  #   failed + webhookReset -> idle [action: resetDelivery]
  #   pending + enqueueNotification -> pending [action: enqueueNotification]
  #   pending + markNotificationRead -> pending [guard: notifyPending] [action: markRead]
  #   idle + changeWebhookConfig -> idle [action: recordAudit]
  #   pending + recordAudit -> pending [action: recordAudit]
  #   pending + advanceAuditAge -> pending [guard: auditAgeBelowRetention] [action: incrementAuditAge]
  #   failed + purgeExpiredAudit -> failed [guard: auditAgeAtRetention] [action: purgeExpired]
  # @invariants:
  #   TypeInvariant
  #   webhookConfigChanged => auditRecorded
  #   auditAge <= retentionDays
  #   retries <= maxRetries
  #   webhookState = failed => retries = maxRetries
  #   webhookState = success => retries = 0
  Given 系统处于初始状态

@REQ-021 @ST-008 @BDD-L2-025 @high
Scenario: 文章发布事件触发 Webhook 投递入队
  Given 系统处于 "idle" 状态
  And 文章发布事件到达且投递空闲
  When 服务执行 Webhook 入队 (webhookEnqueue)
  Then 系统应转移到 "pending" 状态
  And Webhook 开始投递
  And 不变式 "TypeInvariant" 应成立

@REQ-022 @ST-008 @BDD-L2-026 @high
Scenario: Webhook 投递成功且重试计数归零
  Given 系统处于 "pending" 状态
  And Webhook 投递中
  When 服务收到投递成功 (webhookDeliverySuccess)
  Then 系统应转移到 "success" 状态
  And 重试计数归零且不触发重试
  And 不变式 "webhookState = success => retries = 0" 应成立

@REQ-022 @ST-008 @BDD-L2-027 @high
Scenario: Webhook 投递失败自动重试且不超限
  Given 系统处于 "pending" 状态
  And 投递失败且重试次数未达上限
  When 服务收到投递失败 (webhookDeliveryFail)
  Then 系统应保持在 "pending" 状态
  And 重试次数加一并按指数退避
  And 不变式 "retries <= maxRetries" 应成立

@REQ-022 @ST-008 @BDD-L2-028 @high
Scenario: Webhook 重试超限标记失败停止重试
  Given 系统处于 "pending" 状态
  And 重试次数已达上限仍失败
  When 服务执行放弃投递 (webhookGiveUp)
  Then 系统应转移到 "failed" 状态
  And Webhook 标记为失败并停止重试
  And 不变式 "webhookState = failed => retries = maxRetries" 应成立

@REQ-021 @ST-008 @BDD-L2-029 @medium
Scenario: Webhook 投递生命周期复位等待下一事件
  Given 系统处于 "success" 状态
  And 投递结果已返回
  When 服务执行投递复位 (webhookReset)
  Then 系统应转移到 "idle" 状态
  And 投递状态复位
  And 不变式 "TypeInvariant" 应成立

@REQ-016 @ST-006 @BDD-L2-030 @high
Scenario: 评论或关注事件生成通知入列可查
  Given 系统处于 "pending" 状态
  And 评论或关注事件已发布
  When 服务执行通知入列 (enqueueNotification)
  Then 系统应保持在 "pending" 状态
  And 通知入列且用户可查
  And 不变式 "TypeInvariant" 应成立

@REQ-018 @ST-007 @BDD-L2-031 @high
Scenario: Webhook 配置变更自动记录审计日志
  Given 系统处于 "idle" 状态
  And Webhook 配置发生变更
  When 服务执行配置变更 (changeWebhookConfig)
  Then 系统应保持在 "idle" 状态
  And 审计日志新增完整记录
  And 不变式 "webhookConfigChanged => auditRecorded" 应成立

@CON-004 @ST-007 @BDD-L2-032 @medium
Scenario: 审计日志达到保留期被清理
  Given 系统处于 "failed" 状态
  And 最旧审计记录达到保留期
  When 服务执行过期清理 (purgeExpiredAudit)
  Then 系统应保持在 "failed" 状态
  And 超期审计记录被清理
  And 不变式 "auditAge <= retentionDays" 应成立
