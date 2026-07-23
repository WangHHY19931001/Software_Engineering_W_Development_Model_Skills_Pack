/**
 * 集成测试（阶段 6 执行）：IT-001 ~ IT-013
 *
 * 硬约束：
 *   - 使用真实 Express app（createApp()），通过 supertest 做端到端 HTTP 集成测试
 *   - 不得用 mock 替代被测真实模块（service / store / middleware 均为真实实例）
 *   - JWT_SECRET 由 npm run test:integration 注入（cross-env JWT_SECRET=test-secret-blog-demo）
 *   - 每个 test 前清空内存存储，避免测试间状态污染
 *
 * 覆盖模块交互对：auth×article、article×comment、controller×service×store、
 *                middleware×controller、错误路径（404/409/401/403/400）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app';
import { PasswordHasher } from '../../src/utils/password';
import type { Article, Comment } from '../../src/types';

const { app, deps } = createApp();

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET = process.env.JWT_SECRET as string;

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** 注册并登录，返回 { userId, username, token }。 */
async function registerAndLogin(
  username: string,
  password = 'Passw0rd!',
): Promise<{ userId: string; username: string; token: string }> {
  const reg = await request(app).post('/api/v1/auth/register').send({ username, password });
  expect(reg.status).toBe(201);
  const login = await request(app).post('/api/v1/auth/login').send({ username, password });
  expect(login.status).toBe(200);
  return { userId: reg.body.userId, username, token: login.body.token };
}

beforeEach(() => {
  deps.userStore.clear();
  deps.articleStore.clear();
  deps.commentStore.clear();
});

