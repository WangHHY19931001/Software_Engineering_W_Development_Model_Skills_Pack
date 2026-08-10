# 数据模型（Data Models）

> 来源：SSoT 第 7 章。项目状态、需求、设计、测试用例的数据结构定义。
> 技能执行时按需读取，用于在项目存储中维护结构化记录。

## 目录

- 项目、需求、设计与测试用例模型
- 实体关系与持久化
- RTM 字段映射
- 状态迁移、JSON 恢复与并发写入
- 成本预算模型（budget.json）
- 运行日志模型（run-log.jsonl）
- 自主成熟度模型（maturity.json）
- 事件接驳模型（EventIngress / event-ingress.jsonl）
- 爬坡循环改进报告模型（HarnessImprovementReport / hill-climbing/<timestamp>-report.json）
- TLA+ manifest 模型（tla-manifest.json）

## 项目数据模型

```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  status: '需求分析' | '系统设计' | '概要设计' | '详细设计' | '编码' | '集成测试' | '系统测试' | '验收测试' | '项目完成';
  techStack: {
    frontend: string[];
    backend: string[];
    database: string[];
    others: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}
```

## 需求数据模型

```typescript
interface Requirement {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: '功能需求' | '非功能需求' | '约束需求';
  priority: '高' | '中' | '低';
  acceptanceCriteria: string[];
  testCases: TestCase[];
  status: '待开发' | '开发中' | '已完成' | '已验证';
}
```

## 设计数据模型

```typescript
interface Design {
  id: string;
  projectId: string;
  type: '系统设计' | '概要设计' | '详细设计';
  content: string;
  diagrams: Diagram[];
  testCases: TestCase[];
  createdAt: Date;
}
```

## 测试用例数据模型

```typescript
interface TestCase {
  id: string;
  projectId: string;
  type: '验收测试' | '系统测试' | '集成测试' | '单元测试';
  title: string;
  description: string;
  steps: string[];
  expectedResult: string;
  status: '待执行' | '通过' | '失败';
  priority: '高' | '中' | '低';
}
```

## 实体关系

```
PROJECT 1──* REQUIREMENT
PROJECT 1──* DESIGN
PROJECT 1──* TEST_CASE
REQUIREMENT 1──* TEST_CASE   (需求生成验收测试)
DESIGN 1──* TEST_CASE        (设计生成系统/集成/单元测试)
```

## 图谱节点与边类型（GraphNode / EdgeType）

> ingestion 子流程图谱模型的节点与边类型。完整节点语义、系统层级树与多层图谱（7 层）校验规则见 [graph-guide.md](graph-guide.md)；本节仅定义数据模型层 schema 与横切边源节点标识 marker。
> 权威实现：[`scripts/graph-logic.ts`](../scripts/graph-logic.ts) 为 `GraphNode` / `GraphEdge` / `EdgeType` 单点事实源。`governs` / `derives` 边类型与 `governance` / `derivationProduct` marker 均已落地；`consumes` 兼容已移除（D21）。

### 横切边源节点 marker（GraphNode 扩展）

`GraphNode` 完整 schema 见 [`scripts/graph-logic.ts`](../scripts/graph-logic.ts)（含下方两个 marker 字段，已落地）。为支持横切边（`governs` / `derives`）的源节点校验，`GraphNode` 含两个可选布尔 marker 字段（`governance` / `derivationProduct`，以 graph-logic.ts 为 schema 权威）：

```typescript
// GraphNode 扩展字段（叠加于 graph-logic.ts 现有 GraphNode 之上）
interface GraphNodeMarkers {
  /** true = 治理类子系统（横切治理多个子系统，如安全治理节点 S08），允许作为 governs 边的 from */
  governance?: boolean;
  /** true = 派生规格节点（由设计事实派生行为规格/接口契约/测试设计的产物，如 S11），允许作为 derives 边的 from */
  derivationProduct?: boolean;
}
```

> 注：上述两个 marker 字段为 **flat 可选字段直接叠加于 `GraphNode`**（非嵌套 `markers` 对象）。实现为 `node.governance === true` / `node.derivationProduct === true`，而非 `node.markers.governance`。`GraphNodeMarkers` 仅为本文档描述 marker 集合，不引入运行时嵌套层级。

**marker 约定**（`graph-logic.ts` 已实现 `governs` / `derives` 边源节点 marker 校验）：

- `governance === true`：该节点为治理类子系统。仅此类节点允许作为 `governs` 边的 `from`。
- `derivationProduct === true`：该节点为派生规格节点。仅此类节点允许作为 `derives` 边的 `from`。
- 两字段均为可选布尔；缺省（`undefined` / `false`）即非该类源节点。
- 治理类子系统与派生规格节点在系统层级树中仍是普通 `SD` 节点（`type='SD'`），marker 仅用于横切边源校验，**不改变结构层 `parent` 依附**（被治理子系统的 `parent` 仍是系统根；见 [graph-guide.md](graph-guide.md) §7 跨层一致性）。
- marker 不得用节点 `id` 硬编码识别（如不得写 `node.id === 'SD-5.2.8'`）：`S08` / `S11` 仅作示例，实际项目治理/派生节点由设计文档显式声明，A-evolve 提取时写入对应 marker 字段。

### EdgeType

```typescript
export type EdgeType =
  | 'parent' | 'depends-on' | 'implements' | 'defines' | 'realizes'
  | 'produces'
  // 已移除：'consumes'（D21：信息流层统一用 produces，双向语义由 from/to 表达）
  // 新增（多层图谱横切层，见 graph-guide.md §7）
  | 'governs'           // 治理层：治理类子系统 → 被治理子系统
  | 'collaborates-with' // 协作层：节点 ↔ 节点 对等协作
  | 'derives';          // 派生层：派生规格节点 → 派生产物
```

**边类型与源节点 marker 对应**：

| 边类型 | 源节点（from）要求 | 目标节点（to）要求 | 依附层级树 |
|---|---|---|---|
| `governs` | `governance === true`（治理类子系统） | 被治理子系统且存在 | 不依附 |
| `collaborates-with` | 任意已登记节点（须存在） | 任意已登记节点（须存在） | 不依附 |
| `derives` | `derivationProduct === true`（派生规格节点） | 派生产物且存在 | 不依附 |

> `consumes` 边类型已废弃（D21）：信息流层统一用 `produces`，双向语义由 `{from, to}` 表达。`graph-logic.ts` 已移除 `consumes` 兼容；历史 `graph.json` 中残留的 `consumes` 边将由 `check-requirement-graph.ts` 报为非法边类型。

## 与 RTM 的映射

RTM 的每一列对应一个数据模型的 `id` 字段（见 [rtm-guide.md](rtm-guide.md)）：

