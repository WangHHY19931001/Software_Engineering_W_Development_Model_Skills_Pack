/**
 * 集成测试 · 内容域（INTF-005~008，REQ-011~014）
 * IT-003 创建文章：非博主（reader）403（跨模块博主权限校验）
 * IT-004 创建文章引用不存在标签/分类 404；标签重名 409
 * IT-005 发布/归档状态机非法流转 60001
 * IT-009 归档→取消归档：状态机回 draft 且读者不可见
 * IT-010 删除文章：已发布 409（仅可归档）、草稿 204
 * IT-029 越权修改/删除他人文章 403（跨模块归属校验）
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestEnv, seedUser, seedTag, seedCategory, seedArticle, login, bearer } from './helpers';

describe('IT-003 创建文章：非博主（reader）403（跨模块博主权限校验）', () => {
  it('reader 40301 / blogger 201 draft / 无令牌 40101；无越权写入', async () => {
    const env = createTestEnv();
    await seedUser(env.stores, { username: 'it3_reader', email: 'it3r@example.com' });
    const blogger = await seedUser(env.stores, { username: 'it3_blogger', email: 'it3b@example.com', role: 'blogger' });
    seedTag(env.stores, 't1');
    seedCategory(env.stores, { name: '分类一', id: 'c_1' });

    const reader = await login(env.app, 'it3r@example.com');
    const bloggerSession = await login(env.app, 'it3b@example.com');
    const beforeCount = env.stores.articleStore.findAll().length;

    // 1 reader 创建文章：403 + error.code=40301；article store 无新增
    const readerRes = await request(env.app)
      .post('/api/articles')
      .set(bearer(reader.token))
      .send({ title: '越权文', body: '正文', tags: ['t1'], categoryId: 'c_1' });
    expect(readerRes.status).toBe(403);
    expect(readerRes.body.error.code).toBe(40301);
    expect(env.stores.articleStore.findAll().length).toBe(beforeCount);

    // 2 blogger 创建文章（对照组）：201 + status=draft
    const bloggerRes = await request(env.app)
      .post('/api/articles')
      .set(bearer(bloggerSession.token))
      .send({ title: '合法文', body: '正文', tags: ['t1'], categoryId: 'c_1' });
    expect(bloggerRes.status).toBe(201);
    expect(bloggerRes.body.data.status).toBe('draft');
    expect(bloggerRes.body.data.author.userId).toBe(blogger.id);

    // 3 未携带 JWT 创建：401 + error.code=40101
    const noAuthRes = await request(env.app)
      .post('/api/articles')
      .send({ title: '匿名文', body: '正文' });
    expect(noAuthRes.status).toBe(401);
    expect(noAuthRes.body.error.code).toBe(40101);
  });
});

describe('IT-004 创建文章引用不存在标签/分类 404；标签重名 409', () => {
  it('标签/分类存在性校验 40401；标签唯一性 40901；新建标签 201', async () => {
    const env = createTestEnv();
    await seedUser(env.stores, { username: 'it4_blogger', email: 'it4@example.com', role: 'blogger' });
    seedTag(env.stores, '存在标签');
    seedCategory(env.stores, { name: '分类一', id: 'c_1' });

    const blogger = await login(env.app, 'it4@example.com');

    // 1 引用不存在标签：404 + error.code=40401
    const badTag = await request(env.app)
      .post('/api/articles')
      .set(bearer(blogger.token))
      .send({ title: 't', body: 'b', tags: ['不存在标签'] });
    expect(badTag.status).toBe(404);
    expect(badTag.body.error.code).toBe(40401);

    // 2 引用不存在分类：404 + error.code=40401
    const badCat = await request(env.app)
      .post('/api/articles')
      .set(bearer(blogger.token))
      .send({ title: 't', body: 'b', categoryId: 'c_not_exist' });
    expect(badCat.status).toBe(404);
    expect(badCat.body.error.code).toBe(40401);

    // 3 创建重名标签：409 + error.code=40901
    const dupTag = await request(env.app)
      .post('/api/tags')
      .set(bearer(blogger.token))
      .send({ name: '存在标签' });
    expect(dupTag.status).toBe(409);
    expect(dupTag.body.error.code).toBe(40901);

    // 4 创建新标签：201 + 返回 tagId
    const newTag = await request(env.app)
      .post('/api/tags')
      .set(bearer(blogger.token))
      .send({ name: '新标签' });
    expect(newTag.status).toBe(201);
    expect(typeof newTag.body.data.tagId).toBe('string');
  });
});

describe('IT-005 发布/归档状态机非法流转 60001', () => {
  it('draft→published 合法；archived→published 直跳 60001；draft→archive 60001；重复发布幂等', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'it5_blogger', email: 'it5@example.com', role: 'blogger' });
    seedTag(env.stores, 't1');
    const a1 = seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '草稿A1', tags: ['t1'] });
    const a2 = seedArticle(env.stores, { id: 'A2', authorId: blogger.id, title: '已发布A2', status: 'published' });

    const session = await login(env.app, 'it5@example.com');

    // 1 发布草稿 A1：200 + status=published
    const pub1 = await request(env.app).post('/api/articles/A1/publish').set(bearer(session.token));
    expect(pub1.status).toBe(200);
    expect(pub1.body.data.status).toBe('published');

    // 2 归档 A2（published）：200 + status=archived
    const arch = await request(env.app).post('/api/articles/A2/archive').set(bearer(session.token));
    expect(arch.status).toBe(200);
    expect(arch.body.data.status).toBe('archived');

    // 3 归档后直接发布：409 + error.code=60001（须先 unarchive）
    const pubArchived = await request(env.app).post('/api/articles/A2/publish').set(bearer(session.token));
    expect(pubArchived.status).toBe(409);
    expect(pubArchived.body.error.code).toBe(60001);

    // 4 draft 直接归档：新建草稿 A3 → 409 + error.code=60001
    const created = await request(env.app)
      .post('/api/articles')
      .set(bearer(session.token))
      .send({ title: '草稿A3', body: '正文', tags: ['t1'] });
    expect(created.status).toBe(201);
    const a3Id = created.body.data.articleId as string;
    const archDraft = await request(env.app).post(`/api/articles/${a3Id}/archive`).set(bearer(session.token));
    expect(archDraft.status).toBe(409);
    expect(archDraft.body.error.code).toBe(60001);

    // 5 已发布重复发布：200（幂等，不报错）
    const repub = await request(env.app).post('/api/articles/A1/publish').set(bearer(session.token));
    expect(repub.status).toBe(200);
    expect(repub.body.data.status).toBe('published');
    void a1;
    void a2;
  });
});

describe('IT-009 归档→取消归档：状态机回 draft 且读者不可见', () => {
  it('published→archived 读者不可见 → unarchive→draft 仍隐藏（40402）', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'it9_blogger', email: 'it9@example.com', role: 'blogger' });
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '已发布文章A1', status: 'published' });

    const session = await login(env.app, 'it9@example.com');

    // 1 归档 A1：200 + status=archived
    const arch = await request(env.app).post('/api/articles/A1/archive').set(bearer(session.token));
    expect(arch.status).toBe(200);
    expect(arch.body.data.status).toBe('archived');

    // 2 读者浏览列表：A1 不出现
    const list = await request(env.app).get('/api/articles');
    expect(list.status).toBe(200);
    const ids = list.body.data.items.map((item: { articleId: string }) => item.articleId);
    expect(ids).not.toContain('A1');

    // 3 读者访问详情：404 + error.code=40402（防枚举）
    const detail = await request(env.app).get('/api/articles/A1');
    expect(detail.status).toBe(404);
    expect(detail.body.error.code).toBe(40402);

    // 4 取消归档：200 + status=draft
    const unarch = await request(env.app).post('/api/articles/A1/unarchive').set(bearer(session.token));
    expect(unarch.status).toBe(200);
    expect(unarch.body.data.status).toBe('draft');

    // 5 读者再访问详情：404 + error.code=40402（draft 仍隐藏）
    const detail2 = await request(env.app).get('/api/articles/A1');
    expect(detail2.status).toBe(404);
    expect(detail2.body.error.code).toBe(40402);
  });
});

describe('IT-010 删除文章：已发布 409（仅可归档）、草稿 204', () => {
  it('删草稿 204 + store 移除；删已发布/归档 60001；删不存在 40401', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'it10_blogger', email: 'it10@example.com', role: 'blogger' });
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '草稿A1' });
    seedArticle(env.stores, { id: 'A2', authorId: blogger.id, title: '已发布A2', status: 'published' });
    seedArticle(env.stores, { id: 'A3', authorId: blogger.id, title: '归档A3', status: 'archived' });

    const session = await login(env.app, 'it10@example.com');

    // 1 删除草稿 A1：204 无 body；article store 无 A1
    const delDraft = await request(env.app).delete('/api/articles/A1').set(bearer(session.token));
    expect(delDraft.status).toBe(204);
    expect(env.stores.articleStore.findById('A1')).toBeNull();

    // 2 删除已发布 A2：409 + error.code=60001（仅可归档）
    const delPublished = await request(env.app).delete('/api/articles/A2').set(bearer(session.token));
    expect(delPublished.status).toBe(409);
    expect(delPublished.body.error.code).toBe(60001);

    // 3 删除已归档 A3：409 + error.code=60001
    const delArchived = await request(env.app).delete('/api/articles/A3').set(bearer(session.token));
    expect(delArchived.status).toBe(409);
    expect(delArchived.body.error.code).toBe(60001);

    // 4 删除不存在文章：404 + error.code=40401
    const delGhost = await request(env.app).delete('/api/articles/A_ghost').set(bearer(session.token));
    expect(delGhost.status).toBe(404);
    expect(delGhost.body.error.code).toBe(40401);
  });
});

describe('IT-029 越权修改/删除他人文章 403（跨模块归属校验）', () => {
  it('博主 A 修改/删除博主 B 的文章 40301；B 管理列表隔离；B 本人删除 204', async () => {
    const env = createTestEnv();
    await seedUser(env.stores, { username: 'it29_blogger_a', email: 'it29a@example.com', role: 'blogger' });
    const bloggerB = await seedUser(env.stores, { username: 'it29_blogger_b', email: 'it29b@example.com', role: 'blogger' });
    const a1 = seedArticle(env.stores, { id: 'A1', authorId: bloggerB.id, title: 'B的文章', body: '原始正文' });

    const sessionA = await login(env.app, 'it29a@example.com');
    const sessionB = await login(env.app, 'it29b@example.com');

    // 1 博主 A 修改 B 的文章：403 + error.code=40301；A1 内容不变
    const putRes = await request(env.app)
      .put('/api/articles/A1')
      .set(bearer(sessionA.token))
      .send({ title: '篡改' });
    expect(putRes.status).toBe(403);
    expect(putRes.body.error.code).toBe(40301);
    expect(env.stores.articleStore.findById('A1')?.title).toBe('B的文章');

    // 2 博主 A 删除 B 的文章：403 + error.code=40301
    const delRes = await request(env.app).delete('/api/articles/A1').set(bearer(sessionA.token));
    expect(delRes.status).toBe(403);
    expect(delRes.body.error.code).toBe(40301);

    // 3 博主 B 管理列表隔离：仅含 B 的文章（A1 在内，未被 A 影响）
    const myList = await request(env.app).get('/api/blogger/articles').set(bearer(sessionB.token));
    expect(myList.status).toBe(200);
    const ids = myList.body.data.items.map((item: { articleId: string }) => item.articleId);
    expect(ids).toContain('A1');

    // 4 作者 B 正常删除：204（对照组）
    const delByAuthor = await request(env.app).delete('/api/articles/A1').set(bearer(sessionB.token));
    expect(delByAuthor.status).toBe(204);
    void a1;
  });
});
