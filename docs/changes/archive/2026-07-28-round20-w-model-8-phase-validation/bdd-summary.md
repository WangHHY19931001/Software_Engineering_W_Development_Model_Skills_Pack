# BDD feature 清单 — 第二十轮 W 模型 8 阶段调测

> 本文件汇总 W 模型 8 阶段调测中产出的 BDD features（L1/L2/L3/L4）。
> 共 8 个 features，31 scenarios，8 个状态机，与 TLA+ specs 一一对应。

## BDD features 清单

### L1 系统级（1 feature，6 scenarios）

| feature ID | level | filePath | scenarioCount | stateMachineId | tlaSpecId | reqIds | designIds |
|---|---|---|---|---|---|---|---|
| L1_blog_system-001 | L1 | L1-system.feature | 6 | SM-L1_system | L1_system | REQ-001~008 | SD-000 |

**状态机 SM-L1_system**：
- 状态：Unauthenticated / Authenticated / LoggedOut
- 初始状态：Unauthenticated
- 接受状态：Authenticated
- 拒绝状态：Unauthenticated
- 转移：register / login / publish / comment / logout / restartSession
- 不变式：Authenticated => requestCount >= 1；LoggedOut => requestCount >= 1

### L2 子系统级（3 features，11 scenarios）

| feature ID | level | filePath | scenarioCount | stateMachineId | tlaSpecId | reqIds | designIds |
|---|---|---|---|---|---|---|---|
| L2_blog_system_user_management-001 | L2 | L2_blog_system_user_management-001.feature | 4 | SM-L2_user_management | L2_user_management | REQ-001, REQ-002, REQ-003 | SD-001 |
| L2_blog_system_content_management-001 | L2 | L2_blog_system_content_management-001.feature | 5 | SM-L2_content_management | L2_content_management | REQ-004~007 | SD-002 |
| L2_blog_system_comment_management-001 | L2 | L2_blog_system_comment_management-001.feature | 2 | SM-L2_comment_management | L2_comment_management | REQ-008 | SD-003 |

**状态机 SM-L2_user_management**：
- 状态：NoUser / Registered / LoggedIn
- 转移：register / login / assignRole / logout
- 不变式：LoggedIn => userCount >= 1

**状态机 SM-L2_content_management**：
- 状态：Empty / HasArticles / Editing
- 转移：publishArticle / startEdit / finishEdit / listArticles / paginateArticles
- 不变式：HasArticles => articleCount >= 1；Editing => articleCount >= 1

**状态机 SM-L2_comment_management**：
- 状态：NoComments / HasComments
- 转移：postComment（guard: articleExists）
- 不变式：HasComments => commentCount >= 1

### L3 接口级（2 features，7 scenarios）

| feature ID | level | filePath | scenarioCount | stateMachineId | tlaSpecId | reqIds | designIds |
|---|---|---|---|---|---|---|---|
| L3_blog_system_auth_interface-001 | L3 | L3_blog_system_auth_interface-001.feature | 3 | SM-L3_auth_interface | L3_auth_interface | REQ-001, REQ-002 | SD-001, INTF-001 |
| L3_blog_system_content_interface-001 | L3 | L3_blog_system_content_interface-001.feature | 4 | SM-L3_content_interface | L3_content_interface | REQ-004, REQ-008 | SD-002, SD-003, INTF-002, INTF-003 |

**状态机 SM-L3_auth_interface / SM-L3_content_interface**：
- 状态：Idle / Processing / Responded
- 转移：receiveReq / sendResp / reset
- 不变式：Responded => requestCount >= 1

### L4 详细级（2 features，7 scenarios）

| feature ID | level | filePath | scenarioCount | stateMachineId | tlaSpecId | reqIds | designIds |
|---|---|---|---|---|---|---|---|
| L4_blog_system_user_detail-001 | L4 | L4_blog_system_user_detail-001.feature | 3 | SM-L4_user_detail | L4_user_detail | REQ-001, REQ-002 | SD-001, INTF-001, DD-001, DD-004 |
| L4_blog_system_content_detail-001 | L4 | L4_blog_system_content_detail-001.feature | 4 | SM-L4_content_detail | L4_content_detail | REQ-004, REQ-008 | SD-002, SD-003, INTF-002, INTF-003, DD-002, DD-003, DD-005 |

**状态机 SM-L4_user_detail**：
- 状态：Idle / Creating / Verifying / Done
- 转移：createUser / verifyToken / completeCreate / completeVerify / reset
- 不变式：Done => opCount >= 1

**状态机 SM-L4_content_detail**：
- 状态：Idle / Creating / Querying / Done
- 转移：createArticle / createComment / queryArticles / completeCreate / completeQuery / reset
- 不变式：Done => opCount >= 1

## BDD 资产统计

| 维度 | 数值 |
|---|---|
| features 总数 | 8 |
| L1 features | 1 |
| L2 features | 3 |
| L3 features | 2 |
| L4 features | 2 |
| scenarios 总数 | 31（6+11+7+7） |
| 状态机总数 | 8 |
| 状态总数 | 26 |
| 转移总数 | 38 |
| 不变式总数 | 12 |
| D1-D7 校验通过 | 8/8 features |
| BDD↔TLA+ 等价 | 8/8（feature.tlaSpecId ↔ spec.id 一一对应） |
| BDD↔RTM 映射 | 8/8（feature.reqIds ↔ rtm.rows.requirementId 全覆盖） |

## BDD ↔ TLA+ 等价映射

| BDD feature | TLA+ spec | level | 状态机 ID |
|---|---|---|---|
| L1_blog_system-001 | L1_system | L1 | SM-L1_system |
| L2_blog_system_user_management-001 | L2_user_management | L2 | SM-L2_user_management |
| L2_blog_system_content_management-001 | L2_content_management | L2 | SM-L2_content_management |
| L2_blog_system_comment_management-001 | L2_comment_management | L2 | SM-L2_comment_management |
| L3_blog_system_auth_interface-001 | L3_auth_interface | L3 | SM-L3_auth_interface |
| L3_blog_system_content_interface-001 | L3_content_interface | L3 | SM-L3_content_interface |
| L4_blog_system_user_detail-001 | L4_user_detail | L4 | SM-L4_user_detail |
| L4_blog_system_content_detail-001 | L4_content_detail | L4 | SM-L4_content_detail |
