# BDD 建模与验收夹具指南（BDD Guide）

> 本文件定义 BDD（Behavior-Driven Development）建模与验收夹具的可执行细则：features 文件头标注、状态机七要素、门禁脚本用法、阶段产出契约。
> S 子代理（产出 .feature + 更新 bdd-manifest.json）、V 子代理（评审合规性）、G 子代理（跑 check-bdd-model.ts）必读。
> 权威设计见 [docs/superpowers/specs/2026-07-27-bdd-modeling-and-acceptance-fixture-design.md](../../docs/superpowers/specs/2026-07-27-bdd-modeling-and-acceptance-fixture-design.md)。

## 所属系统

- **所属技能**：w-model-dev v19.0.0
- **关联需求设计**：SSoT §3.4.14（新增）
- **同级文件**：[tla-plus-guide.md](./tla-plus-guide.md)（TLA+ 行为规格，BDD 与之正交协作）
- **下级文件**：
  - [bdd-review-checklist.md](./bdd-review-checklist.md)（V 子代理评审清单）
  - [bdd-syntax-reference.md](./bdd-syntax-reference.md)（Gherkin 语法参考）
  - [bdd-patterns-examples.md](./bdd-patterns-examples.md)（BDD 模式示例库）
- **模板文件**：[../templates/feature.template](../templates/feature.template)、[../templates/bdd-manifest.template.json](../templates/bdd-manifest.template.json)
- **门禁脚本**：[../scripts/check-bdd-model.ts](../scripts/check-bdd-model.ts)、[../scripts/bdd-logic.ts](../scripts/bdd-logic.ts)
- **Schema**：[../schemas/bdd-manifest.schema.json](../schemas/bdd-manifest.schema.json)

## 公理

> **BDD features 是 TLA+ 抽象规格的具象化层；两者独立维护，依靠 check-bdd-model.ts 等价性校验保证一致。**

BDD 门禁是 W 模型第四维度门禁——与结构连通门禁（graph）、信息流门禁（dataflow）、行为正确性门禁（TLA+）正交：

| 维度 | 校验什么 | 脚本 |
|---|---|---|
| 结构连通 | 节点归属单根树、追溯完整 | `check-requirement-graph.ts` |
| 信息流闭合 | 节点既是生产者又是消费者 | `check-requirement-graph.ts` |
| 行为正确性（TLA+） | 状态机无死锁、不变式成立、无状态爆炸 | `check-tla-model.ts` |
| **行为具象化（BDD）** | **features 状态机七要素、scenario 路径合法、TLA+ 等价** | **`check-bdd-model.ts`** |

## 工具链

| 依赖 | 版本 | 位置 |
|---|---|---|
| `@cucumber/cucumber` | ^11.0.0 | devDependencies（BDD 运行器） |
| `@cucumber/messages` | ^27.0.0 | devDependencies（Gherkin AST 解析） |

> cucumber.js 是确定性运行器，不调用 LLM。`strict: true` 保证 undefined/pending step 视为失败，与门禁退出码语义一致。

---

## §1 BDD 分层架构

> 详参见 spec §3。

BDD 分层与 TLA+ 分层对称（L1/L2/L3/L4），最细粒度都到原子方法。

### §1.1 分层对称表

| BDD 层级 | 对应 TLA+ 层级 | BDD 描述对象 | 产出阶段 | 执行阶段 | features 目录 |
|---|---|---|---|---|---|
| L1 | L1（系统内外交互） | 系统与外部参与者的端到端交互场景 | 阶段 1 | 阶段 8（验收测试） | `features/L1/` |
| L2 | L2（子系统行为 + 协作） | 子系统内行为 + 兄弟子系统协作场景 | 阶段 2 | 阶段 7（系统测试） | `features/L2/` |
| L3 | L3（原子子系统行为） | 模块间集成场景 + 接口契约场景 | 阶段 3 | 阶段 6（集成测试） | `features/L3/` |
| L4 | TLA+ L3 最细粒度（原子方法行为） | 单个方法/函数的原子行为场景 | 阶段 4 | 阶段 5（TDD 夹具） | `features/L4/` |

