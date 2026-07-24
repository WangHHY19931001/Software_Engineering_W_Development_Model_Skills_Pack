/**
 * DD-029 RateLimiter —— 内存令牌桶限流中间件
 *
 * 滑动窗口算法；超限抛 42901（NFR-001）。
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from '../utils/errors.js';

export interface RateLimitOpts {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
}

interface Bucket {
  count: number;
  windowStart: number;
}

export class RateLimiterImpl {
  private buckets: Map<string, Bucket> = new Map();

  /**
   * 消费令牌（对应 DD-029 consume，滑动窗口令牌桶）。
   * @param key 限流键（如 IP 或 userId）
   * @returns 是否允许
   */
  consume(key: string, opts: RateLimitOpts): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStart > opts.windowMs) {
      bucket = { count: 0, windowStart: now };
    }
    bucket.count++;
    this.buckets.set(key, bucket);
    return bucket.count <= opts.max;
  }

  /**
   * 限流中间件工厂（对应 DD-029 rateLimit）。
   * 超限抛 42901。
   */
  rateLimit(opts: RateLimitOpts): RequestHandler {
    const keyFn = opts.keyFn ?? ((req: Request) => (req.ip ?? req.socket?.remoteAddress ?? 'unknown'));
    return (req: Request, _res: Response, next: NextFunction): void => {
      const key = keyFn(req);
      if (!this.consume(key, opts)) {
        throw new AppError(42901, '请求频率超限', { key, max: opts.max, windowMs: opts.windowMs });
      }
      next();
    };
  }

  /** 重置某 key 的令牌桶 */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /** 清空所有令牌桶 */
  clear(): void {
    this.buckets.clear();
  }
}

/** 默认 RateLimiter 单例 */
const defaultInstance = new RateLimiterImpl();

/** RateLimiter 门面对象（对应 DD-029 类图，使用默认实例） */
export const RateLimiter = {
  rateLimit: (opts: RateLimitOpts): RequestHandler => defaultInstance.rateLimit(opts),
  consume: (key: string, opts: RateLimitOpts): boolean => defaultInstance.consume(key, opts),
  reset: (key: string): void => defaultInstance.reset(key),
  clear: (): void => defaultInstance.clear(),
};

export { defaultInstance as rateLimiter, RateLimiterImpl as RateLimiterClass };
