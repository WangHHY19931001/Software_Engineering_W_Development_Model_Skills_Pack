/**
 * PPTRanker 单元测试
 *
 * 覆盖：
 *   - rankCandidates 基本流程
 *   - pivot 选择策略（分层抽样）
 *   - 空候选列表
 *   - 候选数 ≤ pivot 数（直接返回）
 *   - 复杂度标记
 */

import { describe, it, expect } from '@jest/globals';
import { PPTRanker } from '../src/core/ppt-ranker.js';
import type { ContinuousScoringEngine } from '../src/types/index.js';

class FixedScoreEngine implements ContinuousScoringEngine {
  constructor(private readonly scoreFn: (candidate: unknown) => number) {}
  async computeContinuousScore(_prompt: string, candidate: unknown): Promise<number> {
    // PPTRanker 会把候选包装为 { candidate, pivot }，需要解包
    const wrapper = candidate as { candidate?: unknown; pivot?: unknown };
    const target = wrapper?.candidate ?? candidate;
    return this.scoreFn(target);
  }
  async getScoreDistribution(): Promise<Map<number, number>> {
    return new Map([[10, 1]]);
  }
}

describe('PPTRanker - rankCandidates', () => {
  it('应按分数降序排列', async () => {
    const engine = new FixedScoreEngine((c: { v: number }) => (c as { v: number }).v);
    const ranker = new PPTRanker(engine);
    const candidates = [{ v: 5 }, { v: 15 }, { v: 10 }, { v: 20 }];
    const result = await ranker.rankCandidates(candidates, 'value', 2);

    expect(result.ranking[0].candidate).toEqual({ v: 20 });
    expect(result.ranking[1].candidate).toEqual({ v: 15 });
    expect(result.ranking[2].candidate).toEqual({ v: 10 });
    expect(result.ranking[3].candidate).toEqual({ v: 5 });
  });

  it('复杂度标记应包含 pivot 数', async () => {
    const ranker = new PPTRanker(new FixedScoreEngine(() => 5));
    const result = await ranker.rankCandidates([1, 2, 3], 'test', 3);
    expect(result.complexity).toBe('O(N * 3)');
  });

  it('totalComparisons = candidates × pivots', async () => {
    const ranker = new PPTRanker(new FixedScoreEngine(() => 5));
    const result = await ranker.rankCandidates([1, 2, 3, 4, 5], 'test', 3);
    expect(result.totalComparisons).toBe(15); // 5*3
  });

  it('空候选返回空结果', async () => {
    const ranker = new PPTRanker(new FixedScoreEngine(() => 5));
    const result = await ranker.rankCandidates([], 'test', 3);
    expect(result.ranking).toEqual([]);
    expect(result.pivots).toEqual([]);
    expect(result.totalComparisons).toBe(0);
  });

  it('候选数 ≤ pivot 数时返回所有候选作为 pivot', async () => {
    const ranker = new PPTRanker(new FixedScoreEngine(() => 5));
    const candidates = [1, 2];
    const result = await ranker.rankCandidates(candidates, 'test', 5);
    expect(result.pivots).toEqual(candidates);
  });

  it('pivot 选择应覆盖候选列表的不同位置（分层抽样）', async () => {
    const ranker = new PPTRanker(new FixedScoreEngine(() => 5));
    const candidates = Array.from({ length: 10 }, (_, i) => i);
    const result = await ranker.rankCandidates(candidates, 'test', 4);
    // 4 个 pivot 应均匀分布
    expect(result.pivots.length).toBe(4);
    // 第一个 pivot 应是 candidates[0]
    expect(result.pivots[0]).toBe(0);
    // 最后一个 pivot 应在列表后段
    expect(result.pivots[3]).toBeGreaterThanOrEqual(7);
  });

  it('不传 pivotCount 时使用默认值 4', async () => {
    const ranker = new PPTRanker(new FixedScoreEngine(() => 5));
    const candidates = Array.from({ length: 10 }, (_, i) => i);
    const result = await ranker.rankCandidates(candidates, 'test');
    expect(result.complexity).toBe('O(N * 4)');
    expect(result.pivots.length).toBe(4);
  });

  it('单个候选也能正常排序', async () => {
    const ranker = new PPTRanker(new FixedScoreEngine(() => 5));
    const result = await ranker.rankCandidates([{ v: 1 }], 'test', 3);
    expect(result.ranking).toHaveLength(1);
    expect(result.ranking[0].candidate).toEqual({ v: 1 });
  });
});
