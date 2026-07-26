import { describe, it, expect } from 'vitest';
import { TokenBucket, RateLimitMiddleware } from '../../../src/utils/rate-limit.js';
import { RateLimitError } from '../../../src/utils/errors.js';

describe('TokenBucket (DD-COMMON-005 / L4_rate_limiter_token_bucket)', () => {
  it('TC-UNIT-071N: 初始满桶 consume 返回 true', () => {
    const b = new TokenBucket(10, 10, 1000);
    expect(b.consume(1, 1000)).toBe(true);
    b.assertInvariants();
  });

  it('TC-UNIT-071E: 容量耗尽返回 false', () => {
    const b = new TokenBucket(2, 1, 1000);
    expect(b.consume(1, 1000)).toBe(true);
    expect(b.consume(1, 1000)).toBe(true);
    expect(b.consume(1, 1000)).toBe(false);
  });

  it('TC-UNIT-071B: 时间推进后令牌按 refillRate 补充（不超过 capacity）', () => {
    const b = new TokenBucket(5, 5, 1000);
    expect(b.consume(5, 1000)).toBe(true);
    expect(b.consume(1, 1000)).toBe(false);
    // 1 秒后补 5 个令牌（受 capacity 限制）
    expect(b.getTokens(2000)).toBe(5);
    b.assertInvariants();
  });

  it('assertInvariants: tokens 不超过 capacity（CapacityInvariant）', () => {
    const b = new TokenBucket(3, 1, 1000);
    b.consume(2, 1000);
    b.assertInvariants();
    expect(b.getState().tokens).toBeLessThanOrEqual(b.capacity);
  });

  it('构造参数非正抛错', () => {
    expect(() => new TokenBucket(0, 1)).toThrow();
    expect(() => new TokenBucket(1, 0)).toThrow();
  });
});

describe('RateLimitMiddleware (DD-COMMON-004 / NFR-006)', () => {
  it('TC-UNIT-072N: 单 IP 默认 60/分钟限流放行', () => {
    const m = new RateLimitMiddleware(60, 60);
    for (let i = 0; i < 60; i++) {
      expect(m.check('1.2.3.4')).toBe(true);
    }
    expect(m.check('1.2.3.4')).toBe(false);
  });

  it('TC-UNIT-072E: 超限触发 RateLimitError via middleware', () => {
    const m = new RateLimitMiddleware(1, 1);
    // 先用同一 IP 耗尽令牌
    expect(m.check('9.9.9.9')).toBe(true);
    const next = (err: unknown): void => {
      expect(err).toBeInstanceOf(RateLimitError);
    };
    const req = { ip: '9.9.9.9' } as never;
    m.middleware()(req, {} as never, next as never);
  });

  it('TC-UNIT-072B: 不同 IP 独立计数', () => {
    const m = new RateLimitMiddleware(1, 1);
    expect(m.check('a')).toBe(true);
    expect(m.check('b')).toBe(true);
    expect(m.check('a')).toBe(false);
  });

  it('reset/clear 清除桶', () => {
    const m = new RateLimitMiddleware(1, 1);
    m.check('a');
    m.reset('a');
    expect(m.check('a')).toBe(true);
    m.check('b');
    m.clear();
    expect(m.check('b')).toBe(true);
  });
});
