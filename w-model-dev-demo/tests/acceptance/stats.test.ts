/**
 * 验收测试 · 统计与通知（UAT-047~054，REQ-024~026）
 * 路径映射：docs/uat-path-mapping.md（stats→blogger/stats、notifications→me/notifications 等价映射）。
 * 契约说明：阅读去重窗口参数化（ID-8，INTF-018）；统计字段 articleCount/totalViews/totalComments/trend（INTF-019）；
 * 通知类型 REPLY/LIKE/NEW_ARTICLE（INTF-020），REPLY 对象=文章作者（实现契约，ST-002 §5-2）。
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestEnv, seedUser, seedArticle, seedComment, seedNotification, seedReadingRecord, login, bearer, pollUntil } from './helpers';

const HOUR_MS = 3600000;
const DAY_MS = 86400000;

async function seedBlogger(env: ReturnType<typeof createTestEnv>, username: string, email: string) {
  return seedUser(env.stores, { username, email, role: 'blogger' });
}

describe('UAT-047 文章详情访问阅读量 +1（正常路径，REQ-024）', () => {
  it('首次访问 viewCount=1；去重窗口过期后再次访问 =2', async () => {
    const env = createTestEnv({ readingDedupWindowMs: 200 });
    const blogger = await seedBlogger(env, 'uat47_b', 'uat47@example.com');
    seedArticle(env.stores, { id: 'art47', authorId: blogger.id, title: '阅读统计文', status: 'published' });
    const first = await request(env.app).get('/api/articles/art47');
    expect(first.status).toBe(200);
    expect(first.body.data.viewCount).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const second = await request(env.app).get('/api/articles/art47');
    expect(second.body.data.viewCount).toBe(2);
  });
});

describe('UAT-048 同 IP 短时间窗口重复访问去重（边界路径，REQ-024）', () => {
  it('同一 IP 窗口内连续 3 次访问，viewCount 保持 1（去重）', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat48_b', 'uat48@example.com');
    seedArticle(env.stores, { id: 'art48', authorId: blogger.id, title: '去重目标文', status: 'published' });
    const r1 = await request(env.app).get('/api/articles/art48');
    const r2 = await request(env.app).get('/api/articles/art48');
    const r3 = await request(env.app).get('/api/articles/art48');
    expect(r1.body.data.viewCount).toBe(1);
    expect(r2.body.data.viewCount).toBe(1);
    expect(r3.body.data.viewCount).toBe(1);
    const records = env.stores.readingRecordStore.findAll().filter((r) => r.articleId === 'art48');
    expect(records.length).toBe(1);
  });
});

describe('UAT-049 不同 IP 访问累加计数正确（边界路径，REQ-024）', () => {
  it('不同 IP 阅读记录分别计数（seam-STORE 注入 IP-A/IP-B + 真实请求），去重仅限同 IP 窗口', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat49_b', 'uat49@example.com');
    seedArticle(env.stores, { id: 'art49', authorId: blogger.id, title: '累加目标文', status: 'published' });
    // 环境声明：supertest 直连 app，req.ip 恒为 127.0.0.1（无法模拟多真实客户端 IP，与系统测试一致）；
    // 以 seam-STORE 注入 2 个不同 clientIp 的阅读记录（等价 2 个不同访问者），再经真实请求（127.0.0.1）验证累加。
    const now = new Date().toISOString();
    seedReadingRecord(env.stores, { articleId: 'art49', clientIp: '10.49.0.1', viewedAt: now });
    seedReadingRecord(env.stores, { articleId: 'art49', clientIp: '10.49.0.2', viewedAt: now });
    const detail = await request(env.app).get('/api/articles/art49');
    expect(detail.status).toBe(200);
    expect(detail.body.data.viewCount).toBe(3);
  });
});

describe('UAT-050 博主统计面板核心指标（正常路径，REQ-025）', () => {
  it('articleCount=3、totalViews=10、totalComments=5 与数据一致', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat50_b', 'uat50@example.com');
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '文章1', status: 'published' });
    seedArticle(env.stores, { id: 'A2', authorId: blogger.id, title: '文章2', status: 'published' });
    seedArticle(env.stores, { id: 'A3', authorId: blogger.id, title: '文章3', status: 'draft' });
    const now = Date.now();
    for (let i = 0; i < 10; i += 1) {
      seedReadingRecord(env.stores, { articleId: i % 3 === 0 ? 'A1' : 'A2', clientIp: `10.50.0.${i}`, viewedAt: new Date(now - i * HOUR_MS).toISOString() });
    }
    for (let i = 0; i < 5; i += 1) {
      seedComment(env.stores, { articleId: i % 2 === 0 ? 'A1' : 'A2', authorId: 'u_reader', content: `评论${i}` });
    }
    const session = await login(env.app, 'uat50@example.com');
    const stats = await request(env.app).get('/api/blogger/stats').set(bearer(session.token));
    expect(stats.status).toBe(200);
    expect(stats.body.data.articleCount).toBe(3);
    expect(stats.body.data.totalViews).toBe(10);
    expect(stats.body.data.totalComments).toBe(5);
  });
});

describe('UAT-051 近 7 天阅读趋势（边界路径，REQ-025）', () => {
  it('trend 含 7 个时间点；有阅读日期数值 >0、无阅读日期为 0', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat51_b', 'uat51@example.com');
    seedArticle(env.stores, { id: 'A51', authorId: blogger.id, title: '趋势文章', status: 'published' });
    const now = Date.now();
    seedReadingRecord(env.stores, { articleId: 'A51', clientIp: '10.51.0.1', viewedAt: new Date(now).toISOString() });
    seedReadingRecord(env.stores, { articleId: 'A51', clientIp: '10.51.0.2', viewedAt: new Date(now - 1 * DAY_MS).toISOString() });
    seedReadingRecord(env.stores, { articleId: 'A51', clientIp: '10.51.0.3', viewedAt: new Date(now - 2 * DAY_MS).toISOString() });
    const session = await login(env.app, 'uat51@example.com');
    const stats = await request(env.app).get('/api/blogger/stats').set(bearer(session.token));
    expect(stats.status).toBe(200);
    const trend = stats.body.data.trend as Array<{ date: string; views: number }>;
    expect(trend.length).toBe(7);
    expect(trend.filter((t) => t.views > 0).length).toBe(3);
    expect(trend.filter((t) => t.views === 0).length).toBe(4);
  });
});

describe('UAT-052 三类事件产生通知（正常路径，REQ-026）', () => {
  it('REPLY（文章被评论）/LIKE（文章被点赞）通知博主；NEW_ARTICLE（关注博主发文）通知粉丝', async () => {
    const env = createTestEnv();
    const bloggerA = await seedBlogger(env, 'uat52_a', 'uat52a@example.com');
    const readerU = await seedUser(env.stores, { username: 'uat52_u', email: 'uat52u@example.com' });
    seedArticle(env.stores, { id: 'art52', authorId: bloggerA.id, title: '通知目标文', status: 'published' });
    const sessionU = await login(env.app, 'uat52u@example.com');
    const sessionA = await login(env.app, 'uat52a@example.com');
    // 通知计数辅助（NotificationStore 无 findAll，经 listByUser 快照断言；pageSize ≤ 50）
    const countByType = (userId: string, type: string) =>
      env.stores.notificationStore.listByUser(userId, 1, 50).items.filter((n) => n.type === type).length;

    // 1 REPLY：U 评论 A 的文章 → A 收到 REPLY
    const comment = await request(env.app).post('/api/articles/art52/comments').set(bearer(sessionU.token)).send({ content: '写得好' });
    expect(comment.status).toBe(201);
    await pollUntil(() => countByType(bloggerA.id, 'REPLY'), (n) => n === 1, {
      timeoutMs: 3000,
      message: 'REPLY 通知未产生',
    });

    // 2 LIKE：U 点赞 A 的文章 → A 收到 LIKE（onArticleLiked 异步落盘 → 轮询）
    await request(env.app).post('/api/articles/art52/like').set(bearer(sessionU.token));
    await pollUntil(() => countByType(bloggerA.id, 'LIKE'), (n) => n === 1, {
      timeoutMs: 3000,
      message: 'LIKE 通知未产生',
    });

    // 3 NEW_ARTICLE：U 关注 A；A 发布新文章 → U 收到 NEW_ARTICLE
    await request(env.app).post(`/api/users/${bloggerA.id}/follow`).set(bearer(sessionU.token));
    const create = await request(env.app).post('/api/articles').set(bearer(sessionA.token)).send({ title: '新文章', body: '正文' });
    await request(env.app).post(`/api/articles/${create.body.data.articleId}/publish`).set(bearer(sessionA.token));
    await pollUntil(() => countByType(readerU.id, 'NEW_ARTICLE'), (n) => n === 1, {
      timeoutMs: 3000,
      message: 'NEW_ARTICLE 通知未产生',
    });

    // 断言：A 收到 REPLY + LIKE；U 收到 NEW_ARTICLE
    const listA = await request(env.app).get('/api/me/notifications').set(bearer(sessionA.token));
    const typesA = listA.body.data.items.map((n: { type: string }) => n.type);
    expect(typesA).toContain('REPLY');
    expect(typesA).toContain('LIKE');
    const listU = await request(env.app).get('/api/me/notifications').set(bearer(sessionU.token));
    const typesU = listU.body.data.items.map((n: { type: string }) => n.type);
    expect(typesU).toContain('NEW_ARTICLE');
  }, 20000);
});

describe('UAT-053 通知列表分页（正常路径，REQ-026）', () => {
  it('GET /api/me/notifications 分页：3 条 + total=5，含 read=false 状态字段', async () => {
    const env = createTestEnv();
    const user = await seedUser(env.stores, { username: 'uat53_u', email: 'uat53u@example.com' });
    for (let i = 0; i < 5; i += 1) {
      seedNotification(env.stores, { userId: user.id, type: 'LIKE', content: `通知${i}` });
    }
    const session = await login(env.app, 'uat53u@example.com');
    const page1 = await request(env.app).get('/api/me/notifications').query({ page: 1, pageSize: 3 }).set(bearer(session.token));
    expect(page1.status).toBe(200);
    expect(page1.body.data.items.length).toBe(3);
    expect(page1.body.data.total).toBe(5);
    expect(page1.body.data.items.every((n: { read: boolean }) => n.read === false)).toBe(true);
  });
});

describe('UAT-054 标记通知已读；操作他人通知被拒（异常路径，REQ-026）', () => {
  it('标记自己的通知已读 200 + read=true；标记他人通知 404（防枚举）', async () => {
    const env = createTestEnv();
    const userU = await seedUser(env.stores, { username: 'uat54_u', email: 'uat54u@example.com' });
    await seedUser(env.stores, { username: 'uat54_v', email: 'uat54v@example.com' });
    seedNotification(env.stores, { id: 'ntf-1', userId: userU.id, type: 'LIKE', content: '我的通知' });
    seedNotification(env.stores, { id: 'ntf-v', userId: 'u_other_user', type: 'LIKE', content: '他人通知' });
    const sessionU = await login(env.app, 'uat54u@example.com');
    const mine = await request(env.app).patch('/api/me/notifications/ntf-1/read').set(bearer(sessionU.token));
    expect(mine.status).toBe(200);
    expect(mine.body.data.read).toBe(true);
    const others = await request(env.app).patch('/api/me/notifications/ntf-v/read').set(bearer(sessionU.token));
    expect(others.status).toBe(404);
    expect(others.body.error.code).toBe(40401);
  });
});
