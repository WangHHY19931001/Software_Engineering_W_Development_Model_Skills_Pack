/**
 * 限流中间件测试
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { rateLimitMiddleware, resetRateLimitStore, getRateLimitSnapshot } from '../../src/middleware/rate-limit.middleware.js';
import { resetEnv } from '../../src/utils/env.js';
import type { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode, RateLimitError } from '../../src/utils/errors.js';

function mockReq(headers: Record<string, string> = {}, ip: string = '127.0.0.1'): Request {
  return {
    headers,
    ip,
    socket: { remoteAddress: ip } as never,
  } as unknown as Request;
}

function mockRes(): Response {
  return {} as Response;
}

describe('rateLimitMiddleware', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    process.env.RATE_LIMIT_MAX = '100';
    resetEnv();
  });

  afterAll(() => {
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    resetEnv();
  });

  beforeEach(() => {
    resetRateLimitStore();
  });

  it('should allow first request', () => {
    const mw = rateLimitMiddleware();
    const next = vi.fn() as NextFunction;
    mw(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('should track per-IP buckets', () => {
    const mw = rateLimitMiddleware();
    const next = vi.fn() as NextFunction;
    mw(mockReq({}, '1.1.1.1'), mockRes(), next);
    mw(mockReq({}, '2.2.2.2'), mockRes(), next);
    const snap = getRateLimitSnapshot();
    expect(snap.get('1.1.1.1')).toBe(1);
    expect(snap.get('2.2.2.2')).toBe(1);
  });

  it('should use x-forwarded-for when present', () => {
    const mw = rateLimitMiddleware();
    const next = vi.fn() as NextFunction;
    mw(mockReq({ 'x-forwarded-for': '3.3.3.3' }, '1.1.1.1'), mockRes(), next);
    const snap = getRateLimitSnapshot();
    expect(snap.get('3.3.3.3')).toBe(1);
  });

  it('should use first IP from x-forwarded-for list', () => {
    const mw = rateLimitMiddleware();
    const next = vi.fn() as NextFunction;
    mw(mockReq({ 'x-forwarded-for': '4.4.4.4, 5.5.5.5' }, '1.1.1.1'), mockRes(), next);
    const snap = getRateLimitSnapshot();
    expect(snap.get('4.4.4.4')).toBe(1);
  });

  it('should fall back to socket.remoteAddress when no ip', () => {
    const mw = rateLimitMiddleware();
    const next = vi.fn() as NextFunction;
    const req = { headers: {}, socket: { remoteAddress: '6.6.6.6' } } as unknown as Request;
    mw(req, mockRes(), next);
    const snap = getRateLimitSnapshot();
    expect(snap.get('6.6.6.6')).toBe(1);
  });

  it('should fall back to "unknown" when nothing', () => {
    const mw = rateLimitMiddleware();
    const next = vi.fn() as NextFunction;
    const req = { headers: {} } as unknown as Request;
    mw(req, mockRes(), next);
    const snap = getRateLimitSnapshot();
    expect(snap.get('unknown')).toBe(1);
  });

  it('should bypass on x-test-bypass-rate-limit: true', () => {
    const mw = rateLimitMiddleware();
    const next = vi.fn() as NextFunction;
    for (let i = 0; i < 200; i += 1) {
      mw(mockReq({ 'x-test-bypass-rate-limit': 'true' }, '1.1.1.1'), mockRes(), next);
    }
    expect(next).toHaveBeenCalledTimes(200);
  });

  it('should bypass case-insensitive', () => {
    const mw = rateLimitMiddleware();
    const next = vi.fn() as NextFunction;
    mw(mockReq({ 'x-test-bypass-rate-limit': 'TRUE' }, '1.1.1.1'), mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('should reject when over limit', () => {
    const mw = rateLimitMiddleware();
    const next = vi.fn() as NextFunction;
    for (let i = 0; i < 100; i += 1) {
      mw(mockReq({}, '1.1.1.1'), mockRes(), next);
    }
    mw(mockReq({}, '1.1.1.1'), mockRes(), next);
    expect(next).toHaveBeenCalledTimes(101);
    const lastCall = (next as ReturnType<typeof vi.fn>).mock.calls[100]!;
    expect(lastCall[0]).toBeInstanceOf(RateLimitError);
  });

  it('should throw RateLimitError with proper code', () => {
    const mw = rateLimitMiddleware();
    for (let i = 0; i < 100; i += 1) {
      mw(mockReq({}, '1.1.1.1'), mockRes(), vi.fn() as NextFunction);
    }
    const next = vi.fn() as NextFunction;
    mw(mockReq({}, '1.1.1.1'), mockRes(), next);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect((err as AppError).code).toBe(ErrorCode.RATE_LIMITED);
  });

  it('should not affect other IPs when one is over limit', () => {
    const mw = rateLimitMiddleware();
    for (let i = 0; i < 100; i += 1) {
      mw(mockReq({}, '1.1.1.1'), mockRes(), vi.fn() as NextFunction);
    }
    const next = vi.fn() as NextFunction;
    mw(mockReq({}, '2.2.2.2'), mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('resetRateLimitStore clears', () => {
    const mw = rateLimitMiddleware();
    mw(mockReq({}, '1.1.1.1'), mockRes(), vi.fn() as NextFunction);
    resetRateLimitStore();
    const snap = getRateLimitSnapshot();
    expect(snap.size).toBe(0);
  });

  it('should clean old timestamps out of window', async () => {
    process.env.RATE_LIMIT_WINDOW_MS = '100';
    resetEnv();
    const mw = rateLimitMiddleware();
    for (let i = 0; i < 5; i += 1) {
      mw(mockReq({}, '1.1.1.1'), mockRes(), vi.fn() as NextFunction);
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 150);
    });
    const next = vi.fn() as NextFunction;
    mw(mockReq({}, '1.1.1.1'), mockRes(), next);
    expect(next).toHaveBeenCalledWith();
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    resetEnv();
  });
});
