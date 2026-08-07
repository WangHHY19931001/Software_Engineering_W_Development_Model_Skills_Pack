/**
 * 集成测试 · 浏览域（INTF-011/018，REQ-017/024）
 * IT-011 浏览列表/详情：草稿与归档对读者不可见（跨模块 SD-003→SD-002）
 * IT-012 详情访问阅读量 +1；同 IP 5 分钟窗口去重（跨模块事件 SD-003→SD-005）
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestEnv, seedUser, seedTag, seedCategory, seedArticle } from './helpers';

describe('IT-011 浏览列表/详情：草稿与归档对读者不可见（跨模块 SD-003→SD-002）', () => {
  it('分页列表仅 published；分类/标签/关键词筛选正确；草稿详情 40402', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'it11_blogger', email: 'it11@example.com', role: 'blogger' });
    seedTag(env.stores, 't1');
    seedCategory(env.stores, { name: '分类一', id: 'c1' });
    seedArticle(env.stores, {
      id: 'A1',
      authorId: blogger.id,
      title: '集成测试文章Alpha',
      summary: '含关键词的摘要',
      tags: ['t1'],
      categoryId: 'c1',
      status: 'published',
    });
    seedArticle(env.stores, { id: 'A2', authorId: blogger.id, title: '草稿A2', status: 'draft' });
    seedArticle(env.stores, { id: 'A3', authorId: blogger.id, title: '归档A3', status: 'archived' });

    // 1 分页列表：200 + items 仅含 A1；total=1
    const list = await request(env.app).get('/api/articles').query({ page: 1, pageSize: 10 });
    expect(list.status).toBe(200);
    expect(list.body.data.total).toBe(1);
    const ids = list.body.data.items.map((item: { articleId: string }) => item.articleId);
    expect(ids).toEqual(['A1']);

    // 2 按分类筛选：200 + 含 A1
    const byCat = await request(env.app).get('/api/articles').query({ categoryId: 'c1' });
    expect(byCat.status).toBe(200);
    const catIds = byCat.body.data.items.map((item: { articleId: string }) => item.articleId);
    expect(catIds).toContain('A1');

    // 3 按标签筛选：200 + 含 A1
    const byTag = await request(env.app).get('/api/articles').query({ tag: 't1' });
    expect(byTag.status).toBe(200);
    const tagIds = byTag.body.data.items.map((item: { articleId: string }) => item.articleId);
    expect(tagIds).toContain('A1');

    // 4 关键词筛选：200 + 命中 A1（标题匹配）
    const byKw = await request(env.app).get('/api/articles').query({ keyword: 'alpha' });
    expect(byKw.status).toBe(200);
    const kwIds = byKw.body.data.items.map((item: { articleId: string }) => item.articleId);
    expect(kwIds).toContain('A1');

    // 5 详情草稿 A2：404 + error.code=40402
    const detail = await request(env.app).get('/api/articles/A2');
    expect(detail.status).toBe(404);
    expect(detail.body.error.code).toBe(40402);
  });
});

describe('IT-012 详情访问阅读量 +1；同 IP 5 分钟窗口去重（跨模块事件）', () => {
  it('首次 +1、窗口内重复不计数、ReadingRecord 仅 1 条、窗口过期后再 +1', async () => {
    // 场景 A：默认 5 分钟窗口（INTF-018 默认语义）
    const envA = createTestEnv();
    const bloggerA = await seedUser(envA.stores, { username: 'it12a_blogger', email: 'it12a@example.com', role: 'blogger' });
    seedArticle(envA.stores, { id: 'A1', authorId: bloggerA.id, title: '阅读统计文章A1', status: 'published' });

    // 1 首次访问详情：200 + viewCount=1
    const first = await request(envA.app).get('/api/articles/A1');
    expect(first.status).toBe(200);
    expect(first.body.data.viewCount).toBe(1);

    // 2 窗口内重复访问（2 次）：viewCount 仍为 1（去重）
    const repeat1 = await request(envA.app).get('/api/articles/A1');
    const repeat2 = await request(envA.app).get('/api/articles/A1');
    expect(repeat1.body.data.viewCount).toBe(1);
    expect(repeat2.body.data.viewCount).toBe(1);

    // 3 seam-STORE 断言：该 IP+文章 仅 1 条去重记录（窗口内；去重语义已由 viewCount 恒定证明）
    const records = envA.stores.readingRecordStore.findAll().filter((r) => r.articleId === 'A1');
    expect(records.length).toBe(1);

    // 场景 B：窗口参数化缩小（ID-8）验证窗口过期语义
    const envB = createTestEnv({ readingDedupWindowMs: 300 });
    const bloggerB = await seedUser(envB.stores, { username: 'it12b_blogger', email: 'it12b@example.com', role: 'blogger' });
    seedArticle(envB.stores, { id: 'A1', authorId: bloggerB.id, title: '窗口过期文章', status: 'published' });

    const b1 = await request(envB.app).get('/api/articles/A1');
    expect(b1.body.data.viewCount).toBe(1);
    const b2 = await request(envB.app).get('/api/articles/A1');
    expect(b2.body.data.viewCount).toBe(1); // 窗口内去重

    // 4 窗口过期后再访问：viewCount=2
    await new Promise((resolve) => setTimeout(resolve, 500));
    const b3 = await request(envB.app).get('/api/articles/A1');
    expect(b3.status).toBe(200);
    expect(b3.body.data.viewCount).toBe(2);
  });
});
