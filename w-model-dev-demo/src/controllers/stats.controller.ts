// SD-006 StatsController — thin HTTP wrapper around StatsService.

import type { Request, Response, NextFunction } from 'express';
import type { StatsService } from '../services/stats.service.js';
import type { AuthService } from '../services/auth.service.js';

export class StatsController {
  constructor(
    private statsService: StatsService,
    private authService: AuthService,
  ) {}

  articleStats = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      res.json(this.statsService.articleStats(ctx.role));
    } catch (err) {
      next(err);
    }
  };

  userStats = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      res.json(this.statsService.userStats(ctx.role));
    } catch (err) {
      next(err);
    }
  };

  bloggerStats = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      res.json(this.statsService.bloggerStats(ctx.role));
    } catch (err) {
      next(err);
    }
  };

  siteTrend = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      const days = Number(req.query.days ?? 7);
      res.json(this.statsService.siteTrend(ctx.role, days));
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
