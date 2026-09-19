/**
 * wm-status-logic.ts 单元测试
 *
 * 覆盖：9 态 → phase 映射 / completedPhases / progress / RTM 覆盖 / 四级测试汇总 /
 *       recentActions 尾部 3 条 / rtm·runLog 缺失降级 / nextSteps 确定性。
 */

import { describe, expect, it } from 'vitest';

import { buildStatusReport, STATUS_TO_PHASE } from '../logic/wm-status-logic.js';

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

  it('RTM 覆盖按追溯字段重算（coverageStatus 仅展示，不参与计数）', () => {
    const complete = {
      description: 'd',
      designDoc: 'docs/x.md#1',
      codeModule: 'SD-001:src/counter.ts',
      unitTest: 'TC-UNIT-001',
      acceptanceTest: 'docs/y.md#UAT-001',
      coverageStatus: '100%',
    };
    const r = buildStatusReport(
      { status: '编码' },
      {
        rows: [
          { requirementId: 'REQ-001', ...complete },
          { requirementId: 'REQ-002', ...complete },
          { requirementId: 'REQ-003', ...complete, codeModule: '', coverageStatus: '100%' },
        ],
      },
    );
    expect(r.rtmCoverage).toEqual({ covered: 2, total: 3, percent: 67 });
  });

  it('RTM total=0 → percent=0', () => {
    const r = buildStatusReport({ status: '编码' }, { rows: [] });
    expect(r.rtmCoverage).toEqual({ covered: 0, total: 0, percent: 0 });
  });

  it('computes RTM coverage from trace fields, not from the display-only coverageStatus', () => {
    const rows = ['REQ-001', 'REQ-002', 'NFR-001', 'CON-001'].map((requirementId) => ({
      requirementId,
      description: 'd',
      designDoc: 'docs/x.md#1',
      codeModule: 'SD-001:src/counter.ts',
      unitTest: 'TC-UNIT-001',
      integrationTest: 'TC-INT-001',
      systemTest: 'TC-SYS-001',
      acceptanceTest: 'docs/y.md#UAT-001',
      coverageStatus: '完整',
    }));
    const report = buildStatusReport({ status: '项目完成' }, { rows }, null);
    expect(report.rtmCoverage).toEqual({ covered: 4, total: 4, percent: 100 });
  });

  it('counts rows missing a trace field as uncovered', () => {
    const base = {
      description: 'd',
      designDoc: 'docs/x.md#1',
      unitTest: 'TC-UNIT-001',
      integrationTest: 'TC-INT-001',
      systemTest: 'TC-SYS-001',
      acceptanceTest: 'docs/y.md#UAT-001',
      coverageStatus: '完整',
    } as Record<string, string>;
    const rows = [
      { requirementId: 'REQ-001', codeModule: 'SD-001:src/counter.ts', ...base },
      { requirementId: 'REQ-002', codeModule: '', ...base },
      { requirementId: 'REQ-003', codeModule: 'SD-002:src/x.ts', ...base },
      { requirementId: 'REQ-004', codeModule: 'SD-003:src/y.ts', ...base },
    ];
    const report = buildStatusReport({ status: '项目完成' }, { rows }, null);
    expect(report.rtmCoverage).toEqual({ covered: 3, total: 4, percent: 75 });
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
    expect(r.recentActions[0]!.runId).toBe('r3');
    expect(r.recentActions[2]!.runId).toBe('r5');
    expect(Object.keys(r.recentActions[0]!).sort()).toEqual([
      'action',
      'gateExitCode',
      'outcome',
      'phase',
      'role',
      'runId',
      'timestamp',
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
