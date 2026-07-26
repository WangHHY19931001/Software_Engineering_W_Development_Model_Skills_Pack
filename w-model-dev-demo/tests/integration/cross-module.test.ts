/**
 * 集成测试 - 跨模块交互测试（15 用例）
 * 对应 docs/integration-test-design.md §3：TC-INT-C01 ~ TC-INT-C15
 * 测试 seam：seam-http（supertest 调用 Express app，不启动真实 HTTP 服务器）
 * 数据隔离：beforeEach 创建新 container，重置内存存储
 * 零 mock：使用真实 service/store 链路，验证 INTF→INTF 调用链正确性
 *
 * 实现对齐说明：
 * - 实际路由 /api/articles/:id/workflow（非 /api/articles/:id/publish），通过 action=publish 触发
 * - 实际路由 /api/search?keyword=...（非 q=...）
 * - 实际路由 /api/archive（非 /api/articles/archive）
 * - 实际路由 /api/users/profile（仅本人资料，无 /api/users/:id/profile 公开端点）
 * - RSS 端点 /api/rss 不支持分类过滤；TC-INT-C07 改测「RSS 仅含 published 文章」
 * - 审计中间件记录 action = `${method}.${req.path}`，可通过 action 子串过滤
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestContext,
  registerAndLogin,
  createTag,
  createCategory,
  createArticle,
  createPublishedArticle,
  type TestContext,
} from './helpers.js';

describe('跨模块交互测试（15 用例）', () => {
  let ctx: TestContext;
  let app: Express;

  beforeEach(() => {
    ctx = createTestContext();
    app = ctx.app;
  });

  // ==================== TC-INT-C01 博文发布→审计日志链路 ====================
  it('TC-INT-C01: 创建文章→发布→审计日志记录（INTF-005→INTF-017→INTF-019）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const admin = await registerAndLogin(app, 'admin@b.com', 'admin');
    // 步骤1：创建 draft
    const createRes = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ title: 'C01 Title', content: 'C01 Body' });
    expect(createRes.status).toBe(201);
    const articleId = createRes.body.id;
    // 步骤2：发布
    const pubRes = await request(app)
      .post(`/api/articles/${articleId}/workflow`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ action: 'publish' });
    expect(pubRes.status).toBe(200);
    expect(pubRes.body.status).toBe('published');
    // 步骤3：查询审计日志（应含 workflow 记录）
    const auditRes = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ page: 1, limit: 50 });
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.total).toBeGreaterThan(0);
    // 审计 action 格式 `post./api/articles/<id>/workflow`，含 workflow 子串
    const workflowLogs = auditRes.body.items.filter(
      (l: { action: string }) => typeof l.action === 'string' && l.action.includes('workflow'),
    );
    expect(workflowLogs.length).toBeGreaterThan(0);
  });

  // ==================== TC-INT-C02 文章删除→评论级联→审计 ====================
  it('TC-INT-C02: 删除文章级联删除评论并记录审计（INTF-009→INTF-010/011→INTF-019）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const reader = await registerAndLogin(app, 'reader@b.com', 'reader');
    const admin = await registerAndLogin(app, 'admin@b.com', 'admin');
    const articleId = await createPublishedArticle(app, author.token, 'C02 Title', 'C02 Body');
    // 创建 3 条评论
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post(`/api/articles/${articleId}/comments`)
        .set('Authorization', `Bearer ${reader.token}`)
        .send({ content: `C02 comment ${i}` });
    }
    // 步骤1：删除文章
    const delRes = await request(app)
      .delete(`/api/articles/${articleId}`)
      .set('Authorization', `Bearer ${author.token}`);
    expect(delRes.status).toBe(204);
    // 步骤2：查询评论应 404（文章已删）
    const cmtsRes = await request(app).get(`/api/articles/${articleId}/comments`);
    expect(cmtsRes.status).toBe(404);
    // 步骤3：审计日志含 delete 记录
    const auditRes = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ page: 1, limit: 50 });
    expect(auditRes.status).toBe(200);
    const deleteLogs = auditRes.body.items.filter(
      (l: { action: string }) => typeof l.action === 'string' && l.action.startsWith('delete.'),
    );
    expect(deleteLogs.length).toBeGreaterThan(0);
  });

  // ==================== TC-INT-C03 评论创建→文章详情联动 ====================
  it('TC-INT-C03: 创建评论后文章详情不变（评论独立存储）（INTF-010→INTF-007）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const reader = await registerAndLogin(app, 'reader@b.com', 'reader');
    const articleId = await createPublishedArticle(app, author.token, 'C03 Title', 'C03 Body');
    // 步骤1：记录文章详情
    const beforeRes = await request(app).get(`/api/articles/${articleId}`);
    expect(beforeRes.status).toBe(200);
    const beforeTitle = beforeRes.body.title;
    const beforeContent = beforeRes.body.content;
    // 步骤2：创建评论
    const cmtRes = await request(app)
      .post(`/api/articles/${articleId}/comments`)
      .set('Authorization', `Bearer ${reader.token}`)
      .send({ content: 'C03 comment' });
    expect(cmtRes.status).toBe(201);
    // 步骤3：再次查询文章详情，关键字段不变
    const afterRes = await request(app).get(`/api/articles/${articleId}`);
    expect(afterRes.status).toBe(200);
    expect(afterRes.body.title).toBe(beforeTitle);
    expect(afterRes.body.content).toBe(beforeContent);
    // 评论列表新增
    const cmtsRes = await request(app).get(`/api/articles/${articleId}/comments`);
    expect(cmtsRes.status).toBe(200);
    expect(cmtsRes.body.total).toBe(1);
  });

  // ==================== TC-INT-C04 文章创建→搜索索引 ====================
  it('TC-INT-C04: 创建并发布文章后能被搜索到（INTF-005→INTF-015）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    // 步骤1：创建并发布含特殊关键词的文章
    await createPublishedArticle(app, author.token, 'searchable-keyword-xyz', 'C04 body content');
    // 步骤2：搜索该关键词
    const res = await request(app)
      .get('/api/search')
      .query({ keyword: 'searchable-keyword-xyz' });
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    const matched = res.body.items.some(
      (a: { title: string }) => a.title === 'searchable-keyword-xyz',
    );
    expect(matched).toBe(true);
  });

  // ==================== TC-INT-C05 用户注册→默认资料→本人查询 ====================
  it('TC-INT-C05: 注册后用户资料默认空，本人查询返回（INTF-002→INTF-021）', async () => {
    // 步骤1：注册
    const user = await registerAndLogin(app, 'c05@b.com', 'author');
    // 步骤2：本人查询资料
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(user.id);
    expect(res.body.nickname).toBe('');
    expect(res.body.avatar).toBe('');
    expect(res.body.bio).toBe('');
  });

  // ==================== TC-INT-C06 RSS 订阅源→条件请求→304 ====================
  it('TC-INT-C06: RSS 拉取后第二次条件请求返回 304（INTF-020→INTF-006）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    await createPublishedArticle(app, author.token, 'C06 Title', 'C06 Body');
    // 步骤1：首次拉取获取 ETag
    const first = await request(app).get('/api/rss');
    expect(first.status).toBe(200);
    const etag = first.headers['etag'];
    expect(etag).toBeTruthy();
    // 步骤2：携带 If-None-Match 应返回 304
    const second = await request(app)
      .get('/api/rss')
      .set('If-None-Match', etag as string);
    expect(second.status).toBe(304);
  });

  // ==================== TC-INT-C07 RSS 仅含已发布文章（不含草稿） ====================
  it('TC-INT-C07: RSS 仅包含 published 文章，draft 不出现（INTF-020→INTF-014/017）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    // 创建 1 篇 draft + 2 篇 published
    await createArticle(app, author.token, { title: 'C07 Draft', content: 'draft body' });
    await createPublishedArticle(app, author.token, 'C07 Pub1', 'pub1 body');
    await createPublishedArticle(app, author.token, 'C07 Pub2', 'pub2 body');
    // RSS 应仅含 2 个 <item>（published）
    const res = await request(app).get('/api/rss');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<rss');
    expect(res.text).not.toContain('C07 Draft');
    expect(res.text).toContain('C07 Pub1');
    expect(res.text).toContain('C07 Pub2');
    // 计数 <item> 数量
    const itemCount = (res.text.match(/<item>/g) ?? []).length;
    expect(itemCount).toBe(2);
  });

  // ==================== TC-INT-C08 标签删除→标签列表更新 ====================
  it('TC-INT-C08: 删除标签后标签列表不再包含该标签（INTF-013→INTF-005/007）', async () => {
    const admin = await registerAndLogin(app, 'admin@b.com', 'admin');
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    // 创建标签 + 关联文章
    const tagId = await createTag(app, admin.token, 'C08Tag');
    await createArticle(app, author.token, {
      title: 'C08 Article',
      content: 'body',
      tagIds: [tagId],
    });
    // 删除标签
    const delRes = await request(app)
      .delete(`/api/tags/${tagId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(delRes.status).toBe(204);
    // 标签列表不再包含该标签
    const listRes = await request(app).get('/api/tags');
    expect(listRes.status).toBe(200);
    const stillExists = listRes.body.some((t: { id: string }) => t.id === tagId);
    expect(stillExists).toBe(false);
    // 文章仍可查询（不因标签删除而损坏）
    const articlesRes = await request(app)
      .get('/api/articles')
      .query({ status: 'draft', authorId: author.id });
    expect(articlesRes.status).toBe(200);
    expect(articlesRes.body.total).toBe(1);
  });

  // ==================== TC-INT-C09 分类删除（存在子分类时阻止） ====================
  it('TC-INT-C09: 删除存在子分类的分类返回 409（INTF-014→INTF-005）', async () => {
    const admin = await registerAndLogin(app, 'admin@b.com', 'admin');
    // 创建父分类 + 子分类
    const parentId = await createCategory(app, admin.token, 'C09Parent');
    await createCategory(app, admin.token, 'C09Child', parentId);
    // 删除父分类应被阻止（存在子分类）
    const res = await request(app)
      .delete(`/api/categories/${parentId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.message).toContain('子分类');
  });

  // ==================== TC-INT-C10 文章点赞→文章详情计数同步 ====================
  it('TC-INT-C10: 点赞后文章详情 likeCount 同步增加（INTF-018→INTF-007）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const reader = await registerAndLogin(app, 'reader@b.com', 'reader');
    const articleId = await createPublishedArticle(app, author.token, 'C10 Title', 'C10 Body');
    // 步骤1：记录初始 likeCount
    const beforeRes = await request(app).get(`/api/articles/${articleId}`);
    expect(beforeRes.status).toBe(200);
    const beforeCount = beforeRes.body.likeCount;
    expect(beforeCount).toBe(0);
    // 步骤2：点赞
    const likeRes = await request(app)
      .post(`/api/articles/${articleId}/like`)
      .set('Authorization', `Bearer ${reader.token}`);
    expect(likeRes.status).toBe(200);
    expect(likeRes.body.liked).toBe(true);
    // 步骤3：再次查询文章详情，likeCount 同步
    const afterRes = await request(app).get(`/api/articles/${articleId}`);
    expect(afterRes.status).toBe(200);
    expect(afterRes.body.likeCount).toBe(beforeCount + 1);
  });

  // ==================== TC-INT-C11 密码重置→旧密码登录失败 ====================
  it('TC-INT-C11: 重置密码后旧密码登录失败（INTF-016→INTF-003）', async () => {
    const user = await registerAndLogin(app, 'c11@b.com', 'reader', 'oldpass123');
    // 请求重置
    const reqRes = await request(app)
      .post('/api/users/password-reset/request')
      .send({ email: 'c11@b.com' });
    expect(reqRes.status).toBe(200);
    // 从 store 取 token（测试内部访问，非 mock）
    const tokens = ctx.stores.passwordReset.findByUser(user.id);
    expect(tokens.length).toBeGreaterThan(0);
    const token = tokens[0]!.token;
    // 执行重置
    const resetRes = await request(app)
      .post('/api/users/password-reset')
      .send({ token, newPassword: 'newpass123' });
    expect(resetRes.status).toBe(200);
    // 用旧密码登录应失败
    const oldLoginRes = await request(app)
      .post('/api/users/login')
      .send({ email: 'c11@b.com', password: 'oldpass123' });
    expect(oldLoginRes.status).toBe(401);
    // 用新密码登录应成功
    const newLoginRes = await request(app)
      .post('/api/users/login')
      .send({ email: 'c11@b.com', password: 'newpass123' });
    expect(newLoginRes.status).toBe(200);
  });

  // ==================== TC-INT-C12 工作流→RSS 更新 ====================
  it('TC-INT-C12: 文章 publish 后 RSS 出现该文章（INTF-017→INTF-020）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    // 步骤1：创建 draft（不发布）
    const articleId = await createArticle(app, author.token, {
      title: 'C12 Draft Title',
      content: 'C12 body',
    });
    // RSS 不应含该 draft
    const beforeRss = await request(app).get('/api/rss');
    expect(beforeRss.status).toBe(200);
    expect(beforeRss.text).not.toContain('C12 Draft Title');
    // 步骤2：发布
    const pubRes = await request(app)
      .post(`/api/articles/${articleId}/workflow`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ action: 'publish' });
    expect(pubRes.status).toBe(200);
    // 步骤3：RSS 应含该文章
    const afterRss = await request(app).get('/api/rss');
    expect(afterRss.status).toBe(200);
    expect(afterRss.text).toContain('C12 Draft Title');
  });

  // ==================== TC-INT-C13 搜索→归档统计一致性 ====================
  it('TC-INT-C13: 搜索 total = 归档 count 之和（INTF-015→INTF-022）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    // 创建 5 篇 published 文章
    for (let i = 0; i < 5; i++) {
      await createPublishedArticle(app, author.token, `C13 Title ${i}`, `C13 body ${i}`);
    }
    // 步骤1：搜索全部（用通用关键词匹配所有）
    const searchRes = await request(app)
      .get('/api/search')
      .query({ keyword: 'C13' });
    expect(searchRes.status).toBe(200);
    const searchTotal = searchRes.body.total;
    // 步骤2：归档统计
    const archiveRes = await request(app).get('/api/archive');
    expect(archiveRes.status).toBe(200);
    const archiveSum = archiveRes.body.reduce(
      (sum: number, b: { count: number }) => sum + b.count,
      0,
    );
    // 两者相等（均统计 published 文章）
    expect(searchTotal).toBe(archiveSum);
    expect(searchTotal).toBe(5);
  });

  // ==================== TC-INT-C14 权限中间件→审计日志查询（admin only） ====================
  it('TC-INT-C14: 非 admin 调用 GET /api/audit-logs 被权限中间件拦截（INTF-004→INTF-019）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const res = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${author.token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });

  // ==================== TC-INT-C15 文章更新→审计日志记录 ====================
  it('TC-INT-C15: 更新文章后审计日志记录 update 操作（INTF-008→INTF-019）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    const admin = await registerAndLogin(app, 'admin@b.com', 'admin');
    const articleId = await createArticle(app, author.token, {
      title: 'C15 Old Title',
      content: 'C15 body',
    });
    // 步骤1：更新文章
    const updateRes = await request(app)
      .put(`/api/articles/${articleId}`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ title: 'C15 New Title' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.title).toBe('C15 New Title');
    // 步骤2：查询审计日志，应含 put./api/articles/<id> 记录
    const auditRes = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ page: 1, limit: 50 });
    expect(auditRes.status).toBe(200);
    const putLogs = auditRes.body.items.filter(
      (l: { action: string }) =>
        typeof l.action === 'string' && l.action.startsWith('put.') && l.action.includes('articles'),
    );
    expect(putLogs.length).toBeGreaterThan(0);
    // 验证 meta 字段含 statusCode（CON-004 结构化日志）
    const latestPutLog = putLogs[0];
    expect(latestPutLog.meta).toBeDefined();
    expect(latestPutLog.meta.statusCode).toBeDefined();
  });
});
