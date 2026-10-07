/**
 * tla-logic.ts 单元测试 —— TLA+ 模型校验纯逻辑
 *
 * 覆盖：
 *   - P1.1 manifest.basePath 强制字段校验
 *     - 缺失 → 报缺失
 *     - 存在 → 不报缺失
 *     - 空字符串 → 报缺失
 *     - 非字符串 → 报缺失
 *   - P1.2 SD 覆盖率 spec 方向校验（全规格强制，无例外）
 *     - spec 缺 requirementIds（空数组）→ violation
 *     - spec requirementIds 无 SD-xxx 标识 → violation
 *     - spec requirementIds 含 SD-xxx → 通过 spec 方向
 *     - L1/L2/L3/L4 全规格无例外
 */

import { describe, expect, it } from 'vitest';

import {
  checkTlaModel,
  checkCoverage,
  checkCfgInvariantsConsistency,
  checkCfgStructure,
  checkBusinessInvariants,
  checkIdleNext,
  checkHierarchy,
  checkDecomposition,
  extractTlaDefBody,
  parseCfgInvariantNames,
  parseCfgNextNames,
  validateHeader,
  type TlaSpec,
} from '../logic/tla-logic.js';

// ==================== 辅助构造函数 ====================

/**
 * 构造一份结构合规的 manifest（不含 basePath）。
 * P1.1 之前这是合法 manifest；P1.1 之后缺 basePath 应被判失败。
 *
 * 层次结构：L1-system（L1 根）→ L2-auth（L2 子），父子双向一致，层级单调。
 * 所有 SANY/TLC 声明标志均为通过，故纯逻辑校验仅 basePath 缺失会致失败。
 */
function makeValidManifestWithoutBasePath(): unknown {
  return {
    version: 1,
    currentPhase: 2,
    tools: { jarPath: 'tools/tla2tools.jar', javaMinVersion: 11 },
    specs: [
      {
        id: 'L1-system',
        level: 'L1',
        phase: 1,
        system: 'sample-system',
        requirementIds: ['REQ-001'],
        designRef: 'docs/requirement-spec.md',
        tlaPath: 'tla/L1-system.tla',
        cfgPath: 'tla/L1-system.cfg',
        parent: null,
        siblings: [],
        children: ['tla/L2-auth.tla'],
        variableCombination: 240,
        decompositionDecision: 'kept-below-threshold',
        syntaxChecked: true,
        tlcChecked: true,
        deadlockFree: true,
        invariantsHold: true,
        stateExplosion: false,
      },
      {
        id: 'L2-auth',
        level: 'L2',
        phase: 2,
        system: 'sample-system::auth',
        requirementIds: ['REQ-001'],
        designRef: 'docs/system-design.md',
        tlaPath: 'tla/L2-auth.tla',
        cfgPath: 'tla/L2-auth.cfg',
        parent: 'tla/L1-system.tla',
        siblings: [],
        children: [],
        variableCombination: 80,
        decompositionDecision: 'kept-below-threshold',
        syntaxChecked: true,
        tlcChecked: true,
        deadlockFree: true,
        invariantsHold: true,
        stateExplosion: false,
      },
    ],
    checkRounds: [],
    sdCoverage: {
      totalSdNodes: 0,
      coveredSdNodes: [],
      uncoveredSdNodes: [],
      coverageRate: 1,
    },
  };
}

// ==================== P1.1 basePath 强制字段校验 ====================

describe('P1.1 manifest.basePath 强制字段校验', () => {
  it('basePath 违规行（3 态：缺失 / 空串 schema 前置 / 非字符串 schema 前置）', () => {
    for (const [场景, basePath, marker, assertPassedFalse] of [
      ['manifest 缺 basePath', undefined, /basePath 缺失/, true],
      ['basePath 空字符串（schema minLength:1 前置拦截，业务规则不再触达）', '', /\[schema\].*basePath/, false],
      ['basePath 非字符串（schema type:string 前置拦截，业务规则不再触达）', 123, /\[schema\].*basePath/, false],
    ] as const) {
      const m = makeValidManifestWithoutBasePath() as { basePath?: unknown };
      if (basePath !== undefined) {
        m.basePath = basePath;
      }
      const result = checkTlaModel(m, 2);
      if (assertPassedFalse) {
        expect(result.passed, `${场景}: 应 passed=false`).toBe(false);
      }
      expect(
        result.violations.some((v) => marker.test(v)),
        `${场景}: violations 应含 ${marker}`,
      ).toBe(true);
    }
  });

  it('basePath 通过行（1 态：basePath 存在 → 不报缺失）', () => {
    const m = makeValidManifestWithoutBasePath() as { basePath?: unknown };
    m.basePath = '.';
    const result = checkTlaModel(m, 2);
    expect(result.violations.some((v) => v.includes('basePath 缺失'))).toBe(false);
  });
});

// ==================== P1.2 SD 覆盖率 spec 方向校验 ====================

describe('P1.2 SD 覆盖率 spec 方向校验', () => {
  const baseSpec = {
    level: 'L1' as const,
    phase: 1,
    system: 'test',
    designRef: '',
    tlaPath: 'a.tla',
    cfgPath: 'a.cfg',
    parent: null,
    siblings: [],
    children: [],
    variableCombination: 1,
    decompositionDecision: 'kept-below-threshold' as const,
    syntaxChecked: true,
    tlcChecked: true,
    deadlockFree: true,
    invariantsHold: true,
    stateExplosion: false,
  };

  it('requirementIds 违规行（2 态：空数组缺 requirementIds / 无 SD-xxx 标识）', () => {
    for (const [场景, requirementIds, marker] of [
      ['spec 缺 requirementIds（空数组）', [], 'L1_system 缺 requirementIds'],
      ['spec requirementIds 无 SD-xxx 标识', ['REQ-001'], '无 SD 标识'],
    ] as const) {
      const specs = [{ ...baseSpec, id: 'L1_system', requirementIds: [...requirementIds] }];
      const result = checkCoverage(specs as TlaSpec[], ['SD-001']);
      expect(result.passed, `${场景}: 应 fail`).toBe(false);
      expect(
        result.violations.some((v) => v.includes(marker)),
        `${场景}: 应含「${marker}」`,
      ).toBe(true);
    }
  });

  it('requirementIds 通过行（1 态：含 SD-xxx → 通过 spec 方向）', () => {
    const specs = [{ ...baseSpec, id: 'L1_system', requirementIds: ['SD-001', 'REQ-001'] }];
    const result = checkCoverage(specs as TlaSpec[], ['SD-001']);
    // 注意：只要 SD-001 被覆盖且 spec 含 SD 标识就通过
    expect(result.violations.some((v) => v.includes('缺 requirementIds'))).toBe(false);
    expect(result.violations.some((v) => v.includes('无 SD 标识'))).toBe(false);
  });

  it('L1/L2/L3/L4 全规格无例外', () => {
    // 测试各层级 spec 都须遵守
    for (const level of ['L1', 'L2', 'L3', 'L4'] as const) {
      const specs = [{ ...baseSpec, id: `${level}_test`, level, requirementIds: [] }];
      const result = checkCoverage(specs as TlaSpec[], ['SD-001']);
      expect(result.violations.some((v) => v.includes(`${level}_test 缺 requirementIds`))).toBe(true);
    }
  });
});

// ==================== G-D D1/D2：cfg INVARIANT 一致性与格式（七态三循环） ====================

