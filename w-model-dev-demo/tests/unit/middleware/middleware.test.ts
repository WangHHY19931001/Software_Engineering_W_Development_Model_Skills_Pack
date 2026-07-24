/**
 * UT-DD-027 ~ UT-DD-029 —— 中间件层单元测试
 * ErrorHandler (1) + ValidateMiddleware (1) + RateLimiter (1) = 3 用例
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorHandler } from '../../../src/middleware/error-handler.js';
import { ValidateMiddleware, sanitize } from '../../../src/utils/validate.js';
import { RateLimiterImpl } from '../../../src/middleware/rate-limiter.js';
import { authenticate, requireAuth, extractToken } from '../../../src/middleware/auth.js';
import { sign } from '../../../src/utils/jwt.js';
import { AppError } from '../../../src/utils/errors.js';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

describe('DD-027 ErrorHandler', () => {
  it('UT-DD-027-086: handle 错误码映射 HTTP Status', () => {
    const err = new AppError(40101, '未授权');
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    ErrorHandler.handle(err, {} as Request, res, vi.fn() as unknown as NextFunction);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 40101 }));
  });
});

describe('DD-028 ValidateMiddleware', () => {
  it('UT-DD-028-087: validate 拒绝 __proto__ 键（原型链污染防护）', () => {
    const schema = z.object({ name: z.string() });
    // 构造含 __proto__ 的请求体
    const rawBody: Record<string, unknown> = { name: 'a' };
    // 通过 Object.defineProperty 设置 __proto__ 以模拟攻击
    const req = {
      body: { name: 'a', __proto__: { polluted: true } },
    } as unknown as Request;
    const next = vi.fn() as unknown as NextFunction;
    // validate 会 sanitize 移除 __proto__
    expect(() => {
      ValidateMiddleware.validate(schema, 'body')(req, {} as Response, next);
    }).not.toThrow();
    // 原型链未被污染
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('DD-029 RateLimiter', () => {
  it('UT-DD-029-088: rateLimit 超限抛 42901', () => {
    const limiter = new RateLimiterImpl();
    const middleware = limiter.rateLimit({ windowMs: 60000, max: 2 });
    const req = { ip: '1.1.1.1' } as Request;
    const res = {} as Response;
    // 前两次允许
    middleware(req, res, vi.fn() as unknown as NextFunction);
    middleware(req, res, vi.fn() as unknown as NextFunction);
    // 第三次抛 42901
    expect(() => middleware(req, res, vi.fn() as unknown as NextFunction)).toThrow(AppError);
    try {
      middleware(req, res, vi.fn() as unknown as NextFunction);
    } catch (e) {
      expect((e as AppError).code).toBe(42901);
    }
  });
});

// DD-001 认证中间件补充测试（覆盖率提升）
describe('DD-001 AuthMiddleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-blog-demo';
  });

  it('extractToken 从 Bearer header 提取 token', () => {
    const req = { headers: { authorization: 'Bearer abc123' } } as Request;
    expect(extractToken(req)).toBe('abc123');
  });

  it('extractToken 无 header 返回 null', () => {
    const req = { headers: {} } as Request;
    expect(extractToken(req)).toBeNull();
  });

  it('extractToken 非 Bearer scheme 返回 null', () => {
    const req = { headers: { authorization: 'Basic abc123' } } as Request;
    expect(extractToken(req)).toBeNull();
  });

  it('extractToken 格式错误返回 null', () => {
    const req = { headers: { authorization: 'Bearer' } } as Request;
    expect(extractToken(req)).toBeNull();
  });

  it('authenticate 有效 token 注入 req.user', () => {
    const token = sign({ userId: 'u1', role: 'user' });
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const next = vi.fn() as unknown as NextFunction;
    authenticate(req, {} as Response, next);
    expect(req.user).toBeDefined();
    expect(req.user!.userId).toBe('u1');
    expect(next).toHaveBeenCalled();
  });

  it('authenticate 无效 token 不注入 user 但调 next', () => {
    const req = { headers: { authorization: 'Bearer invalidtoken' } } as Request;
    const next = vi.fn() as unknown as NextFunction;
    authenticate(req, {} as Response, next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('authenticate 无 token 不注入 user 但调 next', () => {
    const req = { headers: {} } as Request;
    const next = vi.fn() as unknown as NextFunction;
    authenticate(req, {} as Response, next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('requireAuth 有 user 调 next', () => {
    const req = { user: { userId: 'u1', role: 'user' } } as Request;
    const next = vi.fn() as unknown as NextFunction;
    requireAuth(req, {} as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('requireAuth 无 user 抛 40101', () => {
    const req = {} as Request;
    expect(() => requireAuth(req, {} as Response, vi.fn() as unknown as NextFunction)).toThrow(AppError);
    try {
      requireAuth(req, {} as Response, vi.fn() as unknown as NextFunction);
    } catch (e) {
      expect((e as AppError).code).toBe(40101);
    }
  });
});

// DD-028 ValidateMiddleware sanitize 补充测试（覆盖率提升）
describe('DD-028 sanitize 补充', () => {
  it('sanitize null/undefined 原样返回', () => {
    expect(sanitize(null)).toBeNull();
    expect(sanitize(undefined)).toBeUndefined();
  });

  it('sanitize 基本类型原样返回', () => {
    expect(sanitize('hello')).toBe('hello');
    expect(sanitize(123)).toBe(123);
    expect(sanitize(true)).toBe(true);
  });

  it('sanitize 数组递归消毒', () => {
    const arr = [{ name: 'a' }, { __proto__: { bad: true }, name: 'b' }];
    const cleaned = sanitize(arr);
    expect(cleaned).toHaveLength(2);
    expect(cleaned[1].name).toBe('b');
  });

  it('sanitize 移除 constructor/prototype 键', () => {
    const input: Record<string, unknown> = {};
    Object.defineProperty(input, 'constructor', { value: { bad: true }, enumerable: true, configurable: true });
    Object.defineProperty(input, 'prototype', { value: { evil: true }, enumerable: true, configurable: true });
    input.name = 'ok';
    const cleaned = sanitize(input) as Record<string, unknown>;
    expect(cleaned.name).toBe('ok');
    expect(Object.keys(cleaned)).not.toContain('constructor');
    expect(Object.keys(cleaned)).not.toContain('prototype');
  });

  it('validate 校验失败抛 40003', () => {
    const schema = z.object({ name: z.string().min(5) });
    const req = { body: { name: 'ab' } } as unknown as Request;
    expect(() => {
      ValidateMiddleware.validate(schema, 'body')(req, {} as Response, vi.fn() as unknown as NextFunction);
    }).toThrow(AppError);
    try {
      ValidateMiddleware.validate(schema, 'body')(req, {} as Response, vi.fn() as unknown as NextFunction);
    } catch (e) {
      expect((e as AppError).code).toBe(40003);
    }
  });

  it('validate query 来源校验', () => {
    const schema = z.object({ q: z.string() });
    const req = { query: { q: 'test' } } as unknown as Request;
    const next = vi.fn() as unknown as NextFunction;
    ValidateMiddleware.validate(schema, 'query')(req, {} as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('validate params 来源校验', () => {
    const schema = z.object({ id: z.string() });
    const req = { params: { id: 'abc' } } as unknown as Request;
    const next = vi.fn() as unknown as NextFunction;
    ValidateMiddleware.validate(schema, 'params')(req, {} as Response, next);
    expect(next).toHaveBeenCalled();
  });
});
