/**
 * 系统测试 · 内容与互动跨模块集成（ST-011~015）
 * ST-011 标签唯一 409 + 打标签 + 按标签筛选
 * ST-012 分类嵌套 ≤3 层 + 超深 400 + 按分类浏览
 * ST-013 浏览分页 + 草稿对读者 404 + 详情含作者信息
 * ST-014 评论立即可见 + 非作者删除 403 + 回复
 * ST-015 点赞幂等 + 收藏列表
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestEnv, seedUser, seedTag, seedCategory, seedArticle, seedComment, login, bearer } from './helpers';

describe('ST-011 标签创建唯一性 409 + 打标签 + 按标签筛选（跨模块集成，REQ-015）', () => {
  it('新建标签 201；重名 40901；打标签文章创建成功；按标签筛选返回正确文章集', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st11_blogger', email: 'st11b@example.com', role: 'blogger' });
    seedTag(env.stores, 'nodejs');
    const session = await login(env.app, 'st11b@example.com');

    // 1 创建新标签：201 + 标签对象
    const newTag = await request(env.app).post('/api/tags').set(bearer(session.token)).send({ name: 'typescript' });
    expect(newTag.status).toBe(201);
    expect(typeof newTag.body.data.tagId).toBe('string');

    // 2 重复创建「nodejs」：409 + TAG_ALREADY_EXISTS（40901）
    const dupTag = await request(env.app).post('/api/tags').set(bearer(session.token)).send({ name: 'nodejs' });
    expect(dupTag.status).toBe(409);
    expect(dupTag.body.error.code).toBe(40901);

    // 3 创建文章并打标签：201 + 文章含标签
    const article = await request(env.app)
      .post('/api/articles')
      .set(bearer(session.token))
      .send({ title: '打标签文章', body: '正文', tags: ['nodejs', 'typescript'] });
    expect(article.status).toBe(201);
    expect(article.body.data.tags).toEqual(['nodejs', 'typescript']);
    const articleId = article.body.data.articleId as string;

    // 4 发布后按标签筛选：200 + 仅含带 nodejs 标签的文章
    await request(env.app).post(`/api/articles/${articleId}/publish`).set(bearer(session.token));
    const filtered = await request(env.app).get('/api/articles').query({ tag: 'nodejs' });
    expect(filtered.status).toBe(200);
    const ids = filtered.body.data.items.map((i: { articleId: string }) => i.articleId);
    expect(ids).toContain(articleId);
    expect(filtered.body.data.total).toBe(1);
  });
});

describe('ST-012 分类嵌套 ≤3 层 + 超深 400 + 按分类浏览（跨模块集成，REQ-016/017）', () => {
  it('2/3 层创建成功；第 4 层 400/60003；文章归属分类后按分类浏览返回正确文章集', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st12_blogger', email: 'st12b@example.com', role: 'blogger' });
    seedCategory(env.stores, { name: '根分类', id: 'c1' });
    const session = await login(env.app, 'st12b@example.com');

    // 1 创建第 2 层分类：201
    const c2 = await request(env.app).post('/api/categories').set(bearer(session.token)).send({ name: 'backend', parentId: 'c1' });
    expect(c2.status).toBe(201);
    const c2Id = c2.body.data.categoryId as string;

    // 2 创建第 3 层分类：201
    const c3 = await request(env.app).post('/api/categories').set(bearer(session.token)).send({ name: 'web', parentId: c2Id });
    expect(c3.status).toBe(201);
    const c3Id = c3.body.data.categoryId as string;

    // 3 创建第 4 层分类：400 + CATEGORY_DEPTH_EXCEEDED（60003）
    const c4 = await request(env.app).post('/api/categories').set(bearer(session.token)).send({ name: 'tooDeep', parentId: c3Id });
    expect(c4.status).toBe(400);
    expect(c4.body.error.code).toBe(60003);

    // 4 文章归属 c2 并按分类浏览：200 + 含归属 c2 的文章
    const article = await request(env.app)
      .post('/api/articles')
      .set(bearer(session.token))
      .send({ title: '分类浏览文章', body: '正文', categoryId: c2Id });
    expect(article.status).toBe(201);
    const articleId = article.body.data.articleId as string;
    await request(env.app).post(`/api/articles/${articleId}/publish`).set(bearer(session.token));
    const byCat = await request(env.app).get('/api/articles').query({ categoryId: c2Id });
    expect(byCat.status).toBe(200);
    expect(byCat.body.data.items.map((i: { articleId: string }) => i.articleId)).toContain(articleId);
  });
});

describe('ST-013 浏览分页 + 草稿对读者 404 + 详情含作者信息（跨模块集成，REQ-017）', () => {
  it('分页仅含 published（total=15）；草稿详情 40402；已发布详情含正文+作者+阅读量', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st13_blogger', email: 'st13b@example.com', role: 'blogger' });
    // seed 15 篇已发布 + 3 篇草稿 + 1 篇归档（不同状态）
    for (let i = 1; i <= 15; i += 1) {
      seedArticle(env.stores, { id: `P${i}`, authorId: blogger.id, title: `已发布文章${i}`, status: 'published' });
    }
    seedArticle(env.stores, { id: 'D1', authorId: blogger.id, title: '草稿D1', status: 'draft' });
    seedArticle(env.stores, { id: 'D2', authorId: blogger.id, title: '草稿D2', status: 'draft' });
    seedArticle(env.stores, { id: 'D3', authorId: blogger.id, title: '草稿D3', status: 'draft' });
    seedArticle(env.stores, { id: 'AR1', authorId: blogger.id, title: '归档AR1', status: 'archived' });

    // 1 分页浏览第 1 页：200 + 10 条全部 published + total=15
    const page1 = await request(env.app).get('/api/articles').query({ page: 1, pageSize: 10 });
    expect(page1.status).toBe(200);
    expect(page1.body.data.total).toBe(15);
    expect(page1.body.data.items.length).toBe(10);
    expect(page1.body.data.items.every((i: { articleId: string }) => i.articleId.startsWith('P'))).toBe(true);

    // 2 第 2 页：200 + 剩余 5 条
    const page2 = await request(env.app).get('/api/articles').query({ page: 2, pageSize: 10 });
    expect(page2.status).toBe(200);
    expect(page2.body.data.items.length).toBe(5);

    // 3 读者访问草稿详情：404（40402 防枚举）
    const draftDetail = await request(env.app).get('/api/articles/D1');
    expect(draftDetail.status).toBe(404);
    expect(draftDetail.body.error.code).toBe(40402);

    // 4 读者访问已发布详情：200 + 正文 + author + 阅读量（实现字段 viewCount，设计 readCount 差异见测试报告）
    const pubDetail = await request(env.app).get('/api/articles/P1');
    expect(pubDetail.status).toBe(200);
    expect(pubDetail.body.data.body).toBeDefined();
    expect(pubDetail.body.data.author.userId).toBe(blogger.id);
    expect(typeof pubDetail.body.data.viewCount).toBe('number');
  });
});

describe('ST-014 评论立即可见 + 非作者删除 403 + 回复（跨模块集成，REQ-018）', () => {
  it('评论 201 立即可见；非文章作者删除 40301；文章作者删除 204；回复挂载正确', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st14_blogger', email: 'st14b@example.com', role: 'blogger' });
    const readerA = await seedUser(env.stores, { username: 'st14_reader_a', email: 'st14a@example.com' });
    await seedUser(env.stores, { username: 'st14_reader_b', email: 'st14d@example.com' });
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '评论文章', status: 'published' });

    const bloggerSession = await login(env.app, 'st14b@example.com');
    const sessionA = await login(env.app, 'st14a@example.com');
    const sessionB = await login(env.app, 'st14d@example.com');

    // 1 读者甲评论：201 + 评论列表立即可见
    const comment = await request(env.app)
      .post('/api/articles/A1/comments')
      .set(bearer(sessionA.token))
      .send({ content: '第一条' });
    expect(comment.status).toBe(201);
    const cid = comment.body.data.commentId as string;
    expect((await request(env.app).get('/api/articles/A1/comments')).body.data.total).toBe(1);

    // 2 读者乙删除读者甲的评论：403 + 40301
    const delByB = await request(env.app).delete(`/api/articles/A1/comments/${cid}`).set(bearer(sessionB.token));
    expect(delByB.status).toBe(403);
    expect(delByB.body.error.code).toBe(40301);

    // 3 文章作者（博主）删除该评论：204 + 评论消失
    const delByAuthor = await request(env.app).delete(`/api/articles/A1/comments/${cid}`).set(bearer(bloggerSession.token));
    expect(delByAuthor.status).toBe(204);
    expect(env.stores.commentStore.findById(cid)).toBeNull();

    // 4 回复评论：201 + 回复挂载正确（parentId）
    const newComment = await request(env.app)
      .post('/api/articles/A1/comments')
      .set(bearer(sessionA.token))
      .send({ content: '再次评论' });
    const cid2 = newComment.body.data.commentId as string;
    const reply = await request(env.app)
      .post(`/api/articles/A1/comments/${cid2}/reply`)
      .set(bearer(bloggerSession.token))
      .send({ content: '回复', parentId: cid2 });
    expect(reply.status).toBe(201);
    expect(reply.body.data.parentId).toBe(cid2);
    void readerA;
  });
});

describe('ST-015 点赞幂等 + 收藏列表（跨模块集成，REQ-019）', () => {
  it('点赞后计数 +1；重复点赞幂等不重复计数；收藏后详情计数；收藏列表返回收藏文章', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st15_blogger', email: 'st15b@example.com', role: 'blogger' });
    const reader = await seedUser(env.stores, { username: 'st15_reader', email: 'st15r@example.com' });
    seedArticle(env.stores, { id: 'P1', authorId: blogger.id, title: '点赞收藏文章', status: 'published' });
    const session = await login(env.app, 'st15r@example.com');

    // 1 点赞：200 + likeCount=1（详情聚合）
    const like1 = await request(env.app).post('/api/articles/P1/like').set(bearer(session.token));
    expect(like1.status).toBe(200);
    expect(like1.body.data.liked).toBe(true);

    // 2 再次点赞：200 + liked=true（幂等，不重复计数）
    const like2 = await request(env.app).post('/api/articles/P1/like').set(bearer(session.token));
    expect(like2.status).toBe(200);
    expect(like2.body.data.liked).toBe(true);
    expect(env.stores.likeStore.countByArticle('P1')).toBe(1);

    // 3 收藏：200 + favorited=true；详情 favoriteCount=1
    const fav = await request(env.app).post('/api/articles/P1/favorite').set(bearer(session.token));
    expect(fav.status).toBe(200);
    expect(fav.body.data.favorited).toBe(true);
    const detail = await request(env.app).get('/api/articles/P1');
    expect(detail.body.data.likeCount).toBe(1);
    expect(detail.body.data.favoriteCount).toBe(1);

    // 4 查收藏列表：200 + 含 P1
    const favList = await request(env.app).get('/api/me/favorites').set(bearer(session.token));
    expect(favList.status).toBe(200);
    expect(favList.body.data.items.map((i: { articleId: string }) => i.articleId)).toContain('P1');
  });
});
