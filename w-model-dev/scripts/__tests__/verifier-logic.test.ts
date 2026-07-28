/**
 * verifier-logic.test.ts —— [21.0.0] evidence 格式校验单元测试
 *
 * 覆盖 verifier-logic.ts 中 validateEvidenceFormat 函数：
 *   - 合法 evidence（key=value 格式）通过
 *   - 空泛声明（C1-C10 全通过 / 质量良好 / 评审通过）命中 O3
 */

import { describe, expect, it } from 'vitest';
import { validateEvidenceFormat } from '../verifier-logic.js';

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
