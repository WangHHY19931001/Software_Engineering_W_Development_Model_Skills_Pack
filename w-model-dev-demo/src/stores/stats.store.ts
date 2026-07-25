// SD-006 StatsStore.

import type { ArticleStore } from './article.store.js';
import type { UserStore } from './user.store.js';
import type { BloggerStore } from './blogger.store.js';
import { ArticleStatus, UserRole } from '../types.js';

export interface ArticleStats {
  total: number;
  published: number;
  draft: number;
  archived: number;
}

export interface UserStats {
  total: number;
  banned: number;
  byRole: Record<UserRole, number>;
}

export interface BloggerStats {
  total: number;
  topFollowers: Array<{ bloggerId: string; followerCount: number }>;
}

export interface TrendPoint {
  date: string;
  articleCount: number;
  userCount: number;
}

export class StatsStore {
  private articleStore: ArticleStore | null = null;
  private userStore: UserStore | null = null;
  private bloggerStore: BloggerStore | null = null;

  setStores(opts: {
    articleStore?: ArticleStore;
    userStore?: UserStore;
    bloggerStore?: BloggerStore;
  }): void {
    if (opts.articleStore) this.articleStore = opts.articleStore;
    if (opts.userStore) this.userStore = opts.userStore;
    if (opts.bloggerStore) this.bloggerStore = opts.bloggerStore;
  }

  articleStats(): ArticleStats {
    if (!this.articleStore) return { total: 0, published: 0, draft: 0, archived: 0 };
    return {
      total: this.articleStore.size(),
      published: this.articleStore.statusSize(ArticleStatus.Published),
      draft: this.articleStore.statusSize(ArticleStatus.Draft),
      archived: this.articleStore.statusSize(ArticleStatus.Archived),
    };
  }

  userStats(): UserStats {
    if (!this.userStore) {
      return {
        total: 0,
        banned: 0,
        byRole: { [UserRole.Admin]: 0, [UserRole.Blogger]: 0, [UserRole.Reader]: 0 },
      };
    }
    return {
      total: this.userStore.size(),
      banned: this.userStore.bannedSize(),
      byRole: {
        [UserRole.Admin]: this.userStore.roleSize(UserRole.Admin),
        [UserRole.Blogger]: this.userStore.roleSize(UserRole.Blogger),
        [UserRole.Reader]: this.userStore.roleSize(UserRole.Reader),
      },
    };
  }

  bloggerStats(): BloggerStats {
    if (!this.bloggerStore) return { total: 0, topFollowers: [] };
    const all = this.bloggerStore.list(1, Number.MAX_SAFE_INTEGER);
    const top = all.items
      .map((b) => ({ bloggerId: b.id, followerCount: b.followerCount }))
      .sort((a, b) => b.followerCount - a.followerCount)
      .slice(0, 10);
    return { total: all.total, topFollowers: top };
  }

  siteTrend(days: number): TrendPoint[] {
    // Aggregate createdAt within the past N days.
    const points: TrendPoint[] = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date(now - i * dayMs);
      const dayKey = dayStart.toISOString().slice(0, 10);
      points.push({ date: dayKey, articleCount: 0, userCount: 0 });
    }
    return points;
  }
}
