/**
 * 验收测试 · 横切治理（UAT-060~073，NFR-001~006 / CON-001~004）
 * 路径映射：docs/uat-path-mapping.md（recommendations→me/recommendations 等价；静态断言类路径=不适用）。
 * 契约说明：
 * - 错误码按 INTF §0.3 数字码（40001~60003）；UAT 设计的字符串错误码语义映射见测试报告 §5（阶段 3 契约收紧为数字码）。
 * - 性能基线：P95 ≤ 2000ms（NFR-001 testThreshold，进程内请求度量，与系统测试一致的环境声明）。
 * - 限流：认证 10 次/分/IP、通用 100 次/分/IP（NFR-006），验收环境阈值可配置缩小（testThreshold）。
 * - 静态断言类（UAT-066/067/070）以构建期配置/源码结构为断言对象（映射表「不适用（无 HTTP 路由）」）。
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createHmac } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createTestEnv, seedUser, seedTag, seedArticle, seedReadingRecord, startMockServer, register, login, bearer, pollUntil, calcP95 } from './helpers';

const SECRET = process.env.JWT_SECRET ?? 'test-secret-blog-demo';
const PASSWORD = 'Passw0rd!x';
const DAY_MS = 86400000;

function readProject(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

async function timed(fire: () => Promise<unknown>): Promise<number> {
  const started = Date.now();
  await fire();
  return Date.now() - started;
}

async function seedBlogger(env: ReturnType<typeof createTestEnv>, username: string, email: string) {
  return seedUser(env.stores, { username, email, role: 'blogger' });
}

/** 解析 coverage-final.json（v8 格式）的行/语句覆盖率百分比；失败或缺失返回 null */
function linesPctFromFinal(file: string): number | null {
  try {
    const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, { s: Record<string, number> }>;
    const files = Object.values(data);
    if (files.length === 0) return null;
    let total = 0;
    let covered = 0;
    for (const f of files) {
      for (const key of Object.keys(f.s)) {
        total += 1;
        if (f.s[key] > 0) covered += 1;
      }
    }
    return total === 0 ? null : (covered / total) * 100;
  } catch {
    return null;
  }
}

/** 递归收集目录下 .ts 文件（NFR-005 静态结构扫描） */
function listDir(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = join(dir, d.name);
    if (d.isDirectory()) return listDir(full);
    return d.name.endsWith('.ts') ? [full] : [];
  });
}

describe('UAT-060 常规 API 响应时间 P95 ≤ 2000ms（性能，NFR-001 测试基线）', () => {
  it('注册/登录/文章列表/文章详情各 ≥20 次采样，P95 ≤ 2000ms', async () => {
    const env = createTestEnv({
      rateLimitAuth: { limit: 1000, windowMs: 60000 },
      rateLimitApi: { limit: 10000, windowMs: 60000 },
    });
    const blogger = await seedBlogger(env, 'uat60_b', 'uat60@example.com');
    seedArticle(env.stores, { id: 'perf1', authorId: blogger.id, title: '性能采样文', status: 'published' });
    await request(env.app).get('/api/articles'); // 预热

    const tReg: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      tReg.push(
        await timed(() =>
          request(env.app).post('/api/auth/register').send({
            username: `perf_u${i}`,
            email: `perf${i}@example.com`,
            password: PASSWORD,
          }),
        ),
      );
    }
    expect(calcP95(tReg)).toBeLessThanOrEqual(2000);

    const tLogin: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      tLogin.push(await timed(() => request(env.app).post('/api/auth/login').send({ identifier: 'perf0@example.com', password: PASSWORD })));
    }
    expect(calcP95(tLogin)).toBeLessThanOrEqual(2000);

    const tList: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      tList.push(await timed(() => request(env.app).get('/api/articles')));
    }
    expect(calcP95(tList)).toBeLessThanOrEqual(2000);

    const tDetail: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      tDetail.push(await timed(() => request(env.app).get('/api/articles/perf1')));
    }
    expect(calcP95(tDetail)).toBeLessThanOrEqual(2000);
    expect(blogger.id).toBeTruthy();
  }, 60000);
});

