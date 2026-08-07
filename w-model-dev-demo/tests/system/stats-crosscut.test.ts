/**
 * 系统测试 · 统计通知与订阅集成（ST-021~024）
 * ST-021 博主统计面板：文章数/总阅读量/总评论数/近 7 天趋势
 * ST-022 通知三类事件 + 列表分页 + 标记已读
 * ST-023 RSS 合法 XML + 四字段 + 不含草稿
 * ST-024 Webhook 签名校验 + 失败自动重试 ≤3 次 + 失败记录留存
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import {
  createTestEnv,
  seedUser,
  seedArticle,
  seedComment,
  seedNotification,
  login,
  bearer,
  pollUntil,
  startMockServer,
  type TestEnv,
} from './helpers';

const HOUR_MS = 3600000;
const DAY_MS = 86400000;

describe('ST-021 博主统计面板：文章数/总阅读量/总评论数/近 7 天趋势（跨模块集成，REQ-025）', () => {
  it('四项统计与 7 天趋势正确；越权查看他人面板 403', async () => {
    const env = createTestEnv();
    const bloggerA = await seedUser(env.stores, { username: 'st21_blogger_a', email: 'st21a@example.com', role: 'blogger' });
    await seedUser(env.stores, { username: 'st21_blogger_b', email: 'st21b@example.com', role: 'blogger' });
    const reader = await seedUser(env.stores, { username: 'st21_reader', email: 'st21r@example.com' });
    // 博主 A 的 3 篇文章（总阅读 25、总评论 4）
    seedArticle(env.stores, { id: 'A1', authorId: bloggerA.id, title: '文章一', status: 'published' });
    seedArticle(env.stores, { id: 'A2', authorId: bloggerA.id, title: '文章二', status: 'published' });
    seedArticle(env.stores, { id: 'A3', authorId: bloggerA.id, title: '文章三', status: 'draft' });
    for (let i = 0; i < 4; i += 1) {
      seedComment(env.stores, { articleId: 'A1', authorId: reader.id, content: `评论${i}` });
    }
    const now = Date.now();
    // 7 天趋势分布：D1=5、D3=3；窗口外 17 条（总阅读 25 = 趋势内 8 + 窗口外 17）
    for (let i = 0; i < 5; i += 1) {
      seedReading(env, 'A1', now - 6 * DAY_MS + i * HOUR_MS);
    }
    for (let i = 0; i < 3; i += 1) {
      seedReading(env, 'A2', now - 4 * DAY_MS + i * HOUR_MS);
    }
    for (let i = 0; i < 17; i += 1) {
      seedReading(env, 'A1', now - 8 * DAY_MS - i * HOUR_MS);
    }

    const sessionA = await login(env.app, 'st21a@example.com');
    const sessionB = await login(env.app, 'st21b@example.com');

    // 1 博主 A 查看面板：200 + articleCount=3, totalViews=25, totalComments=4
    const stats = await request(env.app).get('/api/blogger/stats').set(bearer(sessionA.token));
    expect(stats.status).toBe(200);
    expect(stats.body.data.articleCount).toBe(3);
    expect(stats.body.data.totalViews).toBe(25);
    expect(stats.body.data.totalComments).toBe(4);

    // 2 断言趋势：7 个时间点与阅读记录分布一致（trend[0]=5、trend[2]=3）
    const trend = stats.body.data.trend as Array<{ date: string; views: number }>;
    expect(trend.length).toBe(7);
    expect(trend[0].views).toBe(5);
    expect(trend[2].views).toBe(3);
    expect(trend.every((point) => point.views >= 0)).toBe(true);

    // 3 面板数据隔离：实现契约——GET /api/blogger/stats 按 token.sub 取本人数据（无"他人面板"路径参数，
    //   requireBlogger 仅校验角色），博主 B 看到的是自己的空面板而非 A 的数据；reader 角色越权 403（IT-023 同契约）
    const other = await request(env.app).get('/api/blogger/stats').set(bearer(sessionB.token));
    expect(other.status).toBe(200);
    expect(other.body.data.articleCount).toBe(0); // B 的面板不包含 A 的统计数据（数据隔离）
    const readerSession = await login(env.app, 'st21r@example.com');
    const readerRes = await request(env.app).get('/api/blogger/stats').set(bearer(readerSession.token));
    expect(readerRes.status).toBe(403);
    expect(readerRes.body.error.code).toBe(40301);
  });
});

/** ST-021 局部辅助：写一条阅读记录（ReadingRecord store 直写，跨模块统计数据源） */
function seedReading(env: TestEnv, articleId: string, at: number): void {
  env.stores.readingRecordStore.add({
    articleId,
    clientIp: `10.21.${Math.floor(Math.random() * 100)}.${Math.floor(Math.random() * 100)}`,
    userId: null,
    viewedAt: new Date(at).toISOString(),
  });
}

