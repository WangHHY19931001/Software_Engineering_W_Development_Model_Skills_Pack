import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app, deps } from '../../src/app.js';

/**
 * 集成测试（IT-001 ~ IT-006）。
 *
 * 设计来源：docs/outline-design.md §4 集成测试用例设计。
 * 执行阶段：W 模型阶段 6。
 *
 * 原则：
 * - 使用 supertest 调真实 Express app（不 mock 控制器 / 服务 / 存储）。
 * - 每个用例 beforeEach 通过 `POST /__test/reset` 重置 3 个内存 Store。
 * - 通过 `deps` 单例引用直接断言存储状态（passwordHash / 级联删除 / 数据未写入）。
 * - 覆盖 TC-DES-010（参数校验）/ TC-DES-011（跨模块调用）/ TC-DES-012（异常路径）三类强制场景。
 */

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 注册 alice 并返回 { userId, username }。
 */
async function registerAlice(password = 'Passw0rd!'): Promise<{ userId: string; username: string }> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ username: 'alice', password });
  expect(res.status).toBe(201);
  return res.body as { userId: string; username: string };
}

/**
 * 登录 alice 并返回 JWT token。
 */
async function loginAlice(password = 'Passw0rd!'): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ username: 'alice', password });
  expect(res.status).toBe(200);
  return (res.body as { token: string }).token;
}

/**
 * 注册 + 登录 alice，返回 { userId, token }。
 */
async function registerAndLoginAlice(
  password = 'Passw0rd!',
): Promise<{ userId: string; token: string }> {
  const { userId } = await registerAlice(password);
  const token = await loginAlice(password);
  return { userId, token };
}

/**
 * 创建文章，返回 { articleId, body }。
 */
async function createArticle(
  token: string,
  body: { title: string; content: string; tags?: string[] },
): Promise<{ articleId: string; body: Record<string, unknown> }> {
  const res = await request(app).post('/api/v1/articles').set('Authorization', `Bearer ${token}`).send(body);
  expect(res.status).toBe(201);
  return { articleId: (res.body as { articleId: string }).articleId, body: res.body as Record<string, unknown> };
}