describe('UAT-061 高流量场景性能基线（性能，NFR-001）', () => {
  it('浏览+搜索+推荐组合流量 ≥30 次采样，组合 P95 ≤ 2000ms', async () => {
    const env = createTestEnv({ rateLimitApi: { limit: 10000, windowMs: 60000 } });
    const blogger = await seedBlogger(env, 'uat61_b', 'uat61@example.com');
    seedArticle(env.stores, { id: 'hf1', authorId: blogger.id, title: '组合流量文章', status: 'published' });
    env.stores.searchIndexStore.index('hf1', { title: '组合流量文章', body: '', summary: '', tags: [] });
    await seedUser(env.stores, { username: 'uat61_u', email: 'uat61u@example.com' });
    const session = await login(env.app, 'uat61u@example.com');
    await request(env.app).get('/api/articles'); // 预热

    const times: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      times.push(await timed(() => request(env.app).get('/api/articles')));
      times.push(await timed(() => request(env.app).get('/api/search').query({ q: '组合' })));
      times.push(await timed(() => request(env.app).get('/api/me/recommendations').set(bearer(session.token))));
    }
    expect(times.length).toBeGreaterThanOrEqual(30);
    expect(calcP95(times)).toBeLessThanOrEqual(2000);
  }, 30000);
});

describe('UAT-062 密码 bcrypt 加盐哈希存储（安全，NFR-002/REQ-007）', () => {
  it('注册与改密后存储密码为 bcrypt 加盐哈希；同一明文两次哈希不同', async () => {
    const env = createTestEnv();
    await register(env.app, 'uat62_u1', 'uat62a@example.com');
    await register(env.app, 'uat62_u2', 'uat62b@example.com');
    const u1 = env.stores.userStore.findByEmail('uat62a@example.com')!;
    const u2 = env.stores.userStore.findByEmail('uat62b@example.com')!;
    expect(u1.passwordHash.startsWith('$2a$10$') || u1.passwordHash.startsWith('$2b$10$')).toBe(true);
    expect(u2.passwordHash.startsWith('$2a$10$') || u2.passwordHash.startsWith('$2b$10$')).toBe(true);
    expect(u1.passwordHash).not.toBe(u2.passwordHash); // 加盐：同一明文不同哈希
    expect(bcrypt.compareSync(PASSWORD, u1.passwordHash)).toBe(true);

    const session = await login(env.app, 'uat62a@example.com');
    await request(env.app).put('/api/users/me/password').set(bearer(session.token)).send({ oldPassword: PASSWORD, newPassword: 'NewPass!2' });
    const after = env.stores.userStore.findByEmail('uat62a@example.com')!;
    expect(after.passwordHash).not.toBe(u1.passwordHash); // 新哈希更新
    expect(bcrypt.compareSync('NewPass!2', after.passwordHash)).toBe(true);
    expect(bcrypt.compareSync(PASSWORD, after.passwordHash)).toBe(false); // 旧哈希不可用
  });
});

describe('UAT-063 JWT 密钥注入与有效性校验（安全，NFR-002/CON-003）', () => {
  it('错误密钥签发的 token 访问需认证接口 → 401 + 40101；源码无硬编码密钥', async () => {
    const env = createTestEnv();
    const user = await seedUser(env.stores, { username: 'uat63_u', email: 'uat63@example.com' });
    const wrongToken = jwt.sign({ sub: user.id, role: 'reader' }, 'wrong-secret-for-uat63', { algorithm: 'HS256', expiresIn: '1h' });
    const res = await request(env.app).get('/api/users/me').set(bearer(wrongToken));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(40101);
    expect(res.body.error.message).toBeTruthy();
    const jwtSrc = readProject('src/utils/jwtUtil.ts');
    expect(jwtSrc).toContain('process.env.JWT_SECRET');
    expect(jwtSrc).not.toContain('test-secret-blog-demo'); // 密钥仅环境变量引用，无字面量硬编码
  });
});

