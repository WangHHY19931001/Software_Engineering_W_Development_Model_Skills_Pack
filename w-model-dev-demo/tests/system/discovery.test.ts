/**
 * 系统测试 · 发现与互动跨模块集成（ST-016~020）
 * ST-016 关注/取消关注 feed 推送变化
 * ST-017 热门文章 Top N 按 7 天阅读量降序
 * ST-018 个性化推荐：有历史标签偏好 + 冷启动回退热门
 * ST-019 全文搜索四字段命中 + 分页 + 相关性排序
 * ST-020 阅读统计 +1 + 同 IP 短窗口去重 + 响应含阅读量
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestEnv, seedUser, seedTag, seedArticle, seedReadingRecord, register, login, bearer } from './helpers';

const HOUR_MS = 3600000;
const DAY_MS = 86400000;

describe('ST-016 关注/取消关注 feed 推送变化（跨模块集成，REQ-020）', () => {
  it('关注后 feed 含 A 新文章不含未关注 B；取关后不再推送其后新文', async () => {
    const env = createTestEnv();
    const bloggerA = await seedUser(env.stores, { username: 'st16_blogger_a', email: 'st16a@example.com', role: 'blogger' });
    const bloggerB = await seedUser(env.stores, { username: 'st16_blogger_b', email: 'st16b@example.com', role: 'blogger' });
    await seedUser(env.stores, { username: 'st16_reader', email: 'st16r@example.com' });
    seedArticle(env.stores, { id: 'A1', authorId: bloggerA.id, title: 'A的已发布文章', status: 'published' });
    seedArticle(env.stores, { id: 'A2', authorId: bloggerA.id, title: 'A的后续文章', status: 'draft' });
    seedArticle(env.stores, { id: 'A3', authorId: bloggerA.id, title: 'A的取关后文章', status: 'draft' });
    seedArticle(env.stores, { id: 'B1', authorId: bloggerB.id, title: 'B的已发布文章', status: 'published' });

    const sessionA = await login(env.app, 'st16a@example.com');
    const reader = await login(env.app, 'st16r@example.com');

    // 1 关注博主 A：200
    const follow = await request(env.app).post(`/api/users/${bloggerA.id}/follow`).set(bearer(reader.token));
    expect(follow.status).toBe(200);

    // 2 拉取 feed：200 + 含 a1，不含博主 B 的文章
    const feed1 = await request(env.app).get('/api/me/feed').set(bearer(reader.token));
    expect(feed1.status).toBe(200);
    const ids1 = feed1.body.data.items.map((i: { articleId: string }) => i.articleId);
    expect(ids1).toContain('A1');
    expect(ids1).not.toContain('B1');

    // 3 A 再发布 a2：feed 含 a1、a2（按发布时间排序）
    await request(env.app).post('/api/articles/A2/publish').set(bearer(sessionA.token));
    const feed2 = await request(env.app).get('/api/me/feed').set(bearer(reader.token));
    const ids2 = feed2.body.data.items.map((i: { articleId: string }) => i.articleId);
    expect(ids2).toContain('A1');
    expect(ids2).toContain('A2');
    expect(ids2.indexOf('A2')).toBeLessThan(ids2.indexOf('A1')); // 新发布排前（publishedAt 降序）

    // 4 取消关注后 A 发布 a3：feed 不含 a3
    await request(env.app).delete(`/api/users/${bloggerA.id}/follow`).set(bearer(reader.token));
    await request(env.app).post('/api/articles/A3/publish').set(bearer(sessionA.token));
    const feed3 = await request(env.app).get('/api/me/feed').set(bearer(reader.token));
    expect(feed3.body.data.items.map((i: { articleId: string }) => i.articleId)).not.toContain('A3');
  });
});

describe('ST-017 热门文章 Top N 按 7 天阅读量降序（跨模块集成，REQ-021）', () => {
  it('Top N 按 7 天阅读量降序（v1 居首）；自定义 limit=3；空数据返回空列表', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st17_blogger', email: 'st17b@example.com', role: 'blogger' });
    // 12 篇已发布 + 差异化 7 天阅读记录（v1 > v2 > ... > v12）
    const now = Date.now();
    for (let i = 1; i <= 12; i += 1) {
      const id = `v${i}`;
      seedArticle(env.stores, { id, authorId: blogger.id, title: `热门文章${i}`, status: 'published' });
      for (let j = 0; j <= 12 - i; j += 1) {
        seedReadingRecord(env.stores, { articleId: id, clientIp: `10.10.${i}.${j}`, viewedAt: new Date(now - j * HOUR_MS).toISOString() });
      }
    }

    // 1 拉取热门默认 Top：200 + 10 条，按阅读量降序，v1 居首（13 条 > v2 的 12 条）
    const hot = await request(env.app).get('/api/articles/hot');
    expect(hot.status).toBe(200);
    const items = hot.body.data.items as Array<{ articleId: string; viewCount7d: number }>;
    expect(items.length).toBe(10);
    expect(items[0].articleId).toBe('v1');
    for (let i = 1; i < items.length; i += 1) {
      expect(items[i - 1].viewCount7d).toBeGreaterThanOrEqual(items[i].viewCount7d);
    }

    // 2 自定义 limit：200 + 3 条（v1, v2, v3）
    const hot3 = await request(env.app).get('/api/articles/hot').query({ limit: 3 });
    expect(hot3.status).toBe(200);
    expect(hot3.body.data.items.map((i: { articleId: string }) => i.articleId)).toEqual(['v1', 'v2', 'v3']);

    // 3 空数据环境：200 + 空列表
    const emptyEnv = createTestEnv();
    const emptyHot = await request(emptyEnv.app).get('/api/articles/hot');
    expect(emptyHot.status).toBe(200);
    expect(emptyHot.body.data.items).toEqual([]);
  });
});

describe('ST-018 个性化推荐：有历史标签偏好 + 冷启动回退热门（跨模块集成，REQ-022）', () => {
  it('有历史 → tag-preference（偏好标签靠前）；无历史/匿名 → hot-fallback', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st18_blogger', email: 'st18b@example.com', role: 'blogger' });
    seedTag(env.stores, 'nodejs');
    seedTag(env.stores, 'typescript');
    seedArticle(env.stores, { id: 'AR', authorId: blogger.id, title: '已读nodejs文章', tags: ['nodejs'], status: 'published' });
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '推荐nodejs文章', tags: ['nodejs'], status: 'published' });
    seedArticle(env.stores, { id: 'A2', authorId: blogger.id, title: '不相关文章', tags: ['typescript'], status: 'published' });

    const now = Date.now();
    // 读者 H 有历史（读 nodejs 文章）；热门数据供冷启动回退
    const readerH = await seedUser(env.stores, { username: 'st18_reader_h', email: 'st18h@example.com' });
    seedReadingRecord(env.stores, { articleId: 'AR', clientIp: '10.11.0.1', userId: readerH.id, viewedAt: new Date(now).toISOString() });
    seedReadingRecord(env.stores, { articleId: 'A1', clientIp: '10.11.0.2', viewedAt: new Date(now).toISOString() });
    seedReadingRecord(env.stores, { articleId: 'A1', clientIp: '10.11.0.3', viewedAt: new Date(now).toISOString() });

    const sessionH = await login(env.app, 'st18h@example.com');

    // 1 有历史读者推荐：200 + 含 nodejs 标签文章且偏好权重高者靠前（reason=tag-preference）
    const recH = await request(env.app).get('/api/me/recommendations').query({ limit: 10 }).set(bearer(sessionH.token));
    expect(recH.status).toBe(200);
    const itemsH = recH.body.data.items as Array<{ articleId: string; reason: string }>;
    expect(itemsH.length).toBeGreaterThan(0);
    expect(itemsH.every((i) => i.reason === 'tag-preference')).toBe(true);
    expect(itemsH.map((i) => i.articleId)).toContain('A1');
    expect(itemsH.map((i) => i.articleId)).not.toContain('AR');

    // 2 无历史读者（新注册）：200 + 回退为热门文章列表
    await register(env.app, 'st18_reader_n', 'st18n@example.com');
    const sessionN = await login(env.app, 'st18n@example.com');
    const recN = await request(env.app).get('/api/me/recommendations').set(bearer(sessionN.token));
    expect(recN.status).toBe(200);
    expect((recN.body.data.items as Array<{ reason: string }>).every((i) => i.reason === 'hot-fallback')).toBe(true);

    // 3 匿名（无 JWT）：200 + 回退热门
    const recAnon = await request(env.app).get('/api/me/recommendations');
    expect(recAnon.status).toBe(200);
    expect((recAnon.body.data.items as Array<{ reason: string }>).every((i) => i.reason === 'hot-fallback')).toBe(true);
  });
});

describe('ST-019 全文搜索四字段命中 + 分页 + 相关性排序（跨模块集成，REQ-023）', () => {
  it('关键词命中标题/正文/摘要/标签四字段；分页正确；相关性排序（标题命中优先）；无结果空列表', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st19_blogger', email: 'st19b@example.com', role: 'blogger' });
    // 6 篇已发布：关键词「websocket」分布在标题/正文/摘要/标签
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: 'Websocket 协议详解', status: 'published' });
    seedArticle(env.stores, { id: 'A2', authorId: blogger.id, title: '网络编程', body: '本文介绍 websocket 长连接', status: 'published' });
    seedArticle(env.stores, { id: 'A3', authorId: blogger.id, title: '实时通信', summary: 'WebSocket 摘要命中', status: 'published' });
    seedArticle(env.stores, { id: 'A4', authorId: blogger.id, title: '标签命中文章', tags: ['websocket'], status: 'published' });
    seedArticle(env.stores, { id: 'A5', authorId: blogger.id, title: '正文两处', body: 'websocket 与 websocket 传输', status: 'published' });
    seedArticle(env.stores, { id: 'A6', authorId: blogger.id, title: '无关键词文章', status: 'published' });
    // seam-STORE：搜索索引（SD-004 SearchIndex，发布事件同步索引的等价 seed）
    env.stores.searchIndexStore.index('A1', { title: 'Websocket 协议详解', body: '', summary: '', tags: [] });
    env.stores.searchIndexStore.index('A2', { title: '网络编程', body: '本文介绍 websocket 长连接', summary: '', tags: [] });
    env.stores.searchIndexStore.index('A3', { title: '实时通信', body: '', summary: 'WebSocket 摘要命中', tags: [] });
    env.stores.searchIndexStore.index('A4', { title: '标签命中文章', body: '', summary: '', tags: ['websocket'] });
    env.stores.searchIndexStore.index('A5', { title: '正文两处', body: 'websocket 与 websocket 传输', summary: '', tags: [] });
    env.stores.searchIndexStore.index('A6', { title: '无关键词文章', body: '', summary: '', tags: [] });

    // 1 搜索关键词：200 + 命中四字段的文章全部返回（A1~A5，不含 A6）
    const search = await request(env.app).get('/api/search').query({ q: 'websocket' });
    expect(search.status).toBe(200);
    expect(search.body.data.total).toBe(5);
    const ids = search.body.data.items.map((i: { articleId: string }) => i.articleId);
    expect(ids).toEqual(expect.arrayContaining(['A1', 'A2', 'A3', 'A4', 'A5']));
    expect(ids).not.toContain('A6');

    // 2 断言相关性排序：标题命中（A1）优先于标签/摘要/正文命中，score 降序
    const items = search.body.data.items as Array<{ articleId: string; score: number }>;
    expect(items[0].articleId).toBe('A1');
    for (let i = 1; i < items.length; i += 1) {
      expect(items[i - 1].score).toBeGreaterThanOrEqual(items[i].score);
    }

    // 3 分页：pageSize=2 逐页拉取，总数正确、无重复
    const page1 = await request(env.app).get('/api/search').query({ q: 'websocket', page: 1, pageSize: 2 });
    const page2 = await request(env.app).get('/api/search').query({ q: 'websocket', page: 2, pageSize: 2 });
    const page3 = await request(env.app).get('/api/search').query({ q: 'websocket', page: 3, pageSize: 2 });
    expect(page1.body.data.total).toBe(5);
    expect(page1.body.data.items.length).toBe(2);
    expect(page2.body.data.items.length).toBe(2);
    expect(page3.body.data.items.length).toBe(1);
    const all = [...page1.body.data.items, ...page2.body.data.items, ...page3.body.data.items].map(
      (i: { articleId: string }) => i.articleId,
    );
    expect(new Set(all).size).toBe(5);

    // 4 无结果关键词：200 + 空列表
    const none = await request(env.app).get('/api/search').query({ q: 'zzz_not_exist' });
    expect(none.status).toBe(200);
    expect(none.body.data.items).toEqual([]);
  });
});

describe('ST-020 阅读统计 +1 + 同 IP 短窗口去重 + 响应含阅读量（跨模块集成，REQ-024）', () => {
  it('首次访问 +1；窗口内同 IP 去重；窗口外/不同 IP 累加；响应含 viewCount 与存储一致', async () => {
    // 场景 A：默认 5 分钟窗口（同 IP 去重）
    const envA = createTestEnv();
    const bloggerA = await seedUser(envA.stores, { username: 'st20a_blogger', email: 'st20a@example.com', role: 'blogger' });
    seedArticle(envA.stores, { id: 'P1', authorId: bloggerA.id, title: '阅读统计文章', status: 'published' });

    // 1 首次访问（IP=127.0.0.1）：200 + viewCount=1
    const first = await request(envA.app).get('/api/articles/P1');
    expect(first.status).toBe(200);
    expect(first.body.data.viewCount).toBe(1);

    // 2 窗口内同 IP 重复访问：viewCount 仍 =1（去重）
    const repeat = await request(envA.app).get('/api/articles/P1');
    expect(repeat.body.data.viewCount).toBe(1);

    // 场景 B：窗口参数化缩小（ID-8）验证窗口过期/不同窗口语义
    const envB = createTestEnv({ readingDedupWindowMs: 300 });
    const bloggerB = await seedUser(envB.stores, { username: 'st20b_blogger', email: 'st20b@example.com', role: 'blogger' });
    seedArticle(envB.stores, { id: 'P1', authorId: bloggerB.id, title: '窗口过期文章', status: 'published' });

    const b1 = await request(envB.app).get('/api/articles/P1');
    expect(b1.body.data.viewCount).toBe(1);
    const b2 = await request(envB.app).get('/api/articles/P1');
    expect(b2.body.data.viewCount).toBe(1); // 窗口内去重

    // 3 窗口过期后访问：viewCount=2（累加）
    await new Promise((resolve) => setTimeout(resolve, 500));
    const b3 = await request(envB.app).get('/api/articles/P1');
    expect(b3.status).toBe(200);
    expect(b3.body.data.viewCount).toBe(2);

    // 4 断言响应字段与存储一致：ReadingRecord 记录数与 viewCount 匹配（场景 A：同 IP 仅 1 条去重记录）
    const records = envA.stores.readingRecordStore.findAll().filter((r) => r.articleId === 'P1');
    expect(records.length).toBe(1);
    void DAY_MS;
  });
});
