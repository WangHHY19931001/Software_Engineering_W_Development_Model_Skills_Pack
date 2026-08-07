/**
 * UT-050 中间件链顺序与静态路径优先（AppFactory.createApp，DD-050/NFR-001/NFR-005）
 * seam：HTTP 层（supertest 直连 createApp()，不启端口）。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

let app: ReturnType<typeof createApp>;
let token = '';

beforeAll(async () => {
  app = createApp();
  // 预置用户并登录获取 token（GET /api/users/me 需要认证）
  await request(app).post('/api/auth/register').send({ username: 'reader1', email: 'r1@example.com', password: 'Passw0rd!x' }).expect(201);
  const loginRes = await request(app).post('/api/auth/login').send({ identifier: 'reader1', password: 'Passw0rd!x' }).expect(200);
  token = loginRes.body.data.token;
});

describe('UT-050 AppFactory.createApp', () => {
  it('/api/articles/hot 静态路径先于 /:id 注册（不被 :id="hot" 拦截）', async () => {
    const res = await request(app).get('/api/articles/hot?limit=1').expect(200);
    expect(res.status).not.toBe(404);
    expect(res.body.data.items).toBeDefined();
  });

  it('/api/users/me 静态路径先于 /:id/follow（命中资料路由而非 :id="me"）', async () => {
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.status).not.toBe(404);
    expect(res.body.data.userId).toBeDefined();
  });

  it('兜底 404 经统一错误结构（CON-002）', async () => {
    const res = await request(app).get('/api/no-such');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe(40401);
  });

  it('注册重复邮箱 → 40901 统一错误结构', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'reader2', email: 'r1@example.com', password: 'Passw0rd!x' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe(40901);
  });
});