> **TLA+ L4 说明**：既有 TLA+ 分层只到 L3（原子子系统行为）。BDD L4 对应 TLA+ L3 的最细粒度（原子方法级），即 BDD L4 features 与 TLA+ L3 spec 内部最细粒度的方法级行为对齐。若后续 TLA+ 扩展 L4 层级，则 BDD L4 直接与 TLA+ L4 一一对应；当前实现按 BDD L4 ↔ TLA+ L3（最细粒度）处理。

### §1.2 与 W 模型 8 阶段对应表

| 阶段 | 开发活动（左 V） | 同步 BDD 设计 | 执行 BDD | 子代理分派 |
|---|---|---|---|---|
| 1 需求分析 | REQ 产出 | L1 features 设计（验收测试设计） | — | S-doc 产出 features + S-bdd 维护 manifest |
| 2 系统设计 | SD 产出 | L2 features 设计（系统测试设计） | — | S-doc + S-bdd |
| 3 概要设计 | INTF 产出 | L3 features 设计（集成测试设计） | — | S-doc + S-bdd |
| 4 详细设计 | DD 产出 | L4 features 设计（单元测试设计） | — | S-doc + S-bdd |
| 5 编码实现 | 代码 + step definitions | L4 features 作为 TDD 夹具驱动编码 | L4 features 执行 | S-code 实现 step + 代码；G 跑 cucumber L4 |
| 6 集成测试 | — | — | L3 features 执行 | S-test 运行 cucumber L3 |
| 7 系统测试 | — | — | L2 features 执行 | S-test 运行 cucumber L2 |
| 8 验收测试 | — | — | L1 features 执行 | S-test 运行 cucumber L1；G 终检 check-bdd-model.ts |

### §1.3 协作原则

- **同层对应**：L1 BDD features ↔ L1 TLA+ spec；L2 ↔ L2；L3 ↔ L3；L4 ↔ L4
- **最细粒度对齐**：BDD L4 与 TLA+ L4 都到原子方法（如 `TokenStore.issue()` / `ArticleStore.getById()`）
- **独立维护**：BDD features 与 TLA+ spec 独立产出与维护，依靠 `check-bdd-model.ts` 等价性校验保证一致
- **独立门禁回退**：BDD 门禁失败回退 BDD，TLA+ 门禁失败回退 TLA+，不互相牵连
- **不一致走 R→V**：BDD↔TLA+ 不一致由 R 子代理定位根因，V 子代理验证分析

---

## §2 features 文件结构与头标注契约

> 详参见 spec §4。

### §2.1 头标注格式（Gherkin 注释块 + @key）

每个 .feature 文件顶部用 `#` 注释块声明元数据：

```gherkin
# @req: REQ-001, REQ-002
# @design: SD-3.2.1, INTF-3.1.2
# @system: L1_blog_system
# @tla-spec: L1_blog_system
# @state-machine: SM-L1-blog_system
# @parent-features: (none)
# @sibling-features: L1_blog_blogger_subsystem-001.feature
# @child-features: L2_blog_auth_subsystem-001.feature, L2_blog_article_subsystem-001.feature
# @scenario-id-prefix: BDD-L1
Feature: 博客系统端到端用户场景
  作为博客系统的最终用户
  我希望完成注册、登录、发文、评论的端到端流程
  以便验证系统满足用户需求
```

### §2.2 头标注字段契约

