/**
 * 集成测试 · 发现域（INTF-015/016/017，REQ-021/022/023）
 * IT-020 热门文章：7 天阅读量 Top N（跨模块统计消费）
 * IT-021 个性化推荐：标签偏好 vs 冷启动热门回退（跨模块）
 * IT-022 全文搜索：四字段命中 + 分页 + 相关性排序
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestEnv, seedUser, seedTag, seedArticle, register, login, bearer, seedReadingRecord } from './helpers';

const HOUR_MS = 3600000;
const DAY_MS = 86400000;

describe('IT-020 热门文章：7 天阅读量 Top N（跨模块统计消费）', () => {
  it('Top N 按 7 天窗口阅读量降序；仅 published；limit 越界 40002；窗口外不计入', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'it20_blogger', email: 'it20@example.com', role: 'blogger' });
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '热门文章A1', status: 'published' });
    seedArticle(env.stores, { id: 'A2', authorId: blogger.id, title: '热门文章A2', status: 'published' });
    seedArticle(env.stores, { id: 'A3', authorId: blogger.id, title: '热门文章A3', status: 'published' });
    seedArticle(env.stores, { id: 'A4', authorId: blogger.id, title: '高阅读量草稿A4', status: 'draft' });

    const now = Date.now();
    // A1：10 条窗口内阅读 + 1 条 8 天前阅读（窗口外，不计入 viewCount7d）
    for (let i = 0; i < 10; i += 1) {
      seedReadingRecord(env.stores, { articleId: 'A1', clientIp: `10.0.0.${i}`, viewedAt: new Date(now - i * HOUR_MS).toISOString() });
    }
    seedReadingRecord(env.stores, { articleId: 'A1', clientIp: '10.9.9.9', viewedAt: new Date(now - 8 * DAY_MS).toISOString() });
    // A2：5 条；A3：1 条（热门仅返回 viewCount7d>0 的文章）；A4 草稿：5 条（不应出现）
    for (let i = 0; i < 5; i += 1) {
      seedReadingRecord(env.stores, { articleId: 'A2', clientIp: `10.1.0.${i}`, viewedAt: new Date(now - i * HOUR_MS).toISOString() });
    }
    seedReadingRecord(env.stores, { articleId: 'A3', clientIp: '10.2.0.1', viewedAt: new Date(now - HOUR_MS).toISOString() });
    for (let i = 0; i < 5; i += 1) {
      seedReadingRecord(env.stores, { articleId: 'A4', clientIp: `10.3.0.${i}`, viewedAt: new Date(now - i * HOUR_MS).toISOString() });
    }

    // 1 热门 Top 3：顺序 A1(10) > A2(5) > A3(1)；草稿 A4 不出现；A1 的 8 天前记录不计入
    const hot = await request(env.app).get('/api/articles/hot').query({ limit: 3 });
    expect(hot.status).toBe(200);
    const items = hot.body.data.items as Array<{ articleId: string; viewCount7d: number }>;
    expect(items.map((i) => i.articleId)).toEqual(['A1', 'A2', 'A3']);
    expect(items[0].viewCount7d).toBe(10);
    expect(items[1].viewCount7d).toBe(5);
    expect(items[2].viewCount7d).toBe(1);

    // 2 默认 limit：200 + items ≤ 10（默认）
    const hotDefault = await request(env.app).get('/api/articles/hot');
    expect(hotDefault.status).toBe(200);
    expect(hotDefault.body.data.items.length).toBeLessThanOrEqual(10);

    // 3 limit 越界：400 + error.code=40002
    const badLimit = await request(env.app).get('/api/articles/hot').query({ limit: 0 });
    expect(badLimit.status).toBe(400);
    expect(badLimit.body.error.code).toBe(40002);
  });
});

describe('IT-021 个性化推荐：标签偏好 vs 冷启动热门回退（跨模块）', () => {
  it('有历史 → tag-preference；匿名/无历史 → hot-fallback；伪造 JWT 40101', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'it21_blogger', email: 'it21b@example.com', role: 'blogger' });
    const readerCUser = await seedUser(env.stores, { username: 'it21_reader_c', email: 'it21c@example.com' });
    seedTag(env.stores, 't1');
    seedTag(env.stores, 't2');
    seedArticle(env.stores, { id: 'AR', authorId: blogger.id, title: '读者已读文章', tags: ['t1'], status: 'published' });
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '标签偏好推荐文', tags: ['t1'], status: 'published' });
    seedArticle(env.stores, { id: 'A2', authorId: blogger.id, title: '不相关文章', tags: ['t2'], status: 'published' });
    seedArticle(env.stores, { id: 'A3', authorId: blogger.id, title: '另一篇t1文章', tags: ['t1'], status: 'published' });

    const now = Date.now();
    // 读者 C 阅读过 AR（t1 标签偏好来源；userId 须为 user 实体主键）
    seedReadingRecord(env.stores, { articleId: 'AR', clientIp: '10.0.0.1', userId: readerCUser.id, viewedAt: new Date(now).toISOString() });
    // 热门数据：A1 2 次、AR 1 次（匿名回退候选）
    seedReadingRecord(env.stores, { articleId: 'A1', clientIp: '10.0.0.2', viewedAt: new Date(now).toISOString() });
    seedReadingRecord(env.stores, { articleId: 'A1', clientIp: '10.0.0.3', viewedAt: new Date(now).toISOString() });
    seedReadingRecord(env.stores, { articleId: 'AR', clientIp: '10.0.0.4', viewedAt: new Date(now).toISOString() });

    const readerC = await login(env.app, 'it21c@example.com');

    // 1 有历史用户推荐：200 + 含 t1 相关文章，reason=tag-preference；不含已读 AR
    const recC = await request(env.app).get('/api/me/recommendations').query({ limit: 10 }).set(bearer(readerC.token));
    expect(recC.status).toBe(200);
    const itemsC = recC.body.data.items as Array<{ articleId: string; reason: string }>;
    expect(itemsC.length).toBeGreaterThan(0);
    expect(itemsC.every((i) => i.reason === 'tag-preference')).toBe(true);
    expect(itemsC.map((i) => i.articleId)).toContain('A1');
    expect(itemsC.map((i) => i.articleId)).not.toContain('AR');

    // 2 匿名冷启动：无 Authorization → reason=hot-fallback（回退热门）
    const recAnon = await request(env.app).get('/api/me/recommendations');
    expect(recAnon.status).toBe(200);
    const itemsAnon = recAnon.body.data.items as Array<{ reason: string }>;
    expect(itemsAnon.length).toBeGreaterThan(0);
    expect(itemsAnon.every((i) => i.reason === 'hot-fallback')).toBe(true);

    // 3 无历史新用户：注册后无阅读记录 → hot-fallback
    await register(env.app, 'it21_reader_d', 'it21d@example.com');
    const readerD = await login(env.app, 'it21d@example.com');
    const recD = await request(env.app).get('/api/me/recommendations').set(bearer(readerD.token));
    expect(recD.status).toBe(200);
    const itemsD = recD.body.data.items as Array<{ reason: string }>;
    expect(itemsD.every((i) => i.reason === 'hot-fallback')).toBe(true);

    // 4 无效令牌：401 + error.code=40101
    const forged = await request(env.app)
      .get('/api/me/recommendations')
      .set({ Authorization: 'Bearer forged.invalid.token' });
    expect(forged.status).toBe(401);
    expect(forged.body.error.code).toBe(40101);
  });
});

describe('IT-022 全文搜索：四字段命中 + 分页 + 相关性排序', () => {
  it('标题/正文/标签命中且草稿排除；标题权重最高排前；分页与参数校验正确', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'it22_blogger', email: 'it22@example.com', role: 'blogger' });
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: 'Alpha 标题命中', status: 'published' });
    seedArticle(env.stores, { id: 'A2', authorId: blogger.id, title: '普通文', body: '正文包含 Alpha 词汇', status: 'published' });
    seedArticle(env.stores, { id: 'A3', authorId: blogger.id, title: '标签文', tags: ['alpha'], status: 'published' });
    seedArticle(env.stores, { id: 'A4', authorId: blogger.id, title: 'Alpha 草稿不可见', status: 'draft' });
    // seam-STORE：搜索索引（SD-004 SearchIndex；权重 标题4 > 标签3 > 摘要2 > 正文1）
    env.stores.searchIndexStore.index('A1', { title: 'Alpha 标题命中', body: '', summary: '', tags: [] });
    env.stores.searchIndexStore.index('A2', { title: '普通文', body: '正文包含 Alpha 词汇', summary: '', tags: [] });
    env.stores.searchIndexStore.index('A3', { title: '标签文', body: '', summary: '', tags: ['alpha'] });
    env.stores.searchIndexStore.index('A4', { title: 'Alpha 草稿不可见', body: '', summary: '', tags: [] });

    // 1 关键词检索：200 + items 含 A1/A2/A3，不含 A4（draft）
    const search = await request(env.app).get('/api/search').query({ q: 'Alpha' });
    expect(search.status).toBe(200);
    expect(search.body.data.total).toBe(3);
    const ids = search.body.data.items.map((item: { articleId: string }) => item.articleId);
    expect(ids).toEqual(expect.arrayContaining(['A1', 'A2', 'A3']));
    expect(ids).not.toContain('A4');

    // 2 相关性排序：A1（标题命中，score 4）排最前，score 降序
    const items = search.body.data.items as Array<{ articleId: string; score: number }>;
    expect(items[0].articleId).toBe('A1');
    for (let i = 1; i < items.length; i += 1) {
      expect(items[i - 1].score).toBeGreaterThanOrEqual(items[i].score);
    }

    // 3 分页：200 + total=3，items 长度=2
    const paged = await request(env.app).get('/api/search').query({ q: 'Alpha', page: 1, pageSize: 2 });
    expect(paged.status).toBe(200);
    expect(paged.body.data.total).toBe(3);
    expect(paged.body.data.items.length).toBe(2);

    // 4 空关键词：400 + error.code=40002（q 必填，实现契约：空/超长统一 40002）
    const empty = await request(env.app).get('/api/search').query({ q: '' });
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe(40002);

    // 5 超长关键词（101 字符）：400 + error.code=40002
    const long = await request(env.app).get('/api/search').query({ q: 'x'.repeat(101) });
    expect(long.status).toBe(400);
    expect(long.body.error.code).toBe(40002);
  });
});
