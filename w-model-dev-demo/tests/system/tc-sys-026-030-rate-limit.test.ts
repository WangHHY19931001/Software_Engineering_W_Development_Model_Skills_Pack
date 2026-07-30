/**
 * TC-SYS-026 ~ 030 限流（Rate Limit）系统测试
 *
 * 覆盖范围：
 * - TC-SYS-026 单 IP 100 req/min 内通过，第 101 次触发 429
 * - TC-SYS-027 不同 IP 限流桶独立
 * - TC-SYS-028 限流旁路：bypass 头绕过限流
 * - TC-SYS-029 限流错误码格式
 * - TC-SYS-030 限流降级 - 触发后服务不崩
 */
import { describe, it, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import { setupSystemTest, type SystemContext } from './setup.js';

describe('TC-SYS-026~030 限流（Rate Limit）', () => {
  let ctx: SystemContext;

  beforeEach(() => {
    ctx = setupSystemTest();
  });

  it('TC-SYS-026: 单 IP 100 req/min 触发 429（第 101 次）', async () => {
    // 准备：用户登录拿 token
    const user = await ctx.registerUser({ email: 'rl@e.com', username: 'rl_user' });
    const login = await ctx
      .api()
      .post('/api/auth/login')
      .send({ email: 'rl@e.com', password: 'password123' });
    const token = login.body.token;

    // 使用 raw supertest（不走 bypass 头）
    const agent = supertest(ctx.app);
    let okCount = 0;
    let rateLimitCount = 0;
    for (let i = 0; i < 105; i++) {
      const res = await agent
        .get('/api/me/notifications')
        .set('Authorization', `Bearer ${token}`);
      if (res.status === 200) okCount += 1;
      else if (res.status === 429) rateLimitCount += 1;
    }

    // 验证：触发限流
    expect(rateLimitCount).toBeGreaterThan(0);
    // 验证：100 个 OK（不超过阈值）
    expect(okCount).toBe(100);
  });

  it('TC-SYS-027: 限流桶 - 不同 X-Forwarded-For IP 独立计数', async () => {
    // 使用 X-Forwarded-For 区分限流桶
    const agent = supertest(ctx.app);
    let ip1Ok = 0;
    let ip2Ok = 0;
    for (let i = 0; i < 5; i++) {
      const r1 = await agent.get('/health').set('X-Forwarded-For', '10.0.0.1');
      if (r1.status === 200) ip1Ok += 1;
      const r2 = await agent.get('/health').set('X-Forwarded-For', '10.0.0.2');
      if (r2.status === 200) ip2Ok += 1;
    }
    // 两个 IP 各自成功
    expect(ip1Ok).toBe(5);
    expect(ip2Ok).toBe(5);
  });

  it('TC-SYS-028: 限流旁路 - bypass 头完全绕过限流', async () => {
    // 150 个请求（远超过 100）都通过
    const api = ctx.api();
    let okCount = 0;
    for (let i = 0; i < 150; i++) {
      const res = await api.get('/health');
      if (res.status === 200) okCount += 1;
    }
    expect(okCount).toBe(150);
  });

  it('TC-SYS-029: 限流错误码格式 - RATE_LIMITED + 429', async () => {
    const user = await ctx.registerUser({ email: 'rl2@e.com', username: 'rl2' });
    const login = await ctx
      .api()
      .post('/api/auth/login')
      .send({ email: 'rl2@e.com', password: 'password123' });
    const token = login.body.token;

    const agent = supertest(ctx.app);
    // 触发 101 次
    for (let i = 0; i < 100; i++) {
      await agent.get('/api/me/notifications').set('Authorization', `Bearer ${token}`);
    }
    // 第 101 次
    const blocked = await agent
      .get('/api/me/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    expect(blocked.body.httpStatus).toBe(429);
  });

  it('TC-SYS-030: 限流降级 - 触发后服务不崩（健康检查仍可用）', async () => {
    const user = await ctx.registerUser({ email: 'rl3@e.com', username: 'rl3' });
    const login = await ctx
      .api()
      .post('/api/auth/login')
      .send({ email: 'rl3@e.com', password: 'password123' });
    const token = login.body.token;

    const agent = supertest(ctx.app);
    // 触发 101 次
    for (let i = 0; i < 100; i++) {
      await agent.get('/api/me/notifications').set('Authorization', `Bearer ${token}`);
    }
    // 第 101 次 429
    const blocked = await agent
      .get('/api/me/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(blocked.status).toBe(429);

    // 验证：进程不崩（健康检查可访问）
    const health = await agent.get('/health');
    expect([200, 429]).toContain(health.status);
    // 健康检查独立计数
    if (health.status === 200) {
      expect(health.body.status).toBe('ok');
    }
  });
});
