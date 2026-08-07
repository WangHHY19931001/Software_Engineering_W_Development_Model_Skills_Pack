/**
 * 验收测试 · 身份域（UAT-001~012，REQ-007~010 / NFR-002 / CON-003）
 * 路径映射：docs/uat-path-mapping.md（阶段 5 回填，映射类型=直接/等价）。
 * 契约说明：错误码按接口设计 §0.3 数字码（40001/40101/40102/40301/40901/60002），
 * 登录参数 identifier（INTF-002），JWT 角色快照（申请博主后须重新登录获取 blogger JWT，ST-001 备注）。
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestEnv, seedUser, register, login, bearer } from './helpers';

const SECRET = process.env.JWT_SECRET ?? 'test-secret-blog-demo';
const PASSWORD = 'Passw0rd!x';

describe('UAT-001 读者注册账号成功（正常路径，REQ-007）', () => {
  it('注册 201 + 用户对象（id/username/email，无密码字段）；存储为 bcrypt 哈希', async () => {
    const env = createTestEnv();
    const res = await request(env.app).post('/api/auth/register').send({
      username: 'reader01',
      email: 'test-reader@example.com',
      password: PASSWORD,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.userId).toBeTruthy();
    expect(res.body.data.username).toBe('reader01');
    expect(res.body.data.email).toBe('test-reader@example.com');
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.passwordHash).toBeUndefined();
    const stored = env.stores.userStore.findByEmail('test-reader@example.com');
    expect(stored).toBeDefined();
    expect(stored!.passwordHash).not.toBe(PASSWORD);
    expect(stored!.passwordHash.startsWith('$2a$10$') || stored!.passwordHash.startsWith('$2b$10$')).toBe(true);
  });
});

describe('UAT-002 重复邮箱注册被拒（异常路径，REQ-007）', () => {
  it('已占用邮箱再次注册 409 + 40901；不产生新用户', async () => {
    const env = createTestEnv();
    await seedUser(env.stores, { username: 'dup_owner', email: 'dup@example.com' });
    const before = env.stores.userStore.findAll().length;
    const res = await request(env.app).post('/api/auth/register').send({
      username: 'reader02',
      email: 'dup@example.com',
      password: PASSWORD,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe(40901);
    expect(res.body.error.message).toBeTruthy();
    expect(env.stores.userStore.findAll().length).toBe(before);
  });
});

describe('UAT-003 注册缺必填字段/弱密码被拒（边界路径，REQ-007）', () => {
  it('缺密码 / 弱密码均 400（统一校验错误码），无用户创建', async () => {
    const env = createTestEnv();
    const missing = await request(env.app).post('/api/auth/register').send({
      username: 'reader03',
      email: 'r3@example.com',
    });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe(40001);
    const weak = await request(env.app).post('/api/auth/register').send({
      username: 'reader03',
      email: 'r3@example.com',
      password: '123',
    });
    expect(weak.status).toBe(400);
    expect([40001, 40002]).toContain(weak.body.error.code);
    expect(weak.body.error.message).toBeTruthy();
    expect(env.stores.userStore.findAll().length).toBe(0);
  });
});

describe('UAT-004 邮箱/用户名+密码登录签发 JWT（正常路径，REQ-008）', () => {
  it('邮箱与用户名两种账号形式登录成功，签发合法 JWT（含 exp）', async () => {
    const env = createTestEnv();
    await seedUser(env.stores, { username: 'login01', email: 'login@example.com' });
    const byEmail = await request(env.app).post('/api/auth/login').send({ identifier: 'login@example.com', password: PASSWORD });
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.data.token).toBeTruthy();
    expect(byEmail.body.data.user.userId).toBeTruthy();
    const byName = await request(env.app).post('/api/auth/login').send({ identifier: 'login01', password: PASSWORD });
    expect(byName.status).toBe(200);
    const payload = jwt.verify(byEmail.body.data.token as string, SECRET) as jwt.JwtPayload;
    expect(payload.exp).toBeTruthy();
    expect(payload.exp! - payload.iat!).toBeLessThanOrEqual(86400);
  });
});

describe('UAT-005 错误凭据登录失败（异常路径，REQ-008）', () => {
  it('错误密码/不存在账号均 401 + 40101，无 token 返回', async () => {
    const env = createTestEnv();
    await seedUser(env.stores, { username: 'login05', email: 'login05@example.com' });
    const wrongPass = await request(env.app).post('/api/auth/login').send({ identifier: 'login05@example.com', password: 'WrongPass!1' });
    expect(wrongPass.status).toBe(401);
    expect(wrongPass.body.error.code).toBe(40101);
    expect(wrongPass.body.data).toBeUndefined();
    const noUser = await request(env.app).post('/api/auth/login').send({ identifier: 'nobody@example.com', password: PASSWORD });
    expect(noUser.status).toBe(401);
    expect(noUser.body.error.code).toBe(40101);
  });
});

describe('UAT-006 过期 token 访问需认证接口被拒（边界路径，REQ-008/CON-003，禁止行为 #12 合规）', () => {
  it('携带过期 JWT 访问需认证接口 GET /api/users/me → 401 + 40102', async () => {
    const env = createTestEnv();
    const user = await seedUser(env.stores, { username: 'uat06_user', email: 'uat06@example.com' });
    const nowSec = Math.floor(Date.now() / 1000);
    const expiredToken = jwt.sign(
      { sub: user.id, role: 'reader', iat: nowSec - 72000, exp: nowSec - 100 },
      SECRET,
      { algorithm: 'HS256' },
    );
    const res = await request(env.app).get('/api/users/me').set(bearer(expiredToken));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(40102);
    expect(res.body.error.message).toBeTruthy();
  });
});

describe('UAT-007 注册用户申请成为博主成功（正常路径，REQ-009）', () => {
  it('申请博主 200 + role=blogger；重新登录后具备发布权限（创建文章 201）', async () => {
    const env = createTestEnv();
    const userId = await register(env.app, 'reader07', 'uat07@example.com');
    const session = await login(env.app, 'uat07@example.com');
    const apply = await request(env.app).post('/api/users/me/blogger').set(bearer(session.token));
    expect(apply.status).toBe(200);
    expect(apply.body.data.role).toBe('blogger');
    // JWT 角色快照契约：申请后须重新登录获取 blogger 角色 JWT
    const reSession = await login(env.app, 'uat07@example.com');
    expect(reSession.role).toBe('blogger');
    const me = await request(env.app).get('/api/users/me').set(bearer(reSession.token));
    expect(me.body.data.role).toBe('blogger');
    const create = await request(env.app)
      .post('/api/articles')
      .set(bearer(reSession.token))
      .send({ title: '博主新文章', body: '正文' });
    expect(create.status).toBe(201);
    expect(userId).toBeTruthy();
  });
});

describe('UAT-008 普通读者创建文章被拒（异常路径，REQ-009/REQ-011）', () => {
  it('非博主创建文章 403 + 40301，文章未创建', async () => {
    const env = createTestEnv();
    await seedUser(env.stores, { username: 'uat08_reader', email: 'uat08@example.com' });
    const session = await login(env.app, 'uat08@example.com');
    const res = await request(env.app).post('/api/articles').set(bearer(session.token)).send({ title: 't', body: 'c' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(40301);
    expect(env.stores.articleStore.findAll().length).toBe(0);
  });
});

describe('UAT-009 博主越权管理他人文章被拒（异常路径，REQ-009/REQ-014）', () => {
  it('博主 A 编辑/删除博主 B 的文章均 403；B 的文章未被修改', async () => {
    const env = createTestEnv();
    const bloggerA = await seedUser(env.stores, { username: 'uat09_a', email: 'uat09a@example.com', role: 'blogger' });
    const bloggerB = await seedUser(env.stores, { username: 'uat09_b', email: 'uat09b@example.com', role: 'blogger' });
    env.stores.articleStore.create({
      id: 'art-b1',
      authorId: bloggerB.id,
      title: 'B 的草稿',
      body: '正文',
      summary: '',
      categoryId: null,
      status: 'draft',
      tags: [],
      publishedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const sessionA = await login(env.app, 'uat09a@example.com');
    const edit = await request(env.app).put('/api/articles/art-b1').set(bearer(sessionA.token)).send({ title: 'hacked' });
    expect(edit.status).toBe(403);
    expect(edit.body.error.code).toBe(40301);
    const del = await request(env.app).delete('/api/articles/art-b1').set(bearer(sessionA.token));
    expect(del.status).toBe(403);
    expect(env.stores.articleStore.findById('art-b1')!.title).toBe('B 的草稿');
  });
});

describe('UAT-010 查看与修改自己的资料（正常路径，REQ-010）', () => {
  it('GET /api/users/me 返回资料字段；PATCH 修改后持久化', async () => {
    const env = createTestEnv();
    await seedUser(env.stores, { username: 'uat10_user', email: 'uat10@example.com' });
    const session = await login(env.app, 'uat10@example.com');
    const before = await request(env.app).get('/api/users/me').set(bearer(session.token));
    expect(before.status).toBe(200);
    expect(before.body.data).toHaveProperty('nickname');
    expect(before.body.data).toHaveProperty('bio');
    expect(before.body.data).toHaveProperty('avatarUrl');
    const patch = await request(env.app)
      .patch('/api/users/me')
      .set(bearer(session.token))
      .send({ nickname: '新昵称', bio: '新简介', avatarUrl: 'https://img.example.com/a.png' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.nickname).toBe('新昵称');
    const after = await request(env.app).get('/api/users/me').set(bearer(session.token));
    expect(after.body.data.bio).toBe('新简介');
    expect(after.body.data.avatarUrl).toBe('https://img.example.com/a.png');
  });
});

describe('UAT-011 修改密码校验原密码（异常路径，REQ-010）', () => {
  it('原密码错误 400 + 60002；正确后修改成功且旧密码失效', async () => {
    const env = createTestEnv();
    await seedUser(env.stores, { username: 'uat11_user', email: 'uat11@example.com' });
    const session = await login(env.app, 'uat11@example.com');
    const wrongOld = await request(env.app)
      .put('/api/users/me/password')
      .set(bearer(session.token))
      .send({ oldPassword: 'WrongPass!1', newPassword: 'NewPass!2' });
    expect(wrongOld.status).toBe(400);
    expect(wrongOld.body.error.code).toBe(60002);
    const ok = await request(env.app)
      .put('/api/users/me/password')
      .set(bearer(session.token))
      .send({ oldPassword: PASSWORD, newPassword: 'NewPass!2' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.updated).toBe(true);
    const oldLogin = await request(env.app).post('/api/auth/login').send({ identifier: 'uat11@example.com', password: PASSWORD });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(env.app).post('/api/auth/login').send({ identifier: 'uat11@example.com', password: 'NewPass!2' });
    expect(newLogin.status).toBe(200);
  });
});

describe('UAT-012 未认证访问资料接口被拒（异常路径，REQ-010/NFR-002）', () => {
  it('无 token 访问需认证接口 GET /api/users/me → 401 + 40101', async () => {
    const env = createTestEnv();
    const res = await request(env.app).get('/api/users/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(40101);
    expect(res.body.error.message).toBeTruthy();
  });
});
