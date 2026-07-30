/**
 * TC-SYS-011 ~ 015 可靠性（Reliability）系统测试
 *
 * 覆盖范围：
 * - TC-SYS-011 200 并发同健康 endpoint 错误率 = 0%（NFR-004）
 * - TC-SYS-012 状态机转移：草稿 → 发布 → 归档 → 反归档（→ draft）
 * - TC-SYS-013 限流降级：滑动窗口触发 429
 * - TC-SYS-014 服务降级：重复注册不崩溃
 * - TC-SYS-015 关注/取关幂等 0 错误
 */
import { describe, it, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import { setupSystemTest, type SystemContext, authHeader } from './setup.js';

describe('TC-SYS-011~015 可靠性（Reliability）', () => {
  let ctx: SystemContext;

  beforeEach(() => {
    ctx = setupSystemTest();
  });

  it('TC-SYS-011: 100 并发同健康 endpoint 错误率 = 0%', { timeout: 30000 }, async () => {
    const api = ctx.api();
    const tasks: Array<Promise<void>> = [];
    let errorCount = 0;
    for (let i = 0; i < 100; i++) {
      tasks.push(
        (async () => {
          const res = await api.get('/health');
          if (res.status >= 500) errorCount += 1;
        })(),
      );
    }
    await Promise.all(tasks);
    expect(errorCount).toBe(0);
  });

  it('TC-SYS-012: 状态机回滚 - 草稿 → 发布 → 归档 → 反归档 → draft', async () => {
    const blogger = await ctx.registerBlogger();
    const article = await ctx.publishArticle({ authorId: blogger.userId });

    // 归档（published → archived）
    const archived = await ctx
      .api()
      .post(`/api/articles/${article.articleId}/transition`)
      .set(authHeader(blogger.token))
      .send({ action: 'archive' });
    expect(archived.status).toBe(200);
    expect(archived.body.status).toBe('archived');

    // 反归档（archived → draft）
    const unarchived = await ctx
      .api()
      .post(`/api/articles/${article.articleId}/transition`)
      .set(authHeader(blogger.token))
      .send({ action: 'unarchive' });
    expect(unarchived.status).toBe(200);
    expect(unarchived.body.status).toBe('draft');

    // 重新发布（draft → published）
    const republished = await ctx
      .api()
      .post(`/api/articles/${article.articleId}/transition`)
      .set(authHeader(blogger.token))
      .send({ action: 'publish' });
    expect(republished.status).toBe(200);
    expect(republished.body.status).toBe('published');

    // 取消发布（published → draft）
    const unpublished = await ctx
      .api()
      .post(`/api/articles/${article.articleId}/transition`)
      .set(authHeader(blogger.token))
      .send({ action: 'unpublish' });
    expect(unpublished.status).toBe(200);
    expect(unpublished.body.status).toBe('draft');

    // 删除
    const deleted = await ctx
      .api()
      .delete(`/api/articles/${article.articleId}`)
      .set(authHeader(blogger.token));
    expect(deleted.status).toBe(204);
  });

  it('TC-SYS-013: 限流降级 - 滑动窗口触发 429（不带 bypass 头）', async () => {
    // 准备：1 个用户
    const user = await ctx.registerUser({ email: 'rl13@e.com', username: 'rl13' });
    const login = await ctx
      .api()
      .post('/api/auth/login')
      .send({ email: 'rl13@e.com', password: 'password123' });
    const token = login.body.token;

    // 触发 101 次
    const agent = supertest(ctx.app);
    let okCount = 0;
    let rateLimitCount = 0;
    for (let i = 0; i < 105; i++) {
      const res = await agent
        .get('/api/me/notifications')
        .set('Authorization', `Bearer ${token}`);
      if (res.status === 200) okCount += 1;
      else if (res.status === 429) rateLimitCount += 1;
    }
    // 验证：100 个 OK + 5 个 429
    expect(okCount).toBe(100);
    expect(rateLimitCount).toBe(5);
  });

  it('TC-SYS-014: 服务降级 - 重复注册不崩溃，错误率 = 0', async () => {
    // 重复注册同一邮箱 → 409 但不崩溃
    const r1 = await ctx
      .api()
      .post('/api/auth/register')
      .send({ email: 'dup@e.com', username: 'dup1', password: 'password123' });
    expect(r1.status).toBe(201);

    const r2 = await ctx
      .api()
      .post('/api/auth/register')
      .send({ email: 'dup@e.com', username: 'dup2', password: 'password123' });
    expect(r2.status).toBe(409);

    // 错误注册（缺字段）→ 400 不崩溃
    const r3 = await ctx
      .api()
      .post('/api/auth/register')
      .send({ email: 'not-an-email' });
    expect(r3.status).toBe(400);
  });

  it('TC-SYS-015: 关注/取关幂等 0 错误', async () => {
    const blogger = await ctx.registerBlogger();
    const reader = await ctx.registerUser();

    // 第一次关注
    const r1 = await ctx
      .api()
      .post('/api/follows')
      .set(authHeader(reader.token))
      .send({ followeeId: blogger.userId });
    expect(r1.status).toBe(201);

    // 重复关注
    const r2 = await ctx
      .api()
      .post('/api/follows')
      .set(authHeader(reader.token))
      .send({ followeeId: blogger.userId });
    // 重复关注是 idempotent 行为；至少不能 5xx
    expect([201, 409, 200]).toContain(r2.status);

    // 取关
    const r3 = await ctx
      .api()
      .delete(`/api/follows/${blogger.userId}`)
      .set(authHeader(reader.token));
    expect(r3.status).toBe(204);

    // 重复取关
    const r4 = await ctx
      .api()
      .delete(`/api/follows/${blogger.userId}`)
      .set(authHeader(reader.token));
    // 重复取关应不抛 5xx
    expect([204, 404, 409]).toContain(r4.status);
  });
});