describe('ST-022 通知三类事件 + 列表分页 + 标记已读（跨模块集成，REQ-026）', () => {
  it('REPLY/LIKE/NEW_ARTICLE 三类通知齐全；分页正确；标记已读后状态更新', async () => {
    const env = createTestEnv();
    const readerC = await seedUser(env.stores, { username: 'st22_reader_c', email: 'st22c@example.com' });
    await seedUser(env.stores, { username: 'st22_reader_d', email: 'st22d@example.com' });
    const now = Date.now();
    // 注入 12 条未读通知（三类事件混合）+ 3 条已读
    for (let i = 0; i < 12; i += 1) {
      const type = (['REPLY', 'LIKE', 'NEW_ARTICLE'] as const)[i % 3];
      seedNotification(env.stores, {
        id: `N${i + 1}`,
        userId: readerC.id,
        type,
        content: `未读通知${i + 1}`,
        read: false,
        createdAt: new Date(now - i * 60000).toISOString(),
      });
    }
    for (let i = 0; i < 3; i += 1) {
      seedNotification(env.stores, {
        id: `R${i + 1}`,
        userId: readerC.id,
        type: 'REPLY',
        content: `已读通知${i + 1}`,
        read: true,
        createdAt: new Date(now - 20 * 60000 - i * 60000).toISOString(),
      });
    }
    const sessionC = await login(env.app, 'st22c@example.com');

    // 1 拉取通知列表：200 + 10 条，type ∈ {REPLY, LIKE, NEW_ARTICLE}，按 createdAt 降序
    const list = await request(env.app).get('/api/me/notifications').query({ page: 1, pageSize: 10 }).set(bearer(sessionC.token));
    expect(list.status).toBe(200);
    expect(list.body.data.total).toBe(15);
    expect(list.body.data.items.length).toBe(10);
    const types = new Set(list.body.data.items.map((i: { type: string }) => i.type));
    expect(types.has('REPLY')).toBe(true);
    expect(types.has('LIKE')).toBe(true);
    expect(types.has('NEW_ARTICLE')).toBe(true);
    const firstTen = list.body.data.items.map((i: { notificationId: string }) => i.notificationId);
    expect(firstTen[0]).toBe('N1'); // createdAt 降序

    // 2 分页：page=2 → 剩余 5 条
    const page2 = await request(env.app).get('/api/me/notifications').query({ page: 2, pageSize: 10 }).set(bearer(sessionC.token));
    expect(page2.status).toBe(200);
    expect(page2.body.data.items.length).toBe(5);

    // 3 标记已读：200 + 该条 isRead=true
    const mark = await request(env.app).patch('/api/me/notifications/N1/read').set(bearer(sessionC.token));
    expect(mark.status).toBe(200);
    expect(mark.body.data.read).toBe(true);

    // 4 重新拉取（unreadOnly）：已读条目不重复出现于未读区
    const unread = await request(env.app).get('/api/me/notifications').query({ unreadOnly: 'true' }).set(bearer(sessionC.token));
    expect(unread.status).toBe(200);
    expect(unread.body.data.total).toBe(11);
    expect(unread.body.data.items.map((i: { notificationId: string }) => i.notificationId)).not.toContain('N1');
  });
});

describe('ST-023 RSS 合法 XML + 四字段 + 不含草稿（跨模块集成，REQ-027）', () => {
  it('RSS 2.0 合法 XML，item 含 title/link/description/pubDate；草稿/归档不出现', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st23_blogger', email: 'st23b@example.com', role: 'blogger' });
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: 'RSS已发布一', summary: '摘要一', status: 'published' });
    seedArticle(env.stores, { id: 'A2', authorId: blogger.id, title: 'RSS已发布二', summary: '摘要二', status: 'published' });
    seedArticle(env.stores, { id: 'D1', authorId: blogger.id, title: 'RSS草稿文章', status: 'draft' });
    seedArticle(env.stores, { id: 'AR1', authorId: blogger.id, title: 'RSS归档文章', status: 'archived' });

    // 1 拉取 RSS：200 + Content-Type XML
    const rss = await request(env.app).get(`/api/bloggers/${blogger.id}/rss`);
    expect(rss.status).toBe(200);
    expect(rss.headers['content-type']).toContain('application/rss+xml');

    // 2 解析 XML 断言：合法 rss 2.0；item 含四字段
    const xml = rss.text as string;
    expect(xml).toContain('<rss version="2.0">');
    expect(xml).toContain('<channel>');
    expect(xml).toMatch(/<title>.*<\/title>/);
    expect(xml).toMatch(/<link>.*<\/link>/);
    expect(xml).toMatch(/<description>.*<\/description>/);
    expect(xml).toMatch(/<pubDate>.*<\/pubDate>/);

    // 3 断言条目集合：仅含 2 篇已发布；草稿/归档不出现
    expect(xml).toContain('RSS已发布一');
    expect(xml).toContain('RSS已发布二');
    expect(xml).not.toContain('RSS草稿文章');
    expect(xml).not.toContain('RSS归档文章');
  });
});

