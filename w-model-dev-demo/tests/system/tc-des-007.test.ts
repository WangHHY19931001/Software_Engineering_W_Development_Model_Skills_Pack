/**
 * TC-DES-007: 端到端流程（注册→登录→发文→评论→通知全链路）
 *
 * 完整业务链路：用户注册→博主注册→登录→发文→他人评论→原作者收通知，
 * 验证 SD-001→SD-002→SD-003 跨子系统协作 + WAL/审计日志 + 崩溃恢复。
 *
 * 关联需求/设计：REQ-002 / REQ-003 / REQ-010 / REQ-011 / REQ-012 / SD-001~003
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestApp, registerUser, loginUser, authHeader, createArticle, transitionArticle,
} from '../helpers/api-helper.js';

describe('TC-DES-007: 端到端流程', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  it('注册→登录→发文→审核→评论→通知→已读→崩溃恢复全链路', async () => {
    // 步骤1: 博主 B 注册
    const bloggerB = await registerUser(app, 'b@x.com', 'Pass1234', 'BloggerB', 'blogger');
    expect(bloggerB.accessToken).toBeDefined();
    expect(bloggerB.refreshToken).toBeDefined();
    expect(bloggerB.expiresIn).toBe(7200); // 2h

    // 步骤2: 博主 B 登录
    const bloggerBLogin = await loginUser(app, 'b@x.com', 'Pass1234');
    expect(bloggerBLogin.accessToken).toBeDefined();

    // 步骤3: 博主 B 创建文章（草稿）
    const article = await createArticle(app, bloggerB.accessToken, {
      title: 'E2E测试',
      content: '内容',
      summary: '摘要',
    });
    expect(article.status).toBe('draft');
    expect(article.authorId).toBe(bloggerB.userId);

    // 步骤4: 博主 B 提交审核
    const reviewRes = await transitionArticle(app, bloggerB.accessToken, article.id, 'pending_review');
    expect(reviewRes.targetState).toBe('pending_review');

    // 步骤5: 管理员审核通过并立即发布
    const admin = await registerUser(app, 'admin@x.com', 'Pass1234', 'Admin', 'admin');
    const publishRes = await transitionArticle(app, admin.accessToken, article.id, 'published');
    expect(publishRes.targetState).toBe('published');

    // 验证 publishedAt 已设置
    const publishedArticle = await request(app).get(`/api/articles/${article.id}`);
    expect(publishedArticle.status).toBe(200);
    expect(publishedArticle.body.status).toBe('published');
    expect(publishedArticle.body.publishedAt).toBeDefined();

    // 步骤6: 普通用户 A 注册
    const userA = await registerUser(app, 'a@x.com', 'Pass1234', 'UserA', 'user');
    expect(userA.accessToken).toBeDefined();

    // 步骤7: 用户 A 登录
    const userALogin = await loginUser(app, 'a@x.com', 'Pass1234');
    expect(userALogin.accessToken).toBeDefined();

    // 步骤8: 用户 A 评论文章
    const commentRes = await request(app)
      .post('/api/comments')
      .set(authHeader(userA.accessToken))
      .send({ articleId: article.id, content: '好文！' });
    expect(commentRes.status).toBe(201);
    expect(commentRes.body.status).toBe('published');
    expect(commentRes.body.depth).toBe(0);

    // 步骤9: 验证博主 B 收到通知
    const notifRes = await request(app)
      .get('/api/notifications')
      .set(authHeader(bloggerB.accessToken));
    expect(notifRes.status).toBe(200);
    expect(notifRes.body.list.length).toBeGreaterThanOrEqual(1);
    const commentNotif = notifRes.body.list.find((n: { type: string }) => n.type === 'comment');
    expect(commentNotif).toBeDefined();
    expect(commentNotif.read).toBe(false);

    // 步骤10: 验证未读数
    const unreadRes = await request(app)
      .get('/api/notifications/unread-count')
      .set(authHeader(bloggerB.accessToken));
    expect(unreadRes.status).toBe(200);
    expect(unreadRes.body.count).toBeGreaterThanOrEqual(1);

    // 步骤11: 博主 B 标记全部已读
    const readAllRes = await request(app)
      .post('/api/notifications/read-all')
      .set(authHeader(bloggerB.accessToken));
    expect(readAllRes.status).toBe(204);

    // 步骤12: 验证未读数归零
    const unreadAfterRes = await request(app)
      .get('/api/notifications/unread-count')
      .set(authHeader(bloggerB.accessToken));
    expect(unreadAfterRes.status).toBe(200);
    expect(unreadAfterRes.body.count).toBe(0);

    // 步骤13: 验证评论写入 WAL
    const { getContainer } = await import('../../src/container.js');
    const c = getContainer();
    const walLog = c.walWriter.getLog();
    const commentWalOp = walLog.find(op => op.opType === 'comment.create');
    expect(commentWalOp).toBeDefined();
    expect((commentWalOp!.payload as { articleId: string }).articleId).toBe(article.id);

    // 步骤14: 验证敏感操作写审计日志（管理员审核通过 → published）
    const auditEntries = c.auditLogger.query({});
    const transitionAudit = auditEntries.find(
      (e: { action: string; detail?: { to?: string } }) =>
        e.action === 'article.transition' && (e.detail as { to?: string })?.to === 'published',
    );
    expect(transitionAudit).toBeDefined();
    expect((transitionAudit as unknown as { detail: { to: string } }).detail.to).toBe('published');

    // 步骤15: 崩溃恢复 —— WAL 重放后状态一致
    const { WalReplayer } = await import('../../src/infrastructure/wal.js');
    const { userStore } = await import('../../src/stores/user-store.js');
    const { articleStore } = await import('../../src/stores/article-store.js');

    // 记录崩溃前状态
    const preCrashArticle = articleStore.findById(article.id);
    expect(preCrashArticle).toBeDefined();
    expect(preCrashArticle!.status).toBe('published');

    const preCrashUserCount = userStore.list().length;

    // 模拟崩溃：清空 store
    userStore.clear();
    articleStore.clear();
    expect(articleStore.findById(article.id)).toBeNull();

    // WAL 重放
    const replayer = new WalReplayer(c.walWriter, { userStore, articleStore });
    const replayResult = await replayer.replay();
    expect(replayResult.completed).toBe(true);
    expect(replayResult.replayedCount).toBeGreaterThan(0);

    // 验证文章状态恢复
    const recoveredArticle = articleStore.findById(article.id);
    expect(recoveredArticle).toBeDefined();
    expect(recoveredArticle!.title).toBe('E2E测试');
    expect(recoveredArticle!.status).toBe('published');
  });

  it('JWT 签发正确（access 2h / refresh 7d）+ bcrypt 密码哈希存储', async () => {
    const { getContainer } = await import('../../src/container.js');
    const c = getContainer();
    const { userStore } = await import('../../src/stores/user-store.js');

    // 注册
    const user = await registerUser(app, 'jwt@x.com', 'Pass1234', 'JwtUser', 'user');
    expect(user.expiresIn).toBe(7200); // 2h = 7200s

    // 验证密码以 bcrypt 哈希存储
    const storedUser = userStore.findById(user.userId);
    expect(storedUser).toBeDefined();
    expect(storedUser!.passwordHash).not.toBe('Pass1234');
    expect(storedUser!.passwordHash).toMatch(/^\$2[ab]\$\d+\$/); // bcrypt 格式

    // 验证 refresh token 可刷新 access token
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: user.refreshToken });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();
  });

  it('状态机 draft→pending_review→published 转换合法', async () => {
    const blogger = await registerUser(app, 'sm@x.com', 'Pass1234', 'smB', 'blogger');
    const admin = await registerUser(app, 'smadmin@x.com', 'Pass1234', 'smA', 'admin');

    const article = await createArticle(app, blogger.accessToken, { title: '状态机', content: 'C' });
    expect(article.status).toBe('draft');

    // draft → pending_review
    await transitionArticle(app, blogger.accessToken, article.id, 'pending_review');
    let res = await request(app)
      .get(`/api/articles/${article.id}`)
      .set(authHeader(blogger.accessToken));
    expect(res.body.status).toBe('pending_review');

    // pending_review → published（仅 admin）
    await transitionArticle(app, admin.accessToken, article.id, 'published');
    res = await request(app).get(`/api/articles/${article.id}`);
    expect(res.body.status).toBe('published');
  });
});
