/**
 * authMiddleware（DD-041 / SD-007）：JWT 认证（CON-003/NFR-002）。
 * Bearer 解析 → jwtUtil.verify → req.user={userId, role}；缺失/伪造 40101，过期 40102（RH-02 令牌状态机）；
 * requireBlogger 角色守卫（40301，角色校验清单——P7-001 预防）。
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { BizError } from '../utils/errors';
import type { JwtUtil } from '../utils/jwtUtil';

export class AuthMiddleware {
  constructor(private readonly jwtUtil: JwtUtil) {}

  authenticate(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      next(new BizError(40101));
      return;
    }
    const token = header.slice('Bearer '.length).trim();
    try {
      const payload = this.jwtUtil.verify(token);
      // active ⇒ registered 不变式由签发侧保证（issueToken 前置 userId 已注册）
      req.user = { userId: payload.sub, role: payload.role };
      next();
    } catch (err) {
      next(err);
    }
  }

  /** 角色守卫：仅博主（40301） */
  requireBlogger(req: Request, res: Response, next: NextFunction): void {
    if (req.user?.role !== 'blogger') {
      next(new BizError(40301));
      return;
    }
    next();
  }
}

/** 便捷工厂：authenticate 绑定实例后作为 RequestHandler 使用 */
export function authGuard(jwtUtil: JwtUtil): { authenticate: RequestHandler; requireBlogger: RequestHandler } {
  const middleware = new AuthMiddleware(jwtUtil);
  return {
    authenticate: middleware.authenticate.bind(middleware),
    requireBlogger: middleware.requireBlogger.bind(middleware),
  };
}
