/**
 * 可靠性数学：纯函数实现 Krippendorff's alpha（ordinal）与 DimensionAwareFilter。
 *
 * 不含 I/O，便于用夹具测试。
 *
 * 参考：AdaRubric (arXiv:2603.21362) 提倡 α ≥ 0.80 作为部署级可靠性门。
 */

import type { QualityLevel, SubCriterion } from '../types';

/**
 * 计算 ordinal Krippendorff's alpha。
 *
 * @param labels - labels[coderIndex][unitIndex] = 序数分值（可含小数，如平均秩）
 * @returns alpha ∈ [-1, 1]；coders < 2 时返回 null
 *
 * 公式：α = 1 - Do/De
 *   Do = 观测不一致量（加权，ordinal 用 (u-v)^2 的归一化）
 *   De = 期望不一致量
 */
export function computeKrippendorffAlpha(
  labels: number[][]
): number | null {
  const numCoders = labels.length;
  if (numCoders < 2) return null;

  // 转置为 unit×coder 视图，并只保留被 ≥2 个 coder 评分的 unit
  const unitRatings: number[][] = [];
  const maxCoder = numCoders;
  const numUnits = Math.max(...labels.map(r => r.length));
  for (let u = 0; u < numUnits; u++) {
    const ratings: number[] = [];
    for (let c = 0; c < maxCoder; c++) {
      if (labels[c] && labels[c][u] !== undefined) {
        ratings.push(labels[c][u]);
      }
    }
    if (ratings.length >= 2) {
      unitRatings.push(ratings);
    }
  }
  if (unitRatings.length === 0) return null;

  // 计算所有出现的值，用于 ordinal 距离矩阵
  const allValues = new Set<number>();
  for (const ratings of unitRatings) {
    for (const v of ratings) allValues.add(v);
  }
  const sortedValues = Array.from(allValues).sort((a, b) => a - b);

  // ordinal 度量：值之间的距离按秩差归一化
  // rank(v) = (count of values < v) + (count of values == v)/2  ... 标准 ordinal 处理
  // 简化：用值在排序序列中的索引作为秩（等距处理小数秩）
  const valueRank = new Map<number, number>();
  for (let i = 0; i < sortedValues.length; i++) {
    valueRank.set(sortedValues[i], i + 1);
  }
  const maxRank = sortedValues.length;

  // Do: 观测不一致
  let doSum = 0;
  let totalPairs = 0;
  for (const ratings of unitRatings) {
    for (let i = 0; i < ratings.length; i++) {
      for (let j = i + 1; j < ratings.length; j++) {
        const ri = valueRank.get(ratings[i])!;
        const rj = valueRank.get(ratings[j])!;
        // ordinal 加权：(ri-rj)^2 / (maxRank-1)^2
        const dist = maxRank > 1 ? Math.pow(ri - rj, 2) / Math.pow(maxRank - 1, 2) : 0;
        doSum += dist;
        totalPairs++;
      }
    }
  }
  // 每个 unit 有 m_u 个评分 → C(m_u,2) 对；Do 归一化到 per-pair
  const Do = totalPairs > 0 ? doSum / totalPairs : 0;

  // De: 期望不一致（基于所有评分值的边际分布）
  const allRanks: number[] = [];
  for (const ratings of unitRatings) {
    for (const v of ratings) allRanks.push(valueRank.get(v)!);
  }
  const n = allRanks.length;
  let deSum = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dist = maxRank > 1 ? Math.pow(allRanks[i] - allRanks[j], 2) / Math.pow(maxRank - 1, 2) : 0;
      deSum += dist;
    }
  }
  const De = n > 1 ? deSum / (n * (n - 1)) : 0;

  if (De === 0) return 1.0; // 所有人同一值 → 完全一致
  const alpha = 1 - Do / De;
  return Math.max(-1, Math.min(1, alpha));
}

/**
 * 将"每次 run × 每个维度"的原始分数转为每次 run 内的 ordinal 秩。
 * 用于把 VerificationFramework 的 N 次重复评估结果喂给 alpha 计算。
 *
 * @param perRunDimScores - [run][dim] = 原始分数
 * @returns [run][dim] = 秩（1-based，ties 取平均秩）
 */
export function toOrdinalLabels(perRunDimScores: number[][]): number[][] {
  return perRunDimScores.map(runScores => {
    const indexed = runScores.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);
    const ranks = new Array(runScores.length).fill(0);
    let i = 0;
    while (i < indexed.length) {
      let j = i;
      while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
      const avgRank = (i + 1 + j) / 2; // 1-based, average of ranks i+1..j
      for (let k = i; k < j; k++) {
        ranks[indexed[k].i] = avgRank;
      }
      i = j;
    }
    return ranks;
  });
}

/**
 * DimensionAwareFilter：检查各维度是否低于其 minThreshold，违规时钳制 qualityLevel。
 *
 * 规则：任一维度违规 → qualityLevel 上限钳制为 'poor'；不向上调整已更差的等级。
 *
 * @param subScores - 维度ID → 原始分数（在 scoreRange 内）
 * @param subCriteria - 含 minThreshold 的维度定义
 * @param currentLevel - 当前 qualityLevel（来自加权总分）
 * @param range - 评分范围（用于归一化到 1-20 等价分数）
 */
export function applyDimensionAwareFilter(
  subScores: Record<string, number>,
  subCriteria: SubCriterion[],
  currentLevel: QualityLevel,
  range: { min: number; max: number }
): { qualityLevel: QualityLevel; dimensionFlags: { id: string; violated: boolean }[] } {
  const dimensionFlags = subCriteria.map(c => {
    const score = subScores[c.id];
    const violated =
      c.minThreshold !== undefined &&
      score !== undefined &&
      toEquiv(score, range) < c.minThreshold;
    return { id: c.id, violated };
  });

  const anyViolated = dimensionFlags.some(f => f.violated);
  let qualityLevel: QualityLevel = currentLevel;
  if (anyViolated) {
    // 钳制上限为 'poor'，但不向上调整
    const order: QualityLevel[] = ['unacceptable', 'poor', 'acceptable', 'good', 'excellent'];
    const currentIdx = order.indexOf(currentLevel);
    const poorIdx = order.indexOf('poor');
    if (currentIdx > poorIdx) {
      qualityLevel = 'poor';
    }
  }
  return { qualityLevel, dimensionFlags };
}

/** 归一化到 1-20 等价分数（与 verification-framework.ts determineQualityLevel 一致） */
function toEquiv(score: number, range: { min: number; max: number }): number {
  const span = range.max - range.min;
  return span > 0 ? ((score - range.min) / span) * 19 + 1 : score;
}
