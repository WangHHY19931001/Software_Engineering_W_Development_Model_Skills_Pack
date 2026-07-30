/**
 * 统计仓储 - 聚合数据
 */
import { BaseRepository } from './base.repository.js';
import type { Article } from '../types/index.js';

export interface StatsBucket {
  id: string;
  ts: number;
  articleId: string | null;
  metric: string;
  value: number;
}

export class StatsRepository extends BaseRepository<StatsBucket> {
  async recordMetric(metric: string, value: number, articleId: string | null = null): Promise<StatsBucket> {
    const bucket: StatsBucket = {
      id: `stat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      articleId,
      metric,
      value,
    };
    return this.create(bucket);
  }

  async aggregateByMetric(metric: string): Promise<{ count: number; sum: number; avg: number }> {
    const items = await this.findBy((b) => b.metric === metric);
    if (items.length === 0) {
      return { count: 0, sum: 0, avg: 0 };
    }
    const sum = items.reduce((acc, b) => acc + b.value, 0);
    return { count: items.length, sum, avg: sum / items.length };
  }

  async aggregateArticles(articles: Article[]): Promise<{
    totalArticles: number;
    totalPublished: number;
    totalViews: number;
    totalLikes: number;
    totalFavorites: number;
    totalComments: number;
  }> {
    const totalArticles = articles.length;
    const totalPublished = articles.filter((a) => a.status === 'published').length;
    const totalViews = articles.reduce((acc, a) => acc + a.viewCount, 0);
    const totalLikes = articles.reduce((acc, a) => acc + a.likeCount, 0);
    const totalFavorites = articles.reduce((acc, a) => acc + a.favoriteCount, 0);
    const totalComments = articles.reduce((acc, a) => acc + a.commentCount, 0);
    return {
      totalArticles,
      totalPublished,
      totalViews,
      totalLikes,
      totalFavorites,
      totalComments,
    };
  }
}
