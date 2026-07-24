/**
 * TC-DES-011: 跨模块调用（数据正确传递 + 返回结构符合契约）
 *
 * 验证模块 A→模块 B 调用时数据正确传递：
 * 认证→用户→文章→评论→通知→交叉引用全链路跨子系统协作
 *
 * 覆盖接口：INTF-001→017→004→007→008→009→015→016
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import {
  createTestApp, registerUser, authHeader, createArticle, transitionArticle,
} from '../helpers/api-helper.js';
import type { Express } from 'express';

describe('TC-DES-011: 跨模块调用', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  it('文章发布→交叉引用触发通知→评论触发通知→楼中楼→点赞计数', async () => {
    // 步骤1: 博主 A 创建文章
    const bloggerA = await registerUser(app, 'a@a.com', 'Pass1234', 'bloggerA', 'blogger');
    const articleA = await createArticle(app, bloggerA.accessToken, { title: 'A的文章', content: '内容A' });
    expect(articleA.status).toBe('draft');

    // 步骤2: 博主 A 提交审核
    await transitionArticle(app, bloggerA.accessToken, articleA.id, 'pending_review');

    // 步骤3: 管理员审核通过
    const admin = await registerUser(app, 'admin@a.com', 'Pass1234', 'admin', 'admin');
    await transitionArticle(app, admin.accessToken, articleA.id, 'published');

    // 步骤4: 博主 B 创建文章并添加交叉引用（服务层调用，API 未暴露 cross-ref 路由）
    const bloggerB = await registerUser(app, 'b@b.com', 'Pass1234', 'bloggerB', 'blogger');
    const articleB = await createArticle(app, bloggerB.accessToken, { title: 'B的文章', content: '内容B' });
    await transitionArticle(app, bloggerB.accessToken, articleB.id, 'pending_review');
    await transitionArticle(app, admin.accessToken, articleB.id, 'published');

    const { getContainer } = await import('../../src/container.js');
    const c = getContainer();
    const refResult = await c.crossRefService.addReference(articleB.id, [articleA.id], bloggerB.userId);
    expect(refResult.addedCiteIds).toContain(articleA.id);

    // 步骤5: 验证博主 A 收到引用通知
    const notifRes1 = await request(app)
      .get('/api/notifications')
      .set(authHeader(bloggerA.accessToken));
    expect(notifRes1.status).toBe(200);
    expect(notifRes1.body.list.some((n: { type: string }) => n.type === 'crossref')).toBe(true);

    // 步骤6: 用户 C 评论文章
    const userC = await registerUser(app, 'c@c.com', 'Pass1234', 'userC', 'user');
    const commentRes = await request(app)
      .post('/api/comments')
      .set(authHeader(userC.accessToken))
      .send({ articleId: articleA.id, content: '引用了B的文章' });
    expect(commentRes.status).toBe(201);
    expect(commentRes.body.status).toBe('published');
    expect(commentRes.body.depth).toBe(0);
    const commentId = commentRes.body.id;

    // 步骤7: 验证博主 A 收到评论通知（unreadCount >= 2: crossref + comment）
    const unreadRes = await request(app)
      .get('/api/notifications/unread-count')
      .set(authHeader(bloggerA.accessToken));
    expect(unreadRes.status).toBe(200);
    expect(unreadRes.body.count).toBeGreaterThanOrEqual(2);

    // 步骤8: 用户 C 回复评论（楼中楼，服务层 replyComment）
    const reply = await c.commentService.replyComment(commentId, {
      articleId: articleA.id, content: '回复', authorId: userC.userId,
    });
    expect(reply.depth).toBe(1);
    expect(reply.parentId).toBe(commentId);

    // 步骤9: 用户 C 点赞评论
    const likeRes = await request(app)
      .post(`/api/comments/${commentId}/like`)
      .set(authHeader(userC.accessToken));
    expect(likeRes.status).toBe(204);

    // 步骤10: 验证评论数据结构符合契约
    const commentsRes = await request(app).get(`/api/articles/${articleA.id}/comments`);
    expect(commentsRes.status).toBe(200);
    const c1 = commentsRes.body.list.find((cm: { id: string }) => cm.id === commentId);
    expect(c1).toBeDefined();
    expect(c1.likes).toBe(1);
    expect(c1.likedBy).toContain(userC.userId);
    const c2 = commentsRes.body.list.find((cm: { id: string }) => cm.id === reply.id);
    expect(c2).toBeDefined();
    expect(c2.depth).toBe(1);
    expect(c2.parentId).toBe(commentId);

    // 步骤11: 验证通知数据结构符合契约（含 id/userId/type/title/content/read/createdAt）
    const notifRes2 = await request(app)
      .get('/api/notifications')
      .set(authHeader(bloggerA.accessToken));
    expect(notifRes2.status).toBe(200);
    const n = notifRes2.body.list[0];
    expect(n.id).toBeDefined();
    expect(n.userId).toBeDefined();
    expect(n.type).toBeDefined();
    expect(n.title).toBeDefined();
    expect(n.createdAt).toBeDefined();
    expect(typeof n.read).toBe('boolean');

    // 步骤12: 验证文章评论列表（评论数 ≥ 2: comment + reply）
    // 注：article.stats.comments 不由 CommentService 自动更新，通过评论列表验证
    const articleRes = await request(app).get(`/api/articles/${articleA.id}`);
    expect(articleRes.status).toBe(200);
    expect(articleRes.body.stats).toBeDefined();
    const commentsListRes = await request(app).get(`/api/articles/${articleA.id}/comments`);
    expect(commentsListRes.status).toBe(200);
    expect(commentsListRes.body.list.length).toBeGreaterThanOrEqual(2);
  });

  it('关注关系跨模块传递（关注→通知→粉丝列表）', async () => {
    const blogger = await registerUser(app, 'b@follow.com', 'Pass1234', 'bF', 'blogger');
    const user = await registerUser(app, 'u@follow.com', 'Pass1234', 'uF', 'user');

    // 用户关注博主
    const followRes = await request(app)
      .post(`/api/follow/${blogger.userId}`)
      .set(authHeader(user.accessToken));
    expect(followRes.status).toBe(201);

    // 博主收到关注通知
    const notifRes = await request(app)
      .get('/api/notifications')
      .set(authHeader(blogger.accessToken));
    expect(notifRes.status).toBe(200);
    expect(notifRes.body.list.some((n: { type: string }) => n.type === 'follow')).toBe(true);

    // 粉丝列表包含用户
    const followersRes = await request(app).get(`/api/follow/${blogger.userId}/followers`);
    expect(followersRes.status).toBe(200);
    expect(followersRes.body.list).toContain(user.userId);

    // 用户关注列表包含博主
    const followingRes = await request(app)
      .get('/api/follow/me/following')
      .set(authHeader(user.accessToken));
    expect(followingRes.status).toBe(200);
    expect(followingRes.body.list).toContain(blogger.userId);
  });

  it('WAL 跨模块操作日志传递（注册+文章+转换+评论+关注+引用均写 WAL）', async () => {
    const { getContainer } = await import('../../src/container.js');
    const c = getContainer();

    const bloggerA = await registerUser(app, 'wa@a.com', 'Pass1234', 'wA', 'blogger');
    const articleA = await createArticle(app, bloggerA.accessToken, { title: 'A', content: 'C' });
    await transitionArticle(app, bloggerA.accessToken, articleA.id, 'pending_review');

    const admin = await registerUser(app, 'wa@admin.com', 'Pass1234', 'wAdmin', 'admin');
    await transitionArticle(app, admin.accessToken, articleA.id, 'published');

    const bloggerB = await registerUser(app, 'wb@b.com', 'Pass1234', 'wB', 'blogger');
    const articleB = await createArticle(app, bloggerB.accessToken, { title: 'B', content: 'C' });
    await transitionArticle(app, bloggerB.accessToken, articleB.id, 'pending_review');
    await transitionArticle(app, admin.accessToken, articleB.id, 'published');

    await c.crossRefService.addReference(articleB.id, [articleA.id], bloggerB.userId);

    const user = await registerUser(app, 'wu@u.com', 'Pass1234', 'wU', 'user');
    await request(app)
      .post('/api/comments')
      .set(authHeader(user.accessToken))
      .send({ articleId: articleA.id, content: 'WAL cross' });

    await request(app)
      .post(`/api/follow/${bloggerA.userId}`)
      .set(authHeader(user.accessToken));

    const walLog = c.walWriter.getLog();
    const opTypes = walLog.map(op => op.opType);
    expect(opTypes).toContain('user.register');
    expect(opTypes).toContain('article.create');
    expect(opTypes).toContain('article.transition');
    expect(opTypes).toContain('crossref.add');
    expect(opTypes).toContain('comment.create');
    expect(opTypes).toContain('follow.create');
  });
});
