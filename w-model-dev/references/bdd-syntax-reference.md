# Gherkin 完整语法参考（BDD Syntax Reference）

> 本文件为 Gherkin 语法通用参考，覆盖 Cucumber.js 11.x 支持的全部关键字与语法结构。
> **W 模型约束**：BDD features 文件头标注与 Background 节状态机七要素声明须遵循 [bdd-guide.md](./bdd-guide.md) §2-§3。
> **加载时机**：S-bdd 子代理产出 .feature 文件时必读；V-bdd 子代理评审语法合规性、G 子代理排查 D2（gherkinSyntax）违规时参考。

## 文件结构

一个 .feature 文件由以下节按顺序组成：

1. **文件头注释块**（`#` 注释，W 模型 `@key` 标注）
2. **Feature 节**（关键字 `Feature:` + 描述）
3. **Background 节**（可选，关键字 `Background:` + 步骤）
4. **Scenario / Scenario Outline 节**（1 个或多个）

```gherkin
# 文件头注释块（W 模型 @key 标注）
# @req: REQ-001
# @design: SD-3.2.1
# ...

Feature: 功能名称
  作为 <角色>
  我希望 <行为>
  以便 <价值>

Background:
  Given 公共前置条件

Scenario: 场景名称
  Given 前置条件
  When 动作
  Then 预期结果
```

## 关键字

### Feature 关键字

`Feature:` 声明功能模块，后跟功能名称与描述（可跨多行）。

```gherkin
Feature: 用户登录
  作为博客系统的最终用户
  我希望使用邮箱密码登录
  以便访问受保护资源
```

