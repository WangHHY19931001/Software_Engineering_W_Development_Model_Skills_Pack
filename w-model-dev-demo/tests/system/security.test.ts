/**
 * 系统测试 · 安全基线（ST-032~035，TC-DES-009 型，NFR-002）
 * ST-032 SQL/NoSQL 注入向量不破坏查询
 * ST-033 XSS 内容按纯文本存储与返回
 * ST-034 密码 bcrypt 哈希存储、无明文
 * ST-035 JWT_SECRET 环境变量注入 + 错误密钥 token 401
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createTestEnv, seedUser, seedTag, seedArticle, login, bearer } from './helpers';

describe('ST-032 安全基线：SQL/NoSQL 注入向量不破坏查询（安全基线，NFR-002）', () => {
  it('搜索/筛选/登录注入向量按字面量处理：无全量泄漏、无 500、错误结构统一', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st32_blogger', email: 'st32b@example.com', role: 'blogger' });
    seedTag(env.stores, 'nodejs');
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '正常文章', tags: ['nodejs'], status: 'published' });
    env.stores.searchIndexStore.index('A1', { title: '正常文章', body: '', summary: '', tags: ['nodejs'] });

    // 1 搜索注入：`' OR 1=1 --` 按字面量检索，无全量泄漏、无 500
    const searchInj = await request(env.app).get('/api/search').query({ q: "' OR 1=1 --" });
    expect([200, 400]).toContain(searchInj.status);
    if (searchInj.status === 200) {
      expect(searchInj.body.data.total).toBe(0); // 字面量 token 无命中，未泄漏全量
      expect(searchInj.body.data.items).toEqual([]);
    }

    // 2 标签筛选注入：`'; DROP TABLE--` 无报错（空结果或字面量匹配）
    const tagInj = await request(env.app).get('/api/articles').query({ tag: "'; DROP TABLE--" });
    expect(tagInj.status).toBe(200);
    expect(tagInj.body.data.items).toEqual([]);

    // 3 登录注入：`admin'--` 邮箱 401（无越权登录）
    const loginInj = await request(env.app).post('/api/auth/login').send({ identifier: "admin'--", password: 'Passw0rd!x' });
    expect(loginInj.status).toBe(401);
    expect(loginInj.body.error.code).toBe(40101);

    // 4 断言错误结构：任意失败路径 { error: { code, message } }（无堆栈/无 SQL 片段泄漏）
    expect(loginInj.body.error.message).not.toMatch(/sql|syntax|stack/i);
    expect(loginInj.body.error).toHaveProperty('code');
    expect(loginInj.body.error).toHaveProperty('message');
  });
});

describe('ST-033 安全基线：XSS 内容按纯文本存储与返回（安全基线，NFR-002）', () => {
  it('含 <script>/事件属性内容按纯文本存储与返回，不引入可执行语义', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st33_blogger', email: 'st33b@example.com', role: 'blogger' });
    const reader = await seedUser(env.stores, { username: 'st33_reader', email: 'st33r@example.com' });
    seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: 'XSS 文章', status: 'published' });
    const readerSession = await login(env.app, 'st33r@example.com');
    const xss = '<script>alert(1)</script><img src=x onerror=alert(2)>';

    // 1 发表含脚本评论：201 + 内容按纯文本存储
    const comment = await request(env.app)
      .post('/api/articles/A1/comments')
      .set(bearer(readerSession.token))
      .send({ content: xss });
    expect(comment.status).toBe(201);
    expect(comment.body.data.content).toBe(xss);

    // 2 读取评论列表：200 + 原文返回（无转义破坏/无执行语义注入）
    const list = await request(env.app).get('/api/articles/A1/comments');
    expect(list.status).toBe(200);
    const stored = list.body.data.items.find((i: { content: string }) => i.content.includes('<script>'));
    expect(stored).toBeDefined();
    expect(stored.content).toBe(xss);

    // 3 断言存储（seam-STORE）：CommentStore 快照与提交文本一致（纯文本，无解析执行）
    const all = env.stores.commentStore.findAll();
    expect(all.some((c) => c.content === xss)).toBe(true);
  });
});

describe('ST-034 安全基线：密码 bcrypt 哈希存储、无明文（安全基线，NFR-002/REQ-007）', () => {
  it('注册后存储层密码为 bcrypt 加盐哈希；响应无密码字段；哈希可验证', async () => {
    const env = createTestEnv();

    // 1 注册用户：201 + 响应体不含密码字段
    const reg = await request(env.app).post('/api/auth/register').send({
      username: 'sec01',
      email: 'sec@example.com',
      password: 'Passw0rd!x',
    });
    expect(reg.status).toBe(201);
    expect(reg.body.data.password).toBeUndefined();
    expect(reg.body.data.passwordHash).toBeUndefined();

    // 2 断言存储密码：UserStore 快照 passwordHash 为 bcrypt 哈希（$2a$10$/$2b$10$ 前缀），非明文
    const user = env.stores.userStore.findByEmail('sec@example.com')!;
    expect(user.passwordHash).not.toBe('Passw0rd!x');
    expect(user.passwordHash.startsWith('$2a$10$') || user.passwordHash.startsWith('$2b$10$')).toBe(true);

    // 3 校验哈希：bcrypt.compare(明文, 哈希) = true；哈希不可逆得明文
    expect(bcrypt.compareSync('Passw0rd!x', user.passwordHash)).toBe(true);
    expect(bcrypt.compareSync('wrong-password', user.passwordHash)).toBe(false);
  });
});

describe('ST-035 安全基线：JWT_SECRET 环境变量注入 + 错误密钥 token 401（安全基线，NFR-002/CON-003）', () => {
  it('密钥自环境变量注入（JWT_SECRET=test-*）；错误密钥签发的 token 401；注入密钥签发的 token 放行', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st35_blogger', email: 'st35b@example.com', role: 'blogger' });

    // 1 断言密钥来源：应用以 JWT_SECRET 环境变量注入启动（npm script cross-env，tests/setup.ts 双保险）
    const injectedSecret = process.env.JWT_SECRET;
    expect(injectedSecret).toBeTruthy();

    // 2 错误密钥签发 token：401 + TOKEN_INVALID（40101）
    const wrongToken = jwt.sign({ sub: blogger.id, role: 'blogger' }, 'wrong-secret-for-st35', { algorithm: 'HS256', expiresIn: '1h' });
    const wrongRes = await request(env.app).get('/api/users/me').set(bearer(wrongToken));
    expect(wrongRes.status).toBe(401);
    expect(wrongRes.body.error.code).toBe(40101);

    // 3 正确密钥（注入的测试密钥）签发：200 + 正常访问（行为证明应用使用注入密钥验签）
    const rightToken = jwt.sign({ sub: blogger.id, role: 'blogger' }, injectedSecret!, { algorithm: 'HS256', expiresIn: '1h' });
    const okRes = await request(env.app).get('/api/users/me').set(bearer(rightToken));
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.email).toBe('st35b@example.com');

    // 4 登录签发 token 同样可访问（对照组，CON-003 24h 语义由 ST-006 断言）
    const session = await login(env.app, 'st35b@example.com');
    const me = await request(env.app).get('/api/users/me').set(bearer(session.token));
    expect(me.status).toBe(200);
  });
});
