# BDD 建模与验收夹具设计

> **设计日期**：2026-07-27
> **SSoT 对应**：§3.4.14（新增）
> **关联技能**：w-model-dev v18.0.0 → v19.0.0
> **关联设计**：
> - 上级：[docs/skill-design-document_SSoT.md](../../skill-design-document_SSoT.md) §3.4.14
> - 同级：[docs/tla-plus-modeling-design.md](../../tla-plus-modeling-design.md)（TLA+ 行为规格，BDD 与之正交协作）
> - 同级：[2026-07-26-tla-plus-plugin-absorption-design.md](./2026-07-26-tla-plus-plugin-absorption-design.md)（TLA+ 参考资料吸收，BDD 沿用相同门禁分工模式）
> - 下级：w-model-dev/references/bdd-guide.md（待新增）、w-model-dev/references/bdd-review-checklist.md（待新增）

---

## 1. 背景与动机

### 1.1 现状

W 模型当前测试用例以 Markdown 表格形式存储（`templates/test-case.md`），由人工按场景填写步骤表格。问题：

- **场景不可执行**：测试用例是描述性表格，无法被工具直接运行，依赖人工对照执行
- **状态机隐式**：场景隐含状态转移但未显式声明，与 TLA+ 行为规格无机器可校验的对应关系
- **回归基线缺失**：阶段 6/7/8 执行测试时无独立可执行的 fixture，依赖人工挑选与运行
- **TDD 缺失**：阶段 5 编码缺少可执行的具象场景驱动开发

### 1.2 动机

引入 BDD（Behavior-Driven Development）建模补足上述缺口：

- BDD 的 Gherkin 语法（Given/When/Then）天然表达场景化的状态转移，是 TLA+ 抽象规格的具象化层
- BDD 的 features 文件 + step definitions 是可执行产物，cucumber.js 可直接运行校验
- BDD 分层与 TLA+ 分层对称（L1/L2/L3/L4），两者最细粒度都到原子方法
- BDD features 可作为 TDD 夹具驱动阶段 5 编码

### 1.3 与既有架构的契合

- **不引入 LLM 调用**：cucumber.js 是确定性运行器，features/step 是文本+代码，技能包不调用 LLM
- **门禁脚本对称**：新增 `check-bdd-model.ts` 与 `check-tla-model.ts` 风格对称（静态结构校验 + JSON 摘要 + exitCode 0/1/2）
- **不新增 targetKind**：BDD 评审用既有 `targetKind=test` + 附加 `bdd-review-checklist.md`，仿 TLA+ 用 `design` + `tla-plus-review-checklist.md` 的先例
- **不新增反模式分支**：BDD 不符处理走既有 R→V→G→S-fix 返工循环，仅新增 #29 反模式条款

---

## 2. BDD 工具链与依赖

### 2.1 工具链选择

**Cucumber.js + Gherkin**（业界主流 BDD 工具）：

| 依赖 | 版本约束 | 用途 | 安装位置 |
|---|---|---|---|
| `@cucumber/cucumber` | ^11.0.0 | BDD 运行器，解析 .feature + 执行 step definitions + 产出报告 | devDependencies |
| `@cucumber/messages` | ^27.0.0 | Gherkin AST 解析（被 cucumber 间接依赖，check-bdd-model.ts 直接 import 做静态校验） | devDependencies |

> 与现有 devDeps（ajv / eslint-plugin-security / tsx / typescript / vitest）并列，不冲突。

### 2.2 目录结构

项目根新增：

```
<project-root>/
├── features/                          # BDD 资产根目录（cucumber 默认加载位置）
│   ├── L1/                            # 阶段 1 产出的验收测试 features
│   │   └── L1_<system>-<num>.feature
│   ├── L2/                            # 阶段 2 产出的系统测试 features
│   │   └── L2_<system>_<subsystem>-<num>.feature
│   ├── L3/                            # 阶段 3 产出的集成测试 features
│   │   └── L3_<system>_<subsystem>-<num>.feature
│   ├── L4/                            # 阶段 4 产出的单元测试 features
│   │   └── L4_<system>_<subsystem>_<atom>-<num>.feature
│   ├── step_definitions/              # step 绑定代码
│   │   ├── L1_<system>.steps.ts
│   │   ├── L2_<system>_<subsystem>.steps.ts
│   │   └── ...
│   ├── fixtures/                      # 验收夹具
│   │   ├── data/                      # 测试数据 fixture（JSON）
│   │   │   ├── users.json
│   │   │   └── articles.json
│   │   ├── snapshots/                 # 验收产出快照 fixture（golden test）
│   │   │   └── articles-list-001.json
│   │   ├── world/                     # Cucumber World 对象扩展
│   │   │   └── custom-world.ts
│   │   └── hooks/                     # setup/teardown 脚本
│   │       ├── global-setup.ts        # BeforeAll：启动 Express server
│   │       ├── global-teardown.ts     # AfterAll：关闭 server
│   │       └── scenario-reset.ts      # Before：每个 scenario 重置 DB
│   └── cucumber.js                    # cucumber 配置（paths/tags/require/world）
└── .w-model/
    └── bdd-manifest.json              # BDD manifest（类比 tla-manifest.json）
```

### 2.3 cucumber.js 配置契约

```javascript
// features/cucumber.js
module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    require: ['features/step_definitions/**/*.steps.ts', 'features/fixtures/hooks/**/*.ts'],
    requireModule: ['tsx/cjs'],          // 支持 TypeScript step definitions
    format: ['summary', 'json:.w-model/bdd/reports/report.json'],
    parallel: 0,                         // 单进程保证 scenario 顺序
    retry: 0,                            // 失败不重试（与 check-*-gate.ts 退出码语义一致）
    strict: true,                        // undefined/pending step 视为失败
  },
};
```

> `strict: true` 保证 cucumber CLI exitCode 与「features/step 必须通过工具检查，不允许 undefined/pending」的硬约束一致。

### 2.4 bdd-manifest.json 契约

类比 `tla-manifest.json`，每个项目维护 `.w-model/bdd-manifest.json`：