| RTM 列 | 数据模型 | ID 格式 | 登记阶段 |
|---|---|---|---|
| 需求 ID | `Requirement` | `REQ-NNN` | 阶段 1 |
| 设计文档 | `Design` | `SD-N.N.N` | 阶段 2/3/4 |
| 代码模块 | —（文件路径） | `<filename>.ts` | 阶段 5 |
| 单元测试 | `TestCase` (type=单元测试) | `UT-NNN` | 阶段 4（设计）/ 阶段 5（执行） |
| 集成测试 | `TestCase` (type=集成测试) | `IT-NNN` | 阶段 3（设计）/ 阶段 6（执行） |
| 系统测试 | `TestCase` (type=系统测试) | `ST-NNN` | 阶段 2（设计）/ 阶段 7（执行） |
| 验收测试 | `TestCase` (type=验收测试) | `UAT-NNN` | 阶段 1（设计）/ 阶段 8（执行） |

## 使用约定

- `id` 使用 `REQ-<序号>` / `SD-<节号>` / `TC-<类型>-<序号>` 等可读编码。
- `status` 随阶段推进更新；阶段切换时同步 `Project.updatedAt`。
- 测试用例 `type` 与设计来源阶段一一对应（见 SKILL.md 阶段对应表）。
- 数据可持久化为 JSON 文件或 SQLite，本技能不强制存储介质。

## RTM 字段阶段演进规则

> RTM 各列按阶段递进补加，禁止在早期阶段填写晚期字段（防止「提前填晚期字段」缺陷）。本节是对 [rtm-guide.md](rtm-guide.md)「各阶段登记职责」与「各阶段 RTM 字段更新清单」的阶段演进约束补充；RTM 行字段 schema 见 [`scripts/gate-logic.ts`](../scripts/gate-logic.ts) `RTMRowShape`。

**RTM 行字段阶段演进**（`RTMRowShape`）：

| 字段 | 首次填写阶段 | 说明 |
|---|---|---|
| `requirementId` / `description` | 阶段 1 | 需求登记 |
| `acceptanceTest` | 阶段 1（设计）/ 阶段 8（执行） | 验收测试用例 ID 在阶段 1 设计登记，执行状态在阶段 8 填 |
| `designDoc`（系统设计） | 阶段 2 | 系统设计文档 SD-N.N.N |
| `systemTest` | 阶段 2（设计）/ 阶段 7（执行） | 系统测试用例 ID 在阶段 2 设计登记，执行状态在阶段 7 填 |
| `designDoc`（接口设计，即 interfaceDesign） | 阶段 3 | 接口设计文档在阶段 3 补加到 `designDoc` 列（[rtm-guide.md](rtm-guide.md)「接口设计列」） |
| `integrationTest` | 阶段 3（设计）/ 阶段 6（执行） | 集成测试用例 ID 在阶段 3 设计登记，执行状态在阶段 6 填 |
| `designDoc`（详细设计） | 阶段 4 | 详细设计文档在阶段 4 补加到 `designDoc` 列 |
| `unitTest` | 阶段 4（设计）/ 阶段 5（执行） | 单元测试用例 ID 在阶段 4 设计登记，执行状态在阶段 5 填 |
| `codeModule` | 阶段 5 | 代码模块文件路径 |

**演进约束**：

- `interfaceDesign`（接口设计，对应 `designDoc` 列的阶段 3 子条目）在阶段 3 才补加——阶段 1/2 不得预先填写接口设计文档。
- `integrationTest` 字段在阶段 3 设计登记（用例 ID `IT-NNN`），执行状态在阶段 6 填写——阶段 3 不得预先填「通过 / 失败」执行状态。
- **不得在早期阶段填写晚期字段**：如阶段 1/2 不得填 `codeModule`（阶段 5）、不得填 `integrationTest` 执行状态（阶段 6）、不得填 `unitTest` 执行状态（阶段 5）；早期阶段仅登记该阶段「设计」职责对应的用例 ID，不预填「执行」状态。
- `coverageStatus` 仅用于展示，门禁脚本从原始字段重算（见 [rtm-guide.md](rtm-guide.md) 覆盖率算法）；手工预填 `100%` 不被信任。

## 数据迁移与异常处理（边界条件）

> 项目演进中常见的数据层边界场景：枚举变更 / techStack 增删 / JSON 损坏 / 并发写入。Agent 须按以下策略处理，**禁止直接丢弃历史数据**。

### 1. status 枚举变更迁移

当 `Project.status` / `Requirement.status` / `TestCase.status` 枚举集合扩展或重命名时：

| 场景 | 迁移策略 | 校验 |
|---|---|---|
| 枚举值新增（如 `Project.status` 增加「灰度发布」） | 旧数据无需改动；新值仅在用户显式选择后写入 | 读取旧记录时新枚举值不存在 → 视为旧值集合内的值 |
| 枚举值重命名（如 `待开发` → `待实现`） | 一次性脚本扫描 JSON 中所有 `status` 字段做字符串替换；替换前后保留 `.bak` 备份 | 替换后必须通过 `check-artifact-gate.ts` 校验，退出码 0 |
| 枚举值废弃（如 `已废弃` 移除） | 已废弃状态记录须先迁移到「已归档」或「待开发」等保留值，再删除枚举项 | 不得保留无对应枚举的 status 值；退出码 0 才算迁移完成 |

迁移步骤：备份 `cp .w-model/rtm.json .w-model/rtm.json.bak.<ts>` → 执行迁移逐条更新 status → 跑 `check-artifact-gate.ts [project-dir]` 退出码 0 才算成功；失败则回滚 `.bak.<ts>`。

### 2. techStack 增删迁移

`Project.techStack` 字段增删技术栈时：

| 场景 | 迁移策略 | 风险 |
|---|---|---|
| 新增技术栈（如 `frontend` 加入 `Vue 3`） | 直接 append 到数组；不触发回滚 | 无 |
| 删除技术栈（如 `backend` 移除 `Express`） | 须先核验代码模块列无引用该栈的文件；若有引用须先回编码迁移代码 | 删除后代码仍引用 → `check-artifact-gate.ts` 退出码 1 |
| 重命名技术栈 | 须同步更新 `techStack` 数组与所有引用文档；保留 `.bak` 备份 | 文档与 `rtm.json` 不一致 → 退出码 1 |

### 3. JSON 文件损坏恢复

`rtm.json` / 其他 JSON 产物损坏（解析失败 / 字段缺失）时：

1. **检测**：`JSON.parse` 抛异常或 `check-artifact-gate.ts` 退出码 2 → 判定损坏。
2. **定位备份**：按时间倒序查找 `.w-model/*.json.bak.*`，取最近一个能 `JSON.parse` 成功的备份。
3. **恢复**：`cp .w-model/rtm.json.bak.<timestamp> .w-model/rtm.json`，重跑 `check-artifact-gate.ts`。
4. **无备份兜底**：若无可用备份，从 `templates/rtm.md` 重建空 RTM，按阶段产物（需求规格 / 设计文档 / 代码文件 / 测试报告）反向回填，回填后跑校验脚本。
5. **告知用户**：明示损坏范围与恢复策略，由用户确认恢复结果。

