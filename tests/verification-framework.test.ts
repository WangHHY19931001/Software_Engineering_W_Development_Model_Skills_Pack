/**
 * VerificationFramework 单元测试
 *
 * 覆盖：
 *   - 三维度验证流程
 *   - aggregateScores: mean / median / weighted
 *   - computeConfidence
 *   - determineQualityLevel（边界值）
 */

import { describe, it, expect } from '@jest/globals';
import { VerificationFramework, determineQualityLevel } from '../src/core/verification-framework.js';
import { applyDimensionAwareFilter, computeKrippendorffAlpha, toOrdinalLabels } from '../src/core/reliability-math.js';
import type { ContinuousScoringEngine, VerificationDimension } from '../src/types/index.js';

/** 用于测试的固定评分引擎 */
class FixedScoreEngine implements ContinuousScoringEngine {
  constructor(private readonly score: number) {}
  async computeContinuousScore(): Promise<number> {
    return this.score;
  }
  async getScoreDistribution(): Promise<Map<number, number>> {
    return new Map([[this.score, 1]]);
  }
}

function makeDimension(subCriteria: Array<{ id: string; weight: number }>): VerificationDimension {
  return {
    scoreGranularity: { range: { min: 1, max: 20 }, labels: [], granularityLevel: 20 },
    repeatedEvaluation: { times: 3, varianceThreshold: 0.1, aggregationMethod: 'mean' },
    criteriaDecomposition: {
      originalCriteria: 'test',
      subCriteria: subCriteria.map(s => ({
        id: s.id,
        description: s.id,
        scoringPrompt: s.id,
        weight: s.weight,
      })),
      weights: subCriteria.map(s => s.weight),
    },
  };
}

describe('VerificationFramework - 三维度验证', () => {
  it('应正确计算加权综合分数', async () => {
    const engine = new FixedScoreEngine(16); // 固定返回 16
    const fw = new VerificationFramework(engine);
    const result = await fw.verifyWithThreeDimensions(
      { test: true },
      makeDimension([
        { id: 'a', weight: 0.5 },
        { id: 'b', weight: 0.5 },
      ])
    );

    expect(result.finalScore).toBeCloseTo(16, 5); // 16*0.5 + 16*0.5
    expect(result.subScores.a).toBe(16);
    expect(result.subScores.b).toBe(16);
    expect(result.confidence).toBeCloseTo(1, 5); // 方差=0 → 置信度=1
    expect(result.qualityLevel).toBe('good');
  });

  it('应正确分解多个子标准并加权', async () => {
    const engine = new FixedScoreEngine(10);
    const fw = new VerificationFramework(engine);
    const result = await fw.verifyWithThreeDimensions(
      {},
      makeDimension([
        { id: 'a', weight: 0.25 },
        { id: 'b', weight: 0.25 },
        { id: 'c', weight: 0.25 },
        { id: 'd', weight: 0.25 },
      ])
    );
    expect(result.finalScore).toBeCloseTo(10, 5);
  });
});

describe('VerificationFramework - aggregateScores', () => {
  const fw = new VerificationFramework(new FixedScoreEngine(0));

  it('mean 聚合', () => {
    expect(fw.aggregateScores([1, 2, 3, 4], 'mean')).toBe(2.5);
  });

  it('median 聚合（奇数个）', () => {
    expect(fw.aggregateScores([1, 3, 2, 5, 4], 'median')).toBe(3);
  });

  it('median 聚合（偶数个）', () => {
    expect(fw.aggregateScores([1, 2, 3, 4], 'median')).toBe(2.5);
  });

  it('weighted 聚合（最近权重更高）', () => {
    const result = fw.aggregateScores([1, 2, 3], 'weighted');
    // 最近（index=2）权重最大，结果应偏向 3
    expect(result).toBeGreaterThan(2);
    expect(result).toBeLessThan(3);
  });

  it('空数组返回 0', () => {
    expect(fw.aggregateScores([], 'mean')).toBe(0);
  });
});

describe('VerificationFramework - computeConfidence', () => {
  const fw = new VerificationFramework(new FixedScoreEngine(0));

  it('单一分数返回置信度 1', () => {
    expect(fw.computeConfidence([15])).toBe(1);
  });

  it('完全一致的分数返回置信度 1', () => {
    expect(fw.computeConfidence([15, 15, 15, 15])).toBeCloseTo(1, 5);
  });

  it('高方差的分数返回低置信度', () => {
    const conf = fw.computeConfidence([5, 10, 15, 20]);
    expect(conf).toBeLessThan(0.8);
  });

  it('置信度归一化到 [0, 1]', () => {
    const conf = fw.computeConfidence([1, 100, 50, 25]);
    expect(conf).toBeGreaterThanOrEqual(0);
    expect(conf).toBeLessThanOrEqual(1);
  });
});

describe('determineQualityLevel - 边界值', () => {
  const range = { min: 1, max: 20 };

  it('18-20 为 excellent', () => {
    expect(determineQualityLevel(20, range)).toBe('excellent');
    expect(determineQualityLevel(18, range)).toBe('excellent');
    expect(determineQualityLevel(17.99, range)).not.toBe('excellent');
  });

  it('14-17.99 为 good', () => {
    expect(determineQualityLevel(17, range)).toBe('good');
    expect(determineQualityLevel(14, range)).toBe('good');
  });

  it('10-13.99 为 acceptable', () => {
    expect(determineQualityLevel(13, range)).toBe('acceptable');
    expect(determineQualityLevel(10, range)).toBe('acceptable');
  });

  it('6-9.99 为 poor', () => {
    expect(determineQualityLevel(9, range)).toBe('poor');
    expect(determineQualityLevel(6, range)).toBe('poor');
  });

  it('<6 为 unacceptable', () => {
    expect(determineQualityLevel(5, range)).toBe('unacceptable');
    expect(determineQualityLevel(1, range)).toBe('unacceptable');
  });

  it('使用默认范围 1-20', () => {
    expect(determineQualityLevel(20)).toBe('excellent');
  });
});

