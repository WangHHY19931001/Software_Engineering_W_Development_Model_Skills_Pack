/**
 * 验收测试 - 用户互动模块（9 用例）
 * 覆盖 UAT: 010, 011, 012, 018, 033, 034, 035, 043, 044
 * 关联需求: REQ-010, REQ-011, REQ-012, REQ-018
 *
 * 测试方法：supertest → Express app（seam-http），beforeEach 创建独立 container 数据隔离。
 * 实际 API 路径以 docs/uat-path-mapping.md 回填为准。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestContext,
  registerAndLogin,
  createPublishedArticle,
  createArticle,
  createComment,
  type AcceptanceTestContext,
} from './helpers.js';

describe('验收测试 - 用户互动模块（9 用例）', () => {
  let ctx: AcceptanceTestContext;
  let app: Express;

  beforeEach(() => {
    ctx = createTestContext();
    app = ctx.app;
  });

  // ==================== UAT-010 评论创建正常流程（REQ-010） ====================
  it('UAT-010: 对文章发表评论 → 201 含 commentId', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const reader = await registerAndLogin(app, 'reader@b.com', 'reader');
    const articleId = await createPublishedArticle(app, author.token);

    const res = await request(app)
      .post(`/api/articles/${articleId}/comments`)
      .set('Authorization', `Bearer ${reader.token}`)
      .send({ content: '好文章' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.articleId).toBe(articleId);
    expect(res.body.content).toBe('好文章');
  });

  // ==================== UAT-033 评论内容为空（REQ-010 异常） ====================
  it('UAT-033: content 空字符串 → 400 VALIDATION_ERROR', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const reader = await registerAndLogin(app, 'reader@b.com', 'reader');
    const articleId = await createPublishedArticle(app, author.token);

    const res = await request(app)
      .post(`/api/articles/${articleId}/comments`)
      .set('Authorization', `Bearer ${reader.token}`)
      .send({ content: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // ==================== UAT-011 评论列表查询（REQ-011） ====================
  it('UAT-011: 查询文章评论列表 → 200 数组含 ≥3 条评论', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const reader = await registerAndLogin(app, 'reader@b.com', 'reader');
    const articleId = await createPublishedArticle(app, author.token);

    await createComment(app, reader.token, articleId, '评论 1');
    await createComment(app, reader.token, articleId, '评论 2');
    await createComment(app, reader.token, articleId, '评论 3');

    const res = await request(app).get(`/api/articles/${articleId}/comments`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.items.length).toBe(3);
  });

  // ==================== UAT-034 空评论列表（REQ-011 边界） ====================
  it('UAT-034: 文章无评论时查询 → 200 {items:[], total:0}', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const articleId = await createPublishedArticle(app, author.token);

    const res = await request(app).get(`/api/articles/${articleId}/comments`);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  // ==================== UAT-012 评论删除权限校验（REQ-012） ====================
  it('UAT-012: 评论删除权限（非作者 403 / 作者 204）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const userA = await registerAndLogin(app, 'a@b.com', 'reader');
    const userB = await registerAndLogin(app, 'b@b.com', 'reader');
    const articleId = await createPublishedArticle(app, author.token);
    const commentId = await createComment(app, userA.token, articleId, '我的评论');

    // 用户 B 删除 A 的评论 → 403
    const bRes = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(bRes.status).toBe(403);
    expect(bRes.body.error.code).toBe('AUTHORIZATION_ERROR');

    // 用户 A 删除自己的评论 → 204
    const aRes = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(aRes.status).toBe(204);
  });

  // ==================== UAT-035 删除不存在的评论（REQ-012 异常） ====================
  it('UAT-035: 删除不存在评论 → 404 NOT_FOUND_ERROR', async () => {
    const user = await registerAndLogin(app, 'user@b.com', 'reader');
    const res = await request(app)
      .delete('/api/comments/non-existent-id')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND_ERROR');
  });

  // ==================== UAT-018 文章点赞去重（REQ-018） ====================
  it('UAT-018: 点赞/取消点赞切换，去重计数', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const reader = await registerAndLogin(app, 'reader@b.com', 'reader');
    const articleId = await createPublishedArticle(app, author.token);

    // 1. 点赞 → likeCount=1
    const like1 = await request(app)
      .post(`/api/articles/${articleId}/like`)
      .set('Authorization', `Bearer ${reader.token}`);
    expect(like1.status).toBe(200);
    expect(like1.body.liked).toBe(true);
    expect(like1.body.likeCount).toBe(1);

    // 2. 再次点赞 → 取消，likeCount=0
    const like2 = await request(app)
      .post(`/api/articles/${articleId}/like`)
      .set('Authorization', `Bearer ${reader.token}`);
    expect(like2.status).toBe(200);
    expect(like2.body.liked).toBe(false);
    expect(like2.body.likeCount).toBe(0);
  });

  // ==================== UAT-043 点赞未发布文章被拒（REQ-018 异常） ====================
  it('UAT-043: 对 draft 文章点赞 → 400 VALIDATION_ERROR', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const reader = await registerAndLogin(app, 'reader@b.com', 'reader');
    const articleId = await createArticle(app, author.token, { title: 't', content: 'c' });

    const res = await request(app)
      .post(`/api/articles/${articleId}/like`)
      .set('Authorization', `Bearer ${reader.token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // ==================== UAT-044 多用户点赞计数（REQ-018 边界） ====================
  it('UAT-044: 多用户点赞后 likeCount 正确（1→2→1）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const userA = await registerAndLogin(app, 'a@b.com', 'reader');
    const userB = await registerAndLogin(app, 'b@b.com', 'reader');
    const articleId = await createPublishedArticle(app, author.token);

    // A 点赞 → likeCount=1
    const like1 = await request(app)
      .post(`/api/articles/${articleId}/like`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(like1.body.likeCount).toBe(1);

    // B 点赞 → likeCount=2
    const like2 = await request(app)
      .post(`/api/articles/${articleId}/like`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(like2.body.likeCount).toBe(2);

    // A 取消 → likeCount=1
    const unlike1 = await request(app)
      .post(`/api/articles/${articleId}/like`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(unlike1.body.likeCount).toBe(1);
  });
});