describe('ST-024 Webhook 签名校验 + 失败自动重试 ≤3 次 + 失败记录留存（跨模块集成，REQ-028/NFR-003）', () => {
  it('失败模式：重试 ≤3 次 + 失败记录（attempts=3/status=failed/lastError 非空）；恢复后投递成功且签名可验', async () => {
    const mock = await startMockServer({ status: 500 });
    try {
      const env = createTestEnv();
      const blogger = await seedUser(env.stores, { username: 'st24_blogger', email: 'st24b@example.com', role: 'blogger' });
      seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '失败重试文章', status: 'draft' });
      seedArticle(env.stores, { id: 'A2', authorId: blogger.id, title: '恢复后文章', status: 'draft' });
      const session = await login(env.app, 'st24b@example.com');

      // 0 配置 Webhook（失败模式）：201 + secret
      const hookRes = await request(env.app)
        .post('/api/me/webhooks')
        .set(bearer(session.token))
        .send({ url: mock.url, events: ['article.published'] });
      expect(hookRes.status).toBe(201);
      const webhookId = hookRes.body.data.webhookId as string;
      const secret = hookRes.body.data.secret as string;

      // 1 发布文章（mock 500）：200 + published（主链路不受回调失败影响）
      const pub1 = await request(env.app).post('/api/articles/A1/publish').set(bearer(session.token));
      expect(pub1.status).toBe(200);
      expect(pub1.body.data.status).toBe('published');

      // 2 断言重试序列：总投递次数 ≤3（3 次尝试后终止）
      await pollUntil(
        () => env.stores.webhookDeliveryStore.listByWebhook(webhookId)[0]?.status,
        (status) => status === 'failed',
        { timeoutMs: 10000, message: '投递记录未在重试完成后置为 failed' },
      );
      expect(mock.count()).toBeGreaterThanOrEqual(1);
      expect(mock.count()).toBeLessThanOrEqual(3);

      // 3 断言失败记录：status=failed, attempts=3, lastError 非空
      const delivery = env.stores.webhookDeliveryStore.listByWebhook(webhookId)[0];
      expect(delivery.status).toBe('failed');
      expect(delivery.attempts).toBe(3);
      expect(delivery.lastError).toBeTruthy();

      // 4 mock 恢复 200 后发布新文章：投递成功，签名 header 校验通过
      // 先删除指向失败 mock 的旧配置（DELETE /api/me/webhooks/:id），避免后续发布对已关闭目标的重试投递
      const delHook = await request(env.app).delete(`/api/me/webhooks/${webhookId}`).set(bearer(session.token));
      expect(delHook.status).toBe(204);
      const mockOk = await startMockServer({ status: 200 });
      try {
        // 更新 webhook url 指向可用 mock（重建配置；原配置删除避免残留）
        const hook2 = await request(env.app)
          .post('/api/me/webhooks')
          .set(bearer(session.token))
          .send({ url: mockOk.url, events: ['article.published'] });
        const webhookId2 = hook2.body.data.webhookId as string;
        const secret2 = hook2.body.data.secret as string;
        const pub2 = await request(env.app).post('/api/articles/A2/publish').set(bearer(session.token));
        expect(pub2.status).toBe(200);
        await pollUntil(() => mockOk.count(), (count) => count >= 1, { timeoutMs: 5000, message: '恢复后回调未收到' });
        const received = mockOk.requests[0];
        expect(received.event).toBe('article.published');
        const expected = createHmac('sha256', secret2).update(received.body).digest('hex');
        expect(received.headers['x-blog-signature']).toBe(expected);
        await pollUntil(
          () => env.stores.webhookDeliveryStore.listByWebhook(webhookId2)[0]?.status,
          (status) => status === 'delivered',
          { timeoutMs: 5000, message: '恢复后投递未达 delivered' },
        );
        expect(env.stores.webhookDeliveryStore.listByWebhook(webhookId2)[0].attempts).toBe(1);
      } finally {
        await mockOk.close();
      }
    } finally {
      await mock.close();
    }
  }, 25000);
});
