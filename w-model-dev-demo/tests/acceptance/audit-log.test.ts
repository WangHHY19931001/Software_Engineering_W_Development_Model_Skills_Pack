/**
 * 验收测试 - 审计日志模块（3 用例）
 * 覆盖 UAT: 019, 045, 046
 * 关联需求: REQ-019
 *
 * 测试方法：supertest → Express app（seam-http），beforeEach 创建独立 container 数据隔离。
 * 实际 API 路径以 docs/uat-path-mapping.md 回填为准。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestContext,
  registerAndLogin,
  createPublishedArticle,
  type AcceptanceTestContext,
} from './helpers.js';

describe('验收测试 - 审计日志模块（3 用例）', () => {
  let ctx: AcceptanceTestContext;
  let app: Express;

  beforeEach(() => {
    ctx = createTestContext();
    app = ctx.app;
  });

  // ==================== UAT-019 审计日志记录与查询（REQ-019） ====================
  it('UAT-019: 关键操作记录审计日志，admin 可查询', async () => {
    const admin = await registerAndLogin(app, 'admin@b.com', 'admin');
    const author = await registerAndLogin(app, 'author@b.com', 'author');

    // 执行登录操作（admin 登录已触发审计日志）
    // 执行文章创建 → 触发审计日志
    await createPublishedArticle(app, author.token, '审计测试', '内容');

    // admin 查询审计日志 → 200
    const res = await request(app)
      .get('/api/audit-logs?page=1&limit=20')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toBeTruthy();
    expect(res.body.total).toBeGreaterThan(0);
    // 每条含 userId/action/resource/timestamp
    if (res.body.items.length > 0) {
      const log = res.body.items[0];
      expect(log.userId).toBeDefined();
      expect(log.action).toBeDefined();
      expect(log.resource).toBeDefined();
      expect(log.timestamp).toBeDefined();
    }
  });

  // ==================== UAT-045 非 admin 查询审计日志被拒（REQ-019 异常） ====================
  it('UAT-045: reader 查询审计日志 → 403 AUTHORIZATION_ERROR', async () => {
    const reader = await registerAndLogin(app, 'reader@b.com', 'reader');
    const res = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${reader.token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
  });

  // ==================== UAT-046 审计日志分页超出范围（REQ-019 边界） ====================
  it('UAT-046: page 超出范围 → 200 空数组', async () => {
    const admin = await registerAndLogin(app, 'admin@b.com', 'admin');
    // 触发若干审计日志
    await registerAndLogin(app, 'author@b.com', 'author');

    const res = await request(app)
      .get('/api/audit-logs?page=999&limit=20')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.page).toBe(999);
  });
});
