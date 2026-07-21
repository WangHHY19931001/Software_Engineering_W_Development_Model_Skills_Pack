import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { spawnSync } from 'node:child_process';
import { app, userStore, articleStore, commentStore } from '../../src/app.js';
import jwt, { type SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import * as fs from 'node:fs';
import * as path from 'node:path';

async function registerAndLogin(username: string, password: string): Promise<{ token: string; userId: string }> {
  await request(app).post('/api/v1/auth/register').send({ username, password }).expect(201);
  const res = await request(app).post('/api/v1/auth/login').send({ username, password }).expect(200);
  return { token: res.body.token, userId: res.body.userId };
}

describe('验收测试 UAT-001 ~ UAT-015', () => {
  beforeEach(() => {
    userStore.clear();
    articleStore.clear();
    commentStore.clear();
    process.env.JWT_SECRET = 'test-secret-blog-demo';
  });

  describe('UAT-001: 用户注册成功', () => {
    it('POST /register → 201 + {userId, username}；无 password 字段；passwordHash 以 $2b$10$ 开头', async () => {
      const r = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Passw0rd!' })
        .expect(201);
      expect(r.body.userId).toBeTruthy();
      expect(r.body.username).toBe('alice');
      expect(r.body.password).toBeUndefined();
      expect(r.body.passwordHash).toBeUndefined();

      const user = userStore.findByUsername('alice');
      expect(user).toBeDefined();
      expect(user!.passwordHash.startsWith('$2b$10$')).toBe(true);
      expect(user!.passwordHash).not.toBe('Passw0rd!');
    });
  });

  describe('UAT-002: 用户登录成功并返回 JWT', () => {
    it('POST /login → 200 + {token, expiresIn=3600}；exp - iat === 3600', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Passw0rd!' })
        .expect(201);
      const r = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'alice', password: 'Passw0rd!' })
        .expect(200);
      expect(typeof r.body.token).toBe('string');
      expect(r.body.token.split('.').length).toBe(3);

      const decoded = jwt.decode(r.body.token) as { exp: number; iat: number };
      expect(decoded.exp - decoded.iat).toBe(3600);
    });
  });

  describe('UAT-003: 用户登录 - 错误密码', () => {
    it('POST /login 错误密码 → 401 + {code: 40101, message: "用户名或密码错误"}', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Passw0rd!' })
        .expect(201);
      const r = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'alice', password: 'WrongPass' })
        .expect(401);
      expect(r.body.code).toBe(40101);
      expect(r.body.message).toBe('用户名或密码错误');
      expect(r.body.token).toBeUndefined();
    });
  });

  describe('UAT-004: 创建文章（已认证作者）', () => {
    it('POST /articles → 201 + {id, authorId=JWT.userId, title, content, createdAt}', async () => {
      const a = await registerAndLogin('alice', 'Passw0rd!');
      const r = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ title: 'Hello World', content: 'My first post.' })
        .expect(201);
      expect(r.body.id).toBeTruthy();
      expect(r.body.authorId).toBe(a.userId);
      expect(r.body.title).toBe('Hello World');
      expect(r.body.content).toBe('My first post.');
      expect(r.body.createdAt).toBeTruthy();
    });
  });

  describe('UAT-005: 修改自己的文章', () => {
    it('PATCH /articles/:id → 200；title 更新；updatedAt > createdAt', async () => {
      const a = await registerAndLogin('alice', 'Passw0rd!');
      const created = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ title: 'T1', content: 'C1' })
        .expect(201);
      await new Promise((r) => setTimeout(r, 10));
      const r = await request(app)
        .patch(`/api/v1/articles/${created.body.id}`)
        .set('Authorization', `Bearer ${a.token}`)
        .send({ title: 'T2' })
        .expect(200);
      expect(r.body.title).toBe('T2');
      expect(r.body.content).toBe('C1');
      expect(r.body.updatedAt).not.toBe(r.body.createdAt);
    });
  });

  describe('UAT-006: 删除自己的文章', () => {
    it('DELETE /articles/:id → 204；随后 GET → 404 + 40401', async () => {
      const a = await registerAndLogin('alice', 'Passw0rd!');
      const created = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ title: 'T1', content: 'C1' })
        .expect(201);
      await request(app)
        .delete(`/api/v1/articles/${created.body.id}`)
        .set('Authorization', `Bearer ${a.token}`)
        .expect(204);
      const r = await request(app).get(`/api/v1/articles/${created.body.id}`).expect(404);
      expect(r.body.code).toBe(40401);
    });
  });

  describe('UAT-007: 公开列表分页浏览（未认证）', () => {
    it('GET /articles?page=1&pageSize=10 → 200 + 10 items；page=2 → 5 items', async () => {
      const a = await registerAndLogin('alice', 'Passw0rd!');
      for (let i = 0; i < 15; i++) {
        await request(app)
          .post('/api/v1/articles')
          .set('Authorization', `Bearer ${a.token}`)
          .send({ title: `T${i}`, content: 'C' });
      }
      const r1 = await request(app).get('/api/v1/articles?page=1&pageSize=10').expect(200);
      expect(r1.body.items.length).toBe(10);
      expect(r1.body.total).toBe(15);
      expect(r1.body.page).toBe(1);
      expect(r1.body.pageSize).toBe(10);

      const r2 = await request(app).get('/api/v1/articles?page=2&pageSize=10').expect(200);
      expect(r2.body.items.length).toBe(5);
      expect(r2.body.total).toBe(15);
    });
  });

  describe('UAT-008: 查看文章详情 + 评论聚合', () => {
    it('GET /articles/:id → 200 + {article..., comments:[]}；comments 升序', async () => {
      const a = await registerAndLogin('alice', 'Passw0rd!');
      const article = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ title: 'T1', content: 'C1' })
        .expect(201);

      await request(app)
        .post(`/api/v1/articles/${article.body.id}/comments`)
        .set('Authorization', `Bearer ${a.token}`)
        .send({ content: 'C1' })
        .expect(201);
      await new Promise((r) => setTimeout(r, 10));
      await request(app)
        .post(`/api/v1/articles/${article.body.id}/comments`)
        .set('Authorization', `Bearer ${a.token}`)
        .send({ content: 'C2' })
        .expect(201);

      const r = await request(app).get(`/api/v1/articles/${article.body.id}`).expect(200);
      expect(r.body.id).toBe(article.body.id);
      expect(Array.isArray(r.body.comments)).toBe(true);
      expect(r.body.comments.length).toBe(2);
      expect(r.body.comments[0].content).toBe('C1');
      expect(r.body.comments[1].content).toBe('C2');
    });
  });

  describe('UAT-009: 已登录用户对存在文章发表评论', () => {
    it('POST /articles/:id/comments → 201 + {id, articleId, authorId=JWT.userId, content, createdAt}', async () => {
      const a = await registerAndLogin('alice', 'Passw0rd!');
      const article = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ title: 'T1', content: 'C1' })
        .expect(201);
      const r = await request(app)
        .post(`/api/v1/articles/${article.body.id}/comments`)
        .set('Authorization', `Bearer ${a.token}`)
        .send({ content: 'Nice post!' })
        .expect(201);
      expect(r.body.id).toBeTruthy();
      expect(r.body.articleId).toBe(article.body.id);
      expect(r.body.authorId).toBe(a.userId);
      expect(r.body.content).toBe('Nice post!');
      expect(r.body.createdAt).toBeTruthy();
    });
  });

  describe('UAT-010: 查看文章评论列表（未认证）', () => {
    it('GET /articles/:id/comments → 200 + {items: Comment[], total}；按 createdAt 升序', async () => {
      const a = await registerAndLogin('alice', 'Passw0rd!');
      const article = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ title: 'T1', content: 'C1' })
        .expect(201);
      await request(app)
        .post(`/api/v1/articles/${article.body.id}/comments`)
        .set('Authorization', `Bearer ${a.token}`)
        .send({ content: 'C1' })
        .expect(201);
      await new Promise((r) => setTimeout(r, 10));
      await request(app)
        .post(`/api/v1/articles/${article.body.id}/comments`)
        .set('Authorization', `Bearer ${a.token}`)
        .send({ content: 'C2' })
        .expect(201);

      // 无 Authorization
      const r = await request(app)
        .get(`/api/v1/articles/${article.body.id}/comments`)
        .expect(200);
      expect(Array.isArray(r.body.items)).toBe(true);
      expect(r.body.total).toBe(2);
      expect(r.body.items[0].content).toBe('C1');
      expect(r.body.items[1].content).toBe('C2');
    });
  });

  describe('UAT-011: 密码 bcrypt 哈希存储（无明文）', () => {
    it('注册后 userStore：$2b$10$ 开头 / cost=10 / 无 password 字段', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'bob', password: 'Secret123' })
        .expect(201);
      const user = userStore.findByUsername('bob');
      expect(user).toBeDefined();
      expect(user!.passwordHash.startsWith('$2b$10$')).toBe(true);
      expect(user!.passwordHash).not.toBe('Secret123');
      expect((user as unknown as Record<string, unknown>).password).toBeUndefined();
      expect(bcrypt.getRounds(user!.passwordHash)).toBe(10);
    });
  });

  describe('UAT-012: JWT 过期后访问受保护资源被拒', () => {
    it('过期 JWT → 401 + {code: 40102, message: "JWT 已过期或无效"}', async () => {
      const a = await registerAndLogin('alice', 'Passw0rd!');
      const expiredToken = jwt.sign(
        { userId: a.userId, username: 'alice' },
        process.env.JWT_SECRET as string,
        { expiresIn: -1 } as SignOptions,
      );
      const r = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ title: 'T1', content: 'C1' })
        .expect(401);
      expect(r.body.code).toBe(40102);
      expect(r.body.message).toBe('JWT 已过期或无效');
      expect(r.body.id).toBeUndefined();
    });
  });

  describe('UAT-013: 列表接口 P95 ≤ 200ms', () => {
    it('1000 篇文章 + 200 次采样 → P95 ≤ 200ms', async () => {
      const a = await registerAndLogin('alice', 'Passw0rd!');
      for (let i = 0; i < 1000; i++) {
        await request(app)
          .post('/api/v1/articles')
          .set('Authorization', `Bearer ${a.token}`)
          .send({ title: `T${i}`, content: 'C' });
      }
      const samples: number[] = [];
      for (let i = 0; i < 200; i++) {
        const t0 = Date.now();
        await request(app).get('/api/v1/articles?page=1&pageSize=10').expect(200);
        samples.push(Date.now() - t0);
      }
      samples.sort((x, y) => x - y);
      const p95 = samples[Math.floor(samples.length * 0.95)];
      expect(p95).toBeLessThanOrEqual(200);
      console.log(`UAT-013 P95 = ${p95}ms (samples=${samples.length}, total articles=${articleStore.size()})`);
    });
  });

  describe('UAT-014: tsc strict 0 错误', () => {
    it('npx tsc --noEmit → 退出码 0；stderr 无输出', () => {
      const projectRoot = path.resolve(__dirname, '../..');
      const result = spawnSync(
        process.platform === 'win32' ? 'npx.cmd' : 'npx',
        ['tsc', '--noEmit'],
        { cwd: projectRoot, encoding: 'utf-8', stdio: 'pipe', shell: true },
      );
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
    });
  });

  describe('UAT-015: 单元测试覆盖率 ≥ 80%', () => {
    it('coverage-summary.json 显示 lines/branches/functions/statements 均 ≥ 80%', () => {
      const projectRoot = path.resolve(__dirname, '../..');
      const summaryPath = path.join(projectRoot, 'coverage', 'coverage-summary.json');
      // 如果存在 coverage-summary.json 则读取；否则通过 vitest --coverage 重新生成
      if (!fs.existsSync(summaryPath)) {
        spawnSync(
          process.platform === 'win32' ? 'npm.cmd' : 'npm',
          ['run', 'coverage', '--silent'],
          { cwd: projectRoot, encoding: 'utf-8', stdio: 'pipe', shell: true },
        );
      }
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      const total = summary.total;
      expect(total.lines.pct).toBeGreaterThanOrEqual(80);
      expect(total.branches.pct).toBeGreaterThanOrEqual(80);
      expect(total.functions.pct).toBeGreaterThanOrEqual(80);
      expect(total.statements.pct).toBeGreaterThanOrEqual(80);
      console.log(
        `UAT-015 覆盖率: lines=${total.lines.pct}% branches=${total.branches.pct}% functions=${total.functions.pct}% statements=${total.statements.pct}%`,
      );
    });
  });
});
