/**
 * hotService（DD-026 / SD-004）：近 7 天阅读量降序 Top N（REQ-021）。
 * 跨模块消费 ReadingRecord（经 SD-005）与 article（经 SD-002）。
 */
import { BizError } from '../../utils/errors';
import type { ReadingStatService } from '../stats/readingStatService';
import type { ArticleService } from '../content/articleService';
import type { HotItem } from '../../types';

export class HotService {
  constructor(
    private readonly readingStatService: ReadingStatService,
    private readonly articleService: ArticleService,
  ) {}

  /** 近 7 天（viewedAt ≥ now−7d）阅读量聚合 → 与已发布文章求交 → 降序 Top N（N=min(limit, 实际)） */
  async getHotArticles(limit: number): Promise<HotItem[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new BizError(40002, 'limit 参数越界');
    }
    const published = await this.articleService.findAllPublished();
    if (published.length === 0) {
      return [];
    }
    const views = await this.readingStatService.getViews7d(published.map((a) => a.id));
    return published
      .map((a) => ({
        articleId: a.id,
        title: a.title,
        summary: a.summary,
        viewCount7d: views.get(a.id) ?? 0,
        publishedAt: a.publishedAt,
      }))
      .filter((item) => item.viewCount7d > 0)
      .sort((x, y) => y.viewCount7d - x.viewCount7d || (y.publishedAt ?? '').localeCompare(x.publishedAt ?? ''))
      .slice(0, limit);
  }

  /** TLA+ L2_BlogSystemDiscovery "SetHotLimit" 动作对应：配置热门 Top N 上限（1..50 校验，DD-026） */
  setHotLimit(limit: number): number {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new BizError(40002, 'limit 参数越界');
    }
    return limit;
  }
}
