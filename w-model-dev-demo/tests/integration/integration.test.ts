import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, userStore, articleStore, commentStore } from '../../src/app.js';
import jwt, { type SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';

function jwtFor(payload: { userId: string; username: string }, expiresIn: number = 3600): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn } as SignOptions);
}

async function registerAndLogin(
  app: ReturnType<typeof import('../../src/app.js').createApp>,
  username: string,
  password: string,
): Promise<{ token: string; userId: string }> {
  await request(app).post('/api/v1/auth/register').send({ username, password }).expect(201);
  const res = await request(app).post('/api/v1/auth/login').send({ username, password }).expect(200);
  return { token: res.body.token, userId: res.body.userId };
}

describe('集成测试 IT-001 ~ IT-006', () => {
  beforeEach(() => {
    userStore.clear();
    articleStore.clear();
    commentStore.clear();
    process.env.JWT_SECRET = 'test-secret-blog-demo';
  });

  describe('IT-001: 注册 + 登录模块间契约', () => {
    it('注册 alice → 201 + {userId, username}；登录 → 200 + {token, userId, username}；token 可 verify', async () => {
      const r1 = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Pass1234' })
        .expect(201);
      expect(r1.body.username).toBe('alice');
      expect(r1.body.userId).toBeTruthy();

      const r2 = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'alice', password: 'Pass1234' })
        .expect(200);
      expect(r2.body.username).toBe('alice');
      expect(r2.body.userId).toBe(r1.body.userId);
      expect(typeof r2.body.token).toBe('string');

      const payload = jwt.verify(r2.body.token, process.env.JWT_SECRET as string) as {
        userId: string;
        username: string;
      };
      expect(payload.userId).toBe(r1.body.userId);
      expect(payload.username).toBe('alice');

      const user = userStore.findByUsername('alice');
      expect(user?.passwordHash.startsWith('$2b$10$')).toBe(true);
      expect(user?.passwordHash).not.toBe('Pass1234');
      expect('password' in (user as object)).toBe(false);
    });
  });

  describe('IT-002: 重复注册触发 ConflictError → 409 + 40901', () => {
    it('POST /register {alice} 两次 → 第二次 409 + {code:40901, message:"用户名已存在"}', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Pass1234' })
        .expect(201);

      const r = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Pass1234' })
        .expect(409);
      expect(r.body.code).toBe(40901);
      expect(r.body.message).toBe('用户名已存在');
    });
  });

  describe('IT-003: 文章作者隔离（update/remove 跨用户）', () => {
    it('A 创建文章 X；B PATCH/DELETE X → 403 + 40301；A PATCH X → 200', async () => {
      const a = await registerAndLogin(app, 'alice', 'Pass1234');
      const b = await registerAndLogin(app, 'bob', 'Pass1234');

      const created = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ title: 'T1', content: 'C1' })
        .expect(201);
      const articleId = created.body.id;

      const r1 = await request(app)
        .patch(`/api/v1/articles/${articleId}`)
        .set('Authorization', `Bearer ${b.token}`)
        .send({ title: 'T2' })
        .expect(403);
      expect(r1.body.code).toBe(40301);

      const r2 = await request(app)
        .delete(`/api/v1/articles/${articleId}`)
        .set('Authorization', `Bearer ${b.token}`)
        .expect(403);
      expect(r2.body.code).toBe(40301);

      const r3 = await request(app)
        .patch(`/api/v1/articles/${articleId}`)
        .set('Authorization', `Bearer ${a.token}`)
        .send({ title: 'T2' })
        .expect(200);
      expect(r3.body.title).toBe('T2');
      expect(r3.body.id).toBe(articleId);
    });
  });

  describe('IT-004: 公开浏览 + 评论聚合', () => {
    it('A 创建文章 + 评论；公开 GET /articles/:id → 200 + 评论聚合；无需 Authorization', async () => {
      const a = await registerAndLogin(app, 'alice', 'Pass1234');

      const article = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ title: 'T1', content: 'C1' })
        .expect(201);

      const comment = await request(app)
        .post(`/api/v1/articles/${article.body.id}/comments`)
        .set('Authorization', `Bearer ${a.token}`)
        .send({ content: 'Hello' })
        .expect(201);
      expect(comment.body.content).toBe('Hello');

      const r = await request(app)
        .get(`/api/v1/articles/${article.body.id}`)
        .expect(200);
      expect(r.body.id).toBe(article.body.id);
      expect(r.body.title).toBe('T1');
      expect(Array.isArray(r.body.comments)).toBe(true);
      expect(r.body.comments.length).toBe(1);
      expect(r.body.comments[0].content).toBe('Hello');
      expect(r.body.comments[0].authorId).toBe(a.userId);
    });
  });

  describe('IT-005: 评论删除作者隔离 + 文章不存在拦截', () => {
    it('A 创建文章 + 评论 C1；B DELETE C1 → 403 + 40301；A DELETE C1 → 204；A POST /articles/不存在/comments → 404 + 40401', async () => {
      const a = await registerAndLogin(app, 'alice', 'Pass1234');
      const b = await registerAndLogin(app, 'bob', 'Pass1234');

      const article = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ title: 'T1', content: 'C1' })
        .expect(201);

      const comment = await request(app)
        .post(`/api/v1/articles/${article.body.id}/comments`)
        .set('Authorization', `Bearer ${a.token}`)
        .send({ content: 'Hello' })
        .expect(201);

      const r1 = await request(app)
        .delete(`/api/v1/articles/${article.body.id}/comments/${comment.body.id}`)
        .set('Authorization', `Bearer ${b.token}`)
        .expect(403);
      expect(r1.body.code).toBe(40301);

      await request(app)
        .delete(`/api/v1/articles/${article.body.id}/comments/${comment.body.id}`)
        .set('Authorization', `Bearer ${a.token}`)
        .expect(204);

      const r3 = await request(app)
        .post('/api/v1/articles/non-existent/comments')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ content: 'Hello' })
        .expect(404);
      expect(r3.body.code).toBe(40401);
    });
  });

  describe('IT-006: 鉴权中间件全链路（缺 token / 伪造 / 过期 / 合法）', () => {
    it('4 个场景分别返回 401.40103 / 401.40102 / 401.40102 / 201', async () => {
      // 1) 无 Authorization
      const r1 = await request(app)
        .post('/api/v1/articles')
        .send({ title: 'T1', content: 'C1' })
        .expect(401);
      expect(r1.body.code).toBe(40103);

      // 2) 伪造 token
      const r2 = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', 'Bearer fake.token.value')
        .send({ title: 'T1', content: 'C1' })
        .expect(401);
      expect(r2.body.code).toBe(40102);

      // 3) 过期 token
      const expiredToken = jwtFor({ userId: 'u1', username: 'alice' }, -1);
      const r3 = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ title: 'T1', content: 'C1' })
        .expect(401);
      expect(r3.body.code).toBe(40102);

      // 4) 合法 token
      const a = await registerAndLogin(app, 'alice', 'Pass1234');
      const r4 = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ title: 'T1', content: 'C1' })
        .expect(201);
      expect(r4.body.title).toBe('T1');
    });
  });

  describe('补充集成场景：参数校验 + 文章不存在', () => {
    it('POST /articles 缺 title → 400 + 40001', async () => {
      const a = await registerAndLogin(app, 'alice', 'Pass1234');
      const r = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ content: 'C1' })
        .expect(400);
      expect(r.body.code).toBe(40001);
    });

    it('GET /articles/non-existent → 404 + 40401', async () => {
      const r = await request(app).get('/api/v1/articles/non-existent').expect(404);
      expect(r.body.code).toBe(40401);
    });

    it('GET /articles 分页：3 条数据，page=1,pageSize=2 → {items:2, total:3}', async () => {
      const a = await registerAndLogin(app, 'alice', 'Pass1234');
      for (const title of ['T1', 'T2', 'T3']) {
        await request(app)
          .post('/api/v1/articles')
          .set('Authorization', `Bearer ${a.token}`)
          .send({ title, content: 'C' })
          .expect(201);
      }
      const r = await request(app).get('/api/v1/articles?page=1&pageSize=2').expect(200);
      expect(r.body.items.length).toBe(2);
      expect(r.body.total).toBe(3);
      expect(r.body.page).toBe(1);
      expect(r.body.pageSize).toBe(2);
    });

    it('登录密码错误 → 401 + 40101', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Pass1234' })
        .expect(201);
      const r = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'alice', password: 'WrongPass' })
        .expect(401);
      expect(r.body.code).toBe(40101);
    });

    it('登录不存在的用户 → 401 + 40101', async () => {
      const r = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'nobody', password: 'Pass1234' })
        .expect(401);
      expect(r.body.code).toBe(40101);
    });

    it('注册参数非法（短用户名） → 400 + 40001', async () => {
      const r = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'a', password: 'Pass1234' })
        .expect(400);
      expect(r.body.code).toBe(40001);
    });

    it('bcrypt cost=10 + password 字段不存储', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Pass1234' })
        .expect(201);
      const user = userStore.findByUsername('alice');
      expect(user).toBeDefined();
      expect(bcrypt.getRounds(user!.passwordHash)).toBe(10);
      expect((user as unknown as Record<string, unknown>).password).toBeUndefined();
    });
  });
});
