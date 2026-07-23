/**
 * AuthMiddleware：Bearer token 提取 + JWT 校验（realizes INTF-006 / DD-009）。
 * 缺失/非 Bearer 抛 40103；无效/过期抛 40102；合法则挂载 req.user。
 */
import type { RequestHandler } from 'express';
import type { JwtService } from '../utils/jwt';
import { UnauthorizedError, ErrorCode } from '../utils/errors';

const BEARER_PREFIX = 'Bearer ';

export function authMiddleware(jwtService: JwtService): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith(BEARER_PREFIX)) {
      return next(new UnauthorizedError(ErrorCode.UNAUTHORIZED_MISSING_TOKEN, '未提供认证令牌'));
    }
    const token = header.slice(BEARER_PREFIX.length).trim();
    try {
      const payload = jwtService.verify(token);
      req.user = { userId: payload.userId, username: payload.username };
      next();
    } catch (err) {
      next(err);
    }
  };
}
