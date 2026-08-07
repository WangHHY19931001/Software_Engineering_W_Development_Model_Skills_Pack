/**
 * 系统测试 · 认证与内容跨模块集成（ST-006~010）
 * ST-006 登录签发 JWT + 受保护资源 + 错误凭据 401
 * ST-007 角色越权检测（读者发文 403 / 博主管理他人文章 403）——阶段 7 禁止行为 #7 强制项
 * ST-008 状态机合法流转 draft→published→archived→unarchive→draft→publish
 * ST-009 状态机非法流转（archived→published 直跳 / 已发布删除）
 * ST-010 草稿删除 204 + 编辑已发布后重新发布生效
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestEnv, seedUser, seedTag, seedCategory, seedArticle, login, bearer } from './helpers';

const SECRET = process.env.JWT_SECRET ?? 'test-secret-blog-demo';

describe('ST-006 登录签发 JWT + 受保护资源访问 + 错误凭据拒绝（跨模块集成，REQ-008）', () => {
  it('邮箱/用户名登录均签发 24h JWT；Bearer 访问受保护接口；错误密码 401/AUTH_INVALID_CREDENTIALS', async () => {
    const env = createTestEnv();
    await seedUser(env.stores, { username: 'login_user', email: 'login@example.com', password: 'Passw0rd!x' });

    // 1 邮箱+密码登录：200 + JWT
    const byEmail = await request(env.app).post('/api/auth/login').send({ identifier: 'login@example.com', password: 'Passw0rd!x' });
    expect(byEmail.status).toBe(200);
    const tokenByEmail = byEmail.body.data.token as string;

    // 2 用户名+密码登录：200 + JWT
    const byName = await request(env.app).post('/api/auth/login').send({ identifier: 'login_user', password: 'Passw0rd!x' });
    expect(byName.status).toBe(200);
    const tokenByUser = byName.body.data.token as string;

    // JWT 载荷：exp−iat ≤ 24h（CON-003）
    const payload = jwt.decode(tokenByEmail) as { exp: number; iat: number };
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(86400);

    // 3 携带 JWT 访问受保护资源（GET /api/users/me）：200 + 当前用户资料
    const me = await request(env.app).get('/api/users/me').set(bearer(tokenByUser));
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe('login@example.com');

    // 4 错误密码登录：401 + 40101（防枚举，AUTH_INVALID_CREDENTIALS 语义）
    const wrong = await request(env.app).post('/api/auth/login').send({ identifier: 'login@example.com', password: 'wrongpass1' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe(40101);
  });
});

describe('ST-007 角色越权检测：读者发文章 403、博主管理他人文章 403（跨模块集成，REQ-009/011/014）', () => {
  it('读者发文 40301；博主 B 编辑/删除博主 A 文章 40301；本人编辑放行', async () => {
    const env = createTestEnv();
    const bloggerA = await seedUser(env.stores, { username: 'st7_blogger_a', email: 'st7a@example.com', role: 'blogger' });
    await seedUser(env.stores, { username: 'st7_blogger_b', email: 'st7b@example.com', role: 'blogger' });
    await seedUser(env.stores, { username: 'st7_reader', email: 'st7r@example.com' });
    seedArticle(env.stores, { id: 'A1', authorId: bloggerA.id, title: '博主A的文章', body: '原文' });

    const sessionA = await login(env.app, 'st7a@example.com');
    const sessionB = await login(env.app, 'st7b@example.com');
    const sessionReader = await login(env.app, 'st7r@example.com');

    // 1 读者创建文章：403 + 40301
    const readerCreate = await request(env.app)
      .post('/api/articles')
      .set(bearer(sessionReader.token))
      .send({ title: '读者越权发文', body: '正文' });
    expect(readerCreate.status).toBe(403);
    expect(readerCreate.body.error.code).toBe(40301);

    // 2 博主 B 编辑 A 的文章 a1：403 + 40301（资源归属校验）
    const editByB = await request(env.app)
      .put('/api/articles/A1')
      .set(bearer(sessionB.token))
      .send({ title: '篡改标题' });
    expect(editByB.status).toBe(403);
    expect(editByB.body.error.code).toBe(40301);

    // 3 博主 B 删除 A 的文章 a1：403 + 40301
    const delByB = await request(env.app).delete('/api/articles/A1').set(bearer(sessionB.token));
    expect(delByB.status).toBe(403);
    expect(delByB.body.error.code).toBe(40301);

    // 4 博主 A 编辑自己的文章：200 + 编辑成功（对照组）
    const editByA = await request(env.app)
      .put('/api/articles/A1')
      .set(bearer(sessionA.token))
      .send({ title: '本人编辑' });
    expect(editByA.status).toBe(200);
    expect(editByA.body.data.title).toBe('本人编辑');
  });
});

describe('ST-008 文章状态机合法流转 draft→published→archived（跨模块集成，REQ-012/013）', () => {
  it('发布→归档（读者 404 不可见）→取消归档回 draft→重新发布；每步状态与可见性同步', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st8_blogger', email: 'st8b@example.com', role: 'blogger' });
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '状态机合法流转文章', status: 'draft' });
    const session = await login(env.app, 'st8b@example.com');

    // 1 发布草稿：200 + status=published
    const pub = await request(env.app).post('/api/articles/A1/publish').set(bearer(session.token));
    expect(pub.status).toBe(200);
    expect(pub.body.data.status).toBe('published');

    // 2 归档：200 + status=archived
    const arch = await request(env.app).post('/api/articles/A1/archive').set(bearer(session.token));
    expect(arch.status).toBe(200);
    expect(arch.body.data.status).toBe('archived');

    // 3 读者访问归档文章：404（读者不可见，40402 防枚举）
    const readerDetail = await request(env.app).get('/api/articles/A1');
    expect(readerDetail.status).toBe(404);
    expect(readerDetail.body.error.code).toBe(40402);

    // 4 取消归档：200 + status=draft
    const unarch = await request(env.app).post('/api/articles/A1/unarchive').set(bearer(session.token));
    expect(unarch.status).toBe(200);
    expect(unarch.body.data.status).toBe('draft');

    // 5 重新发布：200 + status=published
    const repub = await request(env.app).post('/api/articles/A1/publish').set(bearer(session.token));
    expect(repub.status).toBe(200);
    expect(repub.body.data.status).toBe('published');
  });
});

describe('ST-009 状态机非法流转：archived→published 直跳、已发布删除（跨模块集成，REQ-013）', () => {
  it('归档文章直接发布 60001；删除已发布 60001（仅可归档）；归档作为替代删除路径成立', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st9_blogger', email: 'st9b@example.com', role: 'blogger' });
    seedArticle(env.stores, { id: 'AR1', authorId: blogger.id, title: '归档文章', status: 'archived' });
    seedArticle(env.stores, { id: 'P1', authorId: blogger.id, title: '已发布文章', status: 'published' });
    const session = await login(env.app, 'st9b@example.com');

    // 1 对归档文章直接发布：409 + 60001（须先取消归档）
    const pubArchived = await request(env.app).post('/api/articles/AR1/publish').set(bearer(session.token));
    expect(pubArchived.status).toBe(409);
    expect(pubArchived.body.error.code).toBe(60001);

    // 2 删除已发布文章：409 + 60001（仅可归档）
    const delPublished = await request(env.app).delete('/api/articles/P1').set(bearer(session.token));
    expect(delPublished.status).toBe(409);
    expect(delPublished.body.error.code).toBe(60001);

    // 3 归档已发布文章：200 + status=archived（替代删除路径成立）
    const arch = await request(env.app).post('/api/articles/P1/archive').set(bearer(session.token));
    expect(arch.status).toBe(200);
    expect(arch.body.data.status).toBe('archived');
  });
});

describe('ST-010 草稿删除 204 + 编辑草稿后重新发布生效（跨模块集成，REQ-012/014）', () => {
  it('本人文章列表分页正确；编辑已发布文章后重新发布读者读到最新内容；删除草稿 204', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st10_blogger', email: 'st10b@example.com', role: 'blogger' });
    seedArticle(env.stores, { id: 'D1', authorId: blogger.id, title: '草稿D1', status: 'draft' });
    seedArticle(env.stores, { id: 'P1', authorId: blogger.id, title: '已发布v1', body: 'v1 正文', status: 'published' });
    const session = await login(env.app, 'st10b@example.com');

    // 1 查看自己文章列表：200 + 含草稿与已发布（分页正确）
    const list = await request(env.app).get('/api/blogger/articles').set(bearer(session.token));
    expect(list.status).toBe(200);
    const ids = list.body.data.items.map((i: { articleId: string }) => i.articleId);
    expect(ids).toEqual(expect.arrayContaining(['D1', 'P1']));

    // 2 编辑已发布文章正文：200 + 内容更新（编辑后状态置回 draft，REQ-012 更新后重新发布语义）
    const put = await request(env.app)
      .put('/api/articles/P1')
      .set(bearer(session.token))
      .send({ title: '已发布v2', body: 'v2 正文' });
    expect(put.status).toBe(200);
    expect(put.body.data.title).toBe('已发布v2');
    expect(put.body.data.status).toBe('draft');

    // 3 重新发布：200 + 读者读到 v2 内容
    const repub = await request(env.app).post('/api/articles/P1/publish').set(bearer(session.token));
    expect(repub.status).toBe(200);
    const readerDetail = await request(env.app).get('/api/articles/P1');
    expect(readerDetail.status).toBe(200);
    expect(readerDetail.body.data.title).toBe('已发布v2');
    expect(readerDetail.body.data.body).toBe('v2 正文');

    // 4 删除草稿：204 + 草稿消失
    const del = await request(env.app).delete('/api/articles/D1').set(bearer(session.token));
    expect(del.status).toBe(204);
    expect(env.stores.articleStore.findById('D1')).toBeNull();
  });
});