describe('G-D D1/D2 cfg INVARIANT 一致性与格式', () => {
  const invariantsDef = `
Invariants ==
    /\\ TypeOK
    /\\ AuthInvariant
`;
  const businessDef = `
BusinessInvariant ==
    /\\ TypeOK
    /\\ AuthInvariant
`;

  it('cfg INVARIANT 通过行（4 态：Invariants== 命名兼容 / BusinessInvariant== 向后兼容 / INVARIANT 带名 / INVARIANTS 列表）', () => {
    for (const [场景, run, assertNoViolations] of [
      [
        'tla 用 Invariants == 定义，cfg 用 INVARIANT 逐行声明（D1 一致性）',
        () =>
          checkCfgInvariantsConsistency(invariantsDef, 'SPECIFICATION Spec\nINVARIANT TypeOK\nINVARIANT AuthInvariant'),
        true,
      ],
      [
        'tla 用 BusinessInvariant == 定义（向后兼容，D1 一致性）',
        () =>
          checkCfgInvariantsConsistency(businessDef, 'SPECIFICATION Spec\nINVARIANT TypeOK\nINVARIANT AuthInvariant'),
        true,
      ],
      [
        'cfg INVARIANT 后跟不变式名（D2 结构）',
        () => checkCfgStructure('SPECIFICATION Spec\nINVARIANT TypeOK\nINIT Init'),
        false,
      ],
      [
        'cfg INVARIANTS 关键字跟列表（不变式行本身不报错，D2 结构）',
        () => checkCfgStructure('SPECIFICATION Spec\nINVARIANTS TypeOK AuthInvariant\nINIT Init'),
        false,
      ],
    ] as const) {
      const result = run();
      expect(result.passed, `${场景}: 应 passed=true`).toBe(true);
      if (assertNoViolations) {
        expect(result.violations, `${场景}: 应零违规`).toHaveLength(0);
      }
    }
  });

  it('cfg INVARIANT 违规行（1 态：cfg 缺一项 → 报缺失不变式）', () => {
    const cfg = 'SPECIFICATION Spec\nINVARIANT TypeOK';
    const result = checkCfgInvariantsConsistency(invariantsDef, cfg);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('缺失不变式'))).toBe(true);
  });

  it('cfg 含裸 INVARIANT（无不变式名）→ 报缺少不变式名（2 态：裸关键字 / 尾随空格）', () => {
    for (const [场景, cfg] of [
      ['裸 INVARIANT', 'SPECIFICATION Spec\nINVARIANT\nINIT Init'],
      ['裸 INVARIANT 带尾随空格', 'SPECIFICATION Spec\nINVARIANT   \nINIT Init'],
    ] as const) {
      const result = checkCfgStructure(cfg);
      expect(result.passed, `${场景}: 应 fail`).toBe(false);
      expect(
        result.violations.some((v) => v.includes('INVARIANT 缺少不变式名')),
        `${场景}: 应报缺少不变式名`,
      ).toBe(true);
    }
  });
});

// ==================== G-D D3：@phase 严格 ====================

describe('G-D D3 @phase 解析拒绝非整数', () => {
  it('@phase 三态（"4x" / "3.9" 拒绝；"4" 正常整数不触发）', () => {
    for (const [phaseValue, specPhase, marker, 期望违规] of [
      ['4x', 4, '@phase="4x"', true],
      ['3.9', 3, '@phase="3.9"', true],
      ['4', 4, '@phase', false],
    ] as const) {
      const header: Record<string, string | null> = {
        system: 'test',
        phase: phaseValue,
      };
      const spec = { id: 'L1-test', level: 'L1' as const, phase: specPhase };
      const violations = validateHeader(header, spec as never);
      expect(
        violations.some((v) => v.includes(marker)),
        `@phase="${phaseValue}": ${期望违规 ? `应触发含「${marker}」的 violation` : `不应触发含「${marker}」的 violation`}`,
      ).toBe(期望违规);
    }
  });
});

// ==================== checkCoverage sdCoverage 回填校验 ====================

describe('checkCoverage sdCoverage 回填', () => {
  // 注：schema 在 currentPhase>=2 时强制必填 sdCoverage，且 sdCoverage.uncoveredSdNodes
  // maxItems:0 —— 非空 uncoveredSdNodes / 缺失 sdCoverage 在 schema 层即被拦截（返回 [schema] 前缀 violations，
  // checkTlaModel 提前返回）。因此以下用例的构造须让 manifest 通过 schema 以触达业务层校验：
  //   - 用例 1：sdCoverage 与 graphSdNodes 覆盖集合不一致（coveredSdNodes 漏报，uncoveredSdNodes 保持空数组）
  //   - 用例 2：manifest.currentPhase=1 绕过 schema 必填，以 phase 参数=2 触发业务层「缺失」校验
  it('sdCoverage 覆盖集合与 graphSdNodes 不一致（coveredSdNodes 漏报已覆盖 SD）应产生 coverageViolations', () => {
    const manifest = {
      version: 1,
      currentPhase: 2,
      basePath: '.',
      tools: { jarPath: 'tla2tools.jar', javaMinVersion: 11 },
      specs: [
        {
          id: 'L1_Test',
          level: 'L1',
          phase: 1,
          system: 'test',
          requirementIds: ['SD-001', 'SD-002'],
          designRef: 'docs/phase1-requirements/requirement-spec.md:§1',
          tlaPath: 'L1_Test.tla',
          cfgPath: 'L1_Test.cfg',
          parent: null,
          siblings: [],
          children: [],
          variableCombination: 100,
          decompositionDecision: 'kept-below-threshold',
          syntaxChecked: true,
          tlcChecked: true,
          deadlockFree: true,
          invariantsHold: true,
          stateExplosion: false,
        },
      ],
      graphSdNodes: ['SD-001', 'SD-002'],
      sdCoverage: {
        totalSdNodes: 2,
        coveredSdNodes: ['SD-001'], // 漏报 SD-002（spec 实际已覆盖）
        uncoveredSdNodes: [],
        coverageRate: 0.5,
      },
    } as any;
    const result = checkTlaModel(manifest, 2);
    expect(result.coverageViolations.length).toBeGreaterThan(0);
    expect(result.coverageViolations.join(' ')).toMatch(/比对不一致/);
    expect(result.passed).toBe(false);
  });

  it('sdCoverage 缺失但 graphSdNodes 非空（phase>=2）应产生 coverageViolations', () => {
    const manifest = {
      version: 1,
      currentPhase: 1, // schema 在 currentPhase>=2 时强制必填 sdCoverage；此处以 phase 参数=2 触发业务层缺失校验
      basePath: '.',
      tools: { jarPath: 'tla2tools.jar', javaMinVersion: 11 },
      specs: [
        {
          id: 'L1_Test',
          level: 'L1',
          phase: 1,
          system: 'test',
          requirementIds: ['SD-001'],
          designRef: 'docs/phase1-requirements/requirement-spec.md:§1',
          tlaPath: 'L1_Test.tla',
          cfgPath: 'L1_Test.cfg',
          parent: null,
          siblings: [],
          children: [],
          variableCombination: 100,
          decompositionDecision: 'kept-below-threshold',
          syntaxChecked: true,
          tlcChecked: true,
          deadlockFree: true,
          invariantsHold: true,
          stateExplosion: false,
        },
      ],
      graphSdNodes: ['SD-001', 'SD-002'],
    } as any;
    const result = checkTlaModel(manifest, 2);
    expect(result.coverageViolations.length).toBeGreaterThan(0);
    expect(result.coverageViolations.join(' ')).toMatch(/sdCoverage.*缺失|sdCoverage.*missing/);
    expect(result.passed).toBe(false);
  });

  it('sdCoverage 全覆盖时 coverageViolations 为空', () => {
    const manifest = {
      version: 1,
      currentPhase: 2,
      basePath: '.',
      tools: { jarPath: 'tla2tools.jar', javaMinVersion: 11 },
      specs: [
        {
          id: 'L1_Test',
          level: 'L1',
          phase: 1,
          system: 'test',
          requirementIds: ['SD-001', 'SD-002'],
          designRef: 'docs/phase1-requirements/requirement-spec.md:§1',
          tlaPath: 'L1_Test.tla',
          cfgPath: 'L1_Test.cfg',
          parent: null,
          siblings: [],
          children: [],
          variableCombination: 100,
          decompositionDecision: 'kept-below-threshold',
          syntaxChecked: true,
          tlcChecked: true,
          deadlockFree: true,
          invariantsHold: true,
          stateExplosion: false,
        },
      ],
      graphSdNodes: ['SD-001', 'SD-002'],
      sdCoverage: {
        totalSdNodes: 2,
        coveredSdNodes: ['SD-001', 'SD-002'],
        uncoveredSdNodes: [],
        coverageRate: 1.0,
      },
    } as any;
    const result = checkTlaModel(manifest, 2);
    expect(result.coverageViolations).toEqual([]);
  });
});

