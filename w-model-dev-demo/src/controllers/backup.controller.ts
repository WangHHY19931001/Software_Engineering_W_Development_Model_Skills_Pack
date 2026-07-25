// SD-017 BackupController — thin HTTP wrapper around BackupService.

import type { Request, Response, NextFunction } from 'express';
import type { BackupService } from '../services/backup.service.js';
import type { AuthService } from '../services/auth.service.js';
import { BackupType } from '../types.js';

export class BackupController {
  constructor(
    private backupService: BackupService,
    private authService: AuthService,
  ) {}

  create = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      const type = req.body.type as BackupType;
      const payload = Buffer.from(req.body.payload ?? '', 'base64');
      res.status(201).json(this.backupService.createBackup(ctx.userId, ctx.role, type, payload));
    } catch (err) {
      next(err);
    }
  };

  exportUserData = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      const buffer = this.backupService.exportUserData(req.params.userId! ?? ctx.userId);
      res.json({ data: buffer.toString('base64'), size: buffer.length });
    } catch (err) {
      next(err);
    }
  };

  restore = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.backupService.restore(ctx.userId, ctx.role, req.params.backupId!);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  incremental = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      const since = new Date(req.query.since as string);
      const buffer = this.backupService.incremental(ctx.userId, ctx.role, since);
      res.json({ data: buffer.toString('base64'), size: buffer.length });
    } catch (err) {
      next(err);
    }
  };

  verifyIntegrity = (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.json({ valid: this.backupService.verifyIntegrity(req.params.backupId!) });
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
