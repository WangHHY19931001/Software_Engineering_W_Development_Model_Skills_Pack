// SD-011 NotificationController — thin HTTP wrapper around NotificationService.

import type { Request, Response, NextFunction } from 'express';
import type { NotificationService } from '../services/notification.service.js';
import type { AuthService } from '../services/auth.service.js';

export class NotificationController {
  constructor(
    private notificationService: NotificationService,
    private authService: AuthService,
  ) {}

  list = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      res.json(this.notificationService.listByUser(ctx.userId));
    } catch (err) {
      next(err);
    }
  };

  markRead = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.notificationService.markRead(ctx.userId, req.params.notificationId!);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  markAllRead = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.notificationService.markAllRead(ctx.userId);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  updateSettings = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      res.json(this.notificationService.updateNotificationSetting(ctx.userId, req.body));
    } catch (err) {
      next(err);
    }
  };

  unreadSize = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      res.json({ count: this.notificationService.unreadSize(ctx.userId) });
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
