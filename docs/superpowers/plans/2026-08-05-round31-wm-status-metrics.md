# 第 31 轮实施计划：/wm status 脚本化 + 流程度量报告

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `wm-status.ts`（状态快照）与 `metrics-report.ts`（流程度量）两个只读报告脚本及其纯逻辑层，同步全部文档，版本升至 31.0.0。

**Architecture:** 两个独立脚本，各自「纯逻辑层（`*-logic.ts`，纯函数可单测）+ CLI 层（复用 `lib/read-json-or-exit.ts`）」。wm-status 读 project.json（必读）/rtm.json/run-log.jsonl（可选降级），输出状态快照；metrics-report 读 run-log.jsonl（必读）/budget.json（可选），输出 7 区流程度量。两者均为查询/报告工具，退出码仅 0/2，无门禁语义。设计 spec：[`docs/superpowers/specs/2026-08-05-round31-wm-status-metrics-design.md`](../../docs/superpowers/specs/2026-08-05-round31-wm-status-metrics-design.md)。

**Tech Stack:** TypeScript strict + tsx + vitest；仅 node:fs / node:path；复用 `w-model-dev/scripts/lib/read-json-or-exit.ts`。

**环境注意（Windows + 本仓库惯例）：**
- git commit 需 `--no-gpg-sign`（仓库 `commit.gpgsign=true`）。
- PowerShell 不支持 heredoc：commit message 用单行。
- 跑 vitest 单文件：`npx vitest run w-model-dev/scripts/__tests__/<file>.test.ts`。
- vitest 基线：301 → **319**（新增 18 用例：wm-status 9 + metrics 9）；回归后按实测数字更新 spec/CHANGELOG。

## 任务总览（7 任务）

| 任务 | 内容 | 产物 |
|---|---|---|
| 1 | wm-status-logic.ts 纯逻辑 + 单测（TDD） | `wm-status-logic.ts` + `wm-status-logic.test.ts` |
| 2 | metrics-report-logic.ts 纯逻辑 + 单测（TDD） | `metrics-report-logic.ts` + `metrics-report-logic.test.ts` |
| 3 | wm-status.ts CLI + 冒烟 | `wm-status.ts` |
| 4 | metrics-report.ts CLI + 冒烟 | `metrics-report.ts` |
| 5 | 文档同步（SKILL/command-reference/toolbox/__tests__ README/AGENTS/README） | 6 个文档 |
| 6 | SSoT + INSTALL + CHANGELOG + 版本号三处 + package.json | 5 个文件 |
| 7 | 全量回归 + 提交 | 回归证据 |

---

## Task 1: wm-status-logic.ts 纯逻辑层（TDD）

**Files:**
- Create: `w-model-dev/scripts/logic/wm-status-logic.ts`
- Create: `w-model-dev/scripts/__tests__/wm-status-logic.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `w-model-dev/scripts/__tests__/wm-status-logic.test.ts`（9 用例，见下文代码块）。

```ts
/**
 * wm-status-logic.ts 单元测试
 *
 * 覆盖：9 态 → phase 映射 / completedPhases / progress / RTM 覆盖 / 四级测试汇总 /
 *       recentActions 尾部 3 条 / rtm·runLog 缺失降级 / nextSteps 确定性。
 */

import { describe, expect, it } from 'vitest';
import { buildStatusReport, STATUS_TO_PHASE } from '../wm-status-logic.js';

describe('STATUS_TO_PHASE', () => {
  it('9 态映射（需求分析=1 … 验收测试=8，项目完成=9）', () => {
    expect(STATUS_TO_PHASE['需求分析']).toBe(1);
    expect(STATUS_TO_PHASE['系统设计']).toBe(2);
    expect(STATUS_TO_PHASE['概要设计']).toBe(3);
    expect(STATUS_TO_PHASE['详细设计']).toBe(4);
    expect(STATUS_TO_PHASE['编码']).toBe(5);
    expect(STATUS_TO_PHASE['集成测试']).toBe(6);
    expect(STATUS_TO_PHASE['系统测试']).toBe(7);
    expect(STATUS_TO_PHASE['验收测试']).toBe(8);
    expect(STATUS_TO_PHASE['项目完成']).toBe(9);
  });
});

