/**
 * verifier-logic.ts 单元测试
 *
 * 验证外部 Agent 产出的 VerifierOutput JSON 是否被正确校验，
 * 覆盖 verifier-spec.md §6 Schema 的各项约束。
 */

import { describe, it, expect } from '@jest/globals';
import {
  checkVerifierOutput,
  determineQualityLevel,
  SUB_CRITERIA,
  type VerifierOutputShape,
} from '../w-model-dev/scripts/verifier-logic.js';

// ==================== 工具：构造合法 VerifierOutput ====================

/**
 * 计算样本方差（与 verifier-logic.ts 的 computeVariance 保持一致）。
 * 测试 fixture 用此函数生成与 rawScores 自洽的 variance 字段。
 */
function computeVariance(scores: number[]): number {
  if (scores.length < 2) return 0;
  const mean = scores.reduce((s, x) => s + x, 0) / scores.length;
  const sumSq = scores.reduce((s, x) => s + (x - mean) * (x - mean), 0);
  return sumSq / scores.length;
}

function makeValidOutput(overrides: Partial<VerifierOutputShape> = {}): VerifierOutputShape {
  const expected = SUB_CRITERIA.requirement;
  // 使用完全相同的 rawScores，使 variance=0（自洽，通过防漂移校验）
  const rawScores = [0.80, 0.80, 0.80];
  const variance = computeVariance(rawScores);
  return {
    schemaVersion: '1.0',
    meta: {
      targetKind: 'requirement',
      target: 'REQ-001',
      reviewedAt: '2026-07-17T00:00:00.000Z',
      agent: 'test-agent',
      scoringMethod: 'logits',
      repeatTimes: 3,
      varianceThreshold: 0.10,
    },
    subCriteria: expected.map((sc, i) => ({
      name: sc.name,
      weight: sc.weight,
      score: 0.8,
      rawScores: [...rawScores],
      variance,
      evidence: `行 ${i + 10}`,
    })),
    compositeScore: 0.8,
    qualityLevel: 'B',
    summary: '需求基本达成',
    passed: true,
    ...overrides,
  };
}

describe('verifier-logic - determineQualityLevel', () => {
  it('[0.85, 1.00] → A', () => {
    expect(determineQualityLevel(0.85)).toBe('A');
    expect(determineQualityLevel(1.0)).toBe('A');
  });
  it('[0.70, 0.85) → B', () => {
    expect(determineQualityLevel(0.70)).toBe('B');
    expect(determineQualityLevel(0.8499)).toBe('B');
  });
  it('[0.50, 0.70) → C', () => {
    expect(determineQualityLevel(0.50)).toBe('C');
    expect(determineQualityLevel(0.6999)).toBe('C');
  });
  it('[0.00, 0.50) → D', () => {
    expect(determineQualityLevel(0.0)).toBe('D');
    expect(determineQualityLevel(0.4999)).toBe('D');
  });
});

describe('verifier-logic - SUB_CRITERIA 权重和为 1', () => {
  it('requirement 权重和 = 1.0', () => {
    const sum = SUB_CRITERIA.requirement.reduce((s, x) => s + x.weight, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-9);
  });
  it('design 权重和 = 1.0', () => {
    const sum = SUB_CRITERIA.design.reduce((s, x) => s + x.weight, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-9);
  });
  it('testcase 权重和 = 1.0', () => {
    const sum = SUB_CRITERIA.testcase.reduce((s, x) => s + x.weight, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-9);
  });
  it('file 权重和 = 1.0', () => {
    const sum = SUB_CRITERIA.file.reduce((s, x) => s + x.weight, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-9);
  });
});

