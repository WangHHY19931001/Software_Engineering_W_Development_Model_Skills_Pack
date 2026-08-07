/**
 * 集成测试 · 互动域（INTF-013/014，REQ-019/020）
 * IT-016 点赞幂等（重复点赞不重复计数）+ 被点赞通知
 * IT-017 收藏/取消收藏/收藏列表（幂等）
 * IT-018 关注校验：自关注 400 / 关注不存在用户 404 / 关注非博主（跨模块 user store）
 * IT-019 关注→发布→feed 推送；取消关注后不再推送（跨模块）
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestEnv, seedUser, seedArticle, login, bearer, pollUntil } from './helpers';

describe('IT-016 点赞幂等（重复点赞不重复计数）+ 被点赞通知', () => {
  it('重复点赞 likeCount 只 +1；博主收到且仅 1 条 LIKE 通知', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'it16_blogger', email: 'it16b@example.com', role: 'blogger' });
    await seedUser(env.stores, { username: 'it16_reader_c', email: 'it16c@example.com' });
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '被点赞文章', status: 'published' });

    const bloggerSession = await login(env.app, 'it16b@example.com');
    const readerC = await login(env.app, 'it16c@example.com');

    // 1 首次点赞：200 + liked=true
    const like1 = await request(env.app).post('/api/articles/A1/like').set(bearer(readerC.token));
    expect(like1.status).toBe(200);
    expect(like1.body.data.liked).toBe(true);

    // 2 重复点赞：200 + liked=true（幂等，likeCount 不重复累计）
    const like2 = await request(env.app).post('/api/articles/A1/like').set(bearer(readerC.token));
    expect(like2.status).toBe(200);
    expect(like2.body.data.liked).toBe(true);
    expect(env.stores.likeStore.countByArticle('A1')).toBe(1);

    // 3 详情校验计数：likeCount=1
    const detail = await request(env.app).get('/api/articles/A1');
    expect(detail.status).toBe(200);
    expect(detail.body.data.likeCount).toBe(1);

    // 4 博主查通知：含 type=LIKE 且仅 1 条（article.liked 事件异步消费，轮询等待）
    await pollUntil(
      async () => {
        const res = await request(env.app).get('/api/me/notifications').set(bearer(bloggerSession.token));
        return res.body.data.items.filter((item: { type: string }) => item.type === 'LIKE').length;
      },
      (count) => count >= 1,
      { timeoutMs: 3000, message: 'LIKE 通知未在 3s 内产生' },
    );
    const notifyRes = await request(env.app).get('/api/me/notifications').set(bearer(bloggerSession.token));
    const likeNotices = notifyRes.body.data.items.filter(
      (item: { type: string; actorId: string }) => item.type === 'LIKE' && item.actorId === readerC.userId,
    );
    expect(likeNotices.length).toBe(1);
  });
});

describe('IT-017 收藏/取消收藏/收藏列表（幂等）', () => {
  it('收藏 A1 → 列表可见 → 重复收藏幂等 → 取消收藏 → 列表移除', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'it17_blogger', email: 'it17b@example.com', role: 'blogger' });
    await seedUser(env.stores, { username: 'it17_reader', email: 'it17r@example.com' });
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '收藏文章A1', status: 'published' });
    seedArticle(env.stores, { id: 'A2', authorId: blogger.id, title: '未收藏文章A2', status: 'published' });

    const reader = await login(env.app, 'it17r@example.com');

    // 1 收藏 A1：200 + favorited=true
    const fav1 = await request(env.app).post('/api/articles/A1/favorite').set(bearer(reader.token));
    expect(fav1.status).toBe(200);
    expect(fav1.body.data.favorited).toBe(true);

    // 2 重复收藏 A1：200（幂等，无重复记录）
    const fav2 = await request(env.app).post('/api/articles/A1/favorite').set(bearer(reader.token));
    expect(fav2.status).toBe(200);
    expect(fav2.body.data.favorited).toBe(true);
    expect(env.stores.favoriteStore.findByUserAndArticle(reader.userId, 'A1')).not.toBeNull();

    // 3 收藏列表：200 + items 含 A1（不含未收藏的 A2）
    const list1 = await request(env.app).get('/api/me/favorites').set(bearer(reader.token));
    expect(list1.status).toBe(200);
    const favIds1 = list1.body.data.items.map((item: { articleId: string }) => item.articleId);
    expect(favIds1).toContain('A1');
    expect(favIds1).not.toContain('A2');

    // 4 取消收藏 A1：200 + favorited=false
    const unfav = await request(env.app).delete('/api/articles/A1/favorite').set(bearer(reader.token));
    expect(unfav.status).toBe(200);
    expect(unfav.body.data.favorited).toBe(false);

    // 5 收藏列表复查：items 不含 A1
    const list2 = await request(env.app).get('/api/me/favorites').set(bearer(reader.token));
    const favIds2 = list2.body.data.items.map((item: { articleId: string }) => item.articleId);
    expect(favIds2).not.toContain('A1');
  });
});

describe('IT-018 关注校验：自关注 400 / 关注不存在用户 404 / 关注非博主（跨模块 user store）', () => {
  it('自关注 40002 / 不存在 40401 / 非博主 40002 / 关注博主 200 / 重复关注幂等', async () => {
    const env = createTestEnv();
    const readerC = await seedUser(env.stores, { username: 'it18_reader_c', email: 'it18c@example.com' });
    const blogger = await seedUser(env.stores, { username: 'it18_blogger', email: 'it18b@example.com', role: 'blogger' });
    const readerR = await seedUser(env.stores, { username: 'it18_reader_r', email: 'it18r@example.com' });

    const sessionC = await login(env.app, 'it18c@example.com');

    // 1 关注自己：400 + error.code=40002
    const self = await request(env.app).post(`/api/users/${readerC.id}/follow`).set(bearer(sessionC.token));
    expect(self.status).toBe(400);
    expect(self.body.error.code).toBe(40002);

    // 2 关注不存在用户：404 + error.code=40401
    const ghost = await request(env.app).post('/api/users/u_ghost/follow').set(bearer(sessionC.token));
    expect(ghost.status).toBe(404);
    expect(ghost.body.error.code).toBe(40401);

    // 3 关注非博主 reader：400 + error.code=40002（role 非 blogger）
    const nonBlogger = await request(env.app).post(`/api/users/${readerR.id}/follow`).set(bearer(sessionC.token));
    expect(nonBlogger.status).toBe(400);
    expect(nonBlogger.body.error.code).toBe(40002);

    // 4 关注博主（对照组）：200 + { followerId, followeeId }
    const follow = await request(env.app).post(`/api/users/${blogger.id}/follow`).set(bearer(sessionC.token));
    expect(follow.status).toBe(200);
    expect(follow.body.data.followerId).toBe(readerC.id);
    expect(follow.body.data.followeeId).toBe(blogger.id);

    // 5 重复关注博主：200（幂等，follow store 无重复）
    const followAgain = await request(env.app).post(`/api/users/${blogger.id}/follow`).set(bearer(sessionC.token));
    expect(followAgain.status).toBe(200);
    const follows = env.stores.followStore
      .listFolloweeIdsByFollower(readerC.id)
      .filter((id) => id === blogger.id);
    expect(follows.length).toBe(1);
  });
});

describe('IT-019 关注→发布→feed 推送；取消关注后不再推送（跨模块）', () => {
  it('关注后 feed 出现新文章；取关后不再推送（REQ-020）', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'it19_blogger', email: 'it19b@example.com', role: 'blogger' });
    await seedUser(env.stores, { username: 'it19_reader_c', email: 'it19c@example.com' });
    seedArticle(env.stores, { id: 'D1', authorId: blogger.id, title: '关注期间发布', status: 'draft' });
    seedArticle(env.stores, { id: 'D2', authorId: blogger.id, title: '取关后发布', status: 'draft' });

    const readerC = await login(env.app, 'it19c@example.com');
    const bloggerSession = await login(env.app, 'it19b@example.com');

    // 1 读者关注博主 B：200
    const follow = await request(env.app).post(`/api/users/${blogger.id}/follow`).set(bearer(readerC.token));
    expect(follow.status).toBe(200);

    // 2 博主发布 D1：200 + published
    const pub1 = await request(env.app).post('/api/articles/D1/publish').set(bearer(bloggerSession.token));
    expect(pub1.status).toBe(200);
    expect(pub1.body.data.status).toBe('published');

    // 3 读者拉取 feed：200 + items 含 D1（publishedAt 降序）
    const feed1 = await request(env.app).get('/api/me/feed').set(bearer(readerC.token));
    expect(feed1.status).toBe(200);
    const feedIds1 = feed1.body.data.items.map((item: { articleId: string }) => item.articleId);
    expect(feedIds1).toContain('D1');

    // 4 取消关注：200
    const unfollow = await request(env.app).delete(`/api/users/${blogger.id}/follow`).set(bearer(readerC.token));
    expect(unfollow.status).toBe(200);

    // 5 博主再发布 D2：200
    const pub2 = await request(env.app).post('/api/articles/D2/publish').set(bearer(bloggerSession.token));
    expect(pub2.status).toBe(200);
    expect(pub2.body.data.status).toBe('published');

    // 6 读者复查 feed：items 不含 D2（取关后不推送）
    const feed2 = await request(env.app).get('/api/me/feed').set(bearer(readerC.token));
    const feedIds2 = feed2.body.data.items.map((item: { articleId: string }) => item.articleId);
    expect(feedIds2).not.toContain('D2');
  });
});
