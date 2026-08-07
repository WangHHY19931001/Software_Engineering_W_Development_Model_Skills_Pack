/**
 * 系统测试 · 横切契约与安全治理（ST-025~028）
 * ST-025 统一错误契约：全接口错误响应结构一致（CON-002）
 * ST-026 认证失效：过期/篡改 token 访问需认证接口 401（CON-003）
 * ST-027 审计日志：登录/发布/删除三类操作留痕（CON-004）
 * ST-028 API 限流：认证/通用接口超阈值 429（NFR-006）
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestEnv, seedUser, seedArticle, register, login, bearer, pollUntil } from './helpers';

const SECRET = process.env.JWT_SECRET ?? 'test-secret-blog-demo';
const DAY_MS = 86400000;

describe('ST-025 统一错误契约：全接口错误响应结构一致（横切集成，CON-002）', () => {
  it('400/401/403/404/409/429 六类错误响应体统一为 { error: { code, message } }', async () => {
    // 场景 A：默认限流下触发 400/401/403/404/409
    const envA = createTestEnv();
    const blogger = await seedUser(envA.stores, { username: 'st25_blogger', email: 'st25b@example.com', role: 'blogger' });
    await seedUser(envA.stores, { username: 'st25_reader', email: 'st25r@example.com' });
    seedArticle(envA.stores, { id: 'A1', authorId: blogger.id, title: '契约文章', status: 'published' });
    const readerSession = await login(envA.app, 'st25r@example.com');

    // 1 触发 400：注册缺字段 → { error: { code, message } }，code=40001（zod required）
    const bad400 = await request(envA.app).post('/api/auth/register').send({ username: 'st25_x' });
    expect(bad400.status).toBe(400);
    expect(bad400.body.error.code).toBe(40001);
    expect(typeof bad400.body.error.message).toBe('string');

    // 2 触发 401：无 token 访问 /api/users/me
    const bad401 = await request(envA.app).get('/api/users/me');
    expect(bad401.status).toBe(401);
    expect(bad401.body.error.code).toBe(40101);
    expect(typeof bad401.body.error.message).toBe('string');

    // 3 触发 403：读者发文章（越权）
    const bad403 = await request(envA.app)
      .post('/api/articles')
      .set(bearer(readerSession.token))
      .send({ title: '越权', body: 'b' });
    expect(bad403.status).toBe(403);
    expect(bad403.body.error.code).toBe(40301);

    // 4 触发 404：文章不存在（实现契约：不存在/草稿/归档对读者统一 40402 防枚举）
    const bad404 = await request(envA.app).get('/api/articles/u_ghost');
    expect(bad404.status).toBe(404);
    expect(bad404.body.error.code).toBe(40402);

    // 5 触发 409：重复邮箱注册
    await request(envA.app).post('/api/auth/register').send({ username: 'st25_dup1', email: 'st25dup@example.com', password: 'Passw0rd!x' });
    const bad409 = await request(envA.app).post('/api/auth/register').send({ username: 'st25_dup2', email: 'st25dup@example.com', password: 'Passw0rd!x' });
    expect(bad409.status).toBe(409);
    expect(bad409.body.error.code).toBe(40901);

    // 场景 B：认证限流阈值缩小（limit=3）触发 429
    const envB = createTestEnv({ rateLimitAuth: { limit: 3, windowMs: 60000 } });
    await register(envB.app, 'st25_limit_user', 'st25limit@example.com');
    for (let i = 0; i < 3; i += 1) {
      await request(envB.app).post('/api/auth/login').send({ identifier: 'st25limit@example.com', password: 'Passw0rd!x' });
    }
    const bad429 = await request(envB.app).post('/api/auth/login').send({ identifier: 'st25limit@example.com', password: 'Passw0rd!x' });
    expect(bad429.status).toBe(429);
    expect(bad429.body.error.code).toBe(42901);
    expect(typeof bad429.body.error.message).toBe('string');
  });
});

describe('ST-026 认证失效：过期/篡改 token 访问需认证接口 401（横切集成，CON-003/REQ-008）', () => {
  it('过期 token 40102；篡改签名/篡改 payload 40101；有效 token 200', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st26_blogger', email: 'st26b@example.com', role: 'blogger' });

    // 1 过期 token：401 + TOKEN_EXPIRED（40102）
    const nowSec = Math.floor(Date.now() / 1000);
    const expired = jwt.sign(
      { sub: blogger.id, role: 'blogger', iat: nowSec - 72000, exp: nowSec - 100 },
      SECRET,
      { algorithm: 'HS256' },
    );
    const expiredRes = await request(env.app).get('/api/users/me').set(bearer(expired));
    expect(expiredRes.status).toBe(401);
    expect(expiredRes.body.error.code).toBe(40102);

    // 2 篡改签名访问（错误密钥签发）：401 + TOKEN_INVALID（40101）
    const wrongKeyToken = jwt.sign({ sub: blogger.id, role: 'blogger' }, 'wrong-secret-key', { algorithm: 'HS256', expiresIn: '1h' });
    const wrongKeyRes = await request(env.app).get('/api/users/me').set(bearer(wrongKeyToken));
    expect(wrongKeyRes.status).toBe(401);
    expect(wrongKeyRes.body.error.code).toBe(40101);

    // 3 篡改 payload（改 userId 破坏签名，不重签）：401 + TOKEN_INVALID（40101，签名完整性校验）
    const validToken = jwt.sign({ sub: blogger.id, role: 'blogger' }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    const [header, payloadB64, signature] = validToken.split('.');
    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { sub: string };
    const tamperedPayload = Buffer.from(JSON.stringify({ ...decoded, sub: 'u_forged' })).toString('base64url');
    const tampered = `${header}.${tamperedPayload}.${signature}`;
    const tamperedRes = await request(env.app).get('/api/users/me').set(bearer(tampered));
    expect(tamperedRes.status).toBe(401);
    expect(tamperedRes.body.error.code).toBe(40101);

    // 4 有效 token：200 + 用户资料（对照组）
    const session = await login(env.app, 'st26b@example.com');
    const ok = await request(env.app).get('/api/users/me').set(bearer(session.token));
    expect(ok.status).toBe(200);
    expect(ok.body.data.email).toBe('st26b@example.com');
  });
});

describe('ST-027 审计日志：登录/发布/删除三类操作留痕（横切集成，CON-004）', () => {
  it('登录/发布/删除产生审计记录（含操作者/时间/动作）；保留策略 ≥90 天', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st27_blogger', email: 'st27b@example.com', role: 'blogger' });
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '发布审计草稿', status: 'draft' });
    seedArticle(env.stores, { id: 'A2', authorId: blogger.id, title: '删除审计草稿', status: 'draft' });

    const listLogs = () => env.stores.auditLogStore.list();
    const countBy = (actionType: string) => listLogs().filter((log) => log.actionType === actionType).length;

    // 1 登录：审计记录（action=login，audit 中间件在响应 finish 落盘 → 轮询等待）
    const session = await login(env.app, 'st27b@example.com');
    await pollUntil(() => countBy('login'), (count) => count === 1, { timeoutMs: 3000, message: '登录审计未产生' });

    // 2 发布文章：审计记录（action=publish, resource=article:A1, actor=博主）
    const pubRes = await request(env.app).post('/api/articles/A1/publish').set(bearer(session.token));
    expect(pubRes.status).toBe(200);
    await pollUntil(() => countBy('publish'), (count) => count === 1, { timeoutMs: 3000, message: '发布审计未产生' });
    const publishLog = listLogs().find((log) => log.actionType === 'publish');
    expect(publishLog?.resourceType).toBe('article');
    expect(publishLog?.resourceId).toBe('A1');
    expect(publishLog?.actorId).toBe(blogger.id);
    expect(publishLog?.createdAt).toBeTruthy();

    // 3 删除草稿：审计记录（action=delete, resource=article:A2）
    const delRes = await request(env.app).delete('/api/articles/A2').set(bearer(session.token));
    expect(delRes.status).toBe(204);
    await pollUntil(() => countBy('delete'), (count) => count === 1, { timeoutMs: 3000, message: '删除审计未产生' });
    const deleteLog = listLogs().find((log) => log.actionType === 'delete');
    expect(deleteLog?.resourceType).toBe('article');
    expect(deleteLog?.resourceId).toBe('A2');

    // 4 保留策略 ≥90 天：注入 91 天前旧记录，prune(90 天前) 删除旧记录、保留近期记录
    const oldCreatedAt = new Date(Date.now() - 91 * DAY_MS).toISOString();
    env.stores.auditLogStore.append({
      id: 'AU_OLD',
      actionType: 'login',
      actorId: null,
      resourceType: 'user',
      resourceId: 'u_old',
      result: 'success',
      httpStatus: 200,
      clientIp: '1.1.1.1',
      requestId: 'req_old',
      createdAt: oldCreatedAt,
    });
    const recentCount = listLogs().filter((log) => log.id !== 'AU_OLD').length;
    const removed = env.stores.auditLogStore.prune(new Date(Date.now() - 90 * DAY_MS));
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(listLogs().filter((log) => log.id !== 'AU_OLD').length).toBe(recentCount);
  });
});

describe('ST-028 API 限流：认证接口超阈值 429、通用接口超阈值 429（横切集成，NFR-006）', () => {
  it('认证接口超限 42901；窗口重置后恢复；通用接口超限 429；计数按 key（IP+路径）隔离', async () => {
    // 场景 A：认证限流（窗口 600ms，limit=3）
    const envA = createTestEnv({ rateLimitAuth: { limit: 3, windowMs: 600 } });
    await register(envA.app, 'st28_user', 'st28@example.com');

    // 1 连续登录直至超限：前 3 次通过（200/401），第 4 次 429 + RATE_LIMITED
    for (let i = 0; i < 3; i += 1) {
      const res = await request(envA.app).post('/api/auth/login').send({ identifier: 'st28@example.com', password: 'Passw0rd!x' });
      expect([200, 401]).toContain(res.status);
    }
    const limited = await request(envA.app).post('/api/auth/login').send({ identifier: 'st28@example.com', password: 'Passw0rd!x' });
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe(42901);

    // 2 窗口重置后恢复（等待窗口过期）
    await new Promise((resolve) => setTimeout(resolve, 700));
    const recovered = await request(envA.app).post('/api/auth/login').send({ identifier: 'st28@example.com', password: 'Passw0rd!x' });
    expect([200, 401]).toContain(recovered.status);

    // 场景 B：通用限流（limit=3）
    const envB = createTestEnv({ rateLimitApi: { limit: 3, windowMs: 60000 } });
    for (let i = 0; i < 3; i += 1) {
      const res = await request(envB.app).get('/api/articles');
      expect(res.status).toBe(200);
    }
    const apiLimited = await request(envB.app).get('/api/articles');
    expect(apiLimited.status).toBe(429);
    expect(apiLimited.body.error.code).toBe(42901);

    // 3 计数键隔离（按 IP+路径独立计数）：打满 /api/articles 后，不同路径 /api/tags 正常响应
    const otherPath = await request(envB.app).get('/api/tags');
    expect(otherPath.status).toBe(200);
  });
});
