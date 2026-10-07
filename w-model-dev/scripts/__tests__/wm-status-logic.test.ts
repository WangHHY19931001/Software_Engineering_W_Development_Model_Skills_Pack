/**
 * wm-status-logic.ts 单元测试
 *
 * 覆盖：9 态 → phase 映射 / completedPhases / progress / RTM 覆盖 / 四级测试汇总 /
 *       recentActions 尾部 3 条 / rtm·runLog 缺失降级 / nextSteps 确定性。
 */

import { describe, expect, it } from 'vitest';

import { PROJECT_STATUS_COMPLETED, PROJECT_STATUSES, PROJECT_STATUS_TO_PHASE } from '../lib/constants.js';
import { buildStatusReport, NEXT_STEPS, STATUS_TO_PHASE } from '../logic/wm-status-logic.js';

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
  it('progress（2 态：项目完成 8/8（100%）/ 中间态 completedPhases=phase-1）', () => {
    for (const { caseName, input, expectedPhase, expectedCompleted, expectedProgress, expectedUpdatedAt } of [
      {
        caseName: '项目完成',
        input: { status: '项目完成', updatedAt: '2026-08-05T00:00:00Z' },
        expectedPhase: 8,
        expectedCompleted: 8,
        expectedProgress: '8/8（100%）',
        expectedUpdatedAt: '2026-08-05T00:00:00Z',
      },
      {
        caseName: '中间态（系统设计）',
        input: { status: '系统设计' },
        expectedPhase: 2,
        expectedCompleted: 1,
        expectedProgress: '1/8（12.5%）',
        expectedUpdatedAt: undefined as string | undefined,
      },
    ]) {
      const r = buildStatusReport(input);
      expect(r.phase, `${caseName}: phase`).toBe(expectedPhase);
      expect(r.completedPhases, `${caseName}: completedPhases`).toBe(expectedCompleted);
      expect(r.progress, `${caseName}: progress`).toBe(expectedProgress);
      if (expectedUpdatedAt !== undefined) {
        expect(r.updatedAt, `${caseName}: updatedAt 透传`).toBe(expectedUpdatedAt);
      }
    }
  });

  it('RTM 覆盖按追溯字段重算（coverageStatus 仅展示，不参与计数）', () => {
    const complete = {
      description: 'd',
      designDoc: 'docs/x.md#1',
      codeModule: 'SD-001:src/counter.ts:L1',
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

  it('RTM 覆盖（3 态：total=0 → percent=0 / 追溯字段重算 / 缺字段行计未覆盖）', () => {
    for (const { caseName, rows, expected } of [
      {
        caseName: 'RTM total=0 → percent=0',
        rows: [] as Array<Record<string, unknown>>,
        expected: { covered: 0, total: 0, percent: 0 },
      },
      {
        caseName: 'computes RTM coverage from trace fields, not from the display-only coverageStatus',
        rows: ['REQ-001', 'REQ-002', 'NFR-001', 'CON-001'].map((requirementId) => ({
          requirementId,
          description: 'd',
          designDoc: 'docs/x.md#1',
          codeModule: 'SD-001:src/counter.ts:L1',
          unitTest: 'TC-UNIT-001',
          integrationTest: 'TC-INT-001',
          systemTest: 'TC-SYS-001',
          acceptanceTest: 'docs/y.md#UAT-001',
          coverageStatus: '完整',
        })),
        expected: { covered: 4, total: 4, percent: 100 },
      },
      {
        caseName: 'counts rows missing a trace field as uncovered',
        rows: (() => {
          const base = {
            description: 'd',
            designDoc: 'docs/x.md#1',
            unitTest: 'TC-UNIT-001',
            integrationTest: 'TC-INT-001',
            systemTest: 'TC-SYS-001',
            acceptanceTest: 'docs/y.md#UAT-001',
            coverageStatus: '完整',
          } as Record<string, string>;
          return [
            { requirementId: 'REQ-001', codeModule: 'SD-001:src/counter.ts:L1', ...base },
            { requirementId: 'REQ-002', codeModule: '', ...base },
            { requirementId: 'REQ-003', codeModule: 'SD-002:src/x.ts:L1', ...base },
            { requirementId: 'REQ-004', codeModule: 'SD-003:src/y.ts:L1', ...base },
          ];
        })(),
        expected: { covered: 3, total: 4, percent: 75 },
      },
    ]) {
      const report = buildStatusReport({ status: '项目完成' }, { rows }, null);
      expect(report.rtmCoverage, `${caseName}`).toEqual(expected);
    }
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

  it('recentActions（2 态：尾部 3 条精简字段 / 不足 3 条与空列表）', () => {
    // 态 1：取尾部 3 条并精简字段
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
    expect(r.recentActions, '尾部 3 条: 长度').toHaveLength(3);
    expect(r.recentActions[0]!.runId, '尾部 3 条: 首条为倒数第 3').toBe('r3');
    expect(r.recentActions[2]!.runId, '尾部 3 条: 末条为最新').toBe('r5');
    expect(Object.keys(r.recentActions[0]!).sort(), '尾部 3 条: 字段精简白名单').toEqual([
      'action',
      'gateExitCode',
      'outcome',
      'phase',
      'role',
      'runId',
      'timestamp',
    ]);

    // 态 2：不足 3 条与空列表
    const r1 = buildStatusReport({ status: '编码' }, null, [{ runId: 'a' }]);
    expect(r1.recentActions, '不足 3 条: 长度 1').toHaveLength(1);
    const r2 = buildStatusReport({ status: '编码' }, null, []);
    expect(r2.recentActions, '空列表: recentActions 为空').toEqual([]);
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

// ==================== A14b：「项目完成」常数单一来源（43.1.0） ====================
describe('A14b：「项目完成」常数单一来源（lib/constants 导出，两消费点相等）', () => {
  it('A14b：「项目完成」常数单一来源（lib/constants 导出，两消费点相等）', () => {
    // 常数单点：终态名与 9 态序全部由 lib/constants 导出
    expect(PROJECT_STATUS_COMPLETED).toBe('项目完成');
    expect([...PROJECT_STATUSES]).toEqual([
      '需求分析',
      '系统设计',
      '概要设计',
      '详细设计',
      '编码',
      '集成测试',
      '系统测试',
      '验收测试',
      '项目完成',
    ]);

    // 消费点 1（STATUS_TO_PHASE）与消费点 2（NEXT_STEPS）键集与 PROJECT_STATUSES 逐一相等
    expect(Object.keys(STATUS_TO_PHASE)).toEqual([...PROJECT_STATUSES]);
    expect(Object.keys(NEXT_STEPS)).toEqual([...PROJECT_STATUSES]);
    expect(STATUS_TO_PHASE[PROJECT_STATUS_COMPLETED]).toBe(PROJECT_STATUS_TO_PHASE[PROJECT_STATUS_COMPLETED].phase);

    // 8/9 双口径统一：机器 phase=9，展示口径收敛 8（displayPhase/completedPhases 单点承载）
    expect(PROJECT_STATUS_TO_PHASE[PROJECT_STATUS_COMPLETED]).toEqual({
      phase: 9,
      displayPhase: 8,
      completedPhases: 8,
    });
    const r = buildStatusReport({ status: PROJECT_STATUS_COMPLETED, updatedAt: '2026-10-07T00:00:00Z' });
    expect(r.phase).toBe(PROJECT_STATUS_TO_PHASE[PROJECT_STATUS_COMPLETED].displayPhase);
    expect(r.completedPhases).toBe(PROJECT_STATUS_TO_PHASE[PROJECT_STATUS_COMPLETED].completedPhases);
    expect(r.progress).toBe('8/8（100%）');
  });
});
