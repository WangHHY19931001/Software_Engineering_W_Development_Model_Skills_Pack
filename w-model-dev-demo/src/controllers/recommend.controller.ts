// SD-004 RecommendController — thin HTTP wrapper around RecommendService.

import type { Request, Response, NextFunction } from 'express';
import type { RecommendService } from '../services/recommend.service.js';
import type { AuthService } from '../services/auth.service.js';

export class RecommendController {
  constructor(
    private recommendService: RecommendService,
    private authService: AuthService,
  ) {}

  hot = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 10);
      res.json(this.recommendService.hot(page, pageSize));
    } catch (err) {
      next(err);
    }
  };

  personalized = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 10);
      res.json(this.recommendService.personalized(ctx.userId, page, pageSize));
    } catch (err) {
      next(err);
    }
  };

  latest = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 10);
      res.json(this.recommendService.latest(page, pageSize));
    } catch (err) {
      next(err);
    }
  };

  setSlot = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.recommendService.setSlot(ctx.userId, ctx.role, req.body.slotName, req.body.articleId, req.body.priority);
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
