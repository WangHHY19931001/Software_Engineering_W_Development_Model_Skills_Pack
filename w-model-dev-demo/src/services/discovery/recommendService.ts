/**
 * recommendService（DD-027 / SD-004）：个性化推荐（REQ-022）。
 * 携带有效 JWT → 阅读历史标签偏好推荐；无 JWT/无历史（冷启动）→ 回退热门；
 * 结果去重且不含已读文章。
 */
import { BizError } from '../../utils/errors';
import type { ReadingStatService } from '../stats/readingStatService';
import type { ArticleService } from '../content/articleService';
import type { HotService } from './hotService';
import type { RecommendItem } from '../../types';

export class RecommendService {
  constructor(
    private readonly readingStatService: ReadingStatService,
    private readonly articleService: ArticleService,
    private readonly hotService: HotService,
  ) {}

  async getRecommendations(userId: string | undefined, limit: number): Promise<RecommendItem[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new BizError(40002, 'limit 参数越界');
    }
    const fallback = async (): Promise<RecommendItem[]> => {
      const hot = await this.hotService.getHotArticles(limit);
      return hot.map((h) => ({ ...h, reason: 'hot-fallback' as const, score: h.viewCount7d }));
    };
    if (!userId) {
      return fallback();
    }
    const readIds = await this.readingStatService.getReadArticleIds(userId);
    if (readIds.length === 0) {
      return fallback();
    }
    const readArticles = await this.articleService.getArticlesByIds(readIds);
    const tagsByArticle = new Map(readArticles.map((a) => [a.id, a.tags]));
    const preference = this.readingStatService.getTagPreference(userId, tagsByArticle);
    if (preference.length === 0) {
      return fallback();
    }
    const readSet = new Set(readIds);
    const candidates = await this.articleService.findAllPublished();
    const scored = candidates
      .filter((a) => !readSet.has(a.id))
      .map((a) => {
        let score = 0;
        for (const tag of a.tags) {
          const match = preference.find((p) => p.tag === tag);
          if (match) score += match.score;
        }
        return {
          articleId: a.id,
          title: a.title,
          summary: a.summary,
          reason: 'tag-preference' as const,
          score,
        };
      })
      .filter((item) => item.score > 0)
      .sort((x, y) => y.score - x.score);
    const dedup = new Map<string, RecommendItem>();
    for (const item of scored) dedup.set(item.articleId, item);
    return [...dedup.values()].slice(0, limit);
  }
}
