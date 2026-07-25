// SD-014 PushController — thin HTTP wrapper around PushService.

import type { Request, Response, NextFunction } from 'express';
import type { PushService } from '../services/push.service.js';
import type { AuthService } from '../services/auth.service.js';

export class PushController {
  constructor(
    private pushService: PushService,
    private authService: AuthService,
  ) {}

  push = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const stats = this.pushService.push(req.params.userId!, req.body.channel, req.body.message);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  };

  broadcast = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const pushed = this.pushService.broadcast(req.body.channel, req.body.message);
      res.json({ pushed });
    } catch (err) {
      next(err);
    }
  };

  flushOffline = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      res.json(this.pushService.flushOffline(ctx.userId));
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
