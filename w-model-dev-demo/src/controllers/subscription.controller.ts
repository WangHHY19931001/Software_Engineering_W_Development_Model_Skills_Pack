// SD-016 SubscriptionController — thin HTTP wrapper around SubscriptionService.

import type { Request, Response, NextFunction } from 'express';
import type { SubscriptionService } from '../services/subscription.service.js';
import type { AuthService } from '../services/auth.service.js';
import { SubscriptionTarget } from '../types.js';

export class SubscriptionController {
  constructor(
    private subscriptionService: SubscriptionService,
    private authService: AuthService,
  ) {}

  subscribe = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      const target = req.body.target as SubscriptionTarget;
      res.status(201).json(this.subscriptionService.subscribe(ctx.userId, target, req.body.targetId));
    } catch (err) {
      next(err);
    }
  };

  unsubscribe = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      const target = req.body.target as SubscriptionTarget;
      this.subscriptionService.unsubscribe(ctx.userId, target, req.body.targetId);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  list = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 10);
      const target = req.query.target ? (req.query.target as SubscriptionTarget) : undefined;
      res.json(this.subscriptionService.listByUser(ctx.userId, target, page, pageSize));
    } catch (err) {
      next(err);
    }
  };

  permission = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      const target = req.query.target ? (req.query.target as SubscriptionTarget) : SubscriptionTarget.Blogger;
      res.json({ level: this.subscriptionService.permission(ctx.userId, target) });
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
