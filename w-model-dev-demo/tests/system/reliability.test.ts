/**
 * 系统测试 - 可靠性测试（3 用例）
 * 对应 docs/system-test-design.md §3：TC-REL-001 ~ TC-REL-003
 * 覆盖 NFR-003 错误处理 100% 统一格式
 *
 * 测试方法：
 * - TC-REL-001: 构造 7 类错误请求，校验响应格式 {error:{code, message, details?}}
 * - TC-REL-002: 模拟未捕获异常兜底返回 500 INTERNAL_ERROR（不泄漏堆栈）
 * - TC-REL-003: 1000 请求错误率 0%（每 50 次清除限流桶，避免 429 噪声）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestContext,
  registerAndLogin,
  bulkSeedArticles,
  errorRate,
  type TestContext,
} from './helpers.js';

describe('可靠性测试（3 用例）', () => {
  let ctx: TestContext;
  let app: Express;

  beforeEach(() => {
    ctx = createTestContext();
    app = ctx.app;
  });

  // ==================== TC-REL-001 统一错误响应格式 ====================
  it('TC-REL-001: 7 类错误响应格式统一 {error:{code, message}}（NFR-003）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');

    // 400 VALIDATION_ERROR：zod 校验失败
    const r400 = await request(app)
      .post('/api/users/register')
      .send({ email: 'not-an-email', password: 'pass1234', role: 'reader' });
    expect(r400.status).toBe(400);
    expect(r400.body.error).toBeDefined();
    expect(r400.body.error.code).toBe('VALIDATION_ERROR');
    expect(typeof r400.body.error.message).toBe('string');

    // 401 AUTHENTICATION_ERROR：缺少 Bearer 令牌
    const r401 = await request(app).get('/api/users/profile');
    expect(r401.status).toBe(401);
    expect(r401.body.error.code).toBe('AUTHENTICATION_ERROR');

    // 403 AUTHORIZATION_ERROR：reader 访问 admin-only 接口
    const reader = await registerAndLogin(app, 'reader@b.com', 'reader');
    const r403 = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${reader.token}`)
      .send({ name: 'forbidden' });
    expect(r403.status).toBe(403);
    expect(r403.body.error.code).toBe('AUTHORIZATION_ERROR');

    // 404 NOT_FOUND_ERROR：不存在的路由
    const r404 = await request(app).get('/api/nonexistent-route');
    expect(r404.status).toBe(404);
    expect(r404.body.error.code).toBe('NOT_FOUND_ERROR');

    // 409 CONFLICT_ERROR：重复注册
    await request(app)
      .post('/api/users/register')
      .send({ email: 'dup@b.com', password: 'pass1234', role: 'reader' });
    const r409 = await request(app)
      .post('/api/users/register')
      .send({ email: 'dup@b.com', password: 'pass1234', role: 'reader' });
    expect(r409.status).toBe(409);
    expect(r409.body.error.code).toBe('CONFLICT_ERROR');

    // 429 RATE_LIMIT_ERROR：预消耗 60 个令牌触发限流，再发 HTTP 请求验证 429 响应格式
    ctx.middleware.rateLimit.clear();
    // supertest 默认 IP 为 ::ffff:127.0.0.1（Node.js IPv4 映射 IPv6）
    const httpIp = '::ffff:127.0.0.1';
    for (let i = 0; i < 60; i++) {
      ctx.middleware.rateLimit.check(httpIp);
    }
    const r429 = await request(app).get('/api/health');
    expect(r429.status).toBe(429);
    expect(r429.body.error).toBeDefined();
    expect(r429.body.error.code).toBe('RATE_LIMIT_ERROR');

    // 500 INTERNAL_ERROR：未捕获异常兜底（临时替换 service 抛 plain Error）
    ctx.middleware.rateLimit.clear();
    const originalCreate = ctx.services.article.create.bind(ctx.services.article);
    ctx.services.article.create = (() => {
      throw new Error('simulated uncaught error');
    }) as typeof originalCreate;
    const r500 = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ title: 'trigger 500', content: 'body', tagIds: [], categoryId: null, status: 'draft' });
    expect(r500.status).toBe(500);
    expect(r500.body.error.code).toBe('INTERNAL_ERROR');
    expect(r500.body.error.message).not.toContain('simulated'); // 不泄漏堆栈
    ctx.services.article.create = originalCreate;

    // 校验所有错误响应格式统一 {error:{code, message}}
    const allErrors = [r400, r401, r403, r404, r409, r429!, r500];
    for (const res of allErrors) {
      expect(res.body.error).toBeDefined();
      expect(typeof res.body.error.code).toBe('string');
      expect(typeof res.body.error.message).toBe('string');
      expect(res.body.error.message.length).toBeGreaterThan(0);
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });

  // ==================== TC-REL-002 未捕获异常兜底 ====================
  it('TC-REL-002: 未捕获异常兜底返回 500 INTERNAL_ERROR，不泄漏堆栈（NFR-003）', async () => {
    await registerAndLogin(app, 'author@b.com', 'author');
    ctx.middleware.rateLimit.clear();

    // 临时替换 articleService.getById 抛出 plain Error（非 AppError）
    const original = ctx.services.article.getById.bind(ctx.services.article);
    ctx.services.article.getById = (() => {
      throw new Error('internal boom: secret=abc123');
    }) as typeof original;

    const res = await request(app).get('/api/articles/some-id');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    // 不泄漏堆栈/敏感信息
    expect(res.body.error.message).not.toContain('secret');
    expect(res.body.error.message).not.toContain('abc123');
    expect(res.body.error.message).not.toContain('internal boom');
    ctx.services.article.getById = original;
  });

  // ==================== TC-REL-003 1000 请求错误率 0% ====================
  it('TC-REL-003: 1000 请求错误率 0%（NFR-003 可靠性）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const articleIds = bulkSeedArticles(ctx.stores.article, 100, author.id, 'REL003');
    const targetId = articleIds[0]!;

    // 轮询 4 个读端点共 1000 次，每 50 次清除限流桶
    const endpoints = [
      { path: '/api/articles', query: { page: 1, limit: 20 } },
      { path: '/api/articles/' + targetId, query: {} },
      { path: '/api/search', query: { keyword: 'REL003' } },
      { path: '/api/health', query: {} },
    ];

    const statuses: number[] = [];
    for (let i = 0; i < 1000; i++) {
      if (i > 0 && i % 50 === 0) {
        ctx.middleware.rateLimit.clear();
      }
      const ep = endpoints[i % endpoints.length]!;
      const res = await request(app).get(ep.path).query(ep.query);
      statuses.push(res.status);
    }

    const rate = errorRate(statuses);
    expect(rate).toBe(0);
    expect(statuses.length).toBe(1000);
    const nonOk = statuses.filter((s) => s < 200 || s >= 300);
    expect(nonOk.length).toBe(0);
  });
});