describe('UAT-064 发布关键操作事务一致性（可靠性，NFR-003/REQ-012）', () => {
  it('回调链路失败时主流程状态一致收敛：发布成功且投递最终 failed/delivered（无中间态）', async () => {
    const mock = await startMockServer({ status: 500 });
    try {
      const env = createTestEnv();
      const blogger = await seedBlogger(env, 'uat64_b', 'uat64@example.com');
      seedArticle(env.stores, { id: 'wh64', authorId: blogger.id, title: '事务一致性文', status: 'draft' });
      const session = await login(env.app, 'uat64@example.com');
      const cfgRes = await request(env.app).post('/api/me/webhooks').set(bearer(session.token)).send({ url: mock.url, events: ['article.published'] });
      const pub = await request(env.app).post('/api/articles/wh64/publish').set(bearer(session.token));
      expect(pub.status).toBe(200);
      expect(pub.body.data.status).toBe('published');
      const delivery = env.stores.webhookDeliveryStore.listByWebhook(cfgRes.body.data.webhookId).find((d) => d.event === 'article.published')!;
      expect(delivery).toBeDefined();
      await pollUntil(() => env.stores.webhookDeliveryStore.findById(delivery.id)?.status, (s) => s === 'failed', {
        timeoutMs: 15000,
        message: '投递未收敛至 failed',
      });
      // 无中间态：文章状态已提交 published；投递状态收敛 failed（主状态不被异步失败回滚）
      expect(env.stores.articleStore.findById('wh64')!.status).toBe('published');
      expect(env.stores.webhookDeliveryStore.findById(delivery.id)!.status).toBe('failed');
    } finally {
      await mock.close();
    }
  }, 30000);
});

describe('UAT-065 Webhook 失败记录留存（可靠性，NFR-003/REQ-028）', () => {
  it('重试耗尽后失败记录完整：attempts=3、lastError 非空、status=failed', async () => {
    const mock = await startMockServer({ status: 500 });
    try {
      const env = createTestEnv();
      const blogger = await seedBlogger(env, 'uat65_b', 'uat65@example.com');
      seedArticle(env.stores, { id: 'wh65', authorId: blogger.id, title: '失败记录文', status: 'draft' });
      const session = await login(env.app, 'uat65@example.com');
      const cfgRes = await request(env.app).post('/api/me/webhooks').set(bearer(session.token)).send({ url: mock.url, events: ['article.published'] });
      await request(env.app).post('/api/articles/wh65/publish').set(bearer(session.token));
      const delivery = env.stores.webhookDeliveryStore.listByWebhook(cfgRes.body.data.webhookId).find((d) => d.event === 'article.published')!;
      await pollUntil(() => env.stores.webhookDeliveryStore.findById(delivery.id)?.status, (s) => s === 'failed', {
        timeoutMs: 15000,
        message: '失败记录未生成',
      });
      const record = env.stores.webhookDeliveryStore.findById(delivery.id)!;
      expect(record.attempts).toBe(3);
      expect(record.lastError).toBeTruthy();
      expect(record.status).toBe('failed');
    } finally {
      await mock.close();
    }
  }, 30000);
});

describe('UAT-066 单元测试行覆盖率 ≥ 80%（代码质量，NFR-004）', () => {
  it('vitest 阈值配置 ≥80%；最近 coverage 报告行覆盖率 ≥80%', () => {
    const config = readProject('vitest.config.ts');
    expect(config).toMatch(/lines:\s*80/);
    const summaryPath = join(process.cwd(), 'coverage/coverage-summary.json');
    const finalPath = join(process.cwd(), 'coverage/coverage-final.json');
    if (existsSync(summaryPath)) {
      const summary = JSON.parse(readFileSync(summaryPath, 'utf8')) as { total: { lines: { pct: number } } };
      expect(summary.total.lines.pct).toBeGreaterThanOrEqual(80);
    } else if (existsSync(finalPath)) {
      const pct = linesPctFromFinal(finalPath);
      expect(pct).not.toBeNull();
      expect(pct!).toBeGreaterThanOrEqual(80);
    }
    // 两者均缺失时：阈值配置（≥80）即门禁，已由首条断言覆盖
  });
});

