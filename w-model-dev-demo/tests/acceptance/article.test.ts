/**
 * 验收测试 · 内容发布与管理（UAT-013~024，REQ-011~014）
 * 路径映射：docs/uat-path-mapping.md（PATCH→PUT 等价映射；GET /api/users/me/articles→GET /api/blogger/articles 等价）。
 * 契约说明：创建文章参数 title/body（INTF-005）；状态机非法流转 60001 → HTTP 409（INTF §0.3）；
 * 编辑已发布文章置回 draft（INTF-008）；分页参数 page/pageSize（INTF §0.2）。
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestEnv, seedUser, seedTag, seedCategory, seedArticle, login, bearer } from './helpers';

async function seedBlogger(env: ReturnType<typeof createTestEnv>, username: string, email: string) {
  return seedUser(env.stores, { username, email, role: 'blogger' });
}

describe('UAT-013 博主创建文章为草稿状态（正常路径，REQ-011）', () => {
  it('创建含标题/正文/摘要/标签/分类的文章 → 201 + status=draft', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat13_b', 'uat13@example.com');
    seedTag(env.stores, 'tag-web');
    seedCategory(env.stores, { id: 'cat-tech', name: '技术', depth: 1 });
    const session = await login(env.app, 'uat13@example.com');
    const res = await request(env.app)
      .post('/api/articles')
      .set(bearer(session.token))
      .send({ title: '标题', body: '正文', summary: '摘要', tags: ['tag-web'], categoryId: 'cat-tech' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.title).toBe('标题');
    expect(res.body.data.summary).toBe('摘要');
    expect(res.body.data.tags).toContain('tag-web');
    expect(res.body.data.categoryId).toBe('cat-tech');
    expect(res.body.data.author.userId).toBe(blogger.id);
  });
});

describe('UAT-014 创建文章缺必填字段被拒（边界路径，REQ-011）', () => {
  it('缺 title 创建 400；文章数不增加', async () => {
    const env = createTestEnv();
    await seedBlogger(env, 'uat14_b', 'uat14@example.com');
    const session = await login(env.app, 'uat14@example.com');
    const res = await request(env.app).post('/api/articles').set(bearer(session.token)).send({ body: '正文' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(40001);
    expect(res.body.error.message).toBeTruthy();
    const list = await request(env.app).get('/api/blogger/articles').set(bearer(session.token));
    expect(list.body.data.total).toBe(0);
  });
});

describe('UAT-015 发布草稿后读者可见（正常路径，REQ-012）', () => {
  it('发布草稿 → published；读者列表与详情可见', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat15_b', 'uat15@example.com');
    seedArticle(env.stores, { id: 'art15', authorId: blogger.id, title: '草稿文', status: 'draft' });
    const session = await login(env.app, 'uat15@example.com');
    const pub = await request(env.app).post('/api/articles/art15/publish').set(bearer(session.token));
    expect(pub.status).toBe(200);
    expect(pub.body.data.status).toBe('published');
    const list = await request(env.app).get('/api/articles');
    expect(list.body.data.items.some((i: { articleId: string }) => i.articleId === 'art15')).toBe(true);
    const detail = await request(env.app).get('/api/articles/art15');
    expect(detail.status).toBe(200);
    expect(detail.body.data.body).toBeTruthy();
    expect(detail.body.data.author.username).toBe('uat15_b');
  });
});

describe('UAT-016 已发布文章更新后重新发布（正常路径，REQ-012）', () => {
  it('编辑已发布文章（置回 draft）→ 重新发布 → 读者可见更新内容', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat16_b', 'uat16@example.com');
    seedArticle(env.stores, { id: 'art-pub-1', authorId: blogger.id, title: '原标题', status: 'published' });
    const session = await login(env.app, 'uat16@example.com');
    const update = await request(env.app)
      .put('/api/articles/art-pub-1')
      .set(bearer(session.token))
      .send({ title: '更新标题', body: '更新正文' });
    expect(update.status).toBe(200);
    expect(update.body.data.status).toBe('draft'); // INTF-008：编辑已发布置回 draft
    const repub = await request(env.app).post('/api/articles/art-pub-1/publish').set(bearer(session.token));
    expect(repub.status).toBe(200);
    expect(repub.body.data.status).toBe('published');
    const detail = await request(env.app).get('/api/articles/art-pub-1');
    expect(detail.body.data.title).toBe('更新标题');
    expect(detail.body.data.body).toBe('更新正文');
  });
});

describe('UAT-017 发布不存在/他人文章被拒（异常路径，REQ-012）', () => {
  it('发布不存在 404 + 40401；发布他人文章 403 + 40301', async () => {
    const env = createTestEnv();
    await seedBlogger(env, 'uat17_a', 'uat17a@example.com');
    const bloggerB = await seedBlogger(env, 'uat17_b', 'uat17b@example.com');
    seedArticle(env.stores, { id: 'art-b2', authorId: bloggerB.id, title: 'B 草稿', status: 'draft' });
    const sessionA = await login(env.app, 'uat17a@example.com');
    const notFound = await request(env.app).post('/api/articles/art-nonexist/publish').set(bearer(sessionA.token));
    expect(notFound.status).toBe(404);
    expect(notFound.body.error.code).toBe(40401);
    const forbidden = await request(env.app).post('/api/articles/art-b2/publish').set(bearer(sessionA.token));
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe(40301);
    expect(env.stores.articleStore.findById('art-b2')!.status).toBe('draft');
  });
});

describe('UAT-018 文章状态机合法流转（正常路径，REQ-013）', () => {
  it('draft → published → archived 全链路，终态 archived', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat18_b', 'uat18@example.com');
    seedArticle(env.stores, { id: 'art18', authorId: blogger.id, title: '状态机文章', status: 'draft' });
    const session = await login(env.app, 'uat18@example.com');
    const pub = await request(env.app).post('/api/articles/art18/publish').set(bearer(session.token));
    expect(pub.body.data.status).toBe('published');
    const arch = await request(env.app).post('/api/articles/art18/archive').set(bearer(session.token));
    expect(arch.body.data.status).toBe('archived');
    const list = await request(env.app).get('/api/blogger/articles').set(bearer(session.token));
    const mine = list.body.data.items.find((i: { articleId: string }) => i.articleId === 'art18');
    expect(mine.status).toBe('archived');
  });
});

describe('UAT-019 已发布文章不可删除（异常路径，REQ-013/REQ-014）', () => {
  it('DELETE 已发布文章 409 + 60001；文章仍存在且 published', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat19_b', 'uat19@example.com');
    seedArticle(env.stores, { id: 'art19', authorId: blogger.id, title: '已发布文', status: 'published' });
    const session = await login(env.app, 'uat19@example.com');
    const del = await request(env.app).delete('/api/articles/art19').set(bearer(session.token));
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe(60001);
    const detail = await request(env.app).get('/api/articles/art19');
    expect(detail.status).toBe(200);
    expect(detail.body.data.title).toBe('已发布文');
  });
});

describe('UAT-020 已归档文章不可直接再发布（边界路径，REQ-013）', () => {
  it('archived 直接发布 → 409 + 60001，状态不变', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat20_b', 'uat20@example.com');
    seedArticle(env.stores, { id: 'art20', authorId: blogger.id, title: '归档文', status: 'archived' });
    const session = await login(env.app, 'uat20@example.com');
    const pub = await request(env.app).post('/api/articles/art20/publish').set(bearer(session.token));
    expect(pub.status).toBe(409);
    expect(pub.body.error.code).toBe(60001);
    expect(env.stores.articleStore.findById('art20')!.status).toBe('archived');
  });
});

describe('UAT-021 取消归档回草稿后可再发布（边界路径，REQ-013）', () => {
  it('unarchive 回 draft → 再 publish 成功，状态机闭环', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat21_b', 'uat21@example.com');
    seedArticle(env.stores, { id: 'art21', authorId: blogger.id, title: '归档复原文', status: 'archived' });
    const session = await login(env.app, 'uat21@example.com');
    const unarch = await request(env.app).post('/api/articles/art21/unarchive').set(bearer(session.token));
    expect(unarch.body.data.status).toBe('draft');
    const pub = await request(env.app).post('/api/articles/art21/publish').set(bearer(session.token));
    expect(pub.body.data.status).toBe('published');
  });
});

describe('UAT-022 查看文章列表（草稿+已发布，分页）（正常路径，REQ-014）', () => {
  it('GET /api/blogger/articles 分页：page1 两条 + total=3，draft/published 并存；page2 剩余一条', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat22_b', 'uat22@example.com');
    seedArticle(env.stores, { id: 'd1', authorId: blogger.id, title: '草稿1', status: 'draft' });
    seedArticle(env.stores, { id: 'd2', authorId: blogger.id, title: '草稿2', status: 'draft' });
    seedArticle(env.stores, { id: 'p1', authorId: blogger.id, title: '发布1', status: 'published' });
    const session = await login(env.app, 'uat22@example.com');
    const page1 = await request(env.app).get('/api/blogger/articles').query({ page: 1, pageSize: 2 }).set(bearer(session.token));
    expect(page1.status).toBe(200);
    expect(page1.body.data.items.length).toBe(2);
    expect(page1.body.data.total).toBe(3);
    const page2 = await request(env.app).get('/api/blogger/articles').query({ page: 2, pageSize: 2 }).set(bearer(session.token));
    expect(page2.body.data.items.length).toBe(1);
    expect(page2.body.data.total).toBe(3);
    // 两页合并断言状态混合（列表排序不保证 published 位于首页，仅断言全集覆盖两种状态）
    const allStatuses = [...page1.body.data.items, ...page2.body.data.items].map((i: { status: string }) => i.status);
    expect(allStatuses).toContain('draft');
    expect(allStatuses).toContain('published');
    expect(allStatuses.length).toBe(3);
  });
});

describe('UAT-023 编辑文章（正常路径，REQ-014）', () => {
  it('编辑自己文章标题/摘要 → 200，修改持久化', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat23_b', 'uat23@example.com');
    seedArticle(env.stores, { id: 'art23', authorId: blogger.id, title: '旧标题', summary: '旧摘要', status: 'draft' });
    const session = await login(env.app, 'uat23@example.com');
    const edit = await request(env.app)
      .put('/api/articles/art23')
      .set(bearer(session.token))
      .send({ title: '新标题', summary: '新摘要' });
    expect(edit.status).toBe(200);
    expect(edit.body.data.title).toBe('新标题');
    const list = await request(env.app).get('/api/blogger/articles').set(bearer(session.token));
    const mine = list.body.data.items.find((i: { articleId: string }) => i.articleId === 'art23');
    expect(mine.title).toBe('新标题');
  });
});

describe('UAT-024 删除草稿成功、已发布仅可归档（边界路径，REQ-014/REQ-013）', () => {
  it('删除草稿 204；草稿对读者 404；删除已发布 409 + 60001', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat24_b', 'uat24@example.com');
    seedArticle(env.stores, { id: 'art-d1', authorId: blogger.id, title: '删草稿', status: 'draft' });
    seedArticle(env.stores, { id: 'art-p1', authorId: blogger.id, title: '已发布', status: 'published' });
    const session = await login(env.app, 'uat24@example.com');
    const delDraft = await request(env.app).delete('/api/articles/art-d1').set(bearer(session.token));
    expect(delDraft.status).toBe(204);
    const gone = await request(env.app).get('/api/articles/art-d1');
    expect(gone.status).toBe(404);
    const delPub = await request(env.app).delete('/api/articles/art-p1').set(bearer(session.token));
    expect(delPub.status).toBe(409);
    expect(delPub.body.error.code).toBe(60001);
  });
});