| 字段 | 必填 | 取值 | 校验规则 |
|---|---|---|---|
| `@req` | 是 | 逗号分隔的 REQ ID | 每个 ID 须在 RTM 中存在 |
| `@design` | 是 | 逗号分隔的 SD/INTF/DD ID | 每个 ID 须在图谱中存在 |
| `@system` | 是 | `<level>_<system>` 命名 | 与文件名前缀一致；与同层 TLA+ MODULE 名一致 |
| `@tla-spec` | 是 | 同层 TLA+ spec ID | 须在 tla-manifest.json 中存在 |
| `@state-machine` | 是 | `SM-L<level>-<system>` | 须在 bdd-manifest.json 中存在 |
| `@parent-features` | L1 可填 `(none)`；L2-L4 必填 | 上级 features 文件名列表 | L2 的 parent 须在 L1；L3 的 parent 须在 L2；L4 的 parent 须在 L3 |
| `@sibling-features` | 可填 `(none)` | 同级 features 文件名列表 | 须在 bdd-manifest.json 中存在 |
| `@child-features` | L4 可填 `(none)`；L1-L3 必填 | 下级 features 文件名列表 | L1 的 child 须在 L2；L2 的 child 须在 L3；L3 的 child 须在 L4 |
| `@scenario-id-prefix` | 是 | `BDD-L<level>` | 用于 scenario 内 TAG 命名 |

### §2.3 文件命名规则

```
L<level>_<system>[_<subsystem>][_<atom>]-<feature-num>.feature
```

| 层级 | 命名示例 |
|---|---|
| L1 | `L1_blog_system-001.feature` |
| L2 | `L2_blog_system_auth-001.feature` |
| L3 | `L3_blog_system_article_store-001.feature` |
| L4 | `L4_blog_system_token_store_issue-001.feature` |

> 命名规则与 TLA+ MODULE 命名（`L1_blog_system` / `L2_auth_subsystem` / `L3_token_store`）对称，下划线分隔、字母开头、仅含字母数字下划线。

---

## §3 状态机七要素约束

> 详参见 spec §5。

### §3.1 Background 节契约

每个 .feature 文件必须在 `Feature:` 行之后、第一个 `Scenario:` 之前包含 Background 节，用 Gherkin 注释声明七要素：

```gherkin
Feature: 博客系统端到端用户场景
  ...

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
  #   Authenticated + logout -> LoggedOut [action: revokeSession]
  # @invariants:
  #   Authenticated => sessionValid
  #   Authorized => role != null
  Given 系统处于初始状态
```

### §3.2 七要素完整性约束

> 「必填」指字段必须在 Background 节中声明；值可为空集 `()` 的字段，声明 `()` 视为该字段已填（值为空集），不视为缺失。

| 要素 | 字段 | 必填 | 约束 |
|---|---|---|---|
| 状态集 | `@states` | 是 | ≥1 个状态，逗号分隔（不允许空集） |
| 初始状态 | `@initial-state` | 是 | 必须在 `@states` 中 |
| 终态集 | `@terminal-states` | 是（值可空） | 字段必须声明；若声明为 `()` 表示无终态；若声明非空，每个终态必须在 `@states` 中 |
| 可接受状态 | `@accepting-states` | 是（值不可空） | 每个必须在 `@states` 中；至少 1 个（终态语义） |
| 可拒绝状态 | `@rejecting-states` | 是（值可空） | 字段必须声明；若声明为 `()` 表示无可拒绝状态；若声明非空，每个必须在 `@states` 中 |
| 转移表 | `@transitions` | 是 | ≥1 条转移；格式 `From + Event -> To [guard: ...] [action: ...]` |
| 不变式集 | `@invariants` | 是 | ≥1 条不变式；逻辑表达式 |

### §3.3 转移表格式

每行一条转移：

```
<From> + <Event> -> <To> [guard: <condition>] [action: <sideEffect>]
```

- `From` / `To`：必须在 `@states` 中
- `Event`：动词原形（如 `login` / `authorize` / `logout`）
- `[guard: ...]`：可选触发条件，逻辑表达式
- `[action: ...]`：可选副作用，动词原形

### §3.4 Scenario 与状态机对应关系