// ==================== A6：cfg 段落关键字终止 INVARIANTS 列表 ====================

describe('A6 cfg 段落关键字终止 INVARIANTS 列表（PROPERTIES 等）', () => {
  it('官方 cfg 写法：INVARIANTS 列表后跟 PROPERTIES 段，属性名不入不变式集合', () => {
    const cfg = ['INVARIANTS', 'TypeOK', 'Inv', '', 'PROPERTIES', 'Termination'].join('\n');
    expect(parseCfgInvariantNames(cfg)).toEqual(['TypeOK', 'Inv']);
  });

  it('多段 cfg：官方段名全集逐个终止前导 INVARIANTS 列表，列表外的行不混入', () => {
    // 每个段落关键字各配一个 [INVARIANTS → 不变式名 → 关键字行] 块：
    // 关键字若缺席终止符表，其后内容会被误当不变式名混入（A6 回归素材）。
    const sectionLines = [
      'SPECIFICATION Spec',
      'INIT Init',
      'NEXT Next',
      'CONSTANT N = 3',
      'CONSTANTS A = 1, B = 2',
      'CONSTRAINT TimeBound',
      'CONSTRAINTS C1, C2',
      'ACTION_CONSTRAINT ActC',
      'ACTION_CONSTRAINTS ActC1, ActC2',
      'TYPE_CONSTRAINT TypeC',
      'SYMMETRY Sym',
      'VIEW View1',
      'PROPERTY Liveness',
      'PROPERTIES Termination',
      'CHECK_DEADLOCK FALSE',
      'CHECK_FINAL FinalCond',
      'POSTCONDITION Post',
      'ALIAS Alias1',
    ];
    const cfg = sectionLines.map((line) => `INVARIANTS\nInv_${line.split(/[\s=]/)[0]}\n${line}`).join('\n');
    const expected = sectionLines.map((line) => `Inv_${line.split(/[\s=]/)[0]}`);
    expect(parseCfgInvariantNames(cfg)).toEqual(expected);
  });

  it('端到端：INVARIANTS 后紧跟 PROPERTIES 段（无空行）不再假报 cfgTlaMismatch', () => {
    const tla = 'BusinessInvariant == /\\ TypeOK /\\ Inv';
    const cfg = 'SPECIFICATION Spec\nINVARIANTS\nTypeOK\nInv\nPROPERTIES\nTermination';
    const result = checkCfgInvariantsConsistency(tla, cfg);
    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });
});

// ==================== A7：SANY 失败 → tlcStatus=notRun 单一事实 ====================

/** A7 用 manifest：单 L1 根、schema 合法、声明标志可逐项覆盖（缺省 = 全通过标志）。 */
function makeSingleSpecManifest(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    version: 1,
    currentPhase: 1,
    basePath: '.',
    tools: { jarPath: 'tools/tla2tools.jar', javaMinVersion: 11 },
    specs: [
      {
        id: 'L1-system',
        level: 'L1',
        phase: 1,
        system: 'sample-system',
        requirementIds: ['REQ-001'],
        designRef: 'docs/requirement-spec.md',
        tlaPath: 'tla/L1-system.tla',
        cfgPath: 'tla/L1-system.cfg',
        parent: null,
        siblings: [],
        children: [],
        variableCombination: 240,
        decompositionDecision: 'kept-below-threshold',
        syntaxChecked: true,
        tlcChecked: true,
        deadlockFree: true,
        invariantsHold: true,
        stateExplosion: false,
        ...overrides,
      },
    ],
    checkRounds: [],
  };
}

describe('A7 SANY 失败 → 报告输出 notRun 单一事实，不复述预置标志', () => {
  it('syntaxChecked=false：tlcStatus=notRun，reasons 仅含「TLC 未执行」，全局分类零死锁/不变式违反/状态爆炸', () => {
    // bad-declared-flags 形态：SANY 未过 + TLC 结果布尔全预置为「违反」
    const result = checkTlaModel(
      makeSingleSpecManifest({
        syntaxChecked: false,
        tlcChecked: false,
        deadlockFree: false,
        invariantsHold: false,
        stateExplosion: true,
      }),
      1,
    );
    // 门禁不放行（notRun 一律 exit 1）
    expect(result.passed).toBe(false);
    // per-spec 单一事实
    expect(result.specs).toHaveLength(1);
    expect(result.specs[0]?.specId).toBe('L1-system');
    expect(result.specs[0]?.tlcStatus).toBe('notRun');
    const reasons = result.specs[0]?.reasons.join() ?? '';
    expect(reasons).toContain('TLC 未执行（SANY 语法检查失败）');
    expect(reasons).not.toContain('死锁');
    expect(reasons).not.toContain('不变式违反');
    expect(reasons).not.toContain('状态爆炸');
    // 全局分类数组不复述预置布尔
    expect(result.deadlockViolations).toEqual([]);
    expect(result.invariantViolations).toEqual([]);
    expect(result.stateExplosionSpecs).toEqual([]);
    // violations（CLI/--json/self-test 消费面）同样单一事实：含「TLC 未执行」不含「死锁」
    const violations = result.violations.join();
    expect(violations).toContain('TLC 未执行');
    expect(violations).not.toContain('死锁');
    expect(violations).not.toContain('状态爆炸');
  });

  it('真跑通过（标志全 true）→ tlcStatus=passed 且 reasons 为空', () => {
    const result = checkTlaModel(makeSingleSpecManifest(), 1);
    expect(result.specs[0]?.tlcStatus).toBe('passed');
    expect(result.specs[0]?.reasons).toEqual([]);
  });

  it('真跑失败（deadlockFree=false / invariantsHold=false / stateExplosion=true）→ tlcStatus=failed 且 reasons 与逐类违反同文案', () => {
    const result = checkTlaModel(
      makeSingleSpecManifest({
        deadlockFree: false,
        invariantsHold: false,
        stateExplosion: true,
      }),
      1,
    );
    expect(result.specs[0]?.tlcStatus).toBe('failed');
    expect(result.specs[0]?.reasons.join()).toContain('存在死锁（deadlockFree=false）');
    expect(result.specs[0]?.reasons.join()).toContain('不变式违反（invariantsHold=false）');
    expect(result.specs[0]?.reasons.join()).toContain('状态爆炸（stateExplosion=true）');
  });

  it('SANY 过但 tlcChecked=false → tlcStatus=notRun 且保留既有 tlcChecked violation', () => {
    const result = checkTlaModel(makeSingleSpecManifest({ tlcChecked: false }), 1);
    expect(result.specs[0]?.tlcStatus).toBe('notRun');
    expect(result.specs[0]?.reasons.join()).toContain('TLC 未执行');
    expect(result.violations.join()).toContain('tlcChecked=false（TLC 模型检查未完成）');
  });
});

