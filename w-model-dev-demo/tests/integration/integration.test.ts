import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
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

describe('IT-001: JWT 跨模块传递（M-001 ↔ M-002）', () => {
  beforeEach(clearAll);

  it('注册→登录→解码JWT→创建文章→作者ID一致', async () => {
    const reg = await request(app).post('/api/auth/register').send({ username: 'alice', password: 'Passw0rd!' }).expect(201);
    const userId = reg.body.userId as string;
    const login = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'Passw0rd!' }).expect(200);
    const token = login.body.token as string;
    const parts = token.split('.');
    expect(parts.length).toBe(3);
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    expect(payload.userId).toBe(userId);

    const create = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Hello', content: 'World' })
      .expect(201);
    const articleId = create.body.articleId as string;

    const get = await request(app).get(`/api/articles/${articleId}`).expect(200);
    expect(get.body.authorId).toBe(userId);
  });
});

describe('IT-002: 文章 CRUD 全流程（M-002）', () => {
  beforeEach(clearAll);

  it('create→findById→list→update→remove→findById(404)', async () => {
    const token = await registerAndLogin('alice');
    const create = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'T1', content: 'C1' })
      .expect(201);
    const id = create.body.articleId as string;

    const get = await request(app).get(`/api/articles/${id}`).expect(200);
    expect(get.body.title).toBe('T1');

    const list = await request(app).get('/api/articles').expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.length).toBeGreaterThanOrEqual(1);

    const upd = await request(app)
      .put(`/api/articles/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'T1-updated' })
      .expect(200);
    expect(upd.body.title).toBe('T1-updated');

    await request(app).delete(`/api/articles/${id}`).set('Authorization', `Bearer ${token}`).expect(204);
    await request(app).get(`/api/articles/${id}`).expect(404);
  });
});

describe('IT-003: 评论依赖文章存在校验（M-002 ↔ M-003）', () => {
  beforeEach(clearAll);

  it('对不存在文章评论返回404；对存在文章评论返回201', async () => {
    const token = await registerAndLogin('alice');

    await request(app)
      .post('/api/articles/non-existent/comments')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hi' })
      .expect(404);

    const create = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'A1', content: 'C' })
      .expect(201);
    const articleId = create.body.articleId as string;

    await request(app)
      .post(`/api/articles/${articleId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Nice' })
      .expect(201);
  });
});

describe('IT-004: 作者隔离跨用户（M-001 ↔ M-002）', () => {
  beforeEach(clearAll);

  it('alice 创建，bob PUT/DELETE 全部 403', async () => {
    const aliceToken = await registerAndLogin('alice');
    const bobToken = await registerAndLogin('bob');

    const create = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'A1', content: 'C' })
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

describe('IT-005: 错误中间件统一捕获（M-004 ↔ 全部）', () => {
  beforeEach(clearAll);

  it('401/403/404/409/400 全部返回 {error:string}', async () => {
    // 401 未认证
    const r401 = await request(app).post('/api/articles').send({ title: 'T', content: 'C' }).expect(401);
    expect(r401.body.error).toBeTypeOf('string');

    // 403 非作者
    const aliceToken = await registerAndLogin('alice');
    const bobToken = await registerAndLogin('bob');
    const create = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'A1', content: 'C' })
      .expect(201);
    const id = create.body.articleId as string;
    const r403 = await request(app)
      .put(`/api/articles/${id}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ title: 'X' })
      .expect(403);
    expect(r403.body.error).toBeTypeOf('string');

    // 404 不存在
    const r404 = await request(app).get('/api/articles/non-existent').expect(404);
    expect(r404.body.error).toBeTypeOf('string');

    // 409 重复注册
    const r409 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'Passw0rd!' })
      .expect(409);
    expect(r409.body.error).toBeTypeOf('string');

    // 400 缺字段
    const r400 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'a' })
      .expect(400);
    expect(r400.body.error).toBeTypeOf('string');
  });
});

describe('IT-006: 删除文章后评论不可再创建（M-002 ↔ M-003）', () => {
  beforeEach(clearAll);

  it('DELETE 文章后 POST 评论返回 404', async () => {
    const token = await registerAndLogin('alice');
    const create = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'A1', content: 'C' })
      .expect(201);
    const id = create.body.articleId as string;

    await request(app).delete(`/api/articles/${id}`).set('Authorization', `Bearer ${token}`).expect(204);

    await request(app)
      .post(`/api/articles/${id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hi' })
      .expect(404);
  });
});
