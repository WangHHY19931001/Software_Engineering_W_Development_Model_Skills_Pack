// 文章控制器：处理发布/列表/详情/审核 HTTP 请求，编排 ArticleService 与 ReviewService
// 对应 detailed-design.md DD-ARTICLE-CTRL
import type { Request, Response } from 'express';
import { articleService } from '../services/article.service';
import type { ArticleService } from '../services/article.service';
import { reviewService } from '../services/review.service';
import type { ReviewService } from '../services/review.service';
import { AppError } from '../utils/errors';

export class ArticleController {
  constructor(
    private articleService: ArticleService,
    private reviewService: ReviewService,
  ) {}

  async publishArticle(req: Request, res: Response): Promise<void> {
    const { title, content } = req.body as { title: string; content: string };
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError(40101, '未授权');
    }
    const result = this.articleService.publish(userId, title, content);
    if (!result.ok) {
      throw new AppError(result.code, result.message);
    }
    res.status(201).json({
      code: 0,
      message: '发布成功',
      data: {
        articleId: result.data.articleId,
        status: result.data.status,
        createdAt: result.data.createdAt,
      },
    });
  }

  async listArticles(req: Request, res: Response): Promise<void> {
    const role = req.user?.role ?? 'user';
    const result = this.articleService.list(role);
    if (!result.ok) {
      throw new AppError(result.code, result.message);
    }
    res.status(200).json({
      code: 0,
      message: '查询成功',
      data: { articles: result.data },
    });
  }

  async getArticle(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    const role = req.user?.role ?? 'user';
    // getById 成功返回 Article，失败抛 AppError（UT-007 场景）
    const article = this.articleService.getById(id, role);
    res.status(200).json({
      code: 0,
      message: '查询成功',
      data: {
        articleId: article.id,
        title: article.title,
        content: article.content,
        status: article.status,
        authorId: article.authorId,
        createdAt: article.createdAt,
      },
    });
  }

  async reviewArticle(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    const { action } = req.body as { action: 'approve' | 'reject' };
    const reviewerId = req.user?.userId;
    if (!reviewerId) {
      throw new AppError(40101, '未授权');
    }
    const result = this.reviewService.review(id, action, reviewerId);
    if (!result.ok) {
      throw new AppError(result.code, result.message);
    }
    res.status(200).json({
      code: 0,
      message: '审核成功',
      data: { articleId: id, status: result.data.status },
    });
  }
}

export const articleController = new ArticleController(articleService, reviewService);
