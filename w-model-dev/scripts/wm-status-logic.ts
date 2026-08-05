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

/** 百分比字符串：保留 1 位小数，去掉尾随 .0，带 % 后缀（37.5% / 25%） */
function formatPercent(n: number): string {
  const s = ((n / 8) * 100).toFixed(1);
  return s.endsWith('.0') ? `${s.slice(0, -2)}%` : `${s}%`;
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
