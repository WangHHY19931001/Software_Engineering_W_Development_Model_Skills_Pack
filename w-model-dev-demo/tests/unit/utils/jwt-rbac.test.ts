/**
 * UT-DD-001 ~ UT-DD-002 —— JwtUtil + RbacMiddleware 单元测试
 * 13 个测试用例：UT-DD-001-001 ~ UT-DD-002-010
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { jwtUtil, sign, verify, ACCESS_EXPIRES } from '../../../src/utils/jwt.js';
import { AppError, mapHttpStatus } from '../../../src/utils/errors.js';
import { RbacMiddleware, checkMatrix, checkPermission, assignRole, revokeRole } from '../../../src/middleware/rbac.js';
import type { Request, Response, NextFunction } from 'express';

describe('DD-001 JwtUtil', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-blog-demo';
  });

  it('UT-DD-001-001: sign 签发 access token', () => {
    const token = jwtUtil.sign({ userId: 'u1', role: 'user' }, ACCESS_EXPIRES);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  it('UT-DD-001-002: verify 校验合法 token', () => {
    const token = jwtUtil.sign({ userId: 'u1' }, ACCESS_EXPIRES);
    const payload = jwtUtil.verify(token);
    expect(payload.userId).toBe('u1');
  });

  it('UT-DD-001-003: verify 过期 token 抛 40101', () => {
    // expiresIn=0 在 jwt 中表示立即过期；改用负数过期 + 微小延迟
    const token = jwtUtil.sign({ userId: 'u1' }, -1);
    expect(() => jwtUtil.verify(token)).toThrow(AppError);
    try {
      jwtUtil.verify(token);
    } catch (e) {
      expect((e as AppError).code).toBe(40101);
    }
  });

  it('UT-DD-001-004: verify 签名无效抛 40101 或 40102', () => {
    expect(() => jwtUtil.verify('invalid.token.here')).toThrow(AppError);
    try {
      jwtUtil.verify('invalid.token.here');
    } catch (e) {
      expect([40101, 40102]).toContain((e as AppError).code);
    }
  });

  it('UT-DD-001-005: refresh 用 refresh token 换 access token', () => {
    const refreshToken = jwtUtil.sign({ userId: 'u1', type: 'refresh' }, 604800);
    const { accessToken } = jwtUtil.refresh(refreshToken);
    expect(typeof accessToken).toBe('string');
    expect(jwtUtil.verify(accessToken).userId).toBe('u1');
  });

  it('UT-DD-001-006: sign 在 secret 缺失时抛 50001', () => {
    const oldSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => jwtUtil.sign({ userId: 'u1' }, ACCESS_EXPIRES)).toThrow(AppError);
    try {
      jwtUtil.sign({ userId: 'u1' }, ACCESS_EXPIRES);
    } catch (e) {
      expect((e as AppError).code).toBe(50001);
    }
    process.env.JWT_SECRET = oldSecret;
  });
});

describe('DD-002 RbacMiddleware', () => {
  it('UT-DD-002-007: requireRole 角色匹配通过', () => {
    const req = { user: { role: 'admin', userId: 'a1' } } as unknown as Request;
    const next = vi.fn() as unknown as NextFunction;
    RbacMiddleware.requireRole(['admin', 'super_admin'])(req, {} as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('UT-DD-002-008: requireRole 权限不足抛 40301', () => {
    const req = { user: { role: 'user', userId: 'u1' } } as unknown as Request;
    expect(() =>
      RbacMiddleware.requireRole(['admin'])(req, {} as Response, vi.fn() as unknown as NextFunction),
    ).toThrow(AppError);
    try {
      RbacMiddleware.requireRole(['admin'])(req, {} as Response, vi.fn() as unknown as NextFunction);
    } catch (e) {
      expect((e as AppError).code).toBe(40301);
    }
  });

  it('UT-DD-002-009: requireRole 未登录抛 40101', () => {
    const req = {} as Request;
    expect(() =>
      RbacMiddleware.requireRole(['admin'])(req, {} as Response, vi.fn() as unknown as NextFunction),
    ).toThrow(AppError);
    try {
      RbacMiddleware.requireRole(['admin'])(req, {} as Response, vi.fn() as unknown as NextFunction);
    } catch (e) {
      expect((e as AppError).code).toBe(40101);
    }
  });

  it('UT-DD-002-010: requireOwnership 所有权失败抛 40302', async () => {
    const req = {
      user: { id: 'u1', userId: 'u1', role: 'user' },
      params: { id: 'u2' },
    } as unknown as Request;
    const ownerFn = async (_r: Request) => 'u2';
    await expect(
      RbacMiddleware.requireOwnership(
        (r: Request) => r.params.id,
        ownerFn,
      )(req, {} as Response, vi.fn() as unknown as NextFunction),
    ).rejects.toThrow(AppError);
    try {
      await RbacMiddleware.requireOwnership(
        (r: Request) => r.params.id,
        ownerFn,
      )(req, {} as Response, vi.fn() as unknown as NextFunction);
    } catch (e) {
      expect((e as AppError).code).toBe(40302);
    }
  });

  it('checkMatrix super_admin 绕过返回 true', () => {
    expect(checkMatrix('super_admin', 'article.create')).toBe(true);
    expect(checkMatrix('super_admin', 'sensitive.manage')).toBe(true);
  });

  it('checkMatrix 角色有权限返回 true，无权限返回 false', () => {
    expect(checkMatrix('blogger', 'article.create')).toBe(true);
    expect(checkMatrix('user', 'article.create')).toBe(false);
  });

  it('assignRole + checkPermission 角色分配后校验通过', () => {
    assignRole('test-user-1', 'admin');
    expect(checkPermission('test-user-1', 'article.publish')).toBe(true);
    expect(checkPermission('test-user-1', 'tag.create')).toBe(true);
  });

  it('checkPermission 未分配角色返回 false', () => {
    expect(checkPermission('unassigned-user', 'article.create')).toBe(false);
  });

  it('revokeRole 撤销角色后 checkPermission 返回 false', () => {
    assignRole('test-user-2', 'admin');
    revokeRole('test-user-2');
    expect(checkPermission('test-user-2', 'article.publish')).toBe(false);
  });

  it('requireOwnership admin 绕过所有权校验', async () => {
    const req = {
      user: { id: 'admin1', userId: 'admin1', role: 'admin' },
      params: { id: 'r1' },
    } as unknown as Request;
    const next = vi.fn() as unknown as NextFunction;
    await RbacMiddleware.requireOwnership(
      (r: Request) => r.params.id,
      async () => 'someone-else',
    )(req, {} as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('requireOwnership 未登录抛 40101', async () => {
    const req = { params: { id: 'r1' } } as unknown as Request;
    await expect(
      RbacMiddleware.requireOwnership(
        (r: Request) => r.params.id,
        async () => 'owner',
      )(req, {} as Response, vi.fn() as unknown as NextFunction),
    ).rejects.toThrow(AppError);
  });

  it('requireOwnership 所有者通过', async () => {
    const req = {
      user: { id: 'u1', userId: 'u1', role: 'user' },
      params: { id: 'r1' },
    } as unknown as Request;
    const next = vi.fn() as unknown as NextFunction;
    await RbacMiddleware.requireOwnership(
      (r: Request) => r.params.id,
      async () => 'u1',
    )(req, {} as Response, next);
    expect(next).toHaveBeenCalled();
  });
});

// 错误码映射补充测试（覆盖率提升）
describe('mapHttpStatus 错误码映射', () => {
  it('业务错误 60002 → 409', () => {
    expect(mapHttpStatus(60002)).toBe(409);
  });

  it('业务错误 60001 → 400', () => {
    expect(mapHttpStatus(60001)).toBe(400);
  });

  it('5xx 错误 50001 → 500', () => {
    expect(mapHttpStatus(50001)).toBe(500);
  });

  it('503xx 错误 → 503', () => {
    expect(mapHttpStatus(50301)).toBe(503);
  });

  it('502xx 错误 → 502', () => {
    expect(mapHttpStatus(50201)).toBe(502);
  });

  it('429xx 错误 → 429', () => {
    expect(mapHttpStatus(42901)).toBe(429);
  });

  it('409xx 错误 → 409', () => {
    expect(mapHttpStatus(40901)).toBe(409);
  });

  it('404xx 错误 → 404', () => {
    expect(mapHttpStatus(40401)).toBe(404);
  });

  it('403xx 错误 → 403', () => {
    expect(mapHttpStatus(40301)).toBe(403);
  });

  it('401xx 错误 → 401', () => {
    expect(mapHttpStatus(40101)).toBe(401);
  });

  it('400xx 错误 → 400', () => {
    expect(mapHttpStatus(40001)).toBe(400);
  });

  it('未知错误码 → 500', () => {
    expect(mapHttpStatus(999)).toBe(500);
  });
});
