/**
 * 三维度验证框架（Three-Dimension Verification Framework）
 *
 * 维度一：评分粒度（Score Granularity）—— 使用连续评分引擎获得高粒度分数
 * 维度二：重复评估（Repeated Evaluation）—— 多次评估降低方差
 * 维度三：标准分解（Criteria Decomposition）—— 复杂标准拆分为带权子标准
 */

import type {
  ContinuousScoringEngine,
  VerificationDimension,
  VerificationResult,
  QualityLevel,
} from '../types';
import { computeKrippendorffAlpha, applyDimensionAwareFilter, toOrdinalLabels } from './reliability-math';

/** 硬门模式下 gate='fail' 时抛出，可被上层捕获 */
export class ReliabilityGateError extends Error {
  readonly gate: 'fail';
  readonly alpha: number | null;
  readonly dimensionViolations: string[];
  constructor(result: VerificationResult) {
    super(`Reliability gate failed: alpha=${result.reliability?.alpha ?? 'null'}, dimensionViolations=${(result.dimensionFlags ?? []).filter(f => f.violated).map(f => f.id).join(',')}`);
    this.name = 'ReliabilityGateError';
    this.gate = 'fail';
    this.alpha = result.reliability?.alpha ?? null;
    this.dimensionViolations = (result.dimensionFlags ?? []).filter(f => f.violated).map(f => f.id);
  }
}

export class VerificationFramework {
  private scoringEngine: ContinuousScoringEngine;
  private readonly alphaThreshold: number;
  private readonly hardGate: boolean;

  constructor(scoringEngine: ContinuousScoringEngine, opts?: { alphaThreshold?: number; hardGate?: boolean }) {
    this.scoringEngine = scoringEngine;
    this.alphaThreshold = opts?.alphaThreshold ?? 0.8;
    this.hardGate = opts?.hardGate ?? false;
  }

  /** 执行三维度验证 */
  async verifyWithThreeDimensions(
    target: unknown,
    criteria: VerificationDimension
  ): Promise<VerificationResult> {
    const subScores: Record<string, number> = {};
    /** 加权后的子标准得分（用于综合分数） */
    const weightedScores: number[] = [];
    /** 各子标准原始得分（用于置信度计算） */
    const rawScores: number[] = [];
    /** 每次 run × 每个维度的原始分数，用于 alpha 计算 */
    const perRunDimScores: number[][] = [];

    // 1. 标准分解评估
    for (const subCriterion of criteria.criteriaDecomposition.subCriteria) {
      const repeatedScores: number[] = [];

      // 2. 重复评估（降低方差）
      for (let i = 0; i < criteria.repeatedEvaluation.times; i++) {
        const score = await this.scoringEngine.computeContinuousScore(
          subCriterion.scoringPrompt,
          target,
          criteria.scoreGranularity.range
        );
        repeatedScores.push(score);
      }

      // 3. 聚合重复评估结果
      const aggregated = this.aggregateScores(
        repeatedScores,
        criteria.repeatedEvaluation.aggregationMethod
      );

      subScores[subCriterion.id] = aggregated;
      rawScores.push(aggregated);
      weightedScores.push(aggregated * subCriterion.weight);
      perRunDimScores.push(repeatedScores);
    }

    // 4. 综合分数 = Σ(子标准得分 × 权重)
    const finalScore = weightedScores.reduce((a, b) => a + b, 0);

    // 5. 置信度（基于原始得分的方差，越一致置信度越高）
    const confidence = this.computeConfidence(rawScores);

    // 6. 质量等级（初始：基于加权总分）
    let qualityLevel = this.determineQualityLevel(
      finalScore,
      criteria.scoreGranularity.range
    );

    // 7. 可靠性：ordinal Krippendorff's alpha
    // perRunDimScores 是 [dim][run]，需转置为 [run][dim] 喂给 toOrdinalLabels
    const numRuns = criteria.repeatedEvaluation.times;
    const transposed: number[][] = [];
    for (let run = 0; run < numRuns; run++) {
      const runDims: number[] = [];
      for (let dim = 0; dim < perRunDimScores.length; dim++) {
        runDims.push(perRunDimScores[dim][run]);
      }
      transposed.push(runDims);
    }
    const ordinalLabels = toOrdinalLabels(transposed);
    const alpha = computeKrippendorffAlpha(ordinalLabels);
    const reliability = { alpha, coders: numRuns };

    // 8. DimensionAwareFilter
    const filterResult = applyDimensionAwareFilter(
      subScores,
      criteria.criteriaDecomposition.subCriteria,
      qualityLevel,
      criteria.scoreGranularity.range
    );
    qualityLevel = filterResult.qualityLevel;

    // 9. 部署门
    const dimOk = !filterResult.dimensionFlags.some(f => f.violated);
    const alphaOk = alpha !== null && alpha >= this.alphaThreshold;
    let deploymentGate: 'pass' | 'review' | 'fail';
    if (alphaOk && dimOk) {
      deploymentGate = 'pass';
    } else {
      deploymentGate = this.hardGate ? 'fail' : 'review';
    }

    const result: VerificationResult = {
      finalScore,
      subScores,
      confidence,
      qualityLevel,
      details: { rawScores, weightedScores },
      reliability,
      deploymentGate,
      dimensionFlags: filterResult.dimensionFlags,
    };

    if (this.hardGate && deploymentGate === 'fail') {
      throw new ReliabilityGateError(result);
    }
    return result;
  }