// ==================== S2：层次校验区分「属后续阶段」的 child ====================
//
// 缺陷：`--phase` 收窄校验范围后，被过滤掉的 child/parent/sibling 路径不在 `byPath` 中，
// 原实现一律报「不在 manifest 中」——把「校验范围收窄」误报成「manifest 未登记」。
// 裁定：命中 `filteredOutPaths` 时改报「属后续阶段（phase=N；当前校验 phase=M 不包含它），
// 不算 manifest 缺失」；未命中一律保留原文案（判定结果不变，仍拦截）。

describe('S2 checkHierarchy 区分 phase 过滤掉的 child/parent/sibling', () => {
  it('被 phase 过滤掉的关系路径报「属后续阶段」而非 manifest 缺失（3 态：child / parent / sibling）', () => {
    const rootOnly = {
      id: 'L1_counter',
      level: 'L1',
      phase: 1,
      tlaPath: 'tla/L1_counter.tla',
      cfgPath: 'tla/L1_counter.cfg',
      parent: null,
      children: [],
      siblings: [],
    } as unknown as TlaSpec;
    const child = {
      id: 'L2_counter_service',
      level: 'L2',
      phase: 2,
      tlaPath: 'tla/L2_counter_service.tla',
      cfgPath: 'tla/L2_counter_service.cfg',
      parent: 'tla/L4_counter_impl.tla',
      children: [],
      siblings: [],
    } as unknown as TlaSpec;
    for (const [场景, specs, options, 期望片段] of [
      [
        'child 被过滤',
        [
          {
            ...rootOnly,
            children: ['tla/L2_counter_service.tla'],
          } as unknown as TlaSpec,
        ],
        {
          filteredOutPaths: new Set(['tla/L2_counter_service.tla']),
          fullPhaseByPath: new Map([['tla/L2_counter_service.tla', 2]]),
          phase: 1,
        },
        ['属后续阶段', 'phase=2'],
      ],
      [
        'parent 被过滤',
        [rootOnly, { ...child, parent: 'tla/L4_counter_impl.tla' } as unknown as TlaSpec],
        {
          filteredOutPaths: new Set(['tla/L4_counter_impl.tla']),
          fullPhaseByPath: new Map([['tla/L4_counter_impl.tla', 4]]),
          phase: 1,
        },
        ['parent="tla/L4_counter_impl.tla"', '属后续阶段', 'phase=4'],
      ],
      [
        'sibling 被过滤',
        [
          {
            ...rootOnly,
            siblings: ['tla/L3_counter_deep.tla'],
          } as unknown as TlaSpec,
        ],
        {
          filteredOutPaths: new Set(['tla/L3_counter_deep.tla']),
          fullPhaseByPath: new Map([['tla/L3_counter_deep.tla', 3]]),
          phase: 1,
        },
        ['sibling="tla/L3_counter_deep.tla"', '属后续阶段', 'phase=3'],
      ],
    ] as const) {
      const violations = checkHierarchy([...specs], options);
      expect(violations, `${场景}: 应恰 1 条`).toHaveLength(1);
      for (const fragment of 期望片段) {
        expect(violations[0], `${场景}: 应含「${fragment}」`).toContain(fragment);
      }
      expect(violations[0], `${场景}: 不应报「不在 manifest 中」`).not.toContain('不在 manifest 中');
    }
  });

  it('缺失行（1 态：未注册 child 仍报 manifest 缺失）', () => {
    const l1 = {
      id: 'L1_counter',
      level: 'L1',
      phase: 1,
      tlaPath: 'tla/L1_counter.tla',
      cfgPath: 'tla/L1_counter.cfg',
      parent: null,
      children: ['tla/L9_ghost.tla'],
      siblings: [],
    } as unknown as TlaSpec;
    const violations = checkHierarchy([l1], {
      filteredOutPaths: new Set<string>(),
      fullPhaseByPath: new Map<string, number>(),
      phase: 1,
    });
    expect(violations[0]).toContain('不在 manifest 中');
  });

  it('缺省 options 时行为与文案逐字不变（未命中 filteredOutPaths 仍报 manifest 缺失）', () => {
    const l1 = {
      id: 'L1_counter',
      level: 'L1',
      phase: 1,
      tlaPath: 'tla/L1_counter.tla',
      cfgPath: 'tla/L1_counter.cfg',
      parent: null,
      children: ['tla/L9_ghost.tla'],
      siblings: ['tla/L8_ghost.tla'],
    } as unknown as TlaSpec;
    const violations = checkHierarchy([l1]);
    expect(violations).toHaveLength(2);
    expect(violations[0]).toBe(
      '层次校验失败：规格 L1_counter 的 child="tla/L9_ghost.tla" 不在 manifest 中（应填 manifest 中已登记规格的 tlaPath，或删除该失效 child 引用）',
    );
    expect(violations[1]).toBe(
      '层次校验失败：规格 L1_counter 的 sibling="tla/L8_ghost.tla" 不在 manifest 中（应填 manifest 中已登记规格的 tlaPath，或删除该失效 sibling 引用）',
    );
  });

  it('checkTlaModel 以 phase=1 校验时，phase=2 的 child 报后续阶段（调用方传入过滤集合）', () => {
    const m = makeValidManifestWithoutBasePath() as { basePath?: unknown };
    m.basePath = '.';
    const result = checkTlaModel(m, 1);
    expect(result.hierarchyViolations).toHaveLength(1);
    expect(result.hierarchyViolations[0]).toContain('属后续阶段');
    expect(result.hierarchyViolations[0]).toContain('phase=2');
    expect(result.hierarchyViolations[0]).not.toContain('不在 manifest 中');
    // 判定结果不变：仍拦截（passed=false）
    expect(result.passed).toBe(false);
  });
});

// ==================== B1 恒真不变式防御 + B10c CONSTRAINT 禁用（批次 7 任务 3） ====================

