// 鉴权中间件：JWT 校验 + admin 角色守卫
// 对应 detailed-design.md DD-AUTH-MW：authenticate 注入 req.user；requireAdmin 校验角色
import type { Request, Response, NextFunction } from 'express';
import { jwtUtil } from '../utils/jwt';
import type { JwtUtil } from '../utils/jwt';
import { AppError } from '../utils/errors';

export class AuthMiddleware {
  constructor(private jwtUtil: JwtUtil) {}

  authenticate(req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError(40101, '未授权：缺少 Bearer token'));
    }
    const token = authHeader.slice('Bearer '.length);
    try {
      const payload = this.jwtUtil.verify(token);
      req.user = { userId: payload.userId, role: payload.role };
      next();
    } catch {
      next(new AppError(40101, '未授权：token 无效或过期'));
    }
  }

  requireAdmin(req: Request, res: Response, next: NextFunction): void {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ code: 40301, message: '禁止访问：需要管理员权限' });
      return;
    }
    next();
  }
}

export const authMiddleware = new AuthMiddleware(jwtUtil);
