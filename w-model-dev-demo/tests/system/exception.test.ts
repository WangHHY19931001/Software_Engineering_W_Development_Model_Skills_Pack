/**
 * 系统测试 - 异常路径测试（6 用例）
 * 对应 docs/system-test-design.md §8：TC-EXC-001 ~ TC-EXC-006
 *
 * 测试方法：
 * - TC-EXC-001: 不存在资源 → 404 NOT_FOUND_ERROR
 * - TC-EXC-002: 非法状态转移 → 400 VALIDATION_ERROR（NoInvalidTransition 不变式）
 * - TC-EXC-003: 重复注册 → 409 CONFLICT_ERROR
 * - TC-EXC-004: 过期 JWT → 401 AUTHENTICATION_ERROR
 * - TC-EXC-005: 密码重置令牌复用 → 400（OneTimeUse 不变式）
 * - TC-EXC-006: 分类树成环 → 409 CONFLICT_ERROR（NoCycle 不变式）
 *
 * 说明：设计文档中的 code（EMAIL_EXISTS/TOKEN_EXPIRED/TOKEN_USED/CATEGORY_CYCLE_DETECTED）
 * 在实现中统一归为通用错误码（CONFLICT_ERROR/AUTHENTICATION_ERROR/VALIDATION_ERROR），
 * 本测试验证实际实现行为（HTTP 状态码 + 错误码 + 不变式消息）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import {
  createTestContext,
  registerAndLogin,
  createPublishedArticle,
  type TestContext,
} from './helpers.js';

const TEST_JWT_SECRET = 'test-secret-blog-demo-32chars-min!!';

describe('异常路径测试（6 用例）', () => {
  let ctx: TestContext;
  let app: Express;

  beforeEach(() => {
    ctx = createTestContext();
    app = ctx.app;
  });

  // ==================== TC-EXC-001 不存在的资源 ====================
  it('TC-EXC-001: 不存在的文章/评论返回 404 NOT_FOUND_ERROR', async () => {
    // 不存在的文章
    const r1 = await request(app).get('/api/articles/non-existent-id-12345');
    expect(r1.status).toBe(404);
    expect(r1.body.error.code).toBe('NOT_FOUND_ERROR');
    expect(r1.body.error.message).toContain('文章');

    // 不存在文章的评论列表
    const r2 = await request(app).get('/api/articles/non-existent-id-12345/comments');
    expect(r2.status).toBe(404);
    expect(r2.body.error.code).toBe('NOT_FOUND_ERROR');
  });

  // ==================== TC-EXC-002 非法状态转移 ====================
  it('TC-EXC-002: 非法状态转移返回 400（已发布再 publish / 草稿 unpublish）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');

    // 已发布文章再 publish → 非法（published 没有 publish 转移）
    const publishedId = await createPublishedArticle(app, author.token, 'Published', 'Body');
    const r1 = await request(app)
      .post(`/api/articles/${publishedId}/workflow`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ action: 'publish' });
    expect(r1.status).toBe(400);
    expect(r1.body.error.code).toBe('VALIDATION_ERROR');
    expect(r1.body.error.message).toContain('非法状态转移');

    // 草稿 unpublish → 非法（draft 没有 unpublish 转移）
    const draftRes = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ title: 'Draft', content: 'Body', tagIds: [], categoryId: null, status: 'draft' });
    expect(draftRes.status).toBe(201);
    const draftId = draftRes.body.id;

    const r2 = await request(app)
      .post(`/api/articles/${draftId}/workflow`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ action: 'unpublish' });
    expect(r2.status).toBe(400);
    expect(r2.body.error.code).toBe('VALIDATION_ERROR');
    expect(r2.body.error.message).toContain('非法状态转移');
  });

  // ==================== TC-EXC-003 重复注册 ====================
  it('TC-EXC-003: 同一邮箱重复注册返回 409 CONFLICT_ERROR', async () => {
    const email = 'duplicate@b.com';
    const r1 = await request(app)
      .post('/api/users/register')
      .send({ email, password: 'pass1234', role: 'reader' });
    expect(r1.status).toBe(201);

    const r2 = await request(app)
      .post('/api/users/register')
      .send({ email, password: 'pass1234', role: 'reader' });
    expect(r2.status).toBe(409);
    expect(r2.body.error.code).toBe('CONFLICT_ERROR');
    expect(r2.body.error.message).toContain('邮箱');
  });

  // ==================== TC-EXC-004 令牌过期 ====================
  it('TC-EXC-004: 过期 JWT 访问受保护接口返回 401 AUTHENTICATION_ERROR', async () => {
    // 签发一个 1ms 后过期的 token
    const expiredToken = jwt.sign(
      { sub: 'fake-user-id', email: 'expired@b.com', role: 'reader' },
      TEST_JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1ms' },
    );
    // 等待 token 过期
    await new Promise((resolve) => setTimeout(resolve, 50));

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
    expect(res.body.error.message).toContain('过期');
  });

  // ==================== TC-EXC-005 密码重置令牌复用 ====================
  it('TC-EXC-005: 已使用的密码重置令牌再次重置返回 400（OneTimeUse 不变式）', async () => {
    const email = 'token-reuse@b.com';
    const regRes = await request(app)
      .post('/api/users/register')
      .send({ email, password: 'old-pass-123', role: 'reader' });
    expect(regRes.status).toBe(201);

    // 请求重置（通过 service 获取 token）
    const resetResult = ctx.services.passwordReset.requestReset(email);
    const token = resetResult.token;

    // 第一次使用 → 成功
    const r1 = await request(app)
      .post('/api/users/password-reset')
      .send({ token, newPassword: 'new-pass-456' });
    expect(r1.status).toBe(200);
    expect(r1.body.userId).toBe(regRes.body.id);

    // 第二次复用 → 失败（OneTimeUse 不变式）
    const r2 = await request(app)
      .post('/api/users/password-reset')
      .send({ token, newPassword: 'another-pass-789' });
    expect(r2.status).toBe(400);
    expect(r2.body.error.code).toBe('VALIDATION_ERROR');
    expect(r2.body.error.message).toContain('已使用');

    // 验证新密码可登录（第一次重置生效）
    const loginRes = await request(app)
      .post('/api/users/login')
      .send({ email, password: 'new-pass-456' });
    expect(loginRes.status).toBe(200);
  });

  // ==================== TC-EXC-006 分类树成环检测 ====================
  it('TC-EXC-006: 分类 A→B→C→A 形成环返回 409（NoCycle 不变式）', async () => {
    const admin = await registerAndLogin(app, 'admin@b.com', 'admin');

    // 创建 A（无父）
    const aRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'A', parentCategoryId: null });
    expect(aRes.status).toBe(201);
    const aId = aRes.body.id;

    // 创建 B（父=A）
    const bRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'B', parentCategoryId: aId });
    expect(bRes.status).toBe(201);
    const bId = bRes.body.id;

    // 创建 C（父=B）
    const cRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'C', parentCategoryId: bId });
    expect(cRes.status).toBe(201);
    const cId = cRes.body.id;

    // 尝试将 A 的父设为 C → 形成环 A→C→B→A，应被拒绝
    const r = await request(app)
      .put(`/api/categories/${aId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ parentCategoryId: cId });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('CONFLICT_ERROR');
    expect(r.body.error.message).toContain('循环');

    // 验证 A 的父分类未被修改（仍为 null）
    const listRes = await request(app).get('/api/categories');
    expect(listRes.status).toBe(200);
    const catA = listRes.body.find((c: { id: string }) => c.id === aId);
    expect(catA).toBeDefined();
    expect(catA.parentCategoryId).toBeNull();
  });
});
