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
  validateHeader,
  type TlaSpec,
} from '../tla-logic.js';

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
  };
}

// ==================== P1.1 basePath 强制字段校验 ====================

describe('P1.1 manifest.basePath 强制字段校验', () => {
  it('manifest 缺 basePath → checkTlaModel 返回 passed=false，violations 含 "basePath 缺失"', () => {
    const m = makeValidManifestWithoutBasePath();
    const result = checkTlaModel(m, 2);
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.includes('basePath 缺失'))).toBe(true);
  });

  it('manifest basePath 存在 → 不报缺失', () => {
    const m = makeValidManifestWithoutBasePath() as { basePath?: unknown };
    m.basePath = '.';
    const result = checkTlaModel(m, 2);
    expect(result.violations.some(v => v.includes('basePath 缺失'))).toBe(false);
  });

  it('basePath 为空字符串 → 报缺失', () => {
    const m = makeValidManifestWithoutBasePath() as { basePath?: unknown };
    m.basePath = '';
    const result = checkTlaModel(m, 2);
    // schema minLength:1 前置拦截空字符串（[schema] 前缀），业务规则 basePath 缺失不再触达
    expect(result.violations.some(v => /\[schema\].*basePath/.test(v))).toBe(true);
  });

  it('basePath 为非字符串 → 报缺失', () => {
    const m = makeValidManifestWithoutBasePath() as { basePath?: unknown };
    m.basePath = 123;
    const result = checkTlaModel(m, 2);
    // schema type:string 前置拦截非字符串（[schema] 前缀），业务规则 basePath 缺失不再触达
    expect(result.violations.some(v => /\[schema\].*basePath/.test(v))).toBe(true);
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
    expect(result.violations.some(v => v.includes('L1_system 缺 requirementIds'))).toBe(true);
  });

  it('spec requirementIds 无 SD-xxx 标识 → violation', () => {
    const specs = [{ ...baseSpec, id: 'L1_system', requirementIds: ['REQ-001'] }];
    const result = checkCoverage(specs as TlaSpec[], ['SD-001']);
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.includes('无 SD 标识'))).toBe(true);
  });

  it('spec requirementIds 含 SD-xxx → 通过 spec 方向', () => {
    const specs = [{ ...baseSpec, id: 'L1_system', requirementIds: ['SD-001', 'REQ-001'] }];
    const result = checkCoverage(specs as TlaSpec[], ['SD-001']);
    // 注意：只要 SD-001 被覆盖且 spec 含 SD 标识就通过
    expect(result.violations.some(v => v.includes('缺 requirementIds'))).toBe(false);
    expect(result.violations.some(v => v.includes('无 SD 标识'))).toBe(false);
  });

  it('L1/L2/L3/L4 全规格无例外', () => {
    // 测试各层级 spec 都须遵守
    for (const level of ['L1', 'L2', 'L3', 'L4'] as const) {
      const specs = [{ ...baseSpec, id: `${level}_test`, level, requirementIds: [] }];
      const result = checkCoverage(specs as TlaSpec[], ['SD-001']);
      expect(result.violations.some(v => v.includes(`${level}_test 缺 requirementIds`))).toBe(true);
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
    expect(result.violations.some(v => v.includes('缺失不变式'))).toBe(true);
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
    expect(result.violations.some(v => v.includes('INVARIANT 缺少不变式名'))).toBe(true);
  });

  it('cfg 含裸 INVARIANT 带尾随空格 → 报缺少不变式名', () => {
    const result = checkCfgStructure('SPECIFICATION Spec\nINVARIANT   \nINIT Init');
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.includes('INVARIANT 缺少不变式名'))).toBe(true);
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
    expect(violations.some(v => v.includes('@phase="4x"'))).toBe(true);
  });

  it('@phase="3.9" 通过 validateHeader 应触发 violation', () => {
    const header: Record<string, string | null> = {
      system: 'test',
      phase: '3.9',
    };
    const spec = { id: 'L1-test', level: 'L1' as const, phase: 3 };
    const violations = validateHeader(header, spec as never);
    expect(violations.some(v => v.includes('@phase="3.9"'))).toBe(true);
  });

  it('@phase="4" 正常整数 → 不触发 violation', () => {
    const header: Record<string, string | null> = {
      system: 'test',
      phase: '4',
    };
    const spec = { id: 'L1-test', level: 'L1' as const, phase: 4 };
    const violations = validateHeader(header, spec as never);
    expect(violations.some(v => v.includes('@phase'))).toBe(false);
  });
});
