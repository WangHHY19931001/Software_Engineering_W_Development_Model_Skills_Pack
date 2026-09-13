# BDD 建模与验收夹具指南（BDD Guide）

> 本文件定义 BDD（Behavior-Driven Development）建模与验收夹具的可执行细则：features 文件头标注、状态机七要素、门禁脚本用法、阶段产出契约。
> S 子代理（产出 .feature + 更新 bdd-manifest.json）、V 子代理（评审合规性）、G 子代理（跑 check-bdd-model.ts）必读。
> 权威设计见 `docs/superpowers/specs/2026-07-27-bdd-modeling-and-acceptance-fixture-design.md`。

## 速查摘要

> 一页速查：BDD 建模与验收夹具细则。行为具象化门禁（第四维度），与结构连通（graph）、信息流（dataflow）、行为正确性（TLA+）正交。S/V/G 子代理必读。

| 维度 | 核心锚点 | 详见 |
|---|---|---|
| 公理 | BDD features 是 TLA+ 抽象规格的具象化层，靠 check-bdd-model.ts 等价性校验保证一致 | 「公理」节 |
| 分层架构 | L1↔L1 ... L4↔L4 与 TLA+ 对称，最细粒度到原子方法 | §1 |
| 头标注契约 | 10 个 `@` 字段（@req/@design/@designIds/@tla-spec/@state-machine 等） | §2 |
| 状态机七要素 | @states/@initial-state/@terminal-states/@accepting-states/@rejecting-states/@transitions/@invariants | §3 |
| BDD↔TLA+ 协作 | 独立门禁回退 + 等价性跨校验（D4）+ 不一致走 R→V | §4 |
| 记叙性优先 | 测试断言不是金标准，失败先归因（呼应反模式 #45） | 「记叙性优先」节 |
| 门禁脚本 | check-bdd-model.ts 8 维度（D1-D8）+ 退出码 | §5 |
| 阶段产出时序 | 阶段 1-4 设计 features，5-8 执行 | §6 |
| 验收夹具 | World / 数据 fixture / setup-teardown / 快照 四类 | §7 |
| 不符处理流程 | 反模式 #29 + R 子代理流程 + 联网调研约束 | §8 |
| 同步校验 | check-tla-bdd-sync.ts | §9 |

**按场景只读 §X**：

| 场景 | 应读章节 |
|---|---|
| 产出 .feature 前（头标注/命名） | §2 |
| 声明状态机七要素 | §3 |
| BDD↔TLA+ 等价性 / 不一致处理 | §4 |
| G 跑门禁脚本（8 维度） | §5 |
| 各阶段产出时序 | §6 |
| 设计验收夹具 | §7 |
| 建模不符回退 | §8 |
| S-ingest-bdd 回填覆盖率 | 「S-ingest-bdd 子代理」节 |

## 所属系统

