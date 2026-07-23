/**
 * 验收测试（阶段 8 执行）：UAT-001 ~ UAT-015
 *
 * 硬约束：
 *   - 使用真实 Express app（createApp()），通过 supertest 做端到端验收测试
 *   - 不得用 mock 替代被测真实模块（service / store / middleware / utils 均为真实实例）
 *   - JWT_SECRET 由 npm run test:acceptance 注入（cross-env JWT_SECRET=test-secret-blog-demo）
 *   - 每个测试套件前清空内存存储，避免测试间状态污染
 *   - 性能（UAT-013）/ 静态检查（UAT-014）/ 覆盖率（UAT-015）采用真实子进程执行
 *
 * 覆盖维度（按 docs/requirement-spec.md §5.1 内嵌 UAT-001~015）：
 *   - UAT-001~003：REQ-001 用户认证（注册成功 201 / 登录 200+JWT / 错误密码 40101）
 *   - UAT-004~006：REQ-002 文章管理（创建 201 / 作者修改+非作者 40301 / 作者删除+非作者 40301）
 *   - UAT-007~008：REQ-003 公开浏览（分页列表 200 / 详情+评论聚合）
 *   - UAT-009~010：REQ-004 评论（发表 201 / 删除自己 204 + 删他人 40301）
 *   - UAT-011~012：NFR-001 安全（bcrypt 哈希无明文 / JWT 过期 40102）
 *   - UAT-013：NFR-002 性能（读接口 P95 ≤ 200ms）
 *   - UAT-014：NFR-003 可维护性（tsc strict 0 错误）
 *   - UAT-015：NFR-004 可测试性（单元覆盖率 ≥ 80%）
 *
 * 注：文章更新路由为 PUT（src/routes/article.routes.ts），requirement-spec §5.1 写作 PATCH，
 *     验收测试按实际实现契约使用 PUT（与系统测试 ST-002 一致）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { spawnSync } from 'child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from '../../src/app';
import { PasswordHasher } from '../../src/utils/password';
import type { Article } from '../../src/types';

const { app, deps } = createApp();

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET = process.env.JWT_SECRET as string;
const DEMO_ROOT = resolve(__dirname, '../..');

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

/** 向 articleStore 直接预置 N 篇文章（不同 createdAt，降序友好）。真实 store，非 mock。 */
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