### 4. 并发写入冲突处理

多 Agent / 多会话同时写 `rtm.json` 时：

| 冲突类型 | 检测信号 | 处理 |
|---|---|---|
| 文件 mtime 与读取时不一致 | 读取后写回前先 `stat` 比较 mtime；不一致即冲突 | 拒绝覆盖；重新读取最新版本合并后再写 |
| 同一字段被多次修改 | 写入前对比读取时的 `updatedAt` 与当前 `updatedAt` | 后写者基于最新版本重做修改；冲突字段需用户裁决 |
| 测试状态被并发翻转 | `TestCase.status` 在两次读取间从「通过」翻转为「失败」 | 以「失败」为优先（保守原则），回阶段 5 返工 |

并发写入约定：写入前必须 `stat` 校验 mtime，不一致即重读合并；同一字段冲突时测试状态取「失败」优先（保守），其他字段取「最新 mtime」优先；同一记录 ≥3 次并发修改须暂停并向用户报告。

> 并发写入冲突处理不改变数据模型 schema，仅约定写入时的并发控制策略。

## 成本预算模型（budget.json）

> SSoT [§10D](../../docs/skill-design-document_SSoT.md) 为权威定义。编排者 O 在项目初始化（`/wm analyze` 首次）时创建，类比 `project.json`/`rtm.json` 的初始化。用户可在任意时刻编辑调整。

```typescript
interface BudgetConfig {
  /** Schema 版本，当前固定为 "1.0" */
  schemaVersion: '1.0';
  /** 项目 ID（与 project.json 一致） */
  projectId: string;
  /** 创建与最后修改时间 ISO 8601 */
  createdAt: string;
  updatedAt: string;

  /** 每阶段 token 预算上限 */
  perPhase: {
    /** 单阶段累计 token 上限；超过触发 onExceed */
    maxTokens: number;
    /** 单阶段子代理分派次数上限（S+V+G+A 合计）；超过触发 onExceed */
    maxSubagentSpawns: number;
    /** 单阶段返工循环上限（默认 3，与 operational-recovery.md「同一阶段返工超过 2 次」一致+1） */
    maxReworkRounds: number;
  };

  /** 项目级全局预算 */
  project: {
    /** 全阶段累计 token 上限；超过触发 onExceed */
    maxTokensTotal: number;
    /** 单次会话 token 上限（防止单次交互爆量） */
    maxTokensPerSession: number;
  };

  /** 预算超限时的处置策略 */
  onExceed: 'pause' | 'notify' | 'halt';
  // - pause: 暂停后续子代理分派，🔴 CHECKPOINT · 预算告警，等用户决定（增预算/降范围/取消）
  // - notify: 仅在 run-log 记录告警，继续执行（适合 L2+ 自主度）
  // - halt: 立即停止当前阶段推进，回退到阶段起点（最保守，L0 默认）

  /** kill switch 触发条件（满足任一即暂停全流程） */
  killSwitch: {
    /** 连续阶段返工次数 ≥ 此值（默认 3） */
    consecutiveReworks: number;
    /** 单阶段 token 消耗占 maxTokens 比例 ≥ 此值（默认 0.9） */
    budgetBurnRate: number;
    /** 同一 TLA+ 规格返工次数 ≥ 此值（默认 3） */
    tlaReworks: number;
  };

  /** 多角度 R 的 token 预算配置（不论并行/串行均累计；对应 spec §9.9） */
  rootcauseParallelBudget?: {
    /** 每轮 R-persona 数量上限（默认 5） */
    maxPersonasPerRound: number;
    /** 单个 R-persona token 上限（默认 50000） */
    maxTokensPerPersona: number;
    /** 每轮所有 R-persona token 总和上限（默认 200000；串行分派时累计校验） */
    maxTotalTokensPerRound: number;
  };
}
```

**默认值**（`/wm analyze` 首次初始化时写入，用户可改）：

```json
{
  "schemaVersion": "1.0",
  "projectId": "<auto>",
  "createdAt": "<now>",
  "updatedAt": "<now>",
  "perPhase": {
    "maxTokens": 500000,
    "maxSubagentSpawns": 30,
    "maxReworkRounds": 3
  },
  "project": {
    "maxTokensTotal": 4000000,
    "maxTokensPerSession": 1000000
  },
  "onExceed": "pause",
  "killSwitch": {
    "consecutiveReworks": 3,
    "budgetBurnRate": 0.9,
    "tlaReworks": 3
  },
  "rootcauseParallelBudget": {
    "maxPersonasPerRound": 5,
    "maxTokensPerPersona": 50000,
    "maxTotalTokensPerRound": 200000
  }
}
```

**使用约定**：

- `budget.json` 由编排者 O 维护，属"状态读写+持久化"允许动作（非实施，不触发反模式 #10）。
- 编排者在每个阶段门放行前执行预算检查（汇总 `run-log.jsonl` 中本阶段/全项目 tokens），超限按 `onExceed` 处置。
- `tokensEstimate` 由宿主 Agent 报告实际消耗（`estimated=false`）；不得用 LLM 估算（`estimated=true` 违反约束 4）。
- `budget.updatedAt` 须在每个阶段门放行前更新（编排者 O 在 CHECKPOINT 放行时同步刷新为当前时间戳）。与 `check-budget.ts` R1 时效性校验对齐：当 `project.updatedAt > budget.createdAt` 时须满足 `budget.updatedAt > budget.createdAt`，否则报「阶段推进但 budget 未更新」。
- 预算检查不替代门禁脚本（反模式 #3/#6）：预算超限触发暂停/告警，放行仍由 G 子代理退出码决定。
- `rootcauseParallelBudget` 为多角度 R 的 token 预算配置（字段名保留向后兼容，实际含义为「每轮多角度 R 的 token 预算」，不论并行/串行均累计）。由 [`check-budget.ts`](../scripts/check-budget.ts) R4-A 规则校验：每轮 persona 数 ≤ `maxPersonasPerRound`、每个 persona tokens ≤ `maxTokensPerPersona`、每轮总 tokens ≤ `maxTotalTokensPerRound`（串行分派时累计校验，超限触发 killSwitch）。未配置该字段时不校验（向后兼容）。

## 运行日志模型（run-log.jsonl）

> SSoT [§10D](../../docs/skill-design-document_SSoT.md) 为权威定义。Append-only JSON Lines 格式，每行一条记录。编排者 O 在每个子代理分派返回后与每个阶段门/质量门完成后 append 一条。

