/**
 * 验收测试 · 互动域（UAT-033~040，REQ-018~020）
 * 路径映射：docs/uat-path-mapping.md（评论 DELETE/POST 等价映射；favorites/feed 等价映射）。
 * 契约说明：点赞/收藏幂等（重复 POST 200 不重复计数）；评论删除仅文章作者（非作者 40301）；feed 仅含已关注博主已发布文章。
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestEnv, seedUser, seedArticle, seedComment, login, bearer } from './helpers';

async function seedBlogger(env: ReturnType<typeof createTestEnv>, username: string, email: string) {
  return seedUser(env.stores, { username, email, role: 'blogger' });
}

describe('UAT-033 发表评论审核自动通过（正常路径，REQ-018）', () => {
  it('评论 201 + 立即可见（自动审核通过）', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat33_b', 'uat33@example.com');
    seedArticle(env.stores, { id: 'art33', authorId: blogger.id, title: '评论目标文', status: 'published' });
    await seedUser(env.stores, { username: 'uat33_u', email: 'uat33u@example.com' });
    const session = await login(env.app, 'uat33u@example.com');
    const create = await request(env.app)
      .post('/api/articles/art33/comments')
      .set(bearer(session.token))
      .send({ content: '好文！' });
    expect(create.status).toBe(201);
    expect(create.body.data.commentId).toBeTruthy();
    const list = await request(env.app).get('/api/articles/art33/comments');
    expect(list.body.data.items.some((c: { content: string }) => c.content === '好文！')).toBe(true);
  });
});

describe('UAT-034 未登录发表评论被拒（异常路径，REQ-018）', () => {
  it('无 token 评论 → 401 + 40101，评论不创建', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat34_b', 'uat34@example.com');
    seedArticle(env.stores, { id: 'art34', authorId: blogger.id, title: '目标文', status: 'published' });
    const res = await request(env.app).post('/api/articles/art34/comments').send({ content: '匿名评论' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(40101);
    expect(env.stores.commentStore.findAll().length).toBe(0);
  });
});

describe('UAT-035 作者删除评论、非作者被拒、支持回复（异常+正常，REQ-018）', () => {
  it('非作者删除 403；文章作者删除 204；评论可回复（201 挂载 parentId）', async () => {
    const env = createTestEnv();
    const bloggerA = await seedBlogger(env, 'uat35_a', 'uat35a@example.com');
    await seedUser(env.stores, { username: 'uat35_u', email: 'uat35u@example.com' });
    seedArticle(env.stores, { id: 'art35', authorId: bloggerA.id, title: '评论管理文', status: 'published' });
    seedComment(env.stores, { id: 'cmt-1', articleId: 'art35', authorId: 'u_other', content: '待删评论' });
    seedComment(env.stores, { id: 'cmt-2', articleId: 'art35', authorId: 'u_other', content: '被回复评论' });
    const sessionReader = await login(env.app, 'uat35u@example.com');
    const sessionAuthor = await login(env.app, 'uat35a@example.com');
    const forbidden = await request(env.app).delete('/api/articles/art35/comments/cmt-1').set(bearer(sessionReader.token));
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe(40301);
    const deleted = await request(env.app).delete('/api/articles/art35/comments/cmt-1').set(bearer(sessionAuthor.token));
    expect(deleted.status).toBe(204);
    const reply = await request(env.app)
      .post('/api/articles/art35/comments/cmt-2/reply')
      .set(bearer(sessionReader.token))
      .send({ content: '谢谢' });
    expect(reply.status).toBe(201);
    expect(reply.body.data.parentId).toBe('cmt-2');
  });
});

describe('UAT-036 点赞文章且详情展示点赞数（正常路径，REQ-019）', () => {
  it('点赞 200；详情 likeCount=1', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat36_b', 'uat36@example.com');
    seedArticle(env.stores, { id: 'art36', authorId: blogger.id, title: '点赞目标文', status: 'published' });
    await seedUser(env.stores, { username: 'uat36_u', email: 'uat36u@example.com' });
    const session = await login(env.app, 'uat36u@example.com');
    const like = await request(env.app).post('/api/articles/art36/like').set(bearer(session.token));
    expect(like.status).toBe(200);
    const detail = await request(env.app).get('/api/articles/art36');
    expect(detail.body.data.likeCount).toBe(1);
  });
});

describe('UAT-037 收藏文章并查看收藏列表（正常路径，REQ-019）', () => {
  it('收藏 2 篇文章；GET /api/me/favorites 返回 2 篇', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat37_b', 'uat37@example.com');
    seedArticle(env.stores, { id: 'f1', authorId: blogger.id, title: '收藏1', status: 'published' });
    seedArticle(env.stores, { id: 'f2', authorId: blogger.id, title: '收藏2', status: 'published' });
    await seedUser(env.stores, { username: 'uat37_u', email: 'uat37u@example.com' });
    const session = await login(env.app, 'uat37u@example.com');
    const fav1 = await request(env.app).post('/api/articles/f1/favorite').set(bearer(session.token));
    const fav2 = await request(env.app).post('/api/articles/f2/favorite').set(bearer(session.token));
    expect(fav1.status).toBe(200);
    expect(fav2.status).toBe(200);
    const list = await request(env.app).get('/api/me/favorites').set(bearer(session.token));
    expect(list.status).toBe(200);
    expect(list.body.data.items.length).toBe(2);
    expect(list.body.data.total).toBe(2);
  });
});

describe('UAT-038 重复点赞幂等（边界路径，REQ-019）', () => {
  it('同一用户连续点赞两次均 200；likeCount 不累加（=1）', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat38_b', 'uat38@example.com');
    seedArticle(env.stores, { id: 'art38', authorId: blogger.id, title: '幂等目标文', status: 'published' });
    await seedUser(env.stores, { username: 'uat38_u', email: 'uat38u@example.com' });
    const session = await login(env.app, 'uat38u@example.com');
    const first = await request(env.app).post('/api/articles/art38/like').set(bearer(session.token));
    const second = await request(env.app).post('/api/articles/art38/like').set(bearer(session.token));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const detail = await request(env.app).get('/api/articles/art38');
    expect(detail.body.data.likeCount).toBe(1);
  });
});

describe('UAT-039 关注博主后 feed 出现其新文章（正常路径，REQ-020）', () => {
  it('U 关注 B；B 发布新文章；U 的 feed 含该文章', async () => {
    const env = createTestEnv();
    const bloggerB = await seedBlogger(env, 'uat39_b', 'uat39b@example.com');
    await seedUser(env.stores, { username: 'uat39_u', email: 'uat39u@example.com' });
    const sessionU = await login(env.app, 'uat39u@example.com');
    const follow = await request(env.app).post(`/api/users/${bloggerB.id}/follow`).set(bearer(sessionU.token));
    expect(follow.status).toBe(200);
    const sessionB = await login(env.app, 'uat39b@example.com');
    const create = await request(env.app).post('/api/articles').set(bearer(sessionB.token)).send({ title: 'B 的新文章', body: '正文' });
    expect(create.status).toBe(201);
    const pub = await request(env.app).post(`/api/articles/${create.body.data.articleId}/publish`).set(bearer(sessionB.token));
    expect(pub.status).toBe(200);
    const feed = await request(env.app).get('/api/me/feed').set(bearer(sessionU.token));
    expect(feed.status).toBe(200);
    expect(feed.body.data.items.some((i: { articleId: string }) => i.articleId === create.body.data.articleId)).toBe(true);
  });
});

describe('UAT-040 取消关注后不再推送（异常路径，REQ-020）', () => {
  it('U 取关 B 后，B 的新文章不再出现在 U 的 feed', async () => {
    const env = createTestEnv();
    const bloggerB = await seedBlogger(env, 'uat40_b', 'uat40b@example.com');
    await seedUser(env.stores, { username: 'uat40_u', email: 'uat40u@example.com' });
    const sessionU = await login(env.app, 'uat40u@example.com');
    await request(env.app).post(`/api/users/${bloggerB.id}/follow`).set(bearer(sessionU.token));
    const unfollow = await request(env.app).delete(`/api/users/${bloggerB.id}/follow`).set(bearer(sessionU.token));
    expect(unfollow.status).toBe(200);
    expect(unfollow.body.data.unfollowed).toBe(true);
    const sessionB = await login(env.app, 'uat40b@example.com');
    const create = await request(env.app).post('/api/articles').set(bearer(sessionB.token)).send({ title: '取关后新文', body: '正文' });
    await request(env.app).post(`/api/articles/${create.body.data.articleId}/publish`).set(bearer(sessionB.token));
    const feed = await request(env.app).get('/api/me/feed').set(bearer(sessionU.token));
    expect(feed.body.data.items.some((i: { articleId: string }) => i.articleId === create.body.data.articleId)).toBe(false);
  });
});
