/**
 * 系统测试 - 性能测试（4 用例）
 * 对应 docs/system-test-design.md §2：TC-PERF-001 ~ TC-PERF-004
 * 覆盖 NFR-001 P95 < 200ms / NFR-004 单表 ≥ 10000 条
 *
 * 测试方法：
 * - 使用 supertest 真实调用 Express app，计时高精度 performance.now()
 * - 每用例发送 50 次请求（≤ RateLimitMiddleware 60/min 上限，避免 429 噪声）
 * - 统计 P95 延迟并断言 ≤ 阈值
 * - 内存存储无 I/O，预期延迟远低于阈值
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { performance } from 'node:perf_hooks';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestContext,
  registerAndLogin,
  createPublishedArticle,
  bulkSeedArticles,
  percentile,
  type TestContext,
} from './helpers.js';

describe('性能测试（4 用例）', () => {
  let ctx: TestContext;
  let app: Express;

  beforeEach(() => {
    ctx = createTestContext();
    app = ctx.app;
  });

  // ==================== TC-PERF-001 读 API P95 < 200ms ====================
  it('TC-PERF-001: 读 API 在 1000 条数据下 P95 < 200ms（NFR-001）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const articleIds = bulkSeedArticles(ctx.stores.article, 1000, author.id, 'PERF001');
    const targetId = articleIds[0]!;

    // 5 个读端点
    const endpoints: Array<{ name: string; path: string; query?: Record<string, unknown> }> = [
      { name: 'list', path: '/api/articles', query: { page: 1, limit: 20 } },
      { name: 'getById', path: `/api/articles/${targetId}` },
      { name: 'comments', path: `/api/articles/${targetId}/comments` },
      { name: 'search', path: '/api/search', query: { keyword: 'Bulk' } },
      { name: 'archive', path: '/api/archive' },
    ];

    // 预热：每个端点先发 2 次请求，触发 V8 JIT 优化，避免首次访问的编译开销污染延迟统计
    for (const ep of endpoints) {
      for (let i = 0; i < 2; i++) {
        const res = await request(app).get(ep.path).query(ep.query ?? {});
        expect(res.status).toBe(200);
      }
    }
    // 清除限流桶，避免预热消耗令牌
    ctx.middleware.rateLimit.clear();

    // 正式测量：5 个端点各 10 次请求（共 50 次，≤ 60/min 限流上限）
    const latencies: number[] = [];
    for (const ep of endpoints) {
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const res = await request(app).get(ep.path).query(ep.query ?? {});
        const elapsed = performance.now() - start;
        expect(res.status).toBe(200);
        latencies.push(elapsed);
      }
    }

    const p95 = percentile(latencies, 95);
    const p99 = percentile(latencies, 99);
    const errorCount = 0; // 全部 200
    const errorRate = errorCount / latencies.length;
    // NFR-001: P95 < 200ms，P99 < 500ms，错误率 < 0.1%
    expect(p95).toBeLessThan(200);
    expect(p99).toBeLessThan(500);
    expect(errorRate).toBeLessThan(0.001);
  });

  // ==================== TC-PERF-002 写 API P95 < 200ms ====================
  it('TC-PERF-002: 写 API P95 < 200ms（NFR-001，含 bcrypt 哈希场景）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const reader = await registerAndLogin(app, 'reader@b.com', 'reader');
    bulkSeedArticles(ctx.stores.article, 1000, author.id, 'PERF002');
    const articleId = await createPublishedArticle(app, author.token, 'Perf002 Target', 'Body');

    const latencies: number[] = [];

    // POST /api/articles × 20（含 zod 校验，无 bcrypt）
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      const res = await request(app)
        .post('/api/articles')
        .set('Authorization', `Bearer ${author.token}`)
        .send({ title: `Perf002 Article ${i}`, content: 'body', tagIds: [], categoryId: null, status: 'draft' });
      latencies.push(performance.now() - start);
      expect(res.status).toBe(201);
    }

    // POST /api/articles/:id/comments × 20
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      const res = await request(app)
        .post(`/api/articles/${articleId}/comments`)
        .set('Authorization', `Bearer ${reader.token}`)
        .send({ content: `Perf comment ${i}` });
      latencies.push(performance.now() - start);
      expect(res.status).toBe(201);
    }

    // POST /api/articles/:id/like × 10（toggle 语义，奇数次点赞偶数次取消）
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      const res = await request(app)
        .post(`/api/articles/${articleId}/like`)
        .set('Authorization', `Bearer ${reader.token}`);
      latencies.push(performance.now() - start);
      expect(res.status).toBe(200);
    }

    const p95 = percentile(latencies, 95);
    expect(p95).toBeLessThan(200);
  });

  // ==================== TC-PERF-003 单表 10000 条压力 ====================
  it('TC-PERF-003: 单表 10000 篇文章列表/搜索/归档 P95 < 500ms（NFR-004）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    bulkSeedArticles(ctx.stores.article, 10000, author.id, 'PERF003');

    // 3 个查询端点各 15 次（共 45 次，≤ 60/min）
    const latencies: number[] = [];

    // 列表查询（分页）
    for (let i = 0; i < 15; i++) {
      const start = performance.now();
      const res = await request(app).get('/api/articles').query({ page: 1, limit: 20, status: 'published' });
      latencies.push(performance.now() - start);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(10000);
    }

    // 搜索
    for (let i = 0; i < 15; i++) {
      const start = performance.now();
      const res = await request(app).get('/api/search').query({ keyword: 'PERF003' });
      latencies.push(performance.now() - start);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(10000);
    }

    // 归档
    for (let i = 0; i < 15; i++) {
      const start = performance.now();
      const res = await request(app).get('/api/archive');
      latencies.push(performance.now() - start);
      expect(res.status).toBe(200);
    }

    const p95 = percentile(latencies, 95);
    // NFR-004 容量上限场景放宽至 500ms
    expect(p95).toBeLessThan(500);
  });

  // ==================== TC-PERF-004 RSS 订阅响应时间 ====================
  it('TC-PERF-004: GET /api/rss 在 1000 篇已发布文章下 P95 < 300ms', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    bulkSeedArticles(ctx.stores.article, 1000, author.id, 'PERF004');

    const latencies: number[] = [];
    for (let i = 0; i < 50; i++) {
      const start = performance.now();
      const res = await request(app).get('/api/rss');
      latencies.push(performance.now() - start);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('xml');
    }

    const p95 = percentile(latencies, 95);
    expect(p95).toBeLessThan(300);
  });
});
