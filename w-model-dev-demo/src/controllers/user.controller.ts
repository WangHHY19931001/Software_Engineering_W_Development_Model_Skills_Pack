// SD-003 UserController + AuthController — thin HTTP wrappers for auth + user management.

import type { Request, Response, NextFunction } from 'express';
import type { AuthService, UserService } from '../services/auth.service.js';

export class UserController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.authService.register(req.body);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.login(req.body.email, req.body.password);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  logout = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const header = req.headers.authorization ?? '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : '';
      this.authService.userLogout(token);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  ban = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.userService.ban(ctx.userId, ctx.role, req.params.userId!, req.body.reason);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  unban = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.userService.unbanUser(ctx.userId, ctx.role, req.params.userId!);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  me = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      res.json(this.userService.getById(ctx.userId));
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
