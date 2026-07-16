/**
 * PPT (Probabilistic Pivot Tournament) 排名算法
 *
 * 复杂度：O(N × k)，其中 k 是 pivot 数量。
 * 相比全量 O(N²) 比较显著降低成本。
 *
 * 核心思想：
 *   1. 从候选中选取 k 个 pivot 作为基准
 *   2. 每个候选仅与 pivot 比较，得到平均连续分数
 *   3. 按分数排序
 */

import type {
  ContinuousScoringEngine,
  RankingResult,
} from '../types';

export class PPTRanker {
  private scoringEngine: ContinuousScoringEngine;

  constructor(scoringEngine: ContinuousScoringEngine) {
    this.scoringEngine = scoringEngine;
  }

  /**
   * 使用 PPT 算法对候选方案进行排名
   * @param candidates 候选方案列表
   * @param prompt 评判标准 / 上下文
   * @param pivotCount pivot 数量（默认 4）
   */
  async rankCandidates<T>(
    candidates: T[],
    prompt: string,
    pivotCount = 4
  ): Promise<RankingResult<T>> {
    if (candidates.length === 0) {
      return {
        ranking: [],
        pivots: [],
        totalComparisons: 0,
        complexity: `O(N * ${pivotCount})`,
      };
    }

    // 1. 选择 pivot 节点（分层抽样，覆盖不同质量层次）
    const pivots = this.selectPivots(candidates, pivotCount);

    // 2. 对每个候选评分
    const candidateScores = new Map<T, number>();

    for (const candidate of candidates) {
      let totalScore = 0;

      for (const pivot of pivots) {
        const comparisonPrompt = this.buildComparisonPrompt(
          prompt,
          candidate,
          pivot
        );
        const score = await this.scoringEngine.computeContinuousScore(
          comparisonPrompt,
          { candidate, pivot }
        );
        totalScore += score;
      }

      // pivots 非空（candidates 非空时已保证），无需判空
      candidateScores.set(candidate, totalScore / pivots.length);
    }

    // 3. 根据分数排序（降序）
    const ranked = Array.from(candidateScores.entries())
      .map(([candidate, score]) => ({ candidate, score }))
      .sort((a, b) => b.score - a.score);

    return {
      ranking: ranked,
      pivots,
      totalComparisons: candidates.length * pivots.length,
      complexity: `O(N * ${pivotCount})`,
    };
  }

  /**
   * 选择 pivot 节点。
   * 策略：分层抽样——均匀分布在候选列表中，保证 pivot 代表不同样本（理想情况下代表不同质量层次）。
   */
  private selectPivots<T>(candidates: T[], count: number): T[] {
    if (candidates.length <= count) {
      return [...candidates];
    }

    const pivots: T[] = [];
    const step = candidates.length / count;

    for (let i = 0; i < count; i++) {
      const idx = Math.floor(i * step);
      pivots.push(candidates[idx]);
    }

    return pivots;
  }

  /** 构建比较提示词 */
  private buildComparisonPrompt(
    basePrompt: string,
    candidate: unknown,
    pivot: unknown
  ): string {
    return `
${basePrompt}

请比较以下两个方案的质量(评分 1-20):

方案A:
${JSON.stringify(candidate, null, 2)}

方案B (基准):
${JSON.stringify(pivot, null, 2)}

请对方案A相对于方案B的质量进行评分。
    `.trim();
  }
}
