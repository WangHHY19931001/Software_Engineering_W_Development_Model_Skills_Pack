/**
 * tla-logic.ts 单元测试 —— TLA+ 模型校验纯逻辑
 *
 * 覆盖：
 *   - P1.1 manifest.basePath 强制字段校验
 *     - 缺失 → 报缺失
 *     - 存在 → 不报缺失
 *     - 空字符串 → 报缺失
 *     - 非字符串 → 报缺失
 */

import { describe, expect, it } from 'vitest';
import { checkTlaModel } from '../tla-logic.js';

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
    expect(result.violations.some(v => v.includes('basePath 缺失'))).toBe(true);
  });

  it('basePath 为非字符串 → 报缺失', () => {
    const m = makeValidManifestWithoutBasePath() as { basePath?: unknown };
    m.basePath = 123;
    const result = checkTlaModel(m, 2);
    expect(result.violations.some(v => v.includes('basePath 缺失'))).toBe(true);
  });
});