```typescript
interface BddManifest {
  schemaVersion: '1.0';
  projectId: string;
  basePath: string;                    // 相对 manifest 文件所在目录（强制必填，仿 TLA+ P1.1）
  currentPhase: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  features: Array<{
    id: string;                        // features 文件 ID，如 'L1_blog_system-001'
    level: 1 | 2 | 3 | 4;
    filePath: string;                  // 相对 basePath
    scenarioCount: number;
    stateMachineId: string;            // 关联的状态机 ID
    tlaSpecId: string;                 // 同层 TLA+ spec ID（用于等价性校验）
    reqIds: string[];                  // 关联的 REQ ID 列表
    designIds: string[];               // 关联的 SD/INTF/DD ID 列表
    parentFeatureIds: string[];        // 上级 features（L1 无上级，L2 上级是 L1，L3 上级是 L2，L4 上级是 L3）
    siblingFeatureIds: string[];       // 同级 features
    childFeatureIds: string[];         // 下级 features
  }>;
  stateMachines: Array<{
    id: string;                        // 如 'SM-L1-blog_system'
    level: 1 | 2 | 3 | 4;
    states: string[];                  // 状态集
    initialState: string;              // 初始状态
    terminalStates: string[];          // 终态集
    acceptingStates: string[];         // 可接受状态（七要素之一）
    rejectingStates: string[];         // 可拒绝状态（七要素之一）
    transitions: Array<{
      from: string;
      event: string;
      to: string;
      guard?: string;                  // 触发条件（七要素之一）
      action?: string;                 // 副作用（七要素之一）
    }>;
    invariants: string[];              // 不变式集
  }>;
  checkRounds: Array<{                 // 仿 tla-manifest.json checkRounds
    phase: 1 | 2 | 3 | 4;
    round: number;
    timestamp: string;
    violations: string[];
    converged: boolean;
  }>;
}
```

> manifest schema 由 `schemas/bdd-manifest.schema.json`（新增）强约束，`check-bdd-model.ts` 入口先调 `validateBySchema`（防反模式 #28）。

---

## 3. BDD 分层架构与 TLA+ 对应

### 3.1 分层对称表

| BDD 层级 | 对应 TLA+ 层级 | BDD 描述对象 | 产出阶段 | 执行阶段 | features 目录 |
|---|---|---|---|---|---|
| L1 | L1（系统内外交互） | 系统与外部参与者的端到端交互场景 | 阶段 1 | 阶段 8（验收测试） | `features/L1/` |
| L2 | L2（子系统行为 + 协作） | 子系统内行为 + 兄弟子系统协作场景 | 阶段 2 | 阶段 7（系统测试） | `features/L2/` |
| L3 | L3（原子子系统行为） | 模块间集成场景 + 接口契约场景 | 阶段 3 | 阶段 6（集成测试） | `features/L3/` |
| L4 | L3（原子方法行为，TLA+ L3 的最细粒度） | 单个方法/函数的原子行为场景 | 阶段 4 | 阶段 5（TDD 夹具） | `features/L4/` |

> **TLA+ L4 说明**：既有 TLA+ 分层（参考 [2026-07-26-tla-plus-plugin-absorption-design.md](./2026-07-26-tla-plus-plugin-absorption-design.md)）只到 L3（原子子系统行为）。BDD L4 对应 TLA+ L3 的最细粒度（原子方法级），即 BDD L4 features 与 TLA+ L3 spec 内部最细粒度的方法级行为对齐。若后续 TLA+ 扩展 L4 层级，则 BDD L4 直接与 TLA+ L4 一一对应；当前实现按 BDD L4 ↔ TLA+ L3（最细粒度）处理。

### 3.2 与 W 模型 8 阶段对应表

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

### 3.3 BDD↔TLA+ 协作原则

- **同层对应**：L1 BDD features ↔ L1 TLA+ spec；L2 ↔ L2；L3 ↔ L3；L4 ↔ L4
- **最细粒度对齐**：BDD L4 与 TLA+ L4 都到原子方法（如 `TokenStore.issue()` / `ArticleStore.getById()`）
- **独立维护**：BDD features 与 TLA+ spec 独立产出与维护，依靠 `check-bdd-model.ts` 等价性校验保证一致
- **独立门禁回退**：BDD 门禁失败回退 BDD，TLA+ 门禁失败回退 TLA+，不互相牵连
- **不一致走 R→V**：BDD↔TLA+ 不一致由 R 子代理定位根因，V 子代理验证分析

---

## 4. features 文件结构与头标注

### 4.1 头标注格式（Gherkin 注释块 + @key）

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

### 4.2 头标注字段契约

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

### 4.3 文件命名规则

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

## 5. BDD 状态机完整性约束（七要素强制）

### 5.1 Background 节契约

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

### 5.2 七要素完整性约束

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

### 5.3 转移表格式

每行一条转移：

```
<From> + <Event> -> <To> [guard: <condition>] [action: <sideEffect>]
```

- `From` / `To`：必须在 `@states` 中
- `Event`：动词原形（如 `login` / `authorize` / `logout`）
- `[guard: ...]`：可选触发条件，逻辑表达式
- `[action: ...]`：可选副作用，动词原形

### 5.4 Scenario 与状态机对应关系

```gherkin
@REQ-001 @SD-3.2.1 @UAT-001 @high
Scenario: 用户使用邮箱密码登录成功
  Given 系统处于 "Unauthenticated" 状态
  And 用户输入有效凭据 "user@example.com" / "password123"
  When 用户提交登录请求
  Then 系统应转移到 "Authenticated" 状态
  And 不变式 "Authenticated => sessionValid" 应成立
```

#### 5.4.1 Scenario 步骤与状态机对应

| Gherkin 关键字 | 对应状态机要素 | 校验规则 |
|---|---|---|
| `Given` 起始状态声明 | `@initial-state` 或转移表中可达状态 | 必须在 `@states` 中 |
| `When` 事件 | `@transitions` 中的 Event | 必须在转移表中有匹配的 `From + Event` 记录 |
| `Then` 终态断言 | 转移表中的 `To` | 转移后的状态必须与 `Then` 声明一致 |
| `And` 不变式断言 | `@invariants` | 必须引用 `@invariants` 中已声明的不变式 |

#### 5.4.2 Scenario 路径合法性

门禁校验：每个 scenario 的 `Given → When → Then` 必须构成转移表中的合法路径。

```
状态机转移表：
  Unauthenticated + login -> Authenticated

Scenario 路径：
  Given Unauthenticated + When login + Then Authenticated  ✓ 合法

Scenario 路径（非法）：
  Given Unauthenticated + When logout + Then LoggedOut    ✗ 非法（转移表中无此 From+Event 组合）
```

---

## 6. BDD 与 TLA+ 协作机制

