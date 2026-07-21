import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { JwtUtils } from '../utils/jwt.js';
import { AuthError } from '../utils/errors.js';

/**
 * JWT 鉴权中间件。
 *
 * 设计来源：`docs/detailed-design.md` §3.4 / REQ-001 / NFR-001。
 * - 从 `Authorization: Bearer <token>` 提取 token；缺失或不以 `Bearer ` 开头 → 40103。
 * - `jwtUtils.verify` 失败（过期 / 伪造 / 签名错误）→ 40102。
 * - 校验通过后 `req.user = { userId, username }` 并调用 `next()`。
 */
export class AuthMiddleware {
  constructor(private readonly jwtUtils: JwtUtils) {}

  verify: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      next(new AuthError(40103, '未提供认证令牌'));
      return;
    }
    const token = header.slice('Bearer '.length).trim();
    try {
      const payload = this.jwtUtils.verify(token);
      req.user = { userId: payload.userId, username: payload.username };
      next();
    } catch (err) {
      // JwtUtils.verify 抛出的 AuthError(40102) 直接透传
      next(err instanceof AuthError ? err : new AuthError(40102, 'JWT 已过期或无效'));
    }
  };
}
