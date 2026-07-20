import type { NextFunction, Request, Response } from 'express';
import { userService } from '../services/user-service.js';
import { UnauthorizedError } from '../utils/errors.js';

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing Bearer token'));
  }
  const token = header.slice('Bearer '.length);
  const payload = userService.verifyToken(token);
  if (!payload) {
    return next(new UnauthorizedError('Invalid or expired token'));
  }
  req.userId = payload.userId;
  next();
}