describe('verifier-logic - checkVerifierOutput 合法输出', () => {
  it('完全合法的输出通过校验', () => {
    const r = checkVerifierOutput(makeValidOutput());
    expect(r.passed).toBe(true);
    expect(r.reasons).toHaveLength(0);
    expect(r.compositeScore).toBe(0.8);
    expect(r.qualityLevel).toBe('B');
  });

  it('不同 targetKind 均通过校验', () => {
    for (const kind of ['requirement', 'design', 'testcase', 'file'] as const) {
      const o = makeValidOutput({
        meta: { ...makeValidOutput().meta, targetKind: kind },
        subCriteria: SUB_CRITERIA[kind].map((sc, i) => ({
          name: sc.name,
          weight: sc.weight,
          score: 0.9,
          rawScores: [0.9, 0.9, 0.9],
          variance: 0,
          evidence: `证据 ${i}`,
        })),
      });
      o.compositeScore = 0.9;
      o.qualityLevel = 'A';
      o.passed = true;
      const r = checkVerifierOutput(o);
      expect(r.passed).toBe(true);
    }
  });
});

describe('verifier-logic - checkVerifierOutput 各类非法输出', () => {
  it('非对象输入失败', () => {
    const r = checkVerifierOutput('not an object');
    expect(r.passed).toBe(false);
    expect(r.reasons[0]).toContain('不是合法 JSON 对象');
  });

  it('schemaVersion 错误失败', () => {
    const o = makeValidOutput({ schemaVersion: '2.0' });
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(x => x.includes('schemaVersion'))).toBe(true);
  });

  it('targetKind 非法失败', () => {
    const o = makeValidOutput({
      meta: { ...makeValidOutput().meta, targetKind: 'invalid' as never },
    });
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(x => x.includes('targetKind'))).toBe(true);
  });

  it('scoringMethod 非法失败', () => {
    const o = makeValidOutput({
      meta: { ...makeValidOutput().meta, scoringMethod: 'invalid' as never },
    });
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(x => x.includes('scoringMethod'))).toBe(true);
  });

  it('repeatTimes < 3 失败', () => {
    const o = makeValidOutput({
      meta: { ...makeValidOutput().meta, repeatTimes: 2 },
      subCriteria: SUB_CRITERIA.requirement.map(sc => ({
        name: sc.name, weight: sc.weight, score: 0.8,
        rawScores: [0.80, 0.80], variance: 0, evidence: 'e',
      })),
    });
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(x => x.includes('repeatTimes'))).toBe(true);
  });

  it('子标准数量不足失败', () => {
    const o = makeValidOutput({
      subCriteria: makeValidOutput().subCriteria.slice(0, 2),
    });
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(x => x.includes('subCriteria'))).toBe(true);
  });

  it('子标准名称不匹配失败', () => {
    const o = makeValidOutput();
    o.subCriteria[0].name = 'wrong-name';
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(x => x.includes('name'))).toBe(true);
  });

  it('子标准权重被改动失败', () => {
    const o = makeValidOutput();
    o.subCriteria[0].weight = 0.5; // 应为 0.30
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(x => x.includes('weight'))).toBe(true);
  });

  it('子标准 score 越界失败', () => {
    const o = makeValidOutput();
    o.subCriteria[0].score = 1.5;
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(x => x.includes('score') && x.includes('[0,1]'))).toBe(true);
  });

  it('rawScores 长度不匹配 repeatTimes 失败', () => {
    const o = makeValidOutput();
    o.subCriteria[0].rawScores = [0.8, 0.8]; // 应为 3
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(x => x.includes('rawScores 长度'))).toBe(true);
  });

  it('variance 超过阈值失败（不可重复，需重评）', () => {
    const o = makeValidOutput();
    o.subCriteria[0].variance = 0.5; // 阈值 0.10
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(x => x.includes('variance') && x.includes('不可重复'))).toBe(true);
  });

  it('evidence 空字符串失败', () => {
    const o = makeValidOutput();
    o.subCriteria[0].evidence = '';
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(x => x.includes('evidence'))).toBe(true);
  });

  it('compositeScore 与 Σ(score*weight) 不符失败', () => {
    const o = makeValidOutput();
    o.compositeScore = 0.5; // 实际应该是 0.8
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(x => x.includes('compositeScore') && x.includes('Σ(score*weight)'))).toBe(true);
  });

  it('qualityLevel 与综合分数映射不一致失败', () => {
    const o = makeValidOutput();
    o.compositeScore = 0.9; // 应为 A
    o.qualityLevel = 'C';
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(x => x.includes('qualityLevel') && x.includes('映射'))).toBe(true);
  });

  it('passed 与 qualityLevel 不一致失败', () => {
    const o = makeValidOutput();
    o.qualityLevel = 'D'; // 应 passed=false
    o.passed = true;
    // 需要补 reworkHints 否则单独触发另一条
    o.reworkHints = ['hint'];
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(x => x.includes('passed') && x.includes('qualityLevel'))).toBe(true);
  });

  it('passed=false 但 reworkHints 缺失失败', () => {
    const o = makeValidOutput();
    o.compositeScore = 0.3;
    o.qualityLevel = 'D';
    o.passed = false;
    // 不提供 reworkHints
    o.reworkHints = undefined;
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(x => x.includes('reworkHints'))).toBe(true);
  });

  it('ranking 字段非法 algorithm 失败', () => {
    const o = makeValidOutput({
      ranking: {
        algorithm: 'BUBBLE' as never, k: 5, temperature: 4, rounds: 25, ordered: ['A', 'B'],
      },
    });
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(x => x.includes('ranking.algorithm'))).toBe(true);
  });

  it('合法 ranking 通过', () => {
    const o = makeValidOutput({
      ranking: { algorithm: 'PPT', k: 5, temperature: 4, rounds: 25, ordered: ['A', 'B', 'C'] },
    });
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(true);
  });

  it('summary 空字符串失败', () => {
    const o = makeValidOutput({ summary: '' });
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(x => x.includes('summary'))).toBe(true);
  });
});

