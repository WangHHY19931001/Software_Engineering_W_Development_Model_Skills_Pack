/**
 * bloggerStatsService（DD-032 / SD-005）：博主统计面板（REQ-025）。
 * 聚合：文章数（article store 经 SD-002）、评论数（comment store 经 SD-003）、阅读量/趋势（ReadingRecord store 本模块）。
 */
import type { ArticleService } from '../content/articleService';
import type { CommentService } from '../interaction/commentService';
import type { ReadingStatService } from './readingStatService';
import type { BloggerStats } from '../../types';

export class BloggerStatsService {
  constructor(
    private readonly articleService: ArticleService,
    private readonly commentService: CommentService,
    private readonly readingStatService: ReadingStatService,
  ) {}

  /** 博主面板：文章数（全部状态）/总阅读量（去重）/总评论数/近 7 天趋势 */
  async getBloggerStats(bloggerId: string): Promise<BloggerStats> {
    const articleCount = await this.articleService.countByAuthor(bloggerId);
    const articles = await this.articleService.findByAuthor(bloggerId);
    const articleIds = articles.map((a) => a.id);
    let totalViews = 0;
    for (const id of articleIds) {
      totalViews += this.readingStatService.getViewCount(id);
    }
    const totalComments = await this.commentService.countByArticleIds(articleIds);
    const trend = this.readingStatService.getTrend7d(articleIds);
    return { articleCount, totalViews, totalComments, trend };
  }

  /* ============ TLA+ Next 分支对应（L2_BlogSystemDiscovery "RefreshStats" / L2_BlogSystemAnalytics "RefreshPanel"） ============ */

  /** TLA+ L2_BlogSystemDiscovery "RefreshStats" 动作对应：刷新博主统计（实时聚合，无缓存） */
  async refreshStats(bloggerId: string): Promise<BloggerStats> {
    return this.getBloggerStats(bloggerId);
  }

  /** TLA+ L2_BlogSystemAnalytics "RefreshPanel" 动作对应：刷新统计面板（与 refreshStats 等价语义） */
  async refreshPanel(bloggerId: string): Promise<BloggerStats> {
    return this.getBloggerStats(bloggerId);
  }

  /** TLA+ L2_BlogSystemDiscovery "InvalidateStats" 动作对应：统计失效（实时聚合无缓存，无操作） */
  invalidateStats(): void {
    // 实时聚合（每次请求经 store 计算），无缓存可失效
  }

  /** TLA+ L2_BlogSystemAnalytics "InvalidatePanel" 动作对应：面板失效（与 invalidateStats 等价语义） */
  invalidatePanel(): void {
    // 实时聚合（每次请求经 store 计算），无缓存可失效
  }
}