describe('B1 恒真不变式防御 + B10c CONSTRAINT 禁用', () => {
  /** 最小 .tla 文本：TypeOK 为 Type 类不变式，Spec/Init/Next 仅作结构占位。 */
  const tlaWithTypeOk = [
    '---- MODULE M ----',
    'EXTENDS Naturals',
    'VARIABLES x',
    'Init == x = 0',
    "Next == x' = x + 1",
    'Spec == Init /\\ [][Next]_x',
    'TypeOK == x \\in Nat',
    '====',
  ].join('\n');

  it('B1a：INVARIANTS 全部为 Type 类（名字以 Type 开头）→ 违规「缺非 Type 业务不变式」', () => {
    // cfg INVARIANTS 仅 TypeOK
    const cfg = 'SPECIFICATION Spec\nINVARIANTS TypeOK';
    const result = checkBusinessInvariants(tlaWithTypeOk, cfg);
    expect(result.passed, '全 Type 类不变式应判失败').toBe(false);
    expect(
      result.violations.some((v) => v.includes('缺非 Type 业务不变式')),
      '应含「缺非 Type 业务不变式」违规',
    ).toBe(true);
  });

  it('B1b：业务不变式定义体语法等价于 TRUE → 违规', () => {
    const tla = `${tlaWithTypeOk.split('====')[0]}Inv == TRUE\n====`;
    const cfg = 'SPECIFICATION Spec\nINVARIANTS Inv TypeOK';
    const result = checkBusinessInvariants(tla, cfg);
    expect(result.passed, '恒真业务不变式应判失败').toBe(false);
    expect(
      result.violations.some((v) => v.includes('恒真') && v.includes('Inv')),
      '应含「恒真」违规且点名 Inv',
    ).toBe(true);
    // 归一化口径：多空白 / 前后空白的 TRUE 同样命中
    const tlaSpaced = `${tlaWithTypeOk.split('====')[0]}Inv ==   TRUE  \n====`;
    expect(checkBusinessInvariants(tlaSpaced, cfg).violations.some((v) => v.includes('恒真'))).toBe(true);
  });

  it('B1c：业务不变式定义体与某 TypeInvariant 定义体相同 → 违规', () => {
    // Inv 与 TypeOK 同体
    const tla = `${tlaWithTypeOk.split('====')[0]}Inv == x \\in Nat\n====`;
    const cfg = 'SPECIFICATION Spec\nINVARIANTS TypeOK Inv';
    const result = checkBusinessInvariants(tla, cfg);
    expect(result.passed, '与 Type 类不变式同体应判失败').toBe(false);
    expect(
      result.violations.some((v) => v.includes('定义体相同') && v.includes('TypeOK') && v.includes('Inv')),
      '应含「定义体相同」违规且点名 TypeOK 与 Inv',
    ).toBe(true);
  });

  it('B10c：cfg 含 CONSTRAINT/CONSTRAINTS 段 → 违规「不得用约束砍状态空间」', () => {
    const tla = `${tlaWithTypeOk.split('====')[0]}Inv == x >= 0\n====`;
    const cfgBase = 'SPECIFICATION Spec\nINVARIANTS Inv TypeOK';
    for (const [场景, cfg] of [
      ['CONSTRAINT 单数段', `${cfgBase}\nCONSTRAINT TimeBound`],
      ['CONSTRAINTS 复数段', `${cfgBase}\nCONSTRAINTS C1, C2`],
    ] as const) {
      const result = checkBusinessInvariants(tla, cfg);
      expect(result.passed, `${场景}: 应判失败`).toBe(false);
      expect(
        result.violations.some((v) => v.includes('不得用约束砍状态空间')),
        `${场景}: 应含「不得用约束砍状态空间」违规`,
      ).toBe(true);
    }
    // 词边界：ACTION_CONSTRAINT / TYPE_CONSTRAINT 是别的段名，不命中 CONSTRAINT 禁用
    const otherSections = `${cfgBase}\nACTION_CONSTRAINT ActC\nTYPE_CONSTRAINT TypeC`;
    expect(
      checkBusinessInvariants(tla, otherSections).violations.some((v) => v.includes('不得用约束砍状态空间')),
      'ACTION_CONSTRAINT / TYPE_CONSTRAINT 不应命中 CONSTRAINT 禁用',
    ).toBe(false);
  });
});

// ==================== B10 空转 Next 检测（批次 7 任务 7） ====================