describe('集成测试 IT-001 ~ IT-006', () => {
  beforeEach(async () => {
    // 重置 3 个内存 Store，保证每个用例干净起点（RISK-001 缓解措施）
    const res = await request(app).post('/__test/reset');
    expect(res.status).toBe(204);
  });

  describe('IT-001: 接口 1 合法参数注册成功 + 重复注册返回 40901', () => {
    it('第 1 次注册 alice 返回 201 + UUID + username；存储中 passwordHash 以 $2b$10$ 开头', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Passw0rd!' });

      expect(res.status).toBe(201);
      expect(res.body.userId).toMatch(UUID_V4_RE);
      expect(res.body.username).toBe('alice');
      // 响应不含 password 字段
      expect(res.body.password).toBeUndefined();
      expect(res.body.passwordHash).toBeUndefined();

      // 存储校验：passwordHash 以 $2b$10$ 开头
      const user = deps.userStore.findByUsername('alice');
      expect(user).toBeDefined();
      expect(user!.passwordHash).toMatch(/^\$2b\$10\$/);
      expect(user!.passwordHash).not.toBe('Passw0rd!');
    });

    it('第 2 次注册同用户名返回 409 + code 40901', async () => {
      await registerAlice();

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'Passw0rd!' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(40901);
      expect(res.body.message).toContain('已注册');
    });
  });

  describe('IT-002: 接口 1 非法参数（5 类）全部 400 + 不写入存储', () => {
    it('1) 用户名过短 "ab" → 400 + 40001', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'ab', password: 'Passw0rd!' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(40001);
    });

    it('2) 密码 < 8 "Ab1" → 400 + 40001', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'bob', password: 'Ab1' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(40001);
    });

    it('3) 密码无数字 "Password" → 400 + 40001', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'bob', password: 'Password' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(40001);
    });

    it('4) 密码无字母 "12345678" → 400 + 40001', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'bob', password: '12345678' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(40001);
    });

    it('5) 缺 password 字段 → 400 + 40001', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'bob' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(40001);
    });

    it('全部 5 类非法输入后 bob 未写入存储', async () => {
      // 依次跑完 5 类非法输入
      const invalidBodies = [
        { username: 'ab', password: 'Passw0rd!' },
        { username: 'bob', password: 'Ab1' },
        { username: 'bob', password: 'Password' },
        { username: 'bob', password: '12345678' },
        { username: 'bob' },
      ];
      for (const body of invalidBodies) {
        await request(app).post('/api/v1/auth/register').send(body);
      }
      // 关键断言：bob 不在存储中
      expect(deps.userStore.findByUsername('bob')).toBeUndefined();
    });
  });

  describe('IT-003: 接口 2 + 3 登录后跨模块创建文章（认证传递）', () => {
    it('登录返回 200 + token；payload.userId 与注册一致；创建文章 authorId === payload.userId', async () => {
      const { userId: registeredUserId } = await registerAlice();
      const token = await loginAlice();

      // 解码 JWT（不验签，仅看 payload）校验 payload.userId
      const decoded = jwt.decode(token) as { userId: string; username: string; iat: number; exp: number };
      expect(decoded.userId).toBe(registeredUserId);
      expect(decoded.username).toBe('alice');

      // 跨模块创建文章（auth → article）
      const { body } = await createArticle(token, { title: 'T1', content: 'C1' });

      // authorId 来自 JWT 而非 body
      expect(body.authorId).toBe(decoded.userId);
      expect(body.authorId).toBe(registeredUserId);

      // 存储校验：articleStore 中确实存在且 authorId 一致
      const article = deps.articleStore.findById(body.articleId as string);
      expect(article).toBeDefined();
      expect(article!.authorId).toBe(registeredUserId);
    });
  });

  describe('IT-004: 接口 3 + 8 + 6 文章 → 评论 → 详情聚合数据传递', () => {
    it('创建文章 → 发表 2 条评论 → GET 详情聚合 comments.length === 2，按 createdAt 升序', async () => {
      const { token, userId } = await registerAndLoginAlice();
      const { articleId } = await createArticle(token, { title: 'T1', content: 'C1' });

      // 第 1 条评论
      const c1Res = await request(app)
        .post(`/api/v1/articles/${articleId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'First!' });
      expect(c1Res.status).toBe(201);
      expect(c1Res.body.commentId).toMatch(UUID_V4_RE);

      // 引入 ≥ 1ms 间隔，保证 createdAt 可区分（ISO8601 ms 精度）
      await new Promise(resolve => setTimeout(resolve, 5));

      // 第 2 条评论
      const c2Res = await request(app)
        .post(`/api/v1/articles/${articleId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Second!' });
      expect(c2Res.status).toBe(201);

      // GET 详情聚合
      const detailRes = await request(app).get(`/api/v1/articles/${articleId}`);
      expect(detailRes.status).toBe(200);
      const comments = detailRes.body.comments as Array<{ content: string; authorId: string; createdAt: string }>;
      expect(comments).toHaveLength(2);
      // 升序：First 在前
      expect(comments[0].content).toBe('First!');
      expect(comments[1].content).toBe('Second!');
      expect(comments[0].createdAt <= comments[1].createdAt).toBe(true);
      // authorId === alice.userId（来自 JWT）
      expect(comments[0].authorId).toBe(userId);
      expect(comments[1].authorId).toBe(userId);
    });
  });

  describe('IT-005: 接口 8 文章不存在异常路径 - 发表评论', () => {
    let unhandledRejectionCount: number;
    let uncaughtExceptionCount: number;
    const onUnhandledRejection = (): void => {
      unhandledRejectionCount += 1;
    };
    const onUncaughtException = (): void => {
      uncaughtExceptionCount += 1;
    };

    beforeEach(() => {
      unhandledRejectionCount = 0;
      uncaughtExceptionCount = 0;
      process.on('unhandledRejection', onUnhandledRejection);
      process.on('uncaughtException', onUncaughtException);
    });

    afterEach(() => {
      process.removeListener('unhandledRejection', onUnhandledRejection);
      process.removeListener('uncaughtException', onUncaughtException);
    });

    it('POST /articles/non-existent-uuid/comments 返回 404 + 40401；进程未崩溃', async () => {
      const { token } = await registerAndLoginAlice();
      const nonExistentId = '00000000-0000-4000-8000-000000000000';

      const res = await request(app)
        .post(`/api/v1/articles/${nonExistentId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Hi' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(40401);

      // 评论未写入存储
      expect(deps.commentStore.findByArticleId(nonExistentId)).toEqual([]);

      // 异常经 asyncHandler → errorHandler 链路捕获，进程未崩溃
      // 给事件循环一个 tick 让潜在 unhandledRejection 冒出来
      await new Promise(resolve => setImmediate(resolve));
      expect(unhandledRejectionCount).toBe(0);
      expect(uncaughtExceptionCount).toBe(0);
    });
  });

  describe('IT-006: 接口 5 + 6 + 9 删除文章后查询返回 404 异常路径', () => {
    it('删除文章 → GET 详情 404 → GET 评论列表 404；评论随文章级联删除', async () => {
      const { token } = await registerAndLoginAlice();
      const { articleId } = await createArticle(token, { title: 'X', content: 'X-content' });

      // 文章下加 2 条评论
      await request(app)
        .post(`/api/v1/articles/${articleId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'C1' });
      await new Promise(resolve => setTimeout(resolve, 5));
      await request(app)
        .post(`/api/v1/articles/${articleId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'C2' });

      // 前置校验：评论已写入
      expect(deps.commentStore.findByArticleId(articleId)).toHaveLength(2);

      // DELETE 文章
      const delRes = await request(app)
        .delete(`/api/v1/articles/${articleId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(delRes.status).toBe(204);

      // GET 详情 → 404 + 40401
      const getRes = await request(app).get(`/api/v1/articles/${articleId}`);
      expect(getRes.status).toBe(404);
      expect(getRes.body.code).toBe(40401);

      // GET 评论列表 → 404 + 40401
      const getCommentsRes = await request(app).get(`/api/v1/articles/${articleId}/comments`);
      expect(getCommentsRes.status).toBe(404);
      expect(getCommentsRes.body.code).toBe(40401);

      // 存储校验：文章已删；评论级联删除
      expect(deps.articleStore.findById(articleId)).toBeUndefined();
      expect(deps.commentStore.findByArticleId(articleId)).toEqual([]);
    });
  });
});
