// SD-002 BloggerController — thin HTTP wrapper around BloggerService.

import type { Request, Response, NextFunction } from 'express';
import type { BloggerService } from '../services/blogger.service.js';
import type { AuthService } from '../services/auth.service.js';

export class BloggerController {
  constructor(
    private bloggerService: BloggerService,
    private authService: AuthService,
  ) {}

  register = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      res.status(201).json(this.bloggerService.register(ctx.userId, req.body.slug, req.body.bio));
    } catch (err) {
      next(err);
    }
  };

  getBySlug = (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.json(this.bloggerService.getBySlug(req.params.slug!));
    } catch (err) {
      next(err);
    }
  };

  follow = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.bloggerService.follow(ctx.userId, req.params.bloggerId!);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  unfollow = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.bloggerService.unfollow(ctx.userId, req.params.bloggerId!);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  listByFollower = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 10);
      res.json(this.bloggerService.listByFollower(ctx.userId, page, pageSize));
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
