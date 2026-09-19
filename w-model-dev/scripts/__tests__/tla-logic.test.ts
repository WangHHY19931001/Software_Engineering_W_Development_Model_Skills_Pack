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
  checkHierarchy,
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
  it('manifest 缺 basePath → checkTlaModel 返回 passed=false，violations 含 "basePath 缺失"', () => {
    const m = makeValidManifestWithoutBasePath();
    const result = checkTlaModel(m, 2);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('basePath 缺失'))).toBe(true);
  });

  it('manifest basePath 存在 → 不报缺失', () => {
    const m = makeValidManifestWithoutBasePath() as { basePath?: unknown };
    m.basePath = '.';
    const result = checkTlaModel(m, 2);
    expect(result.violations.some((v) => v.includes('basePath 缺失'))).toBe(false);
  });

  it('basePath 为空字符串 → 报缺失', () => {
    const m = makeValidManifestWithoutBasePath() as { basePath?: unknown };
    m.basePath = '';
    const result = checkTlaModel(m, 2);
    // schema minLength:1 前置拦截空字符串（[schema] 前缀），业务规则 basePath 缺失不再触达
    expect(result.violations.some((v) => /\[schema\].*basePath/.test(v))).toBe(true);
  });

  it('basePath 为非字符串 → 报缺失', () => {
    const m = makeValidManifestWithoutBasePath() as { basePath?: unknown };
    m.basePath = 123;
    const result = checkTlaModel(m, 2);
    // schema type:string 前置拦截非字符串（[schema] 前缀），业务规则 basePath 缺失不再触达
    expect(result.violations.some((v) => /\[schema\].*basePath/.test(v))).toBe(true);
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

  it('spec 缺 requirementIds（空数组）→ violation', () => {
    const specs = [{ ...baseSpec, id: 'L1_system', requirementIds: [] }];
    const result = checkCoverage(specs as TlaSpec[], ['SD-001']);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('L1_system 缺 requirementIds'))).toBe(true);
  });

  it('spec requirementIds 无 SD-xxx 标识 → violation', () => {
    const specs = [{ ...baseSpec, id: 'L1_system', requirementIds: ['REQ-001'] }];
    const result = checkCoverage(specs as TlaSpec[], ['SD-001']);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('无 SD 标识'))).toBe(true);
  });

  it('spec requirementIds 含 SD-xxx → 通过 spec 方向', () => {
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

// ==================== G-D D1：Invariants == 命名兼容 ====================

describe('G-D D1 cfg-tla 不变式命名兼容 Invariants ==', () => {
  const tlaInvariants = `
Invariants ==
    /\\ TypeOK
    /\\ AuthInvariant
`;

  it('tla 用 Invariants == 定义，cfg 用 INVARIANT 逐行声明 → passed=true', () => {
    const cfg = 'SPECIFICATION Spec\nINVARIANT TypeOK\nINVARIANT AuthInvariant';
    const result = checkCfgInvariantsConsistency(tlaInvariants, cfg);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('tla 用 Invariants == 定义，cfg 缺一项 → 报缺失不变式', () => {
    const cfg = 'SPECIFICATION Spec\nINVARIANT TypeOK';
    const result = checkCfgInvariantsConsistency(tlaInvariants, cfg);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('缺失不变式'))).toBe(true);
  });

  it('tla 用 BusinessInvariant == 定义（向后兼容）→ passed=true', () => {
    const tla = `
BusinessInvariant ==
    /\\ TypeOK
    /\\ AuthInvariant
`;
    const cfg = 'SPECIFICATION Spec\nINVARIANT TypeOK\nINVARIANT AuthInvariant';
    const result = checkCfgInvariantsConsistency(tla, cfg);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});

// ==================== G-D D2：INVARIANT 格式死分支 ====================

describe('G-D D2 cfg INVARIANT 格式死分支', () => {
  it('cfg 含裸 INVARIANT（无不变式名）→ 报缺少不变式名', () => {
    const result = checkCfgStructure('SPECIFICATION Spec\nINVARIANT\nINIT Init');
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('INVARIANT 缺少不变式名'))).toBe(true);
  });

  it('cfg 含裸 INVARIANT 带尾随空格 → 报缺少不变式名', () => {
    const result = checkCfgStructure('SPECIFICATION Spec\nINVARIANT   \nINIT Init');
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('INVARIANT 缺少不变式名'))).toBe(true);
  });

  it('cfg INVARIANT 后跟不变式名 → passed=true', () => {
    const result = checkCfgStructure('SPECIFICATION Spec\nINVARIANT TypeOK\nINIT Init');
    expect(result.passed).toBe(true);
  });

  it('cfg INVARIANTS 关键字跟列表 → passed=true（不变式行本身不报错）', () => {
    const result = checkCfgStructure('SPECIFICATION Spec\nINVARIANTS TypeOK AuthInvariant\nINIT Init');
    expect(result.passed).toBe(true);
  });
});

