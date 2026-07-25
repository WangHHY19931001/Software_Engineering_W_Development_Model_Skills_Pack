// SD-005 AdController — thin HTTP wrapper around AdService.

import type { Request, Response, NextFunction } from 'express';
import type { AdService } from '../services/ad.service.js';
import type { AuthService } from '../services/auth.service.js';

export class AdController {
  constructor(
    private adService: AdService,
    private authService: AuthService,
  ) {}

  create = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      res.status(201).json(this.adService.create(ctx.userId, ctx.role, req.body));
    } catch (err) {
      next(err);
    }
  };

  audit = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.adService.audit(ctx.userId, ctx.role, req.params.adId!, req.body.decision);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  recordClick = (req: Request, res: Response, next: NextFunction): void => {
    try {
      this.adService.recordClick(req.params.adId!);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  listBySlot = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 10);
      res.json(this.adService.listBySlot(req.params.slotId!, page, pageSize));
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
