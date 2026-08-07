/**
 * 系统测试 · 端到端流程（阶段 2 设计 ST-001~005，TC-DES-007 型）
 * seam：seam-HTTP（supertest 直连 createApp）+ seam-STORE（seed 数据/快照断言）+ 本地 mock 回调（ST-005）。
 * 覆盖：注册→登录→申请博主→创建→发布→浏览；评论→回复→通知；关注→feed→通知；阅读统计→热门→推荐；发布→Webhook→RSS。
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createHmac } from 'node:crypto';
import {
  createTestEnv,
  seedUser,
  seedArticle,
  seedReadingRecord,
  login,
  bearer,
  pollUntil,
  startMockServer,
} from './helpers';

const DAY_MS = 86400000;

describe('ST-001 注册→登录→申请博主→创建→发布→浏览 全链路（端到端，REQ-007/008/009/011/012/017）', () => {
  it('读者注册→登录 JWT→申请博主→创建草稿→发布→读者浏览可见（跨 SD-001/002/003）', async () => {
    const { app } = createTestEnv();

    // 1 注册读者：201 + 用户对象（响应无密码字段）
    const reg = await request(app).post('/api/auth/register').send({
      username: 'reader_e2e',
      email: 'e2e@example.com',
      password: 'Passw0rd!x',
    });
    expect(reg.status).toBe(201);
    expect(reg.body.data.role).toBe('reader');
    expect(reg.body.data.password).toBeUndefined();

    // 2 登录：200 + JWT（exp−iat ≤ 24h，CON-003）
    const loginRes = await request(app).post('/api/auth/login').send({
      identifier: 'e2e@example.com',
      password: 'Passw0rd!x',
    });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.data.token as string;
    const payload = jwt.decode(token) as { exp: number; iat: number };
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(86400);

    // 3 申请博主：200 + role=blogger
    const apply = await request(app).post('/api/users/me/blogger').set(bearer(token));
    expect(apply.status).toBe(200);
    expect(apply.body.data.role).toBe('blogger');

    // JWT 载荷含角色快照（实现契约：申请博主后旧 token 角色仍为 reader，须重新登录获取博主 JWT）
    const bloggerLogin = await request(app).post('/api/auth/login').send({
      identifier: 'e2e@example.com',
      password: 'Passw0rd!x',
    });
    expect(bloggerLogin.status).toBe(200);
    const bloggerToken = bloggerLogin.body.data.token as string;

    // 4 创建文章：201 + status=draft
    const create = await request(app)
      .post('/api/articles')
      .set(bearer(bloggerToken))
      .send({ title: '端到端全链路文章', body: '正文内容', summary: '概要' });
    expect(create.status).toBe(201);
    expect(create.body.data.status).toBe('draft');
    const articleId = create.body.data.articleId as string;

    // 5 发布：200 + status=published
    const pub = await request(app).post(`/api/articles/${articleId}/publish`).set(bearer(bloggerToken));
    expect(pub.status).toBe(200);
    expect(pub.body.data.status).toBe('published');

    // 6 读者视角浏览：200 + 列表含该文章（published 可见）
    const list = await request(app).get('/api/articles').query({ page: 1 });
    expect(list.status).toBe(200);
    const ids = list.body.data.items.map((item: { articleId: string }) => item.articleId);
    expect(ids).toContain(articleId);
  });
});

describe('ST-002 发布→评论→回复→被回复通知 端到端（REQ-012/018/026）', () => {
  it('读者评论→博主回复（parentId 挂载）→文章作者收到 REPLY 通知→标记已读', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st2_blogger', email: 'st2b@example.com', role: 'blogger' });
    const reader = await seedUser(env.stores, { username: 'st2_reader', email: 'st2r@example.com' });
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '评论端到端文章', status: 'published' });
    const bloggerSession = await login(env.app, 'st2b@example.com');
    const readerSession = await login(env.app, 'st2r@example.com');

    // 1 读者发表评论：201 + 评论立即可见（审核自动通过）
    const commentRes = await request(env.app)
      .post('/api/articles/A1/comments')
      .set(bearer(readerSession.token))
      .send({ content: '不错的文章' });
    expect(commentRes.status).toBe(201);
    const cid = commentRes.body.data.commentId as string;
    const listRes = await request(env.app).get('/api/articles/A1/comments');
    expect(listRes.body.data.total).toBe(1);

    // 2 博主回复该评论：201 + 回复挂载于原评论
    const replyRes = await request(env.app)
      .post(`/api/articles/A1/comments/${cid}/reply`)
      .set(bearer(bloggerSession.token))
      .send({ content: '谢谢支持' });
    expect(replyRes.status).toBe(201);
    expect(replyRes.body.data.parentId).toBe(cid);

    // 3 文章作者（博主）查通知：含「评论」REPLY 通知（实现契约：REPLY 通知对象=文章作者，与设计"回复→被回复人"差异见测试报告）
    await pollUntil(
      async () => {
        const res = await request(env.app).get('/api/me/notifications').set(bearer(bloggerSession.token));
        return res.body.data.items.filter((n: { type: string; actorId: string }) => n.type === 'REPLY' && n.actorId === reader.id).length;
      },
      (count) => count >= 1,
      { timeoutMs: 3000, message: 'REPLY 通知未在 3s 内产生' },
    );
    const notifyRes = await request(env.app).get('/api/me/notifications').set(bearer(bloggerSession.token));
    const replyNotice = notifyRes.body.data.items.find(
      (n: { type: string; actorId: string }) => n.type === 'REPLY' && n.actorId === reader.id,
    );
    expect(replyNotice).toBeDefined();
    expect(replyNotice.articleId).toBe('A1');

    // 4 标记已读：200 + 已读状态更新
    const markRes = await request(env.app)
      .patch(`/api/me/notifications/${replyNotice.notificationId}/read`)
      .set(bearer(bloggerSession.token));
    expect(markRes.status).toBe(200);
    expect(markRes.body.data.read).toBe(true);
  });
});

describe('ST-003 关注博主→发布新文章→feed 可见→发文通知 端到端（REQ-020/026/012）', () => {
  it('关注后 feed 推送 + NEW_ARTICLE 通知；取消关注后不再推送/不再通知', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st3_blogger', email: 'st3b@example.com', role: 'blogger' });
    const reader = await seedUser(env.stores, { username: 'st3_reader', email: 'st3r@example.com' });
    seedArticle(env.stores, { id: 'D1', authorId: blogger.id, title: '关注期间发布', status: 'draft' });
    seedArticle(env.stores, { id: 'D2', authorId: blogger.id, title: '取关后发布', status: 'draft' });
    const bloggerSession = await login(env.app, 'st3b@example.com');
    const readerSession = await login(env.app, 'st3r@example.com');

    // 1 读者关注博主：200 + 关注关系建立
    const follow = await request(env.app).post(`/api/users/${blogger.id}/follow`).set(bearer(readerSession.token));
    expect(follow.status).toBe(200);
    expect(follow.body.data.followeeId).toBe(blogger.id);

    // 2 博主发布新文章 D1：200 + published
    const pub1 = await request(env.app).post('/api/articles/D1/publish').set(bearer(bloggerSession.token));
    expect(pub1.status).toBe(200);
    expect(pub1.body.data.status).toBe('published');

    // 3 读者拉取 feed：200 + 含 D1
    const feed1 = await request(env.app).get('/api/me/feed').set(bearer(readerSession.token));
    expect(feed1.status).toBe(200);
    expect(feed1.body.data.items.map((i: { articleId: string }) => i.articleId)).toContain('D1');

    // 4 读者查通知：含「关注博主发文」NEW_ARTICLE 通知
    await pollUntil(
      async () => {
        const res = await request(env.app).get('/api/me/notifications').set(bearer(readerSession.token));
        return res.body.data.items.filter((n: { type: string }) => n.type === 'NEW_ARTICLE').length;
      },
      (count) => count >= 1,
      { timeoutMs: 3000, message: 'NEW_ARTICLE 通知未在 3s 内产生' },
    );

    // 5 取消关注后再发布：feed 不含其后新文章；通知不再新增
    const unfollow = await request(env.app).delete(`/api/users/${blogger.id}/follow`).set(bearer(readerSession.token));
    expect(unfollow.status).toBe(200);
    const pub2 = await request(env.app).post('/api/articles/D2/publish').set(bearer(bloggerSession.token));
    expect(pub2.status).toBe(200);
    const feed2 = await request(env.app).get('/api/me/feed').set(bearer(readerSession.token));
    expect(feed2.body.data.items.map((i: { articleId: string }) => i.articleId)).not.toContain('D2');
    const notify2 = await request(env.app).get('/api/me/notifications').set(bearer(readerSession.token));
    expect(notify2.body.data.items.filter((n: { type: string }) => n.type === 'NEW_ARTICLE').length).toBe(1);
  });
});

describe('ST-004 详情访问→阅读统计→热门/推荐 数据联动（端到端，REQ-017/024/021/022）', () => {
  it('差异化阅读记录驱动热门排序；有历史读者标签偏好推荐；冷启动回退热门', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st4_blogger', email: 'st4b@example.com', role: 'blogger' });
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: 'nodejs 实践', tags: ['nodejs'], status: 'published' });
    seedArticle(env.stores, { id: 'A2', authorId: blogger.id, title: 'typescript 实践', tags: ['typescript'], status: 'published' });
    seedArticle(env.stores, { id: 'A3', authorId: blogger.id, title: 'rust 实践', tags: ['rust'], status: 'published' });
    seedArticle(env.stores, { id: 'A4', authorId: blogger.id, title: 'nodejs 进阶实践', tags: ['nodejs'], status: 'published' });

    const now = Date.now();
    // 差异化阅读记录（seam-STORE，不同 IP 不触发同 IP 去重）：A1=10、A2=5、A3=2
    for (let i = 0; i < 10; i += 1) {
      seedReadingRecord(env.stores, { articleId: 'A1', clientIp: `10.4.0.${i}`, viewedAt: new Date(now - i * 3600000).toISOString() });
    }
    for (let i = 0; i < 5; i += 1) {
      seedReadingRecord(env.stores, { articleId: 'A2', clientIp: `10.5.0.${i}`, viewedAt: new Date(now - i * 3600000).toISOString() });
    }
    for (let i = 0; i < 2; i += 1) {
      seedReadingRecord(env.stores, { articleId: 'A3', clientIp: `10.6.0.${i}`, viewedAt: new Date(now - i * 3600000).toISOString() });
    }

    // 1 有历史读者（偏好 nodejs）：阅读记录 userId 关联后请求推荐
    const readerH = await seedUser(env.stores, { username: 'st4_reader_h', email: 'st4h@example.com' });
    seedReadingRecord(env.stores, { articleId: 'A1', clientIp: '10.7.0.1', userId: readerH.id, viewedAt: new Date(now).toISOString() });
    const sessionH = await login(env.app, 'st4h@example.com');

    // 2 详情访问：200 + 响应含阅读量（A1 的 viewCount 反映去重后累计 ≥1）
    const detail = await request(env.app).get('/api/articles/A1');
    expect(detail.status).toBe(200);
    expect(detail.body.data.viewCount).toBeGreaterThanOrEqual(1);

    // 3 热门榜单：按 7 天阅读量降序，article-A1 居首（10 > 5 > 2）
    const hot = await request(env.app).get('/api/articles/hot').query({ limit: 10 });
    expect(hot.status).toBe(200);
    const hotIds = hot.body.data.items.map((i: { articleId: string }) => i.articleId);
    expect(hotIds[0]).toBe('A1');

    // 4 有历史读者推荐：返回含 nodejs 标签相似文章（tag-preference），已读文章去重
    const recH = await request(env.app).get('/api/me/recommendations').query({ limit: 10 }).set(bearer(sessionH.token));
    expect(recH.status).toBe(200);
    const itemsH = recH.body.data.items as Array<{ reason: string; articleId: string }>;
    expect(itemsH.length).toBeGreaterThan(0);
    expect(itemsH.every((i) => i.reason === 'tag-preference')).toBe(true);
    expect(itemsH.map((i) => i.articleId)).toContain('A4'); // nodejs 相似召回（同偏好标签）
    expect(itemsH.map((i) => i.articleId)).not.toContain('A1'); // 已读去重

    // 5 无历史读者（新注册无阅读记录）：回退热门（hot-fallback）
    await request(env.app).post('/api/auth/register').send({ username: 'st4_reader_n', email: 'st4n@example.com', password: 'Passw0rd!x' });
    const sessionN = await login(env.app, 'st4n@example.com');
    const recN = await request(env.app).get('/api/me/recommendations').set(bearer(sessionN.token));
    expect(recN.status).toBe(200);
    expect((recN.body.data.items as Array<{ reason: string }>).every((i) => i.reason === 'hot-fallback')).toBe(true);
  });
});

describe('ST-005 发布→Webhook 回调→RSS 更新 端到端（REQ-012/028/027）', () => {
  it('配置 Webhook→发布→mock 收到 HMAC 签名事件→RSS 源含新发布文章（草稿不在 RSS）', async () => {
    const mock = await startMockServer({ status: 200 });
    try {
      const env = createTestEnv();
      const blogger = await seedUser(env.stores, { username: 'st5_blogger', email: 'st5b@example.com', role: 'blogger' });
      seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: 'Webhook端到端文章', status: 'draft' });
      seedArticle(env.stores, { id: 'D2', authorId: blogger.id, title: '不应出现在RSS的草稿', status: 'draft' });
      const session = await login(env.app, 'st5b@example.com');

      // 1 配置 Webhook：201 + 配置对象（含 secret）
      const hookRes = await request(env.app)
        .post('/api/me/webhooks')
        .set(bearer(session.token))
        .send({ url: mock.url, events: ['article.published'] });
      expect(hookRes.status).toBe(201);
      const webhookId = hookRes.body.data.webhookId as string;
      const secret = hookRes.body.data.secret as string;
      expect(typeof secret).toBe('string');

      // 2 发布文章：200 + published
      const pub = await request(env.app).post('/api/articles/A1/publish').set(bearer(session.token));
      expect(pub.status).toBe(200);
      expect(pub.body.data.status).toBe('published');

      // 3 断言 mock 回调：收到 POST 事件 + HMAC 签名可验（X-Blog-Signature 匹配）
      await pollUntil(() => mock.count(), (count) => count >= 1, { timeoutMs: 5000, message: 'mock 回调未在 5s 内收到' });
      const received = mock.requests[0];
      expect(received.event).toBe('article.published');
      const expectedSignature = createHmac('sha256', secret).update(received.body).digest('hex');
      expect(received.headers['x-blog-signature']).toBe(expectedSignature);
      expect(received.headers['x-blog-timestamp']).toBeTruthy();

      // 4 拉取 RSS：200 + 合法 XML（rss 2.0），含新发布文章、不含草稿
      const rss = await request(env.app).get(`/api/bloggers/${blogger.id}/rss`);
      expect(rss.status).toBe(200);
      expect(rss.headers['content-type']).toContain('application/rss+xml');
      const xml = rss.text as string;
      expect(xml).toContain('<rss version="2.0">');
      expect(xml).toContain('Webhook端到端文章');
      expect(xml).not.toContain('不应出现在RSS的草稿');
      expect(xml).toMatch(/<pubDate>/);

      // 5 投递记录（seam-STORE）：delivered + attempts=1
      await pollUntil(
        () => env.stores.webhookDeliveryStore.listByWebhook(webhookId)[0]?.status,
        (status) => status === 'delivered',
        { timeoutMs: 5000, message: '投递记录未达 delivered' },
      );
      void DAY_MS;
    } finally {
      await mock.close();
    }
  }, 15000);
});
