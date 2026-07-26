/**
 * 令牌桶限流中间件（DD-COMMON-004 RateLimitMiddleware / DD-COMMON-005 TokenBucket / NFR-006）。
 * 与 L4_rate_limiter_token_bucket.tla 一致：CapacityInvariant / NonNegativeTokens 不变式。
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { RateLimitError } from './errors.js';
import type { TokenBucketState } from '../types.js';

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  public readonly capacity: number;
  public readonly refillRate: number;

  constructor(capacity: number, refillRate: number, now: number = Date.now()) {
    if (capacity <= 0) throw new Error('capacity 必须为正数');
    if (refillRate <= 0) throw new Error('refillRate 必须为正数');
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefill = now;
  }

  refill(now: number = Date.now()): void {
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;
    const refillAmount = (elapsed / 1000) * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + refillAmount);
    this.lastRefill = now;
  }

  consume(count: number = 1, now: number = Date.now()): boolean {
    this.refill(now);
    if (this.tokens < count) {
      return false;
    }
    this.tokens -= count;
    return true;
  }

  getTokens(now: number = Date.now()): number {
    this.refill(now);
    return this.tokens;
  }

  getState(): TokenBucketState {
    return {
      tokens: this.tokens,
      lastRefill: this.lastRefill,
      capacity: this.capacity,
      refillRate: this.refillRate,
    };
  }

  assertInvariants(): void {
    if (this.tokens < 0) {
      throw new Error('TokenBucket 不变式违反 NonNegativeTokens: tokens < 0');
    }
    if (this.tokens > this.capacity) {
      throw new Error('TokenBucket 不变式违反 CapacityInvariant: tokens > capacity');
    }
  }
}

export class RateLimitMiddleware {
  private buckets: Map<string, TokenBucket> = new Map();
  private readonly capacity: number;
  private readonly refillRate: number;

  /**
   * @param capacity 桶容量（突发上限），默认 60
   * @param refillRate 每秒补充令牌数，默认 1（即 60 次/分钟，对齐 NFR-006 / DD-COMMON-004 / L4 TLA+ 规范）
   *
   * 注意：refillRate 单位为「令牌/秒」，非「令牌/分钟」。
   * 设计文档 DD-COMMON-004 规定 refillRatePerSec = 1（60/min）。
   */
  constructor(capacity: number = 60, refillRate: number = 1) {
    this.capacity = capacity;
    this.refillRate = refillRate;
  }

  getBucket(key: string): TokenBucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket(this.capacity, this.refillRate);
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  check(key: string): boolean {
    const bucket = this.getBucket(key);
    const allowed = bucket.consume(1);
    bucket.assertInvariants();
    return allowed;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  clear(): void {
    this.buckets.clear();
  }

  middleware(): RequestHandler {
    return (req: Request, _res: Response, next: NextFunction): void => {
      const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
      if (!this.check(ip)) {
        next(new RateLimitError('API 限流：每分钟 60 次，请稍后重试'));
        return;
      }
      next();
    };
  }
}