> **W 模型适配**：Feature 节前必须有文件头注释块（`# @req` / `# @design` / `# @system` 等字段，见 [bdd-guide.md §2.2](./bdd-guide.md#§22-头标注字段契约)）。

### Background 关键字

`Background:` 声明该 Feature 下所有 Scenario 共享的前置步骤。每个 Feature 最多 1 个 Background 节，位于 Feature 描述之后、第一个 Scenario 之前。

```gherkin
Feature: 文章管理

Background:
  Given 系统已启动
  And 数据库已连接
  And 用户 "alice@example.com" 已登录

Scenario: 创建文章
  When 用户提交新文章
  Then 文章应被保存

Scenario: 删除文章
  Given 存在一篇已发布的文章
  When 用户删除该文章
  Then 文章应被移除
```

> **W 模型适配**：Background 节必须用 `#` 注释声明状态机七要素（`@states` / `@initial-state` / `@terminal-states` / `@accepting-states` / `@rejecting-states` / `@transitions` / `@invariants`），见 [bdd-guide.md §3.1](./bdd-guide.md#§31-background-节契约)。

### Scenario 关键字

`Scenario:` 声明单个场景，后跟场景名称与步骤。同一 Feature 内场景名应唯一。

```gherkin
Scenario: 用户使用有效凭据登录成功
  Given 系统处于 "Unauthenticated" 状态
  When 用户提交登录请求
  Then 系统应转移到 "Authenticated" 状态
```

### Scenario Outline 关键字

`Scenario Outline:` 声明参数化场景模板，配合 `Examples` 表展开为多个具体场景。占位符用 `<...>` 标注。

```gherkin
Scenario Outline: 用户使用不同凭据登录
  Given 系统处于 "Unauthenticated" 状态
  And 用户输入邮箱 "<email>" 和密码 "<password>"
  When 用户提交登录请求
  Then 系统应转移到 "<expectedState>" 状态

  Examples:
    | email             | password    | expectedState  |
    | alice@example.com | valid123    | Authenticated  |
    | bob@example.com   | wrong-pass  | Unauthenticated |
    | unknown@x.com     | any         | Unauthenticated |
```

## 步骤关键字

### Given

`Given` 声明场景的前置条件（系统初始状态或已有数据）。

```gherkin
Given 系统处于 "Unauthenticated" 状态
Given 以下用户已注册
  | id       | email             | role   |
  | user-001 | alice@example.com | reader |
Given 当前时间是 "2026-07-27T10:00:00Z"
```

### When

`When` 声明触发动作（事件）。

```gherkin
When 用户提交登录请求
When 用户点击 "发布文章" 按钮
When 系统接收到外部回调 "payment-success"
```

### Then

`Then` 声明预期结果（断言）。

```gherkin
Then 系统应转移到 "Authenticated" 状态
Then 响应状态码应为 200
Then 响应应该与快照 "articles-list-001.json" 一致
```

### And

`And` 连续同类步骤的连接符，等价于上一个步骤关键字。

```gherkin
Given 系统处于 "Unauthenticated" 状态
And 用户输入邮箱 "alice@example.com"
And 用户输入密码 "valid123"
When 用户提交登录请求
Then 系统应转移到 "Authenticated" 状态
And 不变式 "Authenticated => sessionValid" 应成立
```

### But

`But` 与 `And` 对称，用于强调转折（语义上否定），等价于上一个步骤关键字。

```gherkin
Then 系统应转移到 "Authenticated" 状态
But 系统不应处于 "Authorized" 状态
```

## 步骤文本

### 数据表（Data Tables）

步骤后跟表格，传递结构化数据。表格首行为表头，后续行为数据。

```gherkin
Given 以下用户已注册
  | id       | email             | role     |
  | user-001 | alice@example.com | reader   |
  | user-002 | bob@example.com   | blogger  |
```

> 数据表常用于加载测试数据 fixture（`fixtures/data/*.json`），见 [bdd-guide.md §7.3](./bdd-guide.md#§73-测试数据-fixture)。

### DocString（多行字符串）

步骤后跟 `"""` 包围的多行文本，传递文档型数据。

```gherkin
Given 系统配置如下
  """
  {
    "maxSessions": 100,
    "sessionTimeout": 1800
  }
  """
```

### Examples 表

`Scenario Outline` 后跟 `Examples:` 关键字 + 表格，定义参数化数据。表格列名对应 `<占位符>`。

```gherkin
Scenario Outline: 边界值校验
  Given 输入值为 <input>
  When 系统执行校验
  Then 结果应为 "<expected>"

  Examples: 有效输入
    | input | expected |
    | 0     | valid    |
    | 100   | valid    |

  Examples: 无效输入
    | input | expected |
    | -1    | invalid  |
    | 101   | invalid  |
```

## TAG 语法

`@tag` 标注在 Scenario 或 Feature 行之前，用于过滤、追溯与分类。多个 TAG 空格分隔。

```gherkin
@REQ-001 @REQ-002 @SD-3.2.1 @UAT-001 @high @BDD-L1-001
Feature: 用户认证

  @smoke
  Scenario: 登录成功
    Given ...

  @regression @critical
  Scenario: 登录失败
    Given ...
```

> **W 模型适配**：scenario TAG 必须包含追溯 TAG（`@REQ-NNN` / `@UAT-NNN` / `@ST-NNN` / `@IT-NNN` / `@UT-NNN`）+ 优先级 TAG（`@high` / `@medium` / `@low`）+ BDD ID TAG（`@BDD-L<level>-<num>`），见 [bdd-guide.md §2](./bdd-guide.md#§2-features-文件结构与头标注契约) 与 spec §11.5。

## 注释语法

`#` 起始的行为注释行，Gherkin 解析器忽略。

```gherkin
# 这是注释行
# @req: REQ-001  ← W 模型头标注也用注释语法
Feature: 用户认证

Background:
  # @states: Unauthenticated, Authenticated
  # @initial-state: Unauthenticated
  # 这是普通注释
  Given 系统处于初始状态
```

> **W 模型适配**：注释语法是 W 模型声明状态机七要素的载体（避免污染 Gherkin AST），见 [bdd-guide.md §3.1](./bdd-guide.md#§31-background-节契约)。

## 关键字本地化

Gherkin 支持 60+ 语言关键字。Cucumber.js 通过 `language` 配置项切换：

```javascript
// features/cucumber.js
module.exports = {
  default: {
    language: 'zh-CN',  // 使用中文关键字
    // ...
  },
};
```

中文关键字示例：

| 英文 | 中文 |
|---|---|
| Feature | 功能 |
| Background | 背景 |
| Scenario | 场景 |
| Scenario Outline | 场景大纲 |
| Given | 假如 |
| When | 当 |
| Then | 那么 |
| And | 而且 |
| But | 但是 |
| Examples | 例子 |

> **W 模型推荐**：默认使用英文关键字（`Feature` / `Scenario` / `Given` / `When` / `Then`），与既有 references/ 文档语言风格一致。中文关键字仅在与中文业务方协作时启用。

## 完整示例

```gherkin
# @req: REQ-001, REQ-002
# @design: SD-3.2.1
# @system: L1_blog_system
# @tla-spec: L1_blog_system
# @state-machine: SM-L1-blog_system
# @parent-features: (none)
# @sibling-features: (none)
# @child-features: L2_blog_system_auth-001.feature
# @scenario-id-prefix: BDD-L1
Feature: 博客系统端到端用户场景
  作为博客系统的最终用户
  我希望完成注册、登录、发文的端到端流程
  以便验证系统满足用户需求

Background:
  # @states: Unauthenticated, Authenticated, Authorized, LoggedOut
  # @initial-state: Unauthenticated
  # @terminal-states: LoggedOut
  # @accepting-states: Authorized
  # @rejecting-states: Unauthenticated
  # @transitions:
  #   Unauthenticated + login -> Authenticated [guard: credentialsValid] [action: issueSession]
  #   Authenticated + authorize -> Authorized [guard: roleMatches] [action: grantPermissions]
  #   Authorized + logout -> LoggedOut [action: revokeSession]
  # @invariants:
  #   Authenticated => sessionValid
  #   Authorized => role != null
  Given 系统处于初始状态

@REQ-001 @SD-3.2.1 @UAT-001 @BDD-L1-001 @high
Scenario: 用户使用邮箱密码登录成功
  Given 系统处于 "Unauthenticated" 状态
  And 用户输入有效凭据 "alice@example.com" / "valid123"
  When 用户提交登录请求
  Then 系统应转移到 "Authenticated" 状态
  And 不变式 "Authenticated => sessionValid" 应成立

@REQ-002 @SD-3.2.1 @UAT-002 @BDD-L1-002 @medium
Scenario Outline: 不同角色的授权行为
  Given 系统处于 "Authenticated" 状态
  And 用户角色为 "<role>"
  When 用户请求授权
  Then 系统应转移到 "<expectedState>" 状态

  Examples:
    | role    | expectedState |
    | blogger | Authorized    |
    | reader  | Authenticated |
```

## W 模型交叉引用

- [bdd-guide.md](./bdd-guide.md)：BDD 建模指南（头标注 / 状态机七要素 / 门禁调用）
- [bdd-review-checklist.md](./bdd-review-checklist.md)：BDD 评审 7 项清单
- [bdd-patterns-examples.md](./bdd-patterns-examples.md)：BDD 模式示例库（按 L1/L2/L3/L4 分类）
- [tla-plus-syntax-reference.md](./tla-plus-syntax-reference.md)：TLA+ 完整语法参考（对称参考）
