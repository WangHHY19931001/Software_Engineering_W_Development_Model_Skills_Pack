/**
 * 系统测试（阶段 7 执行）：ST-001 ~ ST-008
 *
 * 硬约束：
 *   - 使用真实 Express app（createApp()），通过 supertest 做端到端系统测试
 *   - 不得用 mock 替代被测真实模块（service / store / middleware 均为真实实例）
 *   - JWT_SECRET 由 npm run test:system 注入（cross-env JWT_SECRET=test-secret-blog-demo）
 *   - 每个测试套件前清空内存存储，避免测试间状态污染
 *   - 性能基线（ST-004）用 vitest 内近似采样（不依赖外部 k6），循环 N 次测量响应时间计算 P95
 *
 * 覆盖维度（按 docs/system-test-cases.md ST-001~008）：
 *   - ST-001：端到端业务全链路（注册→登录→创建文章→浏览→评论→删除）
 *   - ST-002：作者隔离（非作者修改/删除返回 40301）
 *   - ST-003：评论增删 + 删除他人评论被拒 + 评论随详情聚合
 *   - ST-004：性能基线（读接口 P95 ≤ 200ms，NFR-002）
 *   - ST-005：安全基线 - 未授权访问受保护资源被拒（40103）
 *   - ST-006：安全基线 - JWT 过期/伪造/格式错误（40102）
 *   - ST-007：安全基线 - 密码 bcrypt 哈希存储（cost=10，无明文）
 *   - ST-008：异常路径（40001/40401/40901/40101）+ 数据规模（1000 条分页边界）
 *
 * 注：文章更新路由为 PUT（src/routes/article.routes.ts 第 51 行），非 PATCH；
 *     403 消息为「无权操作他人文章」（src/services/article.service.ts 第 50/66 行）；
 *     404 消息为「文章不存在」（src/services/article.service.ts 第 47/63/74 行）。
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

/** 向 articleStore 直接预置 N 篇文章（不同 createdAt，降序友好）。 */
function seedArticles(n: number, authorId = 'seed-user'): string[] {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = `seed-${i}-${Math.random().toString(36).slice(2, 8)}`;
    const ts = new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString();
    deps.articleStore.insert({
      id,
      authorId,
      title: `Seeded Article ${i}`,
      content: `content-${i}`,
      tags: ['seed'],
      createdAt: ts,
      updatedAt: ts,
    } as Article);
    ids.push(id);
  }
  return ids;
}

beforeEach(() => {
  deps.userStore.clear();
  deps.articleStore.clear();
  deps.commentStore.clear();
});

