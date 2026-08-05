# 第 31 轮设计：/wm status 脚本化 + 流程度量报告（metrics-report.ts）

> 触发：外部评审者就技能包给出 14 条建议，用户经头脑风暴选定 3 轮分组实施。本轮为第 2 轮（新功能批）：#10 /wm status 脚本化、#14 流程度量报告（metrics-report.ts）。
>
> 当前版本：`30.1.0`；目标版本：`31.0.0`（package.json + SKILL.md frontmatter + skill-metadata.json 三处同步）。
>
> 工作流：头脑风暴 → 设计（本文）→ 计划 → 同步 SSoT → 实施 → 回归 → 同步 SSoT/README/AGENTS/INSTALL/CHANGELOG。
>
> 后续轮次：第 32 轮（#3 错误结构全量归一化 + run-log R6 契约迁移），独立设计文档与计划。

## 1. 背景与缺口

### 1.1 现状

| 建议 | 现状 | 缺口 |
|---|---|---|
| #10 /wm status 脚本化 | [command-reference.md](../../w-model-dev/references/command-reference.md) §`/wm status` 为「O 只读手工读 project.json + rtm.json，输出 5 项」；[SKILL.md](../../w-model-dev/SKILL.md) 命令速查表登记 `/wm status`（O 只读，不分派子代理） | 无脚本支撑：输出依赖 O 手工拼读，无确定性 JSON 摘要、无阶段进度/最近动作/预算摘要的机器可读形态，展示证据时口径不一 |
| #14 流程度量报告 | [run-log.jsonl](../../w-model-dev/references/data-models.md)（append-only 过程日志，含 phase/action/role/outcome/tokens/duration/subagentSpawns/gateExitCode）与 [budget.json](../../w-model-dev/references/data-models.md)（token/返工/killSwitch 预算）均已存在；`/wm hill-climbing` 已做信号分析（L2+） | 无通用度量汇总工具：编排者做预算检查、CHECKPOINT 决策、阶段回顾时须手工数 run-log；与 §10H SkillOpt「信号 → bounded edit」反馈循环之间缺中间件 |

### 1.2 缺口清单

| 缺口 | 现状 | 本轮动作 |
|---|---|---|
| G1 | /wm status 为手工操作 | 新增 `wm-status.ts`（CLI）+ `wm-status-logic.ts`（纯逻辑），确定性输出状态快照 |
| G2 | run-log/budget 无汇总工具 | 新增 `metrics-report.ts`（CLI）+ `metrics-report-logic.ts`（纯逻辑），生成流程度量报告 |

### 1.3 不涉及范围

- **不改变任何既有校验行为**：本轮仅新增只读查询/报告工具，不改动 12 项 pre-push 门禁、不改 run-log/budget schema、不新增约束号、不新增反模式。
- **不引入门禁语义**：两个脚本均为「查询/报告」工具（退出码 0/2），不产生 exit 1 失败语义；预算检查与返工拦截仍由既有 `check-budget.ts` 与门禁流程承担。
- **不引入新依赖**：仅 node:fs / node:path，复用 v29 抽取的 `read-json-or-exit.ts`。
- **不注册 self-test 样本**：两个脚本非门禁校验器，self-test 213 条保持不变；行为由 vitest 单测覆盖。
- 第 32 轮内容（#3 错误结构归一、run-log R6 契约迁移）**不在本轮**实施。

## 2. 方案（已确认方案 A）

两个独立脚本，各自「纯逻辑层 + CLI 层」：

| 方案 | 说明 | 结论 |
|---|---|---|
| **A（采纳）** | `wm-status.ts`（状态快照）+ `metrics-report.ts`（过程度量），各自纯逻辑层 + CLI 层，复用 read-json-or-exit，vitest 单测覆盖 | 职责单一、可测、符合现有脚本模式 |
| B | 合并为 `wm-report.ts` + `--mode=status\|metrics` | 耦合两种语义，不采纳 |
| C | 只做 metrics-report，status 保持手工 | 只解决 #14，漏掉 #10，不采纳 |

## 3. 详细设计

### 3.1 `wm-status.ts`（状态快照）

**CLI**：

