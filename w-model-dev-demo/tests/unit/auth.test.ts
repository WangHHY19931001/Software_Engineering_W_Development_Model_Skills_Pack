import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authMiddleware } from '../../src/middleware/auth.js';
import { signToken } from '../../src/utils/jwt.js';
import { UnauthorizedError } from '../../src/utils/errors.js';
import type { Request, Response, NextFunction } from 'express';

function makeReq(headers: Record<string, string | undefined> = {}): Request {
  return { headers } as unknown as Request;
}
function makeRes(): Response {
  return {} as Response;
}
function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

describe('auth middleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-blog-demo';
  });

  it('无 Authorization 头 → next(UnauthorizedError(40103))', () => {
    const req = makeReq({});
    const next = makeNext();
    authMiddleware(req, makeRes(), next);
    const calls = (next as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toBeInstanceOf(UnauthorizedError);
    expect((calls[0][0] as UnauthorizedError).code).toBe(40103);
  });

  it('Authorization 非 Bearer 前缀 → next(UnauthorizedError(40103))', () => {
    const req = makeReq({ authorization: 'Basic abc' });
    const next = makeNext();
    authMiddleware(req, makeRes(), next);
    const calls = (next as ReturnType<typeof vi.fn>).mock.calls;
    expect((calls[0][0] as UnauthorizedError).code).toBe(40103);
  });

  it('合法 Bearer token → req.user 被填充 + next() 无参数', () => {
    const token = signToken({ userId: 'u1', username: 'alice' });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const next = makeNext();
    authMiddleware(req, makeRes(), next);
    const calls = (next as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toBeUndefined();
    expect(req.user).toEqual({ userId: 'u1', username: 'alice' });
  });

  it('伪造 Bearer token → next(UnauthorizedError(40102))', () => {
    const req = makeReq({ authorization: 'Bearer fake.token.value' });
    const next = makeNext();
    authMiddleware(req, makeRes(), next);
    const calls = (next as ReturnType<typeof vi.fn>).mock.calls;
    expect((calls[0][0] as UnauthorizedError).code).toBe(40102);
  });
});