### 6.1 独立门禁回退原则

BDD 与 TLA+ 是两个独立的行为规格来源，互不替代：

- BDD 门禁失败（check-bdd-model.ts exitCode != 0）→ 回退 BDD 子流程，不影响 TLA+
- TLA+ 门禁失败（check-tla-model.ts exitCode != 0）→ 回退 TLA+ 子流程，不影响 BDD
- 两者各自走 V→G→R→V→G→S-fix 循环

### 6.2 等价性跨校验

`check-bdd-model.ts` 在阶段 1-4 门禁时执行 BDD↔TLA+ 等价性校验：

| 校验维度 | 算法 |
|---|---|
| 状态集等价 | `set(BDD.states) == set(TLA+ State 集合)`（双向包含） |
| 转移集等价 | `set((From, Event, To) for BDD) == set((From, Event, To) for TLA+ Next 分支)`（双向包含） |
| 初始状态一致 | `BDD.initialState == TLA+ Init` |
| 不变式集等价 | **两阶段校验**：第一阶段做归一化字符串匹配（去前后空格 + 小写 + 去除多余空白）；若第一阶段失败，由 R 子代理判定语义等价性（允许措辞不同） |

> TLA+ State 集合与 Next 分支由 `tla-logic.ts` 解析 .tla 文件得出；BDD 状态集与转移表由 `bdd-logic.ts` 解析 Background 节得出。

### 6.3 不一致处理流程（R→V）

当 check-bdd-model.ts 检测到 BDD↔TLA+ 不等价时：

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

### 6.4 联网调研约束

R 子代理在判定「实质一致 vs 实质不一致」时允许联网搜索深度调研（如查 TLA+ 标准语义、Gherkin 语义、领域知识），但必须基于事实工作，调研结果须在 RootCauseReport 的 `evidence` 字段中标注来源 URL 与检索时间。

---

## 7. 门禁脚本设计

### 7.1 新增脚本

| 脚本 | 路径 | 用途 | 退出码 |
|---|---|---|---|
| `check-bdd-model.ts` | `w-model-dev/scripts/check-bdd-model.ts` | BDD features 静态结构门禁 | 0=通过 / 1=校验失败 / 2=输入错误 |
| `bdd-logic.ts` | `w-model-dev/scripts/bdd-logic.ts` | BDD 业务规则校验逻辑（被 check-bdd-model.ts 调用） | — |

### 7.2 check-bdd-model.ts 7 个校验维度

```typescript
interface BddCheckResult {
  passed: boolean;
  exitCode: 0 | 1 | 2;
  checkedAt: string;
  phase: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  dimensions: {
    headerCompleteness: Violation[];     // D1: features 文件头标注完整性
    gherkinSyntax: Violation[];          // D2: Gherkin 语法（cucumber 静态加载校验）
    stateMachineCompleteness: Violation[]; // D3: Background 状态机七要素
    tlaEquivalence: Violation[];         // D4: BDD↔TLA+ 等价性
    stepBinding: Violation[];            // D5: step definitions 绑定完整性
    scenarioPathValidity: Violation[];   // D6: scenario Given→When→Then 是合法路径
    rtmMapping: Violation[];             // D7: 与 RTM 映射
  };
  summary: string;
  violations: string[];
}
```

#### D1: features 文件头标注完整性

校验每个 .feature 文件头注释块包含所有必填字段（§4.2）；`@parent-features` / `@child-features` 与 bdd-manifest.json 一致；`@tla-spec` 在 tla-manifest.json 中存在。

#### D2: Gherkin 语法

调用 `@cucumber/messages` Gherkin 解析器对每个 .feature 文件做语法校验；解析失败 → 退出码 1，violations 含具体行号。

#### D3: 状态机七要素完整性

校验 Background 节包含 `@states` / `@initial-state` / `@terminal-states` / `@accepting-states` / `@rejecting-states` / `@transitions` / `@invariants` 七要素；每要素格式合法（§5.2）；初始状态、终态、可接受/可拒绝状态均在状态集中。

#### D4: BDD↔TLA+ 等价性

调用 `tla-logic.ts` 解析同层 TLA+ spec 的 State 集合与 Next 分支；与 BDD 状态集/转移表双向包含校验（§6.2）；不变式集语义等价校验（先用字符串匹配，失败时由 R 子代理判定）。

#### D5: step definitions 绑定完整性

**阶段边界**：
- 阶段 1-4（设计阶段）：D5 跳过（step definitions 尚未实现），由 D6（scenario 路径合法性）+ D7（RTM 映射）替代校验
- 阶段 5-8（执行阶段）：D5 强制校验

**校验算法**（阶段 5-8）：
- 扫描 `features/step_definitions/` 下所有 .steps.ts 文件，提取 Given/When/Then 步骤文本模式（正则或字符串）
- 对每个 .feature 文件中的 step 文本匹配，未匹配的 step 计入 `undefinedSteps`
- cucumber 运行报告（`.w-model/bdd/reports/report.json`）中 `undefined` / `pending` 计数 > 0 时也计入

#### D6: scenario 路径合法性

**多事件 scenario 处理**：scenario 可含多个 When 步骤（用 `And` 连接），按顺序构成状态转移链：

```gherkin
Given 状态 A        # 起始状态
When 事件 e1         # A + e1 -> B
And 事件 e2          # B + e2 -> C
Then 状态 C          # 终态断言
```

**校验算法**：
1. 解析 `Given` 步骤声明的起始状态 S0
2. 按顺序解析所有 `When` / `And When` 步骤声明的事件 [e1, e2, ...]
3. 解析所有 `Then` / `And Then` 步骤声明的终态断言
4. 在状态机转移表中按链式查找：S0 + e1 -> S1, S1 + e2 -> S2, ..., 最终得到 Sn
5. 校验：每一步 (S_i, e_{i+1}) 必须在转移表中有匹配记录；最终 Sn 必须与 `Then` 声明的终态一致
6. 不变式断言：每个 `And 不变式 X 应成立` 须在 `@invariants` 中声明，且对当前状态 Sn 求值为真（语义校验由 V 子代理执行，门禁只做存在性校验）

#### D7: 与 RTM 映射

读取 `.w-model/rtm.json`，校验：
- 每个 .feature 文件头 `@req` 列表中的 REQ ID 在 RTM 中存在
- 每个 scenario TAG 中 `@UAT-NNN` / `@ST-NNN` / `@IT-NNN` / `@UT-NNN` 在 RTM 对应行字段中
- 每个 REQ 至少有 1 个 scenario TAG 含 `@REQ-<该 REQ ID>`

