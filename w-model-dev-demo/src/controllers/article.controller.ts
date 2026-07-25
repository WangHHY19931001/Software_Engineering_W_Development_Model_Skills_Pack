// SD-012 ArticleController — thin HTTP wrapper around ArticleService.

import type { Request, Response, NextFunction } from 'express';
import type { ArticleService } from '../services/article.service.js';
import type { AuthService } from '../services/auth.service.js';
import { ArticleStatus } from '../types.js';

export class ArticleController {
  constructor(
    private articleService: ArticleService,
    private authService: AuthService,
  ) {}

  create = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      res.status(201).json(this.articleService.createArticle(ctx.userId, req.body));
    } catch (err) {
      next(err);
    }
  };

  getById = (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.json(this.articleService.getById(req.params.articleId!));
    } catch (err) {
      next(err);
    }
  };

  submitForReview = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.articleService.submitForReview(ctx.userId, req.params.articleId!);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  publish = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.articleService.publishArticle(ctx.userId, req.params.articleId!);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  approve = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.articleService.approveArticle(ctx.userId, ctx.role, req.params.articleId!);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  offline = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.articleService.offlineArticle(ctx.userId, ctx.role, req.params.articleId!);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  archive = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.articleService.archiveArticle(ctx.userId, ctx.role, req.params.articleId!);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  republish = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.articleService.republishArticle(ctx.userId, ctx.role, req.params.articleId!);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  schedule = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.articleService.schedule(ctx.userId, req.params.articleId!, new Date(req.body.scheduledAt));
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  fireScheduledPublish = (req: Request, res: Response, next: NextFunction): void => {
    try {
      this.articleService.fireScheduledPublish(req.params.articleId!);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  batchOffline = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.articleService.batchOffline(ctx.userId, ctx.role, req.body.articleIds);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  listByAuthor = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 10);
      res.json(this.articleService.listByAuthor(req.params.authorId!, page, pageSize));
    } catch (err) {
      next(err);
    }
  };

  transition = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      const to = req.body.to as ArticleStatus;
      this.articleService.transition(ctx.userId, req.params.articleId!, to);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  private authContext(req: Request): { userId: string; role: string } {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    return this.authService.verifyToken(token);
  }
}
