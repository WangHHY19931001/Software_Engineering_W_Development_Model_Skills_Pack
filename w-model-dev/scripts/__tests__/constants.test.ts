/**
 * constants.test.ts —— lib/constants.ts 门禁常量单元测试
 *
 * 覆盖：
 *   - RTM_FIELDS 七个追溯字段（顺序与 gate-logic REQUIRED_TRACE_FIELDS 语义一致）
 *   - PHASES 阶段枚举 1-8
 *   - ARTIFACT_PATHS .w-model 工件相对路径
 */

import { describe, expect, it } from 'vitest';

import { RTM_FIELDS, PHASES, ARTIFACT_PATHS } from '../lib/constants.js';

describe('RTM_FIELDS', () => {
  it('包含七个追溯字段且顺序稳定', () => {
    expect(RTM_FIELDS).toEqual([
      'description',
      'designDoc',
      'codeModule',
      'unitTest',
      'integrationTest',
      'systemTest',
      'acceptanceTest',
    ]);
  });

  it('元组形态（as const）可作 readonly 联合消费', () => {
    expect(RTM_FIELDS).toHaveLength(7);
    expect(RTM_FIELDS).toContain('codeModule');
    expect(RTM_FIELDS).toContain('acceptanceTest');
  });
});

describe('PHASES', () => {
  it('阶段枚举为 1-8', () => {
    expect(PHASES).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('Phase 联合类型覆盖端点（编译期由 (typeof PHASES)[number] 保证，运行期校验值域）', () => {
    expect(PHASES).toHaveLength(8);
    expect(PHASES[0]).toBe(1);
    expect(PHASES[PHASES.length - 1]).toBe(8);
  });
});

describe('ARTIFACT_PATHS', () => {
  it('.w-model 工件相对路径单点事实源', () => {
    expect(ARTIFACT_PATHS).toEqual({
      rtm: '.w-model/rtm.json',
      tlaManifest: '.w-model/tla-manifest.json',
      bddManifest: '.w-model/bdd-manifest.json',
    });
  });

  it('路径均以 .w-model/ 为前缀', () => {
    for (const p of Object.values(ARTIFACT_PATHS)) {
      expect(p.startsWith('.w-model/')).toBe(true);
    }
  });
});