### 7.3 调用方式

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

### 7.4 退出码与 JSON 摘要

- 退出码 0 = 所有维度通过
- 退出码 1 = 至少 1 个维度有 violation
- 退出码 2 = 输入错误（manifest 不存在 / schema 不合规 / phase 非法）

JSON 摘要写入 `.w-model/gate-logs/<timestamp>-bdd.json`，含 `exitCode` 字段（与 check-run-log.ts R6 交叉校验一致）。

### 7.5 反模式 #28 兼容

`bdd-logic.ts` 入口必须先调用 `validateBySchema('bdd-manifest', input)`，失败时以 `[schema]` 前缀返回错误（防反模式 #28 schema 前置校验缺失）。

---

## 8. BDD 在 W 模型 8 阶段中的产出时序

### 8.1 阶段 1：需求分析 → L1 features 设计

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

### 8.2 阶段 2：系统设计 → L2 features 设计

| 步骤 | 子代理 | 产出 |
|---|---|---|
| 1 | S-doc | 套用 `templates/system-design.md` 产出系统设计 |
| 2 | S-bdd | 产出 L2 features（每个 SD ≥1 个 .feature 文件） |
| 3 | S-bdd | 在 Background 节声明 L2 状态机七要素 |
| 4 | S-bdd | 更新 bdd-manifest.json；L2 features 的 `@parent-features` 指向 L1 features |
| 5 | S-bdd | 在 RTM `systemTest` 列登记 `ST-NNN \| BDD-L2-<system>_<subsystem>-<num>.feature` |
| 6 | V | 评审 L2 features |
| 7 | G | 跑 `check-bdd-model.ts --phase=2` 校验 D1-D7 |
| 8 | O | CHECKPOINT → 放行 |

### 8.3 阶段 3：概要设计 → L3 features 设计

同阶段 2 流程，产出 L3 features（每个 INTF ≥1 个 .feature 文件），登记 RTM `integrationTest` 列为 `IT-NNN \| BDD-L3-...feature`，跑 `check-bdd-model.ts --phase=3`。

### 8.4 阶段 4：详细设计 → L4 features 设计

同阶段 3 流程，产出 L4 features（每个 DD ≥1 个 .feature 文件），登记 RTM `unitTest` 列为 `UT-NNN \| BDD-L4-...feature`，跑 `check-bdd-model.ts --phase=4`。

### 8.5 阶段 5：编码实现 → L4 features 作为 TDD 夹具

| 步骤 | 子代理 | 产出 |
|---|---|---|
| 1 | S-code | 先跑 `npx cucumber-js features/L4/` 观察 all scenarios fail（红） |
| 2 | S-code | 实现 step definitions（`features/step_definitions/L4_*.steps.ts`）+ 业务代码 |
| 3 | S-code | 重跑 cucumber 直到 all scenarios pass（绿） |
| 4 | S-code | 重构代码（保持 scenarios 绿） |
| 5 | V | 评审代码（targetKind=code + 五轴评审） |
| 6 | G | 跑 `check-bdd-model.ts --phase=5 --cucumber-report=<report.json>` 校验 D5（step 绑定）+ D6（scenario 路径）+ cucumber 报告无失败 |
| 7 | O | CHECKPOINT → 放行 |

### 8.6 阶段 6：集成测试 → L3 features 执行

| 步骤 | 子代理 | 产出 |
|---|---|---|
| 1 | S-test | 跑 `npx cucumber-js features/L3/` 执行所有 L3 scenarios |
| 2 | S-test | 失败 scenario 走 R→V→G→S-fix 循环 |
| 3 | G | 跑 `check-bdd-model.ts --phase=6 --cucumber-report=<report.json>` |
| 4 | O | CHECKPOINT → 放行 |

### 8.7 阶段 7：系统测试 → L2 features 执行

同阶段 6 流程，跑 L2 features，门禁 `--phase=7`。

### 8.8 阶段 8：验收测试 → L1 features 执行

| 步骤 | 子代理 | 产出 |
|---|---|---|
| 1 | S-test | 跑 `npx cucumber-js features/L1/` 执行所有 L1 scenarios |
| 2 | S-test | 失败 scenario 走 R→V→G→S-fix 循环 |
| 3 | G | 跑 `check-bdd-model.ts --phase=8 --cucumber-report=<report.json>` 终检 |
| 4 | G | 跑 `check-artifact-gate.ts` 终检（含 BDD 资产检查） |
| 5 | O | 🔴 CHECKPOINT-C 用户在 acceptance-test-report.md §9 确认 |

---

## 9. 验收夹具设计

### 9.1 四类夹具

| 夹具类型 | 位置 | 用途 |
|---|---|---|
| Cucumber World 对象 | `features/fixtures/world/custom-world.ts` | 跨 step 共享状态（如已认证用户、已创建资源） |
| 测试数据 fixture | `features/fixtures/data/*.json` | scenario 初始数据（如 `users.json` / `articles.json`） |
| 环境准备 setup/teardown | `features/fixtures/hooks/*.ts` | BeforeAll 启动 server / AfterAll 关闭 server / Before 每个 scenario 重置 DB |
| 验收产出快照 fixture | `features/fixtures/snapshots/*.json` | golden test 预期产出快照 |

### 9.2 Cucumber World 对象

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

### 9.3 测试数据 fixture

JSON 格式，scenario 通过 `Given` 步骤加载：

```typescript
// features/fixtures/data/users.json
{
  "users": [
    { "id": "user-001", "email": "alice@example.com", "password": "hashed-...", "role": "reader" },
    { "id": "user-002", "email": "bob@example.com", "password": "hashed-...", "role": "blogger" }
  ]
}
```

```gherkin
Given 以下数据存在（来源：fixtures/data/users.json）
  | id       | email             | role     |
  | user-001 | alice@example.com | reader   |
  | user-002 | bob@example.com   | blogger  |
```

step definition 读取 fixture 文件并加载到内存数据库。

### 9.4 环境准备 setup/teardown

```typescript
// features/fixtures/hooks/global-setup.ts
import { BeforeAll } from '@cucumber/cucumber';
import { createApp } from '../../../src/app';

BeforeAll(async function () {
  const app = await createApp({ storage: 'memory' });
  const server = app.listen(0);  // 0 = 随机端口
  (this as CustomWorld).server = { app, baseUrl: `http://localhost:${server.address().port}` };
});

