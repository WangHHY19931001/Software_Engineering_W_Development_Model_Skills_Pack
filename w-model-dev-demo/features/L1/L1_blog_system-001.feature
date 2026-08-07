# @req: REQ-007, REQ-008, REQ-009, REQ-010, REQ-011, REQ-012, REQ-013, REQ-014, REQ-015, REQ-016
# @design: SD-001, SD-002
# @designIds: SD-001, SD-002
# @system: L1_blog_system
# @tla-spec: L1_BlogSystem
# @state-machine: SM-L1_BlogSystem
# @parent-features: (none)
# @sibling-features: L1_blog_system-002.feature, L1_blog_system-003.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L1
Feature: 博客系统身份与内容发布端到端场景
  作为博客系统的最终用户
  我希望完成注册、登录、博主认证、资料管理、文章创建与发布、文章管理、标签与分类维护
  以便验证系统在身份与内容发布域满足用户需求

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

@REQ-007 @UAT-001 @BDD-L1-001 @high
Scenario: 读者注册新账号成功
  Given 系统处于 "Ready" 状态
  And 用户提供唯一邮箱、用户名与密码
  When 用户提交注册请求 (processRequest)
  And 系统完成注册处理 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@REQ-007 @UAT-002 @BDD-L1-002 @high
Scenario: 重复邮箱注册被拒
  Given 系统处于 "Processing" 状态
  And 系统已存在同邮箱账户
  When 系统拒绝重复邮箱注册请求 (rejectRequest)
  Then 系统应转移到 "Failed" 状态
  And 不变式 "Failed => errorRecorded" 应成立

@REQ-008 @UAT-004 @BDD-L1-003 @high
Scenario: 用户凭用户名密码登录成功并签发 JWT
  Given 系统处于 "Ready" 状态
  And 用户凭据有效且账户已注册
  When 用户提交登录请求 (processRequest)
  And 系统完成登录签发处理 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@REQ-008 @UAT-005 @BDD-L1-004 @high
Scenario: 凭据错误登录失败
  Given 系统处于 "Processing" 状态
  And 用户提交的密码不正确
  When 系统拒绝无效凭据登录请求 (rejectRequest)
  Then 系统应转移到 "Failed" 状态
  And 不变式 "Failed => errorRecorded" 应成立

@REQ-008 @UAT-006 @BDD-L1-005 @high
Scenario: token 过期后访问受保护资源被拒
  Given 系统处于 "Processing" 状态
  And 请求携带的 JWT 已超过有效期
  When 系统拒绝过期令牌请求 (rejectRequest)
  Then 系统应转移到 "Failed" 状态
  And 不变式 "Failed => errorRecorded" 应成立

@REQ-009 @UAT-007 @BDD-L1-006 @high
Scenario: 注册用户申请成为博主获得发布权限
  Given 系统处于 "Ready" 状态
  And 已登录用户提交博主认证申请
  When 用户提交博主认证请求 (processRequest)
  And 系统完成角色变更处理 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@REQ-009 @UAT-008 @BDD-L1-007 @high
Scenario: 普通读者尝试发布文章被拒
  Given 系统处于 "Processing" 状态
  And 当前用户角色为普通读者无发布权限
  When 系统拒绝无发布权限请求 (rejectRequest)
  Then 系统应转移到 "Failed" 状态
  And 不变式 "Failed => errorRecorded" 应成立

@REQ-010 @UAT-011 @BDD-L1-008 @medium
Scenario: 修改密码时原密码错误被拒
  Given 系统处于 "Processing" 状态
  And 用户提交的原密码不正确
  When 系统拒绝错误原密码请求 (rejectRequest)
  Then 系统应转移到 "Failed" 状态
  And 不变式 "Failed => errorRecorded" 应成立

@REQ-011 @UAT-013 @BDD-L1-009 @high
Scenario: 博主创建文章成功进入草稿状态
  Given 系统处于 "Ready" 状态
  And 博主提供标题、正文、摘要、标签与分类
  When 用户提交创建文章请求 (processRequest)
  And 系统完成草稿创建处理 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@REQ-012 @UAT-015 @BDD-L1-010 @high
Scenario: 发布草稿文章对读者可见
  Given 系统处于 "Ready" 状态
  And 博主存在待发布的草稿文章
  When 用户提交发布文章请求 (processRequest)
  And 系统完成发布处理 (completeRequest)
  Then 系统应转移到 "Completed" 状态
  And 不变式 "Completed => responseDelivered" 应成立

@REQ-013 @UAT-020 @BDD-L1-011 @medium
Scenario: 已归档文章不可直接再发布
  Given 系统处于 "Processing" 状态
  And 文章当前处于 archived 状态
  When 系统拒绝非法状态迁移请求 (rejectRequest)
  Then 系统应转移到 "Failed" 状态
  And 不变式 "Failed => errorRecorded" 应成立

@REQ-014 @UAT-024 @BDD-L1-012 @medium
Scenario: 删除已发布文章被拒仅可归档
  Given 系统处于 "Processing" 状态
  And 目标文章当前处于 published 状态
  When 系统拒绝删除已发布文章请求 (rejectRequest)
  Then 系统应转移到 "Failed" 状态
  And 不变式 "Failed => errorRecorded" 应成立

@REQ-015 @UAT-026 @BDD-L1-013 @medium
Scenario: 创建重名标签被拒
  Given 系统处于 "Processing" 状态
  And 系统已存在同名标签
  When 系统拒绝重复标签创建请求 (rejectRequest)
  Then 系统应转移到 "Failed" 状态
  And 不变式 "Failed => errorRecorded" 应成立

@REQ-016 @UAT-028 @BDD-L1-014 @medium
Scenario: 分类嵌套深度超过 3 层被拒
  Given 系统处于 "Processing" 状态
  And 分类嵌套深度超过三层上限
  When 系统拒绝超深嵌套分类请求 (rejectRequest)
  Then 系统应转移到 "Failed" 状态
  And 不变式 "Failed => errorRecorded" 应成立
