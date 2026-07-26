/**
 * StatsService + SiteService（站点统计 + 健康检查）。
 */
import type { SiteStore, SiteStats } from '../stores/site.store.js';

export class SiteService {
  constructor(private siteStore: SiteStore) {}

  health(): { status: string; uptime: number; timestamp: string } {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  getStats(): SiteStats {
    return this.siteStore.get();
  }

  refreshStats(
    users: number,
    articles: number,
    comments: number,
    likes: number,
  ): SiteStats {
    return this.siteStore.update({
      totalUsers: users,
      totalArticles: articles,
      totalComments: comments,
      totalLikes: likes,
    });
  }
}
