// SD-006 StatsService.

import { UserRole } from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import type { StatsStore, ArticleStats, UserStats, BloggerStats, TrendPoint } from '../stores/stats.store.js';
import { siteTrendDaysSchema } from '../utils/schemas.js';

export class StatsService {
  constructor(private statsStore: StatsStore) {}

  private requireAdmin(role: string): void {
    if (role !== UserRole.Admin) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
  }

  articleStats(role: string): ArticleStats {
    this.requireAdmin(role);
    return this.statsStore.articleStats();
  }

  userStats(role: string): UserStats {
    this.requireAdmin(role);
    return this.statsStore.userStats();
  }

  bloggerStats(role: string): BloggerStats {
    this.requireAdmin(role);
    return this.statsStore.bloggerStats();
  }

  siteTrend(role: string, days: number): TrendPoint[] {
    this.requireAdmin(role);
    if (!siteTrendDaysSchema.safeParse(days).success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    return this.statsStore.siteTrend(days);
  }
}
