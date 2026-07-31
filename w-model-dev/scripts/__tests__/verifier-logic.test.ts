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
import { validateEvidenceFormat, checkR13SingleAxisFloor, checkVerifierOutput } from '../verifier-logic.js';

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

describe('[round28 G-B B11] evidence 扣分后 passed 重算', () => {
  it('evidence 空泛导致 compositeScore 降级、qualityLevel 重新判定、passed 自洽', () => {
    const output = {
      schemaVersion: '1.0',
      meta: {
        targetKind: 'requirement',
        target: 'REQ-001',
        reviewedAt: '2026-07-31T00:00:00Z',
        agent: 'test-agent',
        scoringMethod: 'logits',
        repeatTimes: 3,
        varianceThreshold: 0.10,
      },
      subCriteria: [
        { name: 'completeness', weight: 0.30, score: 0.72, rawScores: [0.71, 0.72, 0.73], variance: 0.0000667, evidence: '质量良好' },
        { name: 'clarity', weight: 0.25, score: 0.72, rawScores: [0.71, 0.72, 0.73], variance: 0.0000667, evidence: '评审通过' },
        { name: 'consistency', weight: 0.20, score: 0.72, rawScores: [0.71, 0.72, 0.73], variance: 0.0000667, evidence: 'requirements.md.REQ-001.section=3.2' },
        { name: 'testability', weight: 0.15, score: 0.72, rawScores: [0.71, 0.72, 0.73], variance: 0.0000667, evidence: 'requirements.md.REQ-001.section=3.4' },
        { name: 'traceability', weight: 0.10, score: 0.72, rawScores: [0.71, 0.72, 0.73], variance: 0.0000667, evidence: 'rtm.json.REQ-001.coverage=full' },
      ],
      compositeScore: 0.72,
      qualityLevel: 'B',
      summary: 'REQ-001 需求覆盖基本完整，采用 RBAC 权限模型，可测试，遗留风险：无，待运行时验证确认。',
      passed: true,
    };
    const result = checkVerifierOutput(output);
    // evidence 扣分: 0.72 - 0.1 = 0.62 → qualityLevel 'C' → passed=false（round28 B11）
    expect(result.compositeScore).toBeLessThan(0.72);
    expect(result.qualityLevel).toBe('C');
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => r.includes('evidence 格式校验失败'))).toBe(true);
  });

  it('evidence 合法时不扣分，passed 基于原始 compositeScore 判定', () => {
    const output = {
      schemaVersion: '1.0',
      meta: {
        targetKind: 'requirement',
        target: 'REQ-001',
        reviewedAt: '2026-07-31T00:00:00Z',
        agent: 'test-agent',
        scoringMethod: 'logits',
        repeatTimes: 3,
        varianceThreshold: 0.10,
      },
      subCriteria: [
        { name: 'completeness', weight: 0.30, score: 0.72, rawScores: [0.71, 0.72, 0.73], variance: 0.0000667, evidence: 'requirements.md.REQ-001.section=3.2' },
        { name: 'clarity', weight: 0.25, score: 0.72, rawScores: [0.71, 0.72, 0.73], variance: 0.0000667, evidence: 'requirements.md.REQ-001.section=3.2' },
        { name: 'consistency', weight: 0.20, score: 0.72, rawScores: [0.71, 0.72, 0.73], variance: 0.0000667, evidence: 'requirements.md.REQ-001.section=3.2' },
        { name: 'testability', weight: 0.15, score: 0.72, rawScores: [0.71, 0.72, 0.73], variance: 0.0000667, evidence: 'requirements.md.REQ-001.section=3.4' },
        { name: 'traceability', weight: 0.10, score: 0.72, rawScores: [0.71, 0.72, 0.73], variance: 0.0000667, evidence: 'rtm.json.REQ-001.coverage=full' },
      ],
      compositeScore: 0.72,
      qualityLevel: 'B',
      summary: 'REQ-001 需求覆盖基本完整，采用 RBAC 权限模型，可测试，遗留风险：无，待运行时验证确认。',
      passed: true,
    };
    const result = checkVerifierOutput(output);
    // 无 evidence 扣分，passed 保持 true（B 级 + 全部 ≥ 0.70）
    expect(result.passed).toBe(true);
    expect(result.qualityLevel).toBe('B');
    expect(result.compositeScore).toBe(0.72);
  });
});
