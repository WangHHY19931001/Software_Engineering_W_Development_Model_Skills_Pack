# @req: REQ-001,REQ-006
# @system: L1_blog_system
# @tla-spec: L1-BlogSystem
# @state-machine: SM-L1-blog_system
# @parent-features: (none)
# @sibling-features: (none)
# @child-features: authentication.feature
# @scenario-id-prefix: BDD-L1
# 所属系统: blog-system-demo
# 关联需求: docs/phase1-requirements/requirement-spec.md (REQ-001, REQ-006)
# 层级: L1 (系统内外交互)
# 上级 BDD: 无 (L1 为根)
# 同级 BDD: 无
# 下级 BDD: features/authentication.feature
# RTM 映射: requirementId=REQ-001
# TLA+ 等价: tla/specs/level1/L1-BlogSystem.tla
Feature: 博客系统后端 L1 系统交互
  作为系统编排者
  我希望系统在 INIT/RUNNING/SHUTDOWN 三个状态间正确转移
  以便正确处理外部 HTTP 请求并输出响应

Background:
  # @states: INIT, RUNNING, SHUTDOWN
  # @initial-state: INIT
  # @terminal-states: SHUTDOWN
  # @accepting-states: RUNNING
  # @rejecting-states: SHUTDOWN
  # @transitions:
  #   INIT + StartSystem -> RUNNING [action: enterRunning]
  #   RUNNING + ReceiveRequest -> RUNNING [action: enqueueRequest]
  #   RUNNING + ProcessRequest -> RUNNING [action: processAndStoreResponse]
  #   RUNNING + SendResponse -> RUNNING [action: emitResponse]
  #   RUNNING + ShutdownSystem -> SHUTDOWN [action: enterShutdown]
  #   SHUTDOWN + ReceiveRequest -> SHUTDOWN [guard: isShutdown] [action: rejectRequest]
  # @invariants:
  #   TypeInvariant: systemState ∈ {INIT, RUNNING, SHUTDOWN}
  #   InitInvariant: systemState = INIT => pendingRequests = {}
  #   ShutdownInvariant: systemState = SHUTDOWN => pendingRequests = {}
  Given 系统处于初始状态

@REQ-001 @UAT-001 @BDD-L1-001 @high
Scenario: 系统从 INIT 启动进入 RUNNING
  Given 系统处于 "INIT" 状态
  And pendingRequests 为空集
  And processedResponses 为空集
  When 外部触发系统启动 (StartSystem)
  Then 系统应转移到 "RUNNING" 状态
  And 不变式 "TypeInvariant: systemState ∈ {INIT, RUNNING, SHUTDOWN}" 应成立
  And 不变式 "InitInvariant: systemState = INIT => pendingRequests = {}" 应成立

@REQ-001 @UAT-002 @BDD-L1-002 @high
Scenario: RUNNING 状态接收外部 HTTP 请求并处理
  Given 系统处于 "RUNNING" 状态
  And pendingRequests 为空集
  When 外部 blogger 角色发起 HTTP 请求 ReceiveRequest
  Then 系统应保持在 "RUNNING" 状态
  And pendingRequests 应包含该请求
  When 系统执行 ProcessRequest 处理该请求
  Then 系统应保持在 "RUNNING" 状态
  And pendingRequests 应移除该请求
  And processedResponses 应包含对应响应
  And 不变式 "TypeInvariant: systemState ∈ {INIT, RUNNING, SHUTDOWN}" 应成立

@REQ-001 @UAT-002 @BDD-L1-003 @high
Scenario: RUNNING 状态向外部发送响应 HTTP/RSS/Webhook
  Given 系统处于 "RUNNING" 状态
  And processedResponses 包含一个待发送响应
  When 系统输出响应 (SendResponse)
  Then 系统应保持在 "RUNNING" 状态
  And 外部应通过 HTTP 响应收到处理结果
  And 外部应通过 RSS 订阅收到博文更新
  And 外部应通过 Webhook 推送收到事件通知
  And 不变式 "TypeInvariant: systemState ∈ {INIT, RUNNING, SHUTDOWN}" 应成立

@REQ-001 @UAT-003 @BDD-L1-004 @high
Scenario: 系统从 RUNNING 关闭进入 SHUTDOWN
  Given 系统处于 "RUNNING" 状态
  And pendingRequests 为空集
  When 外部触发系统关闭 (ShutdownSystem)
  Then 系统应转移到 "SHUTDOWN" 状态
  And 不变式 "TypeInvariant: systemState ∈ {INIT, RUNNING, SHUTDOWN}" 应成立
  And 不变式 "ShutdownInvariant: systemState = SHUTDOWN => pendingRequests = {}" 应成立

@REQ-001 @UAT-003 @BDD-L1-005 @high
Scenario: SHUTDOWN 状态拒绝接收新请求
  Given 系统处于 "SHUTDOWN" 状态
  And pendingRequests 为空集
  When 外部 reader 角色发起 HTTP 请求 (ReceiveRequest)
  Then 系统应保持在 "SHUTDOWN" 状态
  And 系统应拒绝该请求
  And pendingRequests 应保持为空集
  And 不变式 "ShutdownInvariant: systemState = SHUTDOWN => pendingRequests = {}" 应成立
