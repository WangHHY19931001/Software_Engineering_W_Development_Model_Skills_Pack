# BDD 模式示例库（BDD Patterns and Examples）

> 本文件为 BDD features 典型示例库，按 L1/L2/L3/L4 层级分类，提供 S-bdd 子代理在阶段 1-4 按层级选模板用的可复用模式集合。
> 每个示例包含完整 .feature 文件 + bdd-manifest.json 片段 + 状态机说明。
> **加载时机**：S-bdd 子代理在阶段 1/2/3/4 产出对应层级 features 时按需加载作为骨架模板。

## 来源说明

- **来源**：W 模型 v19.0.0 新增（与 [bdd-guide.md](./bdd-guide.md) 配套）。
- **内容范围**：4 个层级各 1-2 个完整 .feature 示例 + 对应 bdd-manifest.json 片段 + 状态机说明。
- **场景映射**：示例覆盖端到端用户场景、子系统协作、模块集成、原子方法四类典型场景。

## W 模型适配说明

1. **文件头注释**：每个示例顶部含完整的 `# @key` 头标注（9 个字段），遵循 [bdd-guide.md §2.2](./bdd-guide.md#§22-头标注字段契约)。
2. **占位符语义**：所有 `@req` / `@design` / `@parent-features` / `@child-features` 标识均为**示例占位符**，按示例语义命名。实际使用时由 **S-bdd 子代理**按目标系统的真实 RTM/结构层图谱标识回填，不可直接套用。
3. **层级映射**：示例按 BDD 分层对称表（[bdd-guide.md §1.1](./bdd-guide.md#§11-分层对称表)）映射：
   - **L1**（端到端用户场景）：示例 1、2
   - **L2**（子系统行为 + 协作）：示例 3
   - **L3**（模块间集成 + 接口契约）：示例 4
   - **L4**（原子方法行为）：示例 5
4. **状态机七要素**：每个示例 Background 节完整声明七要素，遵循 [bdd-guide.md §3.2](./bdd-guide.md#§32-七要素完整性约束)。

## 示例索引

| # | 示例 | 层级 | 典型场景 | W 模型阶段 | 对应 TLA+ 层级 |
|---|---|---|---|---|---|
| 1 | 用户登录端到端 | L1 | 端到端用户场景（认证） | 阶段 1 | L1 |
| 2 | 文章发布端到端 | L1 | 端到端用户场景（内容创建） | 阶段 1 | L1 |
| 3 | 认证子系统协作 | L2 | 子系统内行为 + 协作 | 阶段 2 | L2 |
| 4 | 文章存储 + 用户认证集成 | L3 | 模块间集成 + 接口契约 | 阶段 3 | L3 |
| 5 | TokenStore.issue() 原子方法 | L4 | 单方法原子行为 | 阶段 4 | TLA+ L3 最细粒度 |

---

## Example 1: 用户登录端到端（L1）

> 场景：博客系统最终用户使用邮箱密码登录的端到端流程，覆盖登录成功、登录失败、登出三类路径。

### .feature 文件

文件名：`features/L1/L1_blog_system-001.feature`

```gherkin
# @req: REQ-001
# @design: SD-3.2.1
# @system: L1_blog_system
# @tla-spec: L1_blog_system
# @state-machine: SM-L1-blog_system
# @parent-features: (none)
# @sibling-features: L1_blog_system-002.feature
# @child-features: L2_blog_system_auth-001.feature
# @scenario-id-prefix: BDD-L1
Feature: 博客系统用户登录端到端场景
  作为博客系统的最终用户
  我希望使用邮箱密码登录系统
  以便访问受保护的博客功能

Background:
  # @states: Unauthenticated, Authenticated, LoggedOut
  # @initial-state: Unauthenticated
  # @terminal-states: LoggedOut
  # @accepting-states: Authenticated
  # @rejecting-states: Unauthenticated
  # @transitions:
  #   Unauthenticated + login -> Authenticated [guard: credentialsValid] [action: issueSession]
  #   Unauthenticated + login -> Unauthenticated [guard: credentialsInvalid] [action: recordFailure]
  #   Authenticated + logout -> LoggedOut [action: revokeSession]
  # @invariants:
  #   Authenticated => sessionValid
  #   LoggedOut => sessionRevoked
  Given 系统处于初始状态

@REQ-001 @SD-3.2.1 @UAT-001 @BDD-L1-001 @high
Scenario: 用户使用有效凭据登录成功
  Given 系统处于 "Unauthenticated" 状态
  And 用户输入有效凭据 "alice@example.com" / "valid123"
  When 用户提交登录请求
  Then 系统应转移到 "Authenticated" 状态
  And 不变式 "Authenticated => sessionValid" 应成立

@REQ-001 @SD-3.2.1 @UAT-002 @BDD-L1-002 @high
Scenario: 用户使用无效凭据登录失败
  Given 系统处于 "Unauthenticated" 状态
  And 用户输入无效凭据 "alice@example.com" / "wrong-pass"
  When 用户提交登录请求
  Then 系统应保持在 "Unauthenticated" 状态
  And 不变式 "Authenticated => sessionValid" 应成立

@REQ-001 @SD-3.2.1 @UAT-003 @BDD-L1-003 @medium
Scenario: 已登录用户登出
  Given 系统处于 "Authenticated" 状态
  When 用户点击 "登出" 按钮
  Then 系统应转移到 "LoggedOut" 状态
  And 不变式 "LoggedOut => sessionRevoked" 应成立
```

### bdd-manifest.json 片段

```json
{
  "schemaVersion": "1.0",
  "projectId": "blog-system",
  "basePath": ".",
  "currentPhase": 1,
  "features": [
    {
      "id": "L1_blog_system-001",
      "level": 1,
      "filePath": "features/L1/L1_blog_system-001.feature",
      "scenarioCount": 3,
      "stateMachineId": "SM-L1-blog_system",
      "tlaSpecId": "L1_blog_system",
      "reqIds": ["REQ-001"],
      "designIds": ["SD-3.2.1"],
      "parentFeatureIds": [],
      "siblingFeatureIds": ["L1_blog_system-002"],
      "childFeatureIds": ["L2_blog_system_auth-001"]
    }
  ],
  "stateMachines": [
    {
      "id": "SM-L1-blog_system",
      "level": 1,
      "states": ["Unauthenticated", "Authenticated", "LoggedOut"],
      "initialState": "Unauthenticated",
      "terminalStates": ["LoggedOut"],
      "acceptingStates": ["Authenticated"],
      "rejectingStates": ["Unauthenticated"],
      "transitions": [
        { "from": "Unauthenticated", "event": "login", "to": "Authenticated", "guard": "credentialsValid", "action": "issueSession" },
        { "from": "Unauthenticated", "event": "login", "to": "Unauthenticated", "guard": "credentialsInvalid", "action": "recordFailure" },
        { "from": "Authenticated", "event": "logout", "to": "LoggedOut", "action": "revokeSession" }
      ],
      "invariants": [
        "Authenticated => sessionValid",
        "LoggedOut => sessionRevoked"
      ]
    }
  ]
}
```

### 状态机说明

- **状态集**（3 个）：`Unauthenticated`（未认证）/ `Authenticated`（已认证）/ `LoggedOut`（已登出）
- **初始状态**：`Unauthenticated`
- **终态集**：`LoggedOut`（用户登出后会话终结）
- **可接受状态**：`Authenticated`（业务期望的"成功"状态）
- **可拒绝状态**：`Unauthenticated`（认证失败的"拒绝"状态）
- **转移表**（3 条）：登录成功 / 登录失败保持原态 / 登出
- **不变式**（2 条）：已认证则会话有效；已登出则会话已注销

---

## Example 2: 文章发布端到端（L1）

> 场景：blogger 角色用户发布文章的端到端流程，覆盖发布成功、权限不足、重复发布三类路径。

### .feature 文件

文件名：`features/L1/L1_blog_system-002.feature`

```gherkin
# @req: REQ-002
# @design: SD-3.3.1
# @system: L1_blog_system
# @tla-spec: L1_blog_system
# @state-machine: SM-L1-article-publish
# @parent-features: (none)
# @sibling-features: L1_blog_system-001.feature
# @child-features: L2_blog_system_article-001.feature
# @scenario-id-prefix: BDD-L1
Feature: 博客系统文章发布端到端场景
  作为 blogger 角色用户
  我希望发布文章
  以便分享内容给读者

Background:
  # @states: Drafting, Published, Rejected
  # @initial-state: Drafting
  # @terminal-states: Published, Rejected
  # @accepting-states: Published
  # @rejecting-states: Rejected
  # @transitions:
  #   Drafting + submit -> Published [guard: roleIsBlogger] [action: persistArticle]
  #   Drafting + submit -> Rejected [guard: roleIsReader] [action: recordDenied]
  # @invariants:
  #   Published => articlePersisted
  #   Rejected => denialRecorded
  Given 系统处于初始状态

@REQ-002 @SD-3.3.1 @UAT-004 @BDD-L1-004 @high
Scenario: blogger 角色用户成功发布文章
  Given 系统处于 "Drafting" 状态
  And 当前用户角色为 "blogger"
  And 文章标题为 "Hello World" 内容为 "first post"
  When 用户点击 "发布" 按钮
  Then 系统应转移到 "Published" 状态
  And 不变式 "Published => articlePersisted" 应成立

@REQ-002 @SD-3.3.1 @UAT-005 @BDD-L1-005 @medium
Scenario: reader 角色用户发布文章被拒绝
  Given 系统处于 "Drafting" 状态
  And 当前用户角色为 "reader"
  When 用户点击 "发布" 按钮
  Then 系统应转移到 "Rejected" 状态
  And 不变式 "Rejected => denialRecorded" 应成立
```

### 状态机说明

- **状态集**（3 个）：`Drafting`（草稿中）/ `Published`（已发布）/ `Rejected`（被拒绝）
- **初始状态**：`Drafting`
- **终态集**：`Published` + `Rejected`（均为业务终结状态）
- **可接受状态**：`Published`
- **可拒绝状态**：`Rejected`
- **转移表**（2 条）：blogger 提交成功 / reader 提交被拒
- **不变式**（2 条）：已发布则文章已持久化；被拒绝则拒绝记录已留存

---

## Example 3: 认证子系统协作（L2）

> 场景：认证子系统内部 Token 颁发与权限校验的协作行为，覆盖 token 颁发、权限校验、token 失效三类路径。

### .feature 文件

文件名：`features/L2/L2_blog_system_auth-001.feature`

```gherkin
# @req: REQ-001
# @design: SD-3.2.2
# @system: L2_blog_system_auth
# @tla-spec: L2_auth_subsystem
# @state-machine: SM-L2-blog_system_auth
# @parent-features: L1_blog_system-001.feature
# @sibling-features: L2_blog_system_article-001.feature
# @child-features: L3_blog_system_article_store-001.feature
# @scenario-id-prefix: BDD-L2
Feature: 认证子系统 token 颁发与权限校验
  作为认证子系统
  我希望颁发 token 并校验权限
  以便为上层系统提供认证授权能力

Background:
  # @states: Idle, TokenIssued, Authorized, Expired
  # @initial-state: Idle
  # @terminal-states: Expired
  # @accepting-states: Authorized
  # @rejecting-states: Idle
  # @transitions:
  #   Idle + issueToken -> TokenIssued [guard: credentialsValid] [action: persistToken]
  #   TokenIssued + authorize -> Authorized [guard: roleMatches] [action: grantPermissions]
  #   TokenIssued + authorize -> TokenIssued [guard: roleMismatch] [action: recordDenied]
  #   TokenIssued + expire -> Expired [action: revokeToken]
  #   Authorized + expire -> Expired [action: revokeToken]
  # @invariants:
  #   TokenIssued => tokenValid
  #   Authorized => permissionsGranted
  #   Expired => tokenRevoked
  Given 认证子系统已就绪

@REQ-001 @SD-3.2.2 @ST-001 @BDD-L2-001 @high
Scenario: 凭据有效且角色匹配时颁发 token 并授权
  Given 认证子系统处于 "Idle" 状态
  And 用户提交有效凭据 "alice@example.com" / "valid123"
  When 子系统执行 issueToken
  Then 子系统应转移到 "TokenIssued" 状态
  And 不变式 "TokenIssued => tokenValid" 应成立
  When 子系统执行 authorize
  Then 子系统应转移到 "Authorized" 状态
  And 不变式 "Authorized => permissionsGranted" 应成立

@REQ-001 @SD-3.2.2 @ST-002 @BDD-L2-002 @medium
Scenario: 角色不匹配时 token 颁发但授权失败
  Given 认证子系统处于 "Idle" 状态
  And 用户提交有效凭据 "bob@example.com" / "valid123"
  When 子系统执行 issueToken
  Then 子系统应转移到 "TokenIssued" 状态
  When 子系统执行 authorize
  Then 子系统应保持在 "TokenIssued" 状态
  And 不变式 "TokenIssued => tokenValid" 应成立

@REQ-001 @SD-3.2.2 @ST-003 @BDD-L2-003 @medium
Scenario: token 过期后失效
  Given 认证子系统处于 "TokenIssued" 状态
  When token 到期触发 expire
  Then 子系统应转移到 "Expired" 状态
  And 不变式 "Expired => tokenRevoked" 应成立
```

### bdd-manifest.json 片段

```json
{
  "features": [
    {
      "id": "L2_blog_system_auth-001",
      "level": 2,
      "filePath": "features/L2/L2_blog_system_auth-001.feature",
      "scenarioCount": 3,
      "stateMachineId": "SM-L2-blog_system_auth",
      "tlaSpecId": "L2_auth_subsystem",
      "reqIds": ["REQ-001"],
      "designIds": ["SD-3.2.2"],
      "parentFeatureIds": ["L1_blog_system-001"],
      "siblingFeatureIds": ["L2_blog_system_article-001"],
      "childFeatureIds": ["L3_blog_system_article_store-001"]
    }
  ],
  "stateMachines": [
    {
      "id": "SM-L2-blog_system_auth",
      "level": 2,
      "states": ["Idle", "TokenIssued", "Authorized", "Expired"],
      "initialState": "Idle",
      "terminalStates": ["Expired"],
      "acceptingStates": ["Authorized"],
      "rejectingStates": ["Idle"],
      "transitions": [
        { "from": "Idle", "event": "issueToken", "to": "TokenIssued", "guard": "credentialsValid", "action": "persistToken" },
        { "from": "TokenIssued", "event": "authorize", "to": "Authorized", "guard": "roleMatches", "action": "grantPermissions" },
        { "from": "TokenIssued", "event": "authorize", "to": "TokenIssued", "guard": "roleMismatch", "action": "recordDenied" },
        { "from": "TokenIssued", "event": "expire", "to": "Expired", "action": "revokeToken" },
        { "from": "Authorized", "event": "expire", "to": "Expired", "action": "revokeToken" }
      ],
      "invariants": [
        "TokenIssued => tokenValid",
        "Authorized => permissionsGranted",
        "Expired => tokenRevoked"
      ]
    }
  ]
}
```

### 状态机说明

- **状态集**（4 个）：`Idle`（待命）/ `TokenIssued`（token 已颁发）/ `Authorized`（已授权）/ `Expired`（已失效）
- **初始状态**：`Idle`
- **终态集**：`Expired`
- **可接受状态**：`Authorized`（业务期望的"成功授权"状态）
- **可拒绝状态**：`Idle`（未颁发 token 的初始拒绝态）
- **转移表**（5 条）：颁发 token / 角色匹配授权 / 角色不匹配保持原态 / token 已颁发后过期 / 已授权后过期
- **不变式**（3 条）：token 已颁发则有效；已授权则权限已授予；已失效则 token 已注销
- **多事件 scenario**：示例 1 含 `issueToken` + `authorize` 链式状态转移（多 When 步骤）

---

## Example 4: 文章存储 + 用户认证集成（L3）

> 场景：文章存储模块与用户认证模块集成时的接口契约场景，覆盖已认证用户读取文章、未认证用户被拒绝读取两类路径。

### .feature 文件

文件名：`features/L3/L3_blog_system_article_store-001.feature`

```gherkin
# @req: REQ-002, REQ-001
# @design: INTF-3.1.2
# @system: L3_blog_system_article_store
# @tla-spec: L3_article_store
# @state-machine: SM-L3-blog_system_article_store
# @parent-features: L2_blog_system_article-001.feature
# @sibling-features: (none)
# @child-features: L4_blog_system_token_store_issue-001.feature
# @scenario-id-prefix: BDD-L3
Feature: 文章存储与用户认证集成
  作为文章存储模块
  我希望与认证模块协作校验读取权限
  以便保证只有已认证用户能读取文章

Background:
  # @states: AwaitingAuth, AuthVerified, ArticleServed, Denied
  # @initial-state: AwaitingAuth
  # @terminal-states: ArticleServed, Denied
  # @accepting-states: ArticleServed
  # @rejecting-states: Denied
  # @transitions:
  #   AwaitingAuth + verifyToken -> AuthVerified [guard: tokenValid] [action: loadUserId]
  #   AwaitingAuth + verifyToken -> Denied [guard: tokenInvalid] [action: recordDenied]
  #   AuthVerified + fetchArticle -> ArticleServed [guard: articleExists] [action: returnArticle]
  #   AuthVerified + fetchArticle -> Denied [guard: articleNotFound] [action: recordNotFound]
  # @invariants:
  #   AuthVerified => userIdLoaded
  #   ArticleServed => articleReturned
  #   Denied => denialReasonRecorded
  Given 文章存储模块与认证模块已就绪

@REQ-002 @REQ-001 @INTF-3.1.2 @IT-001 @BDD-L3-001 @high
Scenario: 已认证用户成功读取已存在的文章
  Given 文章存储模块处于 "AwaitingAuth" 状态
  And 用户携带有效 token "token-001"
  When 模块调用认证接口 verifyToken
  Then 模块应转移到 "AuthVerified" 状态
  And 不变式 "AuthVerified => userIdLoaded" 应成立
  When 模块请求文章 "art-001"
  Then 模块应转移到 "ArticleServed" 状态
  And 不变式 "ArticleServed => articleReturned" 应成立

@REQ-002 @REQ-001 @INTF-3.1.2 @IT-002 @BDD-L3-002 @high
Scenario: 未认证用户被拒绝读取文章
  Given 文章存储模块处于 "AwaitingAuth" 状态
  And 用户携带无效 token "expired-token"
  When 模块调用认证接口 verifyToken
  Then 模块应转移到 "Denied" 状态
  And 不变式 "Denied => denialReasonRecorded" 应成立
```

### 状态机说明

- **状态集**（4 个）：`AwaitingAuth`（待认证）/ `AuthVerified`（认证已通过）/ `ArticleServed`（文章已返回）/ `Denied`（已拒绝）
- **初始状态**：`AwaitingAuth`
- **终态集**：`ArticleServed` + `Denied`
- **可接受状态**：`ArticleServed`
- **可拒绝状态**：`Denied`
- **转移表**（4 条）：token 有效→认证通过 / token 无效→拒绝 / 文章存在→返回 / 文章不存在→拒绝
- **不变式**（3 条）：认证通过则 userId 已加载；文章已返回则 article 已返回；拒绝则拒绝原因已记录
- **接口契约**：场景描述文章存储模块作为调用方，认证模块作为被调用方，通过 `verifyToken` 接口协作

---

## Example 5: TokenStore.issue() 原子方法（L4）

> 场景：原子方法 `TokenStore.issue()` 的单元级行为，覆盖正常颁发、凭据无效拒绝、token 已存在（幂等）三类路径。
> 对应 TLA+ L3 最细粒度（原子方法级），即 BDD L4 features 与 TLA+ L3 spec 内部最细粒度的方法级行为对齐。

### .feature 文件

文件名：`features/L4/L4_blog_system_token_store_issue-001.feature`

```gherkin
# @req: REQ-001
# @design: DD-4.1.2
# @system: L4_blog_system_token_store_issue
# @tla-spec: L3_token_store
# @state-machine: SM-L4-blog_system_token_store_issue
# @parent-features: L3_blog_system_article_store-001.feature
# @sibling-features: (none)
# @child-features: (none)
# @scenario-id-prefix: BDD-L4
Feature: TokenStore.issue() 原子方法行为
  作为 TokenStore 模块
  我希望实现 issue() 方法颁发 token
  以便为认证子系统提供底层 token 管理能力

Background:
  # @states: Empty, TokenPersisted, Error
  # @initial-state: Empty
  # @terminal-states: TokenPersisted, Error
  # @accepting-states: TokenPersisted
  # @rejecting-states: Error
  # @transitions:
  #   Empty + issue -> TokenPersisted [guard: credentialsValid] [action: generateToken]
  #   Empty + issue -> Error [guard: credentialsInvalid] [action: returnError]
  #   TokenPersisted + issue -> TokenPersisted [guard: sameCredentials] [action: returnExistingToken]
  # @invariants:
  #   TokenPersisted => tokenNotNull
  #   Error => errorMessageSet
  Given TokenStore 实例已初始化

@REQ-001 @DD-4.1.2 @UT-001 @BDD-L4-001 @high
Scenario: 凭据有效时成功颁发 token
  Given TokenStore 处于 "Empty" 状态
  And 输入凭据为 "alice@example.com" / "valid123"
  When 调用 issue("alice@example.com", "valid123")
  Then TokenStore 应转移到 "TokenPersisted" 状态
  And 返回的 token 应非空
  And 不变式 "TokenPersisted => tokenNotNull" 应成立

@REQ-001 @DD-4.1.2 @UT-002 @BDD-L4-002 @high
Scenario: 凭据无效时返回错误
  Given TokenStore 处于 "Empty" 状态
  And 输入凭据为 "alice@example.com" / "wrong-pass"
  When 调用 issue("alice@example.com", "wrong-pass")
  Then TokenStore 应转移到 "Error" 状态
  And 应抛出 "InvalidCredentialsError"
  And 不变式 "Error => errorMessageSet" 应成立

@REQ-001 @DD-4.1.2 @UT-003 @BDD-L4-003 @medium
Scenario: 相同凭据重复调用 issue 返回相同 token（幂等）
  Given TokenStore 处于 "TokenPersisted" 状态
  And 已存在凭据 "alice@example.com" 对应的 token "token-001"
  When 调用 issue("alice@example.com", "valid123")
  Then TokenStore 应保持在 "TokenPersisted" 状态
  And 返回的 token 应等于 "token-001"
  And 不变式 "TokenPersisted => tokenNotNull" 应成立
```

### bdd-manifest.json 片段

```json
{
  "features": [
    {
      "id": "L4_blog_system_token_store_issue-001",
      "level": 4,
      "filePath": "features/L4/L4_blog_system_token_store_issue-001.feature",
      "scenarioCount": 3,
      "stateMachineId": "SM-L4-blog_system_token_store_issue",
      "tlaSpecId": "L3_token_store",
      "reqIds": ["REQ-001"],
      "designIds": ["DD-4.1.2"],
      "parentFeatureIds": ["L3_blog_system_article_store-001"],
      "siblingFeatureIds": [],
      "childFeatureIds": []
    }
  ],
  "stateMachines": [
    {
      "id": "SM-L4-blog_system_token_store_issue",
      "level": 4,
      "states": ["Empty", "TokenPersisted", "Error"],
      "initialState": "Empty",
      "terminalStates": ["TokenPersisted", "Error"],
      "acceptingStates": ["TokenPersisted"],
      "rejectingStates": ["Error"],
      "transitions": [
        { "from": "Empty", "event": "issue", "to": "TokenPersisted", "guard": "credentialsValid", "action": "generateToken" },
        { "from": "Empty", "event": "issue", "to": "Error", "guard": "credentialsInvalid", "action": "returnError" },
        { "from": "TokenPersisted", "event": "issue", "to": "TokenPersisted", "guard": "sameCredentials", "action": "returnExistingToken" }
      ],
      "invariants": [
        "TokenPersisted => tokenNotNull",
        "Error => errorMessageSet"
      ]
    }
  ]
}
```

### 状态机说明

- **状态集**（3 个）：`Empty`（无 token）/ `TokenPersisted`（token 已持久化）/ `Error`（错误态）
- **初始状态**：`Empty`
- **终态集**：`TokenPersisted` + `Error`
- **可接受状态**：`TokenPersisted`
- **可拒绝状态**：`Error`
- **转移表**（3 条）：凭据有效→颁发 / 凭据无效→错误 / 幂等重入返回已有 token
- **不变式**（2 条）：token 已持久化则非空；错误态则错误消息已设置
- **TLA+ 对应**：BDD L4 ↔ TLA+ L3 最细粒度（`L3_token_store` spec 内部 `issue` 方法行为）

---

## 常见场景模式总结

| 模式 | 适用层级 | 典型用法 | 示例 |
|---|---|---|---|
| 正常路径（happy path） | L1-L4 | 验证业务期望的成功路径 | 示例 1 Scenario 1 |
| 异常路径（error path） | L1-L4 | 验证凭据无效/权限不足/资源不存在等失败路径 | 示例 1 Scenario 2 / 示例 5 Scenario 2 |
| 边界路径（boundary） | L1-L4 | 验证边界条件（如 token 过期、参数边界） | 示例 3 Scenario 3 |
| 幂等性（idempotency） | L4 | 验证原子方法重复调用返回一致结果 | 示例 5 Scenario 3 |
| 多事件链式（multi-event） | L1-L3 | 验证多个 When 步骤构成的状态转移链 | 示例 1 Scenario 3 / 示例 3 Scenario 1 / 示例 4 Scenario 1 |
| 角色分支（role branching） | L1-L2 | 验证不同角色的差异化行为 | 示例 2 / 示例 3 |
| 参数化场景（scenario outline） | L1-L4 | 用 Examples 表展开多组数据 | 详见 [bdd-syntax-reference.md](./bdd-syntax-reference.md) |

## W 模型交叉引用

- [bdd-guide.md](./bdd-guide.md)：BDD 建模指南（头标注 / 状态机七要素 / 门禁调用）
- [bdd-review-checklist.md](./bdd-review-checklist.md)：BDD 评审 7 项清单
- [bdd-syntax-reference.md](./bdd-syntax-reference.md)：Gherkin 完整语法参考
- [tla-plus-patterns-examples.md](./tla-plus-patterns-examples.md)：TLA+ 模式示例库（对称参考）
- [../templates/feature.template](../templates/feature.template)：features 文件模板（套用起点）
