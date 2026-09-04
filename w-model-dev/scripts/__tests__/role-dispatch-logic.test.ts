import { describe, it, expect } from 'vitest';

import { checkRoleDispatch, type RoleDispatchEntry } from '../logic/role-dispatch-logic.js';

/**
 * role-dispatch-logic.ts 单元测试 —— R3 无条件强制
 *
 * 覆盖：
 *   - R≥3 无条件（不再需要 r3Enabled flag）
 *   - S/V/G 各 ≥1 仍强制
 *   - phaseSummary 结构
 */
describe('role-dispatch-logic: R≥3 无条件', () => {
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
    // 已有 role=R 记录（r3-completeness）但维度不齐：不得报「缺失 role=R 记录」，须报维度不足
    expect(r.violations.some((v) => /有效 R3 维度记录不足/.test(v))).toBe(true);
    expect(r.violations.join(' ')).toMatch(/当前缺：reliability\/security/);
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

/**
 * 审计修复（audit-gate-closure task 3）：空输入 fail-closed + R3 维度精确语义。
 *
 * 覆盖：
 *   - 空数组 / 全无效条目（phaseMap 空）→ blocking，phaseSummary=[]
 *   - R3 只计 role=R + outcome=success + r3-* action，三维度各 ≥1；
 *     rootcause/iceberg-sweep/非 success/非 R3 action 一律不计入
 *   - 缺失维度消息指明具体维度；r3Missing 结构
 *   - 重复维度作为真实重工记录不报错（三维度各 ≥1 即通过）
 */
describe('role-dispatch-logic: 空输入 fail-closed 与 R3 维度精确语义', () => {
  const svg = (phase: number, role: 'S' | 'V' | 'G') => ({
    phase,
    role,
    action: role === 'S' ? 'produce' : role === 'V' ? 'review' : 'gate',
    outcome: 'success',
  });

  it('空数组 → blocking（fail-closed），phaseSummary 为空', () => {
    const r = checkRoleDispatch([]);
    expect(r.passed).toBe(false);
    expect(r.phaseSummary).toHaveLength(0);
    expect(r.violations.join(' ')).toMatch(/无任何可校验阶段/);
  });

  it('全部条目缺 phase/role（无任何可校验阶段）→ blocking（fail-closed）', () => {
    const entries: RoleDispatchEntry[] = [
      null as unknown as RoleDispatchEntry,
      { action: 'produce', outcome: 'success' } as unknown as RoleDispatchEntry,
      { phase: 'x', role: 'S' } as unknown as RoleDispatchEntry, // 非法 phase
      { phase: 1, outcome: 'success' } as RoleDispatchEntry, // 缺 role
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(false);
    expect(r.phaseSummary).toHaveLength(0);
    expect(r.violations.join(' ')).toMatch(/无任何可校验阶段/);
  });

  it('role=R 但 action=rootcause×3 不计入 R3 → 失败且消息指明三维度缺失', () => {
    const entries = [
      svg(1, 'S'),
      svg(1, 'V'),
      svg(1, 'G'),
      { phase: 1, role: 'R', action: 'rootcause', outcome: 'success' },
      { phase: 1, role: 'R', action: 'rootcause', outcome: 'success' },
      { phase: 1, role: 'R', action: 'rootcause', outcome: 'success' },
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(false);
    // R 记录存在（rootcause×3）但三维度未齐：消息须为维度不足表述，不再与 phaseSummary R=3 并存误导
    expect(r.violations.join(' ')).toMatch(/有效 R3 维度记录不足/);
    expect(r.violations.join(' ')).toMatch(/缺：completeness\/reliability\/security/);
    expect(r.r3Missing).toEqual([{ phase: 1, missingDimensions: ['completeness', 'reliability', 'security'] }]);
    // roles 计数保留全部 role=R 记录（含 rootcause）
    expect(r.phaseSummary[0]!.roles.R).toBe(3);
  });

  it('重复单维（r3-completeness×3）缺 reliability/security → 失败且指明缺失维度', () => {
    const entries = [
      svg(1, 'S'),
      svg(1, 'V'),
      svg(1, 'G'),
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(false);
    expect(r.violations.join(' ')).toMatch(/缺：reliability\/security/);
    expect(r.r3Missing).toEqual([{ phase: 1, missingDimensions: ['reliability', 'security'] }]);
  });

  it('R3 outcome=fail/blocked 不计入 → 失败（三维度全缺）', () => {
    const entries = [
      svg(1, 'S'),
      svg(1, 'V'),
      svg(1, 'G'),
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'fail' },
      { phase: 1, role: 'R', action: 'r3-reliability', outcome: 'blocked' },
      { phase: 1, role: 'R', action: 'r3-security', outcome: 'fail' },
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(false);
    expect(r.violations.join(' ')).toMatch(/缺：completeness\/reliability\/security/);
  });

  it('非 R3 action（iceberg-sweep 等 role=R success）不计入 R3 → 失败', () => {
    const entries = [
      svg(1, 'S'),
      svg(1, 'V'),
      svg(1, 'G'),
      { phase: 1, role: 'R', action: 'iceberg-sweep', outcome: 'success' },
      { phase: 1, role: 'R', action: 'iceberg-sweep', outcome: 'success' },
      { phase: 1, role: 'R', action: 'iceberg-sweep', outcome: 'success' },
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(false);
    expect(r.violations.join(' ')).toMatch(/缺：completeness\/reliability\/security/);
  });

  it('三维度各 1 条 success（含重复维度重工记录）→ 通过且无 r3Missing', () => {
    const entries = [
      svg(1, 'S'),
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' }, // 返工再审（重复维度）
      { phase: 1, role: 'R', action: 'r3-reliability', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-security', outcome: 'success' },
      svg(1, 'V'),
      svg(1, 'G'),
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(true);
    expect(r.violations).toHaveLength(0);
    expect(r.r3Missing).toEqual([]);
  });

  it('rootcause/iceberg 等 role=R 非 R3 记录可与合法三维度共存 → 通过', () => {
    const entries = [
      svg(1, 'S'),
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-reliability', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-security', outcome: 'success' },
      { phase: 1, role: 'R', action: 'rootcause', outcome: 'success' }, // 真实 R 定位，不充数也不干扰
      svg(1, 'V'),
      svg(1, 'G'),
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(true);
    expect(r.phaseSummary[0]!.roles.R).toBe(4);
  });

  it('多阶段：r3Missing 只列缺失维度的 phase，完整 phase 不出现', () => {
    const entries = [
      svg(1, 'S'),
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' }, // 阶段1缺 reliability/security
      svg(1, 'V'),
      svg(1, 'G'),
      svg(2, 'S'),
      { phase: 2, role: 'R', action: 'r3-completeness', outcome: 'success' },
      { phase: 2, role: 'R', action: 'r3-reliability', outcome: 'success' },
      { phase: 2, role: 'R', action: 'r3-security', outcome: 'success' },
      svg(2, 'V'),
      svg(2, 'G'),
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(false);
    expect(r.r3Missing).toEqual([{ phase: 1, missingDimensions: ['reliability', 'security'] }]);
    expect(r.phaseSummary[1]!.missing).not.toContain('R');
    expect(r.phaseSummary[1]!.roles.R).toBe(3);
  });

  it('维度不足消息为「有效 R3 维度记录不足」措辞并含缺失维度明细（供 CLI 直接展示）', () => {
    const entries = [
      svg(1, 'S'),
      svg(1, 'V'),
      svg(1, 'G'),
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
    ];
    const r = checkRoleDispatch(entries);
    expect(r.violations.join(' ')).toMatch(/阶段 1 有效 R3 维度记录不足/);
    expect(r.violations.join(' ')).toMatch(
      /须 role=R 且 outcome=success 的 r3-completeness\/r3-reliability\/r3-security 各 ≥1，当前缺：reliability\/security/,
    );
  });

  it('R 总数 0（无任何 role=R 记录）时保留「缺失 role=R 记录」消息', () => {
    const entries = [svg(1, 'S'), svg(1, 'V'), svg(1, 'G')];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(false);
    expect(r.violations.join(' ')).toMatch(/阶段 1 缺失 role=R 记录/);
    expect(r.violations.join(' ')).not.toMatch(/有效 R3 维度记录不足/);
  });
});
