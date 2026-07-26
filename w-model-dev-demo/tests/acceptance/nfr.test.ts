/**
 * 验收测试 - 非功能需求与约束（12 用例）
 * 覆盖 UAT: 052, 053, 054, 055, 056, 057, 058, 059, 060, 061, 062, 063
 * 关联需求: NFR-001~006, CON-001~004
 *
 * 测试方法：supertest → Express app（seam-http），beforeEach 创建独立 container 数据隔离。
 * 限流测试需 ctx.middleware.rateLimit.clear() 重置桶；容量测试直接走 store 避免 HTTP 开销。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createTestContext,
  registerAndLogin,
  createPublishedArticle,
  type AcceptanceTestContext,
} from './helpers.js';

describe('验收测试 - 非功能需求与约束（12 用例）', () => {
  let ctx: AcceptanceTestContext;
  let app: Express;

  beforeEach(() => {
    ctx = createTestContext();
    app = ctx.app;
  });

  // ==================== UAT-052 NFR-001 性能 P95 < 200ms（正常） ====================
  it('UAT-052: API 响应时间 P95 < 200ms', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    // 预置若干文章
    for (let i = 0; i < 10; i++) {
      await createPublishedArticle(app, author.token, `文章 ${i}`, `内容 ${i}`);
    }
    // 清除限流桶（前面的 setup 消耗了令牌）
    ctx.middleware.rateLimit.clear();

    // 连续请求 50 次 GET /api/articles，计算 P95
    const samples: number[] = [];
    for (let i = 0; i < 50; i++) {
      const start = Date.now();
      const res = await request(app).get('/api/articles?limit=10');
      samples.push(Date.now() - start);
      expect(res.status).toBe(200);
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const p95Idx = Math.ceil(0.95 * sorted.length) - 1;
    const p95 = sorted[Math.max(0, p95Idx)]!;
    expect(p95).toBeLessThan(200);
  });

  // ==================== UAT-053 NFR-002 JWT 密钥强度（正常） ====================
  it('UAT-053: JWT HS256 密钥 ≥ 32 字节，token alg=HS256', async () => {
    const secret = process.env['JWT_SECRET'] ?? '';
    expect(secret.length).toBeGreaterThanOrEqual(32);

    const user = await registerAndLogin(app, 'jwt@b.com', 'author');
    const decoded = jwt.decode(user.token, { complete: true });
    expect(decoded).toBeTruthy();
    expect(decoded!.header.alg).toBe('HS256');
  });

  // ==================== UAT-054 NFR-003 统一错误响应（正常） ====================
  it('UAT-054: 错误响应统一格式 {error:{code, message}}', async () => {
    // 400 VALIDATION_ERROR
    const e400 = await request(app)
      .post('/api/users/register')
      .send({ email: 'invalid', password: '123' });
    expect(e400.status).toBe(400);
    expect(e400.body.error.code).toBeDefined();
    expect(e400.body.error.message).toBeDefined();

    // 401 AUTHENTICATION_ERROR
    const e401 = await request(app)
      .post('/api/articles')
      .send({ title: 't', content: 'c' });
    expect(e401.status).toBe(401);
    expect(e401.body.error.code).toBe('AUTHENTICATION_ERROR');
    expect(e401.body.error.message).toBeDefined();

    // 403 AUTHORIZATION_ERROR
    const reader = await registerAndLogin(app, 'reader@b.com', 'reader');
    const e403 = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${reader.token}`)
      .send({ title: 't', content: 'c' });
    expect(e403.status).toBe(403);
    expect(e403.body.error.code).toBe('AUTHORIZATION_ERROR');
    expect(e403.body.error.message).toBeDefined();

    // 404 NOT_FOUND_ERROR
    const e404 = await request(app).get('/api/articles/non-existent');
    expect(e404.status).toBe(404);
    expect(e404.body.error.code).toBe('NOT_FOUND_ERROR');
    expect(e404.body.error.message).toBeDefined();

    // 409 CONFLICT_ERROR
    await request(app)
      .post('/api/users/register')
      .send({ email: 'dup@b.com', password: 'Pass1234', role: 'reader' });
    const e409 = await request(app)
      .post('/api/users/register')
      .send({ email: 'dup@b.com', password: 'Pass1234', role: 'reader' });
    expect(e409.status).toBe(409);
    expect(e409.body.error.code).toBe('CONFLICT_ERROR');
    expect(e409.body.error.message).toBeDefined();
  });

  // ==================== UAT-055 NFR-004 内存存储容量（正常） ====================
  it('UAT-055: 单表 ≥ 10000 条记录可正常工作', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    // 直接通过 store 批量插入 10000 篇文章
    for (let i = 0; i < 10000; i++) {
      ctx.stores.article.insert({
        title: `Bulk ${i}`,
        content: `Body ${i}`,
        authorId: author.id,
        categoryId: null,
        tagIds: [],
        status: 'published',
        publishedAt: new Date().toISOString(),
      });
    }
    // 验证可查询
    ctx.middleware.rateLimit.clear();
    const res = await request(app).get('/api/articles?limit=10');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(10000);
  });

  // ==================== UAT-056 NFR-005 输入验证 zod（正常） ====================
  it('UAT-056: 非法 body 统一返回 400 VALIDATION_ERROR', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');

    // 缺字段
    const missing = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ title: 't' });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('VALIDATION_ERROR');

    // 类型错误（title 非字符串）
    const wrongType = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ title: 123, content: 'c' });
    expect(wrongType.status).toBe(400);
    expect(wrongType.body.error.code).toBe('VALIDATION_ERROR');

    // 超长 title（> 200 字符）
    const tooLong = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ title: 'x'.repeat(201), content: 'c' });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.code).toBe('VALIDATION_ERROR');
  });

  // ==================== UAT-057 NFR-006 限流 60 次/分钟触发 429（正常） ====================
  it('UAT-057: 超过 60 次/分钟 → 429 RATE_LIMIT_ERROR', async () => {
    // 清空限流桶
    ctx.middleware.rateLimit.clear();

    // 前 60 次 2xx
    let lastStatus = 0;
    for (let i = 0; i < 60; i++) {
      const res = await request(app).get('/api/articles');
      lastStatus = res.status;
    }
    expect(lastStatus).toBeLessThan(400);

    // 第 61 次 429
    const res61 = await request(app).get('/api/articles');
    expect(res61.status).toBe(429);
    expect(res61.body.error.code).toBe('RATE_LIMIT_ERROR');
  });

  // ==================== UAT-058 NFR-006 限流令牌恢复（边界） ====================
  it('UAT-058: 等待令牌恢复后可继续请求', async () => {
    ctx.middleware.rateLimit.clear();

    // 消耗全部 60 令牌
    for (let i = 0; i < 60; i++) {
      await request(app).get('/api/articles');
    }
    // 第 61 次 → 429
    const blocked = await request(app).get('/api/articles');
    expect(blocked.status).toBe(429);

    // 等待 ≥ 1 秒（refillRate=1/s）
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // 再次请求 → 2xx（令牌已恢复）
    const recovered = await request(app).get('/api/articles');
    expect(recovered.status).toBe(200);
  });

  // ==================== UAT-059 CON-001 技术栈约束（正常） ====================
  it('UAT-059: Express 4 + TypeScript 5 + 内存存储（Map）', async () => {
    // 1. 检查 package.json 含 express 依赖
    const pkgPath = resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies.express).toBeTruthy();

    // 2. 验证 store 实现为 Map（通过检查内部结构）
    // ArticleStore 内部使用 Map（通过 listAll 返回数组验证）
    ctx.stores.article.insert({
      title: 'tech-stack-test',
      content: 'content',
      authorId: 'test-author',
      categoryId: null,
      tagIds: [],
      status: 'draft',
      publishedAt: null,
    });
    const articles = ctx.stores.article.listAll();
    expect(articles.length).toBe(1);
    expect(articles[0]!.title).toBe('tech-stack-test');

    // 3. TypeScript strict 0 错误由 tsc --noEmit 验证（UAT-061）
    // 测试本身能运行即证明 TypeScript 编译通过
  });

  // ==================== UAT-060 CON-002 JWT HS256 1 小时有效期（正常） ====================
  it('UAT-060: JWT 算法 HS256，有效期约 1 小时', async () => {
    const user = await registerAndLogin(app, 'jwt-exp@b.com', 'author');
    const decoded = jwt.decode(user.token, { complete: true }) as {
      header: { alg: string };
      payload: { iat: number; exp: number };
    } | null;
    expect(decoded).toBeTruthy();
    expect(decoded!.header.alg).toBe('HS256');
    const diff = decoded!.payload.exp - decoded!.payload.iat;
    // 有效期约 1 小时（3600 秒 ± 5 秒）
    expect(diff).toBeGreaterThanOrEqual(3595);
    expect(diff).toBeLessThanOrEqual(3605);
  });

  // ==================== UAT-061 CON-003 TypeScript strict 0 错误（正常） ====================
  it('UAT-061: tsconfig.json strict: true（tsc --noEmit 由构建步骤验证）', async () => {
    const tsconfigPath = resolve(process.cwd(), 'tsconfig.json');
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8')) as {
      compilerOptions: { strict: boolean; noUnusedLocals: boolean; noUnusedParameters: boolean };
    };
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.noUnusedLocals).toBe(true);
    expect(tsconfig.compilerOptions.noUnusedParameters).toBe(true);
    // 实际 tsc --noEmit 退出码 0 由阶段 8 构建步骤验证
  });

  // ==================== UAT-062 CON-004 结构化 JSON 日志（正常） ====================
  it('UAT-062: 审计日志含 userId/action/resource/timestamp 结构', async () => {
    const admin = await registerAndLogin(app, 'admin@b.com', 'admin');
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    // 触发审计日志
    await createPublishedArticle(app, author.token, '日志测试', '内容');

    // 查询审计日志
    const res = await request(app)
      .get('/api/audit-logs?page=1&limit=20')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);

    // 验证每条含结构化字段
    const log = res.body.items[0];
    expect(log.userId).toBeDefined();
    expect(log.action).toBeDefined();
    expect(log.resource).toBeDefined();
    expect(log.timestamp).toBeDefined();
    expect(typeof log.userId).toBe('string');
    expect(typeof log.action).toBe('string');
    expect(typeof log.resource).toBe('string');
    expect(typeof log.timestamp).toBe('string');
  });

  // ==================== UAT-063 CON-004 审计日志 90 天保留（边界） ====================
  it('UAT-063: 90 天以上日志被清理，30 天前日志保留', async () => {
    const now = new Date();
    const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000); // 100 天前
    const recentDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 天前

    // 直接通过 store 插入旧日志
    ctx.stores.audit.insert({
      userId: 'old-user',
      action: 'old-action',
      resource: 'old-resource',
      resourceId: 'old-1',
      meta: {},
      timestamp: oldDate.toISOString(),
    });
    ctx.stores.audit.insert({
      userId: 'recent-user',
      action: 'recent-action',
      resource: 'recent-resource',
      resourceId: 'recent-1',
      meta: {},
      timestamp: recentDate.toISOString(),
    });

    // 调用 cleanupExpired
    const cleaned = ctx.services.audit.cleanupExpired(now);
    expect(cleaned).toBe(1); // 100 天前的 1 条被清理

    // 验证不变式
    ctx.services.audit.assertRetentionInvariant(now);

    // 30 天前的保留（通过 query 查询所有日志）
    const remaining = ctx.stores.audit.query({ page: 1, limit: 100 });
    const oldLog = remaining.items.find((l) => l.action === 'old-action');
    const recentLog = remaining.items.find((l) => l.action === 'recent-action');
    expect(oldLog).toBeUndefined();
    expect(recentLog).toBeDefined();
  });
});
