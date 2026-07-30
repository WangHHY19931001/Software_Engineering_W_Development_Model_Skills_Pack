/**
 * 限流中间件 - IP 滑动窗口
 * 100 req/min/IP，测试可通过 x-test-bypass-rate-limit: true 跳过
 */
import type { Request, Response, NextFunction } from 'express';
import { RateLimitError } from '../utils/errors.js';
import { getEnv } from '../utils/env.js';

interface Bucket {
  timestamps: number[];
}

const store: Map<string, Bucket> = new Map();

function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0]!.trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

function isBypassed(req: Request): boolean {
  const v = req.headers['x-test-bypass-rate-limit'];
  if (typeof v === 'string' && v.toLowerCase() === 'true') return true;
  return false;
}

export function rateLimitMiddleware() {
  return function (req: Request, _res: Response, next: NextFunction): void {
    if (isBypassed(req)) {
      return next();
    }
    const env = getEnv();
    const ip = getClientIp(req);
    const now = Date.now();
    const windowStart = now - env.rateLimitWindowMs;

    let bucket = store.get(ip);
    if (!bucket) {
      bucket = { timestamps: [] };
      store.set(ip, bucket);
    }
    bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);
    if (bucket.timestamps.length >= env.rateLimitMax) {
      return next(new RateLimitError(`Too many requests for IP ${ip}`));
    }
    bucket.timestamps.push(now);
    next();
  };
}

export function resetRateLimitStore(): void {
  store.clear();
}

export function getRateLimitSnapshot(): Map<string, number> {
  const out = new Map<string, number>();
  for (const [k, v] of store.entries()) {
    out.set(k, v.timestamps.length);
  }
  return out;
}
