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
  }
}
```

**使用约定**：

- `budget.json` 由编排者 O 维护，属"状态读写+持久化"允许动作（非实施，不触发反模式 #10）。
- 编排者在每个阶段门放行前执行预算检查（汇总 `run-log.jsonl` 中本阶段/全项目 tokens），超限按 `onExceed` 处置。
- `tokensEstimate` 由宿主 Agent 报告实际消耗（`estimated=false`）；不得用 LLM 估算（`estimated=true` 违反约束 4）。
- 预算检查不替代门禁脚本（反模式 #3/#6）：预算超限触发暂停/告警，放行仍由 G 子代理退出码决定。

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
  action: 'chunk' | 'cross' | 'evolve' | 'produce' | 'review' | 'gate' | 'tla-gate' | 'graph-gate' | 'test' | 'checkpoint' | 'rework' | 'rollback';
  /** 子代理角色 */
  role: 'O' | 'A' | 'S' | 'V' | 'G';
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
  /** 结果 */
  outcome: 'success' | 'fail' | 'rework' | 'escalate' | 'blocked' | 'cancelled';
  /** 阶段门放行时（action=checkpoint & outcome=success），用户填写的理解证据（见 §10.6 第六维度） */
  acknowledgedDecisions?: string[];
  /** 备注（rework 原因 / escalation 上下文 / 阻塞说明 / O 系列失败模式标注如 "O1 Token Burn"） */
  note?: string;
  /** 本条记录涉及的产物路径（如有） */
  artifacts?: string[];
}
```

**示例记录**（阶段门放行）：

```json
{"runId":"2026-07-23T10-15-00Z","timestamp":"2026-07-23T10:22:13Z","phase":3,"phaseName":"概要设计","action":"checkpoint","role":"O","duration_s":420,"tokens":85000,"estimated":false,"subagentSpawns":4,"gateExitCode":0,"outcome":"success","acknowledgedDecisions":["采用 REST + JWT 认证方案而非 GraphQL","评论模块独立存储不共享 article 表"],"note":"阶段门放行，V 评审 qualityLevel=A compositeScore=0.91","artifacts":["docs/outline-design.md"]}
```

**使用约定**：

- `run-log.jsonl` 是 append-only：不得修改历史记录；损坏行跳过并记录 note，不停止流程。
- 编排者 O 在以下时机 append：子代理分派返回后 / 门禁脚本执行后 / 🔴 CHECKPOINT 放行后 / 返工回退后。
- `acknowledgedDecisions` 在阶段门放行时由用户填写（≥1 关键决策摘要，非"确认"/"同意"）；为空视为 O4（Comprehension Debt）命中，拒绝放行。
- `note` 字段用于标注 O 系列失败模式命中（如 "O1 Token Burn"、"O3 Verifier Theater"）。

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
