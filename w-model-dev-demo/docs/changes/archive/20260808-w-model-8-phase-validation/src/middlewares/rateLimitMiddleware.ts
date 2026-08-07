/**
 * rateLimitMiddleware（DD-042 / SD-007 / NFR-006）：IP 滑动窗口限流。
 * 双阈值：认证接口 10 次/分/IP（/api/auth/*）、通用 API 100 次/分/IP（/api/*）；
 * 窗口内超限 → 42901（retryable=true）；窗口重置后清零放行。阈值/窗口可配置（测试缩小窗口）。
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { BizError } from '../utils/errors';
import { invariant } from '../utils/invariant';

interface RateLimitOptions {
  limit: number;
  windowMs: number;
  /** 假时钟注入（单元测试 seam） */
  now?: () => number;
  /** 计数键解析（默认 clientIp + originalUrl） */
  keyFn?: (req: Request) => string;
}

interface Counter {
  count: number;
  windowStart: number;
}

export class RateLimitMiddleware {
  private counters = new Map<string, Counter>();

  rateLimit(opts: RateLimitOptions): RequestHandler {
    const now = opts.now ?? Date.now;
    const keyFn = opts.keyFn ?? ((req: Request) => `${req.ip ?? 'unknown'}|${req.originalUrl.split('?')[0]}`);
    return (req: Request, res: Response, next: NextFunction) => {
      // TLA+ BusinessInvariant 锚点（L3_BlogSystemRateLimit / NFR-006）：限流窗口不变量——limit ≥ 1 且 windowMs > 0
      invariant(opts.limit >= 1 && opts.windowMs > 0, '限流窗口不变量违反：limit ≥ 1 且 windowMs > 0');
      const key = keyFn(req);
      const t = now();
      let counter = this.counters.get(key);
      if (!counter || t - counter.windowStart >= opts.windowMs) {
        counter = { count: 0, windowStart: t };
        this.counters.set(key, counter);
      }
      if (counter.count >= opts.limit) {
        next(new BizError(42901));
        return;
      }
      counter.count += 1;
      next();
    };
  }

  /* ============ TLA+ Next 分支对应（L3_BlogSystemRateLimit，命名契约） ============ */

  /** TLA+ L3_BlogSystemRateLimit "AllowRequest" 动作对应：窗口内放行（计数 +1，返回是否放行） */
  allowRequest(opts: RateLimitOptions, key: string): boolean {
    const now = opts.now ?? Date.now;
    const t = now();
    let counter = this.counters.get(key);
    if (!counter || t - counter.windowStart >= opts.windowMs) {
      counter = { count: 0, windowStart: t };
      this.counters.set(key, counter);
    }
    if (counter.count >= opts.limit) {
      return false;
    }
    counter.count += 1;
    return true;
  }

  /** TLA+ L3_BlogSystemRateLimit "RejectRequest" 动作对应：超限拒绝判定（窗口内超限 → true，否则 false） */
  rejectRequest(opts: RateLimitOptions, key: string): boolean {
    const now = opts.now ?? Date.now;
    const t = now();
    const counter = this.counters.get(key);
    if (counter && t - counter.windowStart < opts.windowMs) {
      return counter.count >= opts.limit;
    }
    return false;
  }

  /** TLA+ L3_BlogSystemRateLimit "WindowReset" 动作对应：重置计数窗口（滑动窗口过期后清零放行） */
  windowReset(key: string): void {
    this.counters.delete(key);
  }
}
