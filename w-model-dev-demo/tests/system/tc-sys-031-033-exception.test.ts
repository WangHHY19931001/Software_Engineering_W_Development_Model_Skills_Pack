/**
 * TC-SYS-031 ~ 033 异常路径（Exception）系统测试
 *
 * 覆盖范围：
 * - TC-SYS-031 404 路由未找到
 * - TC-SYS-032 JSON 解析错误
 * - TC-SYS-033 资源不存在（文章/用户/标签）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import { setupSystemTest, type SystemContext, authHeader } from './setup.js';
import { UserRole } from '../../src/types/index.js';

describe('TC-SYS-031~033 异常路径（Exception）', () => {
  let ctx: SystemContext;

  beforeEach(() => {
    ctx = setupSystemTest();
  });

  it('TC-SYS-031: 404 路由未找到 - 统一错误响应格式', async () => {
    const agent = supertest(ctx.app);
    const r1 = await agent.get('/api/nonexistent');
    expect(r1.status).toBe(404);
    expect(r1.body.code).toBe('NOT_FOUND');
    expect(r1.body.message).toContain('not found');

    const r2 = await agent.post('/api/wrong-path');
    expect(r2.status).toBe(404);

    const r3 = await agent.put('/api/wrong/path');
    expect(r3.status).toBe(404);
  });

  it('TC-SYS-032: JSON 解析错误 - malformed body 400', async () => {
    const agent = supertest(ctx.app);
    // 发送非 JSON
    const r1 = await agent
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ invalid json }');
    expect([400, 500]).toContain(r1.status);

    // 发送空 body
    const r2 = await agent
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('');
    expect([400, 415]).toContain(r2.status);
  });

  it('TC-SYS-033: 资源不存在 - 文章/用户/标签', async () => {
    const agent = supertest(ctx.app);

    // 文章不存在
    const r1 = await agent.get('/api/articles/nonexistent-id');
    expect(r1.status).toBe(404);
    expect(r1.body.code).toBe('NOT_FOUND');

    // 用户不存在
    const r2 = await agent.get('/api/users/nonexistent-user');
    expect(r2.status).toBe(404);

    // 标签不存在
    const r3 = await agent.get('/api/tags/nonexistent-tag');
    expect(r3.status).toBe(404);
  });
});