```bash
npx tsx w-model-dev/scripts/wm-status.ts [project-dir] [--json]
```

- `project-dir` 默认当前工作目录；从 `<dir>/.w-model/` 读取状态文件。
- 只读 `project.json`（必读）、`rtm.json`（可选，缺失降级）、`run-log.jsonl`（可选，缺失降级）。
- 纯逻辑层 `wm-status-logic.ts` 导出：
  - `STATUS_TO_PHASE: Record<string, number>`——9 态 → 阶段号：需求分析=1 / 系统设计=2 / 概要设计=3 / 详细设计=4 / 编码=5 / 集成测试=6 / 系统测试=7 / 验收测试=8 / 项目完成=9。
  - `buildStatusReport(project, rtm?, runLog?): StatusReport`。
- `StatusReport` 结构：

```ts
interface StatusReport {
  phase: number;              // 当前阶段 1-8；项目完成=8
  completedPhases: number;    // 0-8：项目完成→8；否则 phase-1
  progress: string;           // 如 "3/8（37.5%）"
  status: string;             // 原始 status 枚举
  updatedAt: string;
  rtmCoverage: { covered: number; total: number; percent: number } | null;
  testSummary: {
    unit: TestTally; integration: TestTally; system: TestTally; acceptance: TestTally;
  } | null;                   // TestTally = { total, passed, failed, pending }
  recentActions: RunLogEntry[]; // run-log 最后 3 条（按文件顺序取尾部）
  nextSteps: string[];          // 确定性下一步建议
}
```

- `rtmCoverage.covered` = rows 中 `coverageStatus === "100%"` 的行数；`percent` = covered/total × 100（total=0 → 0）。
- `testSummary` 透传 rtm.json `executionSummary` 四级的 total/passed/failed/pending。
- `recentActions` 取 run-log 尾部 3 条条目，每条精简为 `{ runId, timestamp, phase, action, role, outcome, gateExitCode }`（避免把 append-only 全量字段塞进状态快照）。
- `nextSteps` 按 status 的确定性映射（每状态一条，含阶段产物要点与门禁提示），示例：
  - 需求分析 → 「阶段 1：产出 requirement-spec.md 与 graph（ingestion A 子代理），分派 V 评审 + G 跑 check-requirement-graph / check-artifact-gate --phase=1」；
  - 项目完成 → 「8 阶段全部完成：可运行 check-artifact-gate --phase=8 终检确认，或进入归档流程」。

**退出码**：

| 场景 | 输出 | 退出码 |
|---|---|---|
| 正常（含 rtm/run-log 缺失降级） | 人类可读摘要（或 --json 摘要） | 0 |
| project.json 缺失（未初始化） | 「✗ 项目未初始化：未找到 <dir>/.w-model/project.json」 | 0 |
| project.json / rtm.json 非法 JSON | 「✗ 文件解析失败…（转 operational-recovery，不猜测状态）」 | 2 |

> 决策：未初始化返回 0 而非 2——status 是查询命令，输出「未初始化」本身就是合法查询结果；2 仅保留给「输入文件损坏」这一输入错误语义（与 readJsonOrExit 一致）。

**`--json`**：stdout 输出单行 `StatusReport` JSON（含 nextSteps 数组），供 O 展示证据或机器消费。

### 3.2 `metrics-report.ts`（流程度量报告）

**CLI**：

```bash
npx tsx w-model-dev/scripts/metrics-report.ts [project-dir] [--from=ISO] [--to=ISO] [--phase=N] [--json] [--out=<path>]
```

- `project-dir` 默认当前工作目录；必读 `<dir>/.w-model/run-log.jsonl`，可选读 `budget.json`（缺失时 budget 度量区为 null，不报错）。
- 过滤：`--from`/`--to` 按 `timestamp` ISO 过滤（含边界）；`--phase` 按 phase 过滤；三者可组合。
- 纯逻辑层 `metrics-report-logic.ts` 导出 `computeMetrics(entries, budget?, opts?): MetricsReport`。
- `MetricsReport` 结构：