```gherkin
@REQ-001 @SD-3.2.1 @UAT-001 @high
Scenario: 用户使用邮箱密码登录成功
  Given 系统处于 "Unauthenticated" 状态
  And 用户输入有效凭据 "user@example.com" / "password123"
  When 用户提交登录请求
  Then 系统应转移到 "Authenticated" 状态
  And 不变式 "Authenticated => sessionValid" 应成立
```

#### §3.4.1 Scenario 步骤与状态机对应

| Gherkin 关键字 | 对应状态机要素 | 校验规则 |
|---|---|---|
| `Given` 起始状态声明 | `@initial-state` 或转移表中可达状态 | 必须在 `@states` 中 |
| `When` 事件 | `@transitions` 中的 Event | 必须在转移表中有匹配的 `From + Event` 记录 |
| `Then` 终态断言 | 转移表中的 `To` | 转移后的状态必须与 `Then` 声明一致 |
| `And` 不变式断言 | `@invariants` | 必须引用 `@invariants` 中已声明的不变式 |

#### §3.4.2 Scenario 路径合法性

门禁校验：每个 scenario 的 `Given → When → Then` 必须构成转移表中的合法路径。

```
状态机转移表：
  Unauthenticated + login -> Authenticated

Scenario 路径：
  Given Unauthenticated + When login + Then Authenticated  ✓ 合法

Scenario 路径（非法）：
  Given Unauthenticated + When logout + Then LoggedOut    ✗ 非法（转移表中无此 From+Event 组合）
```

#### §3.4.3 多事件 scenario 链式处理

scenario 可含多个 When 步骤（用 `And` 连接），按顺序构成状态转移链：

```gherkin
Given 状态 A        # 起始状态
When 事件 e1         # A + e1 -> B
And 事件 e2          # B + e2 -> C
Then 状态 C          # 终态断言
```

校验算法按链式查找：S0 + e1 -> S1, S1 + e2 -> S2, ... 最终 Sn 必须与 `Then` 声明的终态一致。

---

## §4 BDD↔TLA+ 协作

> 详参见 spec §6。

### §4.1 独立门禁回退原则

BDD 与 TLA+ 是两个独立的行为规格来源，互不替代：

- BDD 门禁失败（check-bdd-model.ts exitCode != 0）→ 回退 BDD 子流程，不影响 TLA+
- TLA+ 门禁失败（check-tla-model.ts exitCode != 0）→ 回退 TLA+ 子流程，不影响 BDD
- 两者各自走 V→G→R→V→G→S-fix 循环

### §4.2 等价性跨校验

`check-bdd-model.ts` 在阶段 1-4 门禁时执行 BDD↔TLA+ 等价性校验：

| 校验维度 | 算法 |
|---|---|
| 状态集等价 | `set(BDD.states) == set(TLA+ State 集合)`（双向包含） |
| 转移集等价 | `set((From, Event, To) for BDD) == set((From, Event, To) for TLA+ Next 分支)`（双向包含） |
| 初始状态一致 | `BDD.initialState == TLA+ Init` |
| 不变式集等价 | **两阶段校验**：第一阶段做归一化字符串匹配（去前后空格 + 小写 + 去除多余空白）；若第一阶段失败，由 R 子代理判定语义等价性（允许措辞不同） |

> TLA+ State 集合与 Next 分支由 `tla-logic.ts` 解析 .tla 文件得出；BDD 状态集与转移表由 `bdd-logic.ts` 解析 Background 节得出。

### §4.3 不一致处理流程（R→V）