```typescript
interface RunLogEntry {
  /** 运行 ID（UUID 或时间戳） */
  runId: string;
  /** 时间戳 ISO 8601 */
  timestamp: string;
  /** 阶段编号 1-8 */
  phase: number;
  /** 阶段名称 */
  phaseName: '需求分析' | '系统设计' | '概要设计' | '详细设计' | '编码' | '集成测试' | '系统测试' | '验收测试';
  /** 动作类型 */
  action: 'chunk' | 'cross' | 'evolve' | 'produce' | 'review' | 'gate' | 'tla-gate' | 'graph-gate' | 'test' | 'checkpoint' | 'rework' | 'rollback' | 'rootcause' | 'fix' | 'escalate';
  /** 子代理角色 */
  role: 'O' | 'A' | 'S' | 'V' | 'G' | 'R';
  /** 本次动作持续时间（秒） */
  duration_s: number;
  /** 本次动作 token 消耗（由宿主 Agent 报告实际消耗；无值时填 0 并标注 estimated:false） */
  tokens: number;
  /** tokens 是否为估算值（true=LLM估算，违反约束4，应避免；false=实际报告） */
  estimated: boolean;
  /** 子代理分派次数（本条记录涉及的子代理调用数） */
  subagentSpawns: number;
  /** 门禁脚本退出码（仅 gate/tla-gate/graph-gate/checkpoint 类动作填写；其他为 null） */
  gateExitCode: number | null;
  /** 门禁脚本 stdout 存档路径（gate/tla-gate/graph-gate 类动作必填；G 子代理将脚本 stdout 归档到 gate-logs/，本字段记录路径供 check-run-log.ts 交叉校验退出码防伪造，见 SSoT §10E） */
  gateLogPath?: string;
  /** 结果 */
  outcome: 'success' | 'fail' | 'rework' | 'escalate' | 'blocked' | 'cancelled';
  /** 阶段门放行时（action=checkpoint & outcome=success），用户填写的理解证据（见 §10.6 第六维度） */
  acknowledgedDecisions?: string[];
  /** 备注（rework 原因 / escalation 上下文 / 阻塞说明 / O 系列失败模式标注如 "O1 Token Burn"） */
  note?: string;
  /** 本条记录涉及的产物路径（如有） */
  artifacts?: string[];
  /** 决策置信度（可选，0.0-1.0；agentic Ch18 结构化思维链日志，第 40 轮新增，供 Loop 4 劣化分析） */
  decisionConfidence?: number;
}
```

**示例记录**（阶段门放行）：

```json
{"runId":"2026-07-23T10-15-00Z","timestamp":"2026-07-23T10:22:13Z","phase":3,"phaseName":"概要设计","action":"checkpoint","role":"O","duration_s":420,"tokens":85000,"estimated":false,"subagentSpawns":4,"gateExitCode":0,"outcome":"success","acknowledgedDecisions":["采用 REST + JWT 认证方案而非 GraphQL","评论模块独立存储不共享 article 表"],"note":"阶段门放行，V 评审 qualityLevel=A compositeScore=0.91","artifacts":["docs/phase3-outline/{module}-interface-design.md"]}
```

**使用约定**：

- `run-log.jsonl` 是 append-only：不得修改历史记录；损坏行跳过并记录 note，不停止流程。
- 编排者 O 在以下时机 append：子代理分派返回后 / 门禁脚本执行后 / 🔴 CHECKPOINT 放行后 / 返工回退后。
- `acknowledgedDecisions` 在阶段门放行时由用户填写（≥1 关键决策摘要，非"确认"/"同意"）；为空视为 O4（Comprehension Debt）命中，拒绝放行。
- `note` 字段用于标注 O 系列失败模式命中（如 "O1 Token Burn"、"O3 Verifier Theater"）。
- **禁止字段混用**：不得用 EventIngress 字段（`eventId` / `eventType` / `source` / `summary` / `affectedArtifacts` / `affectedRequirements` / `evidence` / `routedTo`）写 `run-log.jsonl`。第 15 轮共性问题 B 子代理误用 `eventId` / `eventType` / `decisions` 触发 R1 失败（注：`decisions` 非任何 schema 的合法字段名，正确字段名为 RunLogEntry 的 `acknowledgedDecisions`；第 17 轮 P3 修正历史叙述加注）。详见下方「RunLogEntry vs EventIngress Schema 边界对照表」节。
- `decisionConfidence` 为可选字段：评审/门禁/返工等关键决策时可记录置信度（0.0-1.0）；低置信度高频出现是 Loop 4 劣化分析信号。

### R1 阶段动作完整性：按阶段分档

> 由 [`scripts/run-log-logic.ts`](../scripts/run-log-logic.ts) R1 校验。对每个已完成阶段（含 checkpoint success），按阶段编号分档检查必需动作：

| 阶段范围 | 必需动作 | 说明 |
|---|---|---|
| 1-4（分析/设计阶段） | `chunk` / `cross` / gate 类（gate/tla-gate/graph-gate） / `checkpoint` | A 子代理的 ingestion chunk/cross 拆解 + G 门禁 + O CHECKPOINT |
| 5-8（编码/测试/验证阶段） | `produce` / `review` / gate 类 / `checkpoint` | S 子代理的产出 + V 评审 + G 门禁 + O CHECKPOINT |

- gate 类动作包括 `gate`、`tla-gate`、`graph-gate`，任一存在即满足。
- 阶段 1-4 不要求 `produce`/`review`；阶段 5-8 不要求 `chunk`/`cross`。
- 所有阶段均要求 gate 类动作和 checkpoint。missing 任一必需动作 → R1 违规。

### 动作类型字段约束（rootcause / fix / escalate 扩展）

> 对应 spec [§5.5](../../docs/superpowers/specs/2026-07-24-root-cause-locator-and-fixer-roles-design.md) run-log 新增动作 + [§7.5](../../docs/superpowers/specs/2026-07-24-root-cause-locator-and-fixer-roles-design.md) schema 扩展。由 [`scripts/run-log-logic.ts`](../scripts/run-log-logic.ts) R1 校验。

`action` 枚举新增 `rootcause` / `fix` 两个动作（返工循环 V/G→R→V→G→S-fix→V→G 专用）。各动作的额外必填字段约束：

| action | 额外必填字段 | 说明 |
|---|---|---|
| `rootcause` | `reportId` / `rootCauseCategory` / `upstreamDefect` / `rollbackRecommended` | R 子代理产出根因报告时记录；`reportId` 格式 `RC-<phase>-<round>-<seq>`；`rootCauseCategory` 见 RootCauseReport Schema；`upstreamDefect`(boolean) 标记是否检测到上游缺陷；`rollbackRecommended`(boolean) 标记是否建议阶段回退 |
| `fix` | `basedOnReport` / `artifacts` | S 兼 F 修复时记录；`basedOnReport` 引用 R 报告 `reportId`（一一对应，由 run-log R3 扩展校验）；`artifacts` 为修复涉及的非空产物路径数组 |
| `escalate` | 新增可选字段 `reportId`（仅 `upstreamDefect` 触发的升级） | 当 R 标记 `upstreamDefect.present=true` 且 `rollbackRecommended=true` 触发场景 5 阶段回退升级时，`escalate` 动作记录 `reportId` 关联根因报告 |

