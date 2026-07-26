/**
 * 认证授权中间件（DD-004-001 AuthMiddleware / DD-004-002 RbacService）。
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { JwtUtil } from './auth.js';
import { AuthenticationError, AuthorizationError } from './errors.js';
import type { Role } from '../types.js';

export interface AuthenticatedUser {
  id: string;
  role: Role;
  email: string;
}

export class AuthMiddleware {
  constructor(private jwtUtil: JwtUtil) {}

  authenticate(): RequestHandler {
    return (req: Request, _res: Response, next: NextFunction): void => {
      const authHeader = req.headers['authorization'];
      if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        next(new AuthenticationError('缺少 Bearer 令牌'));
        return;
      }
      const token = authHeader.slice(7);
      try {
        const payload = this.jwtUtil.verify(token);
        const user: AuthenticatedUser = {
          id: payload.sub,
          email: payload.email,
          role: payload.role as Role,
        };
        (req as unknown as { user: AuthenticatedUser }).user = user;
        next();
      } catch (err) {
        if (err instanceof AuthenticationError) {
          next(err);
          return;
        }
        next(new AuthenticationError('令牌验证失败'));
      }
    };
  }

  requireRole(roles: Role[]): RequestHandler {
    return (req: Request, _res: Response, next: NextFunction): void => {
      const user = (req as unknown as { user?: AuthenticatedUser }).user;
      if (!user) {
        next(new AuthenticationError('未认证'));
        return;
      }
      if (!roles.includes(user.role)) {
        next(new AuthorizationError(`需要角色: ${roles.join(', ')}`));
        return;
      }
      next();
    };
  }
}

export class RbacService {
  private readonly permissions: Map<Role, Set<string>> = new Map();

  constructor() {
    this.permissions.set('admin', new Set(['*']));
    this.permissions.set('author', new Set(['article:create', 'article:update', 'article:delete', 'comment:create', 'comment:delete', 'tag:manage', 'category:manage']));
    this.permissions.set('reader', new Set(['comment:create', 'comment:delete:own', 'article:like']));
  }

  can(role: Role, permission: string): boolean {
    const perms = this.permissions.get(role);
    if (!perms) return false;
    if (perms.has('*')) return true;
    return perms.has(permission);
  }

  canAccess(role: Role, resource: string, action: string): boolean {
    return this.can(role, `${resource}:${action}`);
  }

  getPermissions(role: Role): string[] {
    const perms = this.permissions.get(role);
    if (!perms) return [];
    return [...perms];
  }
}
