/**
 * AuthMiddleware 单元测试（UT-045~047）。
 * 缺失/非 Bearer 抛 40103；无效/过期抛 40102；合法则设置 req.user + next。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { JwtService } from '../../../src/utils/jwt';
import { authMiddleware } from '../../../src/middleware/auth';
import { UnauthorizedError, ErrorCode } from '../../../src/utils/errors';

type MockNext = ReturnType<typeof vi.fn>;

function makeReqResNext(authHeader?: string) {
  const req = {
    headers: authHeader === undefined ? {} : { authorization: authHeader },
  } as unknown as Request;
  const res = {} as Response;
  const next: MockNext = vi.fn();
  return { req, res, next };
}

describe('AuthMiddleware', () => {
  let jwtService: JwtService;
  beforeEach(() => {
    jwtService = new JwtService();
  });

  it('UT-045 缺失/非 Bearer 抛 40103', () => {
    const mw = authMiddleware(jwtService);
    // 无 Authorization 头
    const ctx1 = makeReqResNext();
    mw(ctx1.req, ctx1.res, ctx1.next as unknown as NextFunction);
    expect(ctx1.next).toHaveBeenCalled();
    const err1 = ctx1.next.mock.calls[0][0] as UnauthorizedError;
    expect(err1).toBeInstanceOf(UnauthorizedError);
    expect(err1.code).toBe(ErrorCode.UNAUTHORIZED_MISSING_TOKEN);

    // 非 Bearer 前缀
    const ctx2 = makeReqResNext('Basic xxx');
    mw(ctx2.req, ctx2.res, ctx2.next as unknown as NextFunction);
    const err2 = ctx2.next.mock.calls[0][0] as UnauthorizedError;
    expect(err2.code).toBe(ErrorCode.UNAUTHORIZED_MISSING_TOKEN);
  });

  it('UT-046 合法 token 设置 req.user + next', () => {
    const token = jwtService.sign({ userId: 'u1', username: 'alice' });
    const mw = authMiddleware(jwtService);
    const { req, res, next } = makeReqResNext(`Bearer ${token}`);
    mw(req, res, next as unknown as NextFunction);
    expect(req.user?.userId).toBe('u1');
    expect(req.user?.username).toBe('alice');
    expect(next).toHaveBeenCalledWith();
  });

  it('UT-047 无效 token 抛 40102', () => {
    const mw = authMiddleware(jwtService);
    const { req, res, next } = makeReqResNext('Bearer fake.token.here');
    mw(req, res, next as unknown as NextFunction);
    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0] as UnauthorizedError;
    expect(err).toBeInstanceOf(UnauthorizedError);
    expect(err.code).toBe(ErrorCode.UNAUTHORIZED_TOKEN);
  });
});
