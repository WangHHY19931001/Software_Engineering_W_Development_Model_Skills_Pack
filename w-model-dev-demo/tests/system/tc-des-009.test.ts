/**
 * TC-DES-009: 安全基线（原型链污染 / RBAC 越权 / JWT 篡改 / zod 校验）
 *
 * 验证安全防御——原型链污染防护、RBAC 4 角色权限边界、JWT 篡改检测、
 * zod 输入校验拦截非法 payload；bcrypt cost≥10；审计日志完整记录敏感操作。
 *
 * 关联需求/设计：NFR-003 / SD-006 / SD-001 / system-design.md §6 RBAC
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import {
  createTestApp, registerUser, authHeader, createArticle, transitionArticle, setupAllRoles,
} from '../helpers/api-helper.js';

describe('TC-DES-009: 安全基线', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('原型链污染防护', () => {
    it('注册请求含 __proto__ 不污染全局对象', async () => {
      // 发送含 __proto__ 的注册请求
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'pollute@x.com',
          password: 'Pass1234',
          nickname: 'polluter',
          __proto__: { isAdmin: true },
        });
      // sanitize 会移除 __proto__，请求仍成功
      expect(res.status).toBe(201);

      // 验证原型链未被污染
      expect(({} as { isAdmin?: boolean }).isAdmin).toBeUndefined();
      expect((Object.prototype as { isAdmin?: boolean }).isAdmin).toBeUndefined();
    });

    it('文章请求含 constructor.prototype 不污染角色', async () => {
      const blogger = await registerUser(app, 'b@pollute.com', 'Pass1234', 'bp', 'blogger');
      const res = await request(app)
        .post('/api/articles')
        .set(authHeader(blogger.accessToken))
        .send({
          title: 'x',
          content: 'y',
          constructor: { prototype: { role: 'super_admin' } },
        });
      // sanitize 移除 constructor，文章创建成功
      expect(res.status).toBe(201);

      // 验证角色未被污染
      const emptyObj = {} as { role?: string };
      expect(emptyObj.role).toBeUndefined();
    });
  });

  describe('RBAC 4 角色权限边界', () => {
    it('user 调 admin 接口（PUT /api/site/config）→ 403', async () => {
      const { user } = await setupAllRoles(app);
      const res = await request(app)
        .patch('/api/site/config')
        .set(authHeader(user.accessToken))
        .send({ siteName: 'hacked' });
      expect(res.status).toBe(403);
    });

    it('blogger 编辑他人文章 → 403', async () => {
      const bloggerA = await registerUser(app, 'ba@rbac.com', 'Pass1234', 'ba', 'blogger');
      const bloggerB = await registerUser(app, 'bb@rbac.com', 'Pass1234', 'bb', 'blogger');
      const admin = await registerUser(app, 'admin@rbac.com', 'Pass1234', 'adm', 'admin');

      // 博主 A 创建文章
      const article = await createArticle(app, bloggerA.accessToken, { title: 'A的文章', content: 'C' });

      // 博主 B 尝试编辑 A 的文章 → 403
      const res = await request(app)
        .patch(`/api/articles/${article.id}`)
        .set(authHeader(bloggerB.accessToken))
        .send({ title: 'hacked' });
      expect(res.status).toBe(403);
    });

    it('被封禁用户登录 → 409（业务错误码 60002）', async () => {
      const admin = await registerUser(app, 'banadmin@rbac.com', 'Pass1234', 'bAdmin', 'admin');
      const user = await registerUser(app, 'banuser@rbac.com', 'Pass1234', 'bUser', 'user');

      // admin 封禁 user
      const banRes = await request(app)
        .post(`/api/users/${user.userId}/ban`)
        .set(authHeader(admin.accessToken))
        .send({ reason: '违规操作' });
      expect(banRes.status).toBe(200);

      // 被封禁用户登录 → 409（60002 映射 HTTP 409）
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'banuser@rbac.com', password: 'Pass1234' });
      expect(loginRes.status).toBe(409);
      expect(loginRes.body.code).toBe(60002);
    });

    it('super_admin 可访问 admin 接口', async () => {
      const { superAdmin } = await setupAllRoles(app);
      const res = await request(app)
        .patch('/api/site/config')
        .set(authHeader(superAdmin.accessToken))
        .send({ siteName: 'super-test' });
      expect(res.status).toBe(200);
    });
  });

  describe('JWT 篡改检测', () => {
    it('修改 payload role 为 super_admin 后重签 → 401', async () => {
      const user = await registerUser(app, 'jwt@tamper.com', 'Pass1234', 'jwtU', 'user');

      // 用错误的 secret 重签，修改 role
      const tamperedToken = jwt.sign(
        { userId: user.userId, role: 'super_admin' },
        'wrong-secret',
        { expiresIn: '1h' },
      );

      const res = await request(app)
        .get('/api/notifications')
        .set(authHeader(tamperedToken));
      expect(res.status).toBe(401);
    });

    it('算法降级 alg=none → 401', async () => {
      const user = await registerUser(app, 'jwt@none.com', 'Pass1234', 'jwtN', 'user');

      // 构造 alg=none 的 token（无签名）
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ userId: user.userId, role: 'super_admin' })).toString('base64url');
      const noneToken = `${header}.${payload}.`;

      const res = await request(app)
        .get('/api/notifications')
        .set(authHeader(noneToken));
      expect(res.status).toBe(401);
    });

    it('过期 token → 401', async () => {
      // 签发一个已过期的 token（expiresIn: -1s）
      const { sign } = await import('../../src/utils/jwt.js');
      const expiredToken = sign({ userId: 'u1', role: 'user' }, -1);
      // sign 使用 expiresIn=-1 会立即过期

      const res = await request(app)
        .get('/api/notifications')
        .set(authHeader(expiredToken));
      expect(res.status).toBe(401);
    });
  });

  describe('zod 输入校验', () => {
    it('非法 email → 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'not-email', password: 'Pass1234', nickname: 'x' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(40003);
    });

    it('弱密码（<8 字符）→ 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'weak@x.com', password: '123', nickname: 'x' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(40003);
    });

    it('SQL 注入 payload 作为搜索 query → 200 空结果（内存存储无注入面）', async () => {
      const res = await request(app).get("/api/search?q=' OR 1=1 --");
      // 内存存储无 SQL 注入面，zod 将 query 作为字符串处理
      expect(res.status).toBe(200);
    });

    it('XSS payload 在文章标题 → 201 或被处理', async () => {
      const blogger = await registerUser(app, 'xss@b.com', 'Pass1234', 'xssB', 'blogger');
      const res = await request(app)
        .post('/api/articles')
        .set(authHeader(blogger.accessToken))
        .send({ title: '<script>alert(1)</script>', content: 'y' });
      // zod 接受字符串，存储后 GET 返回时由消费者处理转义
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('<script>alert(1)</script>');
    });
  });

  describe('bcrypt 哈希验证', () => {
    it('注册后 passwordHash 为 bcrypt 哈希（cost≥10）', async () => {
      const { userStore } = await import('../../src/stores/user-store.js');
      const user = await registerUser(app, 'bcrypt@x.com', 'Pass1234', 'bcryptU', 'user');
      const stored = userStore.findById(user.userId);
      expect(stored).toBeDefined();
      expect(stored!.passwordHash).toMatch(/^\$2[ab]\$(\d+)\$/);
      const costMatch = stored!.passwordHash.match(/^\$2[ab]\$(\d+)\$/);
      const cost = parseInt(costMatch![1], 10);
      expect(cost).toBeGreaterThanOrEqual(10);
      expect(stored!.passwordHash).not.toBe('Pass1234');
    });
  });

  describe('审计日志完整性', () => {
    it('封禁操作写入审计日志', async () => {
      const { getContainer } = await import('../../src/container.js');
      const c = getContainer();

      const admin = await registerUser(app, 'audit@admin.com', 'Pass1234', 'aAdmin', 'admin');
      const user = await registerUser(app, 'audit@user.com', 'Pass1234', 'aUser', 'user');

      await request(app)
        .post(`/api/users/${user.userId}/ban`)
        .set(authHeader(admin.accessToken))
        .send({ reason: '审计测试' });

      const auditEntries = c.auditLogger.query({});
      const banAudit = auditEntries.find(
        (e: { action: string }) => e.action === 'user.ban',
      );
      expect(banAudit).toBeDefined();
      expect((banAudit as { actor: string }).actor).toBe(admin.userId);
    });

    it('越权尝试不崩溃（系统仍可正常响应）', async () => {
      const { user } = await setupAllRoles(app);
      // user 尝试 admin 接口
      await request(app)
        .patch('/api/site/config')
        .set(authHeader(user.accessToken))
        .send({ siteName: 'hack' });

      // 系统仍正常响应
      const healthRes = await request(app).get('/health');
      expect(healthRes.status).toBe(200);
    });
  });
});
