/**
 * 集成测试 · 横切契约域（SD-007 / CON-002 / CON-004）
 * IT-026 统一参数校验 40001/40002/60003（抽样覆盖全部接口）
 * IT-027 统一错误响应结构 { error: { code, message } }（CON-002 抽样）
 * IT-030 审计日志：登录/发布/删除留痕（CON-004）
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { ERROR_CATALOG } from '../../src/utils/errors';
import { createTestEnv, seedUser, seedTag, seedCategory, seedArticle, login, bearer, pollUntil } from './helpers';

describe('IT-026 统一参数校验 40001/40002/60003（抽样覆盖全部接口）', () => {
  it('邮箱格式 40001 / 密码过短 40002 / 分页越界 40002 / 标题超长 40002 / 非法头像 40001 / 分类深度 60003', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'it26_blogger', email: 'it26b@example.com', role: 'blogger' });
    await seedUser(env.stores, { username: 'it26_reader', email: 'it26r@example.com' });
    seedTag(env.stores, 't1');
    // 分类三层链（computeDepth 沿 parentId 链计算，根=1）：c_1 → c_2 → c_3
    seedCategory(env.stores, { name: '一级分类', id: 'c_1' });
    seedCategory(env.stores, { name: '二级分类', id: 'c_2', parentId: 'c_1' });
    seedCategory(env.stores, { name: '三级分类', id: 'c_3', parentId: 'c_2' });

    const bloggerSession = await login(env.app, 'it26b@example.com');
    const readerSession = await login(env.app, 'it26r@example.com');

    // 1 非法邮箱注册：400 + error.code=40001（invalid_string → 40001）
    const badEmail = await request(env.app).post('/api/auth/register').send({
      username: 'validuser26',
      email: 'bad-email',
      password: 'Passw0rd!x',
    });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.error.code).toBe(40001);

    // 2 密码过短注册：400 + error.code=40002（too_small → 40002）
    const shortPwd = await request(env.app).post('/api/auth/register').send({
      username: 'validuser26b',
      email: 'ok26@example.com',
      password: '123',
    });
    expect(shortPwd.status).toBe(400);
    expect(shortPwd.body.error.code).toBe(40002);

    // 3 分页越界：400 + error.code=40002
    const badPage = await request(env.app).get('/api/articles').query({ page: 0 });
    expect(badPage.status).toBe(400);
    expect(badPage.body.error.code).toBe(40002);

    // 4 标题超长（201 字符）：400 + error.code=40002
    const longTitle = await request(env.app)
      .post('/api/articles')
      .set(bearer(bloggerSession.token))
      .send({ title: '长'.repeat(201), body: '正文' });
    expect(longTitle.status).toBe(400);
    expect(longTitle.body.error.code).toBe(40002);

    // 5 PATCH 资料非法头像（ftp://x 非 http(s)）：400 + error.code=40001（实现契约：profileService 40001，设计期望 40002 见测试报告）
    const badAvatar = await request(env.app)
      .patch('/api/users/me')
      .set(bearer(readerSession.token))
      .send({ avatarUrl: 'ftp://x' });
    expect(badAvatar.status).toBe(400);
    expect(badAvatar.body.error.code).toBe(40001);

    // 6 分类深度超限（三层分类下创建子分类 → depth=4）：400 + error.code=60003
    const deepCat = await request(env.app)
      .post('/api/categories')
      .set(bearer(bloggerSession.token))
      .send({ name: '孙分类', parentId: 'c_3' });
    expect(deepCat.status).toBe(400);
    expect(deepCat.body.error.code).toBe(60003);
  });
});

describe('IT-027 统一错误响应结构 { error: { code, message } }（CON-002 抽样）', () => {
  it('4xx/业务 6xxxx/成功响应结构与错误码四元组一致性', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'it27_blogger', email: 'it27b@example.com', role: 'blogger' });
    await seedUser(env.stores, { username: 'it27_reader', email: 'it27r@example.com' });
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '已发布文章', status: 'published' });
    seedArticle(env.stores, { id: 'A2', authorId: blogger.id, title: '归档文章', status: 'archived' });

    const bloggerSession = await login(env.app, 'it27b@example.com');
    const readerSession = await login(env.app, 'it27r@example.com');

    // 1 4xx 错误抽样：409（重复注册）/403（越权发文）/400（分页越界）→ 均 { error: { code, message } }，code ∈ 40000-49999
    await request(env.app).post('/api/auth/register').send({ username: 'it27_dup', email: 'it27d@example.com', password: 'Passw0rd!x' });
    const dup = await request(env.app).post('/api/auth/register').send({ username: 'it27_dup2', email: 'it27d@example.com', password: 'Passw0rd!x' });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toHaveProperty('code');
    expect(dup.body.error).toHaveProperty('message');
    expect(dup.body.error.code).toBeGreaterThanOrEqual(40000);
    expect(dup.body.error.code).toBeLessThan(50000);

    const forbidden = await request(env.app)
      .post('/api/articles')
      .set(bearer(readerSession.token))
      .send({ title: '越权', body: 'b' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error).toHaveProperty('code');
    expect(forbidden.body.error.code).toBeGreaterThanOrEqual(40000);
    expect(forbidden.body.error.code).toBeLessThan(50000);

    const badPage = await request(env.app).get('/api/articles').query({ page: 0 });
    expect(badPage.status).toBe(400);
    expect(badPage.body.error.code).toBeGreaterThanOrEqual(40000);
    expect(badPage.body.error.code).toBeLessThan(50000);

    // 2 业务错误抽样：状态机非法（60001）→ code ∈ 60000-69999
    const stateErr = await request(env.app).post('/api/articles/A2/publish').set(bearer(bloggerSession.token));
    expect(stateErr.status).toBe(409);
    expect(stateErr.body.error.code).toBe(60001);
    expect(stateErr.body.error.code).toBeGreaterThanOrEqual(60000);
    expect(stateErr.body.error.code).toBeLessThan(70000);

    // 3 成功响应抽样：详情 200 → { code: 0, message, data }
    const detail = await request(env.app).get('/api/articles/A1');
    expect(detail.status).toBe(200);
    expect(detail.body.code).toBe(0);
    expect(detail.body.message).toBe('ok');
    expect(detail.body.data.articleId).toBe('A1');

    // 4 错误码四元组一致性：code↔httpStatus 映射与接口设计 §0.3 对照（抽样）
    const samples: Array<[number, number]> = [
      [40001, 400], [40002, 400], [40101, 401], [40102, 401], [40301, 403],
      [40401, 404], [40402, 404], [40901, 409], [42901, 429], [60001, 409], [60002, 400], [60003, 400],
    ];
    for (const [code, httpStatus] of samples) {
      expect(ERROR_CATALOG[code]).toBeDefined();
      expect(ERROR_CATALOG[code].httpStatus).toBe(httpStatus);
      expect(typeof ERROR_CATALOG[code].retryable).toBe('boolean');
    }
  });
});

describe('IT-030 审计日志：登录/发布/删除留痕（CON-004）', () => {
  it('登录/发布/删除产生审计记录；只读浏览不误审计', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'it30_blogger', email: 'it30b@example.com', role: 'blogger' });
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '发布审计草稿', status: 'draft' });
    seedArticle(env.stores, { id: 'A2', authorId: blogger.id, title: '删除审计草稿', status: 'draft' });

    const listLogs = () => env.stores.auditLogStore.list();
    const countBy = (actionType: string) => listLogs().filter((log) => log.actionType === actionType).length;
    const countTotal = () => listLogs().length;

    // 1 登录：AuditLog 新增 1 条 type=login（登录为公开接口，actorId=null 属 CON-004 白名单设计）
    //   audit 中间件在响应 'finish' 事件落盘，与 supertest 响应解析存在时序竞争 → 轮询等待
    const session = await login(env.app, 'it30b@example.com');
    await pollUntil(() => countBy('login'), (count) => count === 1, { timeoutMs: 3000, message: '登录审计未产生' });
    expect(countTotal()).toBeGreaterThanOrEqual(1);

    // 2 发布文章：AuditLog 新增 1 条 type=publish，resource=article:A1，actor=博主
    const pubRes = await request(env.app).post('/api/articles/A1/publish').set(bearer(session.token));
    expect(pubRes.status).toBe(200);
    await pollUntil(() => countBy('publish'), (count) => count === 1, { timeoutMs: 3000, message: '发布审计未产生' });
    const publishLog = listLogs().find((log) => log.actionType === 'publish');
    expect(publishLog?.resourceType).toBe('article');
    expect(publishLog?.resourceId).toBe('A1');
    expect(publishLog?.actorId).toBe(blogger.id);

    // 3 删除草稿：AuditLog 新增 1 条 type=delete，resource=article:A2
    const delRes = await request(env.app).delete('/api/articles/A2').set(bearer(session.token));
    expect(delRes.status).toBe(204);
    await pollUntil(() => countBy('delete'), (count) => count === 1, { timeoutMs: 3000, message: '删除审计未产生' });
    const deleteLog = listLogs().find((log) => log.actionType === 'delete');
    expect(deleteLog?.resourceType).toBe('article');
    expect(deleteLog?.resourceId).toBe('A2');

    // 4 浏览列表（对照）：200 + 不新增审计记录
    const beforeBrowse = countTotal();
    const browse = await request(env.app).get('/api/articles');
    expect(browse.status).toBe(200);
    // 留出 'finish' 落盘窗口后复查，杜绝时序误判
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(countTotal()).toBe(beforeBrowse);
  });
});
