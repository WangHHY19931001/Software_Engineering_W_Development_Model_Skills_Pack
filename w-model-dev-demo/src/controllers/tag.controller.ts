// SD-008 TagController — thin HTTP wrapper around TagService.

import type { Request, Response, NextFunction } from 'express';
import type { TagService } from '../services/tag.service.js';
import type { AuthService } from '../services/auth.service.js';

export class TagController {
  constructor(
    private tagService: TagService,
    private authService: AuthService,
  ) {}

  create = (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.status(201).json(this.tagService.createTag(req.body.name, req.body.slug));
    } catch (err) {
      next(err);
    }
  };

  approve = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      res.json(this.tagService.approveTag(ctx.userId, ctx.role, req.params.tagId!));
    } catch (err) {
      next(err);
    }
  };

  reject = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      res.json(this.tagService.rejectTag(ctx.userId, ctx.role, req.params.tagId!));
    } catch (err) {
      next(err);
    }
  };

  bind = (req: Request, res: Response, next: NextFunction): void => {
    try {
      this.tagService.bind(req.params.articleId!, req.body.tagIds);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  unbind = (req: Request, res: Response, next: NextFunction): void => {
    try {
      this.tagService.unbind(req.params.articleId!, req.body.tagIds);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  cloud = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const topN = Number(req.query.topN ?? 20);
      res.json(this.tagService.cloud(topN));
    } catch (err) {
      next(err);
    }
  };

  merge = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.tagService.merge(ctx.userId, ctx.role, req.body.sourceId, req.body.targetId);
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
