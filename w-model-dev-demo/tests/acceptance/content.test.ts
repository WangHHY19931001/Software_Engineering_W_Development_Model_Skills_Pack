/**
 * 验收测试 - 内容管理模块（11 用例）
 * 覆盖 UAT: 005, 007, 008, 009, 017, 028, 030, 031, 032, 041, 042
 * 关联需求: REQ-005, REQ-007, REQ-008, REQ-009, REQ-017
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
  createArticle,
  createPublishedArticle,
  type AcceptanceTestContext,
} from './helpers.js';

describe('验收测试 - 内容管理模块（11 用例）', () => {
  let ctx: AcceptanceTestContext;
  let app: Express;

  beforeEach(() => {
    ctx = createTestContext();
    app = ctx.app;
  });

  // ==================== UAT-005 文章创建正常流程（REQ-005） ====================
  it('UAT-005: author 创建文章 → 201 含 articleId', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const res = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ title: '测试标题', content: '测试正文', tagIds: [], categoryId: null });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.title).toBe('测试标题');
    expect(res.body.status).toBe('draft');
  });

  // ==================== UAT-028 文章创建标题为空（REQ-005 异常） ====================
  it('UAT-028: title 空字符串 → 400 VALIDATION_ERROR', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const res = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ title: '', content: '正文', tagIds: [], categoryId: null });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // ==================== UAT-007 文章详情查询（REQ-007） ====================
  it('UAT-007: 按 ID 查询文章详情 → 200 含完整字段', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const articleId = await createPublishedArticle(app, author.token, '详情测试', '正文内容');
    const res = await request(app).get(`/api/articles/${articleId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(articleId);
    expect(res.body.title).toBe('详情测试');
    expect(res.body.content).toBe('正文内容');
    expect(res.body.authorId).toBeTruthy();
    expect(res.body.status).toBe('published');
    expect(res.body.createdAt).toBeTruthy();
  });

  // ==================== UAT-030 文章详情 ID 不存在（REQ-007 异常） ====================
  it('UAT-030: 查询不存在文章 ID → 404 NOT_FOUND_ERROR', async () => {
    const res = await request(app).get('/api/articles/non-existent-id');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND_ERROR');
  });

  // ==================== UAT-008 文章更新权限校验（REQ-008） ====================
  it('UAT-008: 文章更新权限（非作者 403 / 作者 200 / admin 200）', async () => {
    const authorA = await registerAndLogin(app, 'a@b.com', 'author');
    const authorB = await registerAndLogin(app, 'b@b.com', 'author');
    const admin = await registerAndLogin(app, 'admin@b.com', 'admin');
    const articleId = await createPublishedArticle(app, authorA.token);

    // author B 更新 A 的文章 → 403
    const bRes = await request(app)
      .put(`/api/articles/${articleId}`)
      .set('Authorization', `Bearer ${authorB.token}`)
      .send({ title: 'B 改的标题' });
    expect(bRes.status).toBe(403);
    expect(bRes.body.error.code).toBe('AUTHORIZATION_ERROR');

    // author A 更新自己的文章 → 200
    const aRes = await request(app)
      .put(`/api/articles/${articleId}`)
      .set('Authorization', `Bearer ${authorA.token}`)
      .send({ title: 'A 改的标题' });
    expect(aRes.status).toBe(200);
    expect(aRes.body.title).toBe('A 改的标题');

    // admin 更新他人文章 → 200
    const adminRes = await request(app)
      .put(`/api/articles/${articleId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'admin 改的标题' });
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.title).toBe('admin 改的标题');
  });

  // ==================== UAT-031 更新不存在的文章（REQ-008 异常） ====================
  it('UAT-031: 更新不存在文章 → 404 NOT_FOUND_ERROR', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const res = await request(app)
      .put('/api/articles/non-existent-id')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ title: '新标题' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND_ERROR');
  });

  // ==================== UAT-009 文章删除权限校验（REQ-009） ====================
  it('UAT-009: 文章删除权限（非作者 403 / 作者 204 / 删除后查询 404）', async () => {
    const authorA = await registerAndLogin(app, 'a@b.com', 'author');
    const authorB = await registerAndLogin(app, 'b@b.com', 'author');
    const articleId = await createPublishedArticle(app, authorA.token);

    // author B 删除 A 的文章 → 403
    const bRes = await request(app)
      .delete(`/api/articles/${articleId}`)
      .set('Authorization', `Bearer ${authorB.token}`);
    expect(bRes.status).toBe(403);
    expect(bRes.body.error.code).toBe('AUTHORIZATION_ERROR');

    // author A 删除自己的文章 → 204
    const aRes = await request(app)
      .delete(`/api/articles/${articleId}`)
      .set('Authorization', `Bearer ${authorA.token}`);
    expect(aRes.status).toBe(204);

    // 删除后查询 → 404
    const getRes = await request(app).get(`/api/articles/${articleId}`);
    expect(getRes.status).toBe(404);
  });

  // ==================== UAT-032 删除文章后查询 404（REQ-009 边界） ====================
  it('UAT-032: 删除后再次删除/查询 → 404', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const articleId = await createPublishedArticle(app, author.token);

    // 首次删除 → 204
    const del1 = await request(app)
      .delete(`/api/articles/${articleId}`)
      .set('Authorization', `Bearer ${author.token}`);
    expect(del1.status).toBe(204);

    // 再次删除 → 404
    const del2 = await request(app)
      .delete(`/api/articles/${articleId}`)
      .set('Authorization', `Bearer ${author.token}`);
    expect(del2.status).toBe(404);
    expect(del2.body.error.code).toBe('NOT_FOUND_ERROR');

    // 查询 → 404
    const getRes = await request(app).get(`/api/articles/${articleId}`);
    expect(getRes.status).toBe(404);
  });

  // ==================== UAT-017 草稿/发布工作流（REQ-017） ====================
  it('UAT-017: 草稿→发布→取消发布的状态转换', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');

    // 1. 创建文章（默认 draft）
    const articleId = await createArticle(app, author.token, {
      title: '工作流测试',
      content: '内容',
    });

    // 2. GET /api/articles?status=published → 不含 draft 文章
    const listBefore = await request(app).get('/api/articles?status=published');
    expect(listBefore.status).toBe(200);
    expect(listBefore.body.items.find((a: { id: string }) => a.id === articleId)).toBeUndefined();

    // 3. 发布 → 200 status=published
    const pubRes = await request(app)
      .post(`/api/articles/${articleId}/workflow`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ action: 'publish' });
    expect(pubRes.status).toBe(200);
    expect(pubRes.body.status).toBe('published');
    expect(pubRes.body.publishedAt).toBeTruthy();

    // 4. GET /api/articles?status=published → 含该文章
    const listAfter = await request(app).get('/api/articles?status=published');
    expect(listAfter.status).toBe(200);
    expect(listAfter.body.items.find((a: { id: string }) => a.id === articleId)).toBeTruthy();

    // 5. 取消发布 → 200 status=draft
    const unpubRes = await request(app)
      .post(`/api/articles/${articleId}/workflow`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ action: 'unpublish' });
    expect(unpubRes.status).toBe(200);
    expect(unpubRes.body.status).toBe('draft');

    // 6. GET /api/articles?status=published → 不含该文章
    const listFinal = await request(app).get('/api/articles?status=published');
    expect(listFinal.status).toBe(200);
    expect(listFinal.body.items.find((a: { id: string }) => a.id === articleId)).toBeUndefined();
  });

  // ==================== UAT-041 reader 发布文章被拒（REQ-017 异常） ====================
  it('UAT-041: reader 角色调用发布工作流 → 403 AUTHORIZATION_ERROR', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const reader = await registerAndLogin(app, 'reader@b.com', 'reader');
    const articleId = await createArticle(app, author.token, { title: 't', content: 'c' });

    const res = await request(app)
      .post(`/api/articles/${articleId}/workflow`)
      .set('Authorization', `Bearer ${reader.token}`)
      .send({ action: 'publish' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
  });

  // ==================== UAT-042 发布不存在的文章（REQ-017 边界） ====================
  it('UAT-042: 对不存在文章执行工作流 → 404 NOT_FOUND_ERROR', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const res = await request(app)
      .post('/api/articles/non-existent-id/workflow')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ action: 'publish' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND_ERROR');
  });
});
