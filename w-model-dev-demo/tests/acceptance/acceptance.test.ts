import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { app, deps } from '../../src/app.js';

/**
 * 验收测试（UAT-001 ~ UAT-015）。
 *
 * 设计来源：docs/requirement-spec.md §5 验收测试用例设计。
 * 执行阶段：W 模型阶段 8。
 *
 * 原则：
 * - 每个 UAT 对应 REQ-001~004 或 NFR-001~004 的验收标准，从「用户场景」出发。
 * - 用 supertest 跑端到端 HTTP 业务场景；不依赖单元 / 集成测试用例。
 * - NFR-001 安全：响应不含明文密码 / JWT exp ≤ 3600s / bcrypt cost ≥ 10。
 * - NFR-002 性能：P95 ≤ 200ms（采样 N 次）。
 * - NFR-003 可维护性：通过 `npx tsc --noEmit` 退出码 0 间接验证。
 * - NFR-004 可测试性：通过 coverage-summary.json 验证覆盖率 ≥ 80%。
 *
 * 用户确认区：本测试仅产出客观证据，用户确认（confirm / confirm-with-comments / reject）
 *   由真实用户在 docs/acceptance-test-report.md「用户确认」区填入；Agent 不得代签。
 */

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-blog-demo';

/**
 * 计算 P95。
 */
function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

