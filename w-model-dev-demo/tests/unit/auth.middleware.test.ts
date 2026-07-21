import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { JwtUtils } from '../../src/utils/jwt.js';
import { AuthMiddleware } from '../../src/middleware/auth.js';
import { AuthError } from '../../src/utils/errors.js';

/**
 * UT-026：AuthMiddleware 单元测试。
 * 设计来源：docs/detailed-design.md §4.1
 */
describe('AuthMiddleware', () => {
  const secret = process.env.JWT_SECRET ?? 'test-secret-blog-demo';
  let jwtUtils: JwtUtils;
  let authMiddleware: AuthMiddleware;

  beforeEach(() => {
    jwtUtils = new JwtUtils(secret, 3600);
    authMiddleware = new AuthMiddleware(jwtUtils);
  });

  function buildReq(headers: Record<string, string> = {}): Request {
    return { headers } as unknown as Request;
  }
  function buildRes(): Response {
    return {} as unknown as Response;
  }
  function buildNext(): Mock & NextFunction {
    return vi.fn() as unknown as Mock & NextFunction;
  }

  // UT-026 case 1: 有效 Bearer token → req.user 注入
  it('UT-026-1: 有效 Bearer token 注入 req.user 并 next()', () => {
    const token = jwtUtils.sign({ userId: 'u-1', username: 'alice' });
    const req = buildReq({ authorization: `Bearer ${token}` });
    const next = buildNext();

    authMiddleware.verify(req, buildRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeDefined();
    expect(req.user!.userId).toBe('u-1');
    expect(req.user!.username).toBe('alice');
  });

  // UT-026 case 2: 无 Authorization 头 → 40103
  it('UT-026-2: 无 Authorization 头 next(AuthError 40103)', () => {
    const req = buildReq({});
    const next = buildNext();

    authMiddleware.verify(req, buildRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthError));
    const err = next.mock.calls[0][0] as AuthError;
    expect(err.code).toBe(40103);
  });

  // UT-026 case 3: Bearer invalid → 40102
  it('UT-026-3: Bearer 无效 token next(AuthError 40102)', () => {
    const req = buildReq({ authorization: 'Bearer invalid.token.here' });
    const next = buildNext();

    authMiddleware.verify(req, buildRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthError));
    const err = next.mock.calls[0][0] as AuthError;
    expect(err.code).toBe(40102);
  });

  it('UT-026-extra: Authorization 非 Bearer 前缀 → 40103', () => {
    const req = buildReq({ authorization: 'Basic abc123' });
    const next = buildNext();

    authMiddleware.verify(req, buildRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthError));
    const err = next.mock.calls[0][0] as AuthError;
    expect(err.code).toBe(40103);
  });
});
