/**
 * TC-DES-010: 接口参数校验（合法/非法/边界参数）
 *
 * 验证接口对合法/非法/边界参数的校验行为：
 * - 非法参数返回 400+错误码
 * - 边界参数正确处理
 * - zod schema 校验在 controller 层生效
 *
 * 覆盖接口：INTF-001/004/008/012
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import {
  createTestApp, registerUser, authHeader, createArticle,
} from '../helpers/api-helper.js';
import type { Express } from 'express';

describe('TC-DES-010: 接口参数校验', () => {
  let app: Express;
  let bloggerToken: string;
  let adminToken: string;

  beforeEach(async () => {
    app = createTestApp();
    const blogger = await registerUser(app, 'blogger@t10.com', 'Pass1234', 'blogger10', 'blogger');
    bloggerToken = blogger.accessToken;
    const admin = await registerUser(app, 'admin@t10.com', 'Pass1234', 'admin10', 'admin');
    adminToken = admin.accessToken;
  });

  describe('合法参数', () => {
    it('合法注册返回 201', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'legal@test.com', password: 'Pass1234', nickname: 'legal',
      });
      expect(res.status).toBe(201);
      expect(res.body.userId).toBeDefined();
    });

    it('合法创建文章返回 201', async () => {
      const res = await request(app)
        .post('/api/articles')
        .set(authHeader(bloggerToken))
        .send({ title: '合法标题', content: '合法内容' });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('draft');
    });

    it('合法创建广告（admin 角色）返回 201', async () => {
      const now = Math.floor(Date.now() / 1000);
      const res = await request(app)
        .post('/api/ads')
        .set(authHeader(adminToken))
        .send({
          slot: 'home-banner',
          startAt: now + 100,
          endAt: now + 86400,
          content: '广告内容',
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('pending');
    });
  });

  describe('非法参数', () => {
    it('邮箱格式非法 → 400 + code 40003', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'not-email', password: 'Pass1234', nickname: 'x',
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(40003);
    });

    it('密码强度不足（len<8）→ 400 + code 40003', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'a@b.com', password: '123', nickname: 'x',
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(40003);
    });

    it('参数缺失（文章缺 content）→ 400 + code 40003', async () => {
      const res = await request(app)
        .post('/api/articles')
        .set(authHeader(bloggerToken))
        .send({ title: '标题' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(40003);
    });

    it('非法状态转换（draft→published）→ 400 + code 60001', async () => {
      const article = await createArticle(app, bloggerToken, { title: 'T', content: 'C' });
      const res = await request(app)
        .post(`/api/articles/${article.id}/transition`)
        .set(authHeader(adminToken))
        .send({ toState: 'published' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(60001);
    });

    it('重复邮箱注册 → 409 + code 40901', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'blogger@t10.com', password: 'Pass1234', nickname: 'dup',
      });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe(40901);
    });

    it('未授权访问 → 401 + code 40101', async () => {
      const res = await request(app).get('/api/users/u1');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(40101);
    });

    it('RBAC 权限不足（blogger 创建广告）→ 403 + code 40301', async () => {
      const now = Math.floor(Date.now() / 1000);
      const res = await request(app)
        .post('/api/ads')
        .set(authHeader(bloggerToken))
        .send({
          slot: 'home-banner', startAt: now + 100, endAt: now + 86400,
        });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe(40301);
    });
  });

  describe('边界参数', () => {
    it('标题边界（1 字符）→ 201', async () => {
      const res = await request(app)
        .post('/api/articles')
        .set(authHeader(bloggerToken))
        .send({ title: 'T', content: 'x' });
      expect(res.status).toBe(201);
    });

    it('标题边界（200 字符）→ 201', async () => {
      const res = await request(app)
        .post('/api/articles')
        .set(authHeader(bloggerToken))
        .send({ title: 'T'.repeat(200), content: 'x' });
      expect(res.status).toBe(201);
    });

    it('标题超限（201 字符）→ 400 + code 40003', async () => {
      const res = await request(app)
        .post('/api/articles')
        .set(authHeader(bloggerToken))
        .send({ title: 'T'.repeat(201), content: 'x' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(40003);
    });

    it('评论深度边界（API 层 parentId 触发 depth=1）→ 201', async () => {
      const article = await createArticle(app, bloggerToken, { title: 'Depth', content: 'C' });
      const admin = await registerUser(app, 'admin2@t10.com', 'Pass1234', 'a2', 'admin');
      await request(app)
        .post(`/api/articles/${article.id}/transition`)
        .set(authHeader(admin.accessToken))
        .send({ toState: 'pending_review' });
      await request(app)
        .post(`/api/articles/${article.id}/transition`)
        .set(authHeader(admin.accessToken))
        .send({ toState: 'published' });

      const user = await registerUser(app, 'u@t10.com', 'Pass1234', 'u', 'user');
      const c1 = await request(app)
        .post('/api/comments')
        .set(authHeader(user.accessToken))
        .send({ articleId: article.id, content: '顶级评论' });
      expect(c1.status).toBe(201);
      expect(c1.body.depth).toBe(0);

      const c2 = await request(app)
        .post('/api/comments')
        .set(authHeader(user.accessToken))
        .send({ articleId: article.id, content: '回复', parentId: c1.body.id });
      expect(c2.status).toBe(201);
      expect(c2.body.depth).toBe(1);
    });

    it('评论深度超限（replyComment depth≥3 抛 60004）→ 服务层校验', async () => {
      const { getContainer } = await import('../../src/container.js');
      const c = getContainer();

      const article = await createArticle(app, bloggerToken, { title: 'DepthLimit', content: 'C' });
      const admin = await registerUser(app, 'admin3@t10.com', 'Pass1234', 'a3', 'admin');
      await request(app)
        .post(`/api/articles/${article.id}/transition`)
        .set(authHeader(admin.accessToken))
        .send({ toState: 'pending_review' });
      await request(app)
        .post(`/api/articles/${article.id}/transition`)
        .set(authHeader(admin.accessToken))
        .send({ toState: 'published' });

      const user = await registerUser(app, 'u2@t10.com', 'Pass1234', 'u2', 'user');
      const c1 = await c.commentService.createComment({
        articleId: article.id, content: 'L0', authorId: user.userId,
      });
      const c2 = await c.commentService.replyComment(c1.id, {
        articleId: article.id, content: 'L1', authorId: user.userId,
      });
      const c3 = await c.commentService.replyComment(c2.id, {
        articleId: article.id, content: 'L2', authorId: user.userId,
      });
      const c4 = await c.commentService.replyComment(c3.id, {
        articleId: article.id, content: 'L3', authorId: user.userId,
      });
      // c4.depth = 3, 再回复应抛 60004
      await expect(c.commentService.replyComment(c4.id, {
        articleId: article.id, content: 'L4', authorId: user.userId,
      })).rejects.toThrow();
      try {
        await c.commentService.replyComment(c4.id, {
          articleId: article.id, content: 'L4', authorId: user.userId,
        });
      } catch (e) {
        expect((e as { code: number }).code).toBe(60004);
      }
    });

    it('分页边界（page=1&size=50）→ 200', async () => {
      await createArticle(app, bloggerToken, { title: 'P1', content: 'C' });
      const res = await request(app).get('/api/articles?page=1&size=50');
      expect(res.status).toBe(200);
      expect(res.body.list).toBeDefined();
    });

    it('分页超限（size=101）→ 服务层校验 40003', async () => {
      await createArticle(app, bloggerToken, { title: 'P2', content: 'C' });
      const res = await request(app).get('/api/articles?page=1&size=101');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(40003);
    });
  });
});