// ==================== G-D D3：@phase 严格 ====================

describe('G-D D3 @phase 解析拒绝非整数', () => {
  it('@phase="4x" 通过 validateHeader 应触发 violation', () => {
    const header: Record<string, string | null> = {
      system: 'test',
      phase: '4x',
    };
    const spec = { id: 'L1-test', level: 'L1' as const, phase: 4 };
    const violations = validateHeader(header, spec as never);
    expect(violations.some((v) => v.includes('@phase="4x"'))).toBe(true);
  });

  it('@phase="3.9" 通过 validateHeader 应触发 violation', () => {
    const header: Record<string, string | null> = {
      system: 'test',
      phase: '3.9',
    };
    const spec = { id: 'L1-test', level: 'L1' as const, phase: 3 };
    const violations = validateHeader(header, spec as never);
    expect(violations.some((v) => v.includes('@phase="3.9"'))).toBe(true);
  });

  it('@phase="4" 正常整数 → 不触发 violation', () => {
    const header: Record<string, string | null> = {
      system: 'test',
      phase: '4',
    };
    const spec = { id: 'L1-test', level: 'L1' as const, phase: 4 };
    const violations = validateHeader(header, spec as never);
    expect(violations.some((v) => v.includes('@phase'))).toBe(false);
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

// ==================== S2：层次校验区分「属后续阶段」的 child ====================
//
// 缺陷：`--phase` 收窄校验范围后，被过滤掉的 child/parent/sibling 路径不在 `byPath` 中，
// 原实现一律报「不在 manifest 中」——把「校验范围收窄」误报成「manifest 未登记」。
// 裁定：命中 `filteredOutPaths` 时改报「属后续阶段（phase=N；当前校验 phase=M 不包含它），
// 不算 manifest 缺失」；未命中一律保留原文案（判定结果不变，仍拦截）。

describe('S2 checkHierarchy 区分 phase 过滤掉的 child/parent/sibling', () => {
  it('reports children filtered out by phase as later-phase specs, not as unregistered paths', () => {
    const l1 = {
      id: 'L1_counter',
      level: 'L1',
      phase: 1,
      tlaPath: 'tla/L1_counter.tla',
      cfgPath: 'tla/L1_counter.cfg',
      parent: null,
      children: ['tla/L2_counter_service.tla'],
      siblings: [],
    } as unknown as TlaSpec;
    const violations = checkHierarchy([l1], {
      filteredOutPaths: new Set(['tla/L2_counter_service.tla']),
      fullPhaseByPath: new Map([['tla/L2_counter_service.tla', 2]]),
      phase: 1,
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('属后续阶段');
    expect(violations[0]).toContain('phase=2');
    expect(violations[0]).not.toContain('不在 manifest 中');
  });

  it('still reports genuinely unregistered children as missing from the manifest', () => {
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

  it('parent 分支同款：被 phase 过滤掉的 parent 报「属后续阶段」，不报 manifest 缺失', () => {
    const root = {
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
    const violations = checkHierarchy([root, child], {
      filteredOutPaths: new Set(['tla/L4_counter_impl.tla']),
      fullPhaseByPath: new Map([['tla/L4_counter_impl.tla', 4]]),
      phase: 1,
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('parent="tla/L4_counter_impl.tla"');
    expect(violations[0]).toContain('属后续阶段');
    expect(violations[0]).toContain('phase=4');
    expect(violations[0]).not.toContain('不在 manifest 中');
  });

  it('sibling 分支同款：被 phase 过滤掉的 sibling 报「属后续阶段」，不报 manifest 缺失', () => {
    const root = {
      id: 'L1_counter',
      level: 'L1',
      phase: 1,
      tlaPath: 'tla/L1_counter.tla',
      cfgPath: 'tla/L1_counter.cfg',
      parent: null,
      children: [],
      siblings: ['tla/L3_counter_deep.tla'],
    } as unknown as TlaSpec;
    const violations = checkHierarchy([root], {
      filteredOutPaths: new Set(['tla/L3_counter_deep.tla']),
      fullPhaseByPath: new Map([['tla/L3_counter_deep.tla', 3]]),
      phase: 1,
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('sibling="tla/L3_counter_deep.tla"');
    expect(violations[0]).toContain('属后续阶段');
    expect(violations[0]).toContain('phase=3');
    expect(violations[0]).not.toContain('不在 manifest 中');
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
