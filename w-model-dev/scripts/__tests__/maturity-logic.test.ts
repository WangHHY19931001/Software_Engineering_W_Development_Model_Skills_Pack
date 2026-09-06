/**
 * maturity-logic.test.ts —— 成熟度校验（R1-R5）单元测试
 *
 * 覆盖 maturity-logic.ts 中 checkMaturity 函数：
 *   - 合法 MaturityConfig 通过
 *   - schema 前置校验（缺 required 字段 → [schema] 违规，防反模式 #28）
 *   - R3 completedCycles 与 completedPhases 周期换算
 *   - R4 history / leveledUpAt 早于 project.createdAt
 *   - R5 O 系列失败模式命中达 streak 阈值 → 降级评估提醒
 */

import { describe, expect, it } from 'vitest';

import { checkMaturity, type MaturityConfig } from '../logic/maturity-logic.js';

function validMaturity(): MaturityConfig {
  return {
    schemaVersion: '1.0',
    projectId: 'test-project',
    level: 'L1',
    leveledUpAt: '2026-08-01T00:00:00Z',
    unlockConditions: {
      stableDays: 30,
      completedCycles: 3,
      attemptCapRate: 0.85,
      misjudgeRate: 0.05,
      operationalFailures: 0,
    },
    history: [{ from: 'L0', to: 'L1', at: '2026-08-01T00:00:00Z', reason: '稳定运行 1 完整周期' }],
    downgradeTriggers: { operationalFailureStreak: 3, userRequested: false },
  };
}

describe('checkMaturity', () => {
  it('合法 MaturityConfig → passed=true 且零违规', () => {
    const r = checkMaturity(validMaturity());
    expect(r.passed).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it('schema 前置校验：缺 projectId → [schema] 违规（防反模式 #28）', () => {
    const rest = { ...validMaturity() } as Record<string, unknown>;
    delete rest['projectId'];
    const r = checkMaturity(rest);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.startsWith('[schema]'))).toBe(true);
  });

  it('R3：completedPhases=16（2 完整周期）但 completedCycles=1 → 未更新违规', () => {
    const m = validMaturity();
    m.unlockConditions.completedCycles = 1;
    const r = checkMaturity(m, { completedPhases: 16 });
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('R3') && v.includes('completedCycles'))).toBe(true);
  });

  it('R4：history 条目早于 project.createdAt → 时序违规', () => {
    const r = checkMaturity(validMaturity(), { projectCreatedAt: '2026-08-15T00:00:00Z' });
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('R4') && v.includes('project.createdAt'))).toBe(true);
  });

  it('R5：O 系列失败模式命中达 streak 阈值 → 降级评估违规', () => {
    const r = checkMaturity(validMaturity(), { operationalFailureCount: 3 });
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('R5') && v.includes('降级评估'))).toBe(true);
  });
});

/**
 * 可见性与死分支清理（F-G2-04/05，audit-fixes task 5）：
 *   - R3 依赖可选 --project context（completedPhases），缺失时降级为非阻断 warning，不再静默
 *   - R1 死分支删除：schema required 前置拦截缺失字段，逻辑层不再重复报「schema 不完整」
 */
describe('checkMaturity 可见性与死分支清理', () => {
  it('R3 context 缺失（未提供 completedPhases）→ 非阻断 warning（F-G2-04）', () => {
    const r = checkMaturity(validMaturity());
    expect(r.passed).toBe(true);
    expect(r.warnings).toEqual(['R3 未校验：未提供 --project']);
  });

  it('R3 context 提供时无 warning', () => {
    const r = checkMaturity(validMaturity(), { completedPhases: 8 });
    expect(r.warnings).toHaveLength(0);
    expect(r.passed).toBe(true);
  });

  it('R1 死分支已删除：缺 level 由 schema required 前置拦截 → [schema]（F-G2-05）', () => {
    const m = validMaturity() as unknown as Record<string, unknown>;
    delete m['level'];
    const r = checkMaturity(m);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.startsWith('[schema]'))).toBe(true);
  });
});
