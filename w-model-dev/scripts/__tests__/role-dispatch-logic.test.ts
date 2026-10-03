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
      { phase: 1, role: 'S', action: 'test', outcome: 'success' },
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
      { phase: 1, role: 'S', action: 'test', outcome: 'success' },
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

  it('缺角色族（3 态：缺 V / 缺 S / 缺 G）应失败且具名缺失角色', () => {
    const base: RoleDispatchEntry[] = [
      { phase: 1, role: 'S', action: 'test', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-reliability', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-security', outcome: 'success' },
      { phase: 1, role: 'V', action: 'review', outcome: 'success' },
      { phase: 1, role: 'G', action: 'gate', outcome: 'success' },
    ];
    for (const missingRole of ['V', 'S', 'G'] as const) {
      const entries = base.filter((entry) => entry.role !== missingRole);
      const r = checkRoleDispatch(entries);
      expect(r.passed, `缺 ${missingRole}: 应失败`).toBe(false);
      expect(
        // eslint-disable-next-line security/detect-non-literal-regexp -- missingRole 为用例内字面量常量（'V'|'S'|'G'），聚合用例常量表驱动 RegExp，模式非用户输入
        r.violations.some((v) => new RegExp(`缺失 role=${missingRole}`).test(v)),
        `缺 ${missingRole}: 应具名缺失角色`,
      ).toBe(true);
    }
  });

  it('R3 记录多于 3 条应通过', () => {
    const entries = [
      { phase: 1, role: 'S', action: 'test', outcome: 'success' },
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
      { phase: 1, role: 'S', action: 'test', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-reliability', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-security', outcome: 'success' },
      { phase: 1, role: 'V', action: 'review', outcome: 'success' },
      { phase: 1, role: 'G', action: 'gate', outcome: 'success' },
      // 阶段 2 缺 R
      { phase: 2, role: 'S', action: 'test', outcome: 'success' },
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
      { phase: 1, role: 'S', action: 'test', outcome: 'success' },
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
      { phase: 1, role: 'S', action: 'test', outcome: 'success' },
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
  // S 记录 action 用 'test'（S 类合法动作）：本文件夹具多为阶段 1-2，若用 'produce'
  // 会误触阶段 1-4 多角色三新维度的 produce 触发判据（role-dispatch 只校验角色计数，
  // action 对本门为装饰值；produce 触发域的行为由「阶段 1-4 多角色三新维度」describe 专测）。
  const svg = (phase: number, role: 'S' | 'V' | 'G') => ({
    phase,
    role,
    action: role === 'S' ? 'test' : role === 'V' ? 'review' : 'gate',
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

  it('R3 不计入族（4 态：rootcause×3 / 重复单维 / outcome=fail·blocked / 非 R3 action）→ 失败且指明缺失维度', () => {
    const svg = (phase: number, role: 'S' | 'V' | 'G'): RoleDispatchEntry => ({
      phase,
      role,
      action: role === 'S' ? 'test' : role === 'V' ? 'review' : 'gate',
      outcome: 'success',
    });
    for (const { caseName, r3Entries, missingMessage, expectUnderflowMessage, expectR3Missing, expectRolesR } of [
      {
        caseName: 'role=R 但 action=rootcause×3 不计入 R3',
        r3Entries: [
          { phase: 1, role: 'R', action: 'rootcause', outcome: 'success' },
          { phase: 1, role: 'R', action: 'rootcause', outcome: 'success' },
          { phase: 1, role: 'R', action: 'rootcause', outcome: 'success' },
        ],
        missingMessage: /缺：completeness\/reliability\/security/,
        expectUnderflowMessage: true,
        expectR3Missing: [{ phase: 1, missingDimensions: ['completeness', 'reliability', 'security'] }],
        expectRolesR: 3,
      },
      {
        caseName: '重复单维 r3-completeness×3 缺 reliability/security',
        r3Entries: [
          { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
          { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
          { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
        ],
        missingMessage: /缺：reliability\/security/,
        expectUnderflowMessage: false,
        expectR3Missing: [{ phase: 1, missingDimensions: ['reliability', 'security'] }],
        expectRolesR: undefined,
      },
      {
        caseName: 'R3 outcome=fail/blocked 不计入（三维度全缺）',
        r3Entries: [
          { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'fail' },
          { phase: 1, role: 'R', action: 'r3-reliability', outcome: 'blocked' },
          { phase: 1, role: 'R', action: 'r3-security', outcome: 'fail' },
        ],
        missingMessage: /缺：completeness\/reliability\/security/,
        expectUnderflowMessage: false,
        expectR3Missing: undefined,
        expectRolesR: undefined,
      },
      {
        caseName: '非 R3 action（iceberg-sweep 等 role=R success）不计入',
        r3Entries: [
          { phase: 1, role: 'R', action: 'iceberg-sweep', outcome: 'success' },
          { phase: 1, role: 'R', action: 'iceberg-sweep', outcome: 'success' },
          { phase: 1, role: 'R', action: 'iceberg-sweep', outcome: 'success' },
        ],
        missingMessage: /缺：completeness\/reliability\/security/,
        expectUnderflowMessage: false,
        expectR3Missing: undefined,
        expectRolesR: undefined,
      },
    ]) {
      const entries: RoleDispatchEntry[] = [svg(1, 'S'), svg(1, 'V'), svg(1, 'G'), ...r3Entries];
      const r = checkRoleDispatch(entries);
      expect(r.passed, `${caseName}: 应失败`).toBe(false);
      expect(r.violations.join(' '), `${caseName}: 应指明缺失维度`).toMatch(missingMessage);
      if (expectUnderflowMessage) {
        expect(r.violations.join(' '), `${caseName}: 应为「有效 R3 维度记录不足」措辞`).toMatch(/有效 R3 维度记录不足/);
      }
      if (expectR3Missing !== undefined) {
        expect(r.r3Missing, `${caseName}: r3Missing 应精确`).toEqual(expectR3Missing);
      }
      if (expectRolesR !== undefined) {
        expect(r.phaseSummary[0]!.roles.R, `${caseName}: roles.R 计数保留全部 role=R 记录`).toBe(expectRolesR);
      }
    }
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

/**
 * 阶段 1-4 多角色讨论分析机制三新维度（task 3，TDD）：
 *   ① 覆盖——action=perspective 且 persona 非空集合 ⊇ 阶段角色集矩阵 persona 集
 *     （矩阵常量权威 = agent-personas.md「3A. 阶段角色集矩阵」节，6/7/7）；
 *     lite 形态（consensus 记录 note/纪要路径含 phase-role-lite）按实际分派 N 通过。
 *   ② 时序——本阶段 action=produce 时间戳须严格晚于全部 perspective 记录（同秒不算晚）。
 *   ③ 互异——同阶段 persona 重复违规。
 * 触发判据：仅当阶段 1-4 存在 action=produce 记录（无 produce 的历史 run 零回归）。
 * 结果字段 phaseRoleCoverage 经 CLI stdout JSON 同键透出。
 */
describe('role-dispatch-logic: 阶段 1-4 多角色三新维度（覆盖/时序/互异）', () => {
  /** 与 agent-personas.md「3A. 阶段角色集矩阵」节 persona 映射列逐字一致（6/7/7） */
  const PHASE1_MATRIX = [
    'product-requirements-analyst',
    'product-manager',
    'testing-test-manager',
    'engineering-software-architect',
    'design-ux-architect',
    'engineering-algorithm-expert',
  ];
  const PHASE2_MATRIX = [
    'testing-test-manager',
    'engineering-software-architect',
    'engineering-senior-developer',
    'product-manager',
    'engineering-database-optimizer',
    'design-ux-architect',
    'engineering-algorithm-expert',
  ];

  let seq = 0;
  const entry = (
    phase: number,
    action: string,
    role: string,
    timestamp: string,
    extra: Record<string, unknown> = {},
  ): RoleDispatchEntry => ({
    runId: `mr-${++seq}`,
    phase,
    role,
    action,
    outcome: 'success',
    timestamp,
    ...extra,
  });

  /** 阶段全矩阵多角色记录：N 条 perspective（01:00 起每 persona 1 分钟）+ 1 条 consensus */
  const perspectiveRecords = (phase: number, personas: string[], consensusExtra: Record<string, unknown> = {}) => [
    ...personas.map((persona, i) =>
      entry(phase, 'perspective', 'A', `2026-10-03T01:${String(i).padStart(2, '0')}:00Z`, { persona }),
    ),
    entry(phase, 'consensus', 'A', '2026-10-03T02:00:00Z', {
      persona: 'A-lead',
      note: '共识纪要 consensus-minutes.md（交叉 2 轮收敛）',
      ...consensusExtra,
    }),
  ];

  /** 既有四角色基线（S/V/G + R3 三维度；S 用 action=test 避免误触 produce 判据） */
  const roleBaseline = (phase: number) => [
    entry(phase, 'test', 'S', '2026-10-03T05:00:00Z'),
    entry(phase, 'review', 'V', '2026-10-03T06:00:00Z'),
    entry(phase, 'gate', 'G', '2026-10-03T07:00:00Z'),
    entry(phase, 'r3-completeness', 'R', '2026-10-03T06:30:00Z'),
    entry(phase, 'r3-reliability', 'R', '2026-10-03T06:31:00Z'),
    entry(phase, 'r3-security', 'R', '2026-10-03T06:32:00Z'),
  ];

  it('表驱动：valid 全矩阵 / 缺 persona / 时序倒置 / 同秒不算晚 / persona 重复 / lite 降级通过 / lite 零 perspective 失败', () => {
    const cases: {
      label: string;
      entries: RoleDispatchEntry[];
      expectPassed: boolean;
      expectCoverage: Array<{
        phase: number;
        missingPersonas: string[];
        timingViolations: number;
        duplicatePersonas: string[];
      }>;
      violationPattern?: RegExp;
    }[] = [
      {
        label: 'valid 全矩阵（阶段 1+2 双阶段，produce 晚于全部 perspective）→ 通过',
        entries: [
          ...perspectiveRecords(1, PHASE1_MATRIX),
          entry(1, 'produce', 'S', '2026-10-03T03:00:00Z'),
          ...roleBaseline(1),
          ...perspectiveRecords(2, PHASE2_MATRIX),
          entry(2, 'produce', 'S', '2026-10-03T03:30:00Z'),
          ...roleBaseline(2),
        ],
        expectPassed: true,
        expectCoverage: [
          {
            phase: 1,
            missingPersonas: [],
            timingViolations: 0,
            duplicatePersonas: [],
          },
          {
            phase: 2,
            missingPersonas: [],
            timingViolations: 0,
            duplicatePersonas: [],
          },
        ],
      },
      {
        label: '缺 persona（阶段 1 少 engineering-algorithm-expert 一条 perspective）→ missingPersonas 具名',
        entries: [
          ...perspectiveRecords(
            1,
            PHASE1_MATRIX.filter((p) => p !== 'engineering-algorithm-expert'),
          ),
          entry(1, 'produce', 'S', '2026-10-03T03:00:00Z'),
          ...roleBaseline(1),
        ],
        expectPassed: false,
        expectCoverage: [
          {
            phase: 1,
            missingPersonas: ['engineering-algorithm-expert'],
            timingViolations: 0,
            duplicatePersonas: [],
          },
        ],
        violationPattern: /阶段 1 多角色覆盖不足：缺 persona=engineering-algorithm-expert/,
      },
      {
        label: '时序倒置（perspective 晚于 produce）→ timingViolations=1',
        entries: [
          // design-ux-architect 唯一记录放在 produce 之后：隔离时序维度（不引入 persona 重复/缺失）
          ...perspectiveRecords(
            1,
            PHASE1_MATRIX.filter((p) => p !== 'design-ux-architect'),
          ),
          entry(1, 'produce', 'S', '2026-10-03T03:00:00Z'),
          entry(1, 'perspective', 'A', '2026-10-03T04:00:00Z', {
            persona: 'design-ux-architect',
            runId: 'mr-late',
          }),
          ...roleBaseline(1),
        ],
        expectPassed: false,
        expectCoverage: [
          {
            phase: 1,
            missingPersonas: [],
            timingViolations: 1,
            duplicatePersonas: [],
          },
        ],
        violationPattern: /阶段 1 多角色时序违规：produce 记录 runId=.*未严格晚于全部 perspective 记录（同秒不算晚）/,
      },
      {
        label: '同秒不算晚（perspective 与 produce 同时间戳）→ timingViolations=1',
        entries: [
          // product-manager 唯一记录与 produce 同秒：隔离时序严格性（不引入 persona 重复/缺失）
          ...perspectiveRecords(
            1,
            PHASE1_MATRIX.filter((p) => p !== 'product-manager'),
          ),
          entry(1, 'produce', 'S', '2026-10-03T03:00:00Z'),
          entry(1, 'perspective', 'A', '2026-10-03T03:00:00Z', {
            persona: 'product-manager',
            runId: 'mr-same-sec',
          }),
          ...roleBaseline(1),
        ],
        expectPassed: false,
        expectCoverage: [
          {
            phase: 1,
            missingPersonas: [],
            timingViolations: 1,
            duplicatePersonas: [],
          },
        ],
      },
      {
        label: 'persona 重复（product-manager 两条 perspective）→ duplicatePersonas 具名',
        entries: [
          ...perspectiveRecords(1, PHASE1_MATRIX),
          entry(1, 'perspective', 'A', '2026-10-03T01:30:00Z', {
            persona: 'product-manager',
            runId: 'mr-dup',
          }),
          entry(1, 'produce', 'S', '2026-10-03T03:00:00Z'),
          ...roleBaseline(1),
        ],
        expectPassed: false,
        expectCoverage: [
          {
            phase: 1,
            missingPersonas: [],
            timingViolations: 0,
            duplicatePersonas: ['product-manager'],
          },
        ],
        violationPattern: /阶段 1 多角色 persona 重复：product-manager/,
      },
      {
        label: 'lite 降级（consensus note 含 phase-role-lite + 实际 2 persona）→ 按实际 N 通过',
        entries: [
          entry(1, 'perspective', 'A', '2026-10-03T01:00:00Z', {
            persona: 'product-requirements-analyst',
          }),
          entry(1, 'perspective', 'A', '2026-10-03T01:01:00Z', {
            persona: 'product-manager',
          }),
          entry(1, 'consensus', 'A', '2026-10-03T02:00:00Z', {
            persona: 'A-lead',
            note: '共识纪要（lite 降级 phase-role-lite：L0 成熟度单视角）',
          }),
          entry(1, 'produce', 'S', '2026-10-03T03:00:00Z'),
          ...roleBaseline(1),
        ],
        expectPassed: true,
        expectCoverage: [
          {
            phase: 1,
            missingPersonas: [],
            timingViolations: 0,
            duplicatePersonas: [],
          },
        ],
      },
      {
        label: 'lite 降级但零 perspective（consensus 标 lite 却无任何 persona 留痕）→ missingPersonas=全矩阵',
        entries: [
          entry(1, 'consensus', 'A', '2026-10-03T02:00:00Z', {
            note: '共识纪要（phase-role-lite）',
          }),
          entry(1, 'produce', 'S', '2026-10-03T03:00:00Z'),
          ...roleBaseline(1),
        ],
        expectPassed: false,
        expectCoverage: [
          {
            phase: 1,
            missingPersonas: [...PHASE1_MATRIX],
            timingViolations: 0,
            duplicatePersonas: [],
          },
        ],
        violationPattern: /阶段 1 多角色覆盖不足：缺 persona=product-requirements-analyst/,
      },
    ];
    for (const c of cases) {
      const r = checkRoleDispatch(c.entries);
      expect(r.passed, `${c.label}: passed`).toBe(c.expectPassed);
      expect(r.phaseRoleCoverage, `${c.label}: phaseRoleCoverage`).toEqual(c.expectCoverage);
      if (c.violationPattern) {
        expect(r.violations.join(' '), `${c.label}: violation 消息`).toMatch(c.violationPattern);
      }
    }
  });

  it('阶段 5-8 produce 记录不触发新维度（零回归：phaseRoleCoverage 不含该阶段）', () => {
    const entries = [
      entry(5, 'produce', 'S', '2026-10-03T03:00:00Z'),
      entry(5, 'review', 'V', '2026-10-03T04:00:00Z'),
      entry(5, 'gate', 'G', '2026-10-03T05:00:00Z'),
      entry(5, 'r3-completeness', 'R', '2026-10-03T04:30:00Z'),
      entry(5, 'r3-reliability', 'R', '2026-10-03T04:31:00Z'),
      entry(5, 'r3-security', 'R', '2026-10-03T04:32:00Z'),
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(true);
    expect(r.phaseRoleCoverage).toEqual([]);
  });

  it('无 produce 的阶段 1-4（历史 run 纯 chunk/cross 形态）不触发新维度（零回归）', () => {
    const entries = [
      entry(1, 'chunk', 'A', '2026-10-03T01:00:00Z'),
      entry(1, 'cross', 'S', '2026-10-03T02:00:00Z'),
      entry(1, 'test', 'S', '2026-10-03T05:00:00Z'),
      entry(1, 'review', 'V', '2026-10-03T06:00:00Z'),
      entry(1, 'gate', 'G', '2026-10-03T07:00:00Z'),
      entry(1, 'r3-completeness', 'R', '2026-10-03T06:30:00Z'),
      entry(1, 'r3-reliability', 'R', '2026-10-03T06:31:00Z'),
      entry(1, 'r3-security', 'R', '2026-10-03T06:32:00Z'),
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(true);
    expect(r.phaseRoleCoverage).toEqual([]);
  });

  it('persona 字段误用（非 perspective/consensus 记录携带非空 persona）→ violation（schema description「其他 action 不得出现」）', () => {
    const entries = [
      entry(5, 'produce', 'S', '2026-10-03T03:00:00Z', {
        persona: 'product-manager',
      }),
      entry(5, 'review', 'V', '2026-10-03T04:00:00Z'),
      entry(5, 'gate', 'G', '2026-10-03T05:00:00Z'),
      entry(5, 'r3-completeness', 'R', '2026-10-03T04:30:00Z'),
      entry(5, 'r3-reliability', 'R', '2026-10-03T04:31:00Z'),
      entry(5, 'r3-security', 'R', '2026-10-03T04:32:00Z'),
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(false);
    expect(r.violations.join(' ')).toMatch(/persona 字段误用：条目 runId=.*action=produce 不得携带 persona/);
    expect(r.phaseRoleCoverage).toEqual([]);
  });

  it('空输入 fail-closed 既有行为不回归（phaseRoleCoverage=[]）', () => {
    const r = checkRoleDispatch([]);
    expect(r.passed).toBe(false);
    expect(r.phaseRoleCoverage).toEqual([]);
    expect(r.violations.join(' ')).toMatch(/无任何可校验阶段/);
  });
});
