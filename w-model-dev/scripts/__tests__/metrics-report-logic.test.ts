/**
 * metrics-report-logic.ts 单元测试
 *
 * 覆盖：总体汇总 / 阶段分组 / 分布 / 返工率与连续段 / gate 通过率 / 预算 burn rate 与
 *       killSwitch 两路径（consecutiveReworks、budgetBurnRate）/ 时间窗口与 phase 过滤 / 空 run-log。
 */

import { describe, expect, it } from 'vitest';

import { computeMetrics, type RunLogEntryLike } from '../logic/metrics-report-logic.js';

function e(p: Partial<RunLogEntryLike> = {}): RunLogEntryLike {
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
    const r = computeMetrics([e({ tokens: 400 }), e({ action: 'rework' }), e({ action: 'fix' })], budget);
    expect(r.budget?.totalBurnRate).toBeCloseTo(0.6);
    expect(r.budget?.byPhase[0]).toMatchObject({ phase: 1, tokens: 600, maxTokens: 300, exceeded: true });
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
    expect(r.budget?.byPhase[0]!.burnRate).toBeCloseTo(0.95);
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
    expect(r.byPhase[0]!.phase).toBe(2);
    const r2 = computeMetrics(entries, null, { phase: 3 });
    expect(r2.byPhase[0]!.phase).toBe(3);
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