describe('集成测试 IT-001 ~ IT-013', () => {
  // ==================== auth×article ====================

  it('IT-001 注册→登录全链路（authService×userStore×passwordHasher×jwtService）', async () => {
    // step1 注册
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'alice', password: 'Passw0rd!' });
    expect(reg.status).toBe(201);
    expect(reg.body.userId).toMatch(UUID_V4);
    expect(reg.body.username).toBe('alice');
    expect(reg.body.password).toBeUndefined();
    expect(JSON.stringify(reg.body)).not.toContain('Passw0rd!');

    // step2 读取 userStore 内部记录
    const user = deps.userStore.findByUsername('alice');
    expect(user).toBeDefined();
    expect(user!.passwordHash).toMatch(/^\$2b\$10\$/);
    expect(user!.passwordHash).not.toBe('Passw0rd!');
    expect((user as unknown as Record<string, unknown>).password).toBeUndefined();

    // step3 登录
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'alice', password: 'Passw0rd!' });
    expect(login.status).toBe(200);
    expect(login.body.token.split('.').length).toBe(3); // JWT 三段式
    expect(login.body.expiresIn).toBe(3600);

    // step4 解码 token 校验 payload
    const payload = deps.jwtService.verify(login.body.token) as jwt.JwtPayload;
    expect(payload.userId).toBe(reg.body.userId);
    expect(payload.username).toBe('alice');
    expect(payload.exp! - payload.iat!).toBe(3600);
  });

  it('IT-002 重复注册→40901（authService×userStore×errorHandler 冲突路径）', async () => {
    const first = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'bob', password: 'Passw0rd!' });
    expect(first.status).toBe(201);

    const dup = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'bob', password: 'Passw0rd!' });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe(40901);
    expect(dup.body.message).toBe('用户名已存在');

    // 存储无重复记录
    expect(deps.userStore.size()).toBe(1);
  });

  it('IT-003 登录密码错误→40101（不泄露用户名存在性）', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'alice', password: 'Passw0rd!' });

    // 错误密码
    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'alice', password: 'WrongPass' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.code).toBe(40101);
    expect(wrong.body.message).toBe('用户名或密码错误');
    expect(wrong.body.token).toBeUndefined();

    // 不存在用户名 —— 文案一致，不区分
    const nobody = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'nobody', password: 'WrongPass' });
    expect(nobody.status).toBe(401);
    expect(nobody.body.code).toBe(40101);
    expect(nobody.body.message).toBe(wrong.body.message);
  });

  // ==================== article×comment ====================

  it('IT-004 创建文章全链路（authMiddleware×articleService×articleStore）', async () => {
    const { userId, token } = await registerAndLogin('alice');

    // step1 受保护 POST 创建文章
    const create = await request(app)
      .post('/api/v1/articles')
      .set(bearer(token))
      .send({ title: 'Hello World', content: 'My first post.', tags: ['intro'] });
    expect(create.status).toBe(201);
    expect(create.body.articleId).toMatch(UUID_V4);
    expect(create.body.authorId).toBe(userId);
    expect(create.body.title).toBe('Hello World');
    expect(create.body.content).toBe('My first post.');
    expect(create.body.tags).toEqual(['intro']);
    expect(create.body.createdAt).toBeTruthy();

    // step2 读取 articleStore
    const article = deps.articleStore.findById(create.body.articleId);
    expect(article).not.toBeNull();
    expect(article!.authorId).toBe(userId);
    expect(article!.createdAt).toBeTruthy();

    // step3 公开 GET 可读回
    const get = await request(app).get(`/api/v1/articles/${create.body.articleId}`);
    expect(get.status).toBe(200);
    expect(get.body.title).toBe('Hello World');
    expect(get.body.content).toBe('My first post.');
    expect(get.body.tags).toEqual(['intro']);
  });

  it('IT-005 作者隔离-非作者修改/删除→40301', async () => {
    const alice = await registerAndLogin('alice');
    const bob = await registerAndLogin('bob');

    // alice 创建文章 A
    const create = await request(app)
      .post('/api/v1/articles')
      .set(bearer(alice.token))
      .send({ title: 'Alice Post', content: 'secret', tags: [] });
    expect(create.status).toBe(201);
    const articleId = create.body.articleId;

    // bob 修改 → 40301
    const putByBob = await request(app)
      .put(`/api/v1/articles/${articleId}`)
      .set(bearer(bob.token))
      .send({ title: 'Hacked' });
    expect(putByBob.status).toBe(403);
    expect(putByBob.body.code).toBe(40301);

    // bob 删除 → 40301
    const delByBob = await request(app)
      .delete(`/api/v1/articles/${articleId}`)
      .set(bearer(bob.token));
    expect(delByBob.status).toBe(403);
    expect(delByBob.body.code).toBe(40301);

    // 文章未被篡改
    const get = await request(app).get(`/api/v1/articles/${articleId}`);
    expect(get.status).toBe(200);
    expect(get.body.title).toBe('Alice Post');
  });

  it('IT-006 公开浏览列表+分页（articleService×articleStore，按 createdAt 降序）', async () => {
    // 预置 15 篇文章（不同 createdAt）
    for (let i = 0; i < 15; i++) {
      const ts = `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`;
      deps.articleStore.insert({
        id: `art-${i}`,
        authorId: 'seed-user',
        title: `Article ${i}`,
        content: 'body',
        tags: [],
        createdAt: ts,
        updatedAt: ts,
      } as Article);
    }

    // page=1 pageSize=10
    const page1 = await request(app).get('/api/v1/articles').query({ page: 1, pageSize: 10 });
    expect(page1.status).toBe(200);
    expect(page1.body.items.length).toBe(10);
    expect(page1.body.total).toBeGreaterThanOrEqual(15);
    expect(page1.body.page).toBe(1);
    expect(page1.body.pageSize).toBe(10);
    // 降序：第一项 createdAt >= 第二项
    expect(page1.body.items[0].createdAt >= page1.body.items[1].createdAt).toBe(true);

    // page=2 pageSize=10 → total - 10
    const page2 = await request(app).get('/api/v1/articles').query({ page: 2, pageSize: 10 });
    expect(page2.status).toBe(200);
    expect(page2.body.items.length).toBe(page1.body.total - 10);

    // pageSize 上限 100 → 返回全部
    const all = await request(app).get('/api/v1/articles').query({ page: 1, pageSize: 100 });
    expect(all.status).toBe(200);
    expect(all.body.items.length).toBe(all.body.total);
  });

  it('IT-007 文章详情+评论聚合（articleService×commentService×stores）', async () => {
    const { userId, token } = await registerAndLogin('alice');

    // 创建文章 A
    const create = await request(app)
      .post('/api/v1/articles')
      .set(bearer(token))
      .send({ title: 'With Comments', content: 'c', tags: [] });
    const articleId = create.body.articleId;

    // 直接向 commentStore 预置 2 条评论（不同 createdAt，验证升序聚合）
    deps.commentStore.insert({
      id: 'c1',
      articleId,
      authorId: userId,
      content: 'first',
      createdAt: '2026-07-01T00:00:00.000Z',
    } as Comment);
    deps.commentStore.insert({
      id: 'c2',
      articleId,
      authorId: userId,
      content: 'second',
      createdAt: '2026-07-02T00:00:00.000Z',
    } as Comment);

    // step1 GET 详情含 comments
    const get = await request(app).get(`/api/v1/articles/${articleId}`);
    expect(get.status).toBe(200);
    expect(get.body.articleId).toBe(articleId);
    expect(Array.isArray(get.body.comments)).toBe(true);
    // step2 评论结构
    expect(get.body.comments.length).toBeGreaterThanOrEqual(2);
    const cmts = get.body.comments;
    for (const c of cmts) {
      expect(c.commentId).toBeDefined();
      expect(c.articleId).toBe(articleId);
      expect(c.authorId).toBeDefined();
      expect(c.content).toBeDefined();
      expect(c.createdAt).toBeDefined();
    }
    // step3 评论按 createdAt 升序
    expect(cmts[0].createdAt <= cmts[cmts.length - 1].createdAt).toBe(true);
  });

  it('IT-008 发表评论+文章存在性校验（authMiddleware×commentService×articleService）', async () => {
    const { userId, token } = await registerAndLogin('alice');

    // 创建文章 A
    const create = await request(app)
      .post('/api/v1/articles')
      .set(bearer(token))
      .send({ title: 'A', content: 'b', tags: [] });
    const articleId = create.body.articleId;

    // step1 发表评论
    const cmt = await request(app)
      .post(`/api/v1/articles/${articleId}/comments`)
      .set(bearer(token))
      .send({ content: 'Nice post!' });
    expect(cmt.status).toBe(201);
    expect(cmt.body.commentId).toMatch(UUID_V4);
    expect(cmt.body.articleId).toBe(articleId);
    expect(cmt.body.authorId).toBe(userId); // authorId 来自 JWT
    expect(cmt.body.content).toBe('Nice post!');
    expect(cmt.body.createdAt).toBeTruthy();

    // step2 读取 commentStore
    const stored = deps.commentStore.findById(cmt.body.commentId);
    expect(stored).not.toBeNull();
    expect(stored!.articleId).toBe(articleId);
    expect(stored!.authorId).toBe(userId);

    // step3 文章详情聚合该评论
    const get = await request(app).get(`/api/v1/articles/${articleId}`);
    expect(get.status).toBe(200);
    expect(get.body.comments.some((c: { commentId: string }) => c.commentId === cmt.body.commentId)).toBe(true);
  });

  it('IT-009 删除评论-作者隔离→40301（bob 拒绝 / alice 成功）', async () => {
    const alice = await registerAndLogin('alice');
    const bob = await registerAndLogin('bob');

    // alice 创建文章 + 评论
    const create = await request(app)
      .post('/api/v1/articles')
      .set(bearer(alice.token))
      .send({ title: 'A', content: 'b', tags: [] });
    const articleId = create.body.articleId;
    const cmt = await request(app)
      .post(`/api/v1/articles/${articleId}/comments`)
      .set(bearer(alice.token))
      .send({ content: 'mine' });
    const commentId = cmt.body.commentId;

    // step1 bob 删除 → 40301
    const delBob = await request(app)
      .delete(`/api/v1/comments/${commentId}`)
      .set(bearer(bob.token));
    expect(delBob.status).toBe(403);
    expect(delBob.body.code).toBe(40301);

    // step2 评论仍存在
    const get1 = await request(app).get(`/api/v1/articles/${articleId}`);
    expect(get1.status).toBe(200);
    expect(get1.body.comments.some((c: { commentId: string }) => c.commentId === commentId)).toBe(true);

    // step3 alice 删除 → 204
    const delAlice = await request(app)
      .delete(`/api/v1/comments/${commentId}`)
      .set(bearer(alice.token));
    expect(delAlice.status).toBe(204);

    // step4 评论不再含
    const get2 = await request(app).get(`/api/v1/articles/${articleId}`);
    expect(get2.status).toBe(200);
    expect(get2.body.comments.some((c: { commentId: string }) => c.commentId === commentId)).toBe(false);
  });

  it('IT-010 评论对不存在文章→40401（commentService×articleService 存在性校验）', async () => {
    const { token } = await registerAndLogin('alice');
    const nonExistId = '00000000-0000-4000-8000-000000000000';

    const cmt = await request(app)
      .post(`/api/v1/articles/${nonExistId}/comments`)
      .set(bearer(token))
      .send({ content: 'Nice' });
    expect(cmt.status).toBe(404);
    expect(cmt.body.code).toBe(40401);
    expect(cmt.body.message).toBe('文章不存在');

    // commentStore 未写入脏数据
    expect(deps.commentStore.size()).toBe(0);
  });

  // ==================== middleware×controller ====================

  it('IT-011 鉴权中间件-缺token/伪造/过期→40103/40102', async () => {
    const { userId, username, token } = await registerAndLogin('alice');
    const validBody = { title: 'T', content: 'C', tags: [] };

    // step1 缺 token → 40103
    const noToken = await request(app).post('/api/v1/articles').send(validBody);
    expect(noToken.status).toBe(401);
    expect(noToken.body.code).toBe(40103);
    expect(noToken.body.message).toBe('未提供认证令牌');

    // step2 伪造格式 token → 40102
    const fake = await request(app)
      .post('/api/v1/articles')
      .set(bearer('fake.invalid.token'))
      .send(validBody);
    expect(fake.status).toBe(401);
    expect(fake.body.code).toBe(40102);

    // step3 过期 token（正确密钥，exp 在过去）→ 40102
    const expired = jwt.sign(
      { userId, username, exp: Math.floor(Date.now() / 1000) - 10 },
      SECRET,
      { algorithm: 'HS256' },
    );
    const expiredRes = await request(app)
      .post('/api/v1/articles')
      .set(bearer(expired))
      .send(validBody);
    expect(expiredRes.status).toBe(401);
    expect(expiredRes.body.code).toBe(40102);

    // step4 错误密钥签名 token → 40102
    const forged = jwt.sign({ userId, username }, 'wrong-secret', {
      algorithm: 'HS256',
      expiresIn: 3600,
    });
    const forgedRes = await request(app)
      .post('/api/v1/articles')
      .set(bearer(forged))
      .send(validBody);
    expect(forgedRes.status).toBe(401);
    expect(forgedRes.body.code).toBe(40102);

    // step5 合法 token 可访问（对照）+ 无文章被创建（前 4 步均未写入）
    expect(deps.articleStore.size()).toBe(0);
    const ok = await request(app).post('/api/v1/articles').set(bearer(token)).send(validBody);
    expect(ok.status).toBe(201);
    expect(deps.articleStore.size()).toBe(1);
  });

  it('IT-012 zod参数校验-非法入参→40001（validateRequest×errorHandler）', async () => {
    // step1 注册：username<3 且 password<8
    const r1 = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'ab', password: 'short' });
    expect(r1.status).toBe(400);
    expect(r1.body.code).toBe(40001);
    expect(r1.body.message).toBe('参数校验失败');
    expect(Array.isArray(r1.body.details)).toBe(true);

    const { token } = await registerAndLogin('alice');

    // step2 创建文章：title 为空
    const r2 = await request(app)
      .post('/api/v1/articles')
      .set(bearer(token))
      .send({ title: '', content: 'x' });
    expect(r2.status).toBe(400);
    expect(r2.body.code).toBe(40001);

    // step3 分页越界 page=0 & pageSize=200
    const r3 = await request(app).get('/api/v1/articles').query({ page: 0, pageSize: 200 });
    expect(r3.status).toBe(400);
    expect(r3.body.code).toBe(40001);

    // step4 缺 password 字段
    const r4 = await request(app).post('/api/v1/auth/register').send({ username: 'alice' });
    expect(r4.status).toBe(400);
    expect(r4.body.code).toBe(40001);
  });

  it('IT-013 bcrypt哈希存储-cost=10+无明文（passwordHasher×userStore）', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'carol', password: 'Secret123' });
    expect(reg.status).toBe(201);
    expect(reg.body.userId).toMatch(UUID_V4);
    expect(reg.body.username).toBe('carol');
    expect(reg.body.password).toBeUndefined();

    // step2 读取 userStore 内部记录
    const user = deps.userStore.findByUsername('carol');
    expect(user).toBeDefined();
    expect(user!.passwordHash).toMatch(/^\$2b\$10\$/);
    expect((user as unknown as Record<string, unknown>).password).toBeUndefined();

    // step3 getRounds === 10（使用真实 PasswordHasher 模块，非 mock）
    const hasher = new PasswordHasher();
    expect(hasher.getRounds(user!.passwordHash)).toBe(10);

    // step4 正确密码 compare true
    expect(await hasher.compare('Secret123', user!.passwordHash)).toBe(true);
    // step5 错误密码 compare false
    expect(await hasher.compare('WrongPass', user!.passwordHash)).toBe(false);

    // step6 全量扫描 userStore 不含明文
    const dump = JSON.stringify({ users: Array.from({ length: deps.userStore.size() }) });
    expect(dump).not.toContain('Secret123');
    // 直接校验存储记录序列化
    expect(JSON.stringify(user)).not.toContain('Secret123');
  });
});
