/**
 * 认证中间件 —— JWT token 解析与注入 req.user
 *
 * 从 Authorization header 提取 Bearer token，验证后注入 req.user。
 * 不强制登录（可选认证）；强制登录由 RbacMiddleware.requireRole 处理。
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { verify, type JwtPayload } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & { id?: string; role?: string };
    }
  }
}

/** 从 Authorization header 提取 Bearer token */
export function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || typeof auth !== 'string') return null;
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

/** 认证中间件：解析 JWT 并注入 req.user（不强制登录） */
export const authenticate: RequestHandler = (req: Request, _res: Response, next: NextFunction): void => {
  const token = extractToken(req);
  if (token) {
    try {
      const payload = verify(token);
      req.user = {
        userId: payload.userId,
        role: payload.role,
        id: payload.userId,
        ...payload,
      };
    } catch {
      // token 无效时不报错，仅不注入 user（后续 RBAC 中间件处理）
    }
  }
  next();
};

/** 强制登录中间件：无有效 token 抛 40101 */
export const requireAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user || !req.user.userId) {
    throw new AppError(40101, '未登录');
  }
  next();
};
