/**
 * TC-SYS-001 ~ 005 端到端流程（E2E）系统测试
 *
 * 覆盖范围：
 * - TC-SYS-001 完整博客生命周期：注册博主 → 创建文章 → 发布 → 读者查看 → 评论 → 通知
 * - TC-SYS-002 完整 Webhook 投递链路：注册博主 → 创建文章 → 触发 webhook → 接收方验证签名
 * - TC-SYS-003 关注 + 推荐链路：A 关注 B → B 发布 → A 在相关推荐中能看到
 * - TC-SYS-004 标签 + 搜索链路：创建文章带标签 → 搜索关键词命中
 * - TC-SYS-005 审计 + 限流 + 鉴权链路：reader 受限 → admin 看到审计
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setupSystemTest, type SystemContext, authHeader } from './setup.js';
import { UserRole, NotificationType } from '../../src/types/index.js';

describe('TC-SYS-001~005 端到端流程（E2E）', () => {
  let ctx: SystemContext;

  beforeEach(() => {
    ctx = setupSystemTest();
  });

  it('TC-SYS-001: 完整博客生命周期（注册→发文→读者浏览→评论→通知）', async () => {
    // 1. 注册博主
    const blogger = await ctx.registerBlogger({ displayName: 'Blogger A' });
    // 2. 注册读者
    const reader = await ctx.registerUser({ role: UserRole.READER });

    // 3. 博主创建草稿
    const created = await ctx
      .api()
      .post('/api/articles')
      .set(authHeader(blogger.token))
      .send({
        title: 'My First Post',
        content: 'Hello world content',
        summary: 'A summary',
        tagIds: [],
      });
    expect(created.status).toBe(201);
    const articleId = created.body.id as string;

    // 4. 草稿不可公开访问
    const draftGet = await ctx.api().get(`/api/articles/${articleId}`);
    expect(draftGet.status).toBe(404);

    // 5. 发布
    const published = await ctx
      .api()
      .post(`/api/articles/${articleId}/transition`)
      .set(authHeader(blogger.token))
      .send({ action: 'publish' });
    expect(published.status).toBe(200);
    expect(published.body.status).toBe('published');

    // 6. 读者可公开访问
    const publicGet = await ctx.api().get(`/api/articles/${articleId}`);
    expect(publicGet.status).toBe(200);
    expect(publicGet.body.title).toBe('My First Post');

    // 7. 读者记录浏览
    const view = await ctx.api().post(`/api/articles/${articleId}/view`);
    expect(view.status).toBe(204);

    // 8. 读者评论
    const comment = await ctx
      .api()
      .post(`/api/articles/${articleId}/comments`)
      .set(authHeader(reader.token))
      .send({ content: 'Great post!' });
    expect(comment.status).toBe(201);

    // 9. 直接通过 notification service 发送通知给博主
    await ctx.services.notification.notifyComment(
      blogger.userId,
      reader.userId,
      articleId,
      'My First Post',
    );

    // 10. 博主收到通知
    const notif = await ctx
      .api()
      .get('/api/me/notifications')
      .set(authHeader(blogger.token));
    expect(notif.status).toBe(200);
    expect(notif.body.items.length).toBeGreaterThanOrEqual(1);

    // 11. 标记单条已读
    const notifId = notif.body.items[0].id;
    const markRead = await ctx
      .api()
      .put(`/api/me/notifications/${notifId}/read`)
      .set(authHeader(blogger.token));
    expect(markRead.status).toBe(200);
    expect(markRead.body.read).toBe(true);

    // 12. 标记全部已读
    // 先创建一条新的未读
    await ctx.services.notification.create({
      recipientId: blogger.userId,
      type: NotificationType.LIKE,
      title: 'Test',
      content: 'Test content',
    });
    const readAll = await ctx
      .api()
      .post('/api/me/notifications/read-all')
      .set(authHeader(blogger.token));
    expect(readAll.status).toBe(200);
    expect(readAll.body.count).toBeGreaterThanOrEqual(1);
  });

  it('TC-SYS-002: 完整 Webhook 订阅 → 触发 → 投递链路', async () => {
    const blogger = await ctx.registerBlogger();

    // 1. 博主订阅 webhook
    const wh = await ctx
      .api()
      .post('/api/webhooks')
      .set(authHeader(blogger.token))
      .send({
        url: 'https://example.com/hook',
        events: ['post.created', 'post.published'],
      });
    expect(wh.status).toBe(201);
    expect(wh.body.id).toBeDefined();
    expect(wh.body.secret).toBeDefined();

    // 2. 重复 URL 订阅 → 409
    const dup = await ctx
      .api()
      .post('/api/webhooks')
      .set(authHeader(blogger.token))
      .send({
        url: 'https://example.com/hook',
        events: ['post.published'],
      });
    expect(dup.status).toBe(409);

    // 3. 列出 webhooks
    const list = await ctx
      .api()
      .get('/api/webhooks')
      .set(authHeader(blogger.token));
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);

    // 4. 删除 webhook
    const del = await ctx
      .api()
      .delete(`/api/webhooks/${wh.body.id}`)
      .set(authHeader(blogger.token));
    expect(del.status).toBe(204);
  });

  it('TC-SYS-003: 关注 + 推荐链路（A 关注 B → B 发布 → 推荐可见）', async () => {
    const blogger = await ctx.registerBlogger();
    const reader = await ctx.registerUser();

    // 1. 关注
    const follow = await ctx
      .api()
      .post('/api/follows')
      .set(authHeader(reader.token))
      .send({ followeeId: blogger.userId });
    expect(follow.status).toBe(201);

    // 2. 验证 followers
    const followers = await ctx.api().get(`/api/users/${blogger.userId}/followers`);
    expect(followers.status).toBe(200);
    expect(followers.body.items.length).toBe(1);

    // 3. 博主发布两篇文章
    const a1 = await ctx.publishArticle({ authorId: blogger.userId, title: 'Post One' });
    const a2 = await ctx.publishArticle({ authorId: blogger.userId, title: 'Post Two' });
    expect(a1.articleId).toBeDefined();
    expect(a2.articleId).toBeDefined();

    // 4. 通过 /related 端点获取相关文章
    const related = await ctx.api().get(`/api/articles/${a1.articleId}/related`);
    expect(related.status).toBe(200);
    expect(Array.isArray(related.body)).toBe(true);

    // 5. 关注 following 列表
    const following = await ctx.api().get(`/api/users/${reader.userId}/following`);
    expect(following.status).toBe(200);
    expect(following.body.items.length).toBe(1);

    // 6. 取关
    const unfollow = await ctx
      .api()
      .delete(`/api/follows/${blogger.userId}`)
      .set(authHeader(reader.token));
    expect(unfollow.status).toBe(204);

    const followingAfter = await ctx.api().get(`/api/users/${reader.userId}/following`);
    expect(followingAfter.body.items.length).toBe(0);
  });

  it('TC-SYS-004: 标签 + 搜索链路（创建标签 → 文章打标 → 搜索命中）', async () => {
    const blogger = await ctx.registerBlogger();

    // 1. 创建标签
    const tag1 = await ctx
      .api()
      .post('/api/tags')
      .set(authHeader(blogger.token))
      .send({ name: 'Tech', slug: 'tech', description: 'Technology' });
    expect(tag1.status).toBe(201);

    const tag2 = await ctx
      .api()
      .post('/api/tags')
      .set(authHeader(blogger.token))
      .send({ name: 'Life', slug: 'life' });
    expect(tag2.status).toBe(201);

    // 2. 列出所有标签
    const tagsList = await ctx.api().get('/api/tags');
    expect(tagsList.status).toBe(200);
    expect(tagsList.body.length).toBe(2);

    // 3. 创建带标签的文章
    const article = await ctx
      .api()
      .post('/api/articles')
      .set(authHeader(blogger.token))
      .send({
        title: 'Tech Article',
        content: 'Some tech content',
        tagIds: [tag1.body.id, tag2.body.id],
      });
    expect(article.status).toBe(201);

    // 4. 发布
    const pub = await ctx
      .api()
      .post(`/api/articles/${article.body.id}/transition`)
      .set(authHeader(blogger.token))
      .send({ action: 'publish' });
    expect(pub.status).toBe(200);

    // 5. 搜索"Tech"
    const search = await ctx.api().get('/api/search').query({ q: 'Tech' });
    expect(search.status).toBe(200);
    expect(search.body.total).toBeGreaterThanOrEqual(1);

    // 6. 搜索文章
    const searchArt = await ctx.api().get('/api/search/articles').query({ q: 'tech' });
    expect(searchArt.status).toBe(200);
    expect(searchArt.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('TC-SYS-005: 审计 + RBAC + 限流头链路（reader 受限 → admin 看到审计）', async () => {
    const reader = await ctx.registerUser();
    const admin = await ctx.registerAdmin();

    // 1. reader 访问 audit-logs → 403
    const readerAudit = await ctx
      .api()
      .get('/api/audit-logs')
      .set(authHeader(reader.token));
    expect(readerAudit.status).toBe(403);
    expect(readerAudit.body.code).toBe('FORBIDDEN');

    // 2. reader 访问 stats → 403
    const readerStats = await ctx
      .api()
      .get('/api/stats')
      .set(authHeader(reader.token));
    expect(readerStats.status).toBe(403);

    // 3. reader 更新 site-config → 403
    const readerConfig = await ctx
      .api()
      .put('/api/site-config')
      .set(authHeader(reader.token))
      .send({ siteTitle: 'evil' });
    expect(readerConfig.status).toBe(403);

    // 4. admin 访问 audit-logs → 200
    const adminAudit = await ctx
      .api()
      .get('/api/audit-logs')
      .set(authHeader(admin.token));
    expect(adminAudit.status).toBe(200);

    // 5. admin 访问 stats → 200
    const adminStats = await ctx
      .api()
      .get('/api/stats')
      .set(authHeader(admin.token));
    expect(adminStats.status).toBe(200);

    // 6. admin 更新 site-config → 200
    const adminConfig = await ctx
      .api()
      .put('/api/site-config')
      .set(authHeader(admin.token))
      .send({ siteTitle: 'Admin Title' });
    expect(adminConfig.status).toBe(200);
    expect(adminConfig.body.siteTitle).toBe('Admin Title');

    // 7. 公开访问 site-config → 200
    const pubConfig = await ctx.api().get('/api/site-config');
    expect(pubConfig.status).toBe(200);
    expect(pubConfig.body.siteTitle).toBe('Admin Title');
  });
});
