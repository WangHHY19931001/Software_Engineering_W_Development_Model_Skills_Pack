# @req: REQ-017, REQ-018, REQ-019, REQ-020, REQ-021, REQ-022, REQ-023
# @design: SD-003, SD-004
# @designIds: SD-003, SD-004
# @system: L1_blog_system
# @tla-spec: L1_BlogSystem
# @state-machine: SM-L1_BlogSystem
# @parent-features: (none)
# @sibling-features: L1_blog_system-001.feature, L1_blog_system-003.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L1
Feature: 博客系统读者互动与发现推荐端到端场景
  作为博客系统的读者与注册用户
  我希望完成文章浏览、评论、点赞收藏、关注博主、热门文章、个性化推荐与全文搜索
  以便验证系统在读者互动与发现推荐域满足用户需求

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

@REQ-017 @UAT-030 @BDD-L1-015 @high
Scenario: 读者分页浏览已发布文章
  Given 系统处于 "Ready" 状态
  And 系统存在多篇已发布文章
  When 用户提交浏览文章列表请求 (processRequest)
  And 系统完成分页浏览处理 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@REQ-017 @UAT-032 @BDD-L1-016 @high
Scenario: 读者访问草稿文章返回不可见
  Given 系统处于 "Processing" 状态
  And 目标文章当前处于草稿状态
  When 系统拒绝不可见文章详情请求 (rejectRequest)
  Then 系统应转移到 "Failed" 状态
  And 不变式 "Failed => errorRecorded" 应成立

@REQ-018 @UAT-033 @BDD-L1-017 @high
Scenario: 注册用户发表评论后立即可见
  Given 系统处于 "Ready" 状态
  And 注册用户对已发布文章提交评论内容
  When 用户提交发表评论请求 (processRequest)
  And 系统完成评论发布处理 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@REQ-018 @UAT-035 @BDD-L1-018 @high
Scenario: 非文章作者删除评论被拒
  Given 系统处于 "Processing" 状态
  And 当前用户不是该文章作者
  When 系统拒绝越权删除评论请求 (rejectRequest)
  Then 系统应转移到 "Failed" 状态
  And 不变式 "Failed => errorRecorded" 应成立

@REQ-019 @UAT-036 @BDD-L1-019 @medium
Scenario: 注册用户点赞文章成功且计数加一
  Given 系统处于 "Ready" 状态
  And 注册用户对已发布文章执行点赞
  When 用户提交点赞请求 (processRequest)
  And 系统完成点赞计数处理 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@REQ-019 @UAT-037 @BDD-L1-020 @medium
Scenario: 重复点赞幂等不重复计数
  Given 系统处于 "Processing" 状态
  And 该用户已对该文章点赞且点赞关系已存在
  When 系统按幂等规则处理重复点赞 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@REQ-020 @UAT-039 @BDD-L1-021 @medium
Scenario: 关注博主后其新文章出现在 feed
  Given 系统处于 "Ready" 状态
  And 注册用户关注目标博主
  When 用户提交关注博主请求 (processRequest)
  And 系统完成关注关系建立处理 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@REQ-021 @UAT-041 @BDD-L1-022 @low
Scenario: 按最近 7 天阅读量返回热门文章 Top N
  Given 系统处于 "Ready" 状态
  And 系统存在近七天阅读统计数据
  When 用户提交热门文章列表请求 (processRequest)
  And 系统完成热门排序处理 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@REQ-022 @UAT-044 @BDD-L1-023 @low
Scenario: 无阅读历史读者推荐回退为热门文章
  Given 系统处于 "Processing" 状态
  And 当前读者无任何阅读历史
  When 系统执行冷启动推荐回退 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@REQ-023 @UAT-045 @BDD-L1-024 @low
Scenario: 关键词全文检索返回分页排序结果
  Given 系统处于 "Ready" 状态
  And 系统存在关键词命中的已发布文章
  When 用户提交全文搜索请求 (processRequest)
  And 系统完成相关性检索处理 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立
