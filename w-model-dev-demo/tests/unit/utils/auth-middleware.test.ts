import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthMiddleware, RbacService } from '../../../src/utils/auth-middleware.js';
import { JwtUtil } from '../../../src/utils/auth.js';
import { AuthenticationError, AuthorizationError } from '../../../src/utils/errors.js';

const SECRET = 'test-secret-blog-demo-32chars-min!!';

describe('AuthMiddleware (DD-004-001)', () => {
  it('TC-UNIT-011N: 合法 Bearer token 通过', () => {
    const jwt = new JwtUtil(SECRET);
    const mw = new AuthMiddleware(jwt);
    const token = jwt.sign({ sub: 'u1', email: 'a@b.com', role: 'admin' });
    const next = vi.fn();
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    mw.authenticate()(req, {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith();
    expect((req as unknown as { user: { id: string } }).user.id).toBe('u1');
  });

  it('TC-UNIT-011E: 缺少 Authorization header 抛 AuthenticationError', () => {
    const mw = new AuthMiddleware(new JwtUtil(SECRET));
    const next = vi.fn();
    mw.authenticate()({ headers: {} } as unknown as Request, {} as Response, next as NextFunction);
    const err = next.mock.calls[0]![0];
    expect(err).toBeInstanceOf(AuthenticationError);
  });

  it('TC-UNIT-011B: Bearer 前缀错误也拒绝', () => {
    const mw = new AuthMiddleware(new JwtUtil(SECRET));
    const next = vi.fn();
    mw.authenticate()({ headers: { authorization: 'Basic abc' } } as unknown as Request, {} as Response, next as NextFunction);
    expect(next.mock.calls[0]![0]).toBeInstanceOf(AuthenticationError);
  });

  it('requireRole: 角色匹配通过', () => {
    const mw = new AuthMiddleware(new JwtUtil(SECRET));
    const next = vi.fn();
    const req = { headers: {} } as unknown as Request;
    (req as unknown as { user: { role: string } }).user = { role: 'admin' };
    mw.requireRole(['admin', 'author'])(req, {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith();
  });

  it('requireRole: 角色不匹配抛 AuthorizationError', () => {
    const mw = new AuthMiddleware(new JwtUtil(SECRET));
    const next = vi.fn();
    const req = { headers: {} } as unknown as Request;
    (req as unknown as { user: { role: string } }).user = { role: 'reader' };
    mw.requireRole(['admin'])(req, {} as Response, next as NextFunction);
    expect(next.mock.calls[0]![0]).toBeInstanceOf(AuthorizationError);
  });

  it('requireRole: 未认证抛 AuthenticationError', () => {
    const mw = new AuthMiddleware(new JwtUtil(SECRET));
    const next = vi.fn();
    mw.requireRole(['admin'])({ headers: {} } as unknown as Request, {} as Response, next as NextFunction);
    expect(next.mock.calls[0]![0]).toBeInstanceOf(AuthenticationError);
  });
});

describe('RbacService (DD-004-002)', () => {
  it('admin 拥有所有权限（*）', () => {
    const r = new RbacService();
    expect(r.can('admin', 'anything')).toBe(true);
    expect(r.canAccess('admin', 'article', 'create')).toBe(true);
  });

  it('author 拥有 article:create 等权限', () => {
    const r = new RbacService();
    expect(r.can('author', 'article:create')).toBe(true);
    expect(r.can('author', 'article:like')).toBe(false);
  });

  it('reader 仅可评论与点赞', () => {
    const r = new RbacService();
    expect(r.can('reader', 'comment:create')).toBe(true);
    expect(r.can('reader', 'article:like')).toBe(true);
    expect(r.can('reader', 'article:create')).toBe(false);
  });

  it('getPermissions 返回对应角色权限数组', () => {
    const r = new RbacService();
    expect(r.getPermissions('reader').length).toBeGreaterThan(0);
    expect(r.getPermissions('admin')).toContain('*');
  });
});
