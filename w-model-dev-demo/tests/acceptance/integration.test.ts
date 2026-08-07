/**
 * 验收测试 · 订阅集成（UAT-055~059，REQ-027~028 / NFR-003）
 * 路径映射：docs/uat-path-mapping.md（feeds/:userId/rss→bloggers/:id/rss 等价映射；publish/comments 触发 Webhook 直接映射）。
 * 契约说明：RSS 2.0 XML（Content-Type: application/rss+xml，INTF-021）；Webhook 回调头
 * X-Blog-Signature=HMAC-SHA256(body, secret) / X-Blog-Event / X-Blog-Timestamp，失败重试 ≤3 次（INTF-022）。
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import { createTestEnv, seedUser, seedArticle, startMockServer, login, bearer, pollUntil } from './helpers';

async function seedBlogger(env: ReturnType<typeof createTestEnv>, username: string, email: string) {
  return seedUser(env.stores, { username, email, role: 'blogger' });
}

describe('UAT-055 RSS 源含文章标题/链接/摘要/发布时间（正常路径，REQ-027）', () => {
  it('RSS 为合法 XML（application/rss+xml）且条目含四字段，共 2 条', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat55_b', 'uat55@example.com');
    seedArticle(env.stores, { id: 'rss1', authorId: blogger.id, title: 'RSS 文章一', summary: '摘要一', status: 'published' });
    seedArticle(env.stores, { id: 'rss2', authorId: blogger.id, title: 'RSS 文章二', summary: '摘要二', status: 'published' });
    const res = await request(env.app).get(`/api/bloggers/${blogger.id}/rss`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/rss\+xml|application\/xml|text\/xml/);
    const xml = res.text;
    expect(xml).toContain('<?xml');
    expect(xml).toContain('<item>');
    expect((xml.match(/<item>/g) ?? []).length).toBe(2);
    expect(xml).toContain('<title>');
    expect(xml).toContain('<link>');
    expect(xml).toContain('<description>');
    expect(xml).toContain('<pubDate>');
  });
});

describe('UAT-056 草稿文章不出现在 RSS（边界路径，REQ-027/REQ-012）', () => {
  it('博主有 draft + published 文章，RSS 仅含 published（1 条）', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat56_b', 'uat56@example.com');
    seedArticle(env.stores, { id: 'rss-d', authorId: blogger.id, title: '草稿不出现在 RSS', status: 'draft' });
    seedArticle(env.stores, { id: 'rss-p', authorId: blogger.id, title: '已发布出现', status: 'published' });
    const res = await request(env.app).get(`/api/bloggers/${blogger.id}/rss`);
    expect(res.status).toBe(200);
    const xml = res.text;
    expect((xml.match(/<item>/g) ?? []).length).toBe(1);
    expect(xml).toContain('已发布出现');
    expect(xml).not.toContain('草稿不出现在 RSS');
  });
});

describe('UAT-057 文章发布触发 Webhook 回调且签名可验（正常路径，REQ-028）', () => {
  it('发布后 mock 收到回调（event=article.published，含文章数据）；HMAC 签名可验证', async () => {
    const mock = await startMockServer();
    try {
      const env = createTestEnv();
      const blogger = await seedBlogger(env, 'uat57_b', 'uat57@example.com');
      seedArticle(env.stores, { id: 'wh1', authorId: blogger.id, title: '回调文章', status: 'draft' });
      const session = await login(env.app, 'uat57@example.com');
      const secret = 'uat-shared-secret';
      const cfg = await request(env.app)
        .post('/api/me/webhooks')
        .set(bearer(session.token))
        .send({ url: mock.url, events: ['article.published'], secret });
      expect(cfg.status).toBe(201);
      expect(cfg.body.data.secret).toBe(secret);
      const pub = await request(env.app).post('/api/articles/wh1/publish').set(bearer(session.token));
      expect(pub.status).toBe(200);
      await pollUntil(() => mock.count(), (n) => n >= 1, { timeoutMs: 10000, message: 'Webhook 回调未收到' });
      const received = mock.requests[0];
      expect(received.event).toBe('article.published');
      const body = JSON.parse(received.body);
      expect(body.articleId).toBe('wh1');
      const expectedSig = createHmac('sha256', secret).update(received.body).digest('hex');
      expect(received.headers['x-blog-signature']).toBe(expectedSig);
      expect(received.headers['x-blog-timestamp']).toBeTruthy();
    } finally {
      await mock.close();
    }
  }, 30000);
});

describe('UAT-058 Webhook 回调失败自动重试 3 次（异常路径，REQ-028/NFR-003）', () => {
  it('目标恒 500：mock 收到 ≤3 次回调（含首次共 3 次）；失败记录 attempts=3/status=failed', async () => {
    const mock = await startMockServer({ status: 500 });
    try {
      const env = createTestEnv();
      const blogger = await seedBlogger(env, 'uat58_b', 'uat58@example.com');
      seedArticle(env.stores, { id: 'wh2', authorId: blogger.id, title: '重试文章', status: 'draft' });
      const session = await login(env.app, 'uat58@example.com');
      const cfgRes = await request(env.app)
        .post('/api/me/webhooks')
        .set(bearer(session.token))
        .send({ url: mock.url, events: ['article.published'] });
      expect(cfgRes.status).toBe(201);
      const pub = await request(env.app).post('/api/articles/wh2/publish').set(bearer(session.token));
      expect(pub.status).toBe(200); // 主流程不被异步投递失败阻塞
      await pollUntil(() => mock.count(), (n) => n >= 3, { timeoutMs: 15000, message: '重试 3 次未完成' });
      expect(mock.count()).toBe(3);
      const delivery = env.stores.webhookDeliveryStore.listByWebhook(cfgRes.body.data.webhookId).find((d) => d.event === 'article.published');
      expect(delivery).toBeDefined();
      await pollUntil(() => env.stores.webhookDeliveryStore.findById(delivery!.id)?.status, (s) => s === 'failed', {
        timeoutMs: 10000,
        message: '投递最终状态未置 failed',
      });
      expect(env.stores.webhookDeliveryStore.findById(delivery!.id)!.attempts).toBe(3);
      expect(env.stores.webhookDeliveryStore.findById(delivery!.id)!.lastError).toBeTruthy();
    } finally {
      await mock.close();
    }
  }, 30000);
});

describe('UAT-059 评论新增触发 Webhook 回调（正常路径，REQ-028）', () => {
  it('评论后 mock 收到回调 event=comment.created（含评论与文章数据）', async () => {
    const mock = await startMockServer();
    try {
      const env = createTestEnv();
      const blogger = await seedBlogger(env, 'uat59_b', 'uat59@example.com');
      seedArticle(env.stores, { id: 'wh3', authorId: blogger.id, title: '评论回调文', status: 'published' });
      const reader = await seedUser(env.stores, { username: 'uat59_u', email: 'uat59u@example.com' });
      const sessionB = await login(env.app, 'uat59@example.com');
      await request(env.app)
        .post('/api/me/webhooks')
        .set(bearer(sessionB.token))
        .send({ url: mock.url, events: ['comment.created'] });
      const sessionU = await login(env.app, 'uat59u@example.com');
      const comment = await request(env.app)
        .post('/api/articles/wh3/comments')
        .set(bearer(sessionU.token))
        .send({ content: '触发回调的评论' });
      expect(comment.status).toBe(201);
      await pollUntil(() => mock.requests.some((r) => r.event === 'comment.created'), (ok) => ok, {
        timeoutMs: 10000,
        message: 'comment.created 回调未收到',
      });
      const received = mock.requests.find((r) => r.event === 'comment.created')!;
      const body = JSON.parse(received.body);
      expect(body.articleId).toBe('wh3');
      expect(body.commentId).toBeTruthy();
      expect(body.content).toBe('触发回调的评论');
      expect(reader.id).toBeTruthy();
    } finally {
      await mock.close();
    }
  }, 30000);
});
