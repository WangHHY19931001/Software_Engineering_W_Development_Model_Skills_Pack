// SD-015 FileController — thin HTTP wrapper around FileService.

import type { Request, Response, NextFunction } from 'express';
import type { FileService } from '../services/file.service.js';
import type { AuthService } from '../services/auth.service.js';

export class FileController {
  constructor(
    private fileService: FileService,
    private authService: AuthService,
  ) {}

  upload = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      const content = Buffer.from(req.body.content ?? '', 'base64');
      const file = this.fileService.upload(ctx.userId, {
        filename: req.body.filename,
        mimeType: req.body.mimeType,
        content,
      });
      res.status(201).json(file);
    } catch (err) {
      next(err);
    }
  };

  getQuota = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      res.json(this.fileService.getQuota(ctx.userId));
    } catch (err) {
      next(err);
    }
  };

  getById = (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.json(this.fileService.getById(req.params.fileId!));
    } catch (err) {
      next(err);
    }
  };

  listByUser = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      res.json(this.fileService.listByUser(ctx.userId));
    } catch (err) {
      next(err);
    }
  };

  delete = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.fileService.delete(ctx.userId, ctx.role, req.params.fileId!);
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
