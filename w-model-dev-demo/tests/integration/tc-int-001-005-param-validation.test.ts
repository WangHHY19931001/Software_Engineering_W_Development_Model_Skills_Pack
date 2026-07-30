/**
 * TC-DES-A 参数校验（PARAM）集成测试
 *
 * 覆盖范围：22 INTF 中所有接受 path / query / body 校验的端点
 * 目标：错误参数返回 400 VALIDATION_FAILED
 *
 * 编号规范：TC-INT-NNN-Ax（x 为子编号）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setupIntegrationTest, type IntegrationContext, authHeader } from './setup.js';

describe('TC-DES-A 参数校验（PARAM）', () => {
  let ctx: IntegrationContext;

  beforeEach(() => {
    ctx = setupIntegrationTest();
  });

  // ============ INTF-001 认证 ============
  describe('INTF-001 认证', () => {
    it('TC-INT-001-A1: 注册缺 email → 400 VALIDATION_FAILED', async () => {
      const res = await ctx.api().post('/api/auth/register').send({
        username: 'abc',
        password: 'password123',
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('TC-INT-001-A2: 注册 username 长度 < 3 → 400', async () => {
      const res = await ctx.api().post('/api/auth/register').send({
        email: 'a@e.com',
        username: 'ab',
        password: 'password123',
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('TC-INT-001-A3: 注册 password 长度 < 6 → 400', async () => {
      const res = await ctx.api().post('/api/auth/register').send({
        email: 'a@e.com',
        username: 'abc',
        password: '12345',
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('TC-INT-001-A4: 注册 email 格式错误 → 400', async () => {
      const res = await ctx.api().post('/api/auth/register').send({
        email: 'not-an-email',
        username: 'abc',
        password: 'password123',
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('TC-INT-001-A5: 登录缺 password → 400', async () => {
      const res = await ctx.api().post('/api/auth/login').send({
        email: 'a@e.com',
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });
  });

  // ============ INTF-002 用户 ============
  describe('INTF-002 用户', () => {
    it('TC-INT-002-A1: PUT /users/me avatarUrl 非 URL → 400', async () => {
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .put('/api/users/me')
        .set(authHeader(u.token))
        .send({ avatarUrl: 'not-a-url' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });
  });

  // ============ INTF-004 博主 ============
  describe('INTF-004 博主注册', () => {
    it('TC-INT-004-A1: 注册博主 displayName 缺失 → 400', async () => {
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .post('/api/bloggers')
        .set(authHeader(u.token))
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('TC-INT-004-A2: 注册博主 displayName 长度 0 → 400', async () => {
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .post('/api/bloggers')
        .set(authHeader(u.token))
        .send({ displayName: '' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('TC-INT-004-A3: 注册博主 avatarUrl 非 URL → 400', async () => {
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .post('/api/bloggers')
        .set(authHeader(u.token))
        .send({ displayName: 'My Blog', avatarUrl: 'not-url' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });
  });

  // ============ INTF-005 博文 ============
  describe('INTF-005 博文', () => {
    it('TC-INT-005-A1: POST /articles title 缺失 → 400', async () => {
      const b = await ctx.registerBlogger();
      const res = await ctx
        .api()
        .post('/api/articles')
        .set(authHeader(b.token))
        .send({ content: 'Hello' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('TC-INT-005-A2: POST /articles title 长度 201 → 400', async () => {
      const b = await ctx.registerBlogger();
      const res = await ctx
        .api()
        .post('/api/articles')
        .set(authHeader(b.token))
        .send({ title: 'x'.repeat(201), content: 'c' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('TC-INT-005-A3: POST /articles tagIds 21 个 → 400', async () => {
      const b = await ctx.registerBlogger();
      const tags = Array.from({ length: 21 }, (_, i) => `t${i}`);
      const res = await ctx
        .api()
        .post('/api/articles')
        .set(authHeader(b.token))
        .send({ title: 't', content: 'c', tagIds: tags });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('TC-INT-005-A4: transition action 非枚举值 → 400', async () => {
      const b = await ctx.registerBlogger();
      const art = await ctx.services.article.create(b.userId, {
        title: 'A',
        content: 'B',
        summary: '',
        tagIds: [],
      });
      const res = await ctx
        .api()
        .post(`/api/articles/${art.id}/transition`)
        .set(authHeader(b.token))
        .send({ action: 'invalid' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });
  });

  // ============ INTF-007 互动 ============
  describe('INTF-007 互动', () => {
    it('TC-INT-007-A1: 缺少 Authorization → 401 UNAUTHENTICATED（横切）', async () => {
      const b = await ctx.registerBlogger();
      const { articleId } = await ctx.publishArticle({ authorId: b.userId });
      // 不用 bypass-like header；缺 token 应触发 auth 401
      const res = await ctx
        .api()
        .post(`/api/articles/${articleId}/like`)
        .set({ 'x-test-bypass-rate-limit': 'true' });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });
  });

  // ============ INTF-008 标签 ============
  describe('INTF-008 标签', () => {
    it('TC-INT-008-A1: POST /tags slug 不匹配正则 → 400', async () => {
      const b = await ctx.registerBlogger();
      const res = await ctx
        .api()
        .post('/api/tags')
        .set(authHeader(b.token))
        .send({ name: 'tech', slug: 'Not Allowed!' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('TC-INT-008-A2: POST /tags name 缺失 → 400', async () => {
      const b = await ctx.registerBlogger();
      const res = await ctx
        .api()
        .post('/api/tags')
        .set(authHeader(b.token))
        .send({ slug: 'tech' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });
  });

  // ============ INTF-009 搜索 ============
  describe('INTF-009 搜索', () => {
    it('TC-INT-009-A1: 搜索 q 缺失（空字符串）→ 返回空结果', async () => {
      const res = await ctx.api().get('/api/search?q=');
      // 业务返回 200 + items: [] 而非 4xx
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
    });
  });

  // ============ INTF-010 评论 ============
  describe('INTF-010 评论', () => {
    it('TC-INT-010-A1: 评论 content 长度 0 → 400', async () => {
      const b = await ctx.registerBlogger();
      const { articleId } = await ctx.publishArticle({ authorId: b.userId });
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .post(`/api/articles/${articleId}/comments`)
        .set(authHeader(u.token))
        .send({ content: '' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('TC-INT-010-A2: 评论 content 长度 2001 → 400', async () => {
      const b = await ctx.registerBlogger();
      const { articleId } = await ctx.publishArticle({ authorId: b.userId });
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .post(`/api/articles/${articleId}/comments`)
        .set(authHeader(u.token))
        .send({ content: 'x'.repeat(2001) });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });
  });

  // ============ INTF-013 Webhook ============
  describe('INTF-013 Webhook', () => {
    it('TC-INT-013-A1: webhook url 非 http/https → 400', async () => {
      const b = await ctx.registerBlogger();
      const res = await ctx
        .api()
        .post('/api/webhooks')
        .set(authHeader(b.token))
        .send({ url: 'not-a-url', events: ['post.published'] });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('TC-INT-013-A2: webhook events 缺失 → 400', async () => {
      const b = await ctx.registerBlogger();
      const res = await ctx
        .api()
        .post('/api/webhooks')
        .set(authHeader(b.token))
        .send({ url: 'https://example.com/hook' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('TC-INT-013-A3: webhook events 含非法值 → 400', async () => {
      const b = await ctx.registerBlogger();
      const res = await ctx
        .api()
        .post('/api/webhooks')
        .set(authHeader(b.token))
        .send({ url: 'https://example.com/hook', events: ['bogus'] });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });
  });

  // ============ INTF-014 站点配置 ============
  describe('INTF-014 站点配置', () => {
    it('TC-INT-014-A1: PUT /site-config siteLink 非 URL → 400', async () => {
      const a = await ctx.registerAdmin();
      const res = await ctx
        .api()
        .put('/api/site-config')
        .set(authHeader(a.token))
        .send({ siteLink: 'not-a-url' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('TC-INT-014-A2: PUT /site-config siteLogoUrl 非 URL → 400', async () => {
      const a = await ctx.registerAdmin();
      const res = await ctx
        .api()
        .put('/api/site-config')
        .set(authHeader(a.token))
        .send({ siteLogoUrl: 'not-a-url' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });
  });

  // ============ INTF-019 广告位 ============
  describe('INTF-019 广告位', () => {
    it('TC-INT-019-A1: POST /ads imageUrl 非 URL → 400', async () => {
      const a = await ctx.registerAdmin();
      const res = await ctx
        .api()
        .post('/api/ads')
        .set(authHeader(a.token))
        .send({
          name: 'Banner',
          placement: 'banner_top',
          imageUrl: 'not-url',
          linkUrl: 'https://x.com',
          startAt: 0,
          endAt: Date.now() + 100000,
        });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('TC-INT-019-A2: POST /ads linkUrl 非 URL → 400', async () => {
      const a = await ctx.registerAdmin();
      const res = await ctx
        .api()
        .post('/api/ads')
        .set(authHeader(a.token))
        .send({
          name: 'Banner',
          placement: 'banner_top',
          imageUrl: 'https://x.com/i.png',
          linkUrl: 'not-url',
          startAt: 0,
          endAt: Date.now() + 100000,
        });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });
  });

  // ============ INTF-003 关注 ============
  describe('INTF-003 关注', () => {
    it('TC-INT-003-A1: POST /follows 缺 followeeId → 400', async () => {
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .post('/api/follows')
        .set(authHeader(u.token))
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });
  });
});