**rootcause 动作示例**（spec §5.5）：

```json
{"action":"rootcause","phase":"<阶段N>","round":<int>,"role":"R","reportId":"RC-phase5-1-01","rootCauseCategory":"requirement-gap","upstreamDefect":false,"rollbackRecommended":false,"tokens":<int>,"timestamp":"<ISO>","note":"<可选>"}
```

**fix 动作示例**（spec §5.5）：

```json
{"action":"fix","phase":"<阶段N>","round":<int>,"role":"S","basedOnReport":"RC-phase5-1-01","artifacts":["src/auth.ts"],"tokens":<int>,"timestamp":"<ISO>","note":"<可选>"}
```

> 多角度场景（R-lead 分派 N 个 R-persona，并行/串行均可）时，每份 PartialReport 各记一条 `rootcause` 动作（`role:"R"`，`note` 标注 personaSlice），聚合记一条 `rootcause` 动作（`note:"R-lead aggregation"`）。

## 自主成熟度模型（maturity.json）

> SSoT [§10C](../../docs/skill-design-document_SSoT.md) 为权威定义。编排者 O 在项目初始化（`/wm analyze` 首次）时创建，类比 `project.json`/`rtm.json`/`budget.json`。

```typescript
interface MaturityConfig {
  /** Schema 版本，当前固定为 "1.0" */
  schemaVersion: '1.0';
  /** 项目 ID（与 project.json 一致） */
  projectId: string;
  /** 当前成熟度级别 */
  level: 'L0' | 'L1' | 'L2' | 'L3';
  /** 升级到此级别的时间 ISO 8601 */
  leveledUpAt: string;
  /** 解锁条件达成状态 */
  unlockConditions: {
    /** 稳定运行时长（天） */
    stableDays: number;
    /** 完整 8 阶段周期数（L0→L1 需要 ≥1） */
    completedCycles: number;
    /** attempt cap 达标率（L1→L2 需要 ≥0.8） */
    attemptCapRate: number;
    /** 误判率（L2→L3 需要 ≤0.1） */
    misjudgeRate: number;
    /** O 系列失败模式命中次数（升级需 0） */
    operationalFailures: number;
  };
  /** 升级历史 */
  history: Array<{
    from: 'L0' | 'L1' | 'L2' | 'L3';
    to: 'L0' | 'L1' | 'L2' | 'L3';
    at: string;
    reason: string;
  }>;
  /** 降级触发条件（自动降级回 L0） */
  downgradeTriggers: {
    /** 连续 O 系列失败模式命中 ≥ 此值 */
    operationalFailureStreak: number;
    /** 用户显式降级 */
    userRequested: boolean;
  };
}
```

**默认值**（`/wm analyze` 首次初始化）：

```json
{
  "schemaVersion": "1.0",
  "projectId": "<auto>",
  "level": "L0",
  "leveledUpAt": "<now>",
  "unlockConditions": {
    "stableDays": 0,
    "completedCycles": 0,
    "attemptCapRate": 0,
    "misjudgeRate": 0,
    "operationalFailures": 0
  },
  "history": [],
  "downgradeTriggers": {
    "operationalFailureStreak": 2,
    "userRequested": false
  }
}
```

**使用约定**：

- `maturity.json` 由编排者 O 维护，属"状态读写+持久化"允许动作（非实施，不触发反模式 #10）。
- 编排者 O 在每个 🔴 CHECKPOINT 处读取 `level`，按 L0~L3 放行矩阵决定 CHECKPOINT 类型（决策型 / 操作型）。
- L1+ 操作型 CHECKPOINT 自动放行时，仍在 run-log 记录 action=checkpoint outcome=success，保留可追溯性。
- 升级不可自动：升级是决策型 CHECKPOINT，须用户显式确认（阶段 8 完成后 unlockConditions 全部达标时询问）。
- 降级可自动：O 系列失败模式连续命中 ≥ `downgradeTriggers.operationalFailureStreak` → 自动降级到 L0。
- `maturity.json` 与 `budget.json` 协同：L2+ 自主度可设 `onExceed=notify`（仅在 run-log 记录告警）；L0 默认 `onExceed=pause`（最保守）。

### RunLogEntry vs EventIngress Schema 边界对照表

> 第 15 轮调测发现子代理频繁混用 RunLogEntry（`run-log.jsonl`）与 EventIngress（`event-ingress.jsonl`）字段（共性问题 B），第 16 轮 P2.1 新增此对照表显式区分边界。命中混用 → [`check-run-log.ts`](../scripts/check-run-log.ts) R1 动作完整性校验失败（run-log.jsonl）或 EventIngress schema 校验失败（event-ingress.jsonl）。

| 用途 | RunLogEntry 字段 | EventIngress 字段 | 区别 |
|---|---|---|---|
| 标识 | `runId`（UUID 或时间戳） | `eventId`（UUID 或时间戳） | 不同 ID 命名空间，不可混用 |
| 时间戳 | `timestamp` | `timestamp` | 相同（ISO 8601） |
| 阶段 | `phase` + `phaseName` | 无（路由后才有阶段） | RunLogEntry 强制阶段，EventIngress 路由前无 |
| 动作 | `action`（chunk/cross/produce/review/gate/tla-gate/graph-gate/test/checkpoint/rework/rollback/rootcause/fix/escalate） | `eventType`（bug-report/requirement-change/...） | 不同枚举集，不可混用 |
| 角色 | `role`（O/A/S/V/G/R） | `source`（webhook/cron/manual/external-ci/user-report） | 不同维度，不可混用 |
| 结果 | `outcome`（success/fail/rework/escalate/blocked/cancelled） | `routedTo`（路由决策对象） | 不同语义，不可混用 |
| 决策 | `acknowledgedDecisions`（数组） | 无 | 仅 RunLogEntry |
| 耗时 | `duration_s` / `tokens` / `estimated` / `subagentSpawns` | 无 | 仅 RunLogEntry |
| 影响范围 | `artifacts`（产物路径数组） | `affectedArtifacts` + `affectedRequirements` + `evidence` | EventIngress 更具体 |
| 备注 | `note` | `summary` | 不同字段名，不可混用 |
| 门禁归档 | `gateExitCode` / `gateLogPath` | 无 | 仅 RunLogEntry |

