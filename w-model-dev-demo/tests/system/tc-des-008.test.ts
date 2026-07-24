/**
 * TC-DES-008: 性能基线（P95≤200ms, 100 QPS 持续负载）
 *
 * 在内存存储下验证通用接口 P95≤200ms、搜索 P95≤500ms（NFR-001），
 * 错误率≤0.1%（NFR-002），内存无 OOM。
 * 因测试环境限制，采用批量并发请求 + P95 统计替代 k6 持续 10min 压测。
 *
 * 关联需求/设计：NFR-001 / SD-006 / CON-002
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestApp, registerUser, authHeader,
} from '../helpers/api-helper.js';
import { RateLimiter } from '../../src/middleware/rate-limiter.js';

/** 计算 P95 */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

describe('TC-DES-008: 性能基线', () => {
  let app: Express;
  let bloggerToken: string;
  let userToken: string;
  let adminToken: string;
  let articleIds: string[] = [];

  beforeEach(async () => {
    app = createTestApp();

    // 预热数据集：创建 50 篇已发布文章 + 3 用户
    const blogger = await registerUser(app, 'perf@b.com', 'Pass1234', 'perfB', 'blogger');
    const admin = await registerUser(app, 'perf@admin.com', 'Pass1234', 'perfA', 'admin');
    const user = await registerUser(app, 'perf@u.com', 'Pass1234', 'perfU', 'user');
    bloggerToken = blogger.accessToken;
    adminToken = admin.accessToken;
    userToken = user.accessToken;

    // 使用直接 service 调用批量创建文章（绕过 HTTP 限流）
    const { getContainer } = await import('../../src/container.js');
    const c = getContainer();
    articleIds = [];
    for (let i = 0; i < 50; i++) {
      const article = await c.articleService.createArticle({
        title: `性能测试文章${i}`,
        content: `内容${i} performance test content`,
        authorId: blogger.userId,
      });
      await c.articleService.transitionState(article.id, 'pending_review', { id: blogger.userId, role: 'blogger' });
      await c.articleService.transitionState(article.id, 'published', { id: admin.userId, role: 'admin' });
      articleIds.push(article.id);
    }
  });

  describe('通用接口 P95 ≤ 200ms', () => {
    it('GET /api/articles 列表接口 P95 ≤ 200ms', async () => {
      const latencies: number[] = [];
      const iterations = 100;

      RateLimiter.clear();
      for (let i = 0; i < iterations; i++) {
        if (i % 50 === 0) RateLimiter.clear();
        const start = performance.now();
        const res = await request(app).get('/api/articles?page=1&size=10');
        const elapsed = performance.now() - start;
        latencies.push(elapsed);
        expect(res.status).toBe(200);
      }

      const p95 = percentile(latencies, 95);
      const p99 = percentile(latencies, 99);
      // eslint-disable-next-line no-console
      console.log(`GET /api/articles: P95=${p95.toFixed(2)}ms, P99=${p99.toFixed(2)}ms, avg=${(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)}ms`);
      expect(p95).toBeLessThan(200);
    });

    it('GET /api/articles/:id 详情接口 P95 ≤ 200ms', async () => {
      const latencies: number[] = [];
      const iterations = 100;

      RateLimiter.clear();
      for (let i = 0; i < iterations; i++) {
        if (i % 50 === 0) RateLimiter.clear();
        const articleId = articleIds[i % articleIds.length];
        const start = performance.now();
        const res = await request(app).get(`/api/articles/${articleId}`);
        const elapsed = performance.now() - start;
        latencies.push(elapsed);
        expect(res.status).toBe(200);
      }

      const p95 = percentile(latencies, 95);
      // eslint-disable-next-line no-console
      console.log(`GET /api/articles/:id: P95=${p95.toFixed(2)}ms`);
      expect(p95).toBeLessThan(200);
    });

    it('POST /api/auth/login 登录接口 P95 ≤ 200ms', async () => {
      const latencies: number[] = [];
      const iterations = 50; // bcrypt 比对耗时较高，减少迭代数

      RateLimiter.clear();
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'perf@b.com', password: 'Pass1234' });
        const elapsed = performance.now() - start;
        latencies.push(elapsed);
        expect(res.status).toBe(200);
      }

      const p95 = percentile(latencies, 95);
      // eslint-disable-next-line no-console
      console.log(`POST /api/auth/login: P95=${p95.toFixed(2)}ms`);
      expect(p95).toBeLessThan(200);
    });

    it('GET /api/notifications 通知接口 P95 ≤ 200ms', async () => {
      const latencies: number[] = [];
      const iterations = 100;

      RateLimiter.clear();
      for (let i = 0; i < iterations; i++) {
        if (i % 50 === 0) RateLimiter.clear();
        const start = performance.now();
        const res = await request(app)
          .get('/api/notifications')
          .set(authHeader(bloggerToken));
        const elapsed = performance.now() - start;
        latencies.push(elapsed);
        expect(res.status).toBe(200);
      }

      const p95 = percentile(latencies, 95);
      // eslint-disable-next-line no-console
      console.log(`GET /api/notifications: P95=${p95.toFixed(2)}ms`);
      expect(p95).toBeLessThan(200);
    });
  });

  describe('搜索接口 P95 ≤ 500ms', () => {
    it('GET /api/search 搜索接口 P95 ≤ 500ms（需先索引）', async () => {
      // 先索引文章到搜索索引器
      const { getContainer } = await import('../../src/container.js');
      const c = getContainer();
      const { articleStore } = await import('../../src/stores/article-store.js');
      for (const article of articleStore.listAll()) {
        c.searchIndexer.indexArticle(article);
      }

      const latencies: number[] = [];
      const iterations = 100;

      RateLimiter.clear();
      for (let i = 0; i < iterations; i++) {
        if (i % 50 === 0) RateLimiter.clear();
        const start = performance.now();
        const res = await request(app).get('/api/search?q=性能&sort=relevance&page=1&size=10');
        const elapsed = performance.now() - start;
        latencies.push(elapsed);
        expect(res.status).toBe(200);
      }

      const p95 = percentile(latencies, 95);
      // eslint-disable-next-line no-console
      console.log(`GET /api/search: P95=${p95.toFixed(2)}ms`);
      expect(p95).toBeLessThan(500);
    });
  });

  describe('QPS 与错误率', () => {
    it('批量并发请求错误率 ≤ 0.1%（≥1000 请求）', async () => {
      let success = 0;
      let failed = 0;
      const total = 1000;

      // 分批发送并发请求（每批 50 个），每批前清除限流计数
      const batchSize = 50;
      for (let batch = 0; batch < total / batchSize; batch++) {
        RateLimiter.clear();
        const promises: Promise<void>[] = [];
        for (let i = 0; i < batchSize; i++) {
          promises.push(
            (async () => {
              try {
                const res = await request(app).get('/api/articles?page=1&size=5');
                if (res.status === 200) success++;
                else failed++;
              } catch {
                failed++;
              }
            })(),
          );
        }
        await Promise.all(promises);
      }

      const errorRate = (failed / total) * 100;
      // eslint-disable-next-line no-console
      console.log(`批量请求: total=${total}, success=${success}, failed=${failed}, errorRate=${errorRate.toFixed(3)}%`);
      expect(errorRate).toBeLessThanOrEqual(0.1);
    }, 30_000); // 1000 请求需要更长超时
  });

  describe('内存与事件循环', () => {
    it('heapUsed ≤ 512MB，无 OOM', () => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / (1024 * 1024);
      // eslint-disable-next-line no-console
      console.log(`Memory: heapUsed=${heapUsedMB.toFixed(2)}MB, rss=${(memUsage.rss / (1024 * 1024)).toFixed(2)}MB`);
      expect(heapUsedMB).toBeLessThan(512);
    });
  });
});