  /** 聚合多次评分结果 */
  aggregateScores(
    scores: number[],
    method: 'mean' | 'median' | 'weighted'
  ): number {
    if (scores.length === 0) return 0;

    switch (method) {
      case 'mean':
        return scores.reduce((a, b) => a + b, 0) / scores.length;

      case 'median': {
        const sorted = [...scores].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0
          ? sorted[mid]
          : (sorted[mid - 1] + sorted[mid]) / 2;
      }

      case 'weighted': {
        // 最近评分权重更高（指数衰减）
        const weights = scores.map((_, i) => Math.exp(i * 0.1));
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        return (
          scores.reduce((sum, score, i) => sum + score * weights[i], 0) /
          totalWeight
        );
      }
    }
  }

  /**
   * 计算置信度：基于评分方差的归一化指标。
   * 标准差越小 → 置信度越高。
   */
  computeConfidence(scores: number[]): number {
    if (scores.length < 2) return 1.0;

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (mean === 0) return 0;

    const variance =
      scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / Math.abs(mean); // 变异系数

    // cv 越小，置信度越高；cv=0 → 1.0；cv≥0.5 → 0
    return Math.max(0, Math.min(1, 1 - cv * 2));
  }

  /**
   * 确定质量等级。
   * 将任意范围归一化到 1-20 等价分数后，使用绝对阈值（与 SSoT 一致）：
   *   18 / 14 / 10 / 6 边界
   */
  determineQualityLevel(
    score: number,
    range: { min: number; max: number }
  ): QualityLevel {
    return determineQualityLevel(score, range);
  }
}

/**
 * 独立导出的等级判定函数（供其他模块直接调用，不必实例化 framework）
 *
 * 将任意 range 归一化到 1-20 等价分数后按绝对阈值判定：
 *   ≥18 excellent | ≥14 good | ≥10 acceptable | ≥6 poor | <6 unacceptable
 */
export function determineQualityLevel(
  score: number,
  range: { min: number; max: number } = { min: 1, max: 20 }
): QualityLevel {
  const span = range.max - range.min;
  // 归一化到 1-20 等价分数：在 range 内的位置映射到 [1, 20]
  const equiv = span > 0 ? ((score - range.min) / span) * 19 + 1 : score;
  if (equiv >= 18) return 'excellent';
  if (equiv >= 14) return 'good';
  if (equiv >= 10) return 'acceptable';
  if (equiv >= 6) return 'poor';
  return 'unacceptable';
}