describe('B10 空转 Next 检测（无状态赋值 / 全恒等自赋值）', () => {
  /** 带真实推进 Next 的最小 .tla（非空转对照组）。 */
  const tlaProgressing = [
    '---- MODULE M ----',
    'EXTENDS Naturals',
    'VARIABLES x',
    'Init == x = 0',
    "Next == x' = x + 1",
    'Spec == Init /\\ [][Next]_x',
    '====',
  ].join('\n');
  const cfgNext = 'INIT Init\nNEXT Next';

  it('parseCfgNextNames：INIT/NEXT 形式提取 Next 名；SPECIFICATION 形式返回空数组', () => {
    expect(parseCfgNextNames('SPECIFICATION Spec\nINVARIANTS Inv')).toEqual([]);
    expect(parseCfgNextNames(cfgNext)).toEqual(['Next']);
    expect(parseCfgNextNames('INIT Init\nnext NextOp')).toEqual(['NextOp']); // 段名大小写不敏感
    expect(parseCfgNextNames('INIT Init\nNEXT')).toEqual([]); // 裸 NEXT 行（无名字）跳过
  });

  it("空转形态一：Next == x' = x（全恒等自赋值）→ 违规「空转规格」", () => {
    const tla = tlaProgressing.replace("Next == x' = x + 1", "Next == x' = x");
    const result = checkIdleNext(tla, cfgNext);
    expect(result.passed, '全恒等自赋值 Next 应判失败').toBe(false);
    expect(
      result.violations.some((v) => v.includes('空转规格') && v.includes('Next')),
      '应含「空转规格」违规且点名 Next',
    ).toBe(true);
  });

  it("空转形态二：Next == TRUE / UNCHANGED x（闭包无任何 var' = 赋值）→ 违规「空转规格」", () => {
    const tlaTrue = tlaProgressing.replace("Next == x' = x + 1", 'Next == TRUE');
    const resultTrue = checkIdleNext(tlaTrue, cfgNext);
    expect(resultTrue.passed, 'Next == TRUE 应判失败').toBe(false);
    expect(resultTrue.violations.some((v) => v.includes('空转规格'))).toBe(true);

    const tlaUnchanged = tlaProgressing.replace("Next == x' = x + 1", 'Next == UNCHANGED x');
    expect(checkIdleNext(tlaUnchanged, cfgNext).violations.some((v) => v.includes('空转规格'))).toBe(true);
  });

  it("非空转对照组：真实推进 Next（x' = x + 1，算术 RHS）不违规", () => {
    expect(checkIdleNext(tlaProgressing, cfgNext).passed).toBe(true);
  });

  it("非确定性推进：Next == x' \\in 0..10（var' \\in 赋值形态）不违规", () => {
    const tla = tlaProgressing.replace("Next == x' = x + 1", "Next == x' \\in 0..10");
    expect(checkIdleNext(tla, cfgNext).passed).toBe(true);
  });

  it('子动作引用闭包：Next == A \\/ B 且子动作含真实赋值 → 不违规（防误报）', () => {
    const tla = [
      '---- MODULE M ----',
      'EXTENDS Naturals',
      'VARIABLES x',
      'Init == x = 0',
      'Next == A \\/ B',
      "A == x' = x + 1",
      "B == x' = 0",
      'Spec == Init /\\ [][Next]_x',
      '====',
    ].join('\n');
    expect(checkIdleNext(tla, cfgNext).passed).toBe(true);
  });

  it('混合形态：恒等自赋值与非恒等赋值并存 → 不违规（存在推进分支即非空转）', () => {
    const tla = tlaProgressing.replace("Next == x' = x + 1", "Next == x' = x /\\ x' = x + 1");
    expect(checkIdleNext(tla, cfgNext).passed).toBe(true);
  });

  it("全恒等多变量：Next == x' = x /\\ y' = y → 违规「空转规格」", () => {
    const tla = tlaProgressing
      .replace('VARIABLES x', 'VARIABLES x, y')
      .replace("Next == x' = x + 1", "Next == x' = x /\\ y' = y");
    const result = checkIdleNext(tla, cfgNext);
    expect(result.passed, '全变量恒等自赋值应判失败').toBe(false);
    expect(result.violations.some((v) => v.includes('空转规格'))).toBe(true);
  });

  it('分解式全恒等（跨定义体合取聚合）：Next == A /\\ B（A、B 均恒等自赋值）→ 违规「空转规格」', () => {
    const tla = [
      '---- MODULE M ----',
      'EXTENDS Naturals',
      'VARIABLES x, y',
      'Init == x = 0 /\\ y = 0',
      'Next == A /\\ B',
      "A == x' = x",
      "B == y' = y",
      'Spec == Init /\\ [][Next]_x',
      '====',
    ].join('\n');
    const result = checkIdleNext(tla, cfgNext);
    expect(result.passed, '跨定义体分解式全恒等应判失败（跨定义体合取聚合）').toBe(false);
    expect(result.violations.some((v) => v.includes('空转规格'))).toBe(true);
  });

  it("间接引用恒等（一级/二级）：Next == A（A == x' = x）与 Next == A（A == B, B == x' = x）→ 违规「空转规格」", () => {
    const tlaLevel1 = [
      '---- MODULE M ----',
      'EXTENDS Naturals',
      'VARIABLES x',
      'Init == x = 0',
      'Next == A',
      "A == x' = x",
      'Spec == Init /\\ [][Next]_x',
      '====',
    ].join('\n');
    expect(checkIdleNext(tlaLevel1, cfgNext).violations.some((v) => v.includes('空转规格'))).toBe(true);

    const tlaLevel2 = [
      '---- MODULE M ----',
      'EXTENDS Naturals',
      'VARIABLES x',
      'Init == x = 0',
      'Next == A',
      'A == B',
      "B == x' = x",
      'Spec == Init /\\ [][Next]_x',
      '====',
    ].join('\n');
    expect(checkIdleNext(tlaLevel2, cfgNext).violations.some((v) => v.includes('空转规格'))).toBe(true);
  });

  it('多 NEXT 合取聚合：NEXT A（恒等）+ NEXT B（推进）→ 零违规；两均恒等 → 违规', () => {
    const cfgMulti = 'INIT Init\nNEXT A\nNEXT B';
    const tla = [
      '---- MODULE M ----',
      'EXTENDS Naturals',
      'VARIABLES x, y',
      'Init == x = 0 /\\ y = 0',
      "A == x' = x",
      "B == y' = y + 1",
      'Spec == Init /\\ [][A /\\ B]_x',
      '====',
    ].join('\n');
    expect(checkIdleNext(tla, cfgMulti).passed, 'TLC 多 NEXT 取合取：整体推进不应违规').toBe(true);

    const tlaBothIdle = tla.replace("B == y' = y + 1", "B == y' = y");
    const result = checkIdleNext(tlaBothIdle, cfgMulti);
    expect(result.passed, '多 NEXT 全部空转应判失败').toBe(false);
    expect(result.violations.filter((v) => v.includes('空转规格')).length, '逐名报告两处空转候选').toBe(2);
  });

  it("跨变量混合形态：Next == x' = x /\\ y' = y + 1（存在推进分支）→ 不违规", () => {
    const tla = tlaProgressing
      .replace('VARIABLES x', 'VARIABLES x, y')
      .replace("Next == x' = x + 1", "Next == x' = x /\\ y' = y + 1");
    expect(checkIdleNext(tla, cfgNext).passed).toBe(true);
  });

  it('parseCfgNextNames：剥离注释——行/块注释中的 NEXT 字样不产生幻影名', () => {
    expect(parseCfgNextNames('NEXT Real \\* NEXT Phantom')).toEqual(['Real']);
    expect(parseCfgNextNames('(* NEXT Phantom *)\nNEXT Real')).toEqual(['Real']);
  });

  it('cfg 无 NEXT 段（SPECIFICATION 形式）或 .tla 缺 Next 定义 → 跳过不违规', () => {
    expect(checkIdleNext(tlaProgressing, 'SPECIFICATION Spec').passed).toBe(true);
    const tlaNoNext = tlaProgressing.replace("Next == x' = x + 1\n", '');
    expect(checkIdleNext(tlaNoNext, cfgNext).passed).toBe(true);
  });

  it('wiring：checkTlaModel 将空转 Next 违规并入 cfgConsistencyViolations（规格 <id>: 前缀）且 passed=false', () => {
    const m = makeValidManifestWithoutBasePath() as Record<string, unknown>;
    m.basePath = '.';
    const spec = (m.specs as Record<string, unknown>[])[0] as Record<string, unknown>;
    spec.tlaContent = [
      '---- MODULE L1System ----',
      'EXTENDS Naturals',
      'VARIABLES x',
      'Init == x = 0',
      "Next == x' = x",
      'Spec == Init /\\ [][Next]_x',
      'Inv == x >= 0',
      'BusinessInvariant == /\\ Inv',
      '====',
    ].join('\n');
    spec.cfgContent = 'INIT Init\nNEXT Next\nINVARIANTS Inv';
    const result = checkTlaModel(m, 1);
    expect(
      result.cfgConsistencyViolations.some((v) => v.startsWith('规格 L1-system:') && v.includes('空转规格')),
      '空转规格违规应并入 cfg 一致性桶并带规格前缀',
    ).toBe(true);
    expect(result.passed).toBe(false);
  });

  // ==================== 批次 8 rider：顶层析取 + 纯守卫误报窗口收口 ====================

  it('析取窗口：Next == Idle \\/ Guard（Idle 恒等 + Guard 纯守卫）→ 零违规（不误报）', () => {
    const tla = [
      '---- MODULE M ----',
      'EXTENDS Naturals',
      'VARIABLES x',
      'Init == x = 0',
      'Next == Idle \\/ Guard',
      "Idle == x' = x",
      'Guard == x > 0',
      'Spec == Init /\\ [][Next]_x',
      '====',
    ].join('\n');
    // 无赋值的析取分支撇号变量不受约束、可真实推进——顶层析取下「全恒等 + 纯守卫」
    // 不可判定，保守计为推进（批次 7 复审确认的误报窗口）
    expect(checkIdleNext(tla, cfgNext).passed, '析取分支误报窗口应保守放行').toBe(true);
  });

  it('整块括号析取窗口：Next == (Idle \\/ Guard) → 零违规（保守 pass）', () => {
    const tla = [
      '---- MODULE M ----',
      'EXTENDS Naturals',
      'VARIABLES x',
      'Init == x = 0',
      'Next == (Idle \\/ Guard)',
      "Idle == x' = x",
      'Guard == x > 0',
      'Spec == Init /\\ [][Next]_x',
      '====',
    ].join('\n');
    expect(checkIdleNext(tla, cfgNext).passed, '整块括号析取形态同窗口，应保守放行').toBe(true);
  });

  it("析取全恒等不放掉（括号形态）：Next == (x' = x) \\/ (y' = y) → 违规「空转规格」", () => {
    const tla = [
      '---- MODULE M ----',
      'EXTENDS Naturals',
      'VARIABLES x, y',
      'Init == x = 0 /\\ y = 0',
      "Next == (x' = x) \\/ (y' = y)",
      'Spec == Init /\\ [][Next]_x',
      '====',
    ].join('\n');
    // 括号包裹的恒等子句剥外括号后仍整句匹配 var' = var，且闭包无非赋值子句——
    // 析取全恒等语义上仍空转，不得被析取窗口一并放掉
    const result = checkIdleNext(tla, cfgNext);
    expect(result.passed, '括号形态析取全恒等应判失败').toBe(false);
    expect(result.violations.some((v) => v.includes('空转规格'))).toBe(true);
  });

  it("析取全恒等不放掉（裸形态零回归）：Next == x' = x \\/ y' = y → 违规「空转规格」", () => {
    const tla = [
      '---- MODULE M ----',
      'EXTENDS Naturals',
      'VARIABLES x, y',
      'Init == x = 0 /\\ y = 0',
      "Next == x' = x \\/ y' = y",
      'Spec == Init /\\ [][Next]_x',
      '====',
    ].join('\n');
    const result = checkIdleNext(tla, cfgNext);
    expect(result.passed, '裸形态析取全恒等应判失败').toBe(false);
    expect(result.violations.some((v) => v.includes('空转规格'))).toBe(true);
  });

  it('合取分解零回归：Next == A /\\ B（A、B 全恒等）仍违规', () => {
    const tlaConj = [
      '---- MODULE M ----',
      'EXTENDS Naturals',
      'VARIABLES x, y',
      'Init == x = 0 /\\ y = 0',
      'Next == A /\\ B',
      "A == x' = x",
      "B == y' = y",
      'Spec == Init /\\ [][Next]_x',
      '====',
    ].join('\n');
    // 顶层无 \/ 析取的合取分解形态：全恒等判定照旧违规（真空转），不被析取窗口放掉
    expect(checkIdleNext(tlaConj, cfgNext).violations.some((v) => v.includes('空转规格'))).toBe(true);
  });

  // ==================== 批次 8 修复轮 1：间接析取窗口收口（closure 级判定） ====================

  it('间接析取窗口：Next == A; A == Idle \\/ Guard（Idle 恒等 + Guard 纯守卫）→ 零违规（不误报）', () => {
    const tla = [
      '---- MODULE M ----',
      'EXTENDS Naturals',
      'VARIABLES x',
      'Init == x = 0',
      'Next == A',
      'A == Idle \\/ Guard',
      "Idle == x' = x",
      'Guard == x > 0',
      'Spec == Init /\\ [][Next]_x',
      '====',
    ].join('\n');
    // 析取在子定义体 A 内、Next 自身体（bodies[0] == "A"）不可见——修复前只看 bodies[0]
    // 判 violation 属误报：Guard 分支无任何赋值，撇号变量不受约束、规格可真实推进。
    // 修复后判定看闭包（逐并入定义体，任一体顶层 \/ 即真），窗口照常触发 → 保守计为
    // 推进（与直写形态 Next == Idle \/ Guard 零违规一致）
    expect(checkIdleNext(tla, cfgNext).passed, '间接析取分支误报窗口应保守放行').toBe(true);
  });

  it("间接析取合取分解窗口：Next == A /\\ B; A == (x' = x) \\/ Guard → 零违规（不误报）", () => {
    const tla = [
      '---- MODULE M ----',
      'EXTENDS Naturals',
      'VARIABLES x, y',
      'Init == x = 0 /\\ y = 0',
      'Next == A /\\ B',
      "A == (x' = x) \\/ Guard",
      "B == y' = y",
      'Guard == x > 0',
      'Spec == Init /\\ [][Next]_x',
      '====',
    ].join('\n');
    // 析取同样藏于子定义体 A 内（合取分解 + 间接引用复合形态）：Guard 分支撇号变量
    // （x'、y'）不受约束、可真实推进，判 violation 属误报 → 闭包级判定保守放行
    expect(checkIdleNext(tla, cfgNext).passed, '复合形态间接析取窗口应保守放行').toBe(true);
  });

  it("间接析取全恒等不放掉：Next == A; A == (x' = x) \\/ (y' = y) → 违规「空转规格」", () => {
    const tla = [
      '---- MODULE M ----',
      'EXTENDS Naturals',
      'VARIABLES x, y',
      'Init == x = 0 /\\ y = 0',
      'Next == A',
      "A == (x' = x) \\/ (y' = y)",
      'Spec == Init /\\ [][Next]_x',
      '====',
    ].join('\n');
    // 预期：violation，与直写形态 (x' = x) \/ (y' = y)（上方批次 8 rider 锁定用例）一致。
    // 依据：析取窗口放行条件是「全恒等 + 真实非赋值子句 + 闭包顶层析取」——本形态闭包
    // （"A /\ (x' = x) \/ (y' = y)"）虽含顶层 \/，但唯一「非赋样子句」是裸名 A，它是
    // Next == A 引用闭包的拼接伪影（A 的定义体已并入同一闭包，A 自身不提供任何约束
    // 信息），不计入非赋值子句；剔除伪影后闭包无任何非赋值子句，不满足放行条件 →
    // 全恒等判定照旧违规（批次 7 既有语义零回归）。若此用例转绿为「零违规」即说明
    // 伪影剔除缺失，间接与直写两形态判定出现分叉
    const result = checkIdleNext(tla, cfgNext);
    expect(result.passed, '间接析取全恒等应判失败（与直写形态一致）').toBe(false);
    expect(result.violations.some((v) => v.includes('空转规格'))).toBe(true);
  });
});

