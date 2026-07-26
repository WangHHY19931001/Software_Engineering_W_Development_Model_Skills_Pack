/**
 * 验收测试 - 身份与认证模块（15 用例）
 * 覆盖 UAT: 001, 002, 003, 004, 016, 021, 023, 024, 025, 026, 027, 039, 040, 049, 050
 * 关联需求: REQ-001~004, REQ-016, REQ-021
 *
 * 测试方法：supertest → Express app（seam-http），beforeEach 创建独立 container 数据隔离。
 * 实际 API 路径以 docs/uat-path-mapping.md 回填为准（设计路径与实际路径存在等价映射）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestContext,
  registerAndLogin,
  requestPasswordResetToken,
  type AcceptanceTestContext,
} from './helpers.js';

describe('验收测试 - 身份与认证模块（15 用例）', () => {
  let ctx: AcceptanceTestContext;
  let app: Express;

  beforeEach(() => {
    ctx = createTestContext();
    app = ctx.app;
  });

  // ==================== UAT-001 系统健康检查（REQ-001） ====================
  it('UAT-001: 系统健康检查 → GET /api/health 返回 200 {status:"ok"}', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  // ==================== UAT-023 未知路由 404（REQ-001 边界） ====================
  it('UAT-023: 未知路由 → 404 NOT_FOUND_ERROR', async () => {
    const res = await request(app).get('/api/non-existent-route');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND_ERROR');
  });

  // ==================== UAT-002 用户注册正常流程（REQ-002） ====================
  it('UAT-002: 用户注册 → 201 含 userId', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send({ email: 'test@example.com', password: 'Pass1234', role: 'reader' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.email).toBe('test@example.com');
    expect(res.body.role).toBe('reader');
  });

  // ==================== UAT-024 注册邮箱已存在（REQ-002 异常） ====================
  it('UAT-024: 重复注册同一邮箱 → 409 CONFLICT_ERROR', async () => {
    await request(app)
      .post('/api/users/register')
      .send({ email: 'test@example.com', password: 'Pass1234', role: 'reader' });
    const res = await request(app)
      .post('/api/users/register')
      .send({ email: 'test@example.com', password: 'Pass1234', role: 'reader' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT_ERROR');
  });

  // ==================== UAT-025 注册密码边界值（REQ-002 边界） ====================
  it('UAT-025: 密码长度边界（7 位拒绝 / 8 位通过）', async () => {
    const shortRes = await request(app)
      .post('/api/users/register')
      .send({ email: 'a@b.com', password: '1234567', role: 'reader' });
    expect(shortRes.status).toBe(400);
    expect(shortRes.body.error.code).toBe('VALIDATION_ERROR');

    const okRes = await request(app)
      .post('/api/users/register')
      .send({ email: 'b@b.com', password: '12345678', role: 'reader' });
    expect(okRes.status).toBe(201);
    expect(okRes.body.id).toBeTruthy();
  });

  // ==================== UAT-003 用户登录正常流程（REQ-003） ====================
  it('UAT-003: 用户登录 → 200 含 JWT token（三段式）', async () => {
    await request(app)
      .post('/api/users/register')
      .send({ email: 'test@example.com', password: 'Pass1234', role: 'reader' });
    const res = await request(app)
      .post('/api/users/login')
      .send({ email: 'test@example.com', password: 'Pass1234' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    const parts = (res.body.token as string).split('.');
    expect(parts.length).toBe(3);
    expect(res.body.user.email).toBe('test@example.com');
  });

  // ==================== UAT-026 登录密码错误（REQ-003 异常） ====================
  it('UAT-026: 密码错误登录 → 401 AUTHENTICATION_ERROR', async () => {
    await request(app)
      .post('/api/users/register')
      .send({ email: 'test@example.com', password: 'Pass1234', role: 'reader' });
    const res = await request(app)
      .post('/api/users/login')
      .send({ email: 'test@example.com', password: 'WrongPass' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
  });

  // ==================== UAT-004 角色权限校验（REQ-004） ====================
  it('UAT-004: 角色权限校验（reader 403 / author 201 / admin 可删除他人文章）', async () => {
    const reader = await registerAndLogin(app, 'reader@b.com', 'reader');
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const admin = await registerAndLogin(app, 'admin@b.com', 'admin');

    // reader 创建文章 → 403
    const readerRes = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${reader.token}`)
      .send({ title: 't', content: 'c', tagIds: [], categoryId: null });
    expect(readerRes.status).toBe(403);
    expect(readerRes.body.error.code).toBe('AUTHORIZATION_ERROR');

    // author 创建文章 → 201
    const authorRes = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ title: 't', content: 'c', tagIds: [], categoryId: null });
    expect(authorRes.status).toBe(201);
    const articleId = authorRes.body.id;

    // admin 删除他人文章 → 204
    const adminDelRes = await request(app)
      .delete(`/api/articles/${articleId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(adminDelRes.status).toBe(204);
  });

  // ==================== UAT-027 无 Token 访问受保护资源（REQ-004 异常） ====================
  it('UAT-027: 无 Authorization 头 → 401 AUTHENTICATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/articles')
      .send({ title: 't', content: 'c', tagIds: [], categoryId: null });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
  });

  // ==================== UAT-016 密码重置流程（REQ-016） ====================
  it('UAT-016: 密码重置全流程（请求→重置→新密码登录）', async () => {
    const email = 'reset@example.com';
    const oldPassword = 'OldPass1234';
    const newPassword = 'NewPass1234';

    // 1. 注册
    await request(app)
      .post('/api/users/register')
      .send({ email, password: oldPassword, role: 'reader' });

    // 2. 请求重置（HTTP 端点返回 message + expiresAt，token 通过 service 获取模拟邮件投递）
    const reqRes = await request(app)
      .post('/api/users/password-reset/request')
      .send({ email });
    expect(reqRes.status).toBe(200);
    expect(reqRes.body.message).toContain('重置');
    expect(reqRes.body.expiresAt).toBeTruthy();

    // 通过 service 获取 token（模拟邮件投递）
    const { token } = requestPasswordResetToken(ctx.services, email);
    expect(token).toBeTruthy();

    // 3. 使用 token 重置密码
    const resetRes = await request(app)
      .post('/api/users/password-reset')
      .send({ token, newPassword });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.userId).toBeTruthy();

    // 4. 新密码登录 → 200
    const newLoginRes = await request(app)
      .post('/api/users/login')
      .send({ email, password: newPassword });
    expect(newLoginRes.status).toBe(200);
    expect(newLoginRes.body.token).toBeTruthy();
  });

  // ==================== UAT-039 密码重置令牌无效（REQ-016 异常） ====================
  it('UAT-039: 无效令牌重置 → 404 NOT_FOUND_ERROR', async () => {
    const res = await request(app)
      .post('/api/users/password-reset')
      .send({ token: 'invalid-token', newPassword: 'NewPass1234' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND_ERROR');
  });

  // ==================== UAT-040 密码重置新密码不足 8 位（REQ-016 边界） ====================
  it('UAT-040: 新密码 < 8 位 → 400 VALIDATION_ERROR', async () => {
    const email = 'boundary@example.com';
    await request(app)
      .post('/api/users/register')
      .send({ email, password: 'OldPass1234', role: 'reader' });
    const { token } = requestPasswordResetToken(ctx.services, email);

    const res = await request(app)
      .post('/api/users/password-reset')
      .send({ token, newPassword: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // ==================== UAT-021 用户资料管理（REQ-021） ====================
  it('UAT-021: 更新与查询用户资料', async () => {
    const user = await registerAndLogin(app, 'profile@b.com', 'author');

    // PUT /api/users/profile 更新资料
    const updateRes = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ nickname: '张三', avatar: 'https://example.com/a.png', bio: '博主' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.nickname).toBe('张三');
    expect(updateRes.body.avatar).toBe('https://example.com/a.png');
    expect(updateRes.body.bio).toBe('博主');

    // GET /api/users/profile 查询资料
    const getRes = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${user.token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.nickname).toBe('张三');
  });

  // ==================== UAT-049 用户资料 nickname 超长（REQ-021 异常） ====================
  it('UAT-049: nickname > 50 字符 → 400 VALIDATION_ERROR', async () => {
    const user = await registerAndLogin(app, 'longnick@b.com', 'author');
    const longNickname = 'x'.repeat(51);
    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ nickname: longNickname });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // ==================== UAT-050 查询未设置资料的用户（REQ-021 边界） ====================
  it('UAT-050: 未设置资料时查询 → 200 空资料（注册即初始化空 profile）', async () => {
    const user = await registerAndLogin(app, 'noprofile@b.com', 'author');
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(user.id);
    expect(res.body.nickname).toBe('');
    expect(res.body.avatar).toBe('');
    expect(res.body.bio).toBe('');
  });
});