describe('系统测试 ST-001 ~ ST-008', () => {
  // ==================== ST-001 端到端全链路 ====================

  it('ST-001 端到端 - 注册→登录→创建文章→浏览→评论→删除全链路', async () => {
    // step1 注册
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'alice', password: 'Passw0rd!' });
    expect(reg.status).toBe(201);
    expect(reg.body.userId).toMatch(UUID_V4);
    expect(reg.body.username).toBe('alice');
    expect(reg.body.password).toBeUndefined();
    expect(JSON.stringify(reg.body)).not.toContain('Passw0rd!');
    const userId = reg.body.userId;

    // step2 登录
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'alice', password: 'Passw0rd!' });
    expect(login.status).toBe(200);
    expect(login.body.token.split('.').length).toBe(3);
    expect(login.body.expiresIn).toBe(3600);
    const token = login.body.token;

    // step3 创建文章（受保护）
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
    const articleId = create.body.articleId;

    // step4 公开浏览列表（无认证）
    const list = await request(app)
      .get('/api/v1/articles')
      .query({ page: 1, pageSize: 10 });
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBe(1);
    expect(list.body.total).toBe(1);
    expect(list.body.page).toBe(1);
    expect(list.body.pageSize).toBe(10);
    expect(list.body.items[0].title).toBe('Hello World');

    // step5 公开查看详情（无认证，空评论）
    const detail1 = await request(app).get(`/api/v1/articles/${articleId}`);
    expect(detail1.status).toBe(200);
    expect(detail1.body.articleId).toBe(articleId);
    expect(Array.isArray(detail1.body.comments)).toBe(true);
    expect(detail1.body.comments.length).toBe(0);

    // step6 发表评论（受保护）
    const cmt = await request(app)
      .post(`/api/v1/articles/${articleId}/comments`)
      .set(bearer(token))
      .send({ content: 'Nice post!' });
    expect(cmt.status).toBe(201);
    expect(cmt.body.commentId).toMatch(UUID_V4);
    expect(cmt.body.articleId).toBe(articleId);
    expect(cmt.body.authorId).toBe(userId);
    expect(cmt.body.content).toBe('Nice post!');
    expect(cmt.body.createdAt).toBeTruthy();

    // step7 再次查看详情，评论聚合
    const detail2 = await request(app).get(`/api/v1/articles/${articleId}`);
    expect(detail2.status).toBe(200);
    expect(detail2.body.comments.length).toBe(1);
    expect(detail2.body.comments[0].content).toBe('Nice post!');
    expect(detail2.body.comments[0].commentId).toBe(cmt.body.commentId);

    // step8 作者删除文章
    const del = await request(app)
      .delete(`/api/v1/articles/${articleId}`)
      .set(bearer(token));
    expect(del.status).toBe(204);

    // step9 删除后查询 → 404 + 40401
    const after = await request(app).get(`/api/v1/articles/${articleId}`);
    expect(after.status).toBe(404);
    expect(after.body.code).toBe(40401);
  });

  // ==================== ST-002 作者隔离 ====================

  it('ST-002 作者隔离 - A 修改/删除 B 的文章被拒', async () => {
    const alice = await registerAndLogin('alice');
    const bob = await registerAndLogin('bob');

    // A 创建文章
    const create = await request(app)
      .post('/api/v1/articles')
      .set(bearer(alice.token))
      .send({ title: 'A 的文章', content: 'content-a', tags: [] });
    expect(create.status).toBe(201);
    const articleId = create.body.articleId;
    const createdAt = create.body.createdAt;

    // B 修改 A 的文章 → 403 + 40301
    const putByBob = await request(app)
      .put(`/api/v1/articles/${articleId}`)
      .set(bearer(bob.token))
      .send({ title: '被篡改' });
    expect(putByBob.status).toBe(403);
    expect(putByBob.body.code).toBe(40301);

    // A 修改自己的文章 → 200，title 更新，updatedAt >= createdAt
    const putByAlice = await request(app)
      .put(`/api/v1/articles/${articleId}`)
      .set(bearer(alice.token))
      .send({ title: 'A 修改自己的' });
    expect(putByAlice.status).toBe(200);
    expect(putByAlice.body.title).toBe('A 修改自己的');
    expect(putByAlice.body.updatedAt >= createdAt).toBe(true);

    // B 删除 A 的文章 → 403 + 40301
    const delByBob = await request(app)
      .delete(`/api/v1/articles/${articleId}`)
      .set(bearer(bob.token));
    expect(delByBob.status).toBe(403);
    expect(delByBob.body.code).toBe(40301);

    // 公开查询：文章仍存在，title 未被篡改
    const get = await request(app).get(`/api/v1/articles/${articleId}`);
    expect(get.status).toBe(200);
    expect(get.body.title).toBe('A 修改自己的');

    // A 删除自己的文章 → 204
    const delByAlice = await request(app)
      .delete(`/api/v1/articles/${articleId}`)
      .set(bearer(alice.token));
    expect(delByAlice.status).toBe(204);
  });

  // ==================== ST-003 评论增删 + 聚合 ====================

  it('ST-003 评论增删 + 删除他人评论被拒 + 评论随详情聚合', async () => {
    const alice = await registerAndLogin('alice');
    const bob = await registerAndLogin('bob');

    // A 创建文章 Y
    const create = await request(app)
      .post('/api/v1/articles')
      .set(bearer(alice.token))
      .send({ title: 'Article Y', content: 'y', tags: [] });
    expect(create.status).toBe(201);
    const articleId = create.body.articleId;

    // A 发表评论
    const cmtA = await request(app)
      .post(`/api/v1/articles/${articleId}/comments`)
      .set(bearer(alice.token))
      .send({ content: 'A 的评论' });
    expect(cmtA.status).toBe(201);
    const commentIdA = cmtA.body.commentId;

    // B 发表评论
    const cmtB = await request(app)
      .post(`/api/v1/articles/${articleId}/comments`)
      .set(bearer(bob.token))
      .send({ content: 'B 的评论' });
    expect(cmtB.status).toBe(201);
    const commentIdB = cmtB.body.commentId;

    // 公开查看详情：2 条评论，按 createdAt 升序
    const detail1 = await request(app).get(`/api/v1/articles/${articleId}`);
    expect(detail1.status).toBe(200);
    expect(detail1.body.comments.length).toBe(2);
    const cmts = detail1.body.comments;
    expect(cmts[0].createdAt <= cmts[cmts.length - 1].createdAt).toBe(true);

    // B 删除 A 的评论 → 403 + 40301
    const delByBob = await request(app)
      .delete(`/api/v1/comments/${commentIdA}`)
      .set(bearer(bob.token));
    expect(delByBob.status).toBe(403);
    expect(delByBob.body.code).toBe(40301);

    // A 删除自己的评论 → 204
    const delByAlice = await request(app)
      .delete(`/api/v1/comments/${commentIdA}`)
      .set(bearer(alice.token));
    expect(delByAlice.status).toBe(204);

    // 公开查看详情：1 条评论，剩 B 的评论
    const detail2 = await request(app).get(`/api/v1/articles/${articleId}`);
    expect(detail2.status).toBe(200);
    expect(detail2.body.comments.length).toBe(1);
    expect(detail2.body.comments[0].commentId).toBe(commentIdB);
    expect(detail2.body.comments[0].content).toBe('B 的评论');

    // 对不存在文章发表评论 → 404 + 40401
    const nonExistId = '00000000-0000-4000-8000-000000000000';
    const cmtNotFound = await request(app)
      .post(`/api/v1/articles/${nonExistId}/comments`)
      .set(bearer(alice.token))
      .send({ content: 'x' });
    expect(cmtNotFound.status).toBe(404);
    expect(cmtNotFound.body.code).toBe(40401);
  });

  // ==================== ST-004 性能基线 P95 ≤ 200ms ====================

  it('ST-004 性能基线 - 读接口 P95 ≤ 200ms（10000 条数据规模）', async () => {
    // step1 预置 10000 篇文章
    seedArticles(10000);
    expect(deps.articleStore.size()).toBe(10000);

    // step2 循环采样 N 次 GET /articles?page=1&pageSize=10，测量响应时间
    const N = 200;
    const latencies: number[] = [];
    let failCount = 0;
    for (let i = 0; i < N; i++) {
      const start = performance.now();
      const res = await request(app)
        .get('/api/v1/articles')
        .query({ page: 1, pageSize: 10 });
      const elapsed = performance.now() - start;
      latencies.push(elapsed);
      if (res.status >= 500) failCount++;
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(10000);
      expect(res.body.items.length).toBe(10);
    }

    // step3 计算 P95（nearest-rank）
    latencies.sort((a, b) => a - b);
    const p95Index = Math.ceil(N * 0.95) - 1;
    const p95 = latencies[p95Index];
    const max = latencies[N - 1];

    // NFR-002 验收：P95 ≤ 200ms，无 5xx
    expect(failCount).toBe(0);
    expect(p95).toBeLessThanOrEqual(200);
    // 诊断信息（不阻断）：打印 P95 / max
    // eslint-disable-next-line no-console
    console.log(`ST-004 性能采样: N=${N}, P95=${p95.toFixed(2)}ms, max=${max.toFixed(2)}ms, failures=${failCount}`);
    expect(p95).toBeGreaterThan(0);
  });

  // ==================== ST-005 未授权访问被拒 ====================

  it('ST-005 安全基线 - 未授权访问受保护资源被拒（40103）', async () => {
    // 预置 1 篇已存在文章（供 DELETE / POST comment 路径）
    const { token } = await registerAndLogin('alice');
    const create = await request(app)
      .post('/api/v1/articles')
      .set(bearer(token))
      .send({ title: 'existing', content: 'c', tags: [] });
    expect(create.status).toBe(201);
    const articleId = create.body.articleId;

    // step1 POST /articles 无 Authorization → 401 + 40103
    const noTokenPost = await request(app)
      .post('/api/v1/articles')
      .send({ title: 'x', content: 'y', tags: [] });
    expect(noTokenPost.status).toBe(401);
    expect(noTokenPost.body.code).toBe(40103);
    expect(noTokenPost.body.message).toBe('未提供认证令牌');

    // step2 DELETE /articles/:id 无 Authorization → 401 + 40103
    const noTokenDel = await request(app).delete(`/api/v1/articles/${articleId}`);
    expect(noTokenDel.status).toBe(401);
    expect(noTokenDel.body.code).toBe(40103);

    // step3 POST /articles/:id/comments 无 Authorization → 401 + 40103
    const noTokenCmt = await request(app)
      .post(`/api/v1/articles/${articleId}/comments`)
      .send({ content: 'x' });
    expect(noTokenCmt.status).toBe(401);
    expect(noTokenCmt.body.code).toBe(40103);

    // step4 公开 GET /articles 无 Authorization → 200（对照组，不受鉴权影响）
    const publicGet = await request(app)
      .get('/api/v1/articles')
      .query({ page: 1, pageSize: 10 });
    expect(publicGet.status).toBe(200);

    // 受保护接口被拒后存储无写入
    expect(deps.articleStore.size()).toBe(1);
    expect(deps.commentStore.size()).toBe(0);
  });

  // ==================== ST-006 JWT 过期/伪造 ====================

  it('ST-006 安全基线 - JWT 过期/伪造/格式错误（40102）', async () => {
    const { userId, username, token } = await registerAndLogin('alice');
    const validBody = { title: 'T', content: 'C', tags: [] };

    // step1 过期 JWT（exp = now - 10s，正确密钥）→ 401 + 40102
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

    // step2 伪造签名 JWT（错误密钥）→ 401 + 40102
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

    // step3 格式错误 JWT → 401 + 40102
    const malformedRes = await request(app)
      .post('/api/v1/articles')
      .set(bearer('not.a.jwt'))
      .send(validBody);
    expect(malformedRes.status).toBe(401);
    expect(malformedRes.body.code).toBe(40102);

    // step4 合法 JWT（对照组）→ 201
    const ok = await request(app)
      .post('/api/v1/articles')
      .set(bearer(token))
      .send(validBody);
    expect(ok.status).toBe(201);
    expect(ok.body.articleId).toMatch(UUID_V4);

    // 前 3 步异常 JWT 均未写入文章
    expect(deps.articleStore.size()).toBe(1);
  });

  // ==================== ST-007 bcrypt 哈希存储 ====================

  it('ST-007 安全基线 - 密码 bcrypt 哈希存储（cost=10，无明文）', async () => {
    // step1 注册
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'bob', password: 'Secret123' });
    expect(reg.status).toBe(201);
    expect(reg.body.userId).toMatch(UUID_V4);
    expect(reg.body.username).toBe('bob');
    expect(reg.body.password).toBeUndefined();
    expect(JSON.stringify(reg.body)).not.toContain('Secret123');

    // step2 读取 UserStore 内部记录
    const user = deps.userStore.findByUsername('bob');
    expect(user).toBeDefined();
    expect(user!.passwordHash).toMatch(/^\$2b\$10\$/);
    expect(user!.passwordHash).not.toBe('Secret123');
    expect((user as unknown as Record<string, unknown>).password).toBeUndefined();

    // step3 getRounds === 10（真实 PasswordHasher 模块，非 mock）
    const hasher = new PasswordHasher();
    expect(hasher.getRounds(user!.passwordHash)).toBe(10);

    // step4 错误密码 compare false
    expect(await hasher.compare('WrongPass', user!.passwordHash)).toBe(false);
    // step5 正确密码 compare true
    expect(await hasher.compare('Secret123', user!.passwordHash)).toBe(true);

    // 存储序列化无明文
    expect(JSON.stringify(user)).not.toContain('Secret123');
  });

  // ==================== ST-008 异常路径 + 数据规模 ====================

  it('ST-008 异常路径 - 分页越界 + zod 校验 + 不存在文章 + 40901/40101 + 1000 条数据规模边界', async () => {
    // step1 分页越界 page=0 → 400 + 40001
    const page0 = await request(app)
      .get('/api/v1/articles')
      .query({ page: 0, pageSize: 10 });
    expect(page0.status).toBe(400);
    expect(page0.body.code).toBe(40001);

    // step2 分页越界 pageSize=200 → 400 + 40001
    const pageSize200 = await request(app)
      .get('/api/v1/articles')
      .query({ page: 1, pageSize: 200 });
    expect(pageSize200.status).toBe(400);
    expect(pageSize200.body.code).toBe(40001);

    // step3 zod 校验：用户名过短 + 密码不满足复杂度 → 400 + 40001
    const badReg = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'ab', password: 'short' });
    expect(badReg.status).toBe(400);
    expect(badReg.body.code).toBe(40001);

    // step4 zod 校验：缺 password 字段 → 400 + 40001
    const missingField = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'alice' });
    expect(missingField.status).toBe(400);
    expect(missingField.body.code).toBe(40001);

    // step5 不存在文章 → 404 + 40401
    const nonExistId = '11111111-1111-4111-8111-111111111111';
    const notFound = await request(app).get(`/api/v1/articles/${nonExistId}`);
    expect(notFound.status).toBe(404);
    expect(notFound.body.code).toBe(40401);

    // step6 合法分页对照组 → 200
    const okList = await request(app)
      .get('/api/v1/articles')
      .query({ page: 1, pageSize: 10 });
    expect(okList.status).toBe(200);
    expect(okList.body.page).toBe(1);
    expect(okList.body.pageSize).toBe(10);

    // step7 重复用户名 → 409 + 40901
    await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'carol', password: 'Passw0rd!' });
    const dup = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'carol', password: 'Passw0rd!' });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe(40901);

    // step8 错误密码登录 → 401 + 40101
    const wrongPass = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'carol', password: 'WrongPass1' });
    expect(wrongPass.status).toBe(401);
    expect(wrongPass.body.code).toBe(40101);

    // step9 数据规模：预置 1000 篇文章，验证分页边界
    deps.articleStore.clear();
    seedArticles(1000);
    expect(deps.articleStore.size()).toBe(1000);

    // page=1 pageSize=100 → 100 条
    const p1 = await request(app)
      .get('/api/v1/articles')
      .query({ page: 1, pageSize: 100 });
    expect(p1.status).toBe(200);
    expect(p1.body.total).toBe(1000);
    expect(p1.body.items.length).toBe(100);
    // 降序
    expect(p1.body.items[0].createdAt >= p1.body.items[1].createdAt).toBe(true);

    // page=10 pageSize=100 → 100 条（最后一页满页）
    const p10 = await request(app)
      .get('/api/v1/articles')
      .query({ page: 10, pageSize: 100 });
    expect(p10.status).toBe(200);
    expect(p10.body.items.length).toBe(100);

    // page=11 pageSize=100 → 0 条（越界返回空数组，total 仍 1000）
    const p11 = await request(app)
      .get('/api/v1/articles')
      .query({ page: 11, pageSize: 100 });
    expect(p11.status).toBe(200);
    expect(p11.body.items.length).toBe(0);
    expect(p11.body.total).toBe(1000);
  });
});
