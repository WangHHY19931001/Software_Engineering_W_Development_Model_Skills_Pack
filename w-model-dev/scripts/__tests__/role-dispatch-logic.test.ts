import { describe, it, expect } from 'vitest';

import { checkRoleDispatch } from '../logic/role-dispatch-logic.js';

/**
 * role-dispatch-logic.ts 单元测试 —— 第29轮 R3 无条件强制
 *
 * 覆盖：
 *   - R≥3 无条件（不再需要 r3Enabled flag）
 *   - S/V/G 各 ≥1 仍强制
 *   - phaseSummary 结构
 */
describe('role-dispatch-logic: R≥3 无条件（第29轮）', () => {
  it('缺 R3 记录应失败（不再需要 r3Enabled flag）', () => {
    const entries = [
      { phase: 1, role: 'S', action: 'produce', outcome: 'success' },
      { phase: 1, role: 'V', action: 'review', outcome: 'success' },
      { phase: 1, role: 'G', action: 'gate', outcome: 'success' },
      // 仅 1 条 R3，缺 reliability/security
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => /缺失 role=R/.test(v))).toBe(true);
  });

  it('S/V/G/R≥3 齐全应通过', () => {
    const entries = [
      { phase: 1, role: 'S', action: 'produce', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-reliability', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-security', outcome: 'success' },
      { phase: 1, role: 'V', action: 'review', outcome: 'success' },
      { phase: 1, role: 'G', action: 'gate', outcome: 'success' },
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it('缺 V 角色应失败', () => {
    const entries = [
      { phase: 1, role: 'S', action: 'produce', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-reliability', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-security', outcome: 'success' },
      { phase: 1, role: 'G', action: 'gate', outcome: 'success' },
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => /缺失 role=V/.test(v))).toBe(true);
  });

  it('缺 S 角色应失败', () => {
    const entries = [
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-reliability', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-security', outcome: 'success' },
      { phase: 1, role: 'V', action: 'review', outcome: 'success' },
      { phase: 1, role: 'G', action: 'gate', outcome: 'success' },
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => /缺失 role=S/.test(v))).toBe(true);
  });

  it('缺 G 角色应失败', () => {
    const entries = [
      { phase: 1, role: 'S', action: 'produce', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-reliability', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-security', outcome: 'success' },
      { phase: 1, role: 'V', action: 'review', outcome: 'success' },
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => /缺失 role=G/.test(v))).toBe(true);
  });

  it('R3 记录多于 3 条应通过', () => {
    const entries = [
      { phase: 1, role: 'S', action: 'produce', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-reliability', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-security', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' }, // 返工再审
      { phase: 1, role: 'V', action: 'review', outcome: 'success' },
      { phase: 1, role: 'G', action: 'gate', outcome: 'success' },
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(true);
  });

  it('多阶段：阶段2缺R应只报阶段2', () => {
    const entries = [
      { phase: 1, role: 'S', action: 'produce', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-reliability', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-security', outcome: 'success' },
      { phase: 1, role: 'V', action: 'review', outcome: 'success' },
      { phase: 1, role: 'G', action: 'gate', outcome: 'success' },
      // 阶段 2 缺 R
      { phase: 2, role: 'S', action: 'produce', outcome: 'success' },
      { phase: 2, role: 'V', action: 'review', outcome: 'success' },
      { phase: 2, role: 'G', action: 'gate', outcome: 'success' },
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => /阶段 2.*缺失 role=R/.test(v))).toBe(true);
    expect(r.violations.some((v) => /阶段 1.*缺失 role=R/.test(v))).toBe(false);
  });

  it('非法/缺字段条目应被跳过不崩溃', () => {
    const entries = [
      { phase: 1, role: 'S', action: 'produce', outcome: 'success' },
      null as unknown as Record<string, unknown>,
      { role: 'R' }, // 缺 phase
      { phase: 'x' }, // 非法 phase
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-reliability', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-security', outcome: 'success' },
      { phase: 1, role: 'V', action: 'review', outcome: 'success' },
      { phase: 1, role: 'G', action: 'gate', outcome: 'success' },
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(true);
  });

  it('phaseSummary 含 roles 计数与 missing 列表', () => {
    const entries = [
      { phase: 1, role: 'S', action: 'produce', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
      // 缺 reliability/security + V + G
    ];
    const r = checkRoleDispatch(entries);
    expect(r.phaseSummary).toHaveLength(1);
    expect(r.phaseSummary[0]!.phase).toBe(1);
    expect(r.phaseSummary[0]!.roles.S).toBe(1);
    expect(r.phaseSummary[0]!.roles.R).toBe(1);
    expect(r.phaseSummary[0]!.missing).toContain('V');
    expect(r.phaseSummary[0]!.missing).toContain('G');
    expect(r.phaseSummary[0]!.missing).toContain('R');
  });
});