// features/fixtures/hooks/global-teardown.ts
import { AfterAll } from '@cucumber/cucumber';

AfterAll(async function () {
  if ((this as CustomWorld).server) {
    (this as CustomWorld).server.app.close();
  }
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

### 9.5 验收产出快照 fixture

```typescript
// features/fixtures/snapshots/articles-list-001.json
{
  "status": 200,
  "body": {
    "articles": [
      { "id": "art-001", "title": "Hello World", "authorId": "user-002" }
    ],
    "total": 1
  }
}
```

```gherkin
Then 响应应该与快照 "articles-list-001.json" 一致
```

step definition 加载快照 JSON，与 `this.lastResponse` 深度比对（允许字段白名单忽略，如 `createdAt` 时间戳）。

### 9.6 夹具命名约定

| 夹具类型 | 命名规则 | 示例 |
|---|---|---|
| 数据 fixture | `<entity>s.json`（复数） | `users.json` / `articles.json` |
| 快照 fixture | `<scenario-context>-<num>.json` | `articles-list-001.json` |
| World 扩展 | `custom-world.ts`（单文件） | — |
| Hooks | `<purpose>.ts`（语义命名） | `global-setup.ts` / `scenario-reset.ts` |

### 9.7 夹具完备性校验

check-bdd-model.ts D5（step 绑定）扩展校验：
- scenario 引用的 fixture 文件名（在 step 文本中匹配 `fixtures/<type>/<name>.json`）必须存在于 `features/fixtures/` 对应子目录
- 引用不存在的 fixture → violation，退出码 1

---

## 10. 不符合设计时的处理流程

### 10.1 反模式 #29（新增）

**反模式 #29**：BDD 建模与需求/设计/TLA+ 不符未回退

**危害**：BDD 规格形同虚设，与 TLA+ 行为规格不一致或与需求/设计脱节，问题后移到编码或测试执行阶段

**正确做法**：
- BDD features 必须忠实于需求/设计，符合后仍有问题须修正需求/设计并回退重跑（仿反模式 #17）
- BDD↔TLA+ 不等价时必须走 R→V→G→S-fix 循环（§6.3），不得直接放行
- 接受措辞不同但实质一致的等价性（由 R 子代理判定 + V 子代理验证）
- 实质不一致必须上报人类决策，提供修正 BDD / 修正 TLA+ / 修正需求设计三个可选项

### 10.2 R 子代理流程

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

### 10.3 联网调研约束

- R 子代理判定「实质一致 vs 实质不一致」时允许联网搜索
- 调研范围：TLA+ 标准语义、Gherkin 语法语义、领域知识、设计模式
- 必须基于事实工作，禁止凭印象判定
- 调研结果须在 RootCauseReport 的 `evidence` 字段中标注：
  - 来源 URL
  - 检索时间（ISO 8601）
  - 引用片段（≤200 字）
- 调研结果须经 V 子代理复审（V 须独立验证调研结论的可信度）

---

## 11. BDD 与 RTM 的映射

### 11.1 BDD ID 命名规则

| ID 格式 | 用途 | 示例 |
|---|---|---|
| `BDD-L<level>-<system>-<feature-num>.feature` | features 文件 ID（文件名） | `BDD-L1-blog_system-001.feature` |
| `BDD-L<level>-<scenario-num>` | scenario 级 ID（Feature 文件内唯一） | `BDD-L1-001`、`BDD-L2-012` |
| `SM-L<level>-<system>` | 状态机 ID（与同层 features 共享） | `SM-L1-blog_system` |

> scenario 级 ID 由 features 文件头 `# @scenario-id-prefix: BDD-L1` 声明前缀，scenario TAG `@BDD-L1-001` 标注完整 ID。

### 11.2 RTM 字段登记契约

| BDD 层级 | RTM 列 | 登记内容 | 登记阶段 | 执行状态回填阶段 |
|---|---|---|---|---|
| L1 features | `acceptanceTest` | `UAT-NNN \| BDD-L1-<system>-<num>.feature` | 阶段 1 | 阶段 8 |
| L2 features | `systemTest` | `ST-NNN \| BDD-L2-<system>_<subsystem>-<num>.feature` | 阶段 2 | 阶段 7 |
| L3 features | `integrationTest` | `IT-NNN \| BDD-L3-<system>_<subsystem>-<num>.feature` | 阶段 3 | 阶段 6 |
| L4 features | `unitTest` | `UT-NNN \| BDD-L4-<system>_<subsystem>_<atom>-<num>.feature` | 阶段 4 | 阶段 5 |

> 与 RTM 既有「`<Type>-NNN` 短形式」兼容：BDD features 引用以 ` | ` 分隔附加在短 ID 之后。RTM 行 schema（`rtm.schema.json`）字段类型保持 `string | null` 不变，扩展的是字段值格式约定。

### 11.3 字段值格式约定

```typescript
type TestFieldValue =
  | `${'UAT'|'ST'|'IT'|'UT'}-${number}`                                                        // 短形式 ID（既有兼容）
  | `${'UAT'|'ST'|'IT'|'UT'}-${number} | BDD-L${1|2|3|4}-${string}-${number}.feature`         // 短形式 + BDD 引用
  | null;
```

### 11.4 覆盖率算法扩展

**需求覆盖率 =（7 个追溯字段均非空的需求数 / 总需求数）× 100%**（既有公式不变）

新增 **BDD 覆盖率子指标**（由 check-bdd-model.ts 在对应阶段门禁校验）：

| 子指标 | 算法 | 校验阶段 |
|---|---|---|
| REQ → L1 BDD 覆盖率 | (有 L1 features 引用的 REQ 数 / 总 REQ 数) × 100% | 阶段 1 门禁 |
| SD → L2 BDD 覆盖率 | (有 L2 features 引用的 SD 数 / 总 SD 数) × 100% | 阶段 2 门禁 |
| INTF → L3 BDD 覆盖率 | (有 L3 features 引用的 INTF 数 / 总 INTF 数) × 100% | 阶段 3 门禁 |
| DD → L4 BDD 覆盖率 | (有 L4 features 引用的 DD 数 / 总 DD 数) × 100% | 阶段 4 门禁 |

> 与 TLA+ spec 覆盖率（SD → spec）对称：TLA+ 要求每个 SD 至少有 1 个对应层级 spec，BDD 要求每个 SD/INTF/DD 至少有 1 个对应层级 features 文件。

### 11.5 scenario 级追溯

每个 scenario 在 Gherkin TAG 行标注追溯：

```gherkin
@REQ-001 @REQ-002 @SD-3.2.1 @UAT-001 @high @BDD-L1-001
Scenario: 用户使用邮箱密码登录成功
```

门禁校验（D7 维度）：
- scenario TAG 中所有 `@REQ-NNN` 必须在 features 文件头 `# @req:` 列表中
- scenario TAG 中 `@UAT-NNN` / `@ST-NNN` / `@IT-NNN` / `@UT-NNN` 必须在 RTM 对应 REQ 行的对应字段中
- 每个 REQ 至少有 1 个 scenario 的 TAG 含 `@REQ-<该 REQ ID>`

---

## 12. BDD 与 verifier-spec 的关系

### 12.1 targetKind 不新增（保持 4 值枚举）

仿照 TLA+ 的处理方式（TLA+ spec 评审用 `targetKind=design` + 附加 `tla-plus-review-checklist.md`，不新增枚举值）：

**BDD features 评审用 `targetKind=test` + 附加 `bdd-review-checklist.md`，不新增 targetKind 枚举值。**

| 评审目标 | targetKind | subCriteria 来源 | 附加清单 |
|---|---|---|---|
| 阶段 1-4 BDD features 设计产物 | `test` | §7.3（5 项标准） | `bdd-review-checklist.md` |
| 阶段 5-8 BDD features 执行报告 | `test` | §7.3（5 项标准） | `bdd-review-checklist.md` |

> 与第 9 轮 P2.5 决策一致：「不新增 targetKind 枚举值，避免破坏既有 VerifierOutput 历史数据」。

### 12.2 subCriteria 映射

§7.3 测试用例 5 项标准与 BDD features 评审重点的映射：

| §7.3 subCriteria | weight | BDD features 评审重点 |
|---|---|---|
| `coverage` | 0.30 | REQ/SD/INTF/DD 覆盖率；scenario 覆盖正常/异常/边界场景；状态机状态/转换覆盖率 |
| `correctness` | 0.25 | scenario 步骤可复现；Given/When/Then 与状态机转移表一致；预期输出与不变式断言一致 |
| `independence` | 0.20 | scenario 之间无隐式状态依赖；每个 scenario 独立可执行（Before hook 重置） |
| `clarity` | 0.15 | step 文本无歧义；状态机七要素声明清晰；features 文件头标注完整 |
| `priority-reasonableness` | 0.10 | scenario 优先级标注合理（@high/@medium/@low TAG） |

### 12.3 bdd-review-checklist.md（新增参考文件）

仿照 `tla-plus-review-checklist.md` 的 7 项清单格式，BDD 附加清单包含 7 项：

1. **状态机七要素完整性**：Background 节是否声明状态集/初始/终态/转移表/不变式/accepting-rejecting/guard-action
2. **scenario 路径合法性**：每个 scenario 的 Given→When→Then 是否为状态转移表中的合法路径
3. **TLA+ 等价性**：BDD 状态集与同层 TLA+ spec 状态集是否等价（双向包含）
4. **step 绑定完整性**：所有 step 文本是否有对应 step definition（cucumber 报告无 undefined/pending）
5. **追溯完整性**：features 文件头标注 + scenario TAG 是否覆盖所有相关 REQ/SD/INTF/DD
6. **夹具完备性**：scenario 引用的 fixture 文件是否存在于 `features/fixtures/`
7. **不变式覆盖**：每个状态机不变式至少有 1 个 scenario 验证（Then 步骤含断言）

### 12.4 评审时序与门禁分工

```
阶段 N（1/2/3/4）features 设计完成
  ↓
V 子代理评审（targetKind=test + bdd-review-checklist）
  → 输出 VerifierOutput JSON（meta.targetKind='test'）
  → check-verifier-output.ts 校验 schema + 方差 + evidence（既有）
  ↓ 通过
G 子代理门禁
  → check-bdd-model.ts 静态结构校验（新增）
  → 校验 7 维度：D1 头标注 / D2 语法 / D3 状态机 / D4 TLA+ 等价 / D5 step 绑定 / D6 scenario 路径 / D7 RTM 映射
  ↓ exitCode=0
阶段门放行
```

**门禁分工原则**（与 TLA+ 对称）：
- `check-verifier-output.ts` 校验 V 评审输出的 schema 合规性（防 LLM 漂移）
- `check-bdd-model.ts` 校验 BDD features 本身的静态结构合规性（防占位/简化/错误实现）
- 两者正交：V 评审可能通过但 G 门禁失败（features 结构问题），或 V 评审失败但 G 门禁通过（features 结构合规但内容质量不足）

### 12.5 evidence 引用规则

BDD features 评审的 `subCriteria[*].evidence` 须引用 features 文件内具体位置：

| 引用类型 | 格式 | 示例 |
|---|---|---|
| features 文件 + 行号 | `features/L1/blog_system-001.feature:L23-45` | scenario 步骤引用 |
| 状态机声明 | `features/L1/blog_system-001.feature:Background:L5-15` | 状态集/转移表引用 |
| scenario TAG | `features/L1/blog_system-001.feature@REQ-001:L17` | 追溯 TAG 引用 |
| step definition | `features/step_definitions/auth.steps.ts:L42-58` | step 绑定引用 |
| TLA+ spec 对照 | `tla/L1_blog_system.tla:L30-50` | 等价性 evidence |

> 与 §6.2.1 evidence 可追溯约束一致：禁止仅引用文件名不标行号。

### 12.6 跨阶段 evidence 一致性

BDD features 评审须遵守 §12 跨阶段 evidence 一致性约束：

1. **BDD ↔ TLA+ evidence 一致**：BDD features 评审 evidence 中关于状态集/转换集的描述须与同层 TLA+ spec V 评审 evidence 一致
2. **BDD ↔ 设计文档 evidence 一致**：BDD features 评审 evidence 中关于需求/设计点的描述须与阶段 1-4 设计文档 V 评审 evidence 一致
3. **BDD ↔ RTM evidence 一致**：BDD features 评审 evidence 中关于追溯关系的描述须与 RTM 登记一致
4. **矛盾处理**：发现矛盾 → 标注 `Critical:` reworkHint → 触发对应阶段返工

### 12.7 V 子代理自检清单扩展

在 §4.2.1 V 子代理约束清单基础上，BDD features 评审额外自检：

6. **BDD 状态机 evidence**：`coverage` 子标准的 evidence 须引用 Background 节状态机声明的具体行号，且状态数与同层 TLA+ spec 状态数一致
7. **scenario 路径 evidence**：`correctness` 子标准的 evidence 须引用至少 3 个 scenario 的 Given/When/Then 行号 + 对应状态转移表行号
8. **TLA+ 等价性 evidence**：`coverage` 子标准须包含 1 条 evidence 引用同层 TLA+ spec 的 State/Next 定义行号，证明状态集等价

---

## 13. 改动清单

### 13.1 新增文件（11 个）

| # | 文件 | 用途 |
|---|---|---|
| 1 | `w-model-dev/references/bdd-guide.md` | BDD 建模指南（与 tla-plus-guide.md 对称） |
| 2 | `w-model-dev/references/bdd-review-checklist.md` | BDD 评审 7 项清单（V 子代理用） |
| 3 | `w-model-dev/references/bdd-syntax-reference.md` | Gherkin 语法参考 |
| 4 | `w-model-dev/references/bdd-patterns-examples.md` | BDD 模式示例库（按层级分类） |
| 5 | `w-model-dev/scripts/check-bdd-model.ts` | BDD 静态结构门禁脚本 |
| 6 | `w-model-dev/scripts/bdd-logic.ts` | BDD 业务规则校验逻辑 |
| 7 | `w-model-dev/schemas/bdd-manifest.schema.json` | BDD manifest JSON Schema |
| 8 | `w-model-dev/templates/feature.template` | features 文件模板 |
| 9 | `w-model-dev/templates/bdd-manifest.template.json` | bdd-manifest.json 模板 |
| 10 | `w-model-dev/scripts/samples/bdd/` | BDD fixture 样本目录（valid + bad 各 5 个） |
| 11 | `w-model-dev/scripts/__tests__/bdd-logic.test.ts` | BDD 校验逻辑单元测试 |

### 13.2 修改文件（24 个）

| # | 文件 | 改动内容 |
|---|---|---|
| 1 | `docs/skill-design-document_SSoT.md` | 新增 §3.4.14「BDD 建模与验收夹具」节 + §10A 追溯表新增行 |
| 2 | `w-model-dev/SKILL.md` | 不可违反的约束新增第 14 条「BDD 行为门禁」+ 阶段路由表补 BDD 列 + Bundled Resources 表新增 bdd-guide 按需加载条目 |
| 3 | `w-model-dev/references/anti-patterns.md` | 新增反模式 #29（BDD 建模与需求/设计/TLA+ 不符未回退） |
| 4 | `w-model-dev/references/phase-1-requirements.md` | 「并行任务」节新增 L1 features 设计 + RTM 登记 BDD 引用 |
| 5 | `w-model-dev/references/phase-2-system-design.md` | 「并行任务」节新增 L2 features 设计 |
| 6 | `w-model-dev/references/phase-3-outline-design.md` | 「并行任务」节新增 L3 features 设计 |
| 7 | `w-model-dev/references/phase-4-detailed-design.md` | 「并行任务」节新增 L4 features 设计 |
| 8 | `w-model-dev/references/phase-5-coding.md` | 新增「L4 features 作为 TDD 夹具」节 |
| 9 | `w-model-dev/references/phase-8-acceptance-test.md` | 「执行方法论」节新增 L1 features 执行 + check-bdd-model.ts 终检 |
| 10 | `w-model-dev/references/phase-6-integration-test.md` | 新增 L3 features 执行节 |
| 11 | `w-model-dev/references/phase-7-system-test.md` | 新增 L2 features 执行节 |
| 12 | `w-model-dev/references/verifier-spec.md` | §7.3 测试用例节补「BDD features 评审参考清单」引用（不新增 targetKind） |
| 13 | `w-model-dev/references/data-models.md` | 新增「BDD 数据模型」节（BddManifest + StateMachine + FeatureFile schema） |
| 14 | `w-model-dev/references/rtm-guide.md` | 「测试用例 ID 命名规则」节扩展 BDD 引用格式约定 |
| 15 | `w-model-dev/references/workflow.md` | 阶段产物清单表补 BDD 列 |
| 16 | `w-model-dev/references/operational-recovery.md` | 「调测者简化行为预防」节补 BDD 简化自检条 |
| 17 | `w-model-dev/scripts/self-test.ts` | 新增 BDD samples 测试组（+10 样本：5 valid + 5 bad） |
| 18 | `w-model-dev/scripts/check-artifact-gate.ts` | 终检新增 BDD 资产校验（bdd-manifest.json 存在 + check-bdd-model.ts exitCode=0） |
| 19 | `AGENTS.md` | §4 必读文档表补 bdd-guide.md；§8 脚本导航表补 check-bdd-model.ts 行 |
| 20 | `README.md` | 反模式总数 28→29；BDD 工具链说明 |
| 21 | `CHANGELOG.md` | 新增 [19.0.0] 条目 |
| 22 | `CONTRIBUTING.md` | BDD 文档维护规则 |
| 23 | `package.json` | version `18.0.0` → `19.0.0`；devDependencies 新增 `@cucumber/cucumber` + `@cucumber/messages` |
| 24 | `docs/INSTALL.md` | devDeps 列表新增 cucumber 依赖说明 |

### 13.3 SSoT §3.4.14 同步内容

新增 §3.4.14「BDD 建模与验收夹具」节，内容覆盖：

1. BDD 分层架构与 TLA+ 对应（§3）
2. features 文件结构与头标注契约（§4）
3. BDD 状态机七要素完整性约束（§5）
4. BDD↔TLA+ 独立门禁回退 + R→V 协作流程（§6 + §10）
5. check-bdd-model.ts 7 个校验维度（§7）
6. BDD 在 W 模型 8 阶段中的产出时序（§8）
7. 验收夹具四类设计（§9）
8. BDD↔RTM 映射契约（§11）
9. BDD↔verifier-spec 关系（不新增 targetKind）（§12）
10. 反模式 #29（§10.1）

---

## 14. 测试与验证策略

### 14.1 self-test 基线扩展

self-test.ts 新增 BDD samples 测试组，基线数 111 → 121（+10）：

| 样本类别 | 文件 | 期望结果 |
|---|---|---|
| `samples/bdd/valid-full.feature` + `valid-manifest.json` | 完整合法的 L1 features + manifest | passed=true, exitCode=0 |
| `samples/bdd/valid-l2.feature` + `valid-l2-manifest.json` | 完整合法的 L2 features + manifest | passed=true, exitCode=0 |
| `samples/bdd/bad-missing-header.feature` | 缺 `@tla-spec` 字段 | passed=false, exitCode=1 |
| `samples/bdd/bad-incomplete-state-machine.feature` | Background 缺 `@rejecting-states` | passed=false, exitCode=1 |
| `samples/bdd/bad-invalid-transition.feature` | 转移表 From 不在 `@states` 中 | passed=false, exitCode=1 |
| `samples/bdd/bad-scenario-path.feature` | scenario Given→When→Then 不是合法路径 | passed=false, exitCode=1 |
| `samples/bdd/bad-tla-mismatch.manifest.json` | BDD 状态集与 TLA+ 状态集不等价 | passed=false, exitCode=1 |
| `samples/bdd/bad-no-rtm-mapping.manifest.json` | scenario TAG 中 `@UAT-NNN` 不在 RTM | passed=false, exitCode=1 |
| `samples/bdd/bad-schema.manifest.json` | manifest 缺 `basePath` 字段 | passed=false, exitCode=2 |
| `samples/bdd/bad-step-unbound.feature` | step 文本无对应 step definition | passed=false, exitCode=1 |

### 14.2 vitest 单元测试

`scripts/__tests__/bdd-logic.test.ts` 覆盖：

- `validateBySchema('bdd-manifest', ...)` 入口校验（防反模式 #28）
- 七要素完整性校验各分支
- 转移表格式解析
- scenario 路径合法性算法
- BDD↔TLA+ 等价性算法
- RTM 映射校验
- 7 维度 violation 输出格式

### 14.3 cucumber 执行测试

阶段 5/6/7/8 执行 cucumber.js CLI：
- `npx cucumber-js features/L4/` 阶段 5（L4 features TDD 夹具）
- `npx cucumber-js features/L3/` 阶段 6（L3 features 集成测试）
- `npx cucumber-js features/L2/` 阶段 7（L2 features 系统测试）
- `npx cucumber-js features/L1/` 阶段 8（L1 features 验收测试）

cucumber CLI 退出码 0 = 所有 scenario 通过；非 0 = 有失败 scenario，走 R→V→G→S-fix 循环。

### 14.4 与现有 self-test 整合

- self-test.ts 在 `samples/bdd/` 目录下新增 BDD 样本，复用既有 `runXxxCases` 模式
- `runBddCases(samplesDir)` 函数与 `runTlaCases` 同构
- 主流程 `main()` 末尾的 `Promise.all([...])` 数组新增 `runBddCases(samplesDir)`
- 基线计数文本更新：`111 条样本` → `121 条样本（18 Verifier + 13 Gate + 17 Graph + 14 TLA + 5 Budget + 7 RunLog + 3 Maturity + 2 Checkpoint + 5 Code-TLA + 11 RootCause + 15 Schema + 1 Metadata + 10 BDD）`

### 14.5 TypeScript strict 0 错误

所有新增 .ts 文件须通过 `tsc --strict` 0 错误；bdd-logic.ts 与 check-bdd-model.ts 入口先调 `validateBySchema`（防反模式 #28）。

### 14.6 pre-push 门禁扩展

`.githooks/pre-push` 新增 BDD 校验项：
- `npm run self-test`（含 BDD samples）
- `npx tsx w-model-dev/scripts/check-bdd-model.ts samples/bdd/valid-manifest.json --phase=1 --tla-manifest=samples/tla/valid.json`（边界 4 项：无参数 exit 2 / 不存在目录 exit 2 / 有效样本 exit 0 / 无效样本 exit 1）

---

## 附录 A：决策摘要

| # | 维度 | 决策 |
|---|---|---|
| 1 | 工具链 | Cucumber.js + Gherkin |
| 2 | 分层架构 | L1/L2/L3/L4 BDD ↔ L1/L2/L3/L4 TLA+（最细到原子方法） |
| 3 | 协作模式 | 独立状态机；不一致时 R 分析 + V 验证；实质一致放行；否则上报人类 |
| 4 | 文件位置 | 项目根 `features/L1/` `L2/` `L3/` `L4/` + `features/step_definitions/` + `features/fixtures/` |
| 5 | 验收夹具 | Cucumber World + 数据 fixture + setup/teardown + 产出快照 |
| 6 | 状态机定义 | Background 节七要素强制（状态集/初始/终态/转移表/不变式/accepting-rejecting/guard-action） |
| 7 | 门禁脚本 | 新增独立 `check-bdd-model.ts` + `bdd-logic.ts`，与 `check-tla-model.ts` 对称 |
| 8 | 文件头标注 | Gherkin 注释块 + `@key` 标注 |
| 9 | 不符处理 | 独立门禁回退 + 反模式 #29；BDD↔TLA+ 不一致走 R→V |
| 10 | 产出时序 | 阶段 1 L1 + 阶段 2 L2 + 阶段 3 L3 + 阶段 4 L4 + 阶段 5 TDD 夹具 + 阶段 6/7/8 执行 |
| 11 | RTM 映射 | `<Type>-NNN \| BDD-L<level>-<system>-<num>.feature` 格式；4 个测试列各对应一层 BDD |
| 12 | verifier-spec | 不新增 targetKind；用 `test` + 附加 `bdd-review-checklist.md`（仿 TLA+ 模式） |

## 附录 B：与既有约束的兼容性

| 既有约束 | 兼容性 |
|---|---|
| 不引入 LLM 调用 | ✓ cucumber.js 是确定性运行器，不调用 LLM |
| 编排者最小化 | ✓ S-bdd 子代理产出 features；G 子代理跑 check-bdd-model.ts；O 仅路由 |
| 返工必先根因定位 | ✓ BDD↔TLA+ 不一致走 R→V→G→S-fix |
| TLA+ 行为门禁 | ✓ BDD 与 TLA+ 正交，独立门禁回退 |
| RTM 为事实源 | ✓ BDD 引用附加在 RTM 短 ID 之后，不替换 |
| 反模式 #28 schema 前置 | ✓ bdd-logic.ts 入口先调 validateBySchema |
| 门禁退出码不可伪 | ✓ check-bdd-model.ts JSON 摘要含 exitCode 字段 |
| 按需加载 | ✓ bdd-guide.md 在 SKILL.md Bundled Resources 表声明按需加载 |