describe('验收测试 UAT-001 ~ UAT-015', () => {
  // ==================== REQ-001 用户认证 ====================

  it('UAT-001 [REQ-001] 用户注册成功 - 201 + userId(UUID v4) + 无明文密码 + passwordHash $2b$10$', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'alice', password: 'Passw0rd!' });
    expect(res.status).toBe(201);
    expect(res.body.userId).toMatch(UUID_V4);
    expect(res.body.username).toBe('alice');
    // 响应不含 password 字段，响应体序列化无明文
    expect(res.body.password).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('Passw0rd!');
    // 存储中 passwordHash 以 $2b$10$ 开头
    const user = deps.userStore.findByUsername('alice');
    expect(user).toBeDefined();
    expect(user!.passwordHash).toMatch(/^\$2b\$10\$/);
  });

  it('UAT-002 [REQ-001] 用户登录成功并返回 JWT - 200 + token 三段式 + expiresIn 3600 + exp-iat===3600', async () => {
    // 前置：注册 alice
    await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'alice', password: 'Passw0rd!' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'alice', password: 'Passw0rd!' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.token.split('.').length).toBe(3);
    expect(res.body.expiresIn).toBe(3600);

    // 解码 JWT（不校验签名）验证 exp - iat === 3600
    const decoded = jwt.decode(res.body.token) as JwtPayload;
    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp! - decoded.iat!).toBe(3600);
  });

  it('UAT-003 [REQ-001] 用户登录 - 错误密码 - 401 + 40101 + 不返回 token', async () => {
    // 前置：注册 alice
    await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'alice', password: 'Passw0rd!' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'alice', password: 'WrongPass' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(40101);
    expect(res.body.message).toBe('用户名或密码错误');
    expect(res.body.token).toBeUndefined();
  });

  // ==================== REQ-002 文章管理 ====================

  it('UAT-004 [REQ-002] 创建文章（已认证作者）- 201 + articleId(UUID v4) + authorId=JWT.userId', async () => {
    const { userId, token } = await registerAndLogin('alice');

    const res = await request(app)
      .post('/api/v1/articles')
      .set(bearer(token))
      .send({ title: 'Hello World', content: 'My first post.', tags: ['intro'] });
    expect(res.status).toBe(201);
    expect(res.body.articleId).toMatch(UUID_V4);
    expect(res.body.authorId).toBe(userId);
    expect(res.body.title).toBe('Hello World');
    expect(res.body.content).toBe('My first post.');
    expect(res.body.tags).toEqual(['intro']);
    expect(res.body.createdAt).toBeTruthy();
  });

  it('UAT-005 [REQ-002] 修改自己的文章 + 非作者修改被拒 - 作者 200 / 非作者 403+40301', async () => {
    const alice = await registerAndLogin('alice');
    const bob = await registerAndLogin('bob');

    // alice 创建文章
    const create = await request(app)
      .post('/api/v1/articles')
      .set(bearer(alice.token))
      .send({ title: 'Hello World', content: 'My first post.', tags: ['intro'] });
    expect(create.status).toBe(201);
    const articleId = create.body.articleId;
    const createdAt = create.body.createdAt;

    // 作者 B（bob）修改 alice 的文章 → 403 + 40301（文章仍存在时校验作者隔离）
    const putByBob = await request(app)
      .put(`/api/v1/articles/${articleId}`)
      .set(bearer(bob.token))
      .send({ title: 'Hello World (v2)' });
    expect(putByBob.status).toBe(403);
    expect(putByBob.body.code).toBe(40301);

    // 作者 A（alice）修改自己的文章 → 200，title 更新，updatedAt >= createdAt
    const putByAlice = await request(app)
      .put(`/api/v1/articles/${articleId}`)
      .set(bearer(alice.token))
      .send({ title: 'Hello World (v2)' });
    expect(putByAlice.status).toBe(200);
    expect(putByAlice.body.title).toBe('Hello World (v2)');
    expect(putByAlice.body.updatedAt >= createdAt).toBe(true);
  });

  it('UAT-006 [REQ-002] 删除自己的文章 + 非作者删除被拒 - 作者 204 / 非作者 403+40301 / 删除后 404', async () => {
    const alice = await registerAndLogin('alice');
    const bob = await registerAndLogin('bob');

    // alice 创建文章
    const create = await request(app)
      .post('/api/v1/articles')
      .set(bearer(alice.token))
      .send({ title: 'To be deleted', content: 'c', tags: [] });
    expect(create.status).toBe(201);
    const articleId = create.body.articleId;

    // 作者 B（bob）删除 alice 的文章 → 403 + 40301（文章仍存在时校验）
    const delByBob = await request(app)
      .delete(`/api/v1/articles/${articleId}`)
      .set(bearer(bob.token));
    expect(delByBob.status).toBe(403);
    expect(delByBob.body.code).toBe(40301);

    // 作者 A（alice）删除自己的文章 → 204
    const delByAlice = await request(app)
      .delete(`/api/v1/articles/${articleId}`)
      .set(bearer(alice.token));
    expect(delByAlice.status).toBe(204);

    // 删除后 GET → 404 + 40401
    const after = await request(app).get(`/api/v1/articles/${articleId}`);
    expect(after.status).toBe(404);
    expect(after.body.code).toBe(40401);
  });

  // ==================== REQ-003 公开浏览 ====================

  it('UAT-007 [REQ-003] 公开列表分页浏览（未认证）- 200 + 分页结构 + page=2 items=5', async () => {
    // 预置 15 篇文章（真实 store）
    seedArticles(15);
    expect(deps.articleStore.size()).toBe(15);

    // page=1 pageSize=10（无 Authorization 头）
    const p1 = await request(app)
      .get('/api/v1/articles')
      .query({ page: 1, pageSize: 10 });
    expect(p1.status).toBe(200);
    expect(Array.isArray(p1.body.items)).toBe(true);
    expect(p1.body.items.length).toBe(10);
    expect(p1.body.total).toBe(15);
    expect(p1.body.page).toBe(1);
    expect(p1.body.pageSize).toBe(10);

    // page=2 pageSize=10 → 5 条
    const p2 = await request(app)
      .get('/api/v1/articles')
      .query({ page: 2, pageSize: 10 });
    expect(p2.status).toBe(200);
    expect(p2.body.items.length).toBe(5);
    expect(p2.body.total).toBe(15);
  });

  it('UAT-008 [REQ-003, REQ-004] 查看文章详情 + 评论聚合 - 200 + comments[]>=2 + 升序', async () => {
    const alice = await registerAndLogin('alice');
    const bob = await registerAndLogin('bob');

    // alice 创建文章
    const create = await request(app)
      .post('/api/v1/articles')
      .set(bearer(alice.token))
      .send({ title: 'Detail Demo', content: 'c', tags: [] });
    expect(create.status).toBe(201);
    const articleId = create.body.articleId;

    // alice + bob 各发一条评论（≥2 条）
    const c1 = await request(app)
      .post(`/api/v1/articles/${articleId}/comments`)
      .set(bearer(alice.token))
      .send({ content: 'comment from alice' });
    expect(c1.status).toBe(201);
    const c2 = await request(app)
      .post(`/api/v1/articles/${articleId}/comments`)
      .set(bearer(bob.token))
      .send({ content: 'comment from bob' });
    expect(c2.status).toBe(201);

    // 访客查看详情（无 Authorization）
    const res = await request(app).get(`/api/v1/articles/${articleId}`);
    expect(res.status).toBe(200);
    expect(res.body.articleId).toBe(articleId);
    expect(Array.isArray(res.body.comments)).toBe(true);
    expect(res.body.comments.length).toBeGreaterThanOrEqual(2);
    // 评论按 createdAt 升序
    const cmts = res.body.comments;
    for (let i = 1; i < cmts.length; i++) {
      expect(cmts[i].createdAt >= cmts[i - 1].createdAt).toBe(true);
    }
  });

  // ==================== REQ-004 评论 ====================

  it('UAT-009 [REQ-004] 已登录用户对存在文章发表评论 - 201 + commentId + authorId=JWT.userId', async () => {
    const alice = await registerAndLogin('alice');

    // alice 创建文章
    const create = await request(app)
      .post('/api/v1/articles')
      .set(bearer(alice.token))
      .send({ title: 'Comment Target', content: 'c', tags: [] });
    expect(create.status).toBe(201);
    const articleId = create.body.articleId;

    // 发表评论
    const res = await request(app)
      .post(`/api/v1/articles/${articleId}/comments`)
      .set(bearer(alice.token))
      .send({ content: 'Nice post!' });
    expect(res.status).toBe(201);
    expect(res.body.commentId).toMatch(UUID_V4);
    expect(res.body.articleId).toBe(articleId);
    expect(res.body.authorId).toBe(alice.userId);
    expect(res.body.content).toBe('Nice post!');
    expect(res.body.createdAt).toBeTruthy();
  });

  it('UAT-010 [REQ-004] 删除自己评论 + 删除他人评论被拒 - 自己 204 / 他人 403+40301', async () => {
    const alice = await registerAndLogin('alice');
    const bob = await registerAndLogin('bob');

    // alice 创建文章 + 评论
    const create = await request(app)
      .post('/api/v1/articles')
      .set(bearer(alice.token))
      .send({ title: 'X', content: 'c', tags: [] });
    expect(create.status).toBe(201);
    const articleId = create.body.articleId;

    const cmt = await request(app)
      .post(`/api/v1/articles/${articleId}/comments`)
      .set(bearer(alice.token))
      .send({ content: 'alice comment' });
    expect(cmt.status).toBe(201);
    const commentId = cmt.body.commentId;

    // 作者 B（bob）删除 alice 的评论 → 403 + 40301
    const delByBob = await request(app)
      .delete(`/api/v1/comments/${commentId}`)
      .set(bearer(bob.token));
    expect(delByBob.status).toBe(403);
    expect(delByBob.body.code).toBe(40301);

    // 作者 A（alice）删除自己评论 → 204
    const delByAlice = await request(app)
      .delete(`/api/v1/comments/${commentId}`)
      .set(bearer(alice.token));
    expect(delByAlice.status).toBe(204);

    // 评论列表随详情返回：评论已删除
    const detail = await request(app).get(`/api/v1/articles/${articleId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.comments.length).toBe(0);
  });

  // ==================== NFR-001 安全 ====================

  it('UAT-011 [NFR-001] 密码以 bcrypt 哈希存储（无明文）- $2b$10$ + getRounds===10 + 无 password 字段', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'bob', password: 'Secret123' });
    expect(res.status).toBe(201);

    // 读取 userStore 内部记录（真实 store）
    const user = deps.userStore.findByUsername('bob');
    expect(user).toBeDefined();
    expect(user!.passwordHash).toMatch(/^\$2b\$10\$/);
    expect(user!.passwordHash).not.toBe('Secret123');
    expect((user as unknown as Record<string, unknown>).password).toBeUndefined();
    expect(JSON.stringify(user)).not.toContain('Secret123');

    // 真实 PasswordHasher 模块验证 cost=10
    const hasher = new PasswordHasher();
    expect(hasher.getRounds(user!.passwordHash)).toBe(10);
  });

  it('UAT-012 [NFR-001] JWT 过期后访问受保护资源被拒 - 401 + 40102 + 不返回 201/articleId', async () => {
    const { userId, username } = await registerAndLogin('alice');

    // 过期 JWT（exp = now - 1s，正确密钥）
    const expiredToken = jwt.sign(
      { userId, username, exp: Math.floor(Date.now() / 1000) - 1 },
      SECRET,
      { algorithm: 'HS256' },
    );

    const res = await request(app)
      .post('/api/v1/articles')
      .set(bearer(expiredToken))
      .send({ title: 'Should Fail', content: 'c', tags: [] });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(40102);
    expect(res.body.message).toBe('JWT 已过期或无效');
    expect(res.body.articleId).toBeUndefined();

    // 受保护接口被拒后存储无写入
    expect(deps.articleStore.size()).toBe(0);
  });

  // ==================== NFR-002 性能 ====================

  it('UAT-013 [NFR-002] 列表接口 P95 响应时间 ≤ 200ms - 10000 条数据规模 + 采样 P95', async () => {
    // 预置 10000 篇文章（真实 store，匹配 UAT 设计数据规模）
    seedArticles(10000);
    expect(deps.articleStore.size()).toBe(10000);

    // 循环采样 N 次 GET /articles?page=1&pageSize=10，测量响应时间
    const N = 150;
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

    // 计算 P95（nearest-rank）
    latencies.sort((a, b) => a - b);
    const p95Index = Math.ceil(N * 0.95) - 1;
    const p95 = latencies[p95Index];
    const errorRate = failCount / N;

    // NFR-002 验收：P95 ≤ 200ms，errorRate=0，无 5xx
    expect(errorRate).toBe(0);
    expect(p95).toBeLessThanOrEqual(200);
    expect(p95).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log(
      `UAT-013 性能采样: N=${N}, P95=${p95.toFixed(2)}ms, max=${latencies[N - 1].toFixed(2)}ms, errorRate=${errorRate}`,
    );
  }, 60000);

  // ==================== NFR-003 可维护性 ====================

  it('UAT-014 [NFR-003] tsc strict 模式 0 错误 - npx tsc --noEmit 退出码 0', () => {
    // 真实子进程执行 tsc 静态检查（非 mock）
    const result = spawnSync('npx', ['tsc', '--noEmit'], {
      cwd: DEMO_ROOT,
      encoding: 'utf-8',
      shell: true,
      env: { ...process.env, JWT_SECRET: 'test-secret-blog-demo' },
    });
    const stderr = (result.stderr ?? '').trim();
    const stdout = (result.stdout ?? '').trim();
    expect(
      result.status,
      `tsc --noEmit 退出码应为 0，实际 ${result.status}\nstdout: ${stdout}\nstderr: ${stderr}`,
    ).toBe(0);
    // strict 模式 0 error / 0 warning：stderr 无输出
    expect(stderr).toBe('');
  }, 120000);

  // ==================== NFR-004 可测试性 ====================

  it('UAT-015 [NFR-004] 单元测试代码覆盖率 ≥ 80% - branches/lines/functions/statements 均 ≥ 80', () => {
    // 真实子进程执行单元测试覆盖率（仅 tests/unit，避免验收测试递归）
    const run = spawnSync('npx', ['vitest', 'run', 'tests/unit', '--coverage'], {
      cwd: DEMO_ROOT,
      encoding: 'utf-8',
      shell: true,
      env: { ...process.env, JWT_SECRET: 'test-secret-blog-demo' },
    });
    expect(
      run.status,
      `vitest run tests/unit --coverage 退出码应为 0，实际 ${run.status}\nstdout: ${(run.stdout ?? '').slice(-2000)}\nstderr: ${(run.stderr ?? '').slice(-2000)}`,
    ).toBe(0);

    // 解析 coverage-summary.json（json-summary reporter 产出）
    const summaryPath = resolve(DEMO_ROOT, 'coverage', 'coverage-summary.json');
    expect(existsSync(summaryPath)).toBe(true);
    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8')) as {
      total: {
        lines: { pct: number };
        branches: { pct: number };
        functions: { pct: number };
        statements: { pct: number };
      };
    };
    const { lines, branches, functions, statements } = summary.total;
    // NFR-004 验收：四项均 ≥ 80%
    expect(lines.pct).toBeGreaterThanOrEqual(80);
    expect(branches.pct).toBeGreaterThanOrEqual(80);
    expect(functions.pct).toBeGreaterThanOrEqual(80);
    expect(statements.pct).toBeGreaterThanOrEqual(80);
    // eslint-disable-next-line no-console
    console.log(
      `UAT-015 覆盖率: lines=${lines.pct}%, branches=${branches.pct}%, functions=${functions.pct}%, statements=${statements.pct}%`,
    );
  }, 180000);
});
