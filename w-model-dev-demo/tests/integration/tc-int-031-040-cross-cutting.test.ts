/**
 * TC-DES-D 横切关注（XCT）集成测试
 *
 * 覆盖范围：限流 / 鉴权 / 错误处理 / 健康检查 / 路由分发 / 审计 / 日志
 * 目标：验证横切中间件正确作用于业务 INTF
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setupIntegrationTest, type IntegrationContext, authHeader } from './setup.js';

describe('TC-DES-D 横切关注（XCT）', () => {
  let ctx: IntegrationContext;

  beforeEach(() => {
    ctx = setupIntegrationTest();
  });

  // ============ 鉴权中间件 ============
  describe('鉴权中间件 (authMiddleware)', () => {
    it('TC-INT-001-D1: 缺 Authorization → 401 UNAUTHENTICATED', async () => {
      const { default: supertestRaw } = await import('supertest');
      const res = await supertestRaw(ctx.app).get('/api/users/me');
      // 实际上没有 /users/me，但缺 auth 头走不到那里之前就被拦截
      // 先用 /me/notifications 测试
      const r2 = await supertestRaw(ctx.app).get('/api/me/notifications');
      expect(r2.status).toBe(401);
      expect(r2.body.code).toBe('UNAUTHENTICATED');
    });

    it('TC-INT-001-D2: Authorization 格式错误（非 Bearer）→ 401', async () => {
      const { default: supertestRaw } = await import('supertest');
      const res = await supertestRaw(ctx.app)
        .get('/api/me/notifications')
        .set('Authorization', 'Basic abc');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('TC-INT-001-D3: 错误 token → 401 TOKEN_INVALID', async () => {
      const { default: supertestRaw } = await import('supertest');
      const res = await supertestRaw(ctx.app)
        .get('/api/me/notifications')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('TOKEN_INVALID');
    });
  });

  // ============ RBAC ============
  describe('RBAC (requireRole)', () => {
    it('TC-INT-016-D1: reader 访问 audit-logs → 403', async () => {
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .get('/api/audit-logs')
        .set(authHeader(u.token));
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('TC-INT-017-D1: reader 访问 stats → 403', async () => {
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .get('/api/stats')
        .set(authHeader(u.token));
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('TC-INT-014-D1: reader 更新 site-config → 403', async () => {
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .put('/api/site-config')
        .set(authHeader(u.token))
        .send({ siteTitle: 'X' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('TC-INT-019-D1: reader 创建 ad → 403', async () => {
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .post('/api/ads')
        .set(authHeader(u.token))
        .send({
          name: 'X',
          placement: 'banner_top',
          imageUrl: 'https://x.com/i.png',
          linkUrl: 'https://x.com',
          startAt: 0,
          endAt: Date.now() + 100000,
        });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('TC-INT-005-D1: reader 创建 article → 403', async () => {
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .post('/api/articles')
        .set(authHeader(u.token))
        .send({ title: 't', content: 'c' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('TC-INT-008-D1: reader 创建 tag → 403', async () => {
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .post('/api/tags')
        .set(authHeader(u.token))
        .send({ name: 't', slug: 't' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  // ============ 限流中间件 ============
  describe('限流中间件 (rateLimitMiddleware)', () => {
    it('TC-INT-020-D1: 限流 bypass 头（true）→ 不计入限流', async () => {
      const { default: supertestRaw } = await import('supertest');
      // 200 次带 bypass 头，都应 200/404 而非 429
      for (let i = 0; i < 200; i += 1) {
        const res = await supertestRaw(ctx.app)
          .get('/api/articles/nx' + i)
          .set('x-test-bypass-rate-limit', 'true');
        expect([200, 404, 401, 403]).toContain(res.status);
        expect(res.status).not.toBe(429);
      }
    });
  });

  // ============ 健康检查 ============
  describe('健康检查 (health check)', () => {
    it('TC-INT-021-D1: GET /health → 200', async () => {
      const { default: supertestRaw } = await import('supertest');
      const res = await supertestRaw(ctx.app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.ts).toBeDefined();
    });
  });

  // ============ 错误处理 ============
  describe('错误处理 (ErrorHandler)', () => {
    it('TC-INT-022-D1: 业务错误 → 含 code/message/httpStatus', async () => {
      const res = await ctx.api().get('/api/users/user_dne');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
      expect(res.body.message).toBeDefined();
      expect(res.body.httpStatus).toBe(404);
    });

    it('TC-INT-022-D2: Zod 校验错误 → 400 VALIDATION_FAILED', async () => {
      const res = await ctx
        .api()
        .post('/api/auth/register')
        .send({ email: 'bad' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.details).toBeDefined();
      expect(res.body.details.issues).toBeDefined();
    });
  });

  // ============ 公开端点无需鉴权 ============
  describe('公开端点', () => {
    it('TC-INT-002-D1: GET /users/:id 公开可访问', async () => {
      const u = await ctx.registerUser({ username: 'pubuser1' });
      const res = await ctx.api().get(`/api/users/${u.userId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(u.userId);
    });

    it('TC-INT-006-D1: GET /articles/:id 公开可访问（无需 JWT）', async () => {
      const b = await ctx.registerBlogger();
      const { articleId } = await ctx.publishArticle({ authorId: b.userId });
      const res = await ctx.api().get(`/api/articles/${articleId}`);
      expect(res.status).toBe(200);
    });

    it('TC-INT-008-D2: GET /tags 公开可访问', async () => {
      const res = await ctx.api().get('/api/tags');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('TC-INT-014-D2: GET /site-config 公开可访问', async () => {
      const res = await ctx.api().get('/api/site-config');
      expect(res.status).toBe(200);
      expect(res.body.siteTitle).toBeDefined();
    });
  });

  // ============ 审计 / 日志 ============
  describe('审计 / 日志', () => {
    it('TC-INT-016-D2: admin 查 audit-logs → 200 + paginated', async () => {
      const a = await ctx.registerAdmin();
      const res = await ctx
        .api()
        .get('/api/audit-logs')
        .set(authHeader(a.token));
      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();
      expect(res.body.total).toBeDefined();
    });
  });

  // ============ 中间件链顺序 ============
  describe('中间件链顺序', () => {
    it('TC-INT-021-D2: 缺 JWT 的 admin 路由 → 401 而非 403', async () => {
      // 先被 auth 拦截
      const { default: supertestRaw } = await import('supertest');
      const res = await supertestRaw(ctx.app).get('/api/audit-logs');
      expect(res.status).toBe(401);
    });
  });
});
