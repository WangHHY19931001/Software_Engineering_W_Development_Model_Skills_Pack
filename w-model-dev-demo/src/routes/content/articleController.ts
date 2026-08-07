/**
 * ArticleController（DD-005 / SD-002 路由处理）：文章创建/发布/归档/取消归档/更新/删除/我的列表。
 * createArticle 入口显式校验 role=blogger（requireBlogger + 控制器双保险，角色校验清单）。
 */
import type { Request, Response, NextFunction } from 'express';
import { parse, articleCreateSchema, articleUpdateSchema, parsePage } from '../../utils/validationUtil';
import { sendError } from '../../utils/respond';
import { BizError } from '../../utils/errors';
import type { ArticleService } from '../../services/content/articleService';
import type { Article, ArticleStatus } from '../../types';

const ARTICLE_STATUSES: ArticleStatus[] = ['draft', 'published', 'archived'];

export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  async createArticle(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireBlogger(req);
      const body = parse(articleCreateSchema, req.body).data;
      const article = await this.articleService.createArticle(userId, body);
      res.status(201).json({
        code: 0,
        message: 'ok',
        data: {
          articleId: article.id,
          title: article.title,
          summary: article.summary,
          status: article.status,
          tags: article.tags,
          categoryId: article.categoryId,
          author: { userId },
          createdAt: article.createdAt,
        },
      });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async publishArticle(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      const article = await this.articleService.publishArticle(req.params.id, userId);
      res.json({ code: 0, message: 'ok', data: { articleId: article.id, status: article.status, publishedAt: article.publishedAt } });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async archiveArticle(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      const article = await this.articleService.archiveArticle(req.params.id, userId);
      res.json({ code: 0, message: 'ok', data: { articleId: article.id, status: article.status } });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async unarchiveArticle(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      const article = await this.articleService.unarchiveArticle(req.params.id, userId);
      res.json({ code: 0, message: 'ok', data: { articleId: article.id, status: article.status } });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async updateArticle(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      const patch = parse(articleUpdateSchema, req.body).data;
      const article = await this.articleService.updateArticle(req.params.id, userId, patch);
      res.json({ code: 0, message: 'ok', data: { articleId: article.id, title: article.title, status: article.status, updatedAt: article.updatedAt } });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async deleteArticle(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      await this.articleService.deleteArticle(req.params.id, userId);
      res.status(204).send();
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async listMyArticles(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      const { page, pageSize } = parsePage(req.query.page, req.query.pageSize);
      const statusRaw = req.query.status;
      const status = statusRaw === undefined ? undefined : (statusRaw as string);
      if (status !== undefined && !ARTICLE_STATUSES.includes(status as ArticleStatus)) {
        throw new BizError(40002, 'status 枚举非法');
      }
      const result = await this.articleService.listMyArticles(userId, status as ArticleStatus | undefined, page, pageSize);
      res.json({
        code: 0,
        message: 'ok',
        data: {
          items: result.items.map((a) => ({ articleId: a.id, title: a.title, status: a.status, updatedAt: a.updatedAt, publishedAt: a.publishedAt })),
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
        },
      });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  protected requireUser(req: Request): string {
    if (!req.user?.userId) {
      throw new BizError(40101);
    }
    return req.user.userId;
  }

  protected requireBlogger(req: Request): string {
    const userId = this.requireUser(req);
    if (req.user?.role !== 'blogger') {
      throw new BizError(40301);
    }
    return userId;
  }
}

export type { Article };
