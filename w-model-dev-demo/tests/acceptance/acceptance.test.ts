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

async function createArticle(token: string, title = 'Hello', content = 'World'): Promise<string> {
  const res = await request(app)
    .post('/api/articles')
    .set('Authorization', `Bearer ${token}`)
    .send({ title, content })
    .expect(201);
  return res.body.articleId as string;
}

describe('UAT-001: 用户注册成功', () => {
  beforeEach(clearAll);

  it('POST /api/auth/register 返回 201 + userId', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'Passw0rd!' })
      .expect(201);
    expect(res.body.userId).toBeTypeOf('string');
    expect(res.body.userId.length).toBeGreaterThan(0);
  });
});

describe('UAT-002: 重复用户名注册失败', () => {
  beforeEach(clearAll);

  it('已存在的 username 再次注册返回 409', async () => {
    await request(app).post('/api/auth/register').send({ username: 'alice', password: 'Passw0rd!' }).expect(201);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'Passw0rd!' })
      .expect(409);
    expect(res.body.error).toBeTypeOf('string');
  });
});

describe('UAT-003: 登录成功返回 JWT', () => {
  beforeEach(clearAll);

  it('POST /api/auth/login 返回 200 + 非空 JWT，exp-iat ≤ 3600', async () => {
    await request(app).post('/api/auth/register').send({ username: 'alice', password: 'Passw0rd!' }).expect(201);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'Passw0rd!' })
      .expect(200);
    const token = res.body.token as string;
    expect(token).toBeTypeOf('string');
    expect(token.split('.').length).toBe(3);
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf-8'));
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(3600);
  });
});

describe('UAT-004: 错误密码登录失败', () => {
  beforeEach(clearAll);

  it('错误密码登录返回 401，不返回 token', async () => {
    await request(app).post('/api/auth/register').send({ username: 'alice', password: 'Passw0rd!' }).expect(201);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'WrongPass' })
      .expect(401);
    expect(res.body.token).toBeUndefined();
  });
});

describe('UAT-005: 已认证用户创建文章', () => {
  beforeEach(clearAll);

  it('POST /api/articles 携带 JWT 返回 201 + articleId', async () => {
    const token = await registerAndLogin('alice');
    const res = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Hello', content: 'World' })
      .expect(201);
    expect(res.body.articleId).toBeTypeOf('string');
  });
});

describe('UAT-006: 未认证创建文章被拒', () => {
  beforeEach(clearAll);

  it('无 Authorization 创建文章返回 401', async () => {
    const res = await request(app)
      .post('/api/articles')
      .send({ title: 'Hello', content: 'World' })
      .expect(401);
    expect(res.body.error).toBeTypeOf('string');
  });
});

describe('UAT-007: 作者更新自己的文章', () => {
  beforeEach(clearAll);

  it('作者 PUT 自己的文章返回 200，标题已更新', async () => {
    const token = await registerAndLogin('alice');
    const id = await createArticle(token, 'Original');
    const res = await request(app)
      .put(`/api/articles/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated' })
      .expect(200);
    expect(res.body.title).toBe('Updated');
  });
});

describe('UAT-008: 非作者更新他人文章被拒', () => {
  beforeEach(clearAll);

  it('bob PUT alice 的文章返回 403，标题未变', async () => {
    const aliceToken = await registerAndLogin('alice');
    const bobToken = await registerAndLogin('bob');
    const id = await createArticle(aliceToken, 'A1');

    const res = await request(app)
      .put(`/api/articles/${id}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ title: 'Hacked' })
      .expect(403);
    expect(res.body.error).toBeTypeOf('string');

    const get = await request(app).get(`/api/articles/${id}`).expect(200);
    expect(get.body.title).toBe('A1');
  });
});

describe('UAT-009: 作者删除自己的文章', () => {
  beforeEach(clearAll);

  it('作者 DELETE 自己的文章返回 204，随后 GET 返回 404', async () => {
    const token = await registerAndLogin('alice');
    const id = await createArticle(token, 'A1');

    await request(app).delete(`/api/articles/${id}`).set('Authorization', `Bearer ${token}`).expect(204);
    await request(app).get(`/api/articles/${id}`).expect(404);
  });
});

describe('UAT-010: 公开浏览文章列表', () => {
  beforeEach(clearAll);

  it('无认证 GET /api/articles 返回 200 + 数组', async () => {
    const token = await registerAndLogin('alice');
    await createArticle(token);

    const res = await request(app).get('/api/articles').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const article = res.body[0];
    expect(article.id).toBeTypeOf('string');
    expect(article.title).toBeTypeOf('string');
    expect(article.content).toBeTypeOf('string');
    expect(article.authorId).toBeTypeOf('string');
  });
});

describe('UAT-011: 公开查看文章详情', () => {
  beforeEach(clearAll);

  it('无认证 GET /api/articles/:id 返回 200 + 完整文章', async () => {
    const token = await registerAndLogin('alice');
    const id = await createArticle(token, 'Hello', 'World');

    const res = await request(app).get(`/api/articles/${id}`).expect(200);
    expect(res.body.id).toBe(id);
    expect(res.body.title).toBe('Hello');
    expect(res.body.content).toBe('World');
    expect(res.body.authorId).toBeTypeOf('string');
  });
});

describe('UAT-012: 查看不存在的文章 404', () => {
  beforeEach(clearAll);

  it('GET /api/articles/non-existent 返回 404', async () => {
    const res = await request(app).get('/api/articles/non-existent').expect(404);
    expect(res.body.error).toBeTypeOf('string');
  });
});

describe('UAT-013: 已认证用户发表评论', () => {
  beforeEach(clearAll);

  it('POST /api/articles/:id/comments 携带 JWT 返回 201 + commentId', async () => {
    const token = await registerAndLogin('alice');
    const id = await createArticle(token);

    const res = await request(app)
      .post(`/api/articles/${id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Nice' })
      .expect(201);
    expect(res.body.commentId).toBeTypeOf('string');
  });
});

describe('UAT-014: 未认证评论被拒', () => {
  beforeEach(clearAll);

  it('无 Authorization POST 评论返回 401', async () => {
    const token = await registerAndLogin('alice');
    const id = await createArticle(token);

    const res = await request(app)
      .post(`/api/articles/${id}/comments`)
      .send({ content: 'Anon' })
      .expect(401);
    expect(res.body.error).toBeTypeOf('string');
  });
});

describe('UAT-015: 查看文章评论列表', () => {
  beforeEach(clearAll);

  it('无认证 GET /api/articles/:id/comments 返回 200 + 数组', async () => {
    const token = await registerAndLogin('alice');
    const id = await createArticle(token);

    await request(app)
      .post(`/api/articles/${id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Nice' })
      .expect(201);

    const res = await request(app).get(`/api/articles/${id}/comments`).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const comment = res.body[0];
    expect(comment.id).toBeTypeOf('string');
    expect(comment.content).toBeTypeOf('string');
    expect(comment.authorId).toBeTypeOf('string');
    expect(comment.articleId).toBe(id);
  });
});
