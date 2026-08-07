/**
 * 验收测试 · 发现域（UAT-041~046，REQ-021~023）
 * 路径映射：docs/uat-path-mapping.md（popular→hot、recommendations→me/recommendations 等价映射）。
 * 契约说明：热门按近 7 天阅读量降序（INTF-015，viewCount7d）；推荐携带有效 JWT 个性化、无历史回退热门（INTF-016）；
 * 搜索命中标题/正文/摘要/标签四字段，q ∈ [1,100]（INTF-017）。
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestEnv, seedUser, seedTag, seedArticle, seedReadingRecord, login, bearer } from './helpers';

const HOUR_MS = 3600000;

async function seedBlogger(env: ReturnType<typeof createTestEnv>, username: string, email: string) {
  return seedUser(env.stores, { username, email, role: 'blogger' });
}

describe('UAT-041 热门文章按 7 天阅读量 Top10（正常路径，REQ-021）', () => {
  it('GET /api/articles/hot 返回 ≤10 篇且按 7 天阅读量降序', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat41_b', 'uat41@example.com');
    const now = Date.now();
    for (let i = 1; i <= 12; i += 1) {
      const id = `v${i}`;
      seedArticle(env.stores, { id, authorId: blogger.id, title: `热门文章${i}`, status: 'published' });
      for (let j = 0; j <= 12 - i; j += 1) {
        seedReadingRecord(env.stores, { articleId: id, clientIp: `10.41.${i}.${j}`, viewedAt: new Date(now - j * HOUR_MS).toISOString() });
      }
    }
    const hot = await request(env.app).get('/api/articles/hot').query({ limit: 10 });
    expect(hot.status).toBe(200);
    const items = hot.body.data.items as Array<{ articleId: string; viewCount7d: number }>;
    expect(items.length).toBe(10);
    expect(items[0].articleId).toBe('v1');
    for (let i = 1; i < items.length; i += 1) {
      expect(items[i - 1].viewCount7d).toBeGreaterThanOrEqual(items[i].viewCount7d);
    }
  });
});

describe('UAT-042 无阅读数据时热门列表为空（边界路径，REQ-021）', () => {
  it('空数据环境 GET /api/articles/hot → 200 + items=[]', async () => {
    const env = createTestEnv();
    const hot = await request(env.app).get('/api/articles/hot');
    expect(hot.status).toBe(200);
    expect(hot.body.data.items).toEqual([]);
  });
});

describe('UAT-043 有阅读历史时按标签偏好推荐（正常路径，REQ-022/REQ-024）', () => {
  it('有阅读历史的用户推荐列表含偏好标签（tag-node）文章', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat43_b', 'uat43@example.com');
    seedTag(env.stores, 'tag-node');
    seedTag(env.stores, 'tag-other');
    const now = Date.now();
    seedArticle(env.stores, { id: 'AR', authorId: blogger.id, title: '读过的 node 文', tags: ['tag-node'], status: 'published' });
    seedArticle(env.stores, { id: 'P1', authorId: blogger.id, title: 'node 推荐文', tags: ['tag-node'], status: 'published' });
    seedArticle(env.stores, { id: 'P2', authorId: blogger.id, title: '其他标签文', tags: ['tag-other'], status: 'published' });
    const reader = await seedUser(env.stores, { username: 'uat43_u', email: 'uat43u@example.com' });
    seedReadingRecord(env.stores, { articleId: 'AR', clientIp: '10.43.0.1', userId: reader.id, viewedAt: new Date(now).toISOString() });
    seedReadingRecord(env.stores, { articleId: 'P2', clientIp: '10.43.0.2', viewedAt: new Date(now).toISOString() });
    const session = await login(env.app, 'uat43u@example.com');
    const rec = await request(env.app).get('/api/me/recommendations').set(bearer(session.token));
    expect(rec.status).toBe(200);
    const items = rec.body.data.items as Array<{ articleId: string; reason: string }>;
    expect(items.length).toBeGreaterThan(0);
    const pref = items.find((i) => i.articleId === 'P1');
    expect(pref).toBeDefined();
    expect(pref!.reason).toBe('tag-preference');
  });
});

describe('UAT-044 无阅读历史时推荐回退热门（边界路径，REQ-022）', () => {
  it('无历史用户推荐列表全部 reason=hot-fallback（回退热门）', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat44_b', 'uat44@example.com');
    seedArticle(env.stores, { id: 'H1', authorId: blogger.id, title: '热门文', status: 'published' });
    const now = Date.now();
    seedReadingRecord(env.stores, { articleId: 'H1', clientIp: '10.44.0.1', viewedAt: new Date(now).toISOString() });
    await seedUser(env.stores, { username: 'uat44_u', email: 'uat44u@example.com' });
    const session = await login(env.app, 'uat44u@example.com');
    const rec = await request(env.app).get('/api/me/recommendations').set(bearer(session.token));
    expect(rec.status).toBe(200);
    const items = rec.body.data.items as Array<{ reason: string }>;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.reason === 'hot-fallback')).toBe(true);
  });
});

describe('UAT-045 全文搜索命中标题/正文/摘要/标签（正常路径，REQ-023）', () => {
  it('关键词分布在四字段的文章均可检索命中', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat45_b', 'uat45@example.com');
    seedArticle(env.stores, { id: 'S1', authorId: blogger.id, title: 'Typescript 教程', status: 'published' });
    seedArticle(env.stores, { id: 'S2', authorId: blogger.id, title: '工程实践', body: '使用 typescript 开发', status: 'published' });
    seedArticle(env.stores, { id: 'S3', authorId: blogger.id, title: '配置指南', summary: 'typescript 配置摘要', status: 'published' });
    seedArticle(env.stores, { id: 'S4', authorId: blogger.id, title: '标签命中', tags: ['typescript'], status: 'published' });
    env.stores.searchIndexStore.index('S1', { title: 'Typescript 教程', body: '', summary: '', tags: [] });
    env.stores.searchIndexStore.index('S2', { title: '工程实践', body: '使用 typescript 开发', summary: '', tags: [] });
    env.stores.searchIndexStore.index('S3', { title: '配置指南', body: '', summary: 'typescript 配置摘要', tags: [] });
    env.stores.searchIndexStore.index('S4', { title: '标签命中', body: '', summary: '', tags: ['typescript'] });
    const res = await request(env.app).get('/api/search').query({ q: 'typescript' });
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(4);
    const ids = res.body.data.items.map((i: { articleId: string }) => i.articleId);
    expect(ids).toEqual(expect.arrayContaining(['S1', 'S2', 'S3', 'S4']));
  });
});

describe('UAT-046 搜索分页与无结果（边界路径，REQ-023）', () => {
  it('分页正确（2 条 + total=5）；无匹配关键词返回空列表', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat46_b', 'uat46@example.com');
    // 索引按 token 精确匹配（tokenize：字母数字/CJK 连续段），关键词须为可独立分词的 token
    for (let i = 1; i <= 5; i += 1) {
      seedArticle(env.stores, { id: `K${i}`, authorId: blogger.id, title: `keyword 文章 ${i}`, status: 'published' });
      env.stores.searchIndexStore.index(`K${i}`, { title: `keyword 文章 ${i}`, body: '', summary: '', tags: [] });
    }
    const page1 = await request(env.app).get('/api/search').query({ q: 'keyword', page: 1, pageSize: 2 });
    expect(page1.status).toBe(200);
    expect(page1.body.data.items.length).toBe(2);
    expect(page1.body.data.total).toBe(5);
    const none = await request(env.app).get('/api/search').query({ q: 'zzz-nomatch' });
    expect(none.status).toBe(200);
    expect(none.body.data.items).toEqual([]);
    expect(none.body.data.total).toBe(0);
  });
});
