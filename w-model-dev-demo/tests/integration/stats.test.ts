/**
 * 集成测试 · 统计通知域（INTF-019/020，REQ-025/026）
 * IT-023 博主统计面板：跨模块聚合（文章/阅读/评论）
 * IT-024 通知列表分页 + 标记已读 + 他人通知 404（防枚举）
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestEnv, seedUser, seedArticle, seedComment, seedNotification, login, bearer, type TestEnv } from './helpers';

const HOUR_MS = 3600000;
const DAY_MS = 86400000;

describe('IT-023 博主统计面板：跨模块聚合（文章/阅读/评论）', () => {
  it('面板四指标跨模块聚合正确；reader 越权 403；未认证 401', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'it23_blogger', email: 'it23b@example.com', role: 'blogger' });
    await seedUser(env.stores, { username: 'it23_reader', email: 'it23r@example.com' });
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '文章一', status: 'published' });
    seedArticle(env.stores, { id: 'A2', authorId: blogger.id, title: '文章二', status: 'published' });

    // 3 条评论
    const readerUser = (await env.stores.userStore.findByEmail('it23r@example.com'))!;
    seedComment(env.stores, { articleId: 'A1', authorId: readerUser.id, content: '评论一' });
    seedComment(env.stores, { articleId: 'A1', authorId: readerUser.id, content: '评论二' });
    seedComment(env.stores, { articleId: 'A2', authorId: readerUser.id, content: '评论三' });

    // 阅读记录：总 15 条（趋势窗口内 D1=5、D3=3；8 天前 7 条不计入趋势但计入 totalViews）
    const now = Date.now();
    for (let i = 0; i < 5; i += 1) {
      seedReading(env, 'A1', now - 6 * DAY_MS + i * HOUR_MS);
    }
    for (let i = 0; i < 3; i += 1) {
      seedReading(env, 'A2', now - 4 * DAY_MS + i * HOUR_MS);
    }
    for (let i = 0; i < 7; i += 1) {
      seedReading(env, 'A1', now - 8 * DAY_MS + i * HOUR_MS);
    }

    const bloggerSession = await login(env.app, 'it23b@example.com');
    const readerSession = await login(env.app, 'it23r@example.com');

    // 1 博主查面板：200 + articleCount=2, totalViews=15, totalComments=3
    const stats = await request(env.app).get('/api/blogger/stats').set(bearer(bloggerSession.token));
    expect(stats.status).toBe(200);
    expect(stats.body.data.articleCount).toBe(2);
    expect(stats.body.data.totalViews).toBe(15);
    expect(stats.body.data.totalComments).toBe(3);

    // 2 趋势断言：7 项数组；trend[0]=5、trend[2]=3、无记录日补 0
    const trend = stats.body.data.trend as Array<{ date: string; views: number }>;
    expect(trend.length).toBe(7);
    expect(trend[0].views).toBe(5);
    expect(trend[2].views).toBe(3);
    expect(trend.every((point) => point.views >= 0)).toBe(true);

    // 3 reader 越权：403 + error.code=40301
    const readerRes = await request(env.app).get('/api/blogger/stats').set(bearer(readerSession.token));
    expect(readerRes.status).toBe(403);
    expect(readerRes.body.error.code).toBe(40301);

    // 4 未认证：401 + error.code=40101
    const noAuth = await request(env.app).get('/api/blogger/stats');
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.error.code).toBe(40101);
  });
});

/** IT-023 局部辅助：写一条阅读记录（ReadingRecord store 直写，跨模块统计数据源） */
function seedReading(env: TestEnv, articleId: string, at: number): void {
  env.stores.readingRecordStore.add({
    articleId,
    clientIp: `10.8.${Math.floor(Math.random() * 100)}.${Math.floor(Math.random() * 100)}`,
    userId: null,
    viewedAt: new Date(at).toISOString(),
  });
}

describe('IT-024 通知列表分页 + 标记已读 + 他人通知 404（防枚举）', () => {
  it('列表按 createdAt 降序分页；unreadOnly 过滤；已读更新；他人通知 40401', async () => {
    const env = createTestEnv();
    const readerC = await seedUser(env.stores, { username: 'it24_reader_c', email: 'it24c@example.com' });
    await seedUser(env.stores, { username: 'it24_reader_d', email: 'it24d@example.com' });

    const now = Date.now();
    seedNotification(env.stores, { id: 'N1', userId: readerC.id, type: 'LIKE', content: '通知N1', read: false, createdAt: new Date(now).toISOString() });
    seedNotification(env.stores, { id: 'N2', userId: readerC.id, type: 'REPLY', content: '通知N2', read: false, createdAt: new Date(now - 60000).toISOString() });
    seedNotification(env.stores, { id: 'N3', userId: readerC.id, type: 'NEW_ARTICLE', content: '通知N3', read: true, createdAt: new Date(now - 120000).toISOString() });

    const sessionC = await login(env.app, 'it24c@example.com');
    const sessionD = await login(env.app, 'it24d@example.com');

    // 1 列表分页：200 + items 长度 2，按 createdAt 降序，total=3
    const list = await request(env.app).get('/api/me/notifications').query({ page: 1, pageSize: 2 }).set(bearer(sessionC.token));
    expect(list.status).toBe(200);
    expect(list.body.data.total).toBe(3);
    expect(list.body.data.items.length).toBe(2);
    const firstTwo = list.body.data.items.map((item: { notificationId: string }) => item.notificationId);
    expect(firstTwo).toEqual(['N1', 'N2']);

    // 2 未读过滤：200 + 仅 2 条未读
    const unread = await request(env.app).get('/api/me/notifications').query({ unreadOnly: 'true' }).set(bearer(sessionC.token));
    expect(unread.status).toBe(200);
    expect(unread.body.data.total).toBe(2);
    expect(unread.body.data.items.every((item: { read: boolean }) => item.read === false)).toBe(true);

    // 3 标记已读：200 + read=true
    const markRead = await request(env.app).patch('/api/me/notifications/N1/read').set(bearer(sessionC.token));
    expect(markRead.status).toBe(200);
    expect(markRead.body.data.read).toBe(true);

    // 4 他人通知访问：404 + error.code=40401（防枚举）
    const other = await request(env.app).patch('/api/me/notifications/N1/read').set(bearer(sessionD.token));
    expect(other.status).toBe(404);
    expect(other.body.error.code).toBe(40401);
  });
});
