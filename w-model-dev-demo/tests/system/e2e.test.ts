/**
 * 系统测试 - 端到端业务流测试（3 用例）
 * 对应 docs/system-test-design.md §7：TC-E2E-001 ~ TC-E2E-003
 *
 * 测试方法：
 * - TC-E2E-001: 注册→登录→创建标签→创建分类→创建文章→发布→评论→点赞→RSS 全链路
 * - TC-E2E-002: 创建(draft)→发布→取消发布→更新→删除→评论级联删除
 * - TC-E2E-003: 注册→请求重置→使用令牌重置→旧密码登录失败→新密码登录成功
 *
 * 每步验证状态码 + 数据正确性，确保跨模块数据流贯通。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestContext,
  registerAndLogin,
  createTag,
  createCategory,
  createPublishedArticle,
  type TestContext,
} from './helpers.js';

describe('端到端业务流测试（3 用例）', () => {
  let ctx: TestContext;
  let app: Express;

  beforeEach(() => {
    ctx = createTestContext();
    app = ctx.app;
  });

  // ==================== TC-E2E-001 完整创作流程 ====================
  it('TC-E2E-001: 注册→登录→创建标签→创建分类→创建文章→发布→评论→点赞→RSS 全链路', async () => {
    // 1-2. 注册并登录（registerAndLogin 封装 register + login 两步）
    const admin = await registerAndLogin(app, 'admin@b.com', 'admin');
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const reader = await registerAndLogin(app, 'reader@b.com', 'reader');
    expect(admin.token).toBeTruthy();
    expect(author.token).toBeTruthy();
    expect(reader.token).toBeTruthy();

    // 3. 创建标签（admin only）
    const tagId = await createTag(app, admin.token, 'TypeScript');
    expect(tagId).toBeTruthy();

    // 4. 创建分类
    const categoryId = await createCategory(app, admin.token, 'Frontend');
    expect(categoryId).toBeTruthy();

    // 5. 创建文章（草稿）
    const createRes = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ title: 'E2E Article', content: 'Full flow content', tagIds: [tagId], categoryId, status: 'draft' });
    expect(createRes.status).toBe(201);
    const articleId = createRes.body.id;
    expect(createRes.body.status).toBe('draft');
    expect(createRes.body.tagIds).toEqual([tagId]);
    expect(createRes.body.categoryId).toBe(categoryId);
    expect(createRes.body.publishedAt).toBeNull();

    // 6. 发布文章（workflow: publish）
    const pubRes = await request(app)
      .post(`/api/articles/${articleId}/workflow`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ action: 'publish' });
    expect(pubRes.status).toBe(200);
    expect(pubRes.body.status).toBe('published');
    expect(pubRes.body.publishedAt).toBeTruthy();

    // 7. 评论（reader 在已发布文章下评论）
    const cmtRes = await request(app)
      .post(`/api/articles/${articleId}/comments`)
      .set('Authorization', `Bearer ${reader.token}`)
      .send({ content: 'Great article!' });
    expect(cmtRes.status).toBe(201);
    expect(cmtRes.body.articleId).toBe(articleId);
    expect(cmtRes.body.userId).toBe(reader.id);
    expect(cmtRes.body.content).toBe('Great article!');

    // 8. 点赞
    const likeRes = await request(app)
      .post(`/api/articles/${articleId}/like`)
      .set('Authorization', `Bearer ${reader.token}`);
    expect(likeRes.status).toBe(200);
    expect(likeRes.body.liked).toBe(true);
    expect(likeRes.body.likeCount).toBe(1);

    // 9. RSS 订阅应包含该文章
    const rssRes = await request(app).get('/api/rss');
    expect(rssRes.status).toBe(200);
    expect(rssRes.headers['content-type']).toContain('xml');
    expect(rssRes.text).toContain('E2E Article');
    expect(rssRes.text).toContain(articleId);

    // 验证文章详情：likeCount=1，viewCount>=1（getById 自增浏览）
    const getRes = await request(app).get(`/api/articles/${articleId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.likeCount).toBe(1);
    expect(getRes.body.viewCount).toBeGreaterThanOrEqual(1);

    // 验证评论列表
    const cmtListRes = await request(app).get(`/api/articles/${articleId}/comments`);
    expect(cmtListRes.status).toBe(200);
    expect(cmtListRes.body.total).toBe(1);
    expect(cmtListRes.body.items[0].content).toBe('Great article!');
  });

  // ==================== TC-E2E-002 文章生命周期 ====================
  it('TC-E2E-002: 创建(draft)→发布→取消发布→更新→删除→评论级联删除', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const reader = await registerAndLogin(app, 'reader@b.com', 'reader');

    // 创建草稿
    const createRes = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ title: 'Lifecycle', content: 'Initial', tagIds: [], categoryId: null, status: 'draft' });
    expect(createRes.status).toBe(201);
    const articleId = createRes.body.id;
    expect(createRes.body.status).toBe('draft');
    expect(createRes.body.publishedAt).toBeNull();

    // 发布
    const pubRes = await request(app)
      .post(`/api/articles/${articleId}/workflow`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ action: 'publish' });
    expect(pubRes.status).toBe(200);
    expect(pubRes.body.status).toBe('published');
    expect(pubRes.body.publishedAt).toBeTruthy();

    // 取消发布（published → draft）
    const unpubRes = await request(app)
      .post(`/api/articles/${articleId}/workflow`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ action: 'unpublish' });
    expect(unpubRes.status).toBe(200);
    expect(unpubRes.body.status).toBe('draft');
    expect(unpubRes.body.publishedAt).toBeNull();

    // 重新发布以便评论（评论需要 published 状态）
    await request(app)
      .post(`/api/articles/${articleId}/workflow`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ action: 'publish' });

    // 添加 3 条评论
    for (let i = 0; i < 3; i++) {
      const cmtRes = await request(app)
        .post(`/api/articles/${articleId}/comments`)
        .set('Authorization', `Bearer ${reader.token}`)
        .send({ content: `Comment ${i}` });
      expect(cmtRes.status).toBe(201);
    }

    // 验证评论存在
    const cmtListRes = await request(app).get(`/api/articles/${articleId}/comments`);
    expect(cmtListRes.status).toBe(200);
    expect(cmtListRes.body.total).toBe(3);

    // 更新文章
    const updateRes = await request(app)
      .put(`/api/articles/${articleId}`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ title: 'Updated Lifecycle' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.title).toBe('Updated Lifecycle');

    // 删除文章 → 评论级联删除
    const delRes = await request(app)
      .delete(`/api/articles/${articleId}`)
      .set('Authorization', `Bearer ${author.token}`);
    expect(delRes.status).toBe(204);

    // 文章查询 → 404
    const getRes = await request(app).get(`/api/articles/${articleId}`);
    expect(getRes.status).toBe(404);

    // 评论列表也应 404（文章已删，级联删除评论）
    const cmtListRes2 = await request(app).get(`/api/articles/${articleId}/comments`);
    expect(cmtListRes2.status).toBe(404);
  });

  // ==================== TC-E2E-003 密码重置全流程 ====================
  it('TC-E2E-003: 注册→请求重置→使用令牌重置→旧密码登录失败→新密码登录成功', async () => {
    const email = 'reset@b.com';
    const oldPassword = 'old-password-123';
    const newPassword = 'new-password-456';

    // 1. 注册
    const regRes = await request(app)
      .post('/api/users/register')
      .send({ email, password: oldPassword, role: 'reader' });
    expect(regRes.status).toBe(201);
    const userId = regRes.body.id;
    expect(userId).toBeTruthy();

    // 2. 旧密码登录验证
    const oldLoginRes = await request(app)
      .post('/api/users/login')
      .send({ email, password: oldPassword });
    expect(oldLoginRes.status).toBe(200);

    // 3. 请求密码重置（通过 service 获取 token，模拟邮件投递）
    const resetResult = ctx.services.passwordReset.requestReset(email);
    expect(resetResult.token).toBeTruthy();
    expect(resetResult.expiresAt).toBeTruthy();

    // 4. 使用令牌重置密码
    const resetRes = await request(app)
      .post('/api/users/password-reset')
      .send({ token: resetResult.token, newPassword });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.userId).toBe(userId);
    expect(resetRes.body.message).toContain('重置');

    // 5. 旧密码登录失败 → 401
    const oldLoginAfterRes = await request(app)
      .post('/api/users/login')
      .send({ email, password: oldPassword });
    expect(oldLoginAfterRes.status).toBe(401);
    expect(oldLoginAfterRes.body.error.code).toBe('AUTHENTICATION_ERROR');

    // 6. 新密码登录成功 → 200
    const newLoginRes = await request(app)
      .post('/api/users/login')
      .send({ email, password: newPassword });
    expect(newLoginRes.status).toBe(200);
    expect(newLoginRes.body.token).toBeTruthy();
    expect(newLoginRes.body.user.email).toBe(email);
    expect(newLoginRes.body.user.id).toBe(userId);
  });
});
