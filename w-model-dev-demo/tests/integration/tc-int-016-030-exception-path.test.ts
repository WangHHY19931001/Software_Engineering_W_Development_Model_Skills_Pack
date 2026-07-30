/**
 * TC-DES-C 异常路径（EXC）集成测试
 *
 * 覆盖范围：22 INTF 的 404 / 403 / 409 / 422 错误码
 * 目标：验证错误码 + 错误响应结构
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setupIntegrationTest, type IntegrationContext, authHeader } from './setup.js';

describe('TC-DES-C 异常路径（EXC）', () => {
  let ctx: IntegrationContext;

  beforeEach(() => {
    ctx = setupIntegrationTest();
  });

  // ============ INTF-001 认证 ============
  describe('INTF-001 认证', () => {
    it('TC-INT-001-C1: 登录密码错误 → 401 AUTH_FAILED', async () => {
      await ctx.registerUser({ email: 'login1@e.com', password: 'correct123' });
      const res = await ctx
        .api()
        .post('/api/auth/login')
        .send({ email: 'login1@e.com', password: 'wrong' });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_FAILED');
    });

    it('TC-INT-001-C2: 重复邮箱注册 → 409 CONFLICT', async () => {
      await ctx.registerUser({ email: 'dup@e.com', username: 'u_dup' });
      const res = await ctx
        .api()
        .post('/api/auth/register')
        .send({ email: 'dup@e.com', username: 'u_dup2', password: 'password123' });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CONFLICT');
    });
  });

  // ============ INTF-002 用户 ============
  describe('INTF-002 用户', () => {
    it('TC-INT-002-C1: GET /users/:id 不存在 → 404', async () => {
      const res = await ctx.api().get('/api/users/user_nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  // ============ INTF-003 关注 ============
  describe('INTF-003 关注', () => {
    it('TC-INT-003-C1: 关注自己 → 400 VALIDATION_FAILED', async () => {
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .post('/api/follows')
        .set(authHeader(u.token))
        .send({ followeeId: u.userId });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('TC-INT-003-C2: 关注不存在用户 → 404', async () => {
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .post('/api/follows')
        .set(authHeader(u.token))
        .send({ followeeId: 'user_nonexistent' });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('TC-INT-003-C3: 重复关注 → 409', async () => {
      const reader = await ctx.registerUser();
      const blogger = await ctx.registerBlogger();
      await ctx
        .api()
        .post('/api/follows')
        .set(authHeader(reader.token))
        .send({ followeeId: blogger.userId });
      const res = await ctx
        .api()
        .post('/api/follows')
        .set(authHeader(reader.token))
        .send({ followeeId: blogger.userId });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CONFLICT');
    });
  });

  // ============ INTF-004 博主 ============
  describe('INTF-004 博主', () => {
    it('TC-INT-004-C1: 重复申请博主 → 409', async () => {
      const u = await ctx.registerUser();
      await ctx
        .api()
        .post('/api/bloggers')
        .set(authHeader(u.token))
        .send({ displayName: 'Blog 1' });
      const res = await ctx
        .api()
        .post('/api/bloggers')
        .set(authHeader(u.token))
        .send({ displayName: 'Blog 2' });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CONFLICT');
    });
  });

  // ============ INTF-005 博文 ============
  describe('INTF-005 博文', () => {
    it('TC-INT-005-C1: 编辑他人博文 → 403 FORBIDDEN', async () => {
      const b1 = await ctx.registerBlogger();
      const b2 = await ctx.registerBlogger();
      const a = await ctx.services.article.create(b1.userId, {
        title: 'A',
        content: 'B',
        summary: '',
        tagIds: [],
      });
      const res = await ctx
        .api()
        .put(`/api/articles/${a.id}`)
        .set(authHeader(b2.token))
        .send({ title: 'Hijack' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('TC-INT-005-C2: 状态机非法转换（draft→publish→publish）→ 400 INVALID_STATE', async () => {
      const b = await ctx.registerBlogger();
      const a = await ctx.services.article.create(b.userId, {
        title: 'A',
        content: 'B',
        summary: '',
        tagIds: [],
      });
      // 先发布
      await ctx.services.article.transition(a.id, b.userId, 'publish');
      // 再尝试发布（published → publish 非法）
      const res = await ctx
        .api()
        .post(`/api/articles/${a.id}/transition`)
        .set(authHeader(b.token))
        .send({ action: 'publish' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_STATE');
    });

    it('TC-INT-005-C3: 软删后编辑 → 400 INVALID_STATE', async () => {
      const b = await ctx.registerBlogger();
      const a = await ctx.services.article.create(b.userId, {
        title: 'A',
        content: 'B',
        summary: '',
        tagIds: [],
      });
      await ctx.services.article.transition(a.id, b.userId, 'delete');
      const res = await ctx
        .api()
        .put(`/api/articles/${a.id}`)
        .set(authHeader(b.token))
        .send({ title: 'New' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_STATE');
    });
  });

  // ============ INTF-006 浏览 ============
  describe('INTF-006 浏览', () => {
    it('TC-INT-006-C1: GET 不存在 article → 404', async () => {
      const res = await ctx.api().get('/api/articles/article_nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('TC-INT-006-C2: GET draft 状态 article → 404', async () => {
      const b = await ctx.registerBlogger();
      const a = await ctx.services.article.create(b.userId, {
        title: 'Draft',
        content: 'B',
        summary: '',
        tagIds: [],
      });
      // 不发布
      const res = await ctx.api().get(`/api/articles/${a.id}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  // ============ INTF-007 互动 ============
  describe('INTF-007 互动', () => {
    it('TC-INT-007-C1: 点赞不存在 article → 404', async () => {
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .post('/api/articles/article_nonexistent/like')
        .set(authHeader(u.token));
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('TC-INT-007-C2: 重复点赞 → 409', async () => {
      const b = await ctx.registerBlogger();
      const { articleId } = await ctx.publishArticle({ authorId: b.userId });
      const u = await ctx.registerUser();
      await ctx
        .api()
        .post(`/api/articles/${articleId}/like`)
        .set(authHeader(u.token));
      const res = await ctx
        .api()
        .post(`/api/articles/${articleId}/like`)
        .set(authHeader(u.token));
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CONFLICT');
    });
  });

  // ============ INTF-008 标签 ============
  describe('INTF-008 标签', () => {
    it('TC-INT-008-C1: 重复 tag slug → 409', async () => {
      const b = await ctx.registerBlogger();
      await ctx
        .api()
        .post('/api/tags')
        .set(authHeader(b.token))
        .send({ name: 'A', slug: 'tag-a' });
      const res = await ctx
        .api()
        .post('/api/tags')
        .set(authHeader(b.token))
        .send({ name: 'B', slug: 'tag-a' });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CONFLICT');
    });
  });

  // ============ INTF-010 评论 ============
  describe('INTF-010 评论', () => {
    it('TC-INT-010-C1: 评论 draft 状态 article → 400', async () => {
      const b = await ctx.registerBlogger();
      const a = await ctx.services.article.create(b.userId, {
        title: 'Draft',
        content: 'B',
        summary: '',
        tagIds: [],
      });
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .post(`/api/articles/${a.id}/comments`)
        .set(authHeader(u.token))
        .send({ content: 'test' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('TC-INT-010-C2: parentId 不存在 → 404', async () => {
      const b = await ctx.registerBlogger();
      const { articleId } = await ctx.publishArticle({ authorId: b.userId });
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .post(`/api/articles/${articleId}/comments`)
        .set(authHeader(u.token))
        .send({ parentId: 'comment_nonexistent', content: 'reply' });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('TC-INT-010-C3: 删他人评论 → 403', async () => {
      const b = await ctx.registerBlogger();
      const { articleId } = await ctx.publishArticle({ authorId: b.userId });
      const u1 = await ctx.registerUser();
      const u2 = await ctx.registerUser();
      const c = await ctx
        .api()
        .post(`/api/articles/${articleId}/comments`)
        .set(authHeader(u1.token))
        .send({ content: 'mine' });
      const res = await ctx
        .api()
        .delete(`/api/comments/${c.body.id}`)
        .set(authHeader(u2.token));
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  // ============ INTF-011 通知 ============
  describe('INTF-011 通知', () => {
    it('TC-INT-011-C1: PATCH 不存在通知 → 404', async () => {
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .put('/api/me/notifications/notif_nonexistent/read')
        .set(authHeader(u.token));
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  // ============ INTF-013 Webhook ============
  describe('INTF-013 Webhook', () => {
    it('TC-INT-013-C1: 重复 URL webhook → 409', async () => {
      const b = await ctx.registerBlogger();
      await ctx
        .api()
        .post('/api/webhooks')
        .set(authHeader(b.token))
        .send({ url: 'https://example.com/hook', events: ['post.published'] });
      const res = await ctx
        .api()
        .post('/api/webhooks')
        .set(authHeader(b.token))
        .send({ url: 'https://example.com/hook', events: ['post.published'] });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CONFLICT');
    });
  });

  // ============ INTF-014 站点配置 ============
  describe('INTF-014 站点配置', () => {
    it('TC-INT-014-C1: 非 admin 更新 site-config → 403', async () => {
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .put('/api/site-config')
        .set(authHeader(u.token))
        .send({ siteTitle: 'Hijack' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  // ============ INTF-015 访问记录 ============
  describe('INTF-015 访问记录', () => {
    it('TC-INT-015-C1: 非 admin 查看 views → 403', async () => {
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .get('/api/articles/article_x/views')
        .set(authHeader(u.token));
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  // ============ INTF-016 审计 ============
  describe('INTF-016 审计', () => {
    it('TC-INT-016-C1: 非 admin 查 audit-logs → 403', async () => {
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .get('/api/audit-logs')
        .set(authHeader(u.token));
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  // ============ INTF-017 统计 ============
  describe('INTF-017 统计', () => {
    it('TC-INT-017-C1: 非 admin 查 stats → 403', async () => {
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .get('/api/stats')
        .set(authHeader(u.token));
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  // ============ INTF-019 广告位 ============
  describe('INTF-019 广告位', () => {
    it('TC-INT-019-C1: 非 admin 创建 ad → 403', async () => {
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

    it('TC-INT-019-C2: DELETE 不存在 ad → 404', async () => {
      const a = await ctx.registerAdmin();
      const res = await ctx
        .api()
        .delete('/api/ads/ad_nonexistent')
        .set(authHeader(a.token));
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  // ============ INTF-020 限流 ============
  describe('INTF-020 限流', () => {
    it('TC-INT-020-C1: 超过限流阈值 → 429 RATE_LIMITED（裸 supertest 无 bypass）', async () => {
      const { default: supertestRaw } = await import('supertest');
      let limited = false;
      let lastCode = '';
      // 限流默认 100/min/IP；连发 110 次
      for (let i = 0; i < 110; i += 1) {
        const res = await supertestRaw(ctx.app).get('/api/articles/nonexistent_' + i);
        if (res.status === 429) {
          limited = true;
          lastCode = res.body.code;
          break;
        }
      }
      expect(limited).toBe(true);
      expect(lastCode).toBe('RATE_LIMITED');
    });
  });

  // ============ INTF-021 路由 ============
  describe('INTF-021 路由', () => {
    it('TC-INT-021-C1: 未匹配路由 → 404 NOT_FOUND', async () => {
      const res = await ctx.api().get('/api/unknown/path');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  // ============ INTF-022 错误处理 ============
  describe('INTF-022 错误处理', () => {
    it('TC-INT-022-C1: 业务抛 AppError → 响应含 code/message', async () => {
      const res = await ctx.api().get('/api/users/user_does_not_exist');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
      expect(res.body.message).toBeDefined();
    });
  });
});
