import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app.js';
import { JWT_SECRET } from '../../src/utils/env.js';
import { userStore } from '../../src/stores/user-store.js';
import { articleStore } from '../../src/stores/article-store.js';
import { commentStore } from '../../src/stores/comment-store.js';

function clearAll() {
  userStore.clear();
  articleStore.clear();
  commentStore.clear();
}

async function registerAndLogin(username: string, password = 'Passw0rd!'): Promise<string> {
  await request(app).post('/api/auth/register').send({ username, password }).expect(201);
  const res = await request(app).post('/api/auth/login').send({ username, password }).expect(200);
  return res.body.token as string;
}

describe('ST-001: 全链路 注册→登录→创建文章→浏览', () => {
  beforeEach(clearAll);

  it('完整业务闭环无断层', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'Passw0rd!' })
      .expect(201);
    const userId = reg.body.userId as string;

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'Passw0rd!' })
      .expect(200);
    const token = login.body.token as string;

    const create = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Hello', content: 'World' })
      .expect(201);
    const articleId = create.body.articleId as string;

    const list = await request(app).get('/api/articles').expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.length).toBe(1);

    const detail = await request(app).get(`/api/articles/${articleId}`).expect(200);
    expect(detail.body.authorId).toBe(userId);
    expect(detail.body.title).toBe('Hello');
  });
});

describe('ST-002: 作者隔离端到端', () => {
  beforeEach(clearAll);

  it('bob 对 alice 的文章 PUT/DELETE 全部 403，标题未变', async () => {
    const aliceToken = await registerAndLogin('alice');
    const bobToken = await registerAndLogin('bob');

    const create = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'A1', content: 'C1' })
      .expect(201);
    const id = create.body.articleId as string;

    await request(app)
      .put(`/api/articles/${id}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ title: 'Hacked' })
      .expect(403);

    await request(app)
      .delete(`/api/articles/${id}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(403);

    const get = await request(app).get(`/api/articles/${id}`).expect(200);
    expect(get.body.title).toBe('A1');
  });
});

describe('ST-003: 删除文章后评论不可再创建', () => {
  beforeEach(clearAll);

  it('DELETE 文章后 POST 评论返回 404', async () => {
    const token = await registerAndLogin('alice');
    const create = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'A1', content: 'C1' })
      .expect(201);
    const id = create.body.articleId as string;

    await request(app)
      .delete(`/api/articles/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    await request(app)
      .post(`/api/articles/${id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hi' })
      .expect(404);
  });
});

describe('ST-004: JWT 过期后访问受保护接口被拒', () => {
  beforeEach(clearAll);

  it('过期 token 访问 POST /api/articles 返回 401', async () => {
    // 用同一密钥手工签发一个 exp = now - 1s 的过期 JWT
    const expiredToken = jwt.sign(
      { userId: 'fake-user-id' },
      JWT_SECRET,
      { expiresIn: -1 },
    );

    await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({ title: 'X', content: 'Y' })
      .expect(401);
  });
});

describe('ST-005: 输入校验返回 400', () => {
  beforeEach(clearAll);

  it('缺字段 / 类型错误全部 400', async () => {
    // 缺 password
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'a' })
      .expect(400);

    // title 类型错误（数字而非字符串）
    const token = await registerAndLogin('alice');
    await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 123, content: 'x' })
      .expect(400);

    // 创建一篇文章用于评论测试
    const create = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'T', content: 'C' })
      .expect(201);
    const id = create.body.articleId as string;

    // 缺 content
    await request(app)
      .post(`/api/articles/${id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);
  });
});

describe('ST-006: 并发创建文章产生不同 articleId', () => {
  beforeEach(clearAll);

  it('并发 POST ×2 得到两个不同 ID，列表可见 2 篇', async () => {
    const token = await registerAndLogin('alice');

    const [r1, r2] = await Promise.all([
      request(app)
        .post('/api/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'P1', content: 'C1' }),
      request(app)
        .post('/api/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'P2', content: 'C2' }),
    ]);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    const id1 = r1.body.articleId as string;
    const id2 = r2.body.articleId as string;
    expect(id1).not.toBe(id2);

    const list = await request(app).get('/api/articles').expect(200);
    expect(list.body.length).toBe(2);
  });
});