/** 评分引擎：每次调用按序返回预设分数，用于构造可控的重复评估 */
class SequenceScoreEngine implements ContinuousScoringEngine {
  private callIdx = 0;
  constructor(private readonly scoresByCall: number[]) {}
  async computeContinuousScore(): Promise<number> {
    const s = this.scoresByCall[this.callIdx % this.scoresByCall.length];
    this.callIdx++;
    return s;
  }
  async getScoreDistribution(): Promise<Map<number, number>> {
    return new Map([[10, 1]]);
  }
  reset() { this.callIdx = 0; }
}

describe('VerificationFramework - reliability post-processing', () => {
  it('computes reliability.alpha from repeated runs (N>=2)', async () => {
    // 1 dimension, 3 runs, all score 16 → ordinal identical → alpha=1
    const engine = new SequenceScoreEngine([16, 16, 16]);
    const fw = new VerificationFramework(engine);
    const dim: VerificationDimension = {
      scoreGranularity: { range: { min: 1, max: 20 }, labels: [], granularityLevel: 20 },
      repeatedEvaluation: { times: 3, varianceThreshold: 0.1, aggregationMethod: 'mean' },
      criteriaDecomposition: {
        originalCriteria: 'test',
        subCriteria: [{ id: 'a', description: '', scoringPrompt: '', weight: 1, minThreshold: 10 }],
        weights: [1],
      },
    };
    const result = await fw.verifyWithThreeDimensions({}, dim);
    expect(result.reliability).toBeDefined();
    expect(result.reliability!.coders).toBe(3);
    expect(result.reliability!.alpha).toBeCloseTo(1.0, 3);
  });

  it('sets reliability.alpha=null when N<2', async () => {
    const engine = new SequenceScoreEngine([16]);
    const fw = new VerificationFramework(engine);
    const dim: VerificationDimension = {
      scoreGranularity: { range: { min: 1, max: 20 }, labels: [], granularityLevel: 20 },
      repeatedEvaluation: { times: 1, varianceThreshold: 0.1, aggregationMethod: 'mean' },
      criteriaDecomposition: {
        originalCriteria: 'test',
        subCriteria: [{ id: 'a', description: '', scoringPrompt: '', weight: 1 }],
        weights: [1],
      },
    };
    const result = await fw.verifyWithThreeDimensions({}, dim);
    expect(result.reliability).toEqual({ alpha: null, coders: 1 });
    expect(result.deploymentGate).toBe('review');
  });

  it('applies DimensionAwareFilter to downgrade qualityLevel', async () => {
    // 2 dimensions: a passes (16), b fails (7 < minThreshold 10)
    // Sequence: 3 runs × 2 dims = [a,a,a,b,b,b]
    const engine = new SequenceScoreEngine([16, 16, 16, 7, 7, 7]);
    const fw = new VerificationFramework(engine);
    const dim: VerificationDimension = {
      scoreGranularity: { range: { min: 1, max: 20 }, labels: [], granularityLevel: 20 },
      repeatedEvaluation: { times: 3, varianceThreshold: 0.1, aggregationMethod: 'mean' },
      criteriaDecomposition: {
        originalCriteria: 'test',
        subCriteria: [
          { id: 'a', description: '', scoringPrompt: '', weight: 0.5, minThreshold: 10 },
          { id: 'b', description: '', scoringPrompt: '', weight: 0.5, minThreshold: 10 },
        ],
        weights: [0.5, 0.5],
      },
    };
    const result = await fw.verifyWithThreeDimensions({}, dim);
    // 加权总分 = 16*0.5 + 7*0.5 = 11.5 → equiv ≈ 12.4 → 'acceptable'
    // 但 b 维度违规 → 钳制为 'poor'
    expect(result.qualityLevel).toBe('poor');
    expect(result.dimensionFlags).toEqual([
      { id: 'a', violated: false },
      { id: 'b', violated: true },
    ]);
    expect(result.deploymentGate).toBe('review'); // alpha 可能 pass 但 dimension 违规
  });

  it('sets deploymentGate=pass when alpha>=threshold and no dimension violated', async () => {
    // 默认 alphaThreshold=0.80；3 runs 全一致 → alpha=1
    const engine = new SequenceScoreEngine([16, 16, 16]);
    const fw = new VerificationFramework(engine, { alphaThreshold: 0.8 });
    const dim: VerificationDimension = {
      scoreGranularity: { range: { min: 1, max: 20 }, labels: [], granularityLevel: 20 },
      repeatedEvaluation: { times: 3, varianceThreshold: 0.1, aggregationMethod: 'mean' },
      criteriaDecomposition: {
        originalCriteria: 'test',
        subCriteria: [{ id: 'a', description: '', scoringPrompt: '', weight: 1, minThreshold: 8 }],
        weights: [1],
      },
    };
    const result = await fw.verifyWithThreeDimensions({}, dim);
    expect(result.reliability!.alpha).toBeCloseTo(1.0, 3);
    expect(result.dimensionFlags).toEqual([{ id: 'a', violated: false }]);
    expect(result.deploymentGate).toBe('pass');
  });
});
