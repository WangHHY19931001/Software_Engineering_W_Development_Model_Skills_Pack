/**
 * verifier-logic.test.ts —— [21.0.0] evidence 格式校验 + [26.0.0] R13 单轴下限单元测试
 *
 * 覆盖 verifier-logic.ts 中 validateEvidenceFormat 函数：
 *   - 合法 evidence（冒号格式）通过
 *   - 空泛声明（C1-C10 全通过 / 质量良好 / 评审通过）命中 O3
 *
 * [26.0.0] 覆盖 checkR13SingleAxisFloor 函数（单轴下限，反模式 #41）：
 *   - 全部子标准 ≥ 0.70 → 无违规
 *   - 任一子标准 < 0.70 → 违规列表含该子标准名
 */

import { describe, expect, it } from 'vitest';

import { validateEvidenceFormat, checkR13SingleAxisFloor, checkVerifierOutput } from '../logic/verifier-logic.js';

describe('[21.0.0] evidence 格式校验', () => {
  it('合法 evidence（冒号格式）应通过', () => {
    const evidence = [
      'docs/phase1-requirements/requirement-spec.md:§1.1=需求完整覆盖用户故事',
      'src/article.service.ts:L42=认证模块 JWT 校验逻辑',
    ];
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
      { name: 'completeness', score: 0.9 },
      { name: 'clarity', score: 0.85 },
      { name: 'consistency', score: 0.7 },
      { name: 'testability', score: 0.8 },
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
      { name: 'completeness', score: 0.7 },
      { name: 'clarity', score: 0.7 },
      { name: 'consistency', score: 0.7 },
      { name: 'testability', score: 0.7 },
      { name: 'traceability', score: 0.7 },
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
        varianceThreshold: 0.1,
      },
      subCriteria: [
        {
          name: 'completeness',
          weight: 0.3,
          score: 0.72,
          rawScores: [0.71, 0.72, 0.73],
          variance: 0.0000667,
          evidence: '质量良好',
        },
        {
          name: 'clarity',
          weight: 0.25,
          score: 0.72,
          rawScores: [0.71, 0.72, 0.73],
          variance: 0.0000667,
          evidence: '评审通过',
        },
        {
          name: 'consistency',
          weight: 0.2,
          score: 0.72,
          rawScores: [0.71, 0.72, 0.73],
          variance: 0.0000667,
          evidence: 'requirements.md:§3.2=REQ-001 需求覆盖',
        },
        {
          name: 'testability',
          weight: 0.15,
          score: 0.72,
          rawScores: [0.71, 0.72, 0.73],
          variance: 0.0000667,
          evidence: 'requirements.md:§3.4=REQ-001 需求覆盖',
        },
        {
          name: 'traceability',
          weight: 0.1,
          score: 0.72,
          rawScores: [0.71, 0.72, 0.73],
          variance: 0.0000667,
          evidence: 'rtm.json:§REQ-001=coverage full',
        },
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
    expect(result.reasons.some((r) => r.includes('evidence 格式校验失败'))).toBe(true);
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
        varianceThreshold: 0.1,
      },
      subCriteria: [
        {
          name: 'completeness',
          weight: 0.3,
          score: 0.72,
          rawScores: [0.71, 0.72, 0.73],
          variance: 0.0000667,
          evidence: 'requirements.md:§3.2=REQ-001 需求覆盖',
        },
        {
          name: 'clarity',
          weight: 0.25,
          score: 0.72,
          rawScores: [0.71, 0.72, 0.73],
          variance: 0.0000667,
          evidence: 'requirements.md:§3.2=REQ-001 需求覆盖',
        },
        {
          name: 'consistency',
          weight: 0.2,
          score: 0.72,
          rawScores: [0.71, 0.72, 0.73],
          variance: 0.0000667,
          evidence: 'requirements.md:§3.2=REQ-001 需求覆盖',
        },
        {
          name: 'testability',
          weight: 0.15,
          score: 0.72,
          rawScores: [0.71, 0.72, 0.73],
          variance: 0.0000667,
          evidence: 'requirements.md:§3.4=REQ-001 需求覆盖',
        },
        {
          name: 'traceability',
          weight: 0.1,
          score: 0.72,
          rawScores: [0.71, 0.72, 0.73],
          variance: 0.0000667,
          evidence: 'rtm.json:§REQ-001=coverage full',
        },
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

describe('EVIDENCE_PATTERN 冒号格式', () => {
  it('应接受 path:§section=statement 格式', () => {
    const result = validateEvidenceFormat(['docs/phase1-requirements/requirement-spec.md:§1.1=32 需求齐全']);
    expect(result.valid).toBe(true);
  });

  it('应接受 path:L42=statement 格式', () => {
    const result = validateEvidenceFormat(['src/auth.ts:L42-58=JWT 签发逻辑']);
    expect(result.valid).toBe(true);
  });

  it('应拒绝 path.field=value 点号格式', () => {
    const result = validateEvidenceFormat(['coverage.json.matrices.stakeholder.coverage=100%']);
    expect(result.valid).toBe(false);
  });
});

describe('[41.8.0] targetKind=rootcause（§7.5 V 复审根因报告）', () => {
  const baseRootcause = {
    schemaVersion: '1.0',
    meta: {
      targetKind: 'rootcause' as const,
      target: 'RC-phase5-1-01',
      reviewedAt: '2026-08-12T00:00:00Z',
      agent: 'test-agent',
      scoringMethod: 'logits' as const,
      repeatTimes: 3,
      varianceThreshold: 0.1,
    },
    subCriteria: [
      { name: 'correctness', weight: 0.25, score: 0.9, rawScores: [0.89, 0.9, 0.91], variance: 0.0000667, evidence: 'rootcause.json:§4.2=rootCauseChain[0].evidence 支持该步 answer' },
      { name: 'completeness', weight: 0.25, score: 0.85, rawScores: [0.84, 0.85, 0.86], variance: 0.0000667, evidence: 'rootcause.json:§4.3=rootCauseChain 共 3 步触及根本原因' },
      { name: 'falsifiability', weight: 0.2, score: 0.88, rawScores: [0.87, 0.88, 0.89], variance: 0.0000667, evidence: 'rootcause.json:§4.4=falsifiabilityCheck 含可验证假设' },
      { name: 'actionability', weight: 0.15, score: 0.8, rawScores: [0.79, 0.8, 0.81], variance: 0.0000667, evidence: 'rootcause.json:§5.1=fixRecommendation[0] 四字段' },
      { name: 'prevention', weight: 0.15, score: 0.95, rawScores: [0.94, 0.95, 0.96], variance: 0.0000667, evidence: 'rootcause.json:§5.2=prevention[0] 三字段' },
    ],
    compositeScore: 0.876,
    qualityLevel: 'A' as const,
    summary: 'RC-phase5-1-01 根因链逻辑自洽，可证伪假设成立，修复建议与预防措施可执行，V 复审结论：通过。',
    passed: true,
  };

  it('合法 rootcause VerifierOutput（§7.5 子标准 + 权重）应通过', () => {
    const result = checkVerifierOutput(baseRootcause);
    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('rootcause 误用 test 集合子标准名称应被拦截', () => {
    const bad = {
      ...baseRootcause,
      subCriteria: baseRootcause.subCriteria.map((sc) => ({ ...sc, name: sc.name === 'correctness' ? 'coverage' : sc.name })),
    };
    const result = checkVerifierOutput(bad);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((m: string) => /subCriteria.*name 应为/.test(m))).toBe(true);
  });

  it('rootcause 子标准权重被改动应被拦截', () => {
    const bad = {
      ...baseRootcause,
      subCriteria: baseRootcause.subCriteria.map((sc, i) => (i === 0 ? { ...sc, weight: 0.3 } : sc)),
      compositeScore: 0.901,
    };
    const result = checkVerifierOutput(bad);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((m: string) => /weight 应为/.test(m))).toBe(true);
  });

  it('非法 targetKind 仍被枚举拦截（rootcause 之外的任意值）', () => {
    const bad = { ...baseRootcause, meta: { ...baseRootcause.meta, targetKind: 'report' } };
    const result = checkVerifierOutput(bad);
    expect(result.passed).toBe(false);
    // schema enum 前置拦截（[schema] 前缀）或逻辑层枚举校验均视为拦截成功
    expect(result.reasons.some((m: string) => /targetKind/.test(m))).toBe(true);
  });
});