```
check-bdd-model.ts 检测到不等价
  ↓
编排者分派 R 子代理
  ↓ 接收 reworkHints + BDD features + TLA+ spec + 需求/设计文档
R 子代理根因分析（5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯）
  ↓ 产出 RootCauseReport
V 子代理复审 R 报告
  ↓ check-rootcause-report.ts exitCode=0
判定：实质一致（措辞不同）还是实质不一致？
  ├─ 实质一致（如 BDD 用 "Authenticated" / TLA+ 用 "AUTH"）：放行，记录到 R 报告
  └─ 实质不一致：上报人类决策
      ├─ 选项 A：修正 BDD features（BDD 偏离）
      ├─ 选项 B：修正 TLA+ spec（TLA+ 偏离）
      └─ 选项 C：修正需求/设计（BDD 与 TLA+ 都正确，但需求/设计本身有缺陷）
          ↓ 人手决定后
          S-fix 携 R 报告执行修正 → V 复审 → G 门禁 exitCode=0
```

### §4.4 联网调研约束

R 子代理在判定「实质一致 vs 实质不一致」时允许联网搜索深度调研（如查 TLA+ 标准语义、Gherkin 语义、领域知识），但必须基于事实工作，调研结果须在 RootCauseReport 的 `evidence` 字段中标注来源 URL 与检索时间。

---

## §5 门禁脚本调用

> 详参见 spec §7。

### §5.1 新增脚本

| 脚本 | 路径 | 用途 | 退出码 |
|---|---|---|---|
| `check-bdd-model.ts` | `w-model-dev/scripts/check-bdd-model.ts` | BDD features 静态结构门禁 | 0=通过 / 1=校验失败 / 2=输入错误 |
| `bdd-logic.ts` | `w-model-dev/scripts/bdd-logic.ts` | BDD 业务规则校验逻辑（被 check-bdd-model.ts 调用） | — |

### §5.2 check-bdd-model.ts 7 个校验维度

| 维度 | 名称 | 校验内容 | 阶段边界 |
|---|---|---|---|
| D1 | headerCompleteness | features 文件头标注完整性 | 阶段 1-8 |
| D2 | gherkinSyntax | Gherkin 语法（cucumber 静态加载校验） | 阶段 1-8 |
| D3 | stateMachineCompleteness | Background 状态机七要素 | 阶段 1-8 |
| D4 | tlaEquivalence | BDD↔TLA+ 等价性 | 阶段 1-8 |
| D5 | stepBinding | step definitions 绑定完整性 | 阶段 1-4 跳过；阶段 5-8 强制 |
| D6 | scenarioPathValidity | scenario Given→When→Then 是合法路径 | 阶段 1-8 |
| D7 | rtmMapping | 与 RTM 映射 | 阶段 1-8 |

> **阶段边界说明**：阶段 1-4（设计阶段）D5 跳过（step definitions 尚未实现），由 D6（scenario 路径合法性）+ D7（RTM 映射）替代校验；阶段 5-8（执行阶段）D5 强制校验。

### §5.3 调用方式

```bash
# 阶段 1-4 门禁（静态结构校验，不跑 cucumber）
npx tsx w-model-dev/scripts/check-bdd-model.ts <bdd-manifest.json> \
  --phase=1|2|3|4 \
  [--tla-manifest=<tla-manifest.json>] \
  [--rtm=<rtm.json>] \
  [--graph=<graph.json>]

# 阶段 5-8 终检（含 cucumber 执行结果校验）
npx tsx w-model-dev/scripts/check-bdd-model.ts <bdd-manifest.json> \
  --phase=5|6|7|8 \
  --cucumber-report=<.w-model/bdd/reports/report.json> \
  [--tla-manifest=<tla-manifest.json>] \
  [--rtm=<rtm.json>]
```

### §5.4 退出码与 JSON 摘要

- 退出码 0 = 所有维度通过
- 退出码 1 = 至少 1 个维度有 violation
- 退出码 2 = 输入错误（manifest 不存在 / schema 不合规 / phase 非法）

JSON 摘要写入 `.w-model/gate-logs/<timestamp>-bdd.json`，含 `exitCode` 字段（与 check-run-log.ts R6 交叉校验一致）。

### §5.5 反模式 #28 兼容

`bdd-logic.ts` 入口必须先调用 `validateBySchema('bdd-manifest', input)`，失败时以 `[schema]` 前缀返回错误（防反模式 #28 schema 前置校验缺失）。