```ts
interface MetricsReport {
  meta: { projectId: string | null; recordCount: number; window: { from?: string; to?: string } };
  overall: {
    totalRecords: number; totalDurationS: number; totalTokens: number; totalSubagentSpawns: number;
    reworkRecords: number; reworkRate: number; // 返工相关 action（rework/fix/rootcause）计数与占比
  };
  byPhase: Array<{ phase: number; phaseName?: string; records: number; actions: number;
                   subagentSpawns: number; durationS: number; tokens: number; rework: number }>;
  byAction: Record<string, number>;
  byRole: Record<string, number>;
  byOutcome: Record<string, number>;
  gate: { total: number; passed: number; failed: number; passRate: number }; // gate/tla-gate/graph-gate 类 action
  rework: { count: number; rate: number; maxConsecutiveRuns: number; exceedsKillSwitch: boolean };
  budget: null | {
    totalTokens: number; maxTokensTotal: number; totalBurnRate: number;
    byPhase: Array<{ phase: number; tokens: number; maxTokens: number; burnRate: number; exceeded: boolean }>;
    onExceed: string; killSwitchTriggered: boolean;
  };
  warnings: string[]; // estimated=true 记录、空 run-log、budget 缺失等
}
```

- 度量口径：
  - `rework` 相关 action = `rework | fix | rootcause`；`reworkRate = reworkRecords / totalRecords`（totalRecords=0 → 0）。
  - `maxConsecutiveRuns`：按文件顺序（时间序）扫描连续返工相关 action 的最大段长。
  - `gate` 统计 action ∈ `gate | tla-gate | graph-gate` 的记录；`passed` = `gateExitCode === 0`；`failed` = `gateExitCode !== 0 && gateExitCode !== null`；passRate = passed/total。
  - `budget`（仅当 budget.json 存在）：
    - `totalBurnRate = totalTokens / budget.project.maxTokensTotal`；
    - `byPhase[].exceeded = tokens > perPhase.maxTokens`；
    - `killSwitchTriggered = maxConsecutiveRuns >= budget.killSwitch.consecutiveReworks || 任一阶段 burnRate >= budget.killSwitch.budgetBurnRate`；
    - `onExceed` 透传 budget.onExceed。
  - `warnings`：run-log 为空；存在 `estimated === true` 记录（提示约束 4 风险）；budget 缺失（budget 区为 null）；阶段 token 超 `perPhase.maxTokens`；killSwitch 触发。

**退出码**：

| 场景 | 输出 | 退出码 |
|---|---|---|
| 正常（含预警） | 人类可读摘要（或 --json/--out 报告） | 0 |
| run-log.jsonl 缺失 | 「✗ 文件不存在: …/run-log.jsonl」 | 2 |

> 决策：纯报告无门禁语义——预算超限/返工超阈仅进 warnings 与 killSwitchTriggered 字段，不改变退出码（拦截职责归 `check-budget.ts` 与门禁流程，反模式 #3/#6 守护）。

**输出**：默认人类可读摘要（「总体 / 阶段汇总 / 动作分布 / 角色分布 / 结果分布 / 门禁通过率 / 返工 / 预算 / 预警」节）；`--json` 输出完整 `MetricsReport` JSON 到 stdout；`--out <path>` 写入文件（与 `--json` 可组合：`--out` 隐含 JSON 输出到文件）。

### 3.3 复用与一致性

- CLI 层复用 `scripts/lib/read-json-or-exit.ts`：`readJsonOrExit`（project/rtm/budget）、`readJsonlOrExit`（run-log）。
- 不修改既有 check-*.ts / *-logic.ts；不修改 schema；不修改 pre-push。
- 脚本命名与目录：`scripts/wm-status.ts` + `scripts/wm-status-logic.ts` + `scripts/metrics-report.ts` + `scripts/metrics-report-logic.ts`。

## 4. 测试设计

### 4.1 `wm-status-logic.test.ts`（7 用例）

1. 9 态 → phase 映射参数化（需求分析=1 … 验收测试=8）
2. 项目完成 → completedPhases=8、phase=8
3. 中间态 completedPhases = phase-1（如 系统设计 → 1/8）
4. RTM 覆盖计算（coverageStatus=100% 计数 + percent，total=0 → 0）
5. testSummary 透传 executionSummary 四级
6. recentActions 取尾部 3 条（空 / 不足 3 条边界）
7. rtm/runLog 缺失 → 对应区为 null（不崩溃）

