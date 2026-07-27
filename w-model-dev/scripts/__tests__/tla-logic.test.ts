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
import { checkTlaModel, checkCoverage, type TlaSpec } from '../tla-logic.js';

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