// ==================== extractTlaDefBody 定义体提取边界（批次 8 rider） ====================

describe('extractTlaDefBody 定义体提取边界', () => {
  it('Inv == 2：单行标量体提取', () => {
    const tla = ['---- MODULE M ----', 'Inv == 2', 'Next == TRUE', '===='].join('\n');
    expect(extractTlaDefBody(tla, 'Inv')).toBe(' 2');
  });

  it('元字符名：N$e / A.B 按字面前缀提取，正则元字符不参与正则解释', () => {
    const tla = ['---- MODULE M ----', 'N$e == 1', 'Next == TRUE', 'A.B == (2)', '===='].join('\n');
    expect(extractTlaDefBody(tla, 'N$e')).toBe(' 1');
    expect(extractTlaDefBody(tla, 'A.B')).toBe(' (2)');
    // 前缀相等要求名字完整：'N' 后随 '$'，余部不匹配 `==` → 视为不存在
    expect(extractTlaDefBody(tla, 'N')).toBe(null);
  });

  it('元字符名边界：A.B 非标识符形态（含 .）不构成顶层边界，作为上一定义体续行被并入', () => {
    const tla = ['---- MODULE M ----', 'N$e == 1', 'A.B == (2)', 'Next == TRUE', '===='].join('\n');
    // 顶层边界正则只认 [A-Za-z][A-Za-z0-9_]* 形态的 0 起始定义；`A.B` 含元字符
    // 不构成边界 → 并入 N$e 体（元字符名仅来自 cfg 解析输入，实际 .tla 不合法，
    // 该行为只影响此类病态输入的体边界，不影响合法模块）
    expect(extractTlaDefBody(tla, 'N$e')).toBe(' 1\nA.B == (2)');
  });

  it('缩进 LET 体：内层 H == x > 0 不截断外层定义体（批次 8 边界修复）', () => {
    const tla = [
      '---- MODULE M ----',
      'Foo ==',
      '    LET',
      '        H == x > 0',
      '    IN',
      '    /\\ H',
      'Bar == 1',
      '====',
    ].join('\n');
    const body = extractTlaDefBody(tla, 'Foo');
    expect(body, 'Foo 定义体应提取到').not.toBe(null);
    expect(body?.includes('H == x > 0'), 'LET 体内层定义行属续行，不截断').toBe(true);
    expect(body?.includes('/\\ H'), 'IN 之后的体内容不丢').toBe(true);
    expect(body?.includes('Bar'), '0 起始的 Bar == 1 仍是顶层边界').toBe(false);
    expect(extractTlaDefBody(tla, 'Bar')).toBe(' 1');
  });

  it('多行合取体：/\\ 子句逐行收集到下一顶层定义', () => {
    const tla = ['---- MODULE M ----', 'Inv ==', '    /\\ a = 1', '    /\\ b = 2', 'Next == TRUE', '===='].join('\n');
    const body = extractTlaDefBody(tla, 'Inv') ?? '';
    expect(body).toContain('/\\ a = 1');
    expect(body).toContain('/\\ b = 2');
    expect(body).not.toContain('Next');
  });

  it('边界：模块终止符 ==== 结束定义体提取；名字不存在返回 null；空入参返回 null', () => {
    const tla = ['---- MODULE M ----', 'Inv == 1', '====', 'After == 2'].join('\n');
    expect(extractTlaDefBody(tla, 'Inv')).toBe(' 1');
    // ==== 只界定定义体的下边界（体收集终止）；目标查找为全文扫描，==== 之后的
    // 定义行仍可被查到（提取器是文本工具，合法 .tla 中 ==== 后无定义）
    expect(extractTlaDefBody(tla, 'After')).toBe(' 2');
    expect(extractTlaDefBody(tla, 'Missing')).toBe(null);
    expect(extractTlaDefBody('', 'Inv')).toBe(null);
    expect(extractTlaDefBody(tla, '')).toBe(null);
  });
});

