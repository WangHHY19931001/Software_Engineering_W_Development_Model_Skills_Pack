/**
 * 验收测试 · 浏览域（UAT-030~032，REQ-017）
 * 路径映射：docs/uat-path-mapping.md（直接映射）。
 * 契约说明：筛选参数 categoryId/tag（INTF-011）；草稿/归档对读者 40402（防枚举）；阅读量字段 viewCount。
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestEnv, seedUser, seedTag, seedCategory, seedArticle } from './helpers';

async function seedBlogger(env: ReturnType<typeof createTestEnv>, username: string, email: string) {
  return seedUser(env.stores, { username, email, role: 'blogger' });
}

describe('UAT-030 分页浏览已发布文章（正常路径，REQ-017）', () => {
  it('GET /api/articles 分页仅返回 published：page1 两条 + total=3，无草稿', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat30_b', 'uat30@example.com');
    seedArticle(env.stores, { id: 'p1', authorId: blogger.id, title: '已发布1', status: 'published' });
    seedArticle(env.stores, { id: 'p2', authorId: blogger.id, title: '已发布2', status: 'published' });
    seedArticle(env.stores, { id: 'p3', authorId: blogger.id, title: '已发布3', status: 'published' });
    seedArticle(env.stores, { id: 'd1', authorId: blogger.id, title: '草稿', status: 'draft' });
    const page1 = await request(env.app).get('/api/articles').query({ page: 1, pageSize: 2 });
    expect(page1.status).toBe(200);
    expect(page1.body.data.items.length).toBe(2);
    expect(page1.body.data.total).toBe(3);
    expect(page1.body.data.items.every((i: { articleId: string }) => i.articleId !== 'd1')).toBe(true);
  });
});

describe('UAT-031 按分类/标签筛选文章（正常路径，REQ-017/REQ-015/REQ-016）', () => {
  it('categoryId + tag 组合筛选仅返回匹配的已发布文章', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat31_b', 'uat31@example.com');
    seedTag(env.stores, 'tag-ts');
    seedCategory(env.stores, { id: 'cat-tech', name: '技术', depth: 1 });
    seedArticle(env.stores, { id: 'm1', authorId: blogger.id, title: '匹配1', tags: ['tag-ts'], categoryId: 'cat-tech', status: 'published' });
    seedArticle(env.stores, { id: 'm2', authorId: blogger.id, title: '匹配2', tags: ['tag-ts'], categoryId: 'cat-tech', status: 'published' });
    seedArticle(env.stores, { id: 'nm', authorId: blogger.id, title: '未打标', status: 'published' });
    const res = await request(env.app).get('/api/articles').query({ categoryId: 'cat-tech', tag: 'tag-ts' });
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    const ids = res.body.data.items.map((i: { articleId: string }) => i.articleId);
    expect(ids).toEqual(expect.arrayContaining(['m1', 'm2']));
    expect(ids).not.toContain('nm');
  });
});

describe('UAT-032 文章详情含正文与作者；草稿对读者 404（边界路径，REQ-017）', () => {
  it('已发布详情 200 含 title/content/author；草稿详情 404 + 40402', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat32_b', 'uat32@example.com');
    seedArticle(env.stores, { id: 'art-v1', authorId: blogger.id, title: '可见文章', body: '正文内容', status: 'published' });
    seedArticle(env.stores, { id: 'art-v2', authorId: blogger.id, title: '草稿文', status: 'draft' });
    const detail = await request(env.app).get('/api/articles/art-v1');
    expect(detail.status).toBe(200);
    expect(detail.body.data.title).toBe('可见文章');
    expect(detail.body.data.body).toBe('正文内容');
    expect(detail.body.data.author).toHaveProperty('userId');
    expect(detail.body.data.author).toHaveProperty('username');
    expect(detail.body.data.author.username).toBe('uat32_b');
    const draft = await request(env.app).get('/api/articles/art-v2');
    expect(draft.status).toBe(404);
    expect(draft.body.error.code).toBe(40402);
  });
});
