import { type Request, type Response, type NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { UnauthorizedError } from '../utils/errors.js';

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError(40103, '未提供认证令牌'));
  }
  const token = header.slice(7);
  try {
    const payload = verifyToken(token);
    req.user = { userId: payload.userId, username: payload.username };
    next();
  } catch (err) {
    next(err);
  }
}
