/**
 * 系统测试 - 安全测试（5 用例）
 * 对应 docs/system-test-design.md §5：TC-SEC-001 ~ TC-SEC-005
 * 覆盖 NFR-002 JWT 密钥 / NFR-005 zod 校验 / OWASP Top 10
 *
 * 测试方法：
 * - TC-SEC-001: 直接构造 JwtUtil/container 验证密钥长度边界（31/32/64 字节）
 * - TC-SEC-002: 遍历所有 POST/PUT 接口提交非法 payload，校验 400 VALIDATION_ERROR
 * - TC-SEC-003: 注入 SQL payload 验证原样存储 + 不影响其他记录（OWASP A03）
 * - TC-SEC-004: 注入 XSS payload 验证 RSS XML 转义（OWASP A03）
 * - TC-SEC-005: 越权访问返回 403（reader→写接口 / author A→author B 资源）（OWASP A01）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { JwtUtil } from '../../src/utils/auth.js';
import { createContainer } from '../../src/container.js';
import {
  createTestContext,
  registerAndLogin,
  createPublishedArticle,
  type TestContext,
} from './helpers.js';

describe('安全测试（5 用例）', () => {
  let ctx: TestContext;
  let app: Express;

  beforeEach(() => {
    ctx = createTestContext();
    app = ctx.app;
  });

  // ==================== TC-SEC-001 JWT 密钥强度校验 ====================
  it('TC-SEC-001: JWT_SECRET < 32 字节启动失败；≥ 32 字节正常启动（NFR-002）', () => {
    // 31 字节 → 启动失败
    expect(() => new JwtUtil('a'.repeat(31))).toThrow(/32 字节/);
    expect(() => createContainer('a'.repeat(31))).toThrow(/32 字节/);

    // 空字符串 → 启动失败
    expect(() => new JwtUtil('')).toThrow(/32 字节/);
    expect(() => createContainer('')).toThrow(/32 字节/);

    // 32 字节 → 正常启动
    expect(() => new JwtUtil('a'.repeat(32))).not.toThrow();
    expect(() => createContainer('a'.repeat(32))).not.toThrow();

    // 64 字节 → 正常启动
    expect(() => new JwtUtil('a'.repeat(64))).not.toThrow();
    expect(() => createContainer('a'.repeat(64))).not.toThrow();
  });

  // ==================== TC-SEC-002 zod 输入校验覆盖率 ====================
  it('TC-SEC-002: 所有 POST/PUT 接口非法 payload 返回 400 VALIDATION_ERROR（NFR-005）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const admin = await registerAndLogin(app, 'admin@b.com', 'admin');

    // register - 邮箱格式错误
    let res = await request(app)
      .post('/api/users/register')
      .send({ email: 'not-an-email', password: 'pass1234', role: 'reader' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    // login - 缺少 password
    res = await request(app)
      .post('/api/users/login')
      .send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    // password-reset/request - 邮箱格式错误
    res = await request(app)
      .post('/api/users/password-reset/request')
      .send({ email: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    // password-reset - 新密码过短
    res = await request(app)
      .post('/api/users/password-reset')
      .send({ token: 'x', newPassword: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    // articles create - 缺少 title
    res = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ content: 'body' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    // articles create - title 超长（>200）
    res = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ title: 'x'.repeat(201), content: 'body' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    // tags create - 缺少 name（admin 已认证）
    res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    // categories create - 缺少 name
    res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    // articles workflow - 非法 action
    const articleId = await createPublishedArticle(app, author.token, 'T', 'B');
    res = await request(app)
      .post(`/api/articles/${articleId}/workflow`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ action: 'invalid-action' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // ==================== TC-SEC-003 SQL 注入防御 ====================
  it('TC-SEC-003: SQL 注入 payload 作为字符串原样存储，不影响其他记录（OWASP A03）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const payloads = [
      "' OR 1=1 --",
      "'; DROP TABLE articles; --",
      '" OR "" = "',
      "1' UNION SELECT * FROM users--",
    ];

    // 注入 payload 创建文章（published 以便搜索验证）
    for (const payload of payloads) {
      const res = await request(app)
        .post('/api/articles')
        .set('Authorization', `Bearer ${author.token}`)
        .send({ title: payload, content: payload, tagIds: [], categoryId: null, status: 'published' });
      expect(res.status).toBe(201);
      // payload 原样存储
      expect(res.body.title).toBe(payload);
      expect(res.body.content).toBe(payload);
    }

    // 列表查询：总数 = 注入的文章数，未导致数据丢失
    const listRes = await request(app).get('/api/articles').query({ page: 1, limit: 20 });
    expect(listRes.status).toBe(200);
    expect(listRes.body.total).toBe(payloads.length);

    // 搜索 'OR 1=1'：只匹配含该子串的 1 篇，而非全表（证明注入未生效）
    const searchRes = await request(app).get('/api/search').query({ keyword: 'OR 1=1' });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.total).toBe(1);
    expect(searchRes.body.total).toBeLessThan(payloads.length);

    // 验证其他用户数据未受影响
    const other = await registerAndLogin(app, 'other@b.com', 'author');
    const otherRes = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${other.token}`)
      .send({ title: 'clean article', content: 'safe', tagIds: [], categoryId: null, status: 'published' });
    expect(otherRes.status).toBe(201);
    expect(otherRes.body.title).toBe('clean article');
  });

  // ==================== TC-SEC-004 XSS 防御（RSS XML 转义） ====================
  it('TC-SEC-004: RSS 输出转义 <script> 标签，防止 XSS（OWASP A03）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const xssPayload = '<script>alert("XSS")</script>';
    const res = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ title: xssPayload, content: 'safe content', tagIds: [], categoryId: null, status: 'published' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe(xssPayload);

    const rssRes = await request(app).get('/api/rss');
    expect(rssRes.status).toBe(200);
    expect(rssRes.headers['content-type']).toContain('xml');
    const body = rssRes.text;
    // 原始 <script> 标签不应出现（防止 XSS 执行）
    expect(body).not.toContain('<script>alert');
    // 应被 XML 转义为 &lt;script&gt;
    expect(body).toContain('&lt;script&gt;');
    expect(body).toContain('&lt;/script&gt;');
  });

  // ==================== TC-SEC-005 越权访问防御 ====================
  it('TC-SEC-005: reader 越权写接口返回 403；author A 修改 B 文章返回 403（OWASP A01）', async () => {
    const reader = await registerAndLogin(app, 'reader@b.com', 'reader');
    const authorA = await registerAndLogin(app, 'author-a@b.com', 'author');
    const authorB = await registerAndLogin(app, 'author-b@b.com', 'author');
    const admin = await registerAndLogin(app, 'admin@b.com', 'admin');

    // reader 尝试创建文章 → 403 AUTHORIZATION_ERROR
    const r1 = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${reader.token}`)
      .send({ title: 'forbidden', content: 'content' });
    expect(r1.status).toBe(403);
    expect(r1.body.error.code).toBe('AUTHORIZATION_ERROR');

    // reader 尝试创建标签（admin-only）→ 403
    const r2 = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${reader.token}`)
      .send({ name: 'forbidden' });
    expect(r2.status).toBe(403);
    expect(r2.body.error.code).toBe('AUTHORIZATION_ERROR');

    // author A 创建文章，author B 尝试修改 → 403
    const createRes = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${authorA.token}`)
      .send({ title: 'A title', content: 'A content' });
    expect(createRes.status).toBe(201);
    const articleId = createRes.body.id;

    const r3 = await request(app)
      .put(`/api/articles/${articleId}`)
      .set('Authorization', `Bearer ${authorB.token}`)
      .send({ title: 'B attempt' });
    expect(r3.status).toBe(403);
    expect(r3.body.error.code).toBe('AUTHORIZATION_ERROR');

    // author B 尝试删除 author A 的文章 → 403
    const r4 = await request(app)
      .delete(`/api/articles/${articleId}`)
      .set('Authorization', `Bearer ${authorB.token}`);
    expect(r4.status).toBe(403);
    expect(r4.body.error.code).toBe('AUTHORIZATION_ERROR');

    // admin 可以修改任意文章（越权防御不阻塞 admin）
    const r5 = await request(app)
      .put(`/api/articles/${articleId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'Admin override' });
    expect(r5.status).toBe(200);
    expect(r5.body.title).toBe('Admin override');
  });
});