---

## §6 8 阶段产出时序

> 详参见 spec §8。

### §6.1 阶段总表

| 阶段 | BDD 产出 | 执行场景 | 子代理 | 门禁 |
|---|---|---|---|---|
| 1 需求分析 | L1 features + manifest | — | S-doc + S-bdd | check-bdd-model.ts --phase=1 |
| 2 系统设计 | L2 features + manifest 更新 | — | S-doc + S-bdd | check-bdd-model.ts --phase=2 |
| 3 概要设计 | L3 features + manifest 更新 | — | S-doc + S-bdd | check-bdd-model.ts --phase=3 |
| 4 详细设计 | L4 features + manifest 更新 | — | S-doc + S-bdd | check-bdd-model.ts --phase=4 |
| 5 编码实现 | step definitions + 业务代码 | L4 features TDD 夹具 | S-code | check-bdd-model.ts --phase=5 |
| 6 集成测试 | — | L3 features 执行 | S-test | check-bdd-model.ts --phase=6 |
| 7 系统测试 | — | L2 features 执行 | S-test | check-bdd-model.ts --phase=7 |
| 8 验收测试 | — | L1 features 执行 | S-test + G | check-bdd-model.ts --phase=8 终检 |

### §6.2 阶段 1（L1 features 设计）步骤

| 步骤 | 子代理 | 产出 |
|---|---|---|
| 1 | S-doc | 套用 `templates/requirement-spec.md` 产出需求规格 |
| 2 | S-bdd | 套用 `templates/feature.template` 产出 L1 features（每个 REQ ≥1 个 .feature 文件） |
| 3 | S-bdd | 在 Background 节声明 L1 状态机七要素 |
| 4 | S-bdd | 更新 `.w-model/bdd-manifest.json`（features + stateMachines） |
| 5 | S-bdd | 在 RTM `acceptanceTest` 列登记 `UAT-NNN \| BDD-L1-<system>-<num>.feature` |
| 6 | V | 评审 features（targetKind=test + bdd-review-checklist） |
| 7 | G | 跑 `check-bdd-model.ts --phase=1` 校验 D1-D7（D5 step 绑定可暂缺，由 D6/D7 替代校验） |
| 8 | O | CHECKPOINT 用户确认 → 放行 |

### §6.3 阶段 5（L4 features 作为 TDD 夹具）步骤

| 步骤 | 子代理 | 产出 |
|---|---|---|
| 1 | S-code | 先跑 `npx cucumber-js features/L4/` 观察 all scenarios fail（红） |
| 2 | S-code | 实现 step definitions（`features/step_definitions/L4_*.steps.ts`）+ 业务代码 |
| 3 | S-code | 重跑 cucumber 直到 all scenarios pass（绿） |
| 4 | S-code | 重构代码（保持 scenarios 绿） |
| 5 | V | 评审代码（targetKind=code + 五轴评审） |
| 6 | G | 跑 `check-bdd-model.ts --phase=5 --cucumber-report=<report.json>` 校验 D5（step 绑定）+ D6（scenario 路径）+ cucumber 报告无失败 |
| 7 | O | CHECKPOINT → 放行 |

> 阶段 2/3/4 同阶段 1 流程，产出对应层级 features；阶段 6/7/8 同阶段 5 执行流程，跑对应层级 cucumber。

---

## §7 验收夹具四类设计

> 详参见 spec §9。

### §7.1 四类夹具

| 夹具类型 | 位置 | 用途 |
|---|---|---|
| Cucumber World 对象 | `features/fixtures/world/custom-world.ts` | 跨 step 共享状态（如已认证用户、已创建资源） |
| 测试数据 fixture | `features/fixtures/data/*.json` | scenario 初始数据（如 `users.json` / `articles.json`） |
| 环境准备 setup/teardown | `features/fixtures/hooks/*.ts` | BeforeAll 启动 server / AfterAll 关闭 server / Before 每个 scenario 重置 DB |
| 验收产出快照 fixture | `features/fixtures/snapshots/*.json` | golden test 预期产出快照 |

