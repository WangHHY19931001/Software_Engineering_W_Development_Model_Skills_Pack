// SD-001 SiteController — thin HTTP wrapper around SiteService.

import type { Request, Response, NextFunction } from 'express';
import type { SiteService } from '../services/site.service.js';
import type { AuthService } from '../services/auth.service.js';

export class SiteController {
  constructor(
    private siteService: SiteService,
    private authService: AuthService,
  ) {}

  getConfig = (_req: Request, res: Response, next: NextFunction): void => {
    try {
      res.json(this.siteService.getConfig());
    } catch (err) {
      next(err);
    }
  };

  updateConfig = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      res.json(this.siteService.updateConfig(ctx.userId, ctx.role, req.body));
    } catch (err) {
      next(err);
    }
  };

  setMaintenanceMode = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      const enabled = Boolean(req.body.enabled);
      this.siteService.setMaintenanceMode(ctx.userId, ctx.role, enabled);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  scheduleAnnouncement = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      const at = new Date(req.body.at);
      this.siteService.scheduleAnnouncement(ctx.userId, ctx.role, req.body.text, at);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  getStatsOverview = (_req: Request, res: Response, next: NextFunction): void => {
    try {
      res.json(this.siteService.getStatsOverview());
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