// ==================== B9 variableCombination 推导注记 ====================

describe('B9 variableCombination 推导注记', () => {
  /** 构造一条 kept-below-threshold 规格（variableCombination 可指定）。 */
  function makeKeptSpec(variableCombination: number, basis?: TlaSpec['variableCombinationBasis']): TlaSpec {
    return {
      id: 'L2-big',
      level: 'L2',
      phase: 2,
      system: 'sample-system::auth',
      requirementIds: ['REQ-001'],
      designRef: 'docs/system-design.md',
      tlaPath: 'tla/L2-auth.tla',
      cfgPath: 'tla/L2-auth.cfg',
      parent: 'tla/L1-system.tla',
      siblings: [],
      children: [],
      variableCombination,
      decompositionDecision: 'kept-below-threshold',
      variableCombinationBasis: basis,
      syntaxChecked: true,
      tlcChecked: true,
      deadlockFree: true,
      invariantsHold: true,
      stateExplosion: false,
    };
  }

  it('B9：variableCombination >1000 kept 且无推导注记 → 违规', () => {
    const result = checkDecomposition([makeKeptSpec(2000)]);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toContain('L2-big');
    expect(result.violations[0]).toContain('variableCombinationBasis');
    // 既有警告保留（不因违规引入而删除）
    expect(result.warnings.some((w) => w.includes('kept-below-threshold'))).toBe(true);
  });

  it('B9 通过行：有 basis 且 Πcardinality === 声明 variableCombination → 零 violation', () => {
    const basis = {
      variables: [
        { name: 'user', cardinality: 40 },
        { name: 'session', cardinality: 50 },
      ],
    };
    const result = checkDecomposition([makeKeptSpec(2000, basis)]);
    expect(result.violations).toEqual([]);
    expect(result.warnings.some((w) => w.includes('kept-below-threshold'))).toBe(true);
  });

  it('B9 乘积不符：Πcardinality ≠ 声明 variableCombination → 违规（点名乘积与声明值）', () => {
    const basis = {
      variables: [
        { name: 'user', cardinality: 40 },
        { name: 'session', cardinality: 60 },
      ],
    };
    const result = checkDecomposition([makeKeptSpec(2000, basis)]);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toContain('Πcardinality=2400');
    expect(result.violations[0]).toContain('2000');
  });

  it('B9 非法基数：cardinality 非正数/非有限数 → 违规', () => {
    for (const cardinality of [0, -3, Number.POSITIVE_INFINITY, Number.NaN]) {
      const basis = {
        variables: [
          { name: 'user', cardinality },
          { name: 'session', cardinality: 50 },
        ],
      };
      const result = checkDecomposition([makeKeptSpec(2000, basis)]);
      expect(
        result.violations.some((v) => v.includes('cardinality')),
        `cardinality=${cardinality}`,
      ).toBe(true);
    }
  });

  it('B9 边界：≤1000 kept 无 basis 不要求（零 violation）；split-done/split 阈值行为不变', () => {
    // ≤1000 不要求推导注记
    expect(checkDecomposition([makeKeptSpec(1000)]).violations).toEqual([]);
    // >10000 非 split-done 仍走原 MUST_SPLIT violation（不受 B9 影响）
    const mustSplit = {
      ...makeKeptSpec(20000),
      id: 'L2-huge',
      decompositionDecision: 'consider-split' as const,
    };
    expect(
      checkDecomposition([mustSplit]).violations.some((v) => v.includes("须 decompositionDecision='split-done'")),
    ).toBe(true);
  });

  it('B9 边界：combo=1001（最小违规值）kept 无注记 → violation', () => {
    const result = checkDecomposition([makeKeptSpec(1001)]);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toContain('variableCombinationBasis');
    expect(result.violations[0]).toContain('1001');
  });

  it('B9 边界：空 variables 数组（variables: []）→ 缺注记 violation（不因数组为空而放行）', () => {
    const result = checkDecomposition([makeKeptSpec(2000, { variables: [] })]);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toContain('variableCombinationBasis');
  });

  // ==================== I5（终审修复波）：basis 名集合覆盖 .tla VARIABLES + cardinality 整数 ====================

  it('I5：basis 缺 .tla VARIABLES 声明变量 → violation（schema 承诺「须覆盖全部状态变量」落地）', () => {
    const spec = makeKeptSpec(2000, {
      variables: [
        { name: 'user', cardinality: 40 },
        { name: 'session', cardinality: 50 },
      ],
    });
    spec.tlaContent = [
      '---- MODULE L2_auth ----',
      'EXTENDS Naturals',
      'VARIABLES user, session, token_state',
      '====',
    ].join('\n');
    const result = checkDecomposition([spec]);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toContain('未覆盖 .tla 声明的全部状态变量');
    expect(result.violations[0]).toContain('token_state');
  });

  it('I5：名集合覆盖齐 → 零违规（块注释/行注释中的声明不计入；多行续行形态正确收集）', () => {
    const spec = makeKeptSpec(2000, {
      variables: [
        { name: 'user', cardinality: 40 },
        { name: 'session', cardinality: 50 },
      ],
    });
    spec.tlaContent = [
      '---- MODULE L2_auth ----',
      '(*',
      '  VARIABLES phantom_only_in_block_comment',
      '*)',
      '\\* VARIABLES ghost_only_in_line_comment',
      'VARIABLES user,',
      '        session',
      '====',
    ].join('\n');
    expect(checkDecomposition([spec]).violations).toEqual([]);
  });

  it('I5：无 VARIABLES 行（提取失败）→ 跳过名比对不误红', () => {
    const spec = makeKeptSpec(2000, {
      variables: [
        { name: 'whatever', cardinality: 40 },
        { name: 'other', cardinality: 50 },
      ],
    });
    spec.tlaContent = '---- MODULE L2_auth ----\nEXTENDS Naturals\n====\n';
    expect(checkDecomposition([spec]).violations).toEqual([]);
  });

  it('I5：cardinality 小数 → violation（须为 ≥1 的整数，与 schema integer 同口径）', () => {
    const result = checkDecomposition([
      makeKeptSpec(2000, {
        variables: [
          { name: 'user', cardinality: 40.5 },
          { name: 'session', cardinality: 50 },
        ],
      }),
    ]);
    expect(result.violations.some((v) => v.includes('非法 cardinality') && v.includes('整数'))).toBe(true);
  });

  it('I5：schema 侧 cardinality 为 integer —— 小数基数在 manifest schema 层即被拒', () => {
    const manifest = {
      version: 1,
      currentPhase: 1,
      basePath: '.',
      tools: { jarPath: 'tla2tools.jar', javaMinVersion: 11 },
      specs: [
        {
          id: 'L1_Test',
          level: 'L1',
          phase: 1,
          system: 'test',
          requirementIds: ['REQ-001'],
          designRef: 'docs/requirement-spec.md:§1',
          tlaPath: 'L1_Test.tla',
          cfgPath: 'L1_Test.cfg',
          parent: null,
          siblings: [],
          children: [],
          variableCombination: 2000,
          decompositionDecision: 'kept-below-threshold',
          variableCombinationBasis: {
            variables: [
              { name: 'user', cardinality: 40.5 },
              { name: 'session', cardinality: 50 },
            ],
          },
          syntaxChecked: true,
          tlcChecked: true,
          deadlockFree: true,
          invariantsHold: true,
          stateExplosion: false,
        },
      ],
    } as any;
    const result = checkTlaModel(manifest, 1);
    expect(
      result.violations.some((v) => v.startsWith('[schema]') && v.includes('cardinality')),
      `应报 [schema] 且点名 cardinality，实际：${result.violations.join('; ')}`,
    ).toBe(true);
    expect(result.passed).toBe(false);
  });
});
