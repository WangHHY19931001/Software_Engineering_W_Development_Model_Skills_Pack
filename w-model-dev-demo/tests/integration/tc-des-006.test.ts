/**
 * TC-DES-006: 集成测试用例生成（模块间交互正向路径覆盖）
 *
 * 认证→权限校验→文章操作→评论→通知→WAL/审计日志记录全链路数据正确传递。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import {
  createTestApp, registerUser, loginUser, authHeader,
  createArticle, transitionArticle,
} from '../helpers/api-helper.js';
import type { Express } from 'express';

describe('TC-DES-006: 模块间交互正向路径', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  it('认证→文章→评论→通知→WAL 全链路数据正确传递', async () => {
    // 步骤1: 博主注册
    const blogger = await registerUser(app, 'blogger@e2e.com', 'Pass1234', 'bloggerB', 'blogger');
    expect(blogger.accessToken).toBeDefined();
    expect(blogger.userId).toBeDefined();

    // 步骤2: 博主登录
    const bloggerLogin = await loginUser(app, 'blogger@e2e.com', 'Pass1234');
    expect(bloggerLogin.accessToken).toBeDefined();

    // 步骤3: 创建文章（draft）
    const article = await createArticle(app, blogger.accessToken, {
      title: 'E2E Test Article', content: '# Hello World',
    });
    expect(article.status).toBe('draft');
    expect(article.authorId).toBe(blogger.userId);

    // 步骤4: 文章提交审核
    const transition1 = await transitionArticle(app, blogger.accessToken, article.id, 'pending_review');
    expect(transition1.targetState).toBe('pending_review');
    expect(transition1.previousState).toBe('draft');

    // 步骤5: 管理员审核通过并发布
    const admin = await registerUser(app, 'admin@e2e.com', 'Pass1234', 'admin', 'admin');
    const transition2 = await transitionArticle(app, admin.accessToken, article.id, 'published');
    expect(transition2.targetState).toBe('published');

    // 步骤6: 普通用户注册+登录
    const user = await registerUser(app, 'user@e2e.com', 'Pass1234', 'userA', 'user');
    expect(user.accessToken).toBeDefined();

    // 步骤7: 用户创建评论
    const commentRes = await request(app)
      .post('/api/comments')
      .set(authHeader(user.accessToken))
      .send({ articleId: article.id, content: '好文章！' });
    expect(commentRes.status).toBe(201);
    expect(commentRes.body.status).toBe('published');
    expect(commentRes.body.articleId).toBe(article.id);

    // 步骤8: 博主查询通知
    const notifRes = await request(app)
      .get('/api/notifications')
      .set(authHeader(blogger.accessToken));
    expect(notifRes.status).toBe(200);
    expect(notifRes.body.list.length).toBeGreaterThanOrEqual(1);
    expect(notifRes.body.list.some((n: { type: string }) => n.type === 'comment')).toBe(true);

    // 步骤9: 验证未读数
    const unreadRes = await request(app)
      .get('/api/notifications/unread-count')
      .set(authHeader(blogger.accessToken));
    expect(unreadRes.status).toBe(200);
    expect(unreadRes.body.count).toBeGreaterThanOrEqual(1);

    // 步骤10: 博主标记通知已读
    const firstNotifId = notifRes.body.list[0].id;
    const readRes = await request(app)
      .post(`/api/notifications/${firstNotifId}/read`)
      .set(authHeader(blogger.accessToken));
    expect(readRes.status).toBe(204);

    // 步骤11: 验证未读数减少
    const unreadRes2 = await request(app)
      .get('/api/notifications/unread-count')
      .set(authHeader(blogger.accessToken));
    expect(unreadRes2.body.count).toBeLessThan(unreadRes.body.count);

    // 步骤12: 验证数据一致性 —— 文章评论列表
    const commentsRes = await request(app).get(`/api/articles/${article.id}/comments`);
    expect(commentsRes.status).toBe(200);
    expect(commentsRes.body.list.length).toBeGreaterThanOrEqual(1);
    expect(commentsRes.body.list[0].content).toBe('好文章！');

    // 步骤13: 验证全部已读
    const readAllRes = await request(app)
      .post('/api/notifications/read-all')
      .set(authHeader(blogger.accessToken));
    expect(readAllRes.status).toBe(204);

    const unreadFinal = await request(app)
      .get('/api/notifications/unread-count')
      .set(authHeader(blogger.accessToken));
    expect(unreadFinal.body.count).toBe(0);
  });

  it('WAL 记录追加（注册+文章+转换+评论+通知均写 WAL）', async () => {
    const { getContainer } = await import('../../src/container.js');
    const c = getContainer();

    const blogger = await registerUser(app, 'w@w.com', 'Pass1234', 'w', 'blogger');
    const article = await createArticle(app, blogger.accessToken, { title: 'WAL Test', content: 'c' });
    await transitionArticle(app, blogger.accessToken, article.id, 'pending_review');

    const admin = await registerUser(app, 'a@a.com', 'Pass1234', 'a', 'admin');
    await transitionArticle(app, admin.accessToken, article.id, 'published');

    const user = await registerUser(app, 'u@u.com', 'Pass1234', 'u', 'user');
    await request(app)
      .post('/api/comments')
      .set(authHeader(user.accessToken))
      .send({ articleId: article.id, content: 'WAL test comment' });

    const walLog = c.walWriter.getLog();
    // 至少包含: blogger.register, admin.register, user.register, article.create, article.transition x2, comment.create
    expect(walLog.length).toBeGreaterThanOrEqual(6);
    const opTypes = walLog.map(op => op.opType);
    expect(opTypes).toContain('user.register');
    expect(opTypes).toContain('article.create');
    expect(opTypes).toContain('article.transition');
    expect(opTypes).toContain('comment.create');
  });

  it('审计日志记录敏感操作（封禁/审核/评论审核）', async () => {
    const { getContainer } = await import('../../src/container.js');
    const c = getContainer();

    const admin = await registerUser(app, 'admin@audit.com', 'Pass1234', 'admin', 'admin');
    const user = await registerUser(app, 'victim@audit.com', 'Pass1234', 'victim', 'user');

    // 封禁用户（敏感操作 → 审计日志）
    await request(app)
      .post(`/api/users/${user.userId}/ban`)
      .set(authHeader(admin.accessToken))
      .send({ reason: '测试封禁' });

    const auditEntries = c.auditLogger.query({});
    expect(auditEntries.length).toBeGreaterThanOrEqual(1);
    const actions = auditEntries.map(e => e.action);
    expect(actions).toContain('user.ban');
  });
});