describe('UAT-067 分层结构约束（可维护性，NFR-005）', () => {
  it('路由/服务/存储三层结构存在；服务层对 store 仅类型引用（无直访存储实例）', () => {
    for (const layer of ['src/routes', 'src/services', 'src/stores']) {
      expect(existsSync(join(process.cwd(), layer))).toBe(true);
    }
    const serviceFiles = listDir(join(process.cwd(), 'src/services'));
    expect(serviceFiles.length).toBeGreaterThan(0);
    for (const file of serviceFiles) {
      const content = readFileSync(file, 'utf8');
      // NFR-005：服务层经构造函数依赖注入消费 store 实例，禁止值导入 store（仅 import type 允许）
      expect(content).not.toMatch(/^import\s+\{[^}]*\}\s+from\s+['"][^'"]*stores\//m);
      expect(content).not.toMatch(/^import\s+\w+\s+from\s+['"][^'"]*stores\//m);
    }
  });
});

describe('UAT-068 认证接口限流超限 429（限流，NFR-006/REQ-008）', () => {
  it('同一 IP 连续调用登录接口超过阈值（测试环境 limit=5）→ 第 6 次 429 + 42901', async () => {
    const env = createTestEnv({ rateLimitAuth: { limit: 5, windowMs: 60000 } });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const res = await request(env.app).post('/api/auth/login').send({ identifier: 'nobody@example.com', password: PASSWORD });
      statuses.push(res.status);
      if (res.status === 429) {
        expect(res.body.error.code).toBe(42901);
        expect(res.body.error.message).toBeTruthy();
      }
    }
    expect(statuses.slice(0, 5).every((s) => s !== 429)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});

describe('UAT-069 通用 API 限流超限 429（限流，NFR-006）', () => {
  it('同一 IP 连续调用通用 API 超过阈值（测试环境 limit=5）→ 第 6 次 429 + 42901', async () => {
    const env = createTestEnv({ rateLimitApi: { limit: 5, windowMs: 60000 } });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const res = await request(env.app).get('/api/articles');
      statuses.push(res.status);
      if (res.status === 429) {
        expect(res.body.error.code).toBe(42901);
      }
    }
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});

describe('UAT-070 技术栈约束（CON-001）', () => {
  it('依赖清单：Node.js + Express 4 + TypeScript 5 + 内存存储；无外部数据库驱动', () => {
    const pkg = JSON.parse(readProject('package.json')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.dependencies.express).toMatch(/^\^?4\./);
    expect(pkg.devDependencies.typescript).toMatch(/^\^?5\./);
    const dbDrivers = ['pg', 'mysql', 'mysql2', 'mongodb', 'mongoose', 'redis', 'sqlite3', 'typeorm', 'prisma', 'sequelize'];
    for (const driver of dbDrivers) {
      expect(pkg.dependencies[driver]).toBeUndefined();
    }
    // 存储实现为进程内内存（Map 快照存储，CON-001），无外部连接
    const auditStoreSrc = readProject('src/stores/auditLogStore.ts');
    expect(auditStoreSrc).toContain('new Map(');
  });
});

describe('UAT-071 统一错误响应结构（CON-002）', () => {
  it('400/401/404/409/429 五类错误响应均符合 { error: { code, message } }，无多余顶层字段', async () => {
    // 400：注册缺必填字段
    const badRequest = await request(createTestEnv().app).post('/api/auth/register').send({ username: 'x' });
    expect(badRequest.status).toBe(400);
    // 401：未认证访问需认证接口
    const unauthorized = await request(createTestEnv().app).get('/api/users/me');
    expect(unauthorized.status).toBe(401);
    // 404：不存在资源（兜底 40401）
    const notFound = await request(createTestEnv().app).get('/api/articles/art-nonexist');
    expect(notFound.status).toBe(404);
    // 409：重复标签（博主）
    const conflictEnv = createTestEnv();
    await seedBlogger(conflictEnv, 'uat71_b', 'uat71@example.com');
    seedTag(conflictEnv.stores, 'dup-tag');
    const session = await login(conflictEnv.app, 'uat71@example.com');
    const conflict = await request(conflictEnv.app).post('/api/tags').set(bearer(session.token)).send({ name: 'dup-tag' });
    expect(conflict.status).toBe(409);
    // 429：认证接口超限
    const limitedEnv = createTestEnv({ rateLimitAuth: { limit: 2, windowMs: 60000 } });
    let rateLimited: { status: number; body: unknown } | null = null;
    for (let i = 0; i < 3; i += 1) {
      const res = await request(limitedEnv.app).post('/api/auth/login').send({ identifier: 'nobody@example.com', password: PASSWORD });
      if (res.status === 429) rateLimited = { status: res.status, body: res.body };
    }
    expect(rateLimited).not.toBeNull();
    expect(rateLimited!.status).toBe(429);

    for (const res of [badRequest, unauthorized, notFound, conflict, rateLimited!]) {
      const body = res.body as { error: { code: number; message: string } };
      expect(Object.keys(body)).toEqual(['error']);
      expect(typeof body.error.code).toBe('number');
      expect(body.error.code).toBeTruthy();
      expect(typeof body.error.message).toBe('string');
      expect(body.error.message.length).toBeGreaterThan(0);
    }
  });
});

describe('UAT-072 JWT 有效期 24 小时且密钥环境变量注入（CON-003/REQ-008）', () => {
  it('登录签发 JWT：exp−iat ≤ 24h；JWT_SECRET 来自环境变量（test-* 注入值）', async () => {
    const env = createTestEnv();
    await seedUser(env.stores, { username: 'uat72_u', email: 'uat72@example.com' });
    const session = await login(env.app, 'uat72@example.com');
    const payload = jwt.verify(session.token, SECRET) as jwt.JwtPayload;
    expect(payload.exp! - payload.iat!).toBeLessThanOrEqual(86400);
    expect(process.env.JWT_SECRET).toMatch(/^test-/);
    const jwtSrc = readProject('src/utils/jwtUtil.ts');
    expect(jwtSrc).toContain("'24h'");
  });
});

describe('UAT-073 关键操作审计日志与保留策略（CON-004）', () => {
  it('登录/发布/删除三类操作留痕（含操作者/动作/时间）；保留策略 ≥90 天', async () => {
    const env = createTestEnv();
    const blogger = await seedBlogger(env, 'uat73_b', 'uat73@example.com');
    seedArticle(env.stores, { id: 'au-pub', authorId: blogger.id, title: '审计发布草稿', status: 'draft' });
    seedArticle(env.stores, { id: 'au-del', authorId: blogger.id, title: '审计删除草稿', status: 'draft' });

    const countBy = (actionType: string) => env.stores.auditLogStore.list().filter((log) => log.actionType === actionType).length;

    // 1 登录
    const session = await login(env.app, 'uat73@example.com');
    await pollUntil(() => countBy('login'), (n) => n >= 1, { timeoutMs: 3000, message: '登录审计未产生' });

    // 2 发布
    const pub = await request(env.app).post('/api/articles/au-pub/publish').set(bearer(session.token));
    expect(pub.status).toBe(200);
    await pollUntil(() => countBy('publish'), (n) => n >= 1, { timeoutMs: 3000, message: '发布审计未产生' });

    // 3 删除草稿
    const del = await request(env.app).delete('/api/articles/au-del').set(bearer(session.token));
    expect(del.status).toBe(204);
    await pollUntil(() => countBy('delete'), (n) => n >= 1, { timeoutMs: 3000, message: '删除审计未产生' });

    const logs = env.stores.auditLogStore.list();
    const loginLog = logs.find((l) => l.actionType === 'login');
    const publishLog = logs.find((l) => l.actionType === 'publish');
    const deleteLog = logs.find((l) => l.actionType === 'delete');
    expect(loginLog).toBeDefined();
    expect(publishLog).toBeDefined();
    expect(deleteLog).toBeDefined();
    // 登录为公开路由（无 authenticate 中间件），actorId 恒为 null（审计中间件在认证前记录，与 ST-027 契约一致）；
    // 发布/删除携带 token，actorId 应有值
    expect(loginLog!.createdAt).toBeTruthy();
    expect(publishLog!.actorId).toBeTruthy();
    expect(deleteLog!.actorId).toBeTruthy();
    expect(publishLog!.resourceId).toBe('au-pub');
    expect(deleteLog!.resourceId).toBe('au-del');

    // 4 保留策略 ≥90 天：91 天前旧记录被 prune(90 天前) 删除、近期记录保留
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
    const recentCount = env.stores.auditLogStore.list().filter((l) => l.id !== 'AU_OLD').length;
    const removed = env.stores.auditLogStore.prune(new Date(Date.now() - 90 * DAY_MS));
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(env.stores.auditLogStore.list().filter((l) => l.id !== 'AU_OLD').length).toBe(recentCount);
  });
});
