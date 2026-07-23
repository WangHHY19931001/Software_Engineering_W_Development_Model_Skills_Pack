# 设计：Loop Engineering 运维层与成熟度阶梯采纳

> **类型**：设计增量（design delta）
> **状态**：待评审
> **作用范围**：w-model-dev 技能包全阶段（运维层、成熟度、失败模式、理解债务）
> **创建日期**：2026-07-23
> **依赖**：[skill-design-document_SSoT.md](./skill-design-document_SSoT.md) §3.3 / §3.4 / §4 / §4A / §10.5 / §10.6 / §10A；[w-model-dev/SKILL.md](../w-model-dev/SKILL.md)「不可违反的约束」/「编排者-子代理边界」/「核心操作行为」；[w-model-dev/references/anti-patterns.md](../w-model-dev/references/anti-patterns.md)（17 反模式 + F1~F10）；[w-model-dev/references/operational-recovery.md](../w-model-dev/references/operational-recovery.md)；[w-model-dev/references/data-models.md](../w-model-dev/references/data-models.md)；[w-model-dev/references/verifier-spec.md](../w-model-dev/references/verifier-spec.md) §6
>
> **参考来源**：[cobusgreyling/loop-engineering](https://github.com/cobusgreyling/loop-engineering)（MIT，调研于 2026-07-23）—— `docs/primitives.md` / `docs/failure-modes.md` / `docs/anti-patterns.md` / `docs/loop-design-checklist.md` / `docs/concepts.md` / `docs/operating-loops.md`
>
> **与 SSoT 的关系**：本文件为设计输入文档，定义 4 项运维层增强（成本预算+运行日志、自主成熟度阶梯、运维失败模式 O1~O6、理解债务显式化）。实现阶段须先把这些设计合并入 SSoT §10C（成熟度）/ §10D（成本与运行日志）/ §4A.2（运维失败模式扩展）/ §10.6（DoD 理解证据维度），再同步 `w-model-dev/` 资产（遵循 AGENTS.md「SSoT 优先」约束）。

## 0. 背景与目标

### 0.1 问题陈述

对 [cobusgreyling/loop-engineering](https://github.com/cobusgreyling/loop-engineering) 的深入调研表明：w-model-dev 在**验证严谨性**（O/A/S/V/G 五角色 + 确定性门禁脚本 + TLA+ 行为建模 + RTM 双向追溯 + 信息流校验）上已显著强于 loop-engineering；但存在 4 项**运维层与持续工程层**的系统性缺口：

1. **成本不可见**：一次 W 模型 8 阶段全跑 = 多子代理 × 8 阶段 + ingestion 收敛轮 + TLA+ 建模，成本可观且完全不可见。`operational-recovery.md` 只覆盖异常恢复（JSON 损坏/并发写入/技术栈漂移），不覆盖成本预算与 kill switch。对照 loop-engineering 的 `loop-budget.md` + `loop-cost` + `loop-run-log.md`，w-model-dev 完全缺失。
2. **自主度无阶梯**：当前每个 🔴 CHECKPOINT 都等用户，等于强制最高介入度。大项目/成熟团队无法"毕业"，CHECKPOINT 密度成为瓶颈。loop-engineering 的 L0/L1/L2/L3 阶梯正解此题——但 w-model-dev 隐式全 attended，无成熟度模型。
3. **运维失败模式未命名**：现有 17 条流程反模式（#1~#17）+ 10 条行为退化（F1~F10）全是**流程正确性/行为退化**，缺**运维层**失败。W 模型产出大量产物，理解债务风险高。loop-engineering failure-modes.md 的 Token Burn / State Rot / Verifier Theater / Comprehension Debt Spiral / Cognitive Surrender / Notification Fatigue 是运维层正解。
4. **理解债务隐性化**：loop-engineering 的 comprehension debt 概念直击 W 模型最大隐性风险——用户对 8 阶段产物逐一 rubber-stamp。w-model-dev 的 CHECKPOINT 是"门"不是"理解证据"，放行 ≠ 理解。

### 0.2 目标

- **优化1**：引入声明式成本预算（`.w-model/budget.json`）+ append-only 运行日志（`.w-model/run-log.jsonl`），使一次 W 模型运行的成本与历史可追溯。**不引入 LLM 估算**（避免反模式 #3 同源风险）。
- **优化2**：引入 L0~L3 自主成熟度阶梯，按级别选择性激活 CHECKPOINT，使成熟团队可"毕业"到低介入度。不违反约束 2（CHECKPOINT 不可绕过——L3 仍有人工 gate 在高风险路径）。
- **优化3**：新增 6 条运维失败模式（O1~O6），与现有 17 反模式 + F1~F10 互补，命名运维层风险。
- **优化4**：将 CHECKPOINT 放行升级为"理解证据"——用户放行前须在 run-log 填入本阶段 ≥1 关键决策摘要，对抗 rubber-stamp。

### 0.3 设计原则

本设计严格遵循 w-model-dev 现有架构原则，4 项优化均为**增量、声明式、不破坏现有机制**：

| 原则 | 本设计的遵守方式 |
|---|---|
| 技能不内置 LLM 调用（§3.3） | 预算是声明式 JSON、日志是 append-only、成熟度是 CHECKPOINT 选择性激活、理解证据是字段填写——均无 LLM 调用 |
| 脚本自包含仅依赖 tsx | 不新增脚本（预算/日志/成熟度/理解证据均由编排者 O 维护状态文件，类比 `/wm reset` 对 `.w-model/*.json` 的操作） |
| 编排者最小化（§3.4） | O 维护 budget.json/run-log.jsonl/maturity.json 属"状态读写+持久化"允许动作，非实施动作；不改 S/V/G 边界 |
| CHECKPOINT 不可绕过（约束2） | L0~L3 阶梯是 CHECKPOINT **选择性激活**，非绕过；L3 仍保留高风险路径人工 gate |
| 真实执行（约束4） | tokensEstimate 由宿主 Agent 报告实际消耗，不 LLM 估算；acknowledgedDecisions 由用户真实填写，不 LLM 生成 |

### 0.4 不在范围内

- **不照搬 loop-engineering 的调度自动化（cron/`/loop`）**：W 模型是**一次性顺序工程流程**，非周期运维；强行加调度会扭曲其 SE 本质。
- **不照搬 Worktree 并行隔离**：W 模型 8 阶段**严格串行**（阶段门依赖前序），并行隔离无落点；ingestion 的 A-chunk 并行分块已实现。
- **不照搬 MCP 连接器**：SSoT §11.2 已明确"外部集成由消费方自行实现"，技能不内置连接器是架构原则。
- **不照搬路径 denylist/auto-merge allowlist**：仅在自主度达 L3 时才需要；当前 L0 attended 下 CHECKPOINT 已是更强的人工 gate。L3 级别本设计定义其需求但不实现脚本。
- **不新增门禁脚本**：4 项优化均不改 `check-*.ts` 脚本逻辑；预算/日志/成熟度/理解证据是状态文件 + Markdown 节扩展。

## 1. 优化1：成本预算与运行日志

### 1.1 设计动机

对照 loop-engineering 的 `loop-budget.md`（声明日预算 + kill switch）+ `loop-run-log.md`（append-only 运行历史）+ `loop-cost`（token 估算 CLI）：

- w-model-dev 缺预算 → 成本失控不可见，无法在成本超限时暂停。
- w-model-dev 缺运行日志 → 状态文件只存当前态，无法回溯"为什么阶段 3 重做了 2 轮"。
- loop-engineering 的 `loop-cost` 用 LLM 估算 token → 与 w-model-dev 约束4（真实执行）冲突，**不照搬**。

### 1.2 `.w-model/budget.json` Schema

> 编排者 O 在项目初始化（`/wm analyze` 首次）时创建，类比 `project.json`/`rtm.json` 的初始化。用户可在任意时刻编辑调整。

```typescript
interface BudgetConfig {
  /** Schema 版本 */
  schemaVersion: '1.0';
  /** 项目 ID（与 project.json 一致） */
  projectId: string;
  /** 创建与最后修改时间 */
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601

  /** 每阶段 token 预算上限（单位：token） */
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

### 1.3 `.w-model/run-log.jsonl` Schema

> Append-only JSON Lines 格式，每行一条记录。编排者 O 在**每个子代理分派返回后**与**每个阶段门/质量门完成后** append 一条。类比 loop-engineering 的 `loop-run-log.md`，但结构化（JSONL 便于程序化分析）。

每条记录 schema：

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
  /** 阶段门放行时（action=checkpoint & outcome=success），用户填写的理解证据（优化4） */
  acknowledgedDecisions?: string[];
  /** 备注（rework 原因 / escalation 上下文 / 阻塞说明） */
  note?: string;
  /** 本条记录涉及的产物路径（如有） */
  artifacts?: string[];
}
```

**示例记录**（阶段门放行）：

```json
{"runId":"2026-07-23T10-15-00Z","timestamp":"2026-07-23T10:22:13Z","phase":3,"phaseName":"概要设计","action":"checkpoint","role":"O","duration_s":420,"tokens":85000,"estimated":false,"subagentSpawns":4,"gateExitCode":0,"outcome":"success","acknowledgedDecisions":["采用 REST + JWT 认证方案而非 GraphQL","评论模块独立存储不共享 article 表"],"note":"阶段门放行，V 评审 qualityLevel=A compositeScore=0.91","artifacts":["docs/outline-design.md"]}
```

### 1.4 编排者维护职责（O 角色扩展，不改 S/V/G 边界）

> 在 `subagent-delegation.md`「编排者允许动作」清单中新增「预算与日志维护」项，与现有「读 .w-model/*.json」「跑只读脚本看退出码」并列。仍属"状态读写+持久化"允许动作，非实施。

| 时机 | O 的动作 |
|---|---|
| 项目初始化（`/wm analyze` 首次） | 创建 `.w-model/budget.json`（默认值）+ 创建空 `.w-model/run-log.jsonl` |
| 每次子代理分派返回后 | append 一条 RunLogEntry（action 对应角色动作） |
| 每个门禁脚本执行后 | append 一条 RunLogEntry（gateExitCode 填实际退出码） |
| 每个 🔴 CHECKPOINT 放行后 | append 一条 RunLogEntry（action=checkpoint，acknowledgedDecisions 填用户输入） |
| 每次返工/回退后 | append 一条 RunLogEntry（action=rework/rollback，note 填原因） |
| 预算检查点（每阶段门后） | 读 budget.json + 累计本阶段 run-log tokens，若超 maxTokens 或触发 killSwitch → 按 onExceed 处置 |

**预算检查逻辑**（编排者 O 在阶段门放行前执行，确定性，无 LLM）：

```
1. 读取 budget.json
2. 汇总 run-log.jsonl 中本阶段（phase=N）所有记录的 tokens 总和 = phaseTokensUsed
3. 汇总 run-log.jsonl 中本阶段 subagentSpawns 总和 = phaseSpawns
4. 汇总 run-log.jsonl 中全项目 tokens 总和 = projectTokensUsed
5. 判定：
   - 若 phaseTokensUsed ≥ perPhase.maxTokens → 触发预算告警
   - 若 phaseSpawns ≥ perPhase.maxSubagentSpawns → 触发预算告警
   - 若 projectTokensUsed ≥ project.maxTokensTotal → 触发项目级告警
   - 若 killSwitch 任一条件满足 → 触发 kill switch
6. 按 onExceed 处置：
   - pause: 🔴 CHECKPOINT · 预算告警，展示 {phaseTokensUsed/maxTokens, projectTokensUsed/maxTokensTotal, killSwitch 状态}，等用户决定
   - notify: run-log append 告警记录，继续
   - halt: 回退到阶段起点，run-log append halt 记录
```

### 1.5 `operational-recovery.md` 扩展

在现有「路径与运行环境 / 状态文件恢复 / 外部评审与门禁异常 / 技术栈与阶段漂移 / 大项目与用户中断」5 节基础上，新增第 6 节：

```markdown
## 成本预算与运行日志

### 预算超限

| 场景 | 必须动作 |
|---|---|
| 单阶段 token 超过 budget.json.perPhase.maxTokens | 按 onExceed 处置；默认 pause → 🔴 CHECKPOINT · 预算告警 |
| 项目级 token 超过 budget.json.project.maxTokensTotal | 立即 halt；回退到当前阶段起点；告知用户累计消耗 |
| 单会话 token 超过 maxTokensPerSession | 暂停后续子代理分派，建议用户开新会话续接 |
| onExceed=notify 但连续 3 次告警 | 自动升级为 pause，强制 🔴 CHECKPOINT |

### kill switch 触发

| 触发条件 | 动作 |
|---|---|
| 连续阶段返工次数 ≥ killSwitch.consecutiveReworks | 全流程暂停；展示返工历史；询问是否降级范围/取消 |
| 单阶段 token 占 maxTokens ≥ killSwitch.budgetBurnRate | 暂停后续子代理；展示消耗明细；询问增预算/降范围 |
| TLA+ 规格返工 ≥ killSwitch.tlaReworks | 暂停 TLA+ 建模；询问是否简化建模范围或回退修正需求/设计 |

### 运行日志维护

| 场景 | 动作 |
|---|---|
| run-log.jsonl 不存在 | 项目未初始化或被误删；引导 /wm analyze 初始化，或从 git 恢复 |
| run-log.jsonl 解析失败（某行非合法 JSON） | 跳过损坏行，记录到 run-log 末尾一条 note=「日志损坏行已跳过」；不停止流程 |
| 需要导出运行历史 | /wm export 包含 run-log.jsonl；可离线分析成本与返工模式 |
```

### 1.6 SSoT 同步点

- SSoT §10D「成本预算与运行日志」（新增）：权威定义 budget.json / run-log.jsonl schema + 编排者维护职责 + 预算检查逻辑。
- SSoT §3.4.2 角色表「编排者 O 允许动作」新增：「维护 budget.json / run-log.jsonl（状态读写，非实施）」。
- SSoT §10A 追溯表新增行：§10D → `w-model-dev/references/operational-recovery.md`「成本预算与运行日志」节 + `w-model-dev/references/data-models.md`（budget/run-log schema）。

---

## 2. 优化2：自主成熟度阶梯 L0~L3

### 2.1 设计动机

对照 loop-engineering 的 `loop-design-checklist.md` L0 Draft / L1 Report / L2 Assisted / L3 Unattended：

- w-model-dev 当前每个 🔴 CHECKPOINT 都等用户 → 等于强制 L0，大项目/成熟团队无法"毕业"。
- loop-engineering 的阶梯正解：按成熟度选择性激活 CHECKPOINT，使团队可渐进到低介入度。
- **关键约束**：不违反约束 2（CHECKPOINT 不可绕过）——L3 仍保留高风险路径人工 gate，只是低风险 CHECKPOINT 自动放行。

### 2.2 CHECKPOINT 分类

现有 🔴 CHECKPOINT 分为两类，按成熟度选择性激活：

| CHECKPOINT 类型 | 示例 | L0 | L1 | L2 | L3 |
|---|---|---|---|---|---|
| **决策型**（设计方向/技术选型/范围变更） | 项目初始化、阶段进入确认、设计选型、ingestion 规划确认 | ✅ 等用户 | ✅ 等用户 | ✅ 等用户 | ✅ 等用户（高风险路径强制） |
| **操作型**（已跑脚本/已执行测试/已产出产物） | 阶段门放行（V 评审通过 + G 退出码 0）、ingestion 收敛确认（G 退出码 0）、测试结果回填确认 | ✅ 等用户 | ⚡ 自动放行 | ⚡ 自动放行 | ⚡ 自动放行 |

> 「决策型」始终等用户（L3 亦然）——设计方向不可自动决定。「操作型」在 L1+ 可自动放行——已有脚本退出码作为客观证据，人工确认是冗余。

### 2.3 L0~L3 放行矩阵

| 级别 | 决策型 CHECKPOINT | 操作型 CHECKPOINT | 返工循环 | 发布门 | 解锁条件 |
|---|---|---|---|---|---|
| **L0（默认，新项目/棕地）** | ✅ 等用户 | ✅ 等用户 | ✅ 每次返工都暂停询问 | ✅ 等用户 | 项目初始化即默认 L0 |
| **L1（操作确认自动化）** | ✅ 等用户 | ⚡ 自动放行（脚本退出码=0 即放行，run-log 记录） | ✅ 每次返工都暂停询问 | ✅ 等用户 | L0 稳定运行 ≥1 个完整 8 阶段周期，无 O 系列失败模式命中 |
| **L2（返工自主化）** | ✅ 等用户 | ⚡ 自动放行 | ⚡ 阶段 5-7 返工可自主（带 attempt cap=maxReworkRounds，超限升级） | ✅ 等用户 | L1 稳定运行 ≥2 周，attempt cap 达标率 ≥80%，无 Token Burn/O3 Verifier Theater |
| **L3（高风险路径外的全自主）** | ✅ 等用户（仅高风险路径：auth/加密/发布/架构变更） | ⚡ 自动放行 | ⚡ 全阶段返工可自主（带 attempt cap） | ✅ 等用户（发布门始终 attended） | L2 稳定运行 ≥2 周，误判率 ≤10%，用户显式申请升级 |

**L3 高风险路径定义**（强制人工 gate，不可自动放行）：

| 高风险路径 | 触发条件 | 强制动作 |
|---|---|---|
| 认证/授权相关 | 阶段 4 详细设计涉及 auth 模块 / 阶段 5 编码涉及 auth 文件 | 决策型 CHECKPOINT 等用户 |
| 加密/密钥相关 | 涉及 JWT_SECRET / 密码哈希 / 加密算法选型 | 决策型 CHECKPOINT 等用户 |
| 发布放行 | 阶段 8 验收终检 + check-artifact-gate.ts | 始终 attended（L3 亦然） |
| 架构变更 | 技术栈增删 / 模块边界变更 / 数据模型 schema 变更 | 决策型 CHECKPOINT 等用户 |
| TLA+ 建模不符需求/设计（反模式 #17） | TLC 发现违反且规格忠实于需求/设计 | 决策型 CHECKPOINT 等用户（须回退修正需求/设计） |

### 2.4 `.w-model/maturity.json` Schema

```typescript
interface MaturityConfig {
  /** Schema 版本 */
  schemaVersion: '1.0';
  /** 项目 ID */
  projectId: string;
  /** 当前成熟度级别 */
  level: 'L0' | 'L1' | 'L2' | 'L3';
  /** 升级到此级别的时间 */
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

### 2.5 编排者成熟度判定逻辑（确定性，无 LLM）

> 编排者 O 在每个 🔴 CHECKPOINT 处读取 maturity.json，按当前 level 决定 CHECKPOINT 类型。

```
1. 读取 maturity.json.level
2. 识别当前 CHECKPOINT 类型（决策型 / 操作型）
3. 查 L0~L3 放行矩阵：
   - 若该级别下此类型 = ✅ 等用户 → 执行 CHECKPOINT 暂停
   - 若该级别下此类型 = ⚡ 自动放行 → 跳过暂停，run-log append action=checkpoint outcome=success note="L<N> 自动放行"
4. 检查高风险路径（仅 L3）：
   - 若当前产物/动作命中高风险路径表 → 即使 L3 也强制决策型 CHECKPOINT
5. 升级判定（每次阶段 8 完成后）：
   - 汇总 unlockConditions 各字段
   - 若全部达标 → 询问用户是否升级（决策型 CHECKPOINT，不可自动升级）
   - 用户确认 → 更新 maturity.json.level + history
6. 降级判定（每次 O 系列失败模式命中后）：
   - 若 operationalFailures ≥ downgradeTriggers.operationalFailureStreak → 自动降级到 L0
   - run-log append 降级记录
```

### 2.6 SSoT 同步点

- SSoT §10C「自主成熟度阶梯」（新增）：权威定义 L0~L3 + 放行矩阵 + 高风险路径 + maturity.json schema + 升级/降级逻辑。
- SSoT §3.4.3「每阶段分派时序」补充：CHECKPOINT 类型由 §10C maturity.json.level 决定。
- SSKILL.md「不可违反的约束」第 2 条补充：「CHECKPOINT 不可绕过——L1+ 的自动放行是操作型 CHECKPOINT 的选择性激活，非绕过；决策型 CHECKPOINT 在所有级别均等用户」。
- SSoT §10A 追溯表新增行：§10C → `w-model-dev/references/operational-recovery.md`「成熟度与 CHECKPOINT 放行」节 + `w-model-dev/references/data-models.md`（maturity schema）。

---

## 3. 优化3：运维失败模式 O1~O6

### 3.1 设计动机

对照 loop-engineering `failure-modes.md` 的 10 条运维失败模式，w-model-dev 现有 17 反模式（流程破坏）+ F1~F10（行为退化）缺**运维层**：

- 现有反模式聚焦"流程是否走对"（跳评审/估算门禁/越权实施），不覆盖"运行是否健康"（成本/状态腐烂/评审形式化/理解债务）。
- 现有 F1~F10 聚焦"Agent 行为是否退化"（静默假设/硬猜推进），不覆盖"用户与系统交互是否健康"（rubber-stamp/通知疲劳/认知放弃）。

### 3.2 O1~O6 定义

> 新增独立「运维失败模式」节，不混入现有反模式编号（#1~#17）或失败模式编号（F1~F10）。O 系列命中**不触发脚本回退**（与 F1~F10 同级，软标注），但 O4/O5 直接关联 CHECKPOINT 有效性。

| # | 失败模式 | 症状 | 严重度 | 与现有反模式/失败模式的关系 | 缓解措施 |
|---|---|---|---|---|---|
| **O1** | Token Burn（子代理链对空/噪声 triage 全跑） | 单阶段 token 消耗异常高；ingestion 对低信息量输入仍全跑 A-chunk×N | S1（成本浪费） | 与 F10（跳过验证）互补：F10 是不验证，O1 是过度验证 | 预算检查（优化1）+ 早退：triage 发现空输入时 A-chunk 数=1；budgetBurnRate 触发 kill switch |
| **O2** | State Rot（状态文件引用已合并/已废弃产物） | rtm.json/graph.json 引用已删除文件或已废弃 ID | S1→S2（loop acts on ghosts） | 与 #9（谎报状态）互补：#9 是状态造假，O2 是状态腐烂 | 每阶段门 G 子代理校验产物路径存活（`ls`/`git status`）；ID 失活 → 标记并 prune |
| **O3** | Verifier Theater（V 子代理"looks good"但 CI 挂） | V 评审 passed=true qualityLevel=A 但下游测试失败 | S2（缺陷后移） | 与 #1（跳过评审）对立面：评审走了形式 | 强化 verifier-spec §1 设计原则：V 默认拒绝姿态（"find reasons to reject"）；V 须引用具体 evidence 非空泛；G 校验 evidence 非空 |
| **O4** | Comprehension Debt Spiral（用户橡皮图章 CHECKPOINT） | 用户对所有 CHECKPOINT 输入"确认"无修改意见；阶段产物无人理解 | S2（长期） | 与 F5（sycophantic）互补：F5 是 Agent 奉承用户，O4 是用户奉承 Agent | 理解证据机制（优化4）：放行前须填 acknowledgedDecisions ≥1 关键决策；空确认视为 O4 命中 |
| **O5** | Cognitive Surrender（"循环处理了"无设计意见） | 用户放弃对设计/架构的意见；全权委托 Agent | S2（文化） | 与 §4A.1 第 3 条（Push Back）对立面 | 阶段 2/4 设计 CHECKPOINT 强制用户提出 ≥1 修改意见或替代方案；无意见视为 O5 命中 |
| **O6** | Escalation Failure（attempt cap 触发但无人被通知） | 返工达 maxReworkRounds 但用户未被告知；循环卡死 | S2（卡死） | 与 #8（越过 CHECKPOINT）互补：#8 是显式越过，O6 是隐式卡死 | attempt cap 触发 → run-log append escalate 记录 + 强制 🔴 CHECKPOINT 展示返工历史 |

### 3.3 检测信号与处理流程

> 与现有 anti-patterns.md「检测信号与回退命令」节同构。O 系列命中不回退，但应在 run-log 的 note 字段标注，并在阶段产物的「备注」节或评审报告的 reworkHints 中记录。

| # | 检测信号（Agent 自查） | 命中后动作 | 关联机制 |
|---|---|---|---|
| O1 | budget.json 触发预算告警 / 单阶段 tokens > maxTokens×0.8 | 暂停后续子代理；展示消耗明细；询问降范围/增预算 | 优化1 预算检查 |
| O2 | G 子代理校验产物路径时发现 rtm.json/graph.json 引用的文件不存在 | 标记失活 ID；prune 状态文件；run-log append note="O2 State Rot" | G 子代理职责扩展（路径存活校验） |
| O3 | V 评审 passed=true 但 G 门禁退出码 1（V 与 G 矛盾） | 标注 O3；V 评审降级重做（强化 evidence 引用）；run-log append note="O3 Verifier Theater" | verifier-spec §1 设计原则 |
| O4 | 阶段门 CHECKPOINT 用户放行但 acknowledgedDecisions 为空/仅"确认" | 拒绝放行；要求用户填入 ≥1 关键决策摘要；run-log append note="O4 Comprehension Debt" | 优化4 理解证据 |
| O5 | 阶段 2/4 设计 CHECKPOINT 用户无修改意见/替代方案 | 拒绝放行；要求用户提出 ≥1 修改意见或替代；run-log append note="O5 Cognitive Surrender" | 阶段 2/4 CHECKPOINT 强化 |
| O6 | attempt cap（maxReworkRounds）触发但无 escalate 记录 | 强制 🔴 CHECKPOINT 展示返工历史；run-log append action=escalate；询问降级/取消 | 优化1 killSwitch + 返工循环 |

### 3.4 与现有反模式/失败模式的层级关系

```
层 1：流程反模式 #1~#17（命中即回退，脚本守护）
  ↓ 互补
层 2：行为退化 F1~F10（命中不回退但标注，Agent 自检）
  ↓ 互补
层 3：运维失败模式 O1~O6（命中不回退但标注，用户+系统协同检测）
```

- **层 1** 是"流程是否走对"——由门禁脚本退出码强制。
- **层 2** 是"Agent 行为是否退化"——由 Agent 自检或 V 评审标注。
- **层 3** 是"运行是否健康"——由预算检查（O1/O6）、路径存活校验（O2）、V-G 矛盾检测（O3）、理解证据机制（O4/O5）协同检测。

### 3.5 anti-patterns.md 扩展

在现有「反模式清单（17 条）」+「失败模式清单（F1~F10）」基础上，新增第三类：

```markdown
## 运维失败模式清单（O1~O6）

> 吸收自 [cobusgreyling/loop-engineering](https://github.com/cobusgreyling/loop-engineering) `docs/failure-modes.md`，适配 W 模型语境。
> 与 17 条流程反模式（#1~#17）+ 10 条行为退化（F1~F10）互补：反模式是流程破坏，失败模式是行为退化，运维失败模式是运行健康问题。
> O 系列命中**不触发脚本回退**（与 F1~F10 同级），但应在 run-log 的 note 字段标注，并在阶段产物「备注」节或评审报告 reworkHints 中记录。

[此处插入 §3.2 的 O1~O6 表格 + §3.3 的检测信号表]
```

### 3.6 SSoT 同步点

- SSoT §4A.2「失败模式清单」扩展为「失败模式清单（F1~F10 + O1~O6）」：新增运维失败模式定义。
- SSoT §4A.3「与现有约束的关系」新增第四层：「运维失败模式（O1~O6）」是运行健康问题，由预算检查/路径校验/V-G 矛盾检测/理解证据机制协同检测。
- SSoT §10A 追溯表更新 §4A 行：实现位置新增 anti-patterns.md「运维失败模式清单」节。

---

## 4. 优化4：理解债务显式化与阶段摘要

### 4.1 设计动机

对照 loop-engineering `concepts.md` 的 Comprehension Debt 概念 + `operating-loops.md` 的 digest：

- W 模型最大隐性风险是用户对 8 阶段产物逐一 rubber-stamp——CHECKPOINT 是"门"不是"理解证据"。
- loop-engineering 的 comprehension debt 直击此点："Faster loops ship more code you didn't write — comprehension debt grows unless you read what the loop made."
- w-model-dev 的 VerifierOutput 已有 `summary` 字段（§6 Schema，非空字符串），可复用作为阶段 digest。

### 4.2 acknowledgedDecisions 机制（嵌入 run-log）

> 复用优化1 的 run-log.jsonl，在阶段门放行记录（action=checkpoint, outcome=success）的 `acknowledgedDecisions` 字段填入用户理解证据。

**机制**：

1. 阶段门放行前，编排者 O 展示 G 子代理返回的证据（质量等级/各子标准分/reworkHints）+ V 子代理产出的 `VerifierOutput.summary`（阶段 digest，已存在字段）。
2. O 要求用户在放行前填入 `acknowledgedDecisions`：本阶段 ≥1 关键决策摘要（非空白确认）。
3. O 将 acknowledgedDecisions 写入 run-log 该条记录。
4. **O4 检测**：若 acknowledgedDecisions 为空/仅"确认"/"同意"等无信息字符串 → 视为 O4（Comprehension Debt）命中，拒绝放行，要求用户重新填写。

**acknowledgedDecisions 示例**：

```json
{
  "action": "checkpoint",
  "outcome": "success",
  "acknowledgedDecisions": [
    "采用 REST + JWT 认证方案而非 GraphQL，原因是 REST 与现有团队技能匹配",
    "评论模块独立存储不共享 article 表，降低耦合但增加查询成本",
    "TLA+ L2 规格验证了并发评论无死锁，但未覆盖文章删除时的评论级联"
  ]
}
```

### 4.3 V 子代理阶段 digest 强化（复用现有 summary 字段）

> VerifierOutput.summary 已是必填非空字符串（verifier-logic.ts 第 49 行校验）。本优化**不新增字段**，只强化 summary 的内容要求。

**强化要求**（写入 verifier-spec.md §6 summary 字段说明）：

```markdown
### summary 字段内容要求

`summary` 不仅是主结论，更是**阶段 digest**——供用户在 CHECKPOINT 放行时对照理解。V 子代理须在 summary 中包含：

1. **本阶段关键决策摘要**（≥1 条）：设计选型/架构决策/范围取舍/风险接受。
2. **本阶段产物核心结构**（1-2 句）：如"系统设计含 4 模块、3 接口、2 数据模型"。
3. **遗留风险/已知限制**（如有）：如"TLA+ L2 未覆盖文章删除级联"、"性能基线待阶段 7 k6 实测"。

示例：
"本阶段系统设计采用 Express+TypeScript+内存存储，4 模块（auth/article/comment/common），REST API 3 接口。关键决策：评论模块独立存储降低耦合。遗留风险：内存存储重启数据丢失（RISK-001），性能基线待阶段 7 k6 实测。"
```

### 4.4 DoD 理解证据维度扩展

> 在 definition-of-done.md「五维度标准」表新增第六维度「理解证据」，与现有测试/行为/文档/RTM/状态并列。

```markdown
## 六维度标准（更新）

| 维度 | 标准 | 验证方式 | 不通过 → 动作 |
|---|---|---|---|
| 测试 | 全部测试通过，无回归 | 测试运行器退出码 0 | 当场补测试或修复 |
| 行为 | 运行时验证行为符合规格 | 手动/自动化验证关键路径 | 补运行时验证 |
| 文档 | API/接口/数据模型变更须同步更新 | git diff 包含 docs/ 更新 | 补文档更新 |
| RTM | 需求/设计/代码/测试映射同步 | rtm.json 字段无空缺 | 补登记 RTM |
| 状态 | status 如实反映 | 字段值与磁盘产物一致 | 修正 status |
| **理解证据**（新增） | 阶段门放行须有用户理解证据 | run-log acknowledgedDecisions 非空且含 ≥1 关键决策摘要 | 拒绝放行；要求用户填入理解证据（O4 命中） |
```

**自检清单新增**：

```markdown
- [ ] 阶段门 CHECKPOINT 放行时，run-log acknowledgedDecisions 已填入 ≥1 关键决策摘要（非"确认"/"同意"）
```

### 4.5 与优化1/2/3 的协同

| 协同点 | 优化4 的作用 |
|---|---|
| 优化1 run-log | acknowledgedDecisions 是 run-log checkpoint 记录的字段，不新增文件 |
| 优化2 成熟度 | L1+ 操作型 CHECKPOINT 自动放行时，acknowledgedDecisions 仍须填写（自动放行 ≠ 理解豁免）；L3 高风险路径的决策型 CHECKPOINT 强制填写 |
| 优化3 O4/O5 | acknowledgedDecisions 为空 → O4 命中；阶段 2/4 无修改意见 → O5 命中。优化4 是 O4/O5 的检测机制 |

### 4.6 SSoT 同步点

- SSoT §10.6「项目级 Definition of Done」：五维度扩展为六维度，新增「理解证据」。
- SSoT §7.6 LLM-as-a-Verifier 评审规范：summary 字段内容要求强化（阶段 digest 三要素）。
- verifier-spec.md §6 summary 字段说明：新增内容要求三要素 + 示例。
- definition-of-done.md：五维度 → 六维度 + 自检清单新增条目。
- SSoT §10A 追溯表更新 §10.6 行：实现位置新增「理解证据维度」。

---

## 5. 实现顺序与文件变更清单

### 5.1 实现顺序（按依赖关系）

```
优化1（成本预算+运行日志）  ← 基础设施，无依赖
  ↓ run-log 是优化4 的载体
优化4（理解债务）           ← 依赖优化1 的 run-log
  ↓ acknowledgedDecisions 是 O4 的检测机制
优化3（运维失败模式 O1~O6）  ← O4/O5 依赖优化4，O1/O6 依赖优化1
  ↓ O 系列命中影响成熟度升级判定
优化2（成熟度阶梯）         ← 依赖优化1（预算）+ 优化3（O 系列失败模式）的解锁条件
```

### 5.2 文件变更清单

#### 5.2.1 新增文件（2 个状态文件 schema + 0 个脚本）

> 严格遵循"不新增门禁脚本"原则。budget.json / run-log.jsonl / maturity.json 均由编排者 O 维护，类比 project.json / rtm.json。

| 文件 | 用途 | 创建时机 |
|---|---|---|
| `.w-model/budget.json` | 成本预算配置 | `/wm analyze` 首次初始化 |
| `.w-model/run-log.jsonl` | 运行历史 append-only | `/wm analyze` 首次初始化 |
| `.w-model/maturity.json` | 成熟度级别配置 | `/wm analyze` 首次初始化 |

#### 5.2.2 修改文件（文档同步，遵循 SSoT 优先）

| 文件 | 变更内容 | 对应优化 |
|---|---|---|
| `docs/skill-design-document_SSoT.md` | 新增 §10C 成熟度阶梯 / §10D 成本预算与运行日志；§4A.2 扩展 O1~O6；§10.6 六维度；§3.4.2 角色表 O 允许动作扩展；§10A 追溯表新增行 | 优化1~4 |
| `w-model-dev/references/operational-recovery.md` | 新增「成本预算与运行日志」节 + 「成熟度与 CHECKPOINT 放行」节 | 优化1~2 |
| `w-model-dev/references/data-models.md` | 新增 budget.json / run-log.jsonl / maturity.json schema | 优化1~2 |
| `w-model-dev/references/anti-patterns.md` | 新增「运维失败模式清单（O1~O6）」节 | 优化3 |
| `w-model-dev/references/definition-of-done.md` | 五维度 → 六维度 + 自检清单新增 | 优化4 |
| `w-model-dev/references/verifier-spec.md` | §6 summary 字段内容要求强化 | 优化4 |
| `w-model-dev/references/subagent-delegation.md` | O 角色允许动作新增「预算与日志维护」+ 「成熟度判定」 | 优化1~2 |
| `w-model-dev/SKILL.md` | 约束2 补充（L1+ 自动放行非绕过）；快速自检新增理解证据项 | 优化2~4 |
| `AGENTS.md` | §2 关键目录速查新增 budget/run-log/maturity 说明；§4 参考实现可追加 | 优化1~2 |
| `README.md` | 特性列表追加（如需） | 优化1~4 |

#### 5.2.3 不变更文件

| 文件 | 不变更理由 |
|---|---|
| `w-model-dev/scripts/*.ts`（所有门禁脚本） | 4 项优化均不改门禁逻辑；预算/日志/成熟度/理解证据是状态文件 + 编排者维护 |
| `w-model-dev/templates/*.md` | 模板不涉及预算/日志/成熟度 |
| `w-model-dev-demo/` | 参考实现已归档，本次增强不重建 demo |
| `docs/ingestion-graph-convergence-design.md` / `information-flow-validation-design.md` / `tla-plus-modeling-design.md` | 已完成的设计，本次增强正交 |

### 5.3 验收标准

本设计文档实现完成后，须满足：

- [ ] SSoT 新增 §10C / §10D，与本文档双向追溯
- [ ] SSoT §4A.2 扩展 O1~O6，与 anti-patterns.md 一致
- [ ] SSoT §10.6 六维度，definition-of-done.md 一致
- [ ] data-models.md 含 budget / run-log / maturity schema
- [ ] operational-recovery.md 含成本预算 + 成熟度两节
- [ ] anti-patterns.md 含 O1~O6 节
- [ ] verifier-spec.md summary 字段内容要求强化
- [ ] subagent-delegation.md O 角色允许动作扩展
- [ ] SKILL.md 约束2 补充 + 自检新增
- [ ] `npm run self-test` 仍 37/37 通过（无脚本变更，回归基线不变）
- [ ] w-model-dev-demo 可按新 schema 重跑（可选，验证 budget/run-log/maturity 初始化）

---

## 6. 与 loop-engineering 的对照与取舍

### 6.1 采纳的 loop-engineering 概念

| loop-engineering 概念 | w-model-dev 适配方式 | 对应优化 |
|---|---|---|
| `loop-budget.md`（声明日预算 + kill switch） | `.w-model/budget.json`（声明式，perPhase + project + onExceed + killSwitch） | 优化1 |
| `loop-run-log.md`（append-only 运行历史） | `.w-model/run-log.jsonl`（JSONL 结构化，含 acknowledgedDecisions） | 优化1+4 |
| L0/L1/L2/L3 成熟度阶梯 | L0~L3 放行矩阵（决策型始终 attended，操作型按级别自动放行） | 优化2 |
| Loop Ready Score | maturity.json unlockConditions（达标率/误判率） | 优化2 |
| Failure Modes（Token Burn / State Rot / Verifier Theater / Comprehension Debt / Cognitive Surrender / Escalation Failure） | O1~O6 运维失败模式 | 优化3 |
| Comprehension Debt + digest | acknowledgedDecisions + VerifierOutput.summary 强化 | 优化4 |
| Maker/Checker Split | **w-model-dev 已更强**（O/A/S/V/G 五角色 + 反模式 #10 强制） | 不采纳（已有） |
| Verifier default REJECT | O3 Verifier Theater 缓解：强化 verifier-spec §1 设计原则 | 优化3 |

### 6.2 不采纳的 loop-engineering 概念（架构冲突）

| loop-engineering 概念 | 不采纳理由 |
|---|---|
| 调度自动化（cron/`/loop`/GitHub Actions） | W 模型是一次性顺序工程流程，非周期运维；强行加调度扭曲 SE 本质。仅当未来做"棕地持续维护循环"时条件性引入 |
| Worktree 并行隔离 | W 模型 8 阶段严格串行（阶段门依赖前序）；ingestion A-chunk 并行已实现 |
| MCP 连接器 | SSoT §11.2 已明确"外部集成由消费方自行实现"，技能不内置连接器 |
| 路径 denylist/auto-merge allowlist | 仅 L3 才需要；L0 attended 下 CHECKPOINT 已是更强人工 gate（L3 需求已定义在 §2.3，实现待 L3 解锁后） |
| `loop-cost` LLM 估算 token | 与约束4（真实执行）冲突；tokensEstimate 由宿主 Agent 报告实际消耗，不 LLM 估算 |
| `loop-sync` drift 检测 | operational-recovery.md 已覆盖"状态与产物不一致" |
| 7 个 production patterns（daily-triage/pr-babysitter 等） | 面向周期运维任务，与 W 模型一次性工程流程不同域 |

---

## 7. 附录：与现有架构原则的兼容性验证

| 现有原则 | 4 项优化的兼容性验证 |
|---|---|
| 技能不内置 LLM 调用（§3.3） | ✅ 预算是声明式 JSON、日志是 append-only、成熟度是 CHECKPOINT 选择性激活、理解证据是字段填写——均无 LLM 调用 |
| 脚本自包含仅依赖 tsx | ✅ 不新增脚本；budget/run-log/maturity 由编排者 O 维护状态文件，类比 `/wm reset` 对 `.w-model/*.json` 的操作 |
| 编排者最小化（§3.4） | ✅ O 维护 budget/run-log/maturity 属"状态读写+持久化"允许动作；不改 S/V/G/A 边界；O 不产出阶段产物/评审/门禁结果 |
| CHECKPOINT 不可绕过（约束2） | ✅ L0~L3 是 CHECKPOINT 选择性激活；决策型始终 attended；L3 高风险路径强制人工 gate |
| 真实执行（约束4） | ✅ tokensEstimate 由宿主报告实际消耗（estimated=false）；acknowledgedDecisions 由用户真实填写；不 LLM 估算 |
| 按需加载（约束6） | ✅ budget/run-log/maturity 在阶段门检查点加载，不一次性载入 |
| TLA+ 行为门禁（约束9） | ✅ 不改 TLA+ 门禁；budget killSwitch 含 tlaReworks 触发条件 |
| 反模式 #3/#6（估算门禁/RTM） | ✅ 预算检查不替代门禁脚本；run-log gateExitCode 填实际退出码 |
| 反模式 #8（越过 CHECKPOINT） | ✅ L1+ 自动放行是操作型 CHECKPOINT 的选择性激活，run-log 记录；非越过 |
| 反模式 #10（编排者越权） | ✅ O 维护状态文件是允许动作；不产出实施内容 |

---

## 参考文献

1. [cobusgreyling/loop-engineering](https://github.com/cobusgreyling/loop-engineering) — MIT License，调研于 2026-07-23
   - [docs/primitives.md](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/primitives.md) — 六原语（调度/Worktree/Skills/MCP/子代理/记忆）
   - [docs/failure-modes.md](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/failure-modes.md) — 10 条运维失败模式（Token Burn/State Rot/Verifier Theater 等）
   - [docs/anti-patterns.md](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/anti-patterns.md) — 10 条设计反模式
   - [docs/loop-design-checklist.md](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/loop-design-checklist.md) — L0~L3 成熟度阶梯
   - [docs/concepts.md](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/concepts.md) — Comprehension Debt / Cognitive Surrender / Intent Debt
   - [docs/operating-loops.md](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/operating-loops.md) — 成本预算/运行日志/kill switch
2. [skill-design-document_SSoT.md](./skill-design-document_SSoT.md) — w-model-dev 单一事实来源
3. [w-model-dev/references/anti-patterns.md](../w-model-dev/references/anti-patterns.md) — 17 流程反模式 + F1~F10 失败模式
4. [w-model-dev/references/operational-recovery.md](../w-model-dev/references/operational-recovery.md) — 运维与恢复参考
5. [w-model-dev/references/data-models.md](../w-model-dev/references/data-models.md) — 数据模型 schema
6. [w-model-dev/references/verifier-spec.md](../w-model-dev/references/verifier-spec.md) — LLM-as-a-Verifier 评审规范
