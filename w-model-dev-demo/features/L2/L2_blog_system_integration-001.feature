# @req: REQ-027, REQ-028
# @design: SD-006
# @designIds: SD-006
# @system: L2_blog_system_integration
# @tla-spec: L2_BlogSystemIntegration
# @state-machine: SM-L2_BlogSystemIntegration
# @parent-features: L1_blog_system-003.feature
# @sibling-features: L2_blog_system_auth-001.feature, L2_blog_system_content-001.feature, L2_blog_system_interaction-001.feature, L2_blog_system_discovery-001.feature, L2_blog_system_analytics-001.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L2
Feature: 订阅集成子系统 Webhook 回调投递生命周期行为
  作为订阅集成子系统
  我希望完成 Webhook 回调触发、投递成功、失败与恢复的状态流转
  以便可靠地向博主分发文章与评论事件（RSS 源生成不改变回调投递状态）

Background:
  # @states: idle, delivering, failed
  # @initial-state: idle
  # @terminal-states: failed
  # @accepting-states: idle
  # @rejecting-states: failed
  # @transitions:
  #   idle + triggerWebhook -> delivering [guard: webhookConfigured] [action: signAndDispatch]
  #   delivering + deliverWebhook -> idle [action: resetRetries]
  #   delivering + failWebhook -> failed [guard: retriesExhausted] [action: recordFailure]
  #   failed + recoverWebhook -> idle [action: resetDelivery]
  # @invariants:
  #   delivering => webhookConfigured
  #   failed => failureRecorded
  Given 系统处于初始状态

@REQ-028 @ST-005 @BDD-L2-028 @high
Scenario: 文章发布触发已配置的 Webhook 回调进入投递中
  Given 系统处于 "idle" 状态
  And 博主已配置 Webhook 且文章刚发布
  When 子系统执行回调触发处理 (triggerWebhook)
  Then 系统应转移到 "delivering" 状态
  And 不变式 "delivering => webhookConfigured" 应成立

@REQ-028 @ST-024 @BDD-L2-029 @high
Scenario: Webhook 回调投递成功回到空闲态
  Given 系统处于 "delivering" 状态
  And 回调目标返回成功响应
  When 子系统执行投递成功处理 (deliverWebhook)
  Then 系统应转移到 "idle" 状态

@REQ-028 @ST-024 @BDD-L2-030 @high
Scenario: 重试耗尽后回调失败并留存失败记录
  Given 系统处于 "delivering" 状态
  And 回调目标连续不可达且重试已达三次上限
  When 子系统执行回调失败处理 (failWebhook)
  Then 系统应转移到 "failed" 状态
  And 不变式 "failed => failureRecorded" 应成立

@REQ-028 @ST-024 @BDD-L2-031 @medium
Scenario: 回调失败后恢复投递能力
  Given 系统处于 "failed" 状态
  And 外部回调目标恢复可达
  When 子系统执行回调恢复处理 (recoverWebhook)
  Then 系统应转移到 "idle" 状态

@REQ-028 @ST-024 @BDD-L2-032 @medium
Scenario: Webhook 触发到投递成功的完整生命周期
  Given 系统处于 "idle" 状态
  When 子系统执行回调触发处理 (triggerWebhook)
  And 子系统执行投递成功处理 (deliverWebhook)
  Then 系统应转移到 "idle" 状态

@REQ-027 @ST-023 @BDD-L2-033 @low
Scenario: RSS 源生成不改变回调投递状态
  Given 系统处于 "idle" 状态
  And 博主存在已发布的公开文章
  When 子系统执行 RSS 源生成处理
  Then 系统应保持在 "idle" 状态
