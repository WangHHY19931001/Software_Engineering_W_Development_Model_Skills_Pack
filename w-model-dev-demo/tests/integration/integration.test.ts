/**
 * 集成测试 · 订阅集成域（INTF-021/022，REQ-027/028，NFR-003）
 * IT-006 发布→Webhook 回调成功（HMAC 验签）（跨模块事件）
 * IT-007 Webhook 回调失败自动重试 ≤3 次并留存失败记录（NFR-003 异常路径）
 * IT-008 评论→Webhook comment.created 事件分发（跨模块事件）
 * IT-025 RSS 只含已发布文章（跨模块）
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import { createTestEnv, seedUser, seedArticle, login, bearer, startMockServer, pollUntil } from './helpers';

describe('IT-006 发布→Webhook 回调成功（HMAC 验签）（跨模块事件）', () => {
  it('配置 webhook → 发布草稿 → mock 回调收到事件且签名有效 → 投递记录 success/attempts=1', async () => {
    const mock = await startMockServer({ status: 200 });
    try {
      const env = createTestEnv();
      const blogger = await seedUser(env.stores, { username: 'it6_blogger', email: 'it6@example.com', role: 'blogger' });
      seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '待发布草稿', status: 'draft' });
      const session = await login(env.app, 'it6@example.com');

      // 1 配置 Webhook：201 + 返回 webhookId 与 secret
      const hookRes = await request(env.app)
        .post('/api/me/webhooks')
        .set(bearer(session.token))
        .send({ url: mock.url, events: ['article.published'] });
      expect(hookRes.status).toBe(201);
      const webhookId = hookRes.body.data.webhookId as string;
      const secret = hookRes.body.data.secret as string;
      expect(typeof secret).toBe('string');

      // 2 发布草稿：200 + published
      const pubRes = await request(env.app).post('/api/articles/A1/publish').set(bearer(session.token));
      expect(pubRes.status).toBe(200);
      expect(pubRes.body.data.status).toBe('published');

      // 3 断言 mock 回调：收到 1 次；X-Blog-Event 正确；HMAC 重算一致
      await pollUntil(() => mock.count(), (count) => count >= 1, { timeoutMs: 5000, message: 'mock 回调未在 5s 内收到' });
      expect(mock.count()).toBe(1);
      const received = mock.requests[0];
      expect(received.event).toBe('article.published');
      const expectedSignature = createHmac('sha256', secret).update(received.body).digest('hex');
      expect(received.headers['x-blog-signature']).toBe(expectedSignature);
      expect(received.headers['x-blog-timestamp']).toBeTruthy();

      // 4 断言投递记录（seam-STORE）：状态=delivered，attempts=1
      await pollUntil(
        () => env.stores.webhookDeliveryStore.listByWebhook(webhookId)[0]?.status,
        (status) => status === 'delivered',
        { timeoutMs: 5000, message: '投递记录未达 delivered' },
      );
      const delivery = env.stores.webhookDeliveryStore.listByWebhook(webhookId)[0];
      expect(delivery.attempts).toBe(1);
    } finally {
      await mock.close();
    }
  }, 15000);
});

describe('IT-007 Webhook 回调失败自动重试 ≤3 次并留存失败记录（NFR-003 异常路径）', () => {
  it('回调永远失败 → 重试 ≤3 次 → 投递记录 failed/attempts=3/lastError 非空；发布主链路不受影响', async () => {
    const mock = await startMockServer({ status: 500 });
    try {
      const env = createTestEnv();
      const blogger = await seedUser(env.stores, { username: 'it7_blogger', email: 'it7@example.com', role: 'blogger' });
      seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '失败重试草稿', status: 'draft' });
      const session = await login(env.app, 'it7@example.com');

      const hookRes = await request(env.app)
        .post('/api/me/webhooks')
        .set(bearer(session.token))
        .send({ url: mock.url, events: ['article.published'] });
      expect(hookRes.status).toBe(201);
      const webhookId = hookRes.body.data.webhookId as string;

      // 1 发布草稿：200 + published（同步主链路不受回调失败影响）
      const pubRes = await request(env.app).post('/api/articles/A1/publish').set(bearer(session.token));
      expect(pubRes.status).toBe(200);
      expect(pubRes.body.data.status).toBe('published');

      // 2 等待重试完成：mock 收到 ≥1 且 ≤3 次回调（指数退避 500ms/1000ms）
      await pollUntil(
        () => env.stores.webhookDeliveryStore.listByWebhook(webhookId)[0]?.status,
        (status) => status === 'failed',
        { timeoutMs: 10000, message: '投递记录未在重试完成后置为 failed' },
      );
      expect(mock.count()).toBeGreaterThanOrEqual(1);
      expect(mock.count()).toBeLessThanOrEqual(3);

      // 3 断言投递记录：状态=failed，attempts=3，lastError 记录原因
      const delivery = env.stores.webhookDeliveryStore.listByWebhook(webhookId)[0];
      expect(delivery.status).toBe('failed');
      expect(delivery.attempts).toBe(3);
      expect(delivery.lastError).toBeTruthy();
    } finally {
      await mock.close();
    }
  }, 20000);
});

describe('IT-008 评论→Webhook comment.created 事件分发（跨模块事件）', () => {
  it('博主配置 comment.created → 读者评论 → mock 回调收到事件且载荷含 commentId/articleId', async () => {
    const mock = await startMockServer({ status: 200 });
    try {
      const env = createTestEnv();
      const blogger = await seedUser(env.stores, { username: 'it8_blogger', email: 'it8b@example.com', role: 'blogger' });
      await seedUser(env.stores, { username: 'it8_reader', email: 'it8r@example.com' });
      seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '评论事件文章', status: 'published' });
      const bloggerSession = await login(env.app, 'it8b@example.com');
      const readerSession = await login(env.app, 'it8r@example.com');

      // 1 配置 Webhook（events=[comment.created]）：201
      const hookRes = await request(env.app)
        .post('/api/me/webhooks')
        .set(bearer(bloggerSession.token))
        .send({ url: mock.url, events: ['comment.created'] });
      expect(hookRes.status).toBe(201);
      const webhookId = hookRes.body.data.webhookId as string;

      // 2 读者发表评论：201 + 评论立即可见
      const commentRes = await request(env.app)
        .post('/api/articles/A1/comments')
        .set(bearer(readerSession.token))
        .send({ content: '触发事件' });
      expect(commentRes.status).toBe(201);

      // 3 断言 mock 回调：X-Blog-Event=comment.created，body 含 commentId/articleId
      await pollUntil(() => mock.count(), (count) => count >= 1, { timeoutMs: 5000, message: 'comment.created 回调未收到' });
      const received = mock.requests[0];
      expect(received.event).toBe('comment.created');
      const payload = JSON.parse(received.body) as { commentId?: string; articleId?: string; content?: string };
      expect(payload.commentId).toBe(commentRes.body.data.commentId);
      expect(payload.articleId).toBe('A1');

      await pollUntil(
        () => env.stores.webhookDeliveryStore.listByWebhook(webhookId)[0]?.status,
        (status) => status === 'delivered',
        { timeoutMs: 5000, message: 'comment.created 投递未达 delivered' },
      );
    } finally {
      await mock.close();
    }
  }, 15000);
});

describe('IT-025 RSS 只含已发布文章（跨模块）', () => {
  it('RSS 2.0 仅含 published；草稿/归档不暴露；博主不存在/非博主 40401', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'it25_blogger', email: 'it25b@example.com', role: 'blogger' });
    const reader = await seedUser(env.stores, { username: 'it25_reader', email: 'it25r@example.com' });
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: 'RSS已发布文章', status: 'published' });
    seedArticle(env.stores, { id: 'A2', authorId: blogger.id, title: 'RSS草稿文章', status: 'draft' });
    seedArticle(env.stores, { id: 'A3', authorId: blogger.id, title: 'RSS归档文章', status: 'archived' });

    // 1 拉取 RSS：200 + Content-Type application/rss+xml
    const rss = await request(env.app).get(`/api/bloggers/${blogger.id}/rss`);
    expect(rss.status).toBe(200);
    expect(rss.headers['content-type']).toContain('application/rss+xml');

    // 2 断言 XML 内容：channel.title=博主名；items 仅 A1（无 A2/A3）
    const xml = rss.text as string;
    expect(xml).toContain('<rss version="2.0">');
    expect(xml).toContain(`<title>${blogger.username} 的博客</title>`);
    expect(xml).toContain('RSS已发布文章');
    expect(xml).not.toContain('RSS草稿文章');
    expect(xml).not.toContain('RSS归档文章');

    // 3 拉取不存在博主 RSS：404 + error.code=40401
    const ghost = await request(env.app).get('/api/bloggers/u_ghost/rss');
    expect(ghost.status).toBe(404);
    expect(ghost.body.error.code).toBe(40401);

    // 4 拉取非博主 RSS（R 为 reader）：404 + error.code=40401
    const nonBlogger = await request(env.app).get(`/api/bloggers/${reader.id}/rss`);
    expect(nonBlogger.status).toBe(404);
    expect(nonBlogger.body.error.code).toBe(40401);
  });
});
