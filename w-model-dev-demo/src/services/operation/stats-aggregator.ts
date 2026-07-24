/**
 * DD-019 StatsAggregator —— 统计聚合器
 *
 * 4 类统计聚合（文章/用户/博主/站点）+ CSV/JSON 报表导出。
 * 依赖：DD-009 ArticleStore、DD-004 UserStore。
 * 热度公式（GAP-006）：rawHeat * exp(-ageDays/7)。
 */
import type { Article } from '../../types.js';
import { articleStore } from '../../stores/article-store.js';
import { userStore } from '../../stores/user-store.js';
import { AppError } from '../../utils/errors.js';

export interface ArticleStatsReport {
  total: number;
  statusDistribution: Record<string, number>;
  tagDistribution: Record<string, number>;
}

export interface UserStatsReport {
  total: number;
  roleDistribution: Record<string, number>;
  activeCount: number;
  bannedCount: number;
}

export interface BloggerStatsReport {
  total: number;
  topByFollowers: { bloggerId: string; followerCount: number }[];
  topByArticles: { bloggerId: string; articleCount: number }[];
}

export interface SiteStatsReport {
  users: UserStatsReport;
  articles: ArticleStatsReport;
  bloggers: BloggerStatsReport;
}

export type ReportFormat = 'csv' | 'json';
export type ReportType = 'article' | 'user' | 'blogger' | 'site';

export class StatsAggregator {
  /** 计算热度（对应 DD-019 calculateHeat，GAP-006） */
  calculateHeat(article: Pick<Article, 'stats' | 'publishedAt'>): number {
    const now = Math.floor(Date.now() / 1000);
    const publishedAt = article.publishedAt ?? now;
    const ageDays = (now - publishedAt) / 86400;
    const decay = Math.exp(-ageDays / 7);
    const rawHeat =
      article.stats.likes * 2 + article.stats.comments * 3 + article.stats.views * 1;
    return rawHeat * decay;
  }

  /** 文章统计（对应 DD-019 getArticleStats） */
  getArticleStats(): ArticleStatsReport {
    const all = articleStore.listAll();
    const statusDistribution: Record<string, number> = {};
    const tagDistribution: Record<string, number> = {};
    for (const a of all) {
      statusDistribution[a.status] = (statusDistribution[a.status] ?? 0) + 1;
      for (const t of a.tagIds) {
        tagDistribution[t] = (tagDistribution[t] ?? 0) + 1;
      }
    }
    return { total: all.length, statusDistribution, tagDistribution };
  }

  /** 用户统计（对应 DD-019 getUserStats） */
  getUserStats(): UserStatsReport {
    const all = userStore.list();
    const roleDistribution: Record<string, number> = {};
    let activeCount = 0;
    let bannedCount = 0;
    for (const u of all) {
      roleDistribution[u.role] = (roleDistribution[u.role] ?? 0) + 1;
      if (u.status === 'active') activeCount++;
      if (u.status === 'banned') bannedCount++;
    }
    return { total: all.length, roleDistribution, activeCount, bannedCount };
  }

  /** 博主统计（对应 DD-019 getBloggerStats） */
  getBloggerStats(): BloggerStatsReport {
    const bloggers = userStore.list().filter(u => u.role === 'blogger');
    const topByArticles = bloggers
      .map(b => ({ bloggerId: b.id, articleCount: articleStore.findByAuthor(b.id).length }))
      .sort((a, b) => b.articleCount - a.articleCount)
      .slice(0, 10);
    // topByFollowers 需依赖 FollowService；此处简化为空数组
    return {
      total: bloggers.length,
      topByFollowers: [],
      topByArticles,
    };
  }

  /** 站点统计（对应 DD-019 getSiteStats） */
  getSiteStats(): SiteStatsReport {
    return {
      users: this.getUserStats(),
      articles: this.getArticleStats(),
      bloggers: this.getBloggerStats(),
    };
  }

  /** 报表导出（对应 DD-019 exportReport） */
  exportReport(format: ReportFormat, type: ReportType): Buffer {
    if (format !== 'csv' && format !== 'json') {
      throw new AppError(40003, `非法格式: ${format}`, { format });
    }
    if (format === 'json') {
      let data: unknown;
      switch (type) {
        case 'article': data = this.getArticleStats(); break;
        case 'user': data = this.getUserStats(); break;
        case 'blogger': data = this.getBloggerStats(); break;
        case 'site': data = this.getSiteStats(); break;
        default: throw new AppError(40003, `非法报表类型: ${type}`, { type });
      }
      return Buffer.from(JSON.stringify(data, null, 2));
    }
    // CSV
    if (type === 'article') {
      const lines: string[] = ['id,title,status'];
      for (const a of articleStore.listAll()) {
        lines.push(`${a.id},${this.csvEscape(a.title)},${a.status}`);
      }
      return Buffer.from(lines.join('\n'));
    }
    const lines: string[] = ['key,value'];
    let data: Record<string, unknown>;
    switch (type) {
      case 'user': data = this.getUserStats() as unknown as Record<string, unknown>; break;
      case 'blogger': data = this.getBloggerStats() as unknown as Record<string, unknown>; break;
      case 'site': data = this.getSiteStats() as unknown as Record<string, unknown>; break;
      default: throw new AppError(40003, `非法报表类型: ${type}`, { type });
    }
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'number' || typeof v === 'string') {
        lines.push(`${k},${this.csvEscape(String(v))}`);
      } else if (typeof v === 'object' && v !== null) {
        for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
          lines.push(`${k}.${k2},${this.csvEscape(String(v2))}`);
        }
      }
    }
    return Buffer.from(lines.join('\n'));
  }

  private csvEscape(s: string): string {
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }
}
