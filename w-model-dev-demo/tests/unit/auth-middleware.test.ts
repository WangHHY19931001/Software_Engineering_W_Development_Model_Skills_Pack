import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../../src/middleware/auth.js';
import { userService } from '../../src/services/user-service.js';
import { userStore } from '../../src/stores/user-store.js';
import { UnauthorizedError } from '../../src/utils/errors.js';

const JWT_SECRET = process.env.JWT_SECRET!;

function mockReq(opts: { authorization?: string }): Request {
  return { headers: opts.authorization ? { authorization: opts.authorization } : {} } as unknown as Request;
}

function mockRes(): Response {
  return {} as Response;
}

describe('authMiddleware', () => {
  beforeEach(() => {
    userStore.clear();
  });

  it('UT-017: 合法 Bearer 通过并注入 userId', async () => {
    const { userId } = await userService.register({ username: 'alice', password: 'Passw0rd!' });
    const { token } = await userService.login({ username: 'alice', password: 'Passw0rd!' });
    const req = mockReq({ authorization: `Bearer ${token}` });
    const next = vi.fn() as unknown as NextFunction;
    authMiddleware(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(req.userId).toBe(userId);
  });

  it('UT-018: 无 Authorization 头抛 UnauthorizedError', () => {
    const req = mockReq({});
    const next = vi.fn() as unknown as NextFunction;
    authMiddleware(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(UnauthorizedError);
    expect((err as UnauthorizedError).status).toBe(401);
  });

  it('UT-019: 过期 token 抛 UnauthorizedError', () => {
    const expiredToken = jwt.sign({ userId: 'u1' }, JWT_SECRET, { expiresIn: -1 });
    const req = mockReq({ authorization: `Bearer ${expiredToken}` });
    const next = vi.fn() as unknown as NextFunction;
    authMiddleware(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(UnauthorizedError);
  });
});