### §7.2 Cucumber World 对象

```typescript
// features/fixtures/world/custom-world.ts
import { World, setWorldConstructor } from '@cucumber/cucumber';

export interface CustomWorld extends World {
  server: { app: ExpressApp; baseUrl: string } | null;
  authenticatedUser: { token: string; userId: string; role: string } | null;
  lastResponse: { status: number; body: unknown } | null;
  sharedState: Record<string, unknown>;
}

setWorldConstructor(class extends World implements CustomWorld {
  server = null;
  authenticatedUser = null;
  lastResponse = null;
  sharedState = {};
});
```

### §7.3 测试数据 fixture

JSON 格式，scenario 通过 `Given` 步骤加载：

```gherkin
Given 以下数据存在（来源：fixtures/data/users.json）
  | id       | email             | role     |
  | user-001 | alice@example.com | reader   |
  | user-002 | bob@example.com   | blogger  |
```

step definition 读取 fixture 文件并加载到内存数据库。

### §7.4 环境准备 setup/teardown

```typescript
// features/fixtures/hooks/global-setup.ts
import { BeforeAll } from '@cucumber/cucumber';
import { createApp } from '../../../src/app';

BeforeAll(async function () {
  const app = await createApp({ storage: 'memory' });
  const server = app.listen(0);  // 0 = 随机端口
  (this as CustomWorld).server = { app, baseUrl: `http://localhost:${server.address().port}` };
});

// features/fixtures/hooks/scenario-reset.ts
import { Before } from '@cucumber/cucumber';

Before(async function () {
  (this as CustomWorld).authenticatedUser = null;
  (this as CustomWorld).lastResponse = null;
  (this as CustomWorld).sharedState = {};
  await resetDatabase();  // 重置内存数据库
});
```

### §7.5 验收产出快照 fixture

```gherkin
Then 响应应该与快照 "articles-list-001.json" 一致
```

step definition 加载快照 JSON，与 `this.lastResponse` 深度比对（允许字段白名单忽略，如 `createdAt` 时间戳）。

### §7.6 夹具命名约定

| 夹具类型 | 命名规则 | 示例 |
|---|---|---|
| 数据 fixture | `<entity>s.json`（复数） | `users.json` / `articles.json` |
| 快照 fixture | `<scenario-context>-<num>.json` | `articles-list-001.json` |
| World 扩展 | `custom-world.ts`（单文件） | — |
| Hooks | `<purpose>.ts`（语义命名） | `global-setup.ts` / `scenario-reset.ts` |

### §7.7 夹具完备性校验

check-bdd-model.ts D5（step 绑定）扩展校验：
- scenario 引用的 fixture 文件名（在 step 文本中匹配 `fixtures/<type>/<name>.json`）必须存在于 `features/fixtures/` 对应子目录
- 引用不存在的 fixture → violation，退出码 1

---

## §8 不符处理流程

> 详参见 spec §10。

### §8.1 反模式 #29（新增）

**反模式 #29**：BDD 建模与需求/设计/TLA+ 不符未回退

**危害**：BDD 规格形同虚设，与 TLA+ 行为规格不一致或与需求/设计脱节，问题后移到编码或测试执行阶段

**正确做法**：
- BDD features 必须忠实于需求/设计，符合后仍有问题须修正需求/设计并回退重跑（仿反模式 #17）
- BDD↔TLA+ 不等价时必须走 R→V→G→S-fix 循环（§4.3），不得直接放行
- 接受措辞不同但实质一致的等价性（由 R 子代理判定 + V 子代理验证）
- 实质不一致必须上报人类决策，提供修正 BDD / 修正 TLA+ / 修正需求设计三个可选项

### §8.2 R 子代理流程

```
V/G 不通过（BDD 不符需求/设计 或 BDD↔TLA+ 不等价）
  ↓