- **所属技能**：w-model-dev
- **关联需求设计**：
- **同级文件**：[tla-plus.md](./tla-plus.md)（TLA+ 行为规格，BDD 与之正交协作）
- **下级内容节**（42.0.0 合并为本文件节）：[评审清单](#评审清单)（V 子代理评审清单）/ [语法速查](#语法速查)（Gherkin 语法参考）/ [模式与示例](#模式与示例)（BDD 模式示例库，按 L1/L2/L3/L4 分类）
- **模板文件**：[../templates/feature.template](../templates/feature.template)、[../templates/bdd-manifest.template.json](../templates/bdd-manifest.template.json)
- **门禁脚本**：[../scripts/cli/check-bdd-model.ts](../scripts/cli/check-bdd-model.ts)、[../scripts/logic/bdd-logic.ts](../scripts/logic/bdd-logic.ts)
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
| （无 BDD 专属 devDep） | — | features 场景解析为手写正则（`bdd-logic.ts` 的 `parseFeatureFile`），由 `check-bdd-model.ts` 在阶段 1-8 BDD 模型门禁时调用 |

> 场景解析为手写正则（`bdd-logic.ts` 的 `parseFeatureFile`），不依赖 Cucumber.js/Gherkin 解析器。阶段 5-8 若需实际执行 scenarios（验收测试），Cucumber 运行器由消费方自行安装，仓库不内置；undefined/pending step 视为失败（D5 step 绑定校验），与门禁退出码语义一致。

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
| L4 | TLA+ L4（按需；缺省对齐 L3 最细粒度） | 单个方法/函数的原子行为场景 | 阶段 4 | 阶段 5（TDD 夹具） | `features/L4/` |

> **TLA+ L4 说明**：TLA+ 分层为 L1-L3 + 按需 L4（递归拆解，阶段 4 按需，见 [tla-plus.md](tla-plus.md)）。BDD L4 与 TLA+ L4 同层对应（都到原子方法）；未产出 TLA+ L4 时，BDD L4 与 TLA+ L3 的最细粒度（原子方法级）对齐。

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
- **独立门禁回退**：BDD 门禁失败或 TLA+ 门禁失败只标记对应行为门的 R 定位线索；普通失败仍统一执行普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节），不互相牵连
- **不一致走 R→V**：BDD↔TLA+ 不一致由 R 子代理定位根因，V 子代理复审 RootCauseReport，G 根因门禁通过后才可 S-fix

---

## §2 features 文件结构与头标注契约

> 详参见 spec §4。

### §2.1 头标注格式（Gherkin 注释块 + @key）

每个 .feature 文件顶部用 `#` 注释块声明元数据：

```gherkin
# @req: REQ-001, REQ-002
# @design: SD-3.2.1, INTF-3.1.2
# @designIds: SD-001,SD-002,SD-005
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
| `@designIds` | 是 | 逗号分隔的 SD 节点 ID | 每个 ID 须在 graph.json 中 type=SD 节点中存在 |
| `@system` | 是 | `<level>_<system>` 命名 | 与文件名前缀一致；与同层 TLA+ MODULE 名一致 |
| `@tla-spec` | 是 | 同层 TLA+ spec ID | 须在 tla-manifest.json 中存在 |
| `@state-machine` | 是 | `SM-L<level>-<system>` | 须在 bdd-manifest.json 中存在 |
| `@parent-features` | L1 可填 `(none)`；L2-L4 必填 | 上级 features 文件名列表 | L2 的 parent 须在 L1；L3 的 parent 须在 L2；L4 的 parent 须在 L3 |
| `@sibling-features` | 可填 `(none)` | 同级 features 文件名列表 | 须在 bdd-manifest.json 中存在 |
| `@child-features` | L4 可填 `(none)`；L1-L3 必填 | 下级 features 文件名列表 | L1 的 child 须在 L2；L2 的 child 须在 L3；L3 的 child 须在 L4 |
| `@scenario-id-prefix` | 是 | `BDD-L<level>` | 用于 scenario 内 TAG 命名 |

### @designIds 头标注（必填，第 10 个字段）

`.feature` 文件头部须含 `@designIds` 字段，列出本 feature 覆盖的所有 SD 节点 ID（逗号分隔）。

```
# @designIds: SD-001,SD-002,SD-005
```

S-ingest-bdd 子代理据此字段与 graph.json 比对后回填 manifest designCoverage。

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

- BDD 门禁失败（check-bdd-model.ts exitCode != 0）→ 先走普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）（R 定位根因 → V 复审 → G 门禁放行），S-fix 修复范围限于 BDD 子流程资产、对侧 TLA+ 不受影响
- TLA+ 门禁失败（check-tla-model.ts exitCode != 0）→ 先走普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）（R 定位根因 → V 复审 → G 门禁放行），S-fix 修复范围限于 TLA+ 子流程资产、对侧 BDD 不受影响
- 两者各自走普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节） 循环

### §4.2 等价性跨校验

`check-bdd-model.ts` 在阶段 1-4 门禁时可执行 BDD↔TLA+ 等价性校验；项目阶段门须传 `--require-tla-equivalence --tla-manifest=<path>`，以缺证据时的 D4 violation / exit 1 fail-closed。未传 require flag 的 fixture/兼容调用仍跳过 D4 并输出跳过原因。

| 校验维度 | 算法 |
|---|---|
| 状态集等价 | `set(BDD.states) == set(TLA+ State 集合)`（双向包含） |
| 转移集等价 | `set((From, Event, To) for BDD) == set((From, Event, To) for TLA+ Next 分支)`（双向包含） |
| 初始状态一致 | `BDD.initialState == TLA+ Init` |
| 不变式集等价 | **两阶段校验**：第一阶段做归一化字符串匹配（去前后空格 + 小写 + 去除多余空白）；若第一阶段失败，由 R 子代理判定语义等价性（允许措辞不同） |

> TLA+ State 集合与 Next 分支由 `tla-logic.ts` 解析 .tla 文件得出；BDD 状态集与转移表由 `bdd-logic.ts` 解析 Background 节得出。

#### D4 层级豁免与解析风格

- **L1 系统级规格豁免 D4 自动等价比对**：L1 是请求-响应抽象（actor/request/response 类别）而非内部状态机，`check-bdd-model.ts` 对 `level === 1` 的状态机跳过 `validateTlaEquivalence`（不产生 D4 violation）；L1 等价性由 R3/V 语义评审把关。D1/D3/D6/D7/D8 维度对 L1 仍照常校验。
- **L2+ 子系统级规格自动等价比对**：仍执行完整等价校验；快照解析（`bdd-logic.ts::parseTlaSpecSnapshot`）支持命名集合风格：
  - 状态变量取值域：`var \in {"s1", "s2", ...}`（内联枚举）或 `var \in SETNAME`（值从文件内 `SETNAME == {...}` 定义解析，支持单行/跨行）
  - 转移：`var = "From"` / `var \in {...}` / `var \in SETNAME` + `var' = "To"`
  - 不变式多形态归一化：`var = "State" => cond`、`var # "State" => cond`、`cond => (var = "State")` 均归一化为 `State => cond` 参与字符串等价比对
- 已知限制：BDD 侧对「不改变状态变量」动作的**投影自环**（如事件总线/通知/审计等横切动作在 TLA+ 中不改状态变量、BDD 投影为自环）、以及措辞不同但实质一致的不变式，自动字符串比对会报 mismatch —— 属预期行为，按 §4.3 走 R→V 语义等价判定，非 BDD 偏离。

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

## 记叙性优先

> 吸收自《agent 时代的人月神话》第 6 章：形式化定义（测试断言）在 agent 时代有一个 1975 年不存在的攻击面——它是可以被优化的目标。评分函数一旦成为目标，就会被 Goodhart 定律攻破。

- **测试断言不是金标准**：只给形式化的会收获"过了测试，但做错了事"的失败。记叙性定义（需求意图）没有可被算法直接优化的形式，守住形式化定义漏掉的部分。
- **失败先归因**：测试失败先问——是改动的错，还是断言本身写错了？该改断言就改断言，需求意图是标准。
- **与反模式 #45 呼应**：subagent 为通过测试而改测试属反指标游戏；归因流程走 R→V→G，禁止擅自改断言凑绿。

## §5 门禁脚本调用

> 详参见 spec §7。

### §5.1 新增脚本

| 脚本 | 路径 | 用途 | 退出码 |
|---|---|---|---|
| `check-bdd-model.ts` | `w-model-dev/scripts/cli/check-bdd-model.ts` | BDD features 静态结构门禁 | 0=通过 / 1=校验失败 / 2=输入错误 |
| `bdd-logic.ts` | `w-model-dev/scripts/logic/bdd-logic.ts` | BDD 业务规则校验逻辑（被 check-bdd-model.ts 调用） | — |

### §5.2 check-bdd-model.ts 8 个校验维度

| 维度 | 名称 | 校验内容 | 阶段边界 |
|---|---|---|---|
| D1 | headerCompleteness | features 文件头标注完整性 | 阶段 1-8 |
| D2 | gherkinSyntax | Gherkin 语法（cucumber 静态加载校验） | 阶段 1-8 |
| D3 | stateMachineCompleteness | Background 状态机七要素 | 阶段 1-8 |
| D4 | tlaEquivalence | BDD↔TLA+ 等价性 | phase 1-4；项目阶段门传 `--require-tla-equivalence` 强制证据 |
| D5 | stepBinding | step definitions 绑定完整性 | phase 5-8；项目阶段门传 `--require-cucumber-report` 强制证据 |
| D6 | scenarioPathValidity | scenario Given→When→Then 是合法路径 | 阶段 1-8 |
| D7 | rtmMapping | 与 RTM 映射 | 阶段 1-8 |
| D8 | sdCoverage | SD Coverage（phase>=2 强制） | 阶段 2-8 |

> **阶段边界说明**：阶段 1-4（设计阶段）D5 跳过（step definitions 尚未实现），由 D6（scenario 路径合法性）+ D7（RTM 映射）+ D8（SD Coverage，phase>=2）替代校验；阶段 5-8（执行阶段）D5 强制校验。

### §5.2.1 D8 SD Coverage（phase>=2 强制）

`check-bdd-model.ts` 在 phase>=2 时新增 D8 SD Coverage 校验维度：

1. 校验 manifest.designCoverage 字段存在且 uncoveredSdNodes 为空
2. 从 .feature 头部 @designIds 提取覆盖的 SD 节点 ID
3. 与 graph.json 中所有 type=SD 节点比对
4. uncoveredSdNodes 非空 → D8 violation，exitCode=1

designCoverage 字段由 S-ingest-bdd 子代理从 .feature 文件头部 @designIds 提取后回填 manifest。

### §5.3 调用方式

```bash
# phase 1-4 项目阶段门：必须提供 TLA+ 等价性证据
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts <bdd-manifest.json> \
  --phase=1|2|3|4 \
  --require-tla-equivalence \
  --tla-manifest=<tla-manifest.json> \
  [--rtm=<rtm.json>] \
  [--graph=<graph.json>]
```

> `--require-tla-equivalence` 仅适用于 phase 1-4；缺少 `--tla-manifest` 产生 D4 violation / exitCode=1，而不是参数错误。`--graph=<graph.json>` 在 phase>=2 时仍强制必填（D8 数据源，缺失 → exitCode=2 ARG_INVALID）；phase=1 时可选。

# phase 5-8 项目阶段门：必须提供 cucumber 执行证据
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts <bdd-manifest.json> \
  --phase=5|6|7|8 \
  --require-cucumber-report \
  --cucumber-report=<.w-model/bdd/reports/report.json> \
  --graph=<graph.json> \
  [--rtm=<rtm.json>]
```

> `--require-cucumber-report` 仅适用于 phase 5-8；缺少 `--cucumber-report`、报告不是 `{ elements: [...] }` 形状、或没有至少一个**具非空 `name` 与 `steps` 的 scenario element** 中的 `result.status="passed"`，均产生 D5 violation / exitCode=1。`failed` 只保留为失败诊断，`skipped` / `pending` / `undefined` / 未知 status 均不能作为执行证据且产生 D5 violation；匿名 element 同样拒绝。若 manifest 声明 features，零已执行 scenario 同样拒绝；门禁只要求最小执行证据，不声称未建模的 feature↔report 完全映射。两个 require flag 用在不对应 phase 均为 exitCode=2 ARG_INVALID。CLI 只接受文档列出的精确裸 require flag；`=true`、重复、拼写近似或任何未知 `--*` 均为 exitCode=2。未使用 require flag 时保留原有兼容行为：缺少输入仅跳过对应 D4/D5 并说明原因，适用于技能包 fixture 回归，不得代替项目阶段门。

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
| 1 需求分析 | L1 features + manifest | — | S-doc + S-bdd | `--phase=1 --require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json` |
| 2 系统设计 | L2 features + manifest 更新 | — | S-doc + S-bdd | `--phase=2 --require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json --graph=.w-model/ingestion/graph.json` |
| 3 概要设计 | L3 features + manifest 更新 | — | S-doc + S-bdd | `--phase=3 --require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json --graph=.w-model/ingestion/graph.json` |
| 4 详细设计 | L4 features + manifest 更新 | — | S-doc + S-bdd | `--phase=4 --require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json --graph=.w-model/ingestion/graph.json` |
| 5 编码实现 | step definitions + 业务代码 | L4 features TDD 夹具 | S-code | `--phase=5 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=reports/cucumber/unit.json` |
| 6 集成测试 | — | L3 features 执行 | S-test | `--phase=6 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=reports/cucumber/integration.json` |
| 7 系统测试 | — | L2 features 执行 | S-test | `--phase=7 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=reports/cucumber/system.json` |
| 8 验收测试 | — | L1 features 执行 | S-test + G | `--phase=8 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=reports/cucumber/acceptance.json` |

### §6.2 阶段 1（L1 features 设计）步骤

| 步骤 | 子代理 | 产出 |
|---|---|---|
| 1 | S-doc | 套用 `templates/requirement-spec.md` 产出需求规格 |
| 2 | S-bdd | 套用 `templates/feature.template` 产出 L1 features（每个 REQ ≥1 个 .feature 文件） |
| 3 | S-bdd | 在 Background 节声明 L1 状态机七要素 |
| 4 | S-bdd | 更新 `.w-model/bdd-manifest.json`（features + stateMachines） |
| 5 | S-bdd | 在 RTM `acceptanceTest` 列登记 `UAT-NNN \| BDD-L1-<system>-<num>.feature` |
| 6 | V | 评审 features（targetKind=test + 评审清单） |
| 7 | G | 跑 `check-bdd-model.ts --phase=1 --require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json` 校验 D1-D8（D5 step 绑定可暂缺，由 D6/D7 替代校验） |
| 8 | O | CHECKPOINT 用户确认 → 放行 |

### §6.3 阶段 5（L4 features 作为 TDD 夹具）步骤

| 步骤 | 子代理 | 产出 |
|---|---|---|
| 1 | S-code | 先跑 `npx cucumber-js features/L4/` 观察 all scenarios fail（红） |
| 2 | S-code | 实现 step definitions（`features/step_definitions/L4_*.steps.ts`）+ 业务代码 |
| 3 | S-code | 重跑 cucumber 直到 all scenarios pass（绿） |
| 4 | S-code | 重构代码（保持 scenarios 绿） |
| 5 | V | 评审代码（targetKind=code + 五轴评审） |
| 6 | G | 跑 `check-bdd-model.ts --phase=5 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=reports/cucumber/unit.json` 校验 D5（step 绑定）+ D6（scenario 路径）+ D8 SD Coverage + 真实 cucumber 报告 |
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

### §8.1 反模式 #29

**反模式 #29**：BDD 建模与需求/设计/TLA+ 不符未回退

**危害**：BDD 规格形同虚设，与 TLA+ 行为规格不一致或与需求/设计脱节，问题后移到编码或测试执行阶段

**正确做法**：
- BDD features 必须忠实于需求/设计，符合后仍有问题须修正需求/设计并回退重跑（仿反模式 #17）
- BDD↔TLA+ 不等价时必须走完整 R 报告复审、根因门禁、S-fix 后 R3×3/预防审查/V/G/CHECKPOINT 链（§4.3），不得直接放行
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

## §9 TLA+/BDD 自动化同步校验

> BDD features 与 TLA+ 规格的等价性维护成本高，手动比对易遗漏。新增 `check-tla-bdd-sync.ts` 脚本自动化 diff 比对。

### 校验内容

| 维度 | TLA+ 来源 | BDD 来源 | 比对规则 |
|---|---|---|---|
| 转移名 | `Next == \/ Act1 \/ Act2` | Background 节 `When` 步骤 | 名称完全一致 |
| 状态名 | `vars` 声明 | Background 节 `Given` 步骤 | 名称完全一致 |
| 不变式名 | `Inv == ...` | Background 节 `Then` 步骤 | 名称完全一致 |

### 脚本调用

```bash
npx tsx w-model-dev/scripts/cli/check-tla-bdd-sync.ts <tla-file> <feature-file>
```

退出码：0=一致 / 1=有差异 / 2=输入错误

### 与 check-bdd-model.ts D4 的关系

`check-bdd-model.ts` D4 是 BDD 门禁中的 required TLA equivalence：项目阶段 1–4 必须传裸参数 `--require-tla-equivalence --tla-manifest=<path>`，由 BDD 门禁校验状态、初始状态、转移和不变式等价；缺少或畸形 TLA evidence 不得静默跳过。

独立 `check-tla-bdd-sync.ts` pair sync 是第二条文件级同步证据，语义不等同于 D4。项目 Artifact Gate 按 SSoT §10.5.1 在 phase 1–4 启用它，但前提是 TLA/BDD manifest 均已通过各自真实 schema/资产门，并且 manifest 中 TLA spec ↔ BDD feature 配对双向完整覆盖；实现以 `isTlaBddSyncContractPhase`、`syncRequired` 和 `pairCoverageValid` 表达这三个门槛。任一方向孤儿、映射缺失或 sync 子进程失败都阻断；资产缺失/畸形由 evidence gate fail-closed，不得当作 sync skip。phase 5–8 不执行该文件同步，改用 required Cucumber report。直接运行 sync CLI 仍可作为开发工具，但不能据此宣称项目阶段门已完成。

项目门与 pre-push fixture 分层：pre-push 不传 required flags，也不调用项目 Artifact Gate、TLA↔BDD pair sync 或 Cucumber 证据。

## W 模型交叉引用

- [反模式 #29](./hard-constraints.md)：BDD 建模与需求/设计/TLA+ 不符未回退
- [bdd.md](./bdd.md)：BDD 评审 7 项清单（V 子代理用）
- [bdd.md](./bdd.md)：Gherkin 完整语法参考
- [bdd.md](./bdd.md)：BDD 模式示例库（按 L1/L2/L3/L4 分类）
- [tla-plus.md](./tla-plus.md)：TLA+ 建模指南（BDD 与之正交协作）
- [verifier-spec.md §7.3](./verifier-spec.md)：测试用例评审 5 维度（BDD features 评审用 `targetKind=test` + 评审清单）
- [rtm-guide.md](./rtm-guide.md)：RTM 字段登记契约（BDD 引用附加格式约定）

## S-ingest-bdd 子代理

BDD 覆盖率数据由独立的 S-ingest-bdd 子代理回填，非 S-bdd 自填。

分派时序：
1. S-bdd 产出 .feature/manifest 基础字段 + @designIds 头部
2. S-ingest-bdd 从 .feature 提取 @designIds + 比对 graph.json SD 节点 → 回填 manifest designCoverage
3. R3 → V → G(check-bdd-model --graph 校验)


## 语法速查


> 本文件为 Gherkin 语法通用参考，覆盖 Cucumber.js 11.x 支持的全部关键字与语法结构。
> **W 模型约束**：BDD features 文件头标注与 Background 节状态机七要素声明须遵循 [bdd.md](./bdd.md) §2-§3。
> **加载时机**：S-bdd 子代理产出 .feature 文件时必读；V-bdd 子代理评审语法合规性、G 子代理排查 D2（gherkinSyntax）违规时参考。

### 文件结构

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

### 关键字

### Feature 关键字

`Feature:` 声明功能模块，后跟功能名称与描述（可跨多行）。

```gherkin
Feature: 用户登录
  作为博客系统的最终用户
  我希望使用邮箱密码登录
  以便访问受保护资源
```

> **W 模型适配**：Feature 节前必须有文件头注释块（`# @req` / `# @design` / `# @system` 等字段，见 [bdd.md §2.2](./bdd.md#§22-头标注字段契约)）。

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

> **W 模型适配**：Background 节必须用 `#` 注释声明状态机七要素（`@states` / `@initial-state` / `@terminal-states` / `@accepting-states` / `@rejecting-states` / `@transitions` / `@invariants`），见 [bdd.md §3.1](./bdd.md#§31-background-节契约)。

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

### 步骤关键字

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

### 步骤文本

### 数据表（Data Tables）

步骤后跟表格，传递结构化数据。表格首行为表头，后续行为数据。

```gherkin
Given 以下用户已注册
  | id       | email             | role     |
  | user-001 | alice@example.com | reader   |
  | user-002 | bob@example.com   | blogger  |
```

> 数据表常用于加载测试数据 fixture（`fixtures/data/*.json`），见 [bdd.md §7.3](./bdd.md#§73-测试数据-fixture)。

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

### TAG 语法

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

> **W 模型适配**：scenario TAG 必须包含追溯 TAG（`@REQ-NNN` / `@UAT-NNN` / `@ST-NNN` / `@IT-NNN` / `@UT-NNN`）+ 优先级 TAG（`@high` / `@medium` / `@low`）+ BDD ID TAG（`@BDD-L<level>-<num>`），见 [bdd.md §2](./bdd.md#§2-features-文件结构与头标注契约) 与 spec §11.5。

### 注释语法

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

> **W 模型适配**：注释语法是 W 模型声明状态机七要素的载体（避免污染 Gherkin AST），见 [bdd.md §3.1](./bdd.md#§31-background-节契约)。

### 关键字本地化

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

### 完整示例

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

### W 模型交叉引用

- [bdd.md](./bdd.md)：BDD 建模指南（头标注 / 状态机七要素 / 门禁调用）
- [bdd.md](./bdd.md)：BDD 评审 7 项清单
- [bdd.md](./bdd.md)：BDD 模式示例库（按 L1/L2/L3/L4 分类）
- [tla-plus.md](./tla-plus.md)：TLA+ 完整语法参考（对称参考）



## 模式与示例


> 本文件为 BDD features 典型示例库，按 L1/L2/L3/L4 层级分类，提供 S-bdd 子代理在阶段 1-4 按层级选模板用的可复用模式集合。
> 每个示例包含完整 .feature 文件 + bdd-manifest.json 片段 + 状态机说明。
> **加载时机**：S-bdd 子代理在阶段 1/2/3/4 产出对应层级 features 时按需加载作为骨架模板。

### 来源说明

- **配套**：[bdd.md](./bdd.md)。
- **内容范围**：4 个层级各 1-2 个完整 .feature 示例 + 对应 bdd-manifest.json 片段 + 状态机说明。
- **场景映射**：示例覆盖端到端用户场景、子系统协作、模块集成、原子方法四类典型场景。

### W 模型适配说明

1. **文件头注释**：每个示例顶部含完整的 `# @key` 头标注（10 个字段），遵循 [bdd.md §2.2](./bdd.md#§22-头标注字段契约)。
2. **占位符语义**：所有 `@req` / `@design` / `@parent-features` / `@child-features` 标识均为**示例占位符**，按示例语义命名。实际使用时由 **S-bdd 子代理**按目标系统的真实 RTM/结构层图谱标识回填，不可直接套用。
3. **层级映射**：示例按 BDD 分层对称表（[bdd.md §1.1](./bdd.md#§11-分层对称表)）映射：
   - **L1**（端到端用户场景）：示例 1、2
   - **L2**（子系统行为 + 协作）：示例 3
   - **L3**（模块间集成 + 接口契约）：示例 4
   - **L4**（原子方法行为）：示例 5
4. **状态机七要素**：每个示例 Background 节完整声明七要素，遵循 [bdd.md §3.2](./bdd.md#§32-七要素完整性约束)。

### 示例索引

| # | 示例 | 层级 | 典型场景 | W 模型阶段 | 对应 TLA+ 层级 |
|---|---|---|---|---|---|
| 1 | 用户登录端到端 | L1 | 端到端用户场景（认证） | 阶段 1 | L1 |
| 2 | 文章发布端到端 | L1 | 端到端用户场景（内容创建） | 阶段 1 | L1 |
| 3 | 认证子系统协作 | L2 | 子系统内行为 + 协作 | 阶段 2 | L2 |
| 4 | 文章存储 + 用户认证集成 | L3 | 模块间集成 + 接口契约 | 阶段 3 | L3 |
| 5 | TokenStore.issue() 原子方法 | L4 | 单方法原子行为 | 阶段 4 | TLA+ L3 最细粒度 |

---

### Example 1: 用户登录端到端（L1）

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

### Example 2: 文章发布端到端（L1）

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

### Example 3: 认证子系统协作（L2）

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

### Example 4: 文章存储 + 用户认证集成（L3）

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

### Example 5: TokenStore.issue() 原子方法（L4）

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

### 常见场景模式总结

| 模式 | 适用层级 | 典型用法 | 示例 |
|---|---|---|---|
| 正常路径（happy path） | L1-L4 | 验证业务期望的成功路径 | 示例 1 Scenario 1 |
| 异常路径（error path） | L1-L4 | 验证凭据无效/权限不足/资源不存在等失败路径 | 示例 1 Scenario 2 / 示例 5 Scenario 2 |
| 边界路径（boundary） | L1-L4 | 验证边界条件（如 token 过期、参数边界） | 示例 3 Scenario 3 |
| 幂等性（idempotency） | L4 | 验证原子方法重复调用返回一致结果 | 示例 5 Scenario 3 |
| 多事件链式（multi-event） | L1-L3 | 验证多个 When 步骤构成的状态转移链 | 示例 1 Scenario 3 / 示例 3 Scenario 1 / 示例 4 Scenario 1 |
| 角色分支（role branching） | L1-L2 | 验证不同角色的差异化行为 | 示例 2 / 示例 3 |
| 参数化场景（scenario outline） | L1-L4 | 用 Examples 表展开多组数据 | 详见 [bdd.md](./bdd.md) |

### W 模型交叉引用

- [bdd.md](./bdd.md)：BDD 建模指南（头标注 / 状态机七要素 / 门禁调用）
- [bdd.md](./bdd.md)：BDD 评审 7 项清单
- [bdd.md](./bdd.md)：Gherkin 完整语法参考
- [tla-plus.md](./tla-plus.md)：TLA+ 模式示例库（对称参考）
- [../templates/feature.template](../templates/feature.template)：features 文件模板（套用起点）



## 评审清单


> **配套**：[bdd.md](./bdd.md)
> **W 模型适配**：不新增 `targetKind=bdd`（违反 P2.5 的 4 值枚举约束）。V-bdd 子代理评审 BDD features 时仍用 `targetKind=test`，本清单作为 §7.3「测试用例」的参考资料
> **加载时机**：V-bdd 子代理审查 BDD features 时必读

### 7 项审查清单

> 与 spec §12.3 一一对应。每项含：检查点描述 + 通过标准 + 失败处理。

### 1. 状态机七要素完整性

**检查点**：Background 节是否声明状态集/初始/终态/转移表/不变式/accepting-rejecting/guard-action 七要素。

**通过标准**：
- Background 节含全部 7 个 `@` 字段：`@states` / `@initial-state` / `@terminal-states` / `@accepting-states` / `@rejecting-states` / `@transitions` / `@invariants`
- `@states` 至少 1 个状态（不允许空集）
- `@initial-state` 在 `@states` 中
- `@terminal-states` 字段必须声明（值可空 `()`）；非空时每个在 `@states` 中
- `@accepting-states` 至少 1 个；每个在 `@states` 中
- `@rejecting-states` 字段必须声明（值可空 `()`）；非空时每个在 `@states` 中
- `@transitions` 至少 1 条转移；格式 `From + Event -> To [guard: ...] [action: ...]`；From/To 在 `@states` 中
- `@invariants` 至少 1 条不变式；逻辑表达式

**失败处理**：
- 缺失字段或值不合法 → 标注 `Critical:` reworkHint
- 触发 `check-bdd-model.ts` D3（stateMachineCompleteness）退出码 1
- 走普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节） 循环修正

### 2. scenario 路径合法性

**检查点**：每个 scenario 的 Given→When→Then 是否为状态转移表中的合法路径。

**通过标准**：
- 每个 scenario 的 `Given` 起始状态在 `@states` 中
- 每个 `When` 事件在 `@transitions` 中有匹配的 `From + Event` 记录
- 转移后的状态与 `Then` 声明一致
- 多事件 scenario（`And When` 连接）按链式查找：S0 + e1 -> S1, S1 + e2 -> S2, ..., 最终 Sn 与 `Then` 一致
- 每条转移路径完整可在转移表中复现

**失败处理**：
- 路径非法（如 `Given Unauthenticated + When logout + Then LoggedOut`，但转移表中无此 From+Event 组合）→ 标注 `Critical:` reworkHint
- 触发 `check-bdd-model.ts` D6（scenarioPathValidity）退出码 1
- 走普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节） 循环修正

### 3. TLA+ 等价性

**检查点**：BDD 状态集与同层 TLA+ spec 状态集是否等价（双向包含）。

**通过标准**：
- `set(BDD.states) == set(TLA+ State 集合)`（双向包含）
- `set((From, Event, To) for BDD) == set((From, Event, To) for TLA+ Next 分支)`（双向包含）
- `BDD.initialState == TLA+ Init`
- 不变式集等价：归一化字符串匹配通过；或 R 子代理判定实质一致（措辞不同但语义等价）

**失败处理**：
- 状态集/转移集/初始状态不等价 → 标注 `Critical:` reworkHint
- 不变式集字符串匹配失败 → 触发 R 子代理语义等价判定
  - 实质一致：放行，R 报告记录判定依据
  - 实质不一致：上报人类决策（修正 BDD / 修正 TLA+ / 修正需求设计三选项）
- 触发 `check-bdd-model.ts` D4（tlaEquivalence）退出码 1
- 走普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节） 循环

### 4. step 绑定完整性

**检查点**：所有 step 文本是否有对应 step definition（cucumber 报告无 undefined/pending）。

**通过标准**：
- **阶段 1-4**：D5 跳过（step definitions 尚未实现），由 D6（scenario 路径合法性）+ D7（RTM 映射）替代校验
- **阶段 5-8**：
  - `features/step_definitions/` 下所有 .steps.ts 文件提取 Given/When/Then 步骤文本模式
  - 每个 .feature 文件中的 step 文本均有匹配的 step definition
  - cucumber 运行报告（`.w-model/bdd/reports/report.json`）中 `undefined` / `pending` 计数为 0
  - `cucumber.js` 配置 `strict: true`（undefined/pending 视为失败）

**失败处理**：
- 存在 undefined/pending step → 标注 `Critical:` reworkHint
- 触发 `check-bdd-model.ts` D5（stepBinding）退出码 1
- 该失败只形成 R 定位线索；按普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）完成 R 报告、V 复审、G 根因门禁、S-fix、R3×3、预防审查、V/G 与 CHECKPOINT 后，才由 S-fix 补全 step definition 或修正 step/scenario

### 5. 追溯完整性

**检查点**：features 文件头标注 + scenario TAG 是否覆盖所有相关 REQ/SD/INTF/DD。

**通过标准**：
- features 文件头 `@req` 列表中的每个 REQ ID 在 RTM 中存在
- features 文件头 `@design` 列表中的每个 SD/INTF/DD ID 在图谱中存在
- features 文件头 `@tla-spec` 在 tla-manifest.json 中存在
- features 文件头 `@state-machine` 在 bdd-manifest.json 中存在
- scenario TAG 中所有 `@REQ-NNN` 必须在 features 文件头 `# @req:` 列表中
- scenario TAG 中 `@UAT-NNN` / `@ST-NNN` / `@IT-NNN` / `@UT-NNN` 必须在 RTM 对应 REQ 行的对应字段中
- 每个 REQ 至少有 1 个 scenario 的 TAG 含 `@REQ-<该 REQ ID>`
- `@parent-features` / `@child-features` 与 bdd-manifest.json 一致

**失败处理**：
- 追溯缺失或不一致 → 标注 `Critical:` reworkHint
- 触发 `check-bdd-model.ts` D1（headerCompleteness）+ D7（rtmMapping）退出码 1
- 走普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节） 循环修正

### 6. 夹具完备性

**检查点**：scenario 引用的 fixture 文件是否存在于 `features/fixtures/`。

**通过标准**：
- scenario step 文本中引用的 fixture 文件（匹配 `fixtures/<type>/<name>.json`）必须存在于 `features/fixtures/` 对应子目录
- 四类夹具位置合规：
  - Cucumber World 对象在 `features/fixtures/world/custom-world.ts`
  - 测试数据 fixture 在 `features/fixtures/data/*.json`
  - 环境准备 setup/teardown 在 `features/fixtures/hooks/*.ts`
  - 验收产出快照 fixture 在 `features/fixtures/snapshots/*.json`
- 夹具命名遵循约定（数据 `<entity>s.json` / 快照 `<scenario-context>-<num>.json`）

**失败处理**：
- 引用不存在的 fixture → 标注 `Important:` reworkHint
- 触发 `check-bdd-model.ts` D5（stepBinding）扩展校验退出码 1
- 该失败只形成 R 定位线索；完成普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）后，才由 S-fix 补全缺失 fixture 或修正引用

### 7. 不变式覆盖

**检查点**：每个状态机不变式至少有 1 个 scenario 验证（Then 步骤含断言）。

**通过标准**：
- Background 节 `@invariants` 中声明的每条不变式至少有 1 个 scenario 的 `Then` / `And` 步骤引用
- scenario 中 `And 不变式 "<表达式>" 应成立` 引用的表达式在 `@invariants` 中已声明
- 不变式断言对应的终态满足该不变式（语义校验由 V 子代理执行，门禁做存在性校验）

**失败处理**：
- 不变式未被任何 scenario 验证 → 标注 `Important:` reworkHint
- scenario 引用未声明的不变式 → 标注 `Critical:` reworkHint
- 触发 `check-bdd-model.ts` D3（stateMachineCompleteness）+ D6（scenarioPathValidity）退出码 1
- 该失败只形成 R 定位线索；完成普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）后，才由 S-fix 补充 scenario 或修正不变式引用

---

### 与 verifier-spec.md 5 维度的映射

V-bdd 子代理产出 VerifierOutput JSON 时，本清单 7 项按以下映射归入 5 维度（不修改 5 维度定义，仅作参考）：

| 本清单项 | verifier-spec.md §7.3 维度 | weight |
|---|---|---|
| 1 状态机七要素完整性 | correctness | 0.25 |
| 2 scenario 路径合法性 | correctness | 0.25 |
| 3 TLA+ 等价性 | coverage | 0.30 |
| 4 step 绑定完整性 | independence | 0.20 |
| 5 追溯完整性 | coverage | 0.30 |
| 6 夹具完备性 | independence | 0.20 |
| 7 不变式覆盖 | coverage | 0.30 |

> 完整 5 维度权重：`coverage` 0.30 / `correctness` 0.25 / `independence` 0.20 / `clarity` 0.15 / `priority-reasonableness` 0.10。

详见 [verifier-spec.md §7.3 测试用例（targetKind = `test`）](./verifier-spec.md)。

### 评审时序与门禁分工

```
阶段 N（1/2/3/4）features 设计完成
  ↓
V 子代理评审（targetKind=test + 评审清单）
  → 输出 VerifierOutput JSON（meta.targetKind='test'）
  → check-verifier-output.ts 校验 schema + 方差 + evidence（既有）
  ↓ 通过
G 子代理门禁
  → check-bdd-model.ts 静态结构校验
  → 校验 7 维度：D1 头标注 / D2 语法 / D3 状态机 / D4 TLA+ 等价 / D5 step 绑定 / D6 scenario 路径 / D7 RTM 映射
  ↓ exitCode=0
阶段门放行
```

**门禁分工原则**（与 TLA+ 对称）：
- `check-verifier-output.ts` 校验 V 评审输出的 schema 合规性（防 LLM 漂移）
- `check-bdd-model.ts` 校验 BDD features 本身的静态结构合规性（防占位/简化/错误实现）
- 两者正交：V 评审可能通过但 G 门禁失败（features 结构问题），或 V 评审失败但 G 门禁通过（features 结构合规但内容质量不足）

### evidence 引用规则

BDD features 评审的 `subCriteria[*].evidence` 须引用 features 文件内具体位置：

| 引用类型 | 格式 | 示例 |
|---|---|---|
| features 文件 + 行号 | `features/L1/blog_system-001.feature:L23-45` | scenario 步骤引用 |
| 状态机声明 | `features/L1/blog_system-001.feature:Background:L5-15` | 状态集/转移表引用 |
| scenario TAG | `features/L1/blog_system-001.feature@REQ-001:L17` | 追溯 TAG 引用 |
| step definition | `features/step_definitions/auth.steps.ts:L42-58` | step 绑定引用 |
| TLA+ spec 对照 | `tla/L1_blog_system.tla:L30-50` | 等价性 evidence |

> 与 §6.2.1 evidence 可追溯约束一致：禁止仅引用文件名不标行号。

### V 子代理自检清单扩展

在 §4.2.1 V 子代理约束清单基础上，BDD features 评审额外自检：

6. **BDD 状态机 evidence**：`coverage` 子标准的 evidence 须引用 Background 节状态机声明的具体行号，且状态数与同层 TLA+ spec 状态数一致
7. **scenario 路径 evidence**：`correctness` 子标准的 evidence 须引用至少 3 个 scenario 的 Given/When/Then 行号 + 对应状态转移表行号
8. **TLA+ 等价性 evidence**：`coverage` 子标准须包含 1 条 evidence 引用同层 TLA+ spec 的 State/Next 定义行号，证明状态集等价

### W 模型交叉引用

- [反模式 #29](./hard-constraints.md)：BDD 建模与需求/设计/TLA+ 不符未回退
- [bdd.md](./bdd.md)：BDD 建模指南（流程约束 / 头标注 / 状态机七要素 / 门禁调用）
- [bdd.md](./bdd.md)：Gherkin 完整语法
- [bdd.md](./bdd.md)：BDD 模式示例库（按 L1/L2/L3/L4 分类）
- [tla-plus.md](./tla-plus.md)：TLA+ 评审 7 项清单（对称参考）

