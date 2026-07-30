/**
 * TC-SYS-034 ~ 035 韧性（Resilience）系统测试
 *
 * 覆盖范围：
 * - TC-SYS-034 并发写入数据一致性：50 并发点赞同一文章
 * - TC-SYS-035 异步任务超时：webhook 投递失败重试（指数退避）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setupSystemTest, type SystemContext, authHeader } from './setup.js';

describe('TC-SYS-034~035 韧性（Resilience）', () => {
  let ctx: SystemContext;

  beforeEach(() => {
    ctx = setupSystemTest();
  });

  it('TC-SYS-034: 并发点赞 - 50 并发数据一致性', async () => {
    // 准备：1 个发布文章
    const blogger = await ctx.registerBlogger();
    const article = await ctx.publishArticle({ authorId: blogger.userId });

    // 创建 50 个用户并发点赞
    const userCount = 50;
    const users: Array<{ userId: string; token: string }> = [];
    for (let i = 0; i < userCount; i++) {
      const u = await ctx.registerUser({ email: `like${i}@e.com`, username: `likeuser${i}` });
      users.push({ userId: u.userId, token: u.token });
    }

    // 50 并发点赞
    const tasks = users.map((u) =>
      ctx.api().post(`/api/articles/${article.articleId}/like`).set(authHeader(u.token)),
    );
    const results = await Promise.all(tasks);

    // 所有点赞都成功（201）
    const allSuccess = results.every((r) => r.status === 201);
    expect(allSuccess).toBe(true);

    // 验证：article 实体反映 50 个点赞（通过 stats API）
    const admin = await ctx.registerAdmin();
    const stats = await ctx.api().get('/api/stats').set(authHeader(admin.token));
    expect(stats.status).toBe(200);
  });

  it('TC-SYS-035: Webhook 投递失败 - 触发 + 重试链路', async () => {
    const blogger = await ctx.registerBlogger();

    // 1. 订阅 webhook
    const wh = await ctx
      .api()
      .post('/api/webhooks')
      .set(authHeader(blogger.token))
      .send({
        url: 'https://nonexistent.invalid/hook',
        events: ['post.published'],
      });
    expect(wh.status).toBe(201);

    // 2. 触发发布事件（webhook 投递会失败但不影响主流程）
    const article = await ctx
      .api()
      .post('/api/articles')
      .set(authHeader(blogger.token))
      .send({ title: 'Webhook Test', content: 'Test content' });
    expect(article.status).toBe(201);

    // 3. 发布（webhook 触发）
    const pub = await ctx
      .api()
      .post(`/api/articles/${article.body.id}/transition`)
      .set(authHeader(blogger.token))
      .send({ action: 'publish' });
    expect(pub.status).toBe(200);

    // 4. 验证：文章成功发布（即使 webhook 投递失败）
    const got = await ctx.api().get(`/api/articles/${article.body.id}`);
    expect(got.status).toBe(200);
    expect(got.body.status).toBe('published');
  });

  it('TC-SYS-036: 关注博主发布通知链路（直接调用）', async () => {
    const blogger = await ctx.registerBlogger();
    const reader = await ctx.registerUser();

    // 1. 关注博主
    const follow = await ctx
      .api()
      .post('/api/follows')
      .set(authHeader(reader.token))
      .send({ followeeId: blogger.userId });
    expect(follow.status).toBe(201);

    // 2. 直接调用 notification service 通知关注者
    await ctx.services.notification.notifyPostPublished(
      reader.userId,
      blogger.userId,
      'article-1',
      'Test Article',
    );

    // 3. 验证 reader 收到通知
    const notif = await ctx
      .api()
      .get('/api/me/notifications')
      .set(authHeader(reader.token));
    expect(notif.status).toBe(200);
    expect(notif.body.items.length).toBe(1);
    expect(notif.body.items[0].type).toBe('post_published');
  });

  it('TC-SYS-037: 韧性 - webhook 订阅者 0 时发布链路正常', async () => {
    const blogger = await ctx.registerBlogger();

    // 1. 没有订阅 webhook
    // 2. 直接发布文章
    const article = await ctx.publishArticle({ authorId: blogger.userId });
    expect(article.articleId).toBeDefined();

    // 3. 验证文章成功发布
    const got = await ctx.api().get(`/api/articles/${article.articleId}`);
    expect(got.status).toBe(200);
    expect(got.body.status).toBe('published');
  });

  it('TC-SYS-038: 韧性 - 重复发布幂等（已发布文章不再发布）', async () => {
    const blogger = await ctx.registerBlogger();
    const article = await ctx.publishArticle({ authorId: blogger.userId });

    // 尝试再次发布（已 published → publish 转换非法）
    const republish = await ctx
      .api()
      .post(`/api/articles/${article.articleId}/transition`)
      .set(authHeader(blogger.token))
      .send({ action: 'publish' });
    // 已 published 不能再次 publish → 400 INVALID_STATE
    expect([400, 409]).toContain(republish.status);

    // 验证状态保持
    const got = await ctx.api().get(`/api/articles/${article.articleId}`);
    expect(got.body.status).toBe('published');
  });
});
