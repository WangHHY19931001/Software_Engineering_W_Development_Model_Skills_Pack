/**
 * 系统测试 - 限流测试（2 用例）
 * 对应 docs/system-test-design.md §6：TC-RL-001 ~ TC-RL-002
 * 覆盖 NFR-006 每用户 60 次/分钟
 *
 * 测试方法：
 * - TC-RL-001: 先通过 middleware.check 消耗 60 个令牌触发限流，再发 HTTP 请求验证 429 响应格式；
 *   并通过 middleware.check 精确验证 60/5 边界
 * - TC-RL-002: 中间件级别验证不同 key 的桶隔离（A 触发限流不影响 B）
 *
 * 实现说明：RateLimitMiddleware 按 IP 分桶（req.ip），capacity=60 / refillRate=60/min。
 * HTTP 并发请求在 supertest 下可能因事件循环调度导致令牌补充干扰边界，
 * 故采用"先消耗令牌再发 HTTP"的确定性策略验证 429 响应格式。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestContext,
  type TestContext,
} from './helpers.js';

describe('限流测试（2 用例）', () => {
  let ctx: TestContext;
  let app: Express;

  beforeEach(() => {
    ctx = createTestContext();
    app = ctx.app;
  });

  // ==================== TC-RL-001 单用户限流触发 ====================
  it('TC-RL-001: 单用户 65 次请求 → 60 次 200 + 5 次 429 RATE_LIMIT_ERROR（NFR-006）', async () => {
    // 中间件级别精确边界验证（无时间干扰）
    ctx.middleware.rateLimit.clear();
    const key = 'rl-001-boundary';
    const results: boolean[] = [];
    for (let i = 0; i < 65; i++) {
      results.push(ctx.middleware.rateLimit.check(key));
    }
    // 前 60 次允许
    expect(results.slice(0, 60).every(Boolean)).toBe(true);
    // 61-65 次拒绝
    expect(results.slice(60).every((v) => !v)).toBe(true);
    expect(results.filter((v) => v).length).toBe(60);
    expect(results.filter((v) => !v).length).toBe(5);

    // HTTP 级别验证 429 响应格式：
    // 顺序发送 65 个请求（避免并发导致 IP 不一致），验证 429 触发与响应格式
    ctx.middleware.rateLimit.clear();
    const httpResults: number[] = [];
    for (let i = 0; i < 65; i++) {
      const res = await request(app).get('/api/health');
      httpResults.push(res.status);
    }
    const okCount = httpResults.filter((s) => s === 200).length;
    const limitedCount = httpResults.filter((s) => s === 429).length;

    // 由于顺序请求耗时可能 < 1s，令牌无显著补充，应触发限流
    expect(okCount + limitedCount).toBe(65);
    expect(limitedCount).toBeGreaterThanOrEqual(1);

    // 验证 429 响应格式
    const limitedIdx = httpResults.findIndex((s) => s === 429);
    expect(limitedIdx).toBeGreaterThanOrEqual(0);
    // 重新发送一个限流请求以检查响应体（此时桶已耗尽）
    ctx.middleware.rateLimit.clear();
    // 预消耗 60 个令牌（使用 supertest 默认 IP ::ffff:127.0.0.1）
    const httpIp = '::ffff:127.0.0.1';
    for (let i = 0; i < 60; i++) {
      ctx.middleware.rateLimit.check(httpIp);
    }
    const res429 = await request(app).get('/api/health');
    expect(res429.status).toBe(429);
    expect(res429.body.error).toBeDefined();
    expect(res429.body.error.code).toBe('RATE_LIMIT_ERROR');
    expect(typeof res429.body.error.message).toBe('string');
    expect(res429.body.error.message.length).toBeGreaterThan(0);

    // 验证清除限流后可正常访问
    ctx.middleware.rateLimit.clear();
    const okRes = await request(app).get('/api/health');
    expect(okRes.status).toBe(200);
  });

  // ==================== TC-RL-002 多用户限流隔离 ====================
  it('TC-RL-002: 用户 A 触发限流后，用户 B 仍可正常访问（NFR-006 隔离）', () => {
    ctx.middleware.rateLimit.clear();

    // 模拟两个不同 IP/用户的 key
    const userAKey = '10.0.0.1';
    const userBKey = '10.0.0.2';

    // 用户 A 消耗 65 个令牌
    let aAllowed = 0;
    let aBlocked = 0;
    for (let i = 0; i < 65; i++) {
      if (ctx.middleware.rateLimit.check(userAKey)) {
        aAllowed++;
      } else {
        aBlocked++;
      }
    }
    expect(aAllowed).toBe(60);
    expect(aBlocked).toBe(5);

    // 用户 B 仍可正常访问（10 次全部允许）
    let bAllowed = 0;
    for (let i = 0; i < 10; i++) {
      if (ctx.middleware.rateLimit.check(userBKey)) {
        bAllowed++;
      }
    }
    expect(bAllowed).toBe(10);

    // 用户 A 仍被限流
    expect(ctx.middleware.rateLimit.check(userAKey)).toBe(false);

    // 用户 B 继续访问仍可用（50 次后达到上限）
    let bMore = 0;
    for (let i = 0; i < 50; i++) {
      if (ctx.middleware.rateLimit.check(userBKey)) {
        bMore++;
      }
    }
    expect(bMore).toBe(50);
    // 用户 B 第 61 次被限流
    expect(ctx.middleware.rateLimit.check(userBKey)).toBe(false);
  });
});
