# @req: REQ-028, NFR-003
# @design: SD-006
# @designIds: SD-006
# @system: L3_blog_system_webhook_retry
# @tla-spec: L3_BlogSystemWebhookRetry
# @state-machine: SM-L3_BlogSystemWebhookRetry
# @parent-features: L2_blog_system_integration-001.feature
# @sibling-features: L3_blog_system_article_state-001.feature, L3_blog_system_auth_flow-001.feature, L3_blog_system_comment_flow-001.feature, L3_blog_system_rate_limit-001.feature, L3_blog_system_webhook_retry-001.feature, L3_blog_system_reading_dedup-001.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L3
Feature: Webhook 回调重试原子行为（投递/成功/重试耗尽/再触发）
  作为订阅集成模块的 Webhook 重试器
  我希望完成回调投递 idle→delivering→succeeded/failed 的原子状态流转（HMAC 验签、失败重试不超过三次、失败记录落盘）
  以便可靠地向博主分发事件并与 L3 TLA+ 规格等价（REQ-028/NFR-003/INTF-022）

Background:
  # @states: idle, delivering, succeeded, failed
  # @initial-state: idle
  # @terminal-states: failed
  # @accepting-states: succeeded
  # @rejecting-states: failed
  # @transitions:
  #   idle + dispatchWebhook -> delivering [guard: webhookConfigured] [action: signAndDispatch]
  #   succeeded + dispatchWebhook -> delivering [guard: webhookConfigured] [action: signAndDispatch]
  #   failed + dispatchWebhook -> delivering [guard: webhookConfigured] [action: signAndDispatch]
  #   delivering + deliverSucceed -> succeeded [action: recordSuccess]
  #   delivering + giveUpDelivery -> failed [guard: attempts = MaxRetries] [action: recordFailure]
  # @invariants:
  #   failed => failureRecorded
  #   failed => attempts = MaxRetries
  Given 系统处于初始状态

@REQ-028 @IT-006 @BDD-L3-023 @high
Scenario: 事件触发回调投递进入投递中
  Given 系统处于 "idle" 状态
  And 博主已配置 Webhook 且发布或评论事件产生
  When 模块执行回调触发处理 (dispatchWebhook)
  Then 系统应转移到 "delivering" 状态

@REQ-028 @IT-006 @BDD-L3-024 @high
Scenario: 回调验签通过投递成功
  Given 系统处于 "delivering" 状态
  And 回调目标返回成功且 HMAC 签名校验通过
  When 模块执行投递成功处理 (deliverSucceed)
  Then 系统应转移到 "succeeded" 状态

@REQ-028 @NFR-003 @IT-007 @BDD-L3-025 @high
Scenario: 重试耗尽后回调失败并留存失败记录
  Given 系统处于 "delivering" 状态
  And 回调目标连续不可达且重试已达三次上限
  When 模块执行放弃投递处理 (giveUpDelivery)
  Then 系统应转移到 "failed" 状态
  And 不变式 "failed => failureRecorded" 应成立

@REQ-028 @NFR-003 @IT-007 @BDD-L3-026 @medium
Scenario: 重试次数未达上限回调失败保持投递中
  Given 系统处于 "delivering" 状态
  And 回调目标暂不可达且重试次数未达上限
  When 模块按指数退避调度下次重试
  Then 系统应保持在 "delivering" 状态

@REQ-028 @IT-007 @BDD-L3-027 @medium
Scenario: 失败后新事件再次触发投递
  Given 系统处于 "failed" 状态
  And 新的发布或评论事件产生
  When 模块执行回调触发处理 (dispatchWebhook)
  Then 系统应转移到 "delivering" 状态

@REQ-028 @IT-006 @BDD-L3-028 @low
Scenario: 触发到投递成功的完整回调生命周期
  Given 系统处于 "idle" 状态
  When 模块执行回调触发处理 (dispatchWebhook)
  And 模块执行投递成功处理 (deliverSucceed)
  Then 系统应转移到 "succeeded" 状态
