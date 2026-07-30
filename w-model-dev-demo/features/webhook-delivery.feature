# @req: REQ-015
# @system: L4_webhook_delivery
# @tla-spec: L4-WebhookDelivery
# @state-machine: SM-L4-webhook_delivery
# @parent-features: ../../features/article-state-transitions.feature
# @sibling-features: (none)
# @child-features: (none)
# @scenario-id-prefix: BDD-L4
# 所属系统: blog-system-demo
# 关联需求: docs/phase1-requirements/requirement-spec.md (REQ-015)
# 层级: L4 (原子子行为)
# 上级 BDD: features/article-state-transitions.feature
# 同级 BDD: 无
# 下级 BDD: 无
# RTM 映射: requirementId=REQ-015
# TLA+ 等价: tla/specs/level4/L4-WebhookDelivery.tla
Feature: Webhook 投递 L4 原子子行为
  作为 Webhook 投递引擎
  我希望按指数退避重试最多 3 次
  以便在外部订阅方暂时不可用时保证最终一致

Background:
  # @states: PENDING, INFLIGHT, DELIVERED, RETRY, FAILED
  # @initial-state: PENDING
  # @terminal-states: DELIVERED, FAILED
  # @accepting-states: DELIVERED
  # @rejecting-states: FAILED
  # @transitions:
  #   PENDING + Enqueue -> PENDING [action: push]
  #   PENDING + StartProcess -> INFLIGHT [action: incrementAttempts]
  #   INFLIGHT + Success -> DELIVERED [action: markDelivered]
  #   INFLIGHT + Retry -> RETRY [guard: attempts<3] [action: markRetry]
  #   INFLIGHT + Fail -> FAILED [guard: attempts>=3] [action: markFailed]
  #   RETRY + RetryToInflight -> INFLIGHT [action: resume]
  #   DELIVERED + Reset -> PENDING [action: reset]
  #   FAILED + Reset -> PENDING [action: reset]
  # @invariants:
  #   TypeInvariant: deliveryState ∈ DeliveryStates
  #   AttemptBound: attempts ≤ MaxAttempts (3)
  #   FinalConsistency: deliveryState = DELIVERED => delivered = TRUE
  #   FailSafety: deliveryState = FAILED => attempts >= MaxAttempts
  Given Webhook 投递引擎已实例化
  And MaxAttempts 等于 3
  And deliveryState 处于初始 "PENDING"
  And attempts 等于 0

@REQ-015 @UAT-018 @BDD-L4-001 @high
Scenario: PENDING 状态入队事件
  Given 投递引擎处于 "PENDING" 状态
  And queue 为空
  When 系统执行 Enqueue("e1")
  Then 投递引擎应保持在 "PENDING" 状态
  And queue 应包含 "e1"
  And 不变式 "TypeInvariant: deliveryState ∈ DeliveryStates" 应成立

@REQ-015 @UAT-019 @BDD-L4-002 @high
Scenario: PENDING 状态开始处理
  Given 投递引擎处于 "PENDING" 状态
  And queue 包含 "e1"
  When 系统执行 StartProcess
  Then 投递引擎应转移到 "INFLIGHT" 状态
  And attempts 应等于 1
  And 不变式 "AttemptBound: attempts ≤ MaxAttempts (3)" 应成立

@REQ-015 @UAT-020 @BDD-L4-003 @high
Scenario: INFLIGHT 状态 2xx 成功
  Given 投递引擎处于 "INFLIGHT" 状态
  And attempts 等于 1
  When 外部返回 200 (Success)
  Then 投递引擎应转移到 "DELIVERED" 状态
  And lastStatus 应等于 200
  And delivered 应等于 TRUE
  And 不变式 "FinalConsistency: deliveryState = DELIVERED => delivered = TRUE" 应成立

@REQ-015 @UAT-021 @BDD-L4-004 @high
Scenario: INFLIGHT 状态 5xx 重试
  Given 投递引擎处于 "INFLIGHT" 状态
  And attempts 等于 1
  And lastStatus 等于 500
  When 系统执行 Retry
  Then 投递引擎应转移到 "RETRY" 状态
  And attempts 应保持 1
  And 不变式 "AttemptBound: attempts ≤ MaxAttempts (3)" 应成立

@REQ-015 @UAT-022 @BDD-L4-005 @high
Scenario: INFLIGHT 状态第 3 次失败进入 FAILED
  Given 投递引擎处于 "INFLIGHT" 状态
  And attempts 等于 3
  And lastStatus 等于 500
  When 系统执行 Fail
  Then 投递引擎应转移到 "FAILED" 状态
  And 不变式 "FailSafety: deliveryState = FAILED => attempts >= MaxAttempts" 应成立
  And 不变式 "AttemptBound: attempts ≤ MaxAttempts (3)" 应成立

@REQ-015 @UAT-023 @BDD-L4-006 @high
Scenario: RETRY 状态回到 INFLIGHT
  Given 投递引擎处于 "RETRY" 状态
  And attempts 等于 1
  When 系统执行 RetryToInflight
  Then 投递引擎应转移到 "INFLIGHT" 状态
  And attempts 应保持 1
  And 不变式 "TypeInvariant: deliveryState ∈ DeliveryStates" 应成立

@REQ-015 @UAT-024 @BDD-L4-007 @high
Scenario: DELIVERED 终态可重置
  Given 投递引擎处于 "DELIVERED" 状态
  And delivered 等于 TRUE
  When 系统执行 Reset
  Then 投递引擎应转移到 "PENDING" 状态
  And attempts 应等于 0
  And lastStatus 应等于 0
  And delivered 应等于 FALSE
  And 不变式 "TypeInvariant: deliveryState ∈ DeliveryStates" 应成立

@REQ-015 @UAT-025 @BDD-L4-008 @high
Scenario: FAILED 终态可重置
  Given 投递引擎处于 "FAILED" 状态
  And attempts 等于 3
  When 系统执行 Reset
  Then 投递引擎应转移到 "PENDING" 状态
  And attempts 应等于 0
  And lastStatus 应等于 0
  And 不变式 "TypeInvariant: deliveryState ∈ DeliveryStates" 应成立

@REQ-015 @UAT-026 @BDD-L4-009 @medium
Scenario: 端到端 happy path PENDING→INFLIGHT→DELIVERED
  Given 投递引擎处于 "PENDING" 状态
  And queue 包含 "e1"
  When 系统执行 StartProcess
  And 外部返回 201 (Success)
  Then 投递引擎应处于 "DELIVERED" 状态
  And delivered 应等于 TRUE
  And 不变式 "FinalConsistency: deliveryState = DELIVERED => delivered = TRUE" 应成立

@REQ-015 @UAT-027 @BDD-L4-010 @medium
Scenario: 端到端 retry 上限 PENDING→INFLIGHT→RETRY→INFLIGHT→RETRY→INFLIGHT→FAILED
  Given 投递引擎处于 "PENDING" 状态
  And queue 包含 "e1"
  When 系统执行 StartProcess (attempts=1)
  And 外部返回 500 (Retry)
  And RetryToInflight (attempts=1)
  And 外部返回 500 (Retry)
  And RetryToInflight (attempts=1)
  And 外部返回 500 (Retry)
  And RetryToInflight (attempts=1)
  And 外部返回 500 (Fail)
  Then 投递引擎应处于 "FAILED" 状态
  And attempts 应等于 3
  And 不变式 "FailSafety: deliveryState = FAILED => attempts >= MaxAttempts" 应成立
