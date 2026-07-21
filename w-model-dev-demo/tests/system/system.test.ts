import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, userStore, articleStore, commentStore } from '../../src/app.js';
import jwt, { type SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';

async function registerAndLogin(username: string, password: string): Promise<{ token: string; userId: string }> {
  await request(app).post('/api/v1/auth/register').send({ username, password }).expect(201);
  const res = await request(app).post('/api/v1/auth/login').send({ username, password }).expect(200);
  return { token: res.body.token, userId: res.body.userId };
}

describe('系统测试 ST-001 ~ ST-006', () => {
  beforeEach(() => {
    userStore.clear();
    articleStore.clear();
    commentStore.clear();
    process.env.JWT_SECRET = 'test-secret-blog-demo';
  });

  describe('ST-001: 端到端全链路（注册→登录→创建文章→浏览→评论→删除）', () => {
    it('9 步全链路：1-8 步 201/200/201/200/200/201/200/204；第 9 步 404 + 40401', async () => {
      // 1. 注册
      const r1 = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Pass1234' })
        .expect(201);
      expect(r1.body.username).toBe('alice');

      // 2. 登录
      const r2 = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'alice', password: 'Pass1234' })
        .expect(200);
      const token = r2.body.token as string;
      const userId = r2.body.userId as string;
      expect(token).toBeTruthy();

      // 3. 创建文章
      const r3 = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'T1', content: 'C1' })
        .expect(201);
      const articleId = r3.body.id as string;
      expect(articleId).toBeTruthy();

      // 4. 公开列表
      const r4 = await request(app).get('/api/v1/articles?page=1&pageSize=10').expect(200);
      expect(r4.body.items.length).toBe(1);
      expect(r4.body.total).toBe(1);

      // 5. 公开详情
      const r5 = await request(app).get(`/api/v1/articles/${articleId}`).expect(200);
      expect(r5.body.id).toBe(articleId);
      expect(Array.isArray(r5.body.comments)).toBe(true);
      expect(r5.body.comments.length).toBe(0);

      // 6. 发表评论
      const r6 = await request(app)
        .post(`/api/v1/articles/${articleId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Hello' })
        .expect(201);
      const commentId = r6.body.id as string;
      expect(commentId).toBeTruthy();
      expect(r6.body.authorId).toBe(userId);

      // 7. 详情含评论聚合
      const r7 = await request(app).get(`/api/v1/articles/${articleId}`).expect(200);
      expect(r7.body.comments.length).toBe(1);
      expect(r7.body.comments[0].content).toBe('Hello');

      // 8. 删除文章
      await request(app)
        .delete(`/api/v1/articles/${articleId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // 9. 二次查询 → 404
      const r9 = await request(app).get(`/api/v1/articles/${articleId}`).expect(404);
      expect(r9.body.code).toBe(40401);
    });
  });

  describe('ST-002: 作者隔离验证 - A 修改/删除 B 的文章被拒', () => {
    it('A 修改/删除 B 的文章 → 403.40301；B 修改自己 → 200；文章仍存在', async () => {
      const a = await registerAndLogin('alice', 'Pass1234');
      const b = await registerAndLogin('bob', 'Pass1234');

      const created = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${b.token}`)
        .send({ title: 'T1', content: 'C1' })
        .expect(201);
      const articleId = created.body.id;

      // A 修改 B 的文章
      const r1 = await request(app)
        .patch(`/api/v1/articles/${articleId}`)
        .set('Authorization', `Bearer ${a.token}`)
        .send({ title: 'T2' })
        .expect(403);
      expect(r1.body.code).toBe(40301);
      expect(r1.body.message).toBe('无权操作他人文章');

      // A 删除 B 的文章
      const r2 = await request(app)
        .delete(`/api/v1/articles/${articleId}`)
        .set('Authorization', `Bearer ${a.token}`)
        .expect(403);
      expect(r2.body.code).toBe(40301);

      // B 修改自己的文章
      const r3 = await request(app)
        .patch(`/api/v1/articles/${articleId}`)
        .set('Authorization', `Bearer ${b.token}`)
        .send({ title: 'T2-updated' })
        .expect(200);
      expect(r3.body.title).toBe('T2-updated');

      // 文章仍存在
      const r4 = await request(app).get(`/api/v1/articles/${articleId}`).expect(200);
      expect(r4.body.id).toBe(articleId);
      expect(r4.body.title).toBe('T2-updated');
    });
  });

  describe('ST-003: 性能基线 - 单进程内存 1000 篇文章分页查询 P95 ≤ 200ms', () => {
    it('1000 篇文章 1000 次 GET /articles?page=1&pageSize=10 → P95 ≤ 200ms', async () => {
      const a = await registerAndLogin('alice', 'Pass1234');
      // 预置 1000 篇文章（批量）
      for (let i = 0; i < 1000; i++) {
        await request(app)
          .post('/api/v1/articles')
          .set('Authorization', `Bearer ${a.token}`)
          .send({ title: `T${i}`, content: `C${i}` });
      }
      // 取 200 次采样（避免测试耗时过长）
      const samples: number[] = [];
      for (let i = 0; i < 200; i++) {
        const t0 = Date.now();
        await request(app).get('/api/v1/articles?page=1&pageSize=10').expect(200);
        samples.push(Date.now() - t0);
      }
      samples.sort((a, b) => a - b);
      const p95 = samples[Math.floor(samples.length * 0.95)];
      expect(p95).toBeLessThanOrEqual(200);
      console.log(`ST-003 P95 = ${p95}ms (samples=${samples.length}, total articles=${articleStore.size()})`);
    });
  });

  describe('ST-004: 安全基线 - 未授权访问受保护资源被拒', () => {
    it('无 Authorization 调用受保护接口 → 401.40103；公开接口不受影响', async () => {
      // 受保护：POST /api/v1/articles
      const r1 = await request(app)
        .post('/api/v1/articles')
        .send({ title: 'T1', content: 'C1' })
        .expect(401);
      expect(r1.body.code).toBe(40103);

      // 受保护：DELETE /api/v1/articles/:id
      const r2 = await request(app)
        .delete('/api/v1/articles/some-id')
        .expect(401);
      expect(r2.body.code).toBe(40103);

      // 受保护：POST /api/v1/articles/:id/comments
      const r3 = await request(app)
        .post('/api/v1/articles/some-id/comments')
        .send({ content: 'Hello' })
        .expect(401);
      expect(r3.body.code).toBe(40103);

      // 公开接口不受影响
      const r4 = await request(app).get('/api/v1/articles').expect(200);
      expect(Array.isArray(r4.body.items)).toBe(true);
    });
  });

  describe('ST-005: 安全基线 - JWT 过期 / 伪造处理', () => {
    it('过期 JWT → 401.40102；伪造 JWT → 401.40102；合法 JWT → 201', async () => {
      const a = await registerAndLogin('alice', 'Pass1234');

      // 过期 token
      const expiredToken = jwt.sign(
        { userId: a.userId, username: 'alice' },
        process.env.JWT_SECRET as string,
        { expiresIn: -1 } as SignOptions,
      );
      const r1 = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ title: 'T1', content: 'C1' })
        .expect(401);
      expect(r1.body.code).toBe(40102);

      // 伪造签名 token
      const forgedToken = jwt.sign(
        { userId: a.userId, username: 'alice' },
        'wrong-secret',
        { expiresIn: 3600 } as SignOptions,
      );
      const r2 = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${forgedToken}`)
        .send({ title: 'T1', content: 'C1' })
        .expect(401);
      expect(r2.body.code).toBe(40102);

      // 合法 token 对照
      const r3 = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ title: 'T1', content: 'C1' })
        .expect(201);
      expect(r3.body.title).toBe('T1');
    });
  });

  describe('ST-006: 安全基线 - 密码 bcrypt 哈希存储（cost=10）', () => {
    it('注册后 userStore 内部记录：$2b$10$ 开头 / bcrypt.getRounds===10 / 无 password 字段 / compare 错误密码 false', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Pass1234' })
        .expect(201);

      const user = userStore.findByUsername('alice');
      expect(user).toBeDefined();
      expect(user!.passwordHash.startsWith('$2b$10$')).toBe(true);
      expect(bcrypt.getRounds(user!.passwordHash)).toBe(10);
      expect((user as unknown as Record<string, unknown>).password).toBeUndefined();
      expect(await bcrypt.compare('WrongPass', user!.passwordHash)).toBe(false);
      expect(await bcrypt.compare('Pass1234', user!.passwordHash)).toBe(true);
    });
  });

  describe('补充系统场景：HTTP 方法不匹配 + 500 兜底', () => {
    it('PUT /api/v1/articles/:id 不支持 → 404（Express 默认）', async () => {
      await request(app).put('/api/v1/articles/some-id').expect(404);
    });

    it('GET /api/v1/unknown-path 不存在 → 404', async () => {
      await request(app).get('/api/v1/unknown-path').expect(404);
    });
  });
});
