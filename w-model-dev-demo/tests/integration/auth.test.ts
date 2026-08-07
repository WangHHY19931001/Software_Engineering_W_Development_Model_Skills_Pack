/**
 * 集成测试 · 身份域（INTF-001~003，CON-003）
 * IT-001 注册→登录→申请博主 身份链路 + 邮箱唯一 409 + 错误凭据 401
 * IT-002 登录限流：同一 IP 第 11 次认证请求返回 429（NFR-006）
 * IT-028 令牌过期 40102 → 重新登录恢复（CON-003）
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestEnv, register, login, seedUser, bearer } from './helpers';

const SECRET = process.env.JWT_SECRET ?? 'test-secret-blog-demo';

describe('IT-001 注册→登录→申请博主 身份链路（跨模块）+ 邮箱唯一 409 + 错误凭据 401', () => {
  it('注册成功 → 重复邮箱 40901 → 登录 JWT（exp−iat≤24h）→ 错误密码 40101 → 申请博主 reader→blogger（幂等）', async () => {
    const { app } = createTestEnv();

    // 1 注册读者：201 + role=reader + 响应无 password 字段
    const regRes = await request(app).post('/api/auth/register').send({
      username: 'it1_reader',
      email: 'it1@example.com',
      password: 'Passw0rd!x',
    });
    expect(regRes.status).toBe(201);
    expect(regRes.body.code).toBe(0);
    expect(regRes.body.data.role).toBe('reader');
    expect(regRes.body.data.password).toBeUndefined();

    // 2 重复邮箱注册：409 + error.code=40901
    const dupRes = await request(app).post('/api/auth/register').send({
      username: 'it1_reader2',
      email: 'it1@example.com',
      password: 'Passw0rd!y',
    });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.code).toBe(40901);

    // 3 登录成功：200 + token 可解析，exp−iat ≤ 86400（CON-003）
    const loginRes = await request(app).post('/api/auth/login').send({
      identifier: 'it1@example.com',
      password: 'Passw0rd!x',
    });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.data.token;
    expect(typeof token).toBe('string');
    const payload = jwt.decode(token) as { exp: number; iat: number };
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(86400);

    // 4 错误密码登录：401 + error.code=40101（防枚举）
    const wrongRes = await request(app).post('/api/auth/login').send({
      identifier: 'it1@example.com',
      password: 'WrongPass0!',
    });
    expect(wrongRes.status).toBe(401);
    expect(wrongRes.body.error.code).toBe(40101);

    // 5 申请博主：200 + role=blogger（reader→blogger 角色变更）
    const applyRes = await request(app)
      .post('/api/users/me/blogger')
      .set(bearer(token));
    expect(applyRes.status).toBe(200);
    expect(applyRes.body.data.role).toBe('blogger');

    // 6 重复申请博主：200（幂等，不报错）
    const applyAgainRes = await request(app)
      .post('/api/users/me/blogger')
      .set(bearer(token));
    expect(applyAgainRes.status).toBe(200);
    expect(applyAgainRes.body.data.role).toBe('blogger');
  });
});

describe('IT-002 登录限流：同一 IP 第 11 次认证请求返回 429', () => {
  it('前 10 次登录 200，第 11 次 429 + error.code=42901（NFR-006）', async () => {
    const { app } = createTestEnv();
    await register(app, 'it2_reader', 'it2@example.com', 'Passw0rd!x');

    // 1 连续登录 10 次（正确凭据）：均 200
    for (let i = 0; i < 10; i += 1) {
      const res = await request(app).post('/api/auth/login').send({
        identifier: 'it2@example.com',
        password: 'Passw0rd!x',
      });
      expect(res.status).toBe(200);
    }

    // 2 第 11 次登录：429 + error.code=42901
    const eleventh = await request(app).post('/api/auth/login').send({
      identifier: 'it2@example.com',
      password: 'Passw0rd!x',
    });
    expect(eleventh.status).toBe(429);
    expect(eleventh.body.error.code).toBe(42901);
  });
});

describe('IT-028 令牌过期 40102 → 重新登录恢复（CON-003）', () => {
  it('过期 JWT 访问受保护接口 40102；重新登录新 JWT 恢复正常', async () => {
    const env = createTestEnv();

    // 预置博主（seam-STORE）
    const blogger = await seedUser(env.stores, {
      username: 'it28_blogger',
      email: 'it28@example.com',
      role: 'blogger',
    });

    // 1 过期 token（exp 已过，CON-003 24h 语义）
    const nowSec = Math.floor(Date.now() / 1000);
    const expiredToken = jwt.sign(
      { sub: blogger.id, role: 'blogger', iat: nowSec - 72000, exp: nowSec - 100 },
      SECRET,
      { algorithm: 'HS256' },
    );
    const expiredRes = await request(env.app)
      .post('/api/articles')
      .set(bearer(expiredToken))
      .send({ title: '过期令牌文', body: '正文' });
    expect(expiredRes.status).toBe(401);
    expect(expiredRes.body.error.code).toBe(40102);

    // 2 重新登录：200 + 新 token
    const relogin = await login(env.app, 'it28@example.com', 'Passw0rd!x');
    expect(relogin.role).toBe('blogger');

    // 3 新 token 重试创建文章：201（恢复正常）
    const okRes = await request(env.app)
      .post('/api/articles')
      .set(bearer(relogin.token))
      .send({ title: '恢复后的文章', body: '正文内容' });
    expect(okRes.status).toBe(201);
    expect(okRes.body.data.status).toBe('draft');
  });
});
