/**
 * Auth 中间件 - JWT 验证
 */
import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { AppError, AuthError, ErrorCode } from '../utils/errors.js';
import type { JwtPayload, UserRole } from '../types/index.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

export function authMiddleware(required: boolean = true) {
  return function (req: Request, _res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header || typeof header !== 'string') {
      if (required) {
        return next(new AuthError('Missing Authorization header', ErrorCode.UNAUTHENTICATED));
      }
      return next();
    }
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return next(new AuthError('Invalid Authorization scheme', ErrorCode.UNAUTHENTICATED));
    }
    try {
      const payload = verifyToken(token);
      req.auth = payload;
      next();
    } catch (err) {
      if (err instanceof AppError) {
        return next(err);
      }
      next(new AuthError('Token verification failed', ErrorCode.TOKEN_INVALID));
    }
  };
}

export function requireRole(...roles: string[]) {
  return function (req: Request, _res: Response, next: NextFunction): void {
    if (!req.auth) {
      return next(new AuthError('Authentication required', ErrorCode.UNAUTHENTICATED));
    }
    if (!roles.includes(req.auth.role)) {
      return next(new AppError(ErrorCode.FORBIDDEN, 'Insufficient role', 403));
    }
    next();
  };
}

export function optionalAuth() {
  return authMiddleware(false);
}
