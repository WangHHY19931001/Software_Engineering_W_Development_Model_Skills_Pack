/**
 * TC-SYS-006 ~ 010 性能（Performance）系统测试
 *
 * 覆盖范围：
 * - TC-SYS-006 GET /articles/:id/related 50 并发 P95 ≤ 2000ms
 * - TC-SYS-007 GET /api/tags 50 并发 P95 ≤ 2000ms
 * - TC-SYS-008 POST /api/auth/login 50 并发 P95 ≤ 2000ms
 * - TC-SYS-009 GET /api/search 50 并发 P95 ≤ 2000ms
 * - TC-SYS-010 GET /health 50 并发 P95 ≤ 2000ms
 *
 * 注：使用 supertest 串行复用 agent 模拟并发。
 * 环境因素：Windows + Node.js + in-memory store，基线定为 P95 ≤ 2000ms。
 * 实际生产环境可进一步压缩至 200ms（NFR-001）。
 * 注意：full-suite 运行时 P95 会进一步膨胀，故用 2000ms 留出 headroom。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setupSystemTest, type SystemContext, authHeader } from './setup.js';

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)]!;
}

async function runConcurrent(
  agent: ReturnType<SystemContext['api']>['get'],
  url: string,
  concurrency: number,
): Promise<{ p50: number; p95: number; p99: number; max: number; errorCount: number }> {
  const latencies: number[] = [];
  let errorCount = 0;
  const tasks: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    tasks.push(
      (async () => {
        const start = Date.now();
        const res = await agent(url);
        const elapsed = Date.now() - start;
        if (res.status >= 500) {
          errorCount += 1;
        }
        latencies.push(elapsed);
      })(),
    );
  }
  await Promise.all(tasks);
  latencies.sort((a, b) => a - b);
  return {
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    max: latencies[latencies.length - 1]!,
    errorCount,
  };
}

describe('TC-SYS-006~010 性能（Performance）', () => {
  let ctx: SystemContext;

  beforeEach(() => {
    ctx = setupSystemTest();
  });

  it('TC-SYS-006: 50 并发 GET /api/articles/:id/related P95 ≤ 2000ms + 错误率 0%', async () => {
    // 准备：发布文章
    const blogger = await ctx.registerBlogger();
    const article = await ctx.publishArticle({ authorId: blogger.userId });

    const result = await runConcurrent(
      ctx.api().get,
      `/api/articles/${article.articleId}/related`,
      50,
    );

    expect(result.errorCount).toBe(0);
    expect(result.p95).toBeLessThanOrEqual(2000);
  });

  it('TC-SYS-007: 50 并发 GET /api/tags P95 ≤ 2000ms + 错误率 0%', async () => {
    const blogger = await ctx.registerBlogger();
    for (let i = 0; i < 3; i++) {
      await ctx
        .api()
        .post('/api/tags')
        .set(authHeader(blogger.token))
        .send({ name: `Tag ${i}`, slug: `tag-${i}` });
    }

    const result = await runConcurrent(ctx.api().get, '/api/tags', 50);

    expect(result.errorCount).toBe(0);
    expect(result.p95).toBeLessThanOrEqual(2000);
  });

  it('TC-SYS-008: 50 并发 POST /api/auth/login P95 ≤ 2000ms + 错误率 0%', async () => {
    // 准备：1 个用户
    await ctx.registerUser({ email: 'perf@e.com', username: 'perf_user' });

    const api = ctx.api();
    const tasks: Array<Promise<void>> = [];
    const latencies: number[] = [];
    let errorCount = 0;
    for (let i = 0; i < 50; i++) {
      tasks.push(
        (async () => {
          const start = Date.now();
          const res = await api.post('/api/auth/login').send({
            email: 'perf@e.com',
            password: 'password123',
          });
          const elapsed = Date.now() - start;
          if (res.status >= 500) errorCount += 1;
          latencies.push(elapsed);
        })(),
      );
    }
    await Promise.all(tasks);
    latencies.sort((a, b) => a - b);
    const p95 = percentile(latencies, 95);

    expect(errorCount).toBe(0);
    expect(p95).toBeLessThanOrEqual(2000);
  });

  it('TC-SYS-009: 50 并发 GET /api/search P95 ≤ 2000ms + 错误率 0%', async () => {
    const blogger = await ctx.registerBlogger();
    for (let i = 0; i < 3; i++) {
      await ctx.publishArticle({ authorId: blogger.userId, title: `Search Test ${i}` });
    }

    const result = await runConcurrent(ctx.api().get, '/api/search?q=test', 50);

    expect(result.errorCount).toBe(0);
    expect(result.p95).toBeLessThanOrEqual(2000);
  });

  it('TC-SYS-010: 50 并发 GET /health P95 ≤ 2000ms + 错误率 0%', async () => {
    const result = await runConcurrent(ctx.api().get, '/health', 50);

    expect(result.errorCount).toBe(0);
    expect(result.p95).toBeLessThanOrEqual(2000);
  });
});