### 4.2 `metrics-report-logic.test.ts`（8 用例）

1. 总体汇总（records/duration/tokens/spawns）
2. 阶段汇总分组（byPhase 字段）
3. byAction / byRole / byOutcome 分布
4. 返工率 + maxConsecutiveRuns（含连续段跨 action）
5. gate 通过率（gateExitCode 0 / 非 0 / null 归类）
6. 预算：总 burn rate + 每阶段 exceeded + killSwitchTriggered（consecutiveReworks 路径）
7. 预算：killSwitchTriggered（budgetBurnRate 路径）
8. 过滤（--from/--to/--phase 组合）与空 run-log（0 记录不崩溃）

**基线**：vitest 301 → **320**（+19：wm-status-logic 10 + metrics-report-logic 9）；self-test 213 不变；tsc strict 0 错误。

## 5. 文档同步清单

| 文件 | 动作 |
|---|---|
| `w-model-dev/SKILL.md` | frontmatter version → 31.0.0；命令速查表 `/wm status` 行更新（脚本化 wm-status.ts）；新增 `/wm metrics` 行；参数示例节加 metrics 示例；Bundled Resources scripts 表 +2 脚本 |
| `w-model-dev/references/command-reference.md` | §`/wm status` 改写为脚本化调用；新增 §`/wm metrics`（执行方 O、参数、输出、退出码） |
| `w-model-dev/references/toolbox.md` | scripts 决策表 +2 行（wm-status / metrics-report） |
| `w-model-dev/scripts/__tests__/README.md` | coverage 矩阵 +2 行 |
| `AGENTS.md` | §2 scripts 描述 +2；§3 常用命令 +2 |
| `README.md` | 命令速查表 +`/wm metrics`、`/wm status` 脚本化；门禁脚本/工具表 +2；项目结构树 +4 文件；版本号引用 |
| `docs/skill-design-document_SSoT.md` | §3.4.29 新节；§10A 追溯表 +行；§6.1 核心命令表 `/wm status` 更新 + `/wm metrics` 新增；附录 A 命令速查 +1 |
| `docs/INSTALL.md` | 资产索引/版本号同步 31.0.0；目录速查 +4 文件 |
| `CHANGELOG.md` | 新增 `[31.0.0]` 条目（Changed/Added/验证） |
| `package.json` | version → 31.0.0；scripts +`wm:status` / `wm:metrics` |
| `w-model-dev/skill-metadata.json` | version → 31.0.0 |

## 6. 验收标准

- vitest 320/320 全通过（301 + 19）
- self-test 213/213 不变
- TypeScript strict 0 错误
- `npm run lint:security` exit 0（0 新增）
- prepush 12 项全通过
- 手动冒烟：
  - 在真实项目目录（含 .w-model/project.json + rtm.json + run-log.jsonl + budget.json）跑 `wm-status.ts` → exit 0，输出含阶段/进度/RTM 覆盖/测试汇总；
  - `wm-status.ts --json` 输出合法 JSON；
  - 无 .w-model 目录 → 「项目未初始化」exit 0；损坏 JSON → exit 2；
  - `metrics-report.ts` → exit 0，含 7 区摘要；`--json --out` 输出合法 JSON；缺失 run-log → exit 2。

## 7. 风险与回归

- **唯一新增风险**：新脚本 bug。以 TDD 先行写单测（15 用例）再实现；tsc strict + lint:security 兜底。
- **既有回归**：本轮不触碰既有脚本/schema/门禁，self-test 213 与 vitest 301 基线应原样通过；prepush 12 项不变。
- **口径一致性**：STATUS_TO_PHASE 与 project.schema.json status 枚举、run-log action 枚举与 data-models.md 一致；budget 阈值字段名与 budget.schema.json / check-budget.ts 一致（perPhase.maxTokens / project.maxTokensTotal / killSwitch.consecutiveReworks / killSwitch.budgetBurnRate / onExceed）。