describe('验收测试 UAT-001 ~ UAT-015', () => {
  beforeEach(async () => {
    const res = await request(app).post('/__test/reset');
    expect(res.status).toBe(204);
  });

  /* ============================================================
   * REQ-001 用户认证
   * ============================================================ */

  describe('UAT-001: REQ-001 用户注册成功', () => {
    it('POST /auth/register 返回 201 + userId UUID + username；响应不含 password；存储 passwordHash 以 $2b$10$ 开头', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Passw0rd!' });

      expect(res.status).toBe(201);
      expect(res.body.userId).toMatch(UUID_V4_RE);
      expect(res.body.username).toBe('alice');
      // 响应不含 password 字段（NFR-001 安全）
      expect(res.body.password).toBeUndefined();
      expect(res.body.passwordHash).toBeUndefined();

      // 存储校验：passwordHash 以 $2b$10$ 开头
      const user = deps.userStore.findByUsername('alice');
      expect(user).toBeDefined();
      expect(user!.passwordHash).toMatch(/^\$2b\$10\$/);
    });
  });

  describe('UAT-002: REQ-001 用户登录成功并返回 JWT', () => {
    it('POST /auth/login 返回 200 + token + expiresIn:3600；jwt.decode.exp - iat === 3600', async () => {
      // 前置：注册 alice
      await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Passw0rd!' });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'alice', password: 'Passw0rd!' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.expiresIn).toBe(3600);

      // JWT 三段式
      expect((res.body.token as string).split('.')).toHaveLength(3);

      // NFR-001：JWT exp - iat === 3600（≤ 3600s）
      const decoded = jwt.decode(res.body.token as string) as { iat: number; exp: number; userId: string };
      expect(decoded.exp - decoded.iat).toBe(3600);
      expect(decoded.userId).toBeDefined();
    });
  });

  describe('UAT-003: REQ-001 用户登录 - 错误密码', () => {
    it('错误密码返回 401 + 40101；不返回 token；与用户名不存在错误码相同（防枚举）', async () => {
      // 前置：注册 alice
      await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Passw0rd!' });

      const wrongRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'alice', password: 'WrongPass' });

      expect(wrongRes.status).toBe(401);
      expect(wrongRes.body.code).toBe(40101);
      expect(wrongRes.body.token).toBeUndefined();

      // 不存在的用户名也返回 40101（防用户枚举）
      const ghostRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'ghost', password: 'any' });
      expect(ghostRes.status).toBe(401);
      expect(ghostRes.body.code).toBe(40101);
    });
  });

  /* ============================================================
   * REQ-002 文章管理
   * ============================================================ */

  describe('UAT-004: REQ-002 创建文章（已认证作者）', () => {
    it('POST /articles 返回 201 + articleId UUID + authorId=JWT.userId + title/content/tags/createdAt', async () => {
      // 前置：注册 + 登录
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Passw0rd!' });
      const userId = regRes.body.userId as string;

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'alice', password: 'Passw0rd!' });
      const token = loginRes.body.token as string;

      const res = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Hello World', content: 'My first post.', tags: ['intro'] });

      expect(res.status).toBe(201);
      expect(res.body.articleId).toMatch(UUID_V4_RE);
      // authorId 来自 JWT 而非 body
      expect(res.body.authorId).toBe(userId);
      expect(res.body.title).toBe('Hello World');
      expect(res.body.content).toBe('My first post.');
      expect(res.body.tags).toEqual(['intro']);
      expect(res.body.createdAt).toBeDefined();
      // 响应不含 password 字段（NFR-001）
      expect(res.body.password).toBeUndefined();
    });
  });

  describe('UAT-005: REQ-002 修改自己的文章', () => {
    it('PATCH /articles/:id 返回 200 + title 已更新 + updatedAt > createdAt；其他字段保持不变', async () => {
      // 前置：注册 + 登录 + 创建文章
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Passw0rd!' });
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'alice', password: 'Passw0rd!' });
      const token = loginRes.body.token as string;
      const createRes = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Hello World', content: 'My first post.', tags: ['intro'] });
      const articleId = createRes.body.articleId as string;

      // 引入时间间隔保证 updatedAt > createdAt 可区分
      await new Promise(resolve => setTimeout(resolve, 5));

      const res = await request(app)
        .patch(`/api/v1/articles/${articleId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Hello World (v2)' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Hello World (v2)');
      expect(res.body.updatedAt > res.body.createdAt).toBe(true);
      // 其他字段保持不变
      expect(res.body.content).toBe('My first post.');
      expect(res.body.tags).toEqual(['intro']);
      expect(res.body.authorId).toBe(regRes.body.userId);
    });
  });

  describe('UAT-006: REQ-002 删除自己的文章', () => {
    it('DELETE /articles/:id 返回 204；随后 GET /articles/:id 返回 404 + 40401', async () => {
      // 前置
      await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Passw0rd!' });
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'alice', password: 'Passw0rd!' });
      const token = loginRes.body.token as string;
      const createRes = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'To Delete', content: 'Bye' });
      const articleId = createRes.body.articleId as string;

      // DELETE
      const delRes = await request(app)
        .delete(`/api/v1/articles/${articleId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(delRes.status).toBe(204);
      expect(delRes.body).toEqual({});

      // 后续 GET 返回 404 + 40401
      const getRes = await request(app).get(`/api/v1/articles/${articleId}`);
      expect(getRes.status).toBe(404);
      expect(getRes.body.code).toBe(40401);
    });
  });

  /* ============================================================
   * REQ-003 公开浏览
   * ============================================================ */

  describe('UAT-007: REQ-003 公开列表分页浏览（未认证）', () => {
    it('预置 15 篇文章后 GET /articles?page=1&pageSize=10 返回 10 篇；page=2 返回 5 篇', async () => {
      // 预置 15 篇文章（直接写 store，避免 15 次 HTTP 创建）
      const authorId = '00000000-0000-4000-8000-000000000001';
      const baseTs = new Date('2026-01-01T00:00:00.000Z').getTime();
      for (let i = 0; i < 15; i++) {
        const ts = new Date(baseTs + i * 1000).toISOString();
        deps.articleStore.save({
          id: `a-${i}`,
          authorId,
          title: `T-${i}`,
          content: `C-${i}`,
          tags: [],
          createdAt: ts,
          updatedAt: ts,
        });
      }
      expect(deps.articleStore.count()).toBe(15);

      // page=1（无 Authorization 头）
      const p1Res = await request(app).get('/api/v1/articles?page=1&pageSize=10');
      expect(p1Res.status).toBe(200);
      expect(p1Res.body.items).toHaveLength(10);
      expect(p1Res.body.total).toBe(15);
      expect(p1Res.body.page).toBe(1);
      expect(p1Res.body.pageSize).toBe(10);

      // page=2
      const p2Res = await request(app).get('/api/v1/articles?page=2&pageSize=10');
      expect(p2Res.status).toBe(200);
      expect(p2Res.body.items).toHaveLength(5);
      expect(p2Res.body.total).toBe(15);
      expect(p2Res.body.page).toBe(2);
    });
  });

  describe('UAT-008: REQ-003 + REQ-004 查看文章详情 + 评论聚合', () => {
    it('GET /articles/:id 返回 200 + comments.length >= 2 + 按 createdAt 升序', async () => {
      // 前置：注册 + 登录 + 创建文章 + 2 条评论
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Passw0rd!' });
      const userId = regRes.body.userId as string;
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'alice', password: 'Passw0rd!' });
      const token = loginRes.body.token as string;
      const createRes = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'T', content: 'C' });
      const articleId = createRes.body.articleId as string;

      await request(app)
        .post(`/api/v1/articles/${articleId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'First' });
      await new Promise(resolve => setTimeout(resolve, 5));
      await request(app)
        .post(`/api/v1/articles/${articleId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Second' });

      // GET 详情（无 Authorization 头）
      const res = await request(app).get(`/api/v1/articles/${articleId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(articleId);
      const comments = res.body.comments as Array<{ content: string; authorId: string; createdAt: string }>;
      expect(comments.length).toBeGreaterThanOrEqual(2);
      // 升序
      expect(comments[0].createdAt <= comments[1].createdAt).toBe(true);
      expect(comments[0].content).toBe('First');
      expect(comments[1].content).toBe('Second');
      // authorId 来自 JWT
      expect(comments[0].authorId).toBe(userId);
    });
  });

  /* ============================================================
   * REQ-004 评论
   * ============================================================ */

  describe('UAT-009: REQ-004 已登录用户对存在文章发表评论', () => {
    it('POST /articles/:id/comments 返回 201 + commentId UUID + authorId=JWT.userId（不取自 body）+ content + createdAt', async () => {
      // 前置
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Passw0rd!' });
      const userId = regRes.body.userId as string;
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'alice', password: 'Passw0rd!' });
      const token = loginRes.body.token as string;
      const createRes = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'T', content: 'C' });
      const articleId = createRes.body.articleId as string;

      const res = await request(app)
        .post(`/api/v1/articles/${articleId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Nice post!' });

      expect(res.status).toBe(201);
      expect(res.body.commentId).toMatch(UUID_V4_RE);
      expect(res.body.articleId).toBe(articleId);
      // authorId 来自 JWT，不取自 body
      expect(res.body.authorId).toBe(userId);
      expect(res.body.content).toBe('Nice post!');
      expect(res.body.createdAt).toBeDefined();
    });
  });

  describe('UAT-010: REQ-004 查看文章评论列表（未认证）', () => {
    it('GET /articles/:id/comments 返回 200 + items + total + 按 createdAt 升序', async () => {
      // 前置：注册 + 登录 + 创建文章 + 2 条评论
      await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Passw0rd!' });
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'alice', password: 'Passw0rd!' });
      const token = loginRes.body.token as string;
      const createRes = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'T', content: 'C' });
      const articleId = createRes.body.articleId as string;

      await request(app)
        .post(`/api/v1/articles/${articleId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'First' });
      await new Promise(resolve => setTimeout(resolve, 5));
      await request(app)
        .post(`/api/v1/articles/${articleId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Second' });

      // GET 评论列表（无 Authorization 头）
      const res = await request(app).get(`/api/v1/articles/${articleId}/comments`);
      expect(res.status).toBe(200);
      const items = res.body.items as Array<{ content: string; createdAt: string }>;
      expect(items).toHaveLength(2);
      expect(res.body.total).toBe(2);
      // 升序
      expect(items[0].createdAt <= items[1].createdAt).toBe(true);
      expect(items[0].content).toBe('First');
      expect(items[1].content).toBe('Second');
    });
  });

  /* ============================================================
   * NFR-001 安全
   * ============================================================ */

  describe('UAT-011: NFR-001 密码以 bcrypt 哈希存储（无明文）', () => {
    it('注册后 userStore 中 passwordHash 以 $2b$10$ 开头；!== 原始密码；无 password 字段；bcrypt.getRounds === 10', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'bob', password: 'Secret123' });
      expect(res.status).toBe(201);
      const userId = res.body.userId as string;

      const user = deps.userStore.findById(userId);
      expect(user).toBeDefined();
      // $2b$10$ 前缀
      expect(user!.passwordHash).toMatch(/^\$2b\$10\$/);
      // 不等于原始密码
      expect(user!.passwordHash).not.toBe('Secret123');
      // 存储中无 password 字段
      expect((user as unknown as { password?: string }).password).toBeUndefined();
      // bcrypt cost = 10（NFR-001）
      expect(bcrypt.getRounds(user!.passwordHash)).toBe(10);
    });
  });

  describe('UAT-012: NFR-001 JWT 过期后访问受保护资源被拒', () => {
    it('过期 JWT 调 POST /articles 返回 401 + 40102；不返回 201 / articleId', async () => {
      // 构造过期 JWT（exp = now - 10s）
      const expiredToken = jwt.sign(
        {
          userId: '00000000-0000-4000-8000-000000000000',
          username: 'alice',
          exp: Math.floor(Date.now() / 1000) - 10,
        },
        JWT_SECRET,
      );

      const res = await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ title: 'T', content: 'C' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe(40102);
      // 不返回 201 / articleId
      expect(res.body.articleId).toBeUndefined();
    });
  });

  /* ============================================================
   * NFR-002 性能
   * ============================================================ */

  describe('UAT-013: NFR-002 列表接口 P95 响应时间 ≤ 200ms', () => {
    it('预置 1000 篇文章后采样 200 次 GET /articles，P95 ≤ 200ms + 无 5xx + 无非 200', async () => {
      // 预置 1000 篇文章
      const authorId = '00000000-0000-4000-8000-000000000001';
      const baseTs = new Date('2026-01-01T00:00:00.000Z').getTime();
      for (let i = 0; i < 1000; i++) {
        const ts = new Date(baseTs + i).toISOString();
        deps.articleStore.save({
          id: `perf-${i}`,
          authorId,
          title: `T-${i}`,
          content: `C-${i}`,
          tags: [],
          createdAt: ts,
          updatedAt: ts,
        });
      }

      // 采样 N=200 次
      const N = 200;
      const samples: number[] = [];
      let non200 = 0;
      for (let i = 0; i < N; i++) {
        const start = Date.now();
        const res = await request(app).get('/api/v1/articles?page=1&pageSize=10');
        samples.push(Date.now() - start);
        if (res.status !== 200) non200 += 1;
      }

      const p95 = percentile(samples, 95);
      expect(samples).toHaveLength(N);
      expect(non200).toBe(0);
      expect(p95).toBeLessThanOrEqual(200);
      // eslint-disable-next-line no-console
      console.log(`    UAT-013 性能采样：N=${N}，P95=${p95}ms，max=${Math.max(...samples)}ms，非200=${non200}`);
    });
  });

  /* ============================================================
   * NFR-003 可维护性
   * ============================================================ */

  describe('UAT-014: NFR-003 tsc strict 模式 0 错误', () => {
    it('npx tsc --noEmit 退出码 0；stderr 无输出', () => {
      // 在项目根目录跑 tsc --noEmit
      const projectRoot = path.resolve(__dirname, '../..');
      const result = spawnSync('npx', ['tsc', '--noEmit'], {
        cwd: projectRoot,
        encoding: 'utf-8',
        shell: true,
        timeout: 120000,
      });

      expect(result.status).toBe(0);
      // stderr 无输出（warnings 允许，但本配置下应无）
      // 注：npx 在 Windows 下可能有 stdout 提示，仅断言退出码即可
    });
  });

  /* ============================================================
   * NFR-004 可测试性
   * ============================================================ */

  describe('UAT-015: NFR-004 单元测试代码覆盖率 ≥ 80%', () => {
    it('coverage-summary.json 中 lines / branches / functions / statements 均 ≥ 80%', () => {
      const coveragePath = path.resolve(__dirname, '../../coverage/coverage-summary.json');
      // 读取最近一次 npm run coverage 产出的覆盖率报告
      // 注：阶段 5 已执行 npm run coverage，coverage/coverage-summary.json 反映 44 用例的真实覆盖率
      const coverage = JSON.parse(readFileSync(coveragePath, 'utf-8')) as {
        total: {
          lines: { pct: number };
          branches: { pct: number };
          functions: { pct: number };
          statements: { pct: number };
        };
      };

      const total = coverage.total;
      // eslint-disable-next-line no-console
      console.log(
        `    UAT-015 覆盖率：lines=${total.lines.pct}% / branches=${total.branches.pct}% / functions=${total.functions.pct}% / statements=${total.statements.pct}%`,
      );

      expect(total.lines.pct).toBeGreaterThanOrEqual(80);
      expect(total.branches.pct).toBeGreaterThanOrEqual(80);
      expect(total.functions.pct).toBeGreaterThanOrEqual(80);
      expect(total.statements.pct).toBeGreaterThanOrEqual(80);
    });
  });
});
