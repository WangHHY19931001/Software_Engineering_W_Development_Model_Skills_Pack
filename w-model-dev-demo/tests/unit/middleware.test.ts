// 中间件层单元测试：UT-019~022, UT-027
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthMiddleware } from '../../src/middleware/auth.middleware';
import { validate } from '../../src/middleware/validate.middleware';
import { handleError } from '../../src/middleware/error.middleware';
import { AppError } from '../../src/utils/errors';
import { z } from 'zod';

function createMockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

function createMockNext() {
  return vi.fn() as unknown as NextFunction;
}

// ============ UT-019 / UT-020: AuthMiddleware ============
describe('UT-019: AuthMiddleware.authenticate JWT 校验正向', () => {
  it('合法 Bearer token，verify 通过，注入 req.user 后调用 next()', () => {
    const mockJwtUtil = {
      verify: vi.fn().mockReturnValue({ userId: 'u-1', role: 'user' }),
      sign: vi.fn(),
    };
    const authMiddleware = new AuthMiddleware(mockJwtUtil as never);
    const req = {
      headers: { authorization: 'Bearer jwt-xxx' },
    } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    authMiddleware.authenticate(req, res, next);
    expect(req.user).toEqual({ userId: 'u-1', role: 'user' });
    expect(next).toHaveBeenCalledWith();
    expect(mockJwtUtil.verify).toHaveBeenCalledWith('jwt-xxx');
  });

  it('无 Authorization 头，next 被调用并传入 40101 错误', () => {
    const mockJwtUtil = { verify: vi.fn(), sign: vi.fn() };
    const authMiddleware = new AuthMiddleware(mockJwtUtil as never);
    const req = { headers: {} } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    authMiddleware.authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 40101 }));
    expect(mockJwtUtil.verify).not.toHaveBeenCalled();
  });

  it('token 无效，next 被调用并传入 40101 错误', () => {
    const mockJwtUtil = {
      verify: vi.fn().mockImplementation(() => {
        throw new Error('invalid token');
      }),
      sign: vi.fn(),
    };
    const authMiddleware = new AuthMiddleware(mockJwtUtil as never);
    const req = {
      headers: { authorization: 'Bearer invalid-token' },
    } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    authMiddleware.authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 40101 }));
  });
});

describe('UT-020: AuthMiddleware.requireAdmin 非 admin 返回 403', () => {
  it('req.user.role=user 时返回 403', () => {
    const mockJwtUtil = { verify: vi.fn(), sign: vi.fn() };
    const authMiddleware = new AuthMiddleware(mockJwtUtil as never);
    const req = { user: { userId: 'u-1', role: 'user' } } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    authMiddleware.requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 40301 }));
    expect(next).not.toHaveBeenCalledWith();
  });

  it('req.user.role=admin 时通过', () => {
    const mockJwtUtil = { verify: vi.fn(), sign: vi.fn() };
    const authMiddleware = new AuthMiddleware(mockJwtUtil as never);
    const req = { user: { userId: 'u-admin', role: 'admin' } } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    authMiddleware.requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('req.user 缺失时返回 403', () => {
    const mockJwtUtil = { verify: vi.fn(), sign: vi.fn() };
    const authMiddleware = new AuthMiddleware(mockJwtUtil as never);
    const req = {} as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    authMiddleware.requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ============ UT-021 / UT-027: ValidateMiddleware ============
describe('UT-021: ValidateMiddleware.validate zod 校验异常返回 400', () => {
  it('非法输入触发 zod 抛错，返回 400 + 40001', () => {
    const schema = z.object({ username: z.string().min(3) });
    const req = { body: { username: 'ab' } } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 40001 }));
  });

  it('合法输入通过校验，next 被无参调用', () => {
    const schema = z.object({ username: z.string().min(3) });
    const req = { body: { username: 'alice' } } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();

    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('UT-027: zod schema 标题长度越界（200 ±1）', () => {
  const schema = z.object({ title: z.string().min(1).max(200) });

  it('len=200 MAX 合法', () => {
    const req = { body: { title: 'x'.repeat(200) } } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('len=201 越界+1 返回 400', () => {
    const req = { body: { title: 'x'.repeat(201) } } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 40001 }));
  });

  it('len=1 MIN 合法', () => {
    const req = { body: { title: 'x' } } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('len=0 越界-1 返回 400', () => {
    const req = { body: { title: '' } } as unknown as Request;
    const res = createMockRes();
    const next = createMockNext();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 40001 }));
  });
});

// ============ UT-022: ErrorMiddleware ============
describe('UT-022: ErrorMiddleware.handleError 错误码映射 4xx/5xx/业务', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('40001 → 400', () => {
    const req = {} as Request;
    const res = createMockRes();
    const next = createMockNext();
    handleError(new AppError(40001, 'x'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('40101 → 401', () => {
    const req = {} as Request;
    const res = createMockRes();
    const next = createMockNext();
    handleError(new AppError(40101, 'x'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('40301 → 403', () => {
    const req = {} as Request;
    const res = createMockRes();
    const next = createMockNext();
    handleError(new AppError(40301, 'x'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('40401 → 404', () => {
    const req = {} as Request;
    const res = createMockRes();
    const next = createMockNext();
    handleError(new AppError(40401, 'x'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('60001 → 409', () => {
    const req = {} as Request;
    const res = createMockRes();
    const next = createMockNext();
    handleError(new AppError(60001, 'x'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('60002 → 409', () => {
    const req = {} as Request;
    const res = createMockRes();
    const next = createMockNext();
    handleError(new AppError(60002, 'x'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('50001 → 500', () => {
    const req = {} as Request;
    const res = createMockRes();
    const next = createMockNext();
    handleError(new AppError(50001, 'x'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('普通 Error（无 code）→ 500', () => {
    const req = {} as Request;
    const res = createMockRes();
    const next = createMockNext();
    handleError(new Error('unknown'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
