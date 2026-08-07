/**
 * UT-042 认证接口限流 10 次/分（rateLimitMiddleware.rateLimit，DD-042/NFR-006）
 */
import { describe, it, expect } from 'vitest';
import { RateLimitMiddleware } from '../../../src/middlewares/rateLimitMiddleware';
import { makeReq, makeRes, makeNext } from '../helpers';

describe('UT-042 rateLimitMiddleware.rateLimit', () => {
  it('第 11 次请求 → 42901；窗口重置后放行', () => {
    let now = 1_000_000;
    const middleware = new RateLimitMiddleware();
    const limiter = middleware.rateLimit({ limit: 10, windowMs: 60000, now: () => now });
    const req = () => makeReq({ ip: '127.0.0.1', originalUrl: '/api/auth/login' });

    for (let i = 0; i < 10; i += 1) {
      const next = makeNext();
      limiter(req(), makeRes(), next);
      expect(next).toHaveBeenCalledWith();
    }

    const next11 = makeNext();
    limiter(req(), makeRes(), next11);
    expect(next11).toHaveBeenCalledWith(expect.objectContaining({ code: 42901, retryable: true }));

    now += 60000; // 窗口重置
    const nextReset = makeNext();
    limiter(req(), makeRes(), nextReset);
    expect(nextReset).toHaveBeenCalledWith();
  });
});
