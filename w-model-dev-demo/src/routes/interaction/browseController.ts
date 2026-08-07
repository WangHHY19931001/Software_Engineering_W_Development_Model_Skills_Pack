/**
 * BrowseController（DD-014 / SD-003 路由处理）：公开浏览（列表/详情）。
 * 详情：路径 id + clientIp 注入 → articleBrowseService → 200 详情；40402 防枚举。
 * 列表/详情响应补充 viewCount/likeCount/favoriteCount 聚合（INTF-011，副作用时序：
 * 详情 viewCount 在 reading.viewed 事件分发后聚合 → 响应反映已生效的阅读量）。
 */
import type { Request, Response, NextFunction } from 'express';
import { parsePage } from '../../utils/validationUtil';
import { sendError } from '../../utils/respond';
import type { ArticleBrowseService } from '../../services/interaction/articleBrowseService';
import type { LikeService } from '../../services/interaction/likeService';
import type { ReadingStatService } from '../../services/stats/readingStatService';
import type { AuthService } from '../../services/identity/authService';
import type { Article } from '../../types';

export class BrowseController {
  constructor(
    private readonly articleBrowseService: ArticleBrowseService,
    private readonly likeService: LikeService,
    private readonly readingStatService: ReadingStatService,
    private readonly authService: AuthService,
  ) {}

  async listArticles(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const { page, pageSize } = parsePage(req.query.page, req.query.pageSize);
      const filters = {
        categoryId: typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined,
        tag: typeof req.query.tag === 'string' ? req.query.tag : undefined,
        keyword: typeof req.query.keyword === 'string' ? req.query.keyword : undefined,
      };
      const result = await this.articleBrowseService.listPublishedArticles(filters, page, pageSize);
      const items = await Promise.all(
        result.items.map(async (a) => this.toListItem(a)),
      );
      res.json({ code: 0, message: 'ok', data: { items, total: result.total, page: result.page, pageSize: result.pageSize } });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async getArticle(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const clientIp = req.ip ?? 'unknown';
      const detail = await this.articleBrowseService.getPublishedArticleDetail(req.params.id, clientIp);
      const article = detail.article;
      const author = await this.authService.getUserById(article.authorId);
      const category = article.categoryId
        ? { categoryId: article.categoryId }
        : null;
      res.json({
        code: 0,
        message: 'ok',
        data: {
          articleId: article.id,
          title: article.title,
          body: article.body,
          summary: article.summary,
          author: { userId: article.authorId, username: author?.username ?? '', bio: author?.bio ?? null },
          tags: article.tags,
          category,
          viewCount: detail.viewCount,
          likeCount: this.likeService.countLikes(article.id),
          favoriteCount: this.likeService.countFavorites(article.id),
          publishedAt: article.publishedAt,
        },
      });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  private async toListItem(a: Article): Promise<Record<string, unknown>> {
    const author = await this.authService.getUserById(a.authorId);
    return {
      articleId: a.id,
      title: a.title,
      summary: a.summary,
      author: { userId: a.authorId, username: author?.username ?? '' },
      tags: a.tags,
      category: a.categoryId ? { categoryId: a.categoryId } : null,
      viewCount: this.readingStatService.getViewCount(a.id),
      likeCount: this.likeService.countLikes(a.id),
      favoriteCount: this.likeService.countFavorites(a.id),
      publishedAt: a.publishedAt,
    };
  }
}