**禁止混用规则**：
- `run-log.jsonl` 不得含 EventIngress 字段（`eventId` / `eventType` / `source` / `summary` / `affectedArtifacts` / `affectedRequirements` / `evidence` / `routedTo`）
- `event-ingress.jsonl` 不得含 RunLogEntry 字段（`runId` / `action` / `role` / `outcome` / `acknowledgedDecisions` / `duration_s` / `tokens` / `estimated` / `subagentSpawns` / `gateExitCode` / `gateLogPath` / `phase` / `phaseName`）

详见 [anti-patterns.md #26](anti-patterns.md) 「RunLogEntry 与 EventIngress 字段混用」。

## 事件接驳模型（EventIngress / event-ingress.jsonl）

> 来源：SSoT [§10F](../../docs/skill-design-document_SSoT.md)。Append-only JSON Lines 格式，每行一条事件记录。编排者 O 维护，消费方自行实现触发器写入。

```typescript
interface EventIngress {
  /** 事件 ID（UUID 或时间戳） */
  eventId: string;
  /** 时间戳 ISO 8601 */
  timestamp: string;
  /** 事件来源（消费方自填，技能不内置触发器） */
  source: 'webhook' | 'cron' | 'manual' | 'external-ci' | 'user-report';
  /** 事件类型，决定路由到哪个阶段 */
  eventType: 'bug-report' | 'requirement-change' | 'acceptance-failure'
           | 'regression-detected' | 'scheduled-review' | 'security-incident';
  /** 事件摘要 */
  summary: string;
  /** 受影响的产物路径（如有） */
  affectedArtifacts?: string[];
  /** 受影响的需求 ID（如有，对应 rtm.json） */
  affectedRequirements?: string[];
  /** 证据（链接/日志/截图路径） */
  evidence?: string[];
  /** 路由决策（编排者 O 填写） */
  routedTo?: {
    phase: number;
    phaseName: string;
    routedAt: string;
    /** 是否触发高风险路径强制 CHECKPOINT */
    highRiskGate: boolean;
  };
}
```

**示例记录**（webhook 触发的 bug 报告）：

```json
{"eventId":"evt-2026-07-25-001","timestamp":"2026-07-25T10:15:00Z","source":"webhook","eventType":"bug-report","summary":"登录接口返回 500","affectedArtifacts":["src/services/identity/user-service.ts"],"affectedRequirements":["REQ-002"],"evidence":["https://ci.example.com/run/12345/log"]}
```

## 爬坡循环改进报告模型（HarnessImprovementReport / hill-climbing/<timestamp>-report.json）

> 来源：SSoT [§10G](../../docs/skill-design-document_SSoT.md)。编排者 O 确定性分析 run-log 产出，存 `.w-model/hill-climbing/<timestamp>-report.json`。详见 [hill-climbing-guide.md](hill-climbing-guide.md)。

```typescript
interface HarnessImprovementReport {
  /** 报告 ID */
  reportId: string;
  /** 生成时间 ISO 8601 */
  generatedAt: string;
  /** 分析窗口 */
  analysisWindow: {
    from: string;
    to: string;
    runLogEntries: number;
    phasesCovered: number[];
  };
  /** 检测到的改进信号 */
  signals: Array<{
    signalId: string;
    category: 'prompt' | 'tool' | 'verification-rule' | 'anti-pattern' | 'maturity' | 'budget';
    severity: 'S1' | 'S2' | 'S3';
    evidence: {
      runLogRefs: string[];
      patterns: string[];
      metrics: {
        occurrences: number;
        trend: 'increasing' | 'stable' | 'decreasing';
      };
    };
    suggestion: string;
    affectedAssets: string[];
    priority: 1 | 2 | 3;
  }>;
  /** 元分析（跨信号聚合） */
  metaAnalysis: {
    topFailurePatterns: string[];
    reworkHotspots: string[];
    verifierDisagreements: number;
    budgetBurnTrend: 'increasing' | 'stable' | 'decreasing';
    operationalFailureHits: Record<string, number>;
    comprehensionQuality: {
      emptyOrTrivialRate: number;
      uniqueDecisionRate: number;
    };
  };
  /** 改进建议聚合 */
  recommendations: {
    promptTweaks: string[];
    toolImprovements: string[];
    verificationRuleTightening: string[];
    candidateAntiPatterns: string[];
    maturityAdjustments: string[];
  };
  /** 应用状态（人审后填写） */
  applicationStatus?: {
    reviewedBy: string;
    reviewedAt: string;
    appliedSignals: string[];
    deferredSignals: string[];
    rejectedSignals: string[];
    notes?: string;
  };
}
```

## TLA+ manifest 模型（tla-manifest.json）

> TLA+ 行为层事实源。S 子代理产出 .tla/.cfg 后同步更新此文件；G 子代理跑 `check-tla-model.ts` 校验。
> 权威语义与操作细则见 [tla-plus-guide.md](tla-plus-guide.md)（manifest schema 节 + §2.0 命名规范 + §2.1 路径解析基准 + checkRounds 字段语义节）。

### tla-manifest.json

```typescript
interface TlaManifest {
  /** Schema 版本，当前固定为 1 */
  version: 1;
  /** 项目 ID（与 project.json 一致） */
  project: string;
  /** 当前所处阶段（1-8） */
  currentPhase: number;
  /** 路径解析基准（强制必填，P1.1）：相对 manifest 文件所在目录，jarPath/tlaPath/cfgPath 都基于此解析（见 tla-plus-guide.md §2.1） */
  basePath: string;
  /** TLA+ 工具链配置 */
  tools: {
    /** tla2tools.jar 路径，相对 basePath 解析（P1.1 起统一基准，不再按 cwd 解析；见 tla-plus-guide.md §2.1） */
    jarPath: string;
    /** Java 最低版本（默认 11） */
    javaMinVersion: number;
  };
  /** TLA+ 规格列表 */
  specs: TlaSpec[];
  /** TLA+ 校验轮次记录数组，语义见 tla-plus-guide.md「checkRounds 字段语义」节 */
  checkRounds: TlaCheckRound[];
}

interface TlaSpec {
  /** 规格 ID，须符合命名规范（MODULE 名格式 L<level>_<system>[_<subsystem>]，见 tla-plus-guide.md §2.0） */
  id: string;
  /** 层级（L1 / L2 / L3 / L4 ...） */
  level: 'L1' | 'L2' | 'L3' | 'L4';
  /** 产出阶段（1-8） */
  phase: number;
  /** 所属系统名称（层次路径用 :: 分隔，如 blog-system::auth-subsystem） */
  system: string;
  /** 关联需求 ID 列表（与 rtm.json 需求 ID 一致） */
  requirementIds: string[];
  /** 关联设计文档相对路径（可带锚点 #§） */
  designRef: string;
  /** .tla 文件路径，相对 manifest 文件所在目录解析（见 tla-plus-guide.md §2.1） */
  tlaPath: string;
  /** .cfg 文件路径，相对 manifest 文件所在目录解析 */
  cfgPath: string;
  /** 上级 TLA 文件相对路径（L1 填 null）；相对该 .tla 文件所在目录解析 */
  parent: string | null;
  /** 同级 TLA 文件相对路径列表；无填 [] */
  siblings: string[];
  /** 下级 TLA 文件相对路径列表；叶子填 [] */
  children: string[];
  /** 变量组合数（各变量取值域笛卡尔积） */
  variableCombination: number;
  /** 拆解决策：kept-below-threshold / consider-split / must-split / split-done */
  decompositionDecision: 'kept-below-threshold' | 'consider-split' | 'must-split' | 'split-done';
  /** SANY 语法检查是否通过 */
  syntaxChecked: boolean;
  /** TLC 模型检查是否通过 */
  tlcChecked: boolean;
  /** 是否无死锁 */
  deadlockFree: boolean;
  /** 不变式是否成立 */
  invariantsHold: boolean;
  /** 是否发生状态爆炸 */
  stateExplosion: boolean;
}

interface TlaCheckRound {
  /** 校验时所处阶段（1-8） */
  phase: number;
  /** 本阶段内校验轮次序号（从 1 起） */
  round: number;
  /** ISO 8601 时间戳 */
  timestamp: string;
  /** 校验的 spec id */
  specId: string;
  /** SANY 语法检查是否通过 */
  syntaxCheck: boolean;
  /** TLC 模型检查是否通过（--skip-tlc 时填 false 并备注） */
  tlcCheck: boolean;
  /** 本轮违反详情列表（死锁 + 不变式违反 + 状态爆炸等合计，每条为具体违反描述） */
  violations: string[];
  /** 本轮是否零违反收敛（violations.length === 0） */
  converged: boolean;
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `version` | `1` | 是 | Schema 版本 |
| `project` | string | 是 | 项目 ID |
| `currentPhase` | number | 是 | 当前阶段（1-8） |
| `tools.jarPath` | string | 是 | jar 路径，相对 **basePath** 解析（P1.1 起统一基准，不再按 cwd 解析；见 [tla-plus-guide.md §2.1](tla-plus-guide.md#§21-路径解析基准)） |
| `basePath` | string | 是 | 路径解析基准（强制必填，P1.1），相对 manifest 文件所在目录 |
| `tools.javaMinVersion` | number | 是 | Java 最低版本 |
| `specs[]` | TlaSpec[] | 是 | TLA+ 规格列表 |
| `specs[].id` | string | 是 | 规格 ID，须符合 [§2.0 命名规范](tla-plus-guide.md#§20-命名规范)（禁止连字符） |
| `specs[].tlaPath` / `cfgPath` | string | 是 | 相对 **manifest 文件所在目录**解析（见 [§2.1](tla-plus-guide.md#§21-路径解析基准)） |
| `specs[].parent` / `siblings` / `children` | string / string[] | 是 | 相对 **该 .tla 文件所在目录**解析；L1 `parent=null`，叶子 `children=[]` |
| `specs[].decompositionDecision` | enum | 是 | 拆解决策（组合数 >1w 必须 `split-done`） |
| `checkRounds[]` | TlaCheckRound[] | 是 | 校验轮次记录；**语义详见 [tla-plus-guide.md「checkRounds 字段语义」](tla-plus-guide.md#checkrounds-字段语义)**（含 spec 级语义、记录时机、单调递减规则、与 run-log R3 交叉校验、空值约定、[禁止字段](tla-plus-guide.md#禁止字段phase-级摘要)节）。元素 `violations` 类型为 `string[]`（与 `tla-logic.ts` 一致，第 16 轮 P4.3 修正）；含禁止字段（`phaseSummary`/`summary`/`phaseDecisions`/`phaseLevelSummary`）→ R13 校验拦截 |

**使用约定**：

- `tla-manifest.json` 由 S 子代理维护（产出 .tla 后同步更新），属"状态读写+持久化"允许动作。
- 阶段 5-8 冻结只读：编排者不应分派 S-tla 修改 TLA+ 资产（见 SKILL.md 自检清单）。
- `tla-manifest.json`（行为层）与 `graph.json`（结构层）、`rtm.json`（追溯层）并存，各自独立校验，互不替代。
- `checkRounds` 在项目首次产出 TLA+ 规格前填 `[]`；每轮校验后由 G 子代理追加一条记录。

## BDD 数据模型

### BddManifest

```typescript
interface BddManifest {
  schemaVersion: '1.0';
  projectId: string;
  basePath: string;
  currentPhase: number;
  features: BddFeature[];
  stateMachines: BddStateMachine[];
  checkRounds?: Array<{
    phase: 1 | 2 | 3 | 4;
    round: number;
    timestamp: string;
    violations: string[];
    converged: boolean;
  }>;
}
```

### BddStateMachine

```typescript
interface BddStateMachine {
  id: string;
  level: 1 | 2 | 3 | 4;
  states: string[];
  initialState: string;
  terminalStates: string[];
  acceptingStates: string[];
  rejectingStates: string[];
  transitions: BddTransition[];
  invariants: string[];
}
```

### BddFeature

```typescript
interface BddFeature {
  id: string;
  level: 1 | 2 | 3 | 4;
  filePath: string;
  scenarioCount: number;
  stateMachineId: string;
  tlaSpecId: string;
  reqIds: string[];
  designIds: string[];
  parentFeatureIds: string[];
  siblingFeatureIds: string[];
  childFeatureIds: string[];
}
```

### 与 TLA+ 数据模型的关系

BDD 状态机的 `states` / `initialState` / `transitions` / `invariants` 与同层 TLA+ spec 的 `State` / `Init` / `Next` / `Invariants` 一一对应，由 [`check-bdd-model.ts`](../scripts/check-bdd-model.ts) D4 校验等价性（见 [bdd-guide.md](bdd-guide.md)「BDD↔TLA+ 协作」节）。

## JSON Schema 强约束（借鉴 drawio-skill/styles/schema.json）

> 借鉴点 2（Task 3）：所有 .w-model/*.json 在进入业务规则校验前，必须先过 JSON Schema 前置校验。
> schema 用 draft-07 + `additionalProperties:false` 防字段漂移、`required` 防字段缺失、`type`/`enum`/`format` 防类型/枚举/格式错误。
> schema 文件统一存放于 `w-model-dev/schemas/*.schema.json`，由 `scripts/schema-loader.ts` 自动加载并按文件 basename（去 `.schema.json` 后缀）注册。
> 各 `*-logic.ts` 在校验函数入口调用 `validateBySchema(name, data)`，失败时以 `[schema]` 前缀返回错误，不再触达业务规则校验。

### Schema 清单（20 份）

| Schema 名（注册键） | 文件 | 目标类型 | 关键约束 | 对应 logic.ts |
| --- | --- | --- | --- | --- |
| `verifier-output` | `verifier-output.schema.json` | VerifierOutput | additionalProperties:false；meta/subCriteria 嵌套严格；summary minLength:50 | verifier-logic.ts |
| `rtm` | `rtm.schema.json` | RTMMatrixShape | additionalProperties:false；executionSummary 嵌套严格；coverage [0,100] | gate-logic.ts |
| `graph` | `graph.schema.json` | GraphShape | additionalProperties:false；node.type enum（REQ/SD/INTF/DD/EXT-IN/EXT-OUT）；edge.type enum（9 类） | graph-logic.ts |
| `tla-manifest` | `tla-manifest.schema.json` | TlaManifest | additionalProperties:false；spec.level enum（L1-L6）；decompositionDecision enum（4 类） | tla-logic.ts |
| `code-tla-manifest` | `code-tla-manifest.schema.json` | CodeTlaConsistencyInput | 顶层 additionalProperties:false（manifest/graph/rtm/codeSources）；兼容 codeFiles 运行时形态（见 schema description） | code-tla-logic.ts |
| `budget` | `budget.schema.json` | BudgetConfig | additionalProperties:false；onExceed enum；killSwitch.budgetBurnRate [0,1] | budget-logic.ts |
| `run-log` | `run-log.schema.json` | RunLogEntry | additionalProperties:false；action enum（27 类）；role enum（O/A/S/V/G/R） | run-log-logic.ts |
| `checkpoint-log` | `checkpoint-log.schema.json` | CheckpointLogEntry | run-log 子集：action 排除 rootcause/fix/escalate；role 排除 R | （暂未集成到 logic.ts validateBySchema，仅 self-test SCHEMA_CASES 覆盖） |
| `event-ingress` | `event-ingress.schema.json` | `EventIngressEntry` | additionalProperties:false；source enum（6 类）；eventType enum（9 类） | （暂未集成到 logic.ts，仅 self-test 覆盖） |
| `maturity` | `maturity.schema.json` | MaturityConfig | additionalProperties:false；level enum（L0-L3）；unlockConditions 嵌套严格 | maturity-logic.ts |
| `project` | `project.schema.json` | `Project` | additionalProperties:false；status enum（9 阶段）；techStack 嵌套严格 | （暂未集成到 logic.ts，仅 self-test 覆盖） |
| `hill-climbing-report` | `hill-climbing-report.schema.json` | `HarnessImprovementReport` | additionalProperties:false；signal.priority [1,5]；recommendations 5 字段全 required | （暂未集成到 logic.ts，仅 self-test 覆盖） |
| `rootcause-report` | `rootcause-report.schema.json` | RootCauseReport | additionalProperties:false；meta.targetKind const=rootcause；rootCauseChain minItems:2/maxItems:5 | root-cause-logic.ts |
| `bdd-manifest` | `bdd-manifest.schema.json` | BddManifest | additionalProperties:false；features 嵌套严格；scenario 路径与 RTM 映射 | bdd-logic.ts（check-bdd-model.ts 亦调用） |
| `coverage` | `coverage.schema.json` | CoverageAnalysis | additionalProperties:false；4 张覆盖矩阵（stakeholder/scenario/requirementType/crossCuts）+ coveragePercent [0,100] | coverage-logic.ts |
| `design-contract` | `design-contract.schema.json` | DesignContractInput | additionalProperties:false；routes/assertions 契约字段 | design-contract-logic.ts |
| `exemption` | `exemption.schema.json` | ExemptionRequest | additionalProperties:false；四阶段审批字段（justification/evidence/review/verification/humanDecision） | exemption-logic.ts |
| `preventive-review` | `preventive-review.schema.json` | PreventiveReview | additionalProperties:false；dimension enum（completeness/reliability/security） | preventive-review-logic.ts |
| `signature-chain` | `signature-chain.schema.json` | SignatureChainEntry | additionalProperties:false；inputProvenance 来源证明；actorRole enum | （暂未接入 validateBySchema，经 readJsonlOrExit 标签间接使用） |
| `iceberg-sweep` | `iceberg-sweep.schema.json` | IcebergSweepReport | additionalProperties:false；reportId/phase/triggerType/icebergRound/线索来源/newFindings/sweepCoverage/summary/passed | iceberg-sweep-logic.ts |

### 设计原则

1. **structural-first**：结构性约束（字段缺失 / 类型错误 / 未知字段 / 枚举越界）一律由 schema 拦截，业务规则仅校验语义一致性（如 RTM 覆盖率、parent/child 双向一致、compositeScore 与 Σ 重算一致）。
2. **`additionalProperties:false` 全层级**：顶层 + 嵌套对象均禁止未知字段，防字段漂移（如 VerifierOutput 顶层多 `unknownField` → schema 拒绝）。
3. **`[schema]` 前缀**：所有 schema 错误统一以 `[schema]` 前缀返回，便于 Agent 与日志区分"结构错误"vs"业务规则违反"。
4. **样本兼容**：schema 设计须让 `samples/*/valid*.json` 通过；如样本与 schema 冲突，优先调整 schema（放宽）或修复样本，不得破坏现有测试。
5. **运行时形态兼容**：含 AST/函数等不可 JSON 序列化字段的输入（如 `code-tla-logic.ts` 的 `codeFiles`），schema 校验时仅传入 JSON 兼容子集（`manifest + graph + rtm`），不传 `codeFiles`。

### 集成模式（`*-logic.ts`）

```typescript
import { validateBySchema } from './schema-loader.js';

export function checkXxx(input: unknown): XxxResult {
  // 1. 类型守卫（null / 非对象）
  if (!input || typeof input !== 'object') return { passed: false, ... };

  // 2. Schema 前置校验（结构性约束）
  const schemaResult = validateBySchema('xxx-schema', input);
  if (!schemaResult.valid) {
    return {
      passed: false,
      reasons: schemaResult.errorMessages.map(m => `[schema] ${m}`),
    };
  }

  // 3. 业务规则校验（语义一致性）
  // ... 仅在 schema 通过后触达 ...
}
```

### 测试基线

- `self-test.ts` SCHEMA_CASES：14 个 schema 名共 16 条用例（3 verifier-output 基线 + 13 其他各 1 条：budget / checkpoint-log / code-tla-manifest / event-ingress / graph / hill-climbing-report / maturity / project / rootcause-report / rtm / run-log / tla-manifest / coverage）。
- `__tests__/schema-validation.test.ts`：5 条 validateBySchema 单元测试 + 4 条 checkVerifierOutput 集成测试。
- self-test 基线：99 → 111（+12，对应 12 份新 schema 各 1 条样本用例）。

