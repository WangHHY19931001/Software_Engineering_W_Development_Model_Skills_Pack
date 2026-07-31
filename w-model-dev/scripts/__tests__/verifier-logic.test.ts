/**
 * verifier-logic.test.ts —— [21.0.0] evidence 格式校验 + [26.0.0] R13 单轴下限单元测试
 *
 * 覆盖 verifier-logic.ts 中 validateEvidenceFormat 函数：
 *   - 合法 evidence（key=value 格式）通过
 *   - 空泛声明（C1-C10 全通过 / 质量良好 / 评审通过）命中 O3
 *
 * [26.0.0] 覆盖 checkR13SingleAxisFloor 函数（单轴下限，反模式 #41）：
 *   - 全部子标准 ≥ 0.70 → 无违规
 *   - 任一子标准 < 0.70 → 违规列表含该子标准名
 */

import { describe, expect, it } from 'vitest';
import { validateEvidenceFormat, checkR13SingleAxisFloor } from '../verifier-logic.js';

describe('[21.0.0] evidence 格式校验', () => {
  it('合法 evidence（key=value 格式）应通过', () => {
    const evidence = ['req-001.md=需求完整覆盖用户故事', 'article.service.ts=认证模块 JWT 校验逻辑'];
    const result = validateEvidenceFormat(evidence);
    expect(result.valid).toBe(true);
    expect(result.vagueItems).toEqual([]);
  });

  it('"C1-C10 全通过" 应判定为空泛声明', () => {
    const result = validateEvidenceFormat(['C1-C10 全通过']);
    expect(result.valid).toBe(false);
    expect(result.vagueItems).toContain('C1-C10 全通过');
  });

  it('"质量良好" 应判定为空泛声明', () => {
    const result = validateEvidenceFormat(['质量良好']);
    expect(result.valid).toBe(false);
    expect(result.vagueItems).toContain('质量良好');
  });

  it('"评审通过" 应判定为空泛声明', () => {
    const result = validateEvidenceFormat(['评审通过']);
    expect(result.valid).toBe(false);
    expect(result.vagueItems).toContain('评审通过');
  });
});

describe('[26.0.0] R13 单轴下限（反模式 #41）', () => {
  it('全部子标准 ≥ 0.70 应无违规', () => {
    const subCriteria = [
      { name: 'completeness', score: 0.90 },
      { name: 'clarity', score: 0.85 },
      { name: 'consistency', score: 0.70 },
      { name: 'testability', score: 0.80 },
      { name: 'traceability', score: 0.95 },
    ];
    const violations = checkR13SingleAxisFloor(subCriteria);
    expect(violations).toEqual([]);
  });

  it('任一子标准 < 0.70 应命中违规（含子标准名）', () => {
    const subCriteria = [
      { name: 'completeness', score: 0.65 },
      { name: 'clarity', score: 0.95 },
      { name: 'consistency', score: 0.95 },
      { name: 'testability', score: 0.95 },
      { name: 'traceability', score: 0.95 },
    ];
    const violations = checkR13SingleAxisFloor(subCriteria);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('completeness');
    expect(violations[0]).toContain('0.65');
    expect(violations[0]).toContain('0.7');
  });

  it('边界值 0.70 本身不应命中（B 级分界含等号）', () => {
    const subCriteria = [
      { name: 'completeness', score: 0.70 },
      { name: 'clarity', score: 0.70 },
      { name: 'consistency', score: 0.70 },
      { name: 'testability', score: 0.70 },
      { name: 'traceability', score: 0.70 },
    ];
    const violations = checkR13SingleAxisFloor(subCriteria);
    expect(violations).toEqual([]);
  });

  it('非数组输入应返回空违规列表', () => {
    expect(checkR13SingleAxisFloor(undefined as unknown as unknown[])).toEqual([]);
    expect(checkR13SingleAxisFloor('not-array' as unknown as unknown[])).toEqual([]);
  });
});
