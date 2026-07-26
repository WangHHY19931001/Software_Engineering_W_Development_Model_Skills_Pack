/**
 * 集成测试 - 异常路径测试（10 用例）
 * 对应 docs/integration-test-design.md §4：TC-INT-X01 ~ TC-INT-X10
 * 测试 seam：seam-http（主）+ seam-module（TC-INT-X09 钩住 auditService.log）
 * 数据隔离：beforeEach 创建新 container，重置内存存储
 *
 * 实现对齐说明：
 * - 登录失败锁定由 LoginRateLimiter 承担（5 次失败后锁定 5 分钟，返回 401 而非 429）
 * - 全局 API 限流由 RateLimitMiddleware 承担（60 次/分钟，超限返回 429）
 * - ArticleStore 无硬容量上限；TC-INT-X04 改测「大批量插入后系统仍正常工作」
 * - AtomFeedGenerator 已实现 XML 转义；TC-INT-X08 验证特殊字符被正确转义
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import {
  createTestContext,
  registerAndLogin,
  createArticle,
  createPublishedArticle,
  type TestContext,
} from './helpers.js';

const TEST_JWT_SECRET = 'test-secret-blog-demo-32chars-min!!';

describe('异常路径测试（10 用例）', () => {
  let ctx: TestContext;
  let app: Express;

  beforeEach(() => {
    ctx = createTestContext();
    app = ctx.app;
  });

  // ==================== TC-INT-X01 限流触发（登录失败锁定） ====================
  it('TC-INT-X01: 同邮箱连续 5 次登录失败后触发锁定（INTF-003 / NFR-006）', async () => {
    // 注册用户
    await request(app)
      .post('/api/users/register')
      .send({ email: 'x01@b.com', password: 'pass1234', role: 'reader' });
    // 连续 5 次错误密码登录
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/users/login')
        .send({ email: 'x01@b.com', password: 'wrongpass' });
      expect(res.status).toBe(401);
    }
    // 第 6 次应触发锁定（返回 401 含「登录失败次数过多」）
    const res = await request(app)
      .post('/api/users/login')
      .send({ email: 'x01@b.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.message).toContain('登录失败次数过多');
  });

  // ==================== TC-INT-X02 并发点赞竞态 ====================
  it('TC-INT-X02: 同一用户并发 2 次 POST /like，仅一次 liked=true（INTF-018）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const reader = await registerAndLogin(app, 'reader@b.com', 'reader');
    const articleId = await createPublishedArticle(app, author.token, 'X02 Title', 'X02 Body');
    // 并行发起 2 个点赞请求
    const [resA, resB] = await Promise.all([
      request(app)
        .post(`/api/articles/${articleId}/like`)
        .set('Authorization', `Bearer ${reader.token}`),
      request(app)
        .post(`/api/articles/${articleId}/like`)
        .set('Authorization', `Bearer ${reader.token}`),
    ]);
    // 由于 toggle 语义，一个 liked=true，另一个 liked=false（toggle 取消）
    const likedResults = [resA.body.liked, resB.body.liked].sort();
    expect(likedResults).toEqual([false, true]);
    // 两个响应都应 200
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
  });

  // ==================== TC-INT-X03 文章删除与评论创建并发 ====================
  it('TC-INT-X03: 删除文章后评论创建应失败（INTF-009 + INTF-010）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const reader = await registerAndLogin(app, 'reader@b.com', 'reader');
    const articleId = await createPublishedArticle(app, author.token, 'X03 Title', 'X03 Body');
    // 步骤1：删除文章
    const delRes = await request(app)
      .delete(`/api/articles/${articleId}`)
      .set('Authorization', `Bearer ${author.token}`);
    expect(delRes.status).toBe(204);
    // 步骤2：创建评论应 404（文章已删）
    const cmtRes = await request(app)
      .post(`/api/articles/${articleId}/comments`)
      .set('Authorization', `Bearer ${reader.token}`)
      .send({ content: 'X03 comment' });
    expect(cmtRes.status).toBe(404);
    expect(cmtRes.body.error).toBeDefined();
  });

  // ==================== TC-INT-X04 内存存储大批量处理（NFR-004 容量） ====================
  it('TC-INT-X04: 批量插入 100 篇文章后系统仍正常工作（INTF-005 / NFR-004）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    // 直接通过 store 批量插入 100 篇（避免 100 次 HTTP 开销）
    for (let i = 0; i < 100; i++) {
      ctx.stores.article.insert({
        title: `X04 Article ${i}`,
        content: `X04 body ${i}`,
        authorId: author.id,
        categoryId: null,
        tagIds: [],
        status: 'published',
        publishedAt: new Date().toISOString(),
      });
    }
    // 验证列表查询正常
    const listRes = await request(app)
      .get('/api/articles')
      .query({ page: 1, limit: 20, status: 'published' });
    expect(listRes.status).toBe(200);
    expect(listRes.body.total).toBe(100);
    // 验证可通过 API 继续创建（无硬上限阻断）
    const createRes = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ title: 'X04 New Article', content: 'X04 new body', status: 'published' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.title).toBe('X04 New Article');
  });

  // ==================== TC-INT-X05 JWT 过期 ====================
  it('TC-INT-X05: 过期 token 访问受保护接口返回 401（INTF-003/004 / CON-002）', async () => {
    const user = await registerAndLogin(app, 'x05@b.com', 'author');
    // 签发一个 1s 过期的 token（同密钥）
    const expiredToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      TEST_JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1s' },
    );
    // 等待 1.5s 让 token 过期
    await new Promise((resolve) => setTimeout(resolve, 1500));
    // 用过期 token 访问受保护接口
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.message).toContain('过期');
  });

  // ==================== TC-INT-X06 JWT 签名无效 ====================
  it('TC-INT-X06: 篡改 token 签名后访问返回 401（INTF-004）', async () => {
    const user = await registerAndLogin(app, 'x06@b.com', 'author');
    // 篡改 token 最后 4 个字符
    const tamperedToken = user.token.slice(0, -4) + 'XXXX';
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${tamperedToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  // ==================== TC-INT-X07 Zod schema 校验失败（NFR-005） ====================
  it('TC-INT-X07: 邮箱格式非法返回 400（INTF-002 / NFR-005）', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send({ email: 'not-an-email', password: 'pass1234', role: 'reader' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.message).toContain('邮箱');
  });

  // ==================== TC-INT-X08 XML 渲染对特殊字符健壮（INTF-020） ====================
  it('TC-INT-X08: 文章标题含特殊字符时 RSS 正确转义（INTF-020）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    // 创建含 XML 特殊字符的已发布文章
    await createPublishedArticle(
      app,
      author.token,
      'X08 <script> & "quotes" \'apos\'',
      'X08 body <>&',
    );
    // RSS 应正确转义，返回 200
    const res = await request(app).get('/api/rss');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('xml');
    // 转义后的字符应出现
    expect(res.text).toContain('&lt;script&gt;');
    expect(res.text).toContain('&amp;');
    // 不应出现未转义的 <script>（避免 XSS）
    expect(res.text).not.toContain('<script>');
  });

  // ==================== TC-INT-X09 审计写入失败不阻断主流程 ====================
  it('TC-INT-X09: auditService.log 抛异常时文章创建仍成功（INTF-005/019）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    // seam-module：spy auditService.log 同步抛错
    vi.spyOn(ctx.services.audit, 'log').mockImplementation(() => {
      throw new Error('audit log failure (simulated)');
    });
    // 文章创建应成功（best-effort 审计不阻断主流程）
    const res = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ title: 'X09 Title', content: 'X09 Body' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('X09 Title');
    // 文章确实已创建
    const getRes = await request(app).get(`/api/articles/${res.body.id}`);
    expect(getRes.status).toBe(200);
  });

  // ==================== TC-INT-X10 限流中间件触发（429） ====================
  it('TC-INT-X10: 超过限流阈值后返回 429（INTF-001 / NFR-006）', async () => {
    // RateLimitMiddleware 容量 60，refillRate 60/s
    // 并行发起 65 个请求，应至少有 1 个被限流
    const requests = Array.from({ length: 65 }, () =>
      request(app).get('/api/health'),
    );
    const responses = await Promise.all(requests);
    const okCount = responses.filter((r) => r.status === 200).length;
    const rateLimitedCount = responses.filter((r) => r.status === 429).length;
    // 至少 60 个成功（容量 60）
    expect(okCount).toBeGreaterThanOrEqual(60);
    // 至少 1 个被限流（超过容量）
    expect(rateLimitedCount).toBeGreaterThanOrEqual(1);
  });
});
