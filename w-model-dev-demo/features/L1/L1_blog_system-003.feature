# @req: REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, NFR-006, CON-001, CON-002, CON-003, CON-004
# @design: SD-005, SD-006
# @designIds: SD-005, SD-006
# @system: L1_blog_system
# @tla-spec: L1_BlogSystem
# @state-machine: SM-L1_BlogSystem
# @parent-features: (none)
# @sibling-features: L1_blog_system-001.feature, L1_blog_system-002.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L1
Feature: 博客系统统计通知、订阅集成与 NFR/CON 横切治理场景
  作为博客系统的读者、博主与运维人员
  我希望完成阅读统计、统计面板、通知、RSS 订阅、Webhook 集成并满足性能、安全、可靠性、限流与契约约束
  以便验证系统在统计通知、订阅集成域及横切治理上满足用户需求

Background:
  # @states: Ready, Processing, Completed, Failed, Degraded
  # @initial-state: Ready
  # @terminal-states: Completed, Failed
  # @accepting-states: Completed
  # @rejecting-states: Failed
  # @transitions:
  #   Ready + processRequest -> Processing [guard: requestAccepted] [action: dispatchToModule]
  #   Processing + completeRequest -> Completed [guard: success] [action: deliverResponse]
  #   Processing + failRequest -> Failed [guard: externalError] [action: recordFailure]
  #   Processing + rejectRequest -> Failed [guard: requestInvalid] [action: returnError]
  #   Processing + degrade -> Degraded [guard: overloadDetected] [action: enableFallback]
  #   Degraded + recover -> Ready [action: restoreService]
  # @invariants:
  #   Ready => systemAvailable
  #   Processing => requestInFlight
  #   Completed => responseDelivered
  #   Failed => errorRecorded
  #   Degraded => fallbackEnabled
  Given 系统处于初始状态

@REQ-024 @UAT-047 @BDD-L1-025 @medium
Scenario: 文章详情访问后阅读量加一
  Given 系统处于 "Ready" 状态
  And 读者访问已发布文章详情
  When 用户提交文章详情请求 (processRequest)
  And 系统完成阅读计数处理 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@REQ-024 @UAT-049 @BDD-L1-026 @medium
Scenario: 同 IP 短窗口内重复访问不重复计数
  Given 系统处于 "Processing" 状态
  And 同一 IP 在去重时间窗口内重复访问同一文章
  When 系统按去重规则处理重复阅读 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@REQ-025 @UAT-050 @BDD-L1-027 @low
Scenario: 博主统计面板返回文章数与阅读量等指标
  Given 系统处于 "Ready" 状态
  And 博主查看自己的统计面板数据
  When 用户提交统计面板请求 (processRequest)
  And 系统完成四项统计汇总 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@REQ-026 @UAT-052 @BDD-L1-028 @medium
Scenario: 互动事件产生通知并可标记已读
  Given 系统处于 "Ready" 状态
  And 用户存在被回复或点赞产生的未读通知
  When 用户提交查看通知列表请求 (processRequest)
  And 系统完成通知读取与已读标记处理 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@REQ-027 @UAT-055 @BDD-L1-029 @low
Scenario: RSS 源返回合法订阅 XML
  Given 系统处于 "Ready" 状态
  And 博主存在已发布的公开文章
  When 用户提交 RSS 订阅拉取请求 (processRequest)
  And 系统完成 RSS 源生成 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@REQ-028 @UAT-057 @BDD-L1-030 @low
Scenario: 文章发布触发 Webhook 回调并携带事件签名
  Given 系统处于 "Ready" 状态
  And 博主已配置 Webhook 且文章刚发布
  When 系统触发 Webhook 事件分发 (processRequest)
  And 系统完成签名回调投递 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@REQ-028 @NFR-003 @UAT-058 @BDD-L1-031 @low
Scenario: Webhook 回调失败触发系统降级保护
  Given 系统处于 "Processing" 状态
  And 外部回调目标连续不可达且重试耗尽
  When 系统触发降级保护 (degrade)
  Then 系统应转移到 "Degraded" 状态
  And 不变式 "Degraded => fallbackEnabled" 应成立

@NFR-003 @UAT-065 @BDD-L1-032 @medium
Scenario: 外部依赖恢复后系统回到就绪
  Given 系统处于 "Degraded" 状态
  And 外部回调目标恢复正常
  When 系统恢复服务 (recover)
  Then 系统应转移到 "Ready" 状态
  And 不变式 "Ready => systemAvailable" 应成立

@NFR-001 @UAT-060 @BDD-L1-033 @medium
Scenario: 常规 API 响应时间满足验收测试基线
  Given 系统处于 "Ready" 状态
  And 系统运行于验收测试环境
  When 用户提交常规 API 请求 (processRequest)
  And 系统完成响应处理 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@NFR-002 @UAT-062 @BDD-L1-034 @high
Scenario: 密码以 bcrypt 加盐哈希存储无明文
  Given 系统处于 "Ready" 状态
  And 用户提交注册密码且 JWT 密钥经环境变量注入
  When 系统处理注册请求 (processRequest)
  And 系统完成密码哈希存储 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@NFR-006 @UAT-068 @BDD-L1-035 @medium
Scenario: 认证接口限流超限返回 429
  Given 系统处于 "Processing" 状态
  And 同一 IP 认证请求超过每分钟限流阈值
  When 系统拒绝超限请求 (rejectRequest)
  Then 系统应转移到 "Failed" 状态
  And 不变式 "Failed => errorRecorded" 应成立

@CON-001 @UAT-070 @BDD-L1-036 @high
Scenario: 系统仅以内存存储运行无外部数据库
  Given 系统处于 "Ready" 状态
  And 系统启动完成进程内内存存储初始化
  When 用户提交业务请求 (processRequest)
  And 系统完成内存存储事务处理 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@CON-002 @UAT-071 @BDD-L1-037 @high
Scenario: 错误响应统一契约结构
  Given 系统处于 "Processing" 状态
  And 业务处理发生可预期错误
  When 系统按统一契约返回错误 (rejectRequest)
  Then 系统应转移到 "Failed" 状态
  And 不变式 "Failed => errorRecorded" 应成立

@CON-003 @UAT-072 @BDD-L1-038 @high
Scenario: JWT 令牌有效期不超过 24 小时
  Given 系统处于 "Processing" 状态
  And 请求令牌签发时间已超过二十四小时
  When 系统拒绝过期令牌访问 (rejectRequest)
  Then 系统应转移到 "Failed" 状态
  And 不变式 "Failed => errorRecorded" 应成立

@CON-004 @UAT-073 @BDD-L1-039 @medium
Scenario: 关键操作写入审计日志并保留
  Given 系统处于 "Ready" 状态
  And 用户执行登录或发布等关键操作
  When 用户提交关键操作请求 (processRequest)
  And 系统完成审计日志记录 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立