describe('verifier-logic - 防漂移约束（核心目标）', () => {
  it('外部 Agent 试图改子标准名称以降低标准 → 失败', () => {
    const o = makeValidOutput();
    // 把 completeness 改为简单评分以绕过完整性检查
    o.subCriteria[0].name = 'overall-feeling';
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
  });

  it('外部 Agent 试图调整权重以抬高综合分数 → 失败', () => {
    const o = makeValidOutput();
    // 把低分项权重设为 0
    o.subCriteria[0].weight = 0;
    o.subCriteria[1].weight = 0.5; // 应为 0.25
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(x => x.includes('weight'))).toBe(true);
  });

  it('外部 Agent 试图通过单次评估冒充多次重复 → 失败', () => {
    const o = makeValidOutput();
    o.meta.repeatTimes = 3;
    o.subCriteria[0].rawScores = [0.8]; // 只有 1 次
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(x => x.includes('rawScores 长度'))).toBe(true);
  });

  it('外部 Agent 试图伪造低方差以掩盖不可重复 → 失败（防漂移：重算方差）', () => {
    const o = makeValidOutput();
    // 实际 rawScores 方差大（0.1, 0.9, 0.5 → mean=0.5, var≈0.1155）
    o.subCriteria[0].rawScores = [0.1, 0.9, 0.5];
    // 但 Agent 谎称方差小（0.001），试图通过 ≤ 阈值 0.10 的校验
    o.subCriteria[0].variance = 0.001;
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(false);
    // 防漂移校验应检测到 rawScores 重算方差与 variance 字段不一致
    expect(r.reasons.some(x => x.includes('重算的方差') && x.includes('疑似谎报方差'))).toBe(true);
  });

  it('外部 Agent 试图通过复制相同分数冒充多次评估 → 通过（但 variance=0 是合法的）', () => {
    // 注：复制相同分数 [0.8, 0.8, 0.8] 与 variance=0 是自洽的，校验通过。
    // 这是已知限制：纯结构校验无法区分「真多次评估恰好相同」与「单次复制」。
    // 防漂移的目的是阻止「方差字段与 rawScores 不一致」的谎报，
    // 而非阻止「恰好一致的多次评估」（后者需靠评审提示词约束随机种子）。
    const o = makeValidOutput();
    o.subCriteria[0].rawScores = [0.8, 0.8, 0.8];
    o.subCriteria[0].variance = 0;
    const r = checkVerifierOutput(o);
    expect(r.passed).toBe(true);
  });
});
