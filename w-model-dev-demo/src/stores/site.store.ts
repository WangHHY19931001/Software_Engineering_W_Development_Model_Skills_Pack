/**
 * SiteStore — 站点统计存储（健康检查 + 统计聚合）。
 */
export interface SiteStats {
  totalUsers: number;
  totalArticles: number;
  totalComments: number;
  totalLikes: number;
  updatedAt: string;
}

export class SiteStore {
  private stats: SiteStats = {
    totalUsers: 0,
    totalArticles: 0,
    totalComments: 0,
    totalLikes: 0,
    updatedAt: new Date().toISOString(),
  };

  update(patch: Partial<Omit<SiteStats, 'updatedAt'>>): SiteStats {
    this.stats = {
      ...this.stats,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    return this.stats;
  }

  get(): SiteStats {
    return { ...this.stats };
  }

  reset(): void {
    this.stats = {
      totalUsers: 0,
      totalArticles: 0,
      totalComments: 0,
      totalLikes: 0,
      updatedAt: new Date().toISOString(),
    };
  }
}
