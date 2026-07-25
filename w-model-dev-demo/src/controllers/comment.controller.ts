// SD-010 CommentController — thin HTTP wrapper around CommentService.

import type { Request, Response, NextFunction } from 'express';
import type { CommentService } from '../services/comment.service.js';
import type { AuthService } from '../services/auth.service.js';

export class CommentController {
  constructor(
    private commentService: CommentService,
    private authService: AuthService,
  ) {}

  create = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      const parentId = req.body.parentId ?? null;
      res.status(201).json(
        this.commentService.createComment(req.params.articleId!, ctx.userId, parentId, req.body.content),
      );
    } catch (err) {
      next(err);
    }
  };

  audit = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.commentService.audit(ctx.userId, ctx.role, req.params.commentId!, req.body.decision);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  like = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.commentService.like(ctx.userId, req.params.commentId!);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  report = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.commentService.reportComment(ctx.userId, req.params.commentId!, req.body.reason);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  listByArticle = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 10);
      const rawSort = String(req.query.sort ?? 'newest');
      const sort: 'newest' | 'oldest' | 'popular' =
        rawSort === 'oldest' || rawSort === 'popular' ? rawSort : 'newest';
      res.json(this.commentService.listByArticle(req.params.articleId!, page, pageSize, sort));
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
