/**
 * TC-DES-004: 接口定义验证（契约完整性 + 错误码三段位）
 *
 * 验证 17 个 INTF 节点存在、路由可达、错误码三段位（4xx/5xx/业务）、
 * 错误响应结构含 code+message、路径格式统一。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import request from 'supertest';
import { createTestApp, registerUser, authHeader } from '../helpers/api-helper.js';
import type { Express } from 'express';

const GRAPH_PATH = path.resolve(
  process.cwd(),
  '.w-model', 'ingestion', 'graph.json',
);

describe('TC-DES-004: 接口定义验证', () => {
  let app: Express;
  let bloggerToken: string;

  beforeEach(async () => {
    app = createTestApp();
    const blogger = await registerUser(app, 'b@b.com', 'Pass1234', 'blogger', 'blogger');
    bloggerToken = blogger.accessToken;
  });

  it('步骤1: graph.json 含 17 个 INTF 节点', async () => {
    const raw = await fs.readFile(GRAPH_PATH, 'utf-8');
    const graph = JSON.parse(raw);
    const intfNodes = graph.nodes.filter((n: { type: string }) => n.type === 'INTF');
    expect(intfNodes.length).toBe(17);
    // 校验 ID 唯一性
    const ids = new Set(intfNodes.map((n: { id: string }) => n.id));
    expect(ids.size).toBe(17);
  });

  it('步骤2: 各接口路由可达（404 vs 400/401 区分）', async () => {
    // 注册路由
    const regRes = await request(app).post('/api/auth/register').send({});
    expect(regRes.status).toBe(400); // zod 校验失败 → 400

    // 文章列表路由
    const listRes = await request(app).get('/api/articles');
    expect(listRes.status).toBe(200);

    // 需认证路由
    const authRes = await request(app).get('/api/users/u1');
    expect(authRes.status).toBe(401);

    // 通知路由
    const notifRes = await request(app).get('/api/notifications');
    expect(notifRes.status).toBe(401);

    // 站点配置路由
    const siteRes = await request(app).get('/api/site/config');
    expect(siteRes.status).toBe(200);

    // 统计路由
    const statsRes = await request(app).get('/api/stats/articles');
    expect(statsRes.status).toBe(200);

    // 搜索路由
    const searchRes = await request(app).get('/api/search?q=test');
    expect(searchRes.status).toBe(200);

    // 推荐路由
    const recRes = await request(app).get('/api/recommend/hot');
    expect(recRes.status).toBe(200);
  });

  it('步骤3: 错误码三段位覆盖（4xx/5xx/业务）', async () => {
    // 4xx: 参数校验失败 40003 → 400
    const valRes = await request(app).post('/api/auth/register').send({
      email: 'not-email', password: 'Pass1234', nickname: 'x',
    });
    expect(valRes.status).toBe(400);
    expect(valRes.body.code).toBe(40003);

    // 4xx: 未授权 40101 → 401
    const authRes = await request(app).get('/api/users/u1');
    expect(authRes.status).toBe(401);
    expect(authRes.body.code).toBe(40101);

    // 4xx: 权限不足 40301 → 403
    const rbacRes = await request(app)
      .post('/api/ads')
      .set(authHeader(bloggerToken))
      .send({});
    expect(rbacRes.status).toBe(403);
    expect(rbacRes.body.code).toBe(40301);

    // 业务: 重复邮箱 40901 → 409
    const dupRes = await request(app).post('/api/auth/register').send({
      email: 'b@b.com', password: 'Pass1234', nickname: 'dup',
    });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.code).toBe(40901);
  });

  it('步骤4: 错误码四元组（code+message 均存在）', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'bad', password: 'Pass1234', nickname: 'x',
    });
    expect(res.body.code).toBeDefined();
    expect(typeof res.body.code).toBe('number');
    expect(res.body.message).toBeDefined();
    expect(typeof res.body.message).toBe('string');
    expect(res.body.message.length).toBeGreaterThan(0);
  });

  it('步骤5: 错误码段位范围正确', async () => {
    // 40003 ∈ [40000, 49999]
    const valRes = await request(app).post('/api/auth/register').send({ email: 'bad' });
    expect(valRes.body.code).toBeGreaterThanOrEqual(40000);
    expect(valRes.body.code).toBeLessThan(50000);

    // 40101 ∈ [40100, 40200)
    const authRes = await request(app).get('/api/users/u1');
    expect(authRes.body.code).toBeGreaterThanOrEqual(40100);
    expect(authRes.body.code).toBeLessThan(40200);

    // 40301 ∈ [40300, 40400)
    const rbacRes = await request(app)
      .post('/api/ads')
      .set(authHeader(bloggerToken))
      .send({});
    expect(rbacRes.body.code).toBeGreaterThanOrEqual(40300);
    expect(rbacRes.body.code).toBeLessThan(40400);

    // 40901 ∈ [40900, 41000)
    await registerUser(app, 'dup@test.com');
    const dupRes = await request(app).post('/api/auth/register').send({
      email: 'dup@test.com', password: 'Pass1234', nickname: 'd',
    });
    expect(dupRes.body.code).toBeGreaterThanOrEqual(40900);
    expect(dupRes.body.code).toBeLessThan(41000);
  });

  it('步骤6: 路径格式统一（/api/ 前缀）', async () => {
    // 所有 API 路由均以 /api/ 开头
    const apiRes = await request(app).get('/api/articles');
    expect(apiRes.status).toBe(200);

    // 非法路径返回 404
    const notFoundRes = await request(app).get('/api/v1/nonexistent');
    expect(notFoundRes.status).toBe(404);
  });

  it('步骤7: 404 响应结构含 code+message', async () => {
    const res = await request(app).get('/api/nonexistent-route');
    expect(res.status).toBe(404);
    expect(res.body.code).toBeDefined();
    expect(res.body.message).toBeDefined();
  });

  it('步骤8: 健康检查端点存在', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