describe('buildStatusReport', () => {
  it('项目完成 → phase=8、completedPhases=8、progress=8/8（100%）', () => {
    const r = buildStatusReport({ status: '项目完成', updatedAt: '2026-08-05T00:00:00Z' });
    expect(r.phase).toBe(8);
    expect(r.completedPhases).toBe(8);
    expect(r.progress).toBe('8/8（100%）');
    expect(r.updatedAt).toBe('2026-08-05T00:00:00Z');
  });

  it('中间态 completedPhases = phase-1（系统设计 → 1/8（12.5%））', () => {
    const r = buildStatusReport({ status: '系统设计' });
    expect(r.phase).toBe(2);
    expect(r.completedPhases).toBe(1);
    expect(r.progress).toBe('1/8（12.5%）');
  });

  it('RTM 覆盖计算（coverageStatus=100% 计数 + percent 保留 1 位小数）', () => {
    const r = buildStatusReport(
      { status: '编码' },
      { rows: [{ coverageStatus: '100%' }, { coverageStatus: '100%' }, { coverageStatus: '部分' }] },
    );
    expect(r.rtmCoverage).toEqual({ covered: 2, total: 3, percent: 66.7 });
  });

  it('RTM total=0 → percent=0', () => {
    const r = buildStatusReport({ status: '编码' }, { rows: [] });
    expect(r.rtmCoverage).toEqual({ covered: 0, total: 0, percent: 0 });
  });

  it('testSummary 透传 executionSummary 四级', () => {
    const r = buildStatusReport(
      { status: '编码' },
      {
        executionSummary: {
          unitTest: { total: 10, passed: 9, failed: 1, pending: 0 },
          integrationTest: { total: 5, passed: 5, failed: 0, pending: 0 },
          systemTest: { total: 3, passed: 3, failed: 0, pending: 0 },
          acceptanceTest: { total: 8, passed: 8, failed: 0, pending: 0 },
        },
      },
    );
    expect(r.testSummary?.unit).toEqual({ total: 10, passed: 9, failed: 1, pending: 0 });
    expect(r.testSummary?.acceptance.total).toBe(8);
  });

  it('recentActions 取尾部 3 条并精简字段', () => {
    const log = [1, 2, 3, 4, 5].map((n) => ({
      runId: `r${n}`,
      timestamp: `t${n}`,
      phase: 1,
      action: 'gate',
      role: 'G',
      outcome: 'success',
      gateExitCode: 0,
    }));
    const r = buildStatusReport({ status: '编码' }, null, log);
    expect(r.recentActions).toHaveLength(3);
    expect(r.recentActions[0].runId).toBe('r3');
    expect(r.recentActions[2].runId).toBe('r5');
    expect(Object.keys(r.recentActions[0]).sort()).toEqual([
      'action', 'gateExitCode', 'outcome', 'phase', 'role', 'runId', 'timestamp',
    ]);
  });

  it('recentActions 不足 3 条与空列表', () => {
    const r1 = buildStatusReport({ status: '编码' }, null, [{ runId: 'a' }]);
    expect(r1.recentActions).toHaveLength(1);
    const r2 = buildStatusReport({ status: '编码' }, null, []);
    expect(r2.recentActions).toEqual([]);
  });

  it('rtm/runLog 缺失 → rtmCoverage/testSummary 为 null、recentActions 为空（不崩溃）', () => {
    const r = buildStatusReport({ status: '编码' }, null, null);
    expect(r.rtmCoverage).toBeNull();
    expect(r.testSummary).toBeNull();
    expect(r.recentActions).toEqual([]);
  });

  it('nextSteps 每状态确定性非空', () => {
    for (const status of Object.keys(STATUS_TO_PHASE)) {
      const r = buildStatusReport({ status });
      expect(r.nextSteps.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run w-model-dev/scripts/__tests__/wm-status-logic.test.ts`
Expected: FAIL（`Cannot find module '../wm-status-logic.js'`）

- [ ] **Step 3: 实现纯逻辑层**

创建 `w-model-dev/scripts/logic/wm-status-logic.ts`：

```ts
/**
 * /wm status 状态快照纯逻辑层（wm-status-logic.ts）
 *
 * 供 scripts/wm-status.ts CLI 层调用；纯函数、无 IO、可单测。
 * 与 project.schema.json status 枚举、rtm.schema.json 结构、data-models.md RunLogEntry 对齐。
 * 设计：docs/superpowers/specs/2026-08-05-round31-wm-status-metrics-design.md §3.1
 */

/** 9 态 → 阶段号（与 project.schema.json status 枚举一致；项目完成=9，展示时收敛为 8） */
export const STATUS_TO_PHASE: Record<string, number> = {
  需求分析: 1,
  系统设计: 2,
  概要设计: 3,
  详细设计: 4,
  编码: 5,
  集成测试: 6,
  系统测试: 7,
  验收测试: 8,
  项目完成: 9,
};

/** 每状态的确定性下一步建议（含阶段产物要点与门禁提示） */
export const NEXT_STEPS: Record<string, string[]> = {
  需求分析: ['阶段 1：产出 requirement-spec.md 与 graph（ingestion A 子代理），分派 V 评审 + G 跑 check-requirement-graph / check-artifact-gate --phase=1'],
  系统设计: ['阶段 2：产出 system-design.md（含 SD 节点），分派 V 评审 + G 跑 check-requirement-graph / check-artifact-gate --phase=2'],
  概要设计: ['阶段 3：产出 outline-design.md（含 INTF 节点），分派 V 评审 + G 跑 check-requirement-graph / check-artifact-gate --phase=3'],
  详细设计: ['阶段 4：产出 detailed-design.md + TLA+ 建模（tla-manifest.json），分派 V 评审 + G 跑 check-tla-model / check-artifact-gate --phase=4'],
  编码: ['阶段 5：按票据编码并真实执行单元测试，回填 RTM codeModule，分派 V 评审 + G 跑 check-code-tla-consistency / check-artifact-gate --phase=5'],
  集成测试: ['阶段 6：执行集成测试并回填 RTM，分派 V 评审 + G 跑 check-artifact-gate --phase=6'],
  系统测试: ['阶段 7：执行系统测试（含性能度量环境声明）并回填 RTM，分派 V 评审 + G 跑 check-artifact-gate --phase=7'],
  验收测试: ['阶段 8：执行验收测试 + UAT 路径映射，分派 V 评审 + G 跑 check-artifact-gate --phase=8 终检'],
  项目完成: ['8 阶段全部完成：可运行 check-artifact-gate --phase=8 终检确认，或进入归档流程'],
};

export interface TestTally {
  total: number;
  passed: number;
  failed: number;
  pending: number;
}

/** rtm.json 最小结构（容忍缺字段） */
export interface RtmLike {
  rows?: Array<{ coverageStatus?: string }>;
  executionSummary?: {
    unitTest?: Partial<TestTally>;
    integrationTest?: Partial<TestTally>;
    systemTest?: Partial<TestTally>;
    acceptanceTest?: Partial<TestTally>;
  };
}

/** run-log.jsonl 条目最小结构 */
export interface RunLogLike {
  runId?: string;
  timestamp?: string;
  phase?: number;
  action?: string;
  role?: string;
  outcome?: string;
  gateExitCode?: number | null;
}

/** recentActions 精简字段（避免把 append-only 全量字段塞进状态快照） */
export interface RecentAction {
  runId: string;
  timestamp: string;
  phase: number | null;
  action: string;
  role: string;
  outcome: string;
  gateExitCode: number | null;
}

export interface StatusReport {
  phase: number;
  completedPhases: number;
  progress: string;
  status: string;
  updatedAt: string;
  rtmCoverage: { covered: number; total: number; percent: number } | null;
  testSummary: {
    unit: TestTally;
    integration: TestTally;
    system: TestTally;
    acceptance: TestTally;
  } | null;
  recentActions: RecentAction[];
  nextSteps: string[];
}

function toTally(t?: Partial<TestTally>): TestTally {
  return {
    total: typeof t?.total === 'number' ? t.total : 0,
    passed: typeof t?.passed === 'number' ? t.passed : 0,
    failed: typeof t?.failed === 'number' ? t.failed : 0,
    pending: typeof t?.pending === 'number' ? t.pending : 0,
  };
}

/** 百分比字符串：保留 1 位小数，去掉尾随 .0（37.5% / 25%） */
function formatPercent(n: number): string {
  const s = ((n / 8) * 100).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

export function buildStatusReport(
  project: { status: string; updatedAt?: string },
  rtm?: RtmLike | null,
  runLog?: RunLogLike[] | null,
): StatusReport {
  const status = project.status;
  const phaseNum = STATUS_TO_PHASE[status] ?? 1;
  const phase = Math.min(phaseNum, 8);
  const completedPhases = phaseNum >= 9 ? 8 : Math.max(0, phaseNum - 1);
  const progress = `${completedPhases}/8（${formatPercent(completedPhases)}）`;

  let rtmCoverage: StatusReport['rtmCoverage'] = null;
  if (rtm && Array.isArray(rtm.rows)) {
    const total = rtm.rows.length;
    const covered = rtm.rows.filter((r) => r?.coverageStatus === '100%').length;
    const percent = total === 0 ? 0 : Math.round((covered / total) * 1000) / 10;
    rtmCoverage = { covered, total, percent };
  }

  let testSummary: StatusReport['testSummary'] = null;
  const es = rtm?.executionSummary;
  if (es) {
    testSummary = {
      unit: toTally(es.unitTest),
      integration: toTally(es.integrationTest),
      system: toTally(es.systemTest),
      acceptance: toTally(es.acceptanceTest),
    };
  }

  const recentActions = Array.isArray(runLog)
    ? runLog.slice(-3).map((e) => ({
        runId: String(e?.runId ?? ''),
        timestamp: String(e?.timestamp ?? ''),
        phase: typeof e?.phase === 'number' ? e.phase : null,
        action: String(e?.action ?? ''),
        role: String(e?.role ?? ''),
        outcome: String(e?.outcome ?? ''),
        gateExitCode: typeof e?.gateExitCode === 'number' ? e.gateExitCode : null,
      }))
    : [];

  const nextSteps = NEXT_STEPS[status] ?? [
    '状态未知：请人工核对 project.json status 字段（转 operational-recovery）',
  ];

  return {
    phase,
    completedPhases,
    progress,
    status,
    updatedAt: project.updatedAt ?? '',
    rtmCoverage,
    testSummary,
    recentActions,
    nextSteps,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run w-model-dev/scripts/__tests__/wm-status-logic.test.ts`
Expected: 9 tests PASS

- [ ] **Step 5: 提交**

```bash
git add w-model-dev/scripts/logic/wm-status-logic.ts w-model-dev/scripts/__tests__/wm-status-logic.test.ts
git commit --no-gpg-sign -m "feat(wm-status): 纯逻辑层 buildStatusReport + STATUS_TO_PHASE 9 态映射（TDD 9 用例）"
```

---

## Task 2: metrics-report-logic.ts 纯逻辑层（TDD）

**Files:**
- Create: `w-model-dev/scripts/logic/metrics-report-logic.ts`
- Create: `w-model-dev/scripts/__tests__/metrics-report-logic.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `w-model-dev/scripts/__tests__/metrics-report-logic.test.ts`：

```ts
/**
 * metrics-report-logic.ts 单元测试
 *
 * 覆盖：总体汇总 / 阶段分组 / 分布 / 返工率与连续段 / gate 通过率 / 预算 burn rate 与
 *       killSwitch 两路径（consecutiveReworks、budgetBurnRate）/ 时间窗口与 phase 过滤 / 空 run-log。
 */

import { describe, expect, it } from 'vitest';
import { computeMetrics } from '../metrics-report-logic.js';

function e(p: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    phase: 1,
    phaseName: '需求分析',
    action: 'produce',
    role: 'S',
    outcome: 'success',
    duration_s: 10,
    tokens: 100,
    estimated: false,
    subagentSpawns: 1,
    gateExitCode: null,
    timestamp: '2026-08-05T01:00:00Z',
    ...p,
  };
}

describe('computeMetrics', () => {
  it('总体汇总（records/tokens/duration/spawns/返工）', () => {
    const r = computeMetrics([e(), e({ tokens: 200, duration_s: 20 }), e({ action: 'rework', outcome: 'fail' })]);
    expect(r.overall.totalRecords).toBe(3);
    expect(r.overall.totalTokens).toBe(400);
    expect(r.overall.totalDurationS).toBe(40);
    expect(r.overall.totalSubagentSpawns).toBe(3);
    expect(r.overall.reworkRecords).toBe(1);
    expect(r.overall.reworkRate).toBeCloseTo(1 / 3);
  });

  it('阶段汇总分组（byPhase 按 phase 升序）', () => {
    const r = computeMetrics([
      e({ phase: 1, tokens: 100 }),
      e({ phase: 1, tokens: 50 }),
      e({ phase: 2, tokens: 30, phaseName: '系统设计' }),
    ]);
    expect(r.byPhase).toHaveLength(2);
    expect(r.byPhase[0]).toMatchObject({ phase: 1, records: 2, tokens: 150, actions: 2 });
    expect(r.byPhase[1]).toMatchObject({ phase: 2, records: 1, tokens: 30, phaseName: '系统设计' });
  });

  it('动作/角色/结果分布', () => {
    const r = computeMetrics([
      e({ action: 'produce', role: 'S', outcome: 'success' }),
      e({ action: 'gate', role: 'G', outcome: 'success' }),
      e({ action: 'produce', role: 'S', outcome: 'fail' }),
    ]);
    expect(r.byAction).toEqual({ produce: 2, gate: 1 });
    expect(r.byRole).toEqual({ S: 2, G: 1 });
    expect(r.byOutcome).toEqual({ success: 2, fail: 1 });
  });

  it('返工率与连续段（跨 action 连续返工）', () => {
    const r = computeMetrics([
      e({ action: 'produce' }),
      e({ action: 'rework' }),
      e({ action: 'fix' }),
      e({ action: 'rootcause' }),
      e({ action: 'produce' }),
    ]);
    expect(r.rework.count).toBe(3);
    expect(r.rework.maxConsecutiveRuns).toBe(3);
    expect(r.rework.exceedsKillSwitch).toBe(false); // 无 budget 时恒 false
  });

  it('gate 通过率（exitCode 0 / 非 0 / null 归类）', () => {
    const r = computeMetrics([
      e({ action: 'gate', gateExitCode: 0 }),
      e({ action: 'gate', gateExitCode: 1 }),
      e({ action: 'tla-gate', gateExitCode: 0 }),
      e({ action: 'graph-gate', gateExitCode: null }),
      e({ action: 'produce' }),
    ]);
    expect(r.gate.total).toBe(4);
    expect(r.gate.passed).toBe(2);
    expect(r.gate.failed).toBe(1);
    expect(r.gate.passRate).toBeCloseTo(0.5);
  });

  it('预算：总 burn rate + 每阶段 exceeded + killSwitch（consecutiveReworks 路径）', () => {
    const budget = {
      project: { maxTokensTotal: 1000 },
      perPhase: { maxTokens: 300 },
      killSwitch: { consecutiveReworks: 2, budgetBurnRate: 0.9 },
      onExceed: 'pause',
    };
    const r = computeMetrics(
      [e({ tokens: 400 }), e({ action: 'rework' }), e({ action: 'fix' })],
      budget,
    );
    expect(r.budget?.totalBurnRate).toBeCloseTo(0.4);
    expect(r.budget?.byPhase[0]).toMatchObject({ phase: 1, tokens: 400, maxTokens: 300, exceeded: true });
    expect(r.budget?.killSwitchTriggered).toBe(true); // maxConsecutiveRuns=2 >= 2
    expect(r.budget?.onExceed).toBe('pause');
  });

  it('预算：killSwitch（budgetBurnRate 路径）', () => {
    const budget = {
      project: { maxTokensTotal: 10000 },
      perPhase: { maxTokens: 1000 },
      killSwitch: { consecutiveReworks: 3, budgetBurnRate: 0.9 },
      onExceed: 'halt',
    };
    const r = computeMetrics([e({ tokens: 950 })], budget);
    expect(r.budget?.byPhase[0].burnRate).toBeCloseTo(0.95);
    expect(r.budget?.killSwitchTriggered).toBe(true);
  });

  it('时间窗口与 phase 过滤', () => {
    const entries = [
      e({ timestamp: '2026-08-05T01:00:00Z', phase: 1 }),
      e({ timestamp: '2026-08-06T01:00:00Z', phase: 2 }),
      e({ timestamp: '2026-08-07T01:00:00Z', phase: 3 }),
    ];
    const r = computeMetrics(entries, null, { from: '2026-08-06T00:00:00Z', to: '2026-08-06T23:59:59Z' });
    expect(r.meta.recordCount).toBe(1);
    expect(r.byPhase[0].phase).toBe(2);
    const r2 = computeMetrics(entries, null, { phase: 3 });
    expect(r2.byPhase[0].phase).toBe(3);
    expect(r2.overall.totalRecords).toBe(1);
  });

  it('空 run-log 不崩溃 + warnings', () => {
    const r = computeMetrics([]);
    expect(r.overall.totalRecords).toBe(0);
    expect(r.overall.reworkRate).toBe(0);
    expect(r.gate.total).toBe(0);
    expect(r.warnings).toContain('run-log 为空：无过程数据可度量');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run w-model-dev/scripts/__tests__/metrics-report-logic.test.ts`
Expected: FAIL（`Cannot find module '../metrics-report-logic.js'`）

- [ ] **Step 3: 实现纯逻辑层**

创建 `w-model-dev/scripts/logic/metrics-report-logic.ts`：

```ts
/**
 * 流程度量报告纯逻辑层（metrics-report-logic.ts）
 *
 * 供 scripts/metrics-report.ts CLI 层调用；纯函数、无 IO、可单测。
 * 与 data-models.md RunLogEntry / BudgetConfig 对齐（action 枚举、killSwitch 字段名）。
 * 设计：docs/superpowers/specs/2026-08-05-round31-wm-status-metrics-design.md §3.2
 */

/** 返工相关 action（rework/fix/rootcause） */
export const REWORK_ACTIONS: ReadonlySet<string> = new Set(['rework', 'fix', 'rootcause']);
/** 门禁类 action */
export const GATE_ACTIONS: ReadonlySet<string> = new Set(['gate', 'tla-gate', 'graph-gate']);

export interface RunLogEntryLike {
  phase?: number;
  phaseName?: string;
  action?: string;
  role?: string;
  outcome?: string;
  duration_s?: number;
  tokens?: number;
  estimated?: boolean;
  subagentSpawns?: number;
  gateExitCode?: number | null;
  timestamp?: string;
}

export interface BudgetLike {
  projectId?: string;
  project?: { maxTokensTotal?: number };
  perPhase?: { maxTokens?: number };
  killSwitch?: { consecutiveReworks?: number; budgetBurnRate?: number };
  onExceed?: string;
}

export interface MetricsOptions {
  from?: string;
  to?: string;
  phase?: number;
}

export interface PhaseMetrics {
  phase: number;
  phaseName?: string;
  records: number;
  actions: number;
  subagentSpawns: number;
  durationS: number;
  tokens: number;
  rework: number;
}

export interface MetricsReport {
  meta: { projectId: string | null; recordCount: number; window: { from?: string; to?: string } };
  overall: {
    totalRecords: number;
    totalDurationS: number;
    totalTokens: number;
    totalSubagentSpawns: number;
    reworkRecords: number;
    reworkRate: number;
  };
  byPhase: PhaseMetrics[];
  byAction: Record<string, number>;
  byRole: Record<string, number>;
  byOutcome: Record<string, number>;
  gate: { total: number; passed: number; failed: number; passRate: number };
  rework: { count: number; rate: number; maxConsecutiveRuns: number; exceedsKillSwitch: boolean };
  budget: null | {
    totalTokens: number;
    maxTokensTotal: number;
    totalBurnRate: number;
    byPhase: Array<{ phase: number; tokens: number; maxTokens: number; burnRate: number; exceeded: boolean }>;
    onExceed: string;
    killSwitchTriggered: boolean;
  };
  warnings: string[];
}

function isRework(e: RunLogEntryLike): boolean {
  return typeof e.action === 'string' && REWORK_ACTIONS.has(e.action);
}

export function computeMetrics(
  entries: RunLogEntryLike[],
  budget?: BudgetLike | null,
  opts: MetricsOptions = {},
): MetricsReport {
  // ============ 过滤 ============
  let filtered = entries;
  if (opts.phase !== undefined) filtered = filtered.filter((e) => e.phase === opts.phase);
  if (opts.from !== undefined) filtered = filtered.filter((e) => !e.timestamp || e.timestamp >= opts.from!);
  if (opts.to !== undefined) filtered = filtered.filter((e) => !e.timestamp || e.timestamp <= opts.to!);

  const warnings: string[] = [];
  if (entries.length === 0) warnings.push('run-log 为空：无过程数据可度量');

  // ============ 总体 ============
  const totalRecords = filtered.length;
  const totalDurationS = filtered.reduce((s, e) => s + (typeof e.duration_s === 'number' ? e.duration_s : 0), 0);
  const totalTokens = filtered.reduce((s, e) => s + (typeof e.tokens === 'number' ? e.tokens : 0), 0);
  const totalSubagentSpawns = filtered.reduce((s, e) => s + (typeof e.subagentSpawns === 'number' ? e.subagentSpawns : 0), 0);
  const reworkRecords = filtered.filter(isRework).length;
  const reworkRate = totalRecords === 0 ? 0 : reworkRecords / totalRecords;

  // ============ 阶段汇总 ============
  const phaseMap = new Map<number, PhaseMetrics>();
  for (const e of filtered) {
    const p = typeof e.phase === 'number' ? e.phase : 0;
    let m = phaseMap.get(p);
    if (!m) {
      m = {
        phase: p,
        phaseName: typeof e.phaseName === 'string' ? e.phaseName : undefined,
        records: 0,
        actions: 0,
        subagentSpawns: 0,
        durationS: 0,
        tokens: 0,
        rework: 0,
      };
      phaseMap.set(p, m);
    }
    m.records += 1;
    if (typeof e.action === 'string') m.actions += 1;
    if (typeof e.subagentSpawns === 'number') m.subagentSpawns += e.subagentSpawns;
    if (typeof e.duration_s === 'number') m.durationS += e.duration_s;
    if (typeof e.tokens === 'number') m.tokens += e.tokens;
    if (isRework(e)) m.rework += 1;
  }
  const byPhase = [...phaseMap.entries()].sort((a, b) => a[0] - b[0]).map(([, m]) => m);

  // ============ 分布 ============
  const byAction: Record<string, number> = {};
  const byRole: Record<string, number> = {};
  const byOutcome: Record<string, number> = {};
  for (const e of filtered) {
    if (typeof e.action === 'string') byAction[e.action] = (byAction[e.action] ?? 0) + 1;
    if (typeof e.role === 'string') byRole[e.role] = (byRole[e.role] ?? 0) + 1;
    if (typeof e.outcome === 'string') byOutcome[e.outcome] = (byOutcome[e.outcome] ?? 0) + 1;
  }

  // ============ 门禁通过率 ============
  const gateEntries = filtered.filter((e) => typeof e.action === 'string' && GATE_ACTIONS.has(e.action));
  const gateTotal = gateEntries.length;
  const gatePassed = gateEntries.filter((e) => e.gateExitCode === 0).length;
  const gateFailed = gateEntries.filter((e) => typeof e.gateExitCode === 'number' && e.gateExitCode !== 0).length;
  const gatePassRate = gateTotal === 0 ? 0 : gatePassed / gateTotal;

  // ============ 返工连续段 ============
  let maxConsecutiveRuns = 0;
  let cur = 0;
  for (const e of filtered) {
    if (isRework(e)) {
      cur += 1;
      if (cur > maxConsecutiveRuns) maxConsecutiveRuns = cur;
    } else {
      cur = 0;
    }
  }

  // ============ 预算 ============
  let budgetSection: MetricsReport['budget'] = null;
  let exceedsKillSwitch = false;
  if (budget) {
    const maxTokensTotal = typeof budget.project?.maxTokensTotal === 'number' ? budget.project.maxTokensTotal : 0;
    const maxTokensPerPhase = typeof budget.perPhase?.maxTokens === 'number' ? budget.perPhase.maxTokens : 0;
    const totalBurnRate = maxTokensTotal === 0 ? 0 : totalTokens / maxTokensTotal;
    const budgetByPhase = byPhase.map((pm) => {
      const burnRate = maxTokensPerPhase === 0 ? 0 : pm.tokens / maxTokensPerPhase;
      const exceeded = maxTokensPerPhase > 0 && pm.tokens > maxTokensPerPhase;
      return { phase: pm.phase, tokens: pm.tokens, maxTokens: maxTokensPerPhase, burnRate, exceeded };
    });
    const killSwitchConsecutive =
      typeof budget.killSwitch?.consecutiveReworks === 'number' ? budget.killSwitch.consecutiveReworks : 3;
    const killSwitchBurn = typeof budget.killSwitch?.budgetBurnRate === 'number' ? budget.killSwitch.budgetBurnRate : 0.9;
    exceedsKillSwitch =
      maxConsecutiveRuns >= killSwitchConsecutive || budgetByPhase.some((b) => b.burnRate >= killSwitchBurn);
    budgetSection = {
      totalTokens,
      maxTokensTotal,
      totalBurnRate,
      byPhase: budgetByPhase,
      onExceed: typeof budget.onExceed === 'string' ? budget.onExceed : 'pause',
      killSwitchTriggered: exceedsKillSwitch,
    };
  }

  // ============ 预警 ============
  if (filtered.some((e) => e.estimated === true)) {
    warnings.push('存在 estimated=true 记录（tokens 为 LLM 估算，违反约束 4，须改为实际报告）');
  }
  if (!budget) {
    warnings.push('budget.json 缺失：预算度量区为 null（仅统计 run-log）');
  }
  if (budgetSection) {
    for (const b of budgetSection.byPhase) {
      if (b.exceeded) warnings.push(`阶段 ${b.phase} token 超预算：${b.tokens} > ${b.maxTokens}`);
    }
    if (budgetSection.killSwitchTriggered) {
      warnings.push('killSwitch 触发：连续返工超阈或阶段 burn rate 超阈，须暂停流程处置');
    }
  }

  return {
    meta: {
      projectId: typeof budget?.projectId === 'string' ? budget.projectId : null,
      recordCount: totalRecords,
      window: { from: opts.from, to: opts.to },
    },
    overall: { totalRecords, totalDurationS, totalTokens, totalSubagentSpawns, reworkRecords, reworkRate },
    byPhase,
    byAction,
    byRole,
    byOutcome,
    gate: { total: gateTotal, passed: gatePassed, failed: gateFailed, passRate: gatePassRate },
    rework: { count: reworkRecords, rate: reworkRate, maxConsecutiveRuns, exceedsKillSwitch },
    budget: budgetSection,
    warnings,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run w-model-dev/scripts/__tests__/metrics-report-logic.test.ts`
Expected: 9 tests PASS

- [ ] **Step 5: 提交**

```bash
git add w-model-dev/scripts/logic/metrics-report-logic.ts w-model-dev/scripts/__tests__/metrics-report-logic.test.ts
git commit --no-gpg-sign -m "feat(metrics-report): 纯逻辑层 computeMetrics 流程度量（TDD 9 用例）"
```

---

## Task 3: wm-status.ts CLI 层

**Files:**
- Create: `w-model-dev/scripts/cli/wm-status.ts`

- [ ] **Step 1: 实现 CLI**

创建 `w-model-dev/scripts/cli/wm-status.ts`：

```ts
#!/usr/bin/env tsx
/**
 * /wm status 状态快照脚本（wm-status.ts）
 *
 * 供编排者（O）只读查询项目状态：当前阶段 / 完成进度 / RTM 覆盖率 / 四级测试汇总 /
 * 最近动作 / 确定性下一步建议。不修改任何数据。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/wm-status.ts [project-dir] [--json]
 *
 * 参数：
 *   project-dir  项目目录（默认当前工作目录），从 <dir>/.w-model/ 读取状态文件
 *   --json       输出单行 StatusReport JSON（供 O 展示证据或机器消费）
 *
 * 退出码：
 *   0  正常（含「项目未初始化」——查询命令语义）
 *   2  输入错误（project.json / rtm.json 非法 JSON，转 operational-recovery）
 *
 * 设计：docs/superpowers/specs/2026-08-05-round31-wm-status-metrics-design.md §3.1
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  buildStatusReport,
  type RtmLike,
  type RunLogLike,
  type StatusReport,
} from './wm-status-logic.js';
import { readJsonlOrExit } from './lib/read-json-or-exit.js';

interface ParsedArgs {
  projectDir: string;
  json: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const json = args.includes('--json');
  const positional = args.filter((a) => !a.startsWith('--'));
  return { projectDir: positional[0] ?? process.cwd(), json };
}

async function main(): Promise<void> {
  const { projectDir, json } = parseArgs(process.argv);
  const wmodelDir = path.join(projectDir, '.w-model');
  const projectFile = path.join(wmodelDir, 'project.json');
  const rtmFile = path.join(wmodelDir, 'rtm.json');
  const runLogFile = path.join(wmodelDir, 'run-log.jsonl');

  // 未初始化 → exit 0（查询命令语义）
  let projectRaw: string;
  try {
    projectRaw = await fs.readFile(projectFile, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      console.error(`✗ 项目未初始化：未找到 ${projectFile}`);
      process.exit(0);
    }
    throw err;
  }
  let project: { status: string; updatedAt?: string };
  try {
    project = JSON.parse(projectRaw) as { status: string; updatedAt?: string };
  } catch {
    console.error(`✗ 文件解析失败（非合法 JSON）: ${projectFile}（转 operational-recovery，不猜测状态）`);
    process.exit(2);
  }

  // rtm.json 可选：缺失降级 null；损坏 → exit 2（输入错误）
  let rtm: RtmLike | null = null;
  try {
    const raw = await fs.readFile(rtmFile, 'utf-8');
    rtm = JSON.parse(raw) as RtmLike;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== 'ENOENT') {
      console.error(`✗ 文件解析失败（非合法 JSON）: ${rtmFile}（转 operational-recovery，不猜测状态）`);
      process.exit(2);
    }
  }

  // run-log.jsonl 可选：缺失降级空数组（先 access 探测，readJsonlOrExit 对 ENOENT 会 exit 2）
  let runLog: RunLogLike[] = [];
  try {
    await fs.access(runLogFile);
    runLog = (await readJsonlOrExit(runLogFile, 'run-log')) as RunLogLike[];
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== 'ENOENT') throw err;
  }

  const report = buildStatusReport(project, rtm, runLog);

  if (json) {
    console.log(JSON.stringify(report));
    process.exit(0);
  }

  // 人类可读
  console.log('═'.repeat(60));
  console.log('/wm status（项目状态快照）');
  console.log('═'.repeat(60));
  console.log(`项目状态      : ${report.status}`);
  console.log(`当前阶段      : ${report.phase} / 8`);
  console.log(`完成进度      : ${report.progress}`);
  console.log(`updatedAt     : ${report.updatedAt}`);
  if (report.rtmCoverage) {
    console.log(`RTM 覆盖率    : ${report.rtmCoverage.covered}/${report.rtmCoverage.total}（${report.rtmCoverage.percent}%）`);
  } else {
    console.log('RTM 覆盖率    : 未生成（.w-model/rtm.json 缺失）');
  }
  if (report.testSummary) {
    const fmt = (t: { total: number; passed: number; failed: number; pending: number }, label: string) =>
      `${label} ${t.passed}/${t.total}（failed=${t.failed}, pending=${t.pending}）`;
    console.log('四级测试      :');
    console.log(`  ${fmt(report.testSummary.unit, '单元')}`);
    console.log(`  ${fmt(report.testSummary.integration, '集成')}`);
    console.log(`  ${fmt(report.testSummary.system, '系统')}`);
    console.log(`  ${fmt(report.testSummary.acceptance, '验收')}`);
  } else {
    console.log('四级测试      : 无汇总（.w-model/rtm.json 缺失）');
  }
  if (report.recentActions.length > 0) {
    console.log('最近动作      :');
    for (const a of report.recentActions) {
      console.log(
        `  [${a.phase ?? '-'}] ${a.action} · ${a.role} · ${a.outcome}` +
          `${typeof a.gateExitCode === 'number' ? ` · exit=${a.gateExitCode}` : ''} · ${a.timestamp}`,
      );
    }
  } else {
    console.log('最近动作      : 无（.w-model/run-log.jsonl 缺失或为空）');
  }
  console.log('下一步建议    :');
  for (const s of report.nextSteps) {
    console.log(`  - ${s}`);
  }
  console.log('─'.repeat(60));
  console.log('STATUS_JSON ' + JSON.stringify(report));
  process.exit(0);
}

main().catch((err) => {
  console.error('/wm status 脚本异常:', err);
  process.exit(2);
});
```

- [ ] **Step 2: 冒烟验证（正向）**

在仓库自身目录跑（仓库根无 .w-model，应报未初始化 exit 0）：
```bash
npx tsx w-model-dev/scripts/cli/wm-status.ts
```
Expected: exit 0，输出「✗ 项目未初始化：未找到 <abs>/.w-model/project.json」

构造临时夹具验证完整输出：
```powershell
$tmp = Join-Path $env:TEMP "wm31-smoke"; New-Item -ItemType Directory -Force -Path (Join-Path $tmp ".w-model") | Out-Null
Set-Content -Encoding utf8 (Join-Path $tmp ".w-model\project.json") '{"id":"smoke","name":"Smoke","description":"","status":"编码","techStack":{"frontend":[],"backend":[],"database":[],"others":[]},"createdAt":"2026-08-05T00:00:00Z","updatedAt":"2026-08-05T01:00:00Z"}'
Set-Content -Encoding utf8 (Join-Path $tmp ".w-model\rtm.json") '{"rows":[{"requirementId":"R1","coverageStatus":"100%"},{"requirementId":"R2","coverageStatus":"部分"}],"executionSummary":{"unitTest":{"total":10,"passed":9,"failed":1,"pending":0},"integrationTest":{"total":5,"passed":5,"failed":0,"pending":0},"systemTest":{"total":3,"passed":3,"failed":0,"pending":0},"acceptanceTest":{"total":8,"passed":8,"failed":0,"pending":0}}}'
Set-Content -Encoding utf8 (Join-Path $tmp ".w-model\run-log.jsonl") '{"runId":"a","timestamp":"t1","phase":5,"action":"produce","role":"S","outcome":"success","gateExitCode":null}{"runId":"b","timestamp":"t2","phase":5,"action":"gate","role":"G","outcome":"success","gateExitCode":0}'
npx tsx w-model-dev/scripts/cli/wm-status.ts $tmp
npx tsx w-model-dev/scripts/cli/wm-status.ts $tmp --json
```
Expected: 人类可读摘要含「阶段 5/8 · 1/8（12.5%）· RTM 1/2（50%）· 单元 9/10」；--json 输出合法 JSON。清理：`Remove-Item -Recurse -Force $tmp`

- [ ] **Step 3: 冒烟验证（异常路径）**

```powershell
Set-Content -Encoding utf8 (Join-Path $tmp ".w-model\project.json") '{bad json'
npx tsx w-model-dev/scripts/cli/wm-status.ts $tmp
$LASTEXITCODE
```
Expected: 输出「✗ 文件解析失败」且 `$LASTEXITCODE` = 2。清理夹具。

- [ ] **Step 4: 提交**

```bash
git add w-model-dev/scripts/cli/wm-status.ts
git commit --no-gpg-sign -m "feat(wm-status): CLI 层状态快照脚本（0/2 退出码，--json 输出）"
```

---

## Task 4: metrics-report.ts CLI 层

**Files:**
- Create: `w-model-dev/scripts/cli/metrics-report.ts`

- [ ] **Step 1: 实现 CLI**

创建 `w-model-dev/scripts/cli/metrics-report.ts`：

```ts
#!/usr/bin/env tsx
/**
 * 流程度量报告脚本（metrics-report.ts）
 *
 * 从 run-log.jsonl（必读）+ budget.json（可选）生成流程度量报告，供编排者预算检查 /
 * CHECKPOINT 决策 / 阶段回顾使用。纯报告，无门禁语义（预警不改退出码）。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/metrics-report.ts [project-dir] [--from=ISO] [--to=ISO] [--phase=N] [--json] [--out=<path>]
 *
 * 参数：
 *   project-dir  项目目录（默认当前工作目录），从 <dir>/.w-model/ 读取
 *   --from=ISO   timestamp 起始过滤（含边界）
 *   --to=ISO     timestamp 截止过滤（含边界）
 *   --phase=N    按阶段过滤（1-8）
 *   --json       输出完整 MetricsReport JSON 到 stdout
 *   --out=<path> 写入完整 MetricsReport JSON 到文件（与 --json 可组合；指定后不再打印人类可读节）
 *
 * 退出码：
 *   0  报告生成成功（含预警）
 *   2  输入错误（run-log.jsonl 缺失 / --phase 非法 / 非法 JSON）
 *
 * 设计：docs/superpowers/specs/2026-08-05-round31-wm-status-metrics-design.md §3.2
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { computeMetrics, type BudgetLike, type MetricsReport, type RunLogEntryLike } from './metrics-report-logic.js';
import { readJsonOrExit, readJsonlOrExit } from './lib/read-json-or-exit.js';

interface ParsedArgs {
  projectDir: string;
  from?: string;
  to?: string;
  phase?: number;
  json: boolean;
  out?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const json = args.includes('--json');
  const positional = args.filter((a) => !a.startsWith('--'));
  const from = args.find((a) => a.startsWith('--from='))?.split('=')[1];
  const to = args.find((a) => a.startsWith('--to='))?.split('=')[1];
  const phaseArg = args.find((a) => a.startsWith('--phase='));
  const out = args.find((a) => a.startsWith('--out='))?.split('=')[1];
  let phase: number | undefined;
  if (phaseArg) {
    const n = Number(phaseArg.split('=')[1]);
    if (!Number.isInteger(n) || n < 1 || n > 8) {
      console.error(`✗ --phase 参数非法: ${phaseArg.split('=')[1]}（须为 1-8 整数）`);
      process.exit(2);
    }
    phase = n;
  }
  return { projectDir: positional[0] ?? process.cwd(), from, to, phase, json, out };
}

function fmtRecord(rec: Record<string, number>): string {
  const entries = Object.entries(rec).sort((a, b) => b[1] - a[1]);
  return entries.length === 0 ? '无' : entries.map(([k, v]) => `${k}=${v}`).join(', ');
}

function printHuman(r: MetricsReport, runLogFile: string): void {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  console.log('═'.repeat(60));
  console.log('流程度量报告（metrics-report）');
  console.log('═'.repeat(60));
  console.log(`数据源        : ${runLogFile}`);
  console.log(`记录数        : ${r.meta.recordCount}`);
  console.log(`时间窗口      : ${r.meta.window.from ?? '最早'} → ${r.meta.window.to ?? '最新'}`);
  console.log('─'.repeat(60));
  console.log(
    `总体          : tokens=${r.overall.totalTokens} · 耗时=${r.overall.totalDurationS}s · 分派=${r.overall.totalSubagentSpawns} · 返工=${r.overall.reworkRecords}（${pct(r.overall.reworkRate)}）`,
  );
  console.log('阶段汇总      :');
  for (const p of r.byPhase) {
    console.log(
      `  阶段 ${p.phase}${p.phaseName ? ` ${p.phaseName}` : ''}: ${p.records} 条 · 动作 ${p.actions} · tokens ${p.tokens} · ${p.durationS}s · 返工 ${p.rework}`,
    );
  }
  console.log(`动作分布      : ${fmtRecord(r.byAction)}`);
  console.log(`角色分布      : ${fmtRecord(r.byRole)}`);
  console.log(`结果分布      : ${fmtRecord(r.byOutcome)}`);
  console.log(`门禁通过率    : ${r.gate.passed}/${r.gate.total}（${pct(r.gate.passRate)}）`);
  console.log(`返工连续段    : 最长 ${r.rework.maxConsecutiveRuns} 次${r.rework.exceedsKillSwitch ? '（⚠ 触发 killSwitch）' : ''}`);
  if (r.budget) {
    console.log('预算          :');
    console.log(`  总消耗 ${r.budget.totalTokens} / 上限 ${r.budget.maxTokensTotal}（${pct(r.budget.totalBurnRate)}）`);
    for (const b of r.budget.byPhase) {
      console.log(`  阶段 ${b.phase}: ${b.tokens} / ${b.maxTokens}（${pct(b.burnRate)}）${b.exceeded ? ' ⚠ 超限' : ''}`);
    }
    console.log(`  onExceed=${r.budget.onExceed}${r.budget.killSwitchTriggered ? ' · ⚠ killSwitch 触发' : ''}`);
  } else {
    console.log('预算          : 未提供（.w-model/budget.json 缺失）');
  }
  if (r.warnings.length > 0) {
    console.log('预警          :');
    for (const w of r.warnings) console.log(`  ⚠ ${w}`);
  }
  console.log('─'.repeat(60));
  console.log('METRICS_JSON ' + JSON.stringify(r));
}

async function main(): Promise<void> {
  const { projectDir, from, to, phase, json, out } = parseArgs(process.argv);
  const wmodelDir = path.join(projectDir, '.w-model');
  const runLogFile = path.join(wmodelDir, 'run-log.jsonl');
  const budgetFile = path.join(wmodelDir, 'budget.json');

  // run-log 必读（缺失 → readJsonlOrExit exit 2；坏行 warn 跳过）
  const entries = (await readJsonlOrExit(runLogFile, 'run-log')) as RunLogEntryLike[];

  // budget 可选（缺失 → null）
  let budget: BudgetLike | null = null;
  try {
    await fs.access(budgetFile);
    budget = (await readJsonOrExit(budgetFile)) as BudgetLike;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== 'ENOENT') throw err;
  }

  const report = computeMetrics(entries, budget, { from, to, phase });

  if (out) {
    await fs.writeFile(out, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`✓ 度量报告已写入: ${path.resolve(out)}`);
  }
  if (json || !out) {
    console.log(JSON.stringify(report));
  }
  if (!json && !out) {
    printHuman(report, runLogFile);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('metrics-report 脚本异常:', err);
  process.exit(2);
});
```

- [ ] **Step 2: 冒烟验证**

构造夹具（复用 Task 3 的 `$tmp`，追加 budget.json + 多条 run-log）：
```powershell
$tmp = Join-Path $env:TEMP "wm31-smoke"; New-Item -ItemType Directory -Force -Path (Join-Path $tmp ".w-model") | Out-Null
Set-Content -Encoding utf8 (Join-Path $tmp ".w-model\run-log.jsonl") '{"phase":1,"action":"produce","role":"S","outcome":"success","tokens":100,"duration_s":10,"subagentSpawns":1,"gateExitCode":null,"timestamp":"2026-08-05T01:00:00Z"}{"phase":1,"action":"rework","role":"S","outcome":"rework","tokens":50,"duration_s":5,"subagentSpawns":1,"gateExitCode":null,"timestamp":"2026-08-05T02:00:00Z"}{"phase":2,"action":"gate","role":"G","outcome":"success","tokens":30,"duration_s":3,"subagentSpawns":1,"gateExitCode":0,"timestamp":"2026-08-06T01:00:00Z"}'
Set-Content -Encoding utf8 (Join-Path $tmp ".w-model\budget.json") '{"projectId":"smoke","project":{"maxTokensTotal":10000},"perPhase":{"maxTokens":1000},"killSwitch":{"consecutiveReworks":3,"budgetBurnRate":0.9},"onExceed":"pause"}'
npx tsx w-model-dev/scripts/cli/metrics-report.ts $tmp
npx tsx w-model-dev/scripts/cli/metrics-report.ts $tmp --json --out (Join-Path $tmp "report.json")
```
Expected: 人类可读摘要含 9 个节；`--json` 输出合法 JSON；`report.json` 生成且可 JSON.parse。清理：`Remove-Item -Recurse -Force $tmp`

- [ ] **Step 3: 异常路径**

```powershell
$tmp2 = Join-Path $env:TEMP "wm31-norunlog"; New-Item -ItemType Directory -Force -Path (Join-Path $tmp2 ".w-model") | Out-Null
npx tsx w-model-dev/scripts/cli/metrics-report.ts $tmp2
$LASTEXITCODE
```
Expected: 「✗ 文件不存在」且 `$LASTEXITCODE` = 2。清理。

- [ ] **Step 4: 提交**

```bash
git add w-model-dev/scripts/cli/metrics-report.ts
git commit --no-gpg-sign -m "feat(metrics-report): CLI 层流程度量报告脚本（0/2 退出码，--json/--out/--phase/窗口过滤）"
```

---

## Task 5: 文档同步（6 文件）

**Files:**
- Modify: `w-model-dev/SKILL.md`
- Modify: `w-model-dev/references/command-reference.md`
- Modify: `w-model-dev/references/toolbox.md`
- Modify: `w-model-dev/scripts/__tests__/README.md`
- Modify: `AGENTS.md`
- Modify: `README.md`

- [ ] **Step 1: SKILL.md**

a. frontmatter `version: 30.1.0` → `version: 31.0.0`（勿动其他字段）。
b. 命令速查表（`## 命令速查` 节的表格）：
   - `/wm status` 行「关键前置/行为」列更新为「读取状态与 RTM，不修改数据；由 wm-status.ts 脚本化输出」；
   - 表格末尾（`/wm hill-climbing` 行之后）新增一行：
     `| \`/wm metrics\` | 流程度量 | 从 run-log/budget 生成流程度量报告；只读 | O 只读，不分派子代理 |`
c. 参数示例节（命令速查后的代码块，现有 `/wm hill-climbing` 示例后）追加：
   ````md
   /wm status --json                              # 输出状态快照 JSON（供展示证据）
   /wm metrics                                   # 全量流程度量摘要
   /wm metrics --phase=5 --json --out=metrics.json  # 仅阶段 5，写文件
   ````
d. Bundled Resources scripts 表（`## Bundled Resources` 节）新增 2 行：
   `| \`wm-status.ts\` | 状态快照脚本（当前阶段/进度/RTM 覆盖/四级测试/最近动作/下一步建议） |`
   `| \`metrics-report.ts\` | 流程度量报告脚本（动作/角色/结果分布、返工、预算 burn rate、killSwitch 预警） |`

- [ ] **Step 2: command-reference.md**

a. §`/wm status` 节整段改写为：

````md
## `/wm status`

- **执行方**：O 只读，不分派子代理。
- 运行 `npx tsx w-model-dev/scripts/cli/wm-status.ts <project-dir> [--json]`（project-dir 默认 cwd）：
  - 只读 `.w-model/project.json`（必读）、`.w-model/rtm.json` 与 `.w-model/run-log.jsonl`（缺失降级），输出：
    1. 当前阶段与 `updatedAt`；
    2. 已完成阶段数 / 8 与进度；
    3. RTM 已覆盖需求数 / 总需求数（coverageStatus=100% 计数）；
    4. 四级测试 `total/passed/failed/pending`；
    5. 最近 3 条动作；
    6. 确定性下一步建议。
  - `--json` 输出单行 `StatusReport` JSON（供展示证据或机器消费）。
- 退出码：0 = 正常（含未初始化提示「项目未初始化」）；2 = project/rtm JSON 损坏（转 `operational-recovery.md`，不得猜测状态）。
````

b. 新增 §`/wm metrics`（置于 `/wm status` 节之后）：

````md
## `/wm metrics`

- **执行方**：O 只读，不分派子代理。
- 运行 `npx tsx w-model-dev/scripts/cli/metrics-report.ts <project-dir> [--from=ISO] [--to=ISO] [--phase=N] [--json] [--out=<path>]`：
  - 必读 `.w-model/run-log.jsonl`，可选读 `.w-model/budget.json`（缺失时预算区为 null）；
  - 输出 7 区流程度量：总体（tokens/耗时/分派/返工）、阶段汇总、动作分布、角色分布、结果分布、门禁通过率、预算 burn rate 与 killSwitch 预警；
  - `--json` 输出完整报告 JSON；`--out <path>` 写入文件；`--phase`/`--from`/`--to` 过滤。
- 退出码：0 = 生成成功（预警不改退出码）；2 = run-log 缺失 / `--phase` 非法 / JSON 损坏。
- 纯报告无门禁语义：预算超限/返工超阈仅预警，拦截仍由 `check-budget.ts` 与门禁流程承担（反模式 #3/#6）。
````

- [ ] **Step 3: toolbox.md scripts 决策表新增 2 行**

`| wm-status.ts | 状态快照 | 只读 | 查询命令：O 展示证据前可先跑，输出 STATUS_JSON |`
`| metrics-report.ts | 流程度量 | 只读 | 报告工具：预算检查/阶段回顾；无门禁语义 |`

- [ ] **Step 4: __tests__/README.md coverage 矩阵新增 2 行**

`| wm-status-logic.test.ts | buildStatusReport / STATUS_TO_PHASE | 9 |`
`| metrics-report-logic.test.ts | computeMetrics | 9 |`

- [ ] **Step 5: AGENTS.md**

- §2 scripts 描述行：追加 `wm-status.ts`（状态快照）与 `metrics-report.ts`（流程度量）描述（追加到 scripts 目录描述中，仿既有 check-*.ts 条目格式）。
- §3 常用命令：追加 2 行 `npm run wm:status -- <dir>` / `npm run wm:metrics -- <dir>`。

- [ ] **Step 6: README.md**

- 命令速查表新增 `/wm metrics` 行；`/wm status` 行标注「脚本化」。
- 门禁/工具脚本表新增 `wm-status.ts` 与 `metrics-report.ts` 两行。
- 项目结构树 `w-model-dev/scripts/` 段新增 4 个文件名（wm-status.ts / wm-status-logic.ts / metrics-report.ts / metrics-report-logic.ts）。

- [ ] **Step 7: 验证与提交**

```bash
npx tsc --noEmit
git add w-model-dev/SKILL.md w-model-dev/references/command-reference.md w-model-dev/references/toolbox.md w-model-dev/scripts/__tests__/README.md AGENTS.md README.md
git commit --no-gpg-sign -m "docs(round31): SKILL/command-reference/toolbox/coverage 矩阵/AGENTS/README 同步 wm-status + metrics-report"
```
Expected: tsc 0 错误。

---

## Task 6: SSoT + INSTALL + CHANGELOG + 版本号 + package.json（5 文件）

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`
- Modify: `docs/INSTALL.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `w-model-dev/skill-metadata.json`

- [ ] **Step 1: package.json + skill-metadata.json 版本号与 scripts**

- `package.json`：`"version": "30.1.0"` → `"31.0.0"`；scripts 新增：
  ```json
  "wm:status": "tsx w-model-dev/scripts/cli/wm-status.ts",
  "wm:metrics": "tsx w-model-dev/scripts/cli/metrics-report.ts",
  ```
- `w-model-dev/skill-metadata.json`：`"version"` → `"31.0.0"`。

- [ ] **Step 2: SSoT**

a. §3.4 新增 `§3.4.29 第 31 轮：/wm status 脚本化 + 流程度量报告`（内容：两个脚本 + 退出码语义 + 度量口径，引用设计 spec）。
b. §10A 追溯表新增一行（§3.4.29 → scripts/wm-status*.ts + scripts/metrics-report*.ts + 文档）。
c. §6.1 核心命令表：`/wm status` 行更新（脚本化 wm-status.ts）；新增 `/wm metrics` 行（流程度量，O 只读）。
d. 附录 A 命令速查：新增 `/wm metrics` 条目；`/wm status` 标注脚本化。

- [ ] **Step 3: INSTALL.md**

- 资产索引/版本号引用 30.1.0 → 31.0.0。
- §3 目录结构/§7 目录速查 `w-model-dev/scripts/` 段追加 4 个文件。

- [ ] **Step 4: CHANGELOG.md**

在文件顶部（`# 变更日志` 头部之后）新增 `[31.0.0]` 条目：

````md
## [31.0.0] - 2026-08-05

### 第三十二轮 /wm status 脚本化 + 流程度量报告（metrics-report.ts）

吸收外部评审建议新功能批两项（设计文档 `docs/superpowers/specs/2026-08-05-round31-wm-status-metrics-design.md`）：把手工状态查询脚本化为确定性 CLI；新增 run-log/budget 流程度量汇总工具。详见 SSoT §3.4.29。

#### Added
- 新建 `scripts/wm-status.ts` + `scripts/wm-status-logic.ts`（状态快照：当前阶段 / 完成进度 / RTM 覆盖率 / 四级测试汇总 / 最近 3 条动作 / 确定性下一步建议；退出码 0/2，`--json` 输出 StatusReport）
- 新建 `scripts/metrics-report.ts` + `scripts/metrics-report-logic.ts`（流程度量：总体 / 阶段汇总 / 动作·角色·结果分布 / 门禁通过率 / 返工率与连续段 / 预算 burn rate 与 killSwitch 预警；`--from/--to/--phase/--json/--out`；纯报告无门禁语义）
- `package.json` scripts 新增 `wm:status` / `wm:metrics`

#### Changed
- `SKILL.md`：命令速查表 `/wm status` 脚本化 + 新增 `/wm metrics`；参数示例 + Bundled Resources + frontmatter version → 31.0.0
- `command-reference.md`：§/wm status 改写为脚本化；新增 §/wm metrics
- SSoT §3.4.29 + §10A 追溯表 + §6.1 命令表 + 附录 A；INSTALL.md / AGENTS.md / README.md / toolbox.md / __tests__ coverage 矩阵同步
- 版本号三处同步为 31.0.0：package.json + skill-metadata.json + SKILL.md frontmatter

#### 验证
- vitest <实测总数>/<实测总数>（<实际文件数> 文件）全通过（新增 wm-status-logic 9 + metrics-report-logic 9 用例）
- self-test 213/213 不变全通过
- TypeScript strict 0 错误
- `npm run lint:security` exit 0（0 新增）
- 冒烟：wm-status（含未初始化 exit 0 / 损坏 JSON exit 2）、metrics-report（含缺失 run-log exit 2）均符合预期
````

- [ ] **Step 5: 提交**

```bash
git add docs/skill-design-document_SSoT.md docs/INSTALL.md CHANGELOG.md package.json w-model-dev/skill-metadata.json
git commit --no-gpg-sign -m "release(31.0.0): SSoT §3.4.29 + INSTALL/CHANGELOG + 版本号三处 31.0.0 + wm:status/wm:metrics scripts"
```

---

## Task 7: 全量回归 + 收尾提交

**Files:**
- 验证（无新文件）

- [ ] **Step 1: 全量验证**

Run（在仓库根）：
```bash
npx tsc --noEmit
npm run self-test
npx vitest run
npm run lint:security
```
Expected:
- tsc: 0 错误
- self-test: 213/213 全通过
- vitest: 全部通过（应为 301 + 18 = 319；以实测为准）
- lint:security: exit 0（0 新增）

- [ ] **Step 2: 修正文档中的实测数字**

- `docs/superpowers/specs/2026-08-05-round31-wm-status-metrics-design.md`：验收标准节 vitest 基线改为实测总数（301 → 实测）；第 4 节「基线」行同理。
- `CHANGELOG.md` [31.0.0] 验证节：`vitest <实测总数>/<实测总数>（<实际文件数> 文件）` 替换为实测数字（如 `319/319（25 文件）`）。
- `README.md`/`AGENTS.md`/`INSTALL.md` 中出现的 vitest 计数引用（如 301）同步为实测值。

- [ ] **Step 3: 收尾提交**

```bash
git add docs/superpowers/specs/2026-08-05-round31-wm-status-metrics-design.md CHANGELOG.md README.md AGENTS.md docs/INSTALL.md
git commit --no-gpg-sign -m "docs(round31): 按实测同步 vitest 计数与验证记录"
```

- [ ] **Step 4: prepush 全量门禁（可选，推送前执行）**

Run（Git Bash，PowerShell 不可直接跑）：`& 'C:\Program Files\Git\bin\bash.exe' -c 'PREPUSH_FORCE=1 bash .githooks/pre-push'`
Expected: 12 项全通过。

---

## 计划自审记录

- **Spec 覆盖**：spec §3.1（wm-status）→ Task 1+3；§3.2（metrics-report）→ Task 2+4；§4（测试 15 用例，计划扩为 18）→ Task 1+2；§5（文档清单 11 项）→ Task 5+6；§6（验收）→ Task 7。
- **类型一致性**：`STATUS_TO_PHASE` / `buildStatusReport` / `computeMetrics` / `MetricsReport` / `StatusReport` 在逻辑层与 CLI 层命名一致；`readJsonOrExit` / `readJsonlOrExit` 签名与 v29 抽取工具一致。
- **无占位符**：所有代码步骤含完整代码；文档步骤含精确插入点与内容。
- **版本约定**：30.1.0 → 31.0.0 三处同步（package.json / skill-metadata.json / SKILL.md frontmatter），沿用「round N 实施批 → N.0.0」惯例（30.0.0=上一批）。
- **退出码决策**：两个脚本均为 0/2（查询/报告语义）；未初始化 exit 0；损坏输入 exit 2；无 exit 1 门禁语义（spec §1.3/§3.1/§3.2 决策）。
- **执行方式**：Subagent-Driven（每任务独立子代理 + 规范审查 + 质量审查）或 Inline（executing-plans 批处理），由用户选择。