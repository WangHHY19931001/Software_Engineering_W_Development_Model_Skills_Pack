/**
 * phase-doc-map.test.ts —— lib/phase-doc-map.ts 阶段文档路径映射单元测试
 *
 * 覆盖：
 *   - PHASE_DOC_MAP 键为 1-8（缺 5：阶段 5 无独立文档目录）
 *   - phase 1 的 uat-path-mapping 特殊映射（resolvePhaseDoc(1, 'uat-path-mapping')）
 *   - resolvePhaseDoc 支持/不支持分支（未支持 phase / 未知 type 抛错消息含 directory-conventions.md §1）
 */

import { describe, expect, it } from 'vitest';

import { PHASE_DOC_MAP, resolvePhaseDoc } from '../lib/phase-doc-map.js';

describe('PHASE_DOC_MAP', () => {
  it('键为 1/2/3/4/6/7/8（阶段 5 无独立文档目录）', () => {
    expect(Object.keys(PHASE_DOC_MAP).map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 6, 7, 8]);
    expect(PHASE_DOC_MAP[5]).toBeUndefined();
  });

  it('phase 1 含 uat-path-mapping 特殊映射', () => {
    expect(PHASE_DOC_MAP[1]!['uat-path-mapping']).toBe('docs/uat-path-mapping.md');
  });

  it('阶段文档路径均以 docs/ 为前缀', () => {
    for (const phaseMap of Object.values(PHASE_DOC_MAP)) {
      for (const p of Object.values(phaseMap)) {
        expect(p.startsWith('docs/')).toBe(true);
      }
    }
  });
});

describe('resolvePhaseDoc', () => {
  it('支持的 phase + type 返回相对路径', () => {
    expect(resolvePhaseDoc(1, 'uat-path-mapping')).toBe('docs/uat-path-mapping.md');
    expect(resolvePhaseDoc(1, 'requirement-spec')).toBe('docs/phase1-requirements/requirement-spec.md');
    expect(resolvePhaseDoc(2, 'system-design')).toBe('docs/phase2-design/{module}-system-design.md');
    expect(resolvePhaseDoc(8, 'acceptance-test-phase8')).toBe('docs/phase8-acceptance-test/acceptance-test.md');
  });

  it('未支持的 phase（含 5）抛错且消息含 directory-conventions.md §1', () => {
    expect(() => resolvePhaseDoc(5, 'system-design')).toThrow(/未支持的 phase=5/);
    expect(() => resolvePhaseDoc(9, 'system-design')).toThrow(/未支持的 phase=9/);
    expect(() => resolvePhaseDoc(5, 'any')).toThrow(/directory-conventions\.md §1/);
  });

  it('未知 type 抛错且消息含映射信息', () => {
    expect(() => resolvePhaseDoc(1, 'unknown-type')).toThrow(/无 type="unknown-type" 映射/);
    expect(() => resolvePhaseDoc(3, 'system-design')).toThrow(/无 type="system-design" 映射/);
  });
});
