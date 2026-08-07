/**
 * AuthController（DD-001 / SD-001 路由处理）：注册/登录/博主申请/资料/改密。
 * 仅参数透传（校验委托 validationUtil、业务委托 authService/profileService、响应组装），不含业务规则（NFR-005）。
 */
import type { Request, Response, NextFunction } from 'express';
import { parse, registerSchema, loginSchema, profilePatchSchema, changePasswordSchema } from '../../utils/validationUtil';
import { sendError } from '../../utils/respond';
import type { AuthService } from '../../services/identity/authService';
import type { ProfileService } from '../../services/identity/profileService';
import { BizError } from '../../utils/errors';

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly profileService: ProfileService,
  ) {}

  async register(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const body = parse(registerSchema, req.body).data;
      const user = await this.authService.register(body);
      res.status(201).json({
        code: 0,
        message: 'ok',
        data: { userId: user.userId, username: user.username, email: user.email, role: user.role, createdAt: user.createdAt },
      });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async login(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const body = parse(loginSchema, req.body).data;
      const session = await this.authService.login(body.identifier, body.password);
      res.json({ code: 0, message: 'ok', data: session });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async applyBlogger(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      const user = await this.authService.applyBlogger(userId);
      res.json({ code: 0, message: 'ok', data: { userId: user.userId, role: 'blogger' as const, updatedAt: user.createdAt } });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async getProfile(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      const profile = await this.profileService.getProfile(userId);
      res.json({ code: 0, message: 'ok', data: profile });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async updateProfile(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      const patch = parse(profilePatchSchema, req.body).data;
      const profile = await this.profileService.updateProfile(userId, patch);
      res.json({ code: 0, message: 'ok', data: profile });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async changePassword(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      const body = parse(changePasswordSchema, req.body).data;
      if (body.oldPassword === body.newPassword) {
        throw new BizError(40002, '新旧密码不能相同');
      }
      await this.profileService.changePassword(userId, body.oldPassword, body.newPassword);
      res.json({ code: 0, message: 'ok', data: { updated: true } });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  protected requireUser(req: Request): string {
    if (!req.user?.userId) {
      throw new BizError(40101);
    }
    return req.user.userId;
  }
}