编排者分派 R 子代理
  ↓ 输入：reworkHints + BDD features + TLA+ spec + 需求/设计文档 + 检查报告
R 子代理根因分析
  ↓ 5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯
  ↓ 允许联网调研（须基于事实，evidence 标注 URL + 检索时间）
R 子代理产出 RootCauseReport
  ↓ 含根因分类：BDD 偏离 / TLA+ 偏离 / 需求设计缺陷 / 措辞差异（实质一致）
V 子代理复审 R 报告
  ↓ check-rootcause-report.ts exitCode=0
判定根因分类
  ├─ 措辞差异（实质一致）：放行，R 报告记录判定依据
  ├─ BDD 偏离：S-fix 修正 BDD features + bdd-manifest.json → V 复审 → G 门禁
  ├─ TLA+ 偏离：S-fix 修正 TLA+ spec → V 复审 → G 门禁
  └─ 需求/设计缺陷：上报人类决策
      ├─ 选项 A：修正需求 → 回退到阶段 1 重跑
      ├─ 选项 B：修正设计 → 回退到阶段 2/3/4 重跑
      └─ 选项 C：接受缺陷并标注 RISK-NNN（用户显式接受）
```

### §8.3 联网调研约束

- R 子代理判定「实质一致 vs 实质不一致」时允许联网搜索
- 调研范围：TLA+ 标准语义、Gherkin 语法语义、领域知识、设计模式
- 必须基于事实工作，禁止凭印象判定
- 调研结果须在 RootCauseReport 的 `evidence` 字段中标注：
  - 来源 URL
  - 检索时间（ISO 8601）
  - 引用片段（≤200 字）
- 调研结果须经 V 子代理复审（V 须独立验证调研结论的可信度）

---

## §9 TLA+/BDD 自动化同步校验（第22轮 P3-10 修正）

> BDD features 与 TLA+ 规格的等价性维护成本高，手动比对易遗漏。新增 `check-tla-bdd-sync.ts` 脚本自动化 diff 比对。

### 校验内容

| 维度 | TLA+ 来源 | BDD 来源 | 比对规则 |
|---|---|---|---|
| 转移名 | `Next == \/ Act1 \/ Act2` | Background 节 `When` 步骤 | 名称完全一致 |
| 状态名 | `vars` 声明 | Background 节 `Given` 步骤 | 名称完全一致 |
| 不变式名 | `Inv == ...` | Background 节 `Then` 步骤 | 名称完全一致 |

### 脚本调用

```bash
npx tsx scripts/check-tla-bdd-sync.ts <tla-file> <feature-file>
```

退出码：0=一致 / 1=有差异 / 2=输入错误

### 与 check-bdd-model.ts D4 的关系

`check-bdd-model.ts` D4 等价性校验在阶段门禁时执行；`check-tla-bdd-sync.ts` 作为独立开发工具，便于在编写 TLA+/BDD 时快速验证一致性。两者可互补使用。

## W 模型交叉引用

- [反模式 #29](./anti-patterns.md)：BDD 建模与需求/设计/TLA+ 不符未回退
- [bdd-review-checklist.md](./bdd-review-checklist.md)：BDD 评审 7 项清单（V 子代理用）
- [bdd-syntax-reference.md](./bdd-syntax-reference.md)：Gherkin 完整语法参考
- [bdd-patterns-examples.md](./bdd-patterns-examples.md)：BDD 模式示例库（按 L1/L2/L3/L4 分类）
- [tla-plus-guide.md](./tla-plus-guide.md)：TLA+ 建模指南（BDD 与之正交协作）
- [verifier-spec.md §7.3](./verifier-spec.md)：测试用例评审 5 维度（BDD features 评审用 `targetKind=test` + bdd-review-checklist）
- [rtm-guide.md](./rtm-guide.md)：RTM 字段登记契约（BDD 引用附加格式约定）
