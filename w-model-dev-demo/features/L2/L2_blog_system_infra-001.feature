# @req: NFR-005, NFR-006, CON-002, CON-003, REQ-016, REQ-017, REQ-021
# @design: docs/phase2-design/blog-system-system-design.md:§3
# @designIds: SD-018,SD-019,SD-020,SD-021
# @system: L2_blog_system_infra
# @tla-spec: L2_BlogSystemInfra
# @state-machine: SM-L2_BlogSystemInfra
# @parent-features: L1/L1_blog_system-002.feature, L1/L1_blog_system-003.feature
# @sibling-features: L2/L2_blog_system_auth-001.feature, L2/L2_blog_system_content-001.feature, L2/L2_blog_system_engagement-001.feature, L2/L2_blog_system_discovery-001.feature, L2/L2_blog_system_ops-001.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L2
Feature: 博客系统基础设施子系统（M-018 限流中间件 / M-019 入参校验中间件 / M-020 内存数据访问层 / M-021 进程内事件总线）
  作为博客系统的基础设施子系统
  我希望完成限流计数、入参校验、内存存储处理与事件发布消费的状态流转
  以便验证基础设施域（NFR-005/NFR-006/CON-002/CON-003/REQ-016/REQ-017/REQ-021）满足系统设计

Background:
  # @states: none, post_published, comment_created, follow_created
  # @initial-state: none
  # @terminal-states: ()
  # @accepting-states: post_published, comment_created, follow_created
  # @rejecting-states: none
  # @transitions:
  #   none + requestArrive -> none [guard: withinRateLimit] [action: incrementCounter]
  #   none + rateLimitHit -> none [guard: rateLimitExceeded] [action: respond429]
  #   none + validateRequest -> none [action: zodValidate]
  #   none + processValid -> none [guard: validationValid] [action: accessMemoryStore]
  #   none + publishPostEvent -> post_published [action: publishToBus]
  #   none + publishCommentEvent -> comment_created [action: publishToBus]
  #   none + publishFollowEvent -> follow_created [action: publishToBus]
  #   post_published + consumeEvent -> none [action: deliverToConsumers]
  #   comment_created + consumeEvent -> none [action: deliverToConsumers]
  #   follow_created + consumeEvent -> none [action: deliverToConsumers]
  # @invariants:
  #   TypeInvariant
  #   limited => reqCount = rateLimitMax
  #   processed => validation = valid
  #   busPending = TRUE <=> busEvent \in events
  #   eventConsumed => busPending = FALSE /\ busEvent = none
  Given 系统处于初始状态

@NFR-006 @ST-009 @BDD-L2-033 @high
Scenario: 单 IP 阈值内请求放行且窗口计数加一
  Given 系统处于 "none" 状态
  And 单 IP 请求未达每分钟上限
  When 系统受理新请求 (requestArrive)
  Then 系统应保持在 "none" 状态
  And 窗口请求计数加一且请求放行
  And 不变式 "limited => reqCount = rateLimitMax" 应成立

@NFR-006 @ST-009 @BDD-L2-034 @high
Scenario: 单 IP 请求超限返回 429 与 Retry-After
  Given 系统处于 "none" 状态
  And 单 IP 请求达到每分钟上限
  When 系统触发限流 (rateLimitHit)
  Then 系统应保持在 "none" 状态
  And 系统返回 429 与 Retry-After 头
  And 不变式 "limited => reqCount = rateLimitMax" 应成立

@CON-003 @ST-003 @BDD-L2-035 @high
Scenario: 请求入参经 zod schema 校验判定合法或非法
  Given 系统处于 "none" 状态
  And 请求携带待校验入参
  When 系统执行入参校验 (validateRequest)
  Then 系统应保持在 "none" 状态
  And 非法入参返回 400 结构化错误
  And 不变式 "processed => validation = valid" 应成立

@CON-002 @NFR-005 @ST-013 @BDD-L2-036 @medium
Scenario: 校验通过后经内存数据访问层处理请求
  Given 系统处于 "none" 状态
  And 请求入参校验通过
  When 系统执行存储处理 (processValid)
  Then 系统应保持在 "none" 状态
  And 数据经进程内存 Map 或数组仓储读写
  And 不变式 "processed => validation = valid" 应成立

@REQ-021 @ST-008 @BDD-L2-037 @high
Scenario: 文章发布事件发布到事件总线
  Given 系统处于 "none" 状态
  And 事件总线空闲
  When 服务发布文章发布事件 (publishPostEvent)
  Then 系统应转移到 "post_published" 状态
  And 事件总线持有待投递文章事件
  And 不变式 "busPending = TRUE <=> busEvent \in events" 应成立

@REQ-016 @ST-006 @BDD-L2-038 @high
Scenario: 评论事件发布到事件总线
  Given 系统处于 "none" 状态
  And 事件总线空闲
  When 服务发布评论事件 (publishCommentEvent)
  Then 系统应转移到 "comment_created" 状态
  And 事件总线持有待投递评论事件
  And 不变式 "busPending = TRUE <=> busEvent \in events" 应成立

@REQ-017 @ST-006 @BDD-L2-039 @high
Scenario: 关注事件发布到事件总线
  Given 系统处于 "none" 状态
  And 事件总线空闲
  When 服务发布关注事件 (publishFollowEvent)
  Then 系统应转移到 "follow_created" 状态
  And 事件总线持有待投递关注事件
  And 不变式 "busPending = TRUE <=> busEvent \in events" 应成立

@REQ-016 @REQ-017 @REQ-021 @ST-001 @BDD-L2-040 @high
Scenario: 事件投递给消费者后总线复位
  Given 系统处于 "post_published" 状态
  And 事件总线持有待投递事件
  When 系统执行事件投递 (consumeEvent)
  Then 系统应转移到 "none" 状态
  And 事件被消费且总线复位
  And 不变式 "eventConsumed => busPending = FALSE /\ busEvent = none" 应成立
