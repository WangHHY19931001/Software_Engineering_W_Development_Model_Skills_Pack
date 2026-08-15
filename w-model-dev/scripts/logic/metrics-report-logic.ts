/**
 * 流程度量报告纯逻辑层（metrics-report-logic.ts）
 *
 * 供 scripts/cli/metrics-report.ts CLI 层调用；纯函数、无 IO、可单测。
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
  /** V 审查返工提示（outcome=rework/fail 时非空数组）；reworkHints 统计用 */
  reworkHints?: string[];
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

/**
 * 编排质量指标输入（只读统计，不加门禁）：
 *   - r3Reports：`.w-model/preventive-reviews/` 下各 R3 报告（文件 IO 在 CLI 层完成）
 *   - icebergReports：`.w-model/iceberg/` 下各冰山扫掠报告
 * 两者均「存在才统计」：缺省时对应 orchestration 子区为 null（不告警、不阻断）。
 */
export interface OrchestrationInputs {
  r3Reports?: Array<{
    phase?: number;
    dimension?: string;
    findings?: Array<{ severity?: string }>;
    passed?: boolean;
  }>;
  icebergReports?: Array<{
    icebergRound?: number;
    newFindings?: Array<{ findingId?: string; severity?: string }>;
    passed?: boolean;
  }>;
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
  meta: {
    projectId: string | null;
    recordCount: number;
    window: { from?: string; to?: string };
  };
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
  rework: {
    count: number;
    rate: number;
    maxConsecutiveRuns: number;
    exceedsKillSwitch: boolean;
  };
  budget: null | {
    totalTokens: number;
    maxTokensTotal: number;
    totalBurnRate: number;
    byPhase: Array<{
      phase: number;
      tokens: number;
      maxTokens: number;
      burnRate: number;
      exceeded: boolean;
    }>;
    onExceed: string;
    killSwitchTriggered: boolean;
  };
  /** 编排质量指标（只读统计，不加门禁；数据源缺省时对应子区为 null） */
  orchestration: {
    r3: null | {
      totalReports: number;
      byDimension: Record<string, number>;
      findingsBySeverity: Record<string, number>;
      totalFindings: number;
      avgFindingsPerReport: number;
    };
    iceberg: null | {
      totalSweeps: number;
      roundsDistribution: Record<string, number>;
      totalNewFindings: number;
      findingsBySeverity: Record<string, number>;
      maxRound: number;
    };
    reworkHints: {
      entriesWithHints: number;
      totalHints: number;
      avgHintsPerEntry: number;
    };
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
  orch: OrchestrationInputs = {},
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
  const totalSubagentSpawns = filtered.reduce(
    (s, e) => s + (typeof e.subagentSpawns === 'number' ? e.subagentSpawns : 0),
    0,
  );
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
      return {
        phase: pm.phase,
        tokens: pm.tokens,
        maxTokens: maxTokensPerPhase,
        burnRate,
        exceeded,
      };
    });
    const killSwitchConsecutive =
      typeof budget.killSwitch?.consecutiveReworks === 'number' ? budget.killSwitch.consecutiveReworks : 3;
    const killSwitchBurn =
      typeof budget.killSwitch?.budgetBurnRate === 'number' ? budget.killSwitch.budgetBurnRate : 0.9;
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

  // ============ 编排质量指标（只读统计，不加门禁） ============
  // R3 预防性审查：套数 / 维度分布 / findings 严重度分布（数据源缺失 → null）
  let r3Section: MetricsReport['orchestration']['r3'] = null;
  if (orch.r3Reports && orch.r3Reports.length > 0) {
    const byDimension: Record<string, number> = {};
    const findingsBySeverity: Record<string, number> = {};
    let totalFindings = 0;
    for (const r of orch.r3Reports!) {
      const dim = typeof r.dimension === 'string' ? r.dimension : 'unknown';
      byDimension[dim] = (byDimension[dim] ?? 0) + 1;
      for (const f of r.findings ?? []) {
        totalFindings += 1;
        const sev = typeof f.severity === 'string' ? f.severity : 'unknown';
        findingsBySeverity[sev] = (findingsBySeverity[sev] ?? 0) + 1;
      }
    }
    r3Section = {
      totalReports: orch.r3Reports.length,
      byDimension,
      findingsBySeverity,
      totalFindings,
      avgFindingsPerReport: totalFindings / orch.r3Reports.length,
    };
  }

  // 冰山扫掠：轮次分布 / 新发现计数 / 严重度分布（数据源缺失 → null）
  let icebergSection: MetricsReport['orchestration']['iceberg'] = null;
  if (orch.icebergReports && orch.icebergReports.length > 0) {
    const roundsDistribution: Record<string, number> = {};
    const findingsBySeverity: Record<string, number> = {};
    let totalNewFindings = 0;
    let maxRound = 0;
    for (const r of orch.icebergReports!) {
      const round = typeof r.icebergRound === 'number' ? r.icebergRound : 0;
      const key = String(round);
      roundsDistribution[key] = (roundsDistribution[key] ?? 0) + 1;
      if (round > maxRound) maxRound = round;
      for (const f of r.newFindings ?? []) {
        totalNewFindings += 1;
        const sev = typeof f.severity === 'string' ? f.severity : 'unknown';
        findingsBySeverity[sev] = (findingsBySeverity[sev] ?? 0) + 1;
      }
    }
    icebergSection = {
      totalSweeps: orch.icebergReports.length,
      roundsDistribution,
      totalNewFindings,
      findingsBySeverity,
      maxRound,
    };
  }

  // reworkHints：V 审查返工提示密度（数据源为 run-log 本身，始终可统计）
  const hintEntries = filtered.filter((e) => Array.isArray(e.reworkHints) && e.reworkHints.length > 0);
  const totalHints = hintEntries.reduce((s, e) => s + (e.reworkHints?.length ?? 0), 0);
  const reworkHintsSection = {
    entriesWithHints: hintEntries.length,
    totalHints,
    avgHintsPerEntry: hintEntries.length === 0 ? 0 : totalHints / hintEntries.length,
  };

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
    overall: {
      totalRecords,
      totalDurationS,
      totalTokens,
      totalSubagentSpawns,
      reworkRecords,
      reworkRate,
    },
    byPhase,
    byAction,
    byRole,
    byOutcome,
    gate: {
      total: gateTotal,
      passed: gatePassed,
      failed: gateFailed,
      passRate: gatePassRate,
    },
    rework: {
      count: reworkRecords,
      rate: reworkRate,
      maxConsecutiveRuns,
      exceedsKillSwitch,
    },
    budget: budgetSection,
    orchestration: {
      r3: r3Section,
      iceberg: icebergSection,
      reworkHints: reworkHintsSection,
    },
    warnings,
  };
}
