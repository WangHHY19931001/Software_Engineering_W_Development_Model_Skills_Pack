/**
 * 验收测试 - 基础设施模块（4 用例）
 * 覆盖 UAT: 013, 014, 036, 037
 * 关联需求: REQ-013, REQ-014
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
  createTag,
  createCategory,
  type AcceptanceTestContext,
} from './helpers.js';

describe('验收测试 - 基础设施模块（4 用例）', () => {
  let ctx: AcceptanceTestContext;
  let app: Express;

  beforeEach(() => {
    ctx = createTestContext();
    app = ctx.app;
  });

  // ==================== UAT-013 标签管理 CRUD（REQ-013） ====================
  it('UAT-013: 标签 CRUD 全流程（创建→查询→更新→删除）', async () => {
    const admin = await registerAndLogin(app, 'admin@b.com', 'admin');

    // 1. POST /api/tags → 201
    const createRes = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: '新标签' });
    expect(createRes.status).toBe(201);
    const tagId = createRes.body.id;
    expect(tagId).toBeTruthy();

    // 2. GET /api/tags → 200 含新标签
    const listRes = await request(app).get('/api/tags');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.some((t: { id: string }) => t.id === tagId)).toBe(true);

    // 3. PUT /api/tags/:id → 200
    const updateRes = await request(app)
      .put(`/api/tags/${tagId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: '改后的标签' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('改后的标签');

    // 4. DELETE /api/tags/:id → 204
    const delRes = await request(app)
      .delete(`/api/tags/${tagId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(delRes.status).toBe(204);

    // 5. GET /api/tags → 200 不含已删除
    const listFinal = await request(app).get('/api/tags');
    expect(listFinal.body.some((t: { id: string }) => t.id === tagId)).toBe(false);
  });

  // ==================== UAT-036 非 admin 创建标签被拒（REQ-013 异常） ====================
  it('UAT-036: reader 创建标签 → 403 AUTHORIZATION_ERROR', async () => {
    const reader = await registerAndLogin(app, 'reader@b.com', 'reader');
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${reader.token}`)
      .send({ name: '新标签' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
  });

  // ==================== UAT-014 分类管理 CRUD（REQ-014） ====================
  it('UAT-014: 分类 CRUD 全流程（创建→查询→更新→删除）', async () => {
    const admin = await registerAndLogin(app, 'admin@b.com', 'admin');

    // 1. POST /api/categories → 201
    const createRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: '新分类', parentCategoryId: null });
    expect(createRes.status).toBe(201);
    const categoryId = createRes.body.id;
    expect(categoryId).toBeTruthy();

    // 2. GET /api/categories → 200
    const listRes = await request(app).get('/api/categories');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.some((c: { id: string }) => c.id === categoryId)).toBe(true);

    // 3. PUT /api/categories/:id → 200
    const updateRes = await request(app)
      .put(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: '改后的分类' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('改后的分类');

    // 4. DELETE /api/categories/:id → 204
    const delRes = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(delRes.status).toBe(204);

    // 5. GET /api/categories → 200 不含已删除
    const listFinal = await request(app).get('/api/categories');
    expect(listFinal.body.some((c: { id: string }) => c.id === categoryId)).toBe(false);
  });

  // ==================== UAT-037 分类循环依赖检测（REQ-014 异常） ====================
  it('UAT-037: 分类循环依赖检测 → 409 CONFLICT_ERROR', async () => {
    const admin = await registerAndLogin(app, 'admin@b.com', 'admin');

    // 1. 创建分类 A
    const aRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'A', parentCategoryId: null });
    expect(aRes.status).toBe(201);
    const aId = aRes.body.id;

    // 2. 创建分类 B（parentCategoryId=A.id）
    const bRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'B', parentCategoryId: aId });
    expect(bRes.status).toBe(201);
    const bId = bRes.body.id;

    // 3. 更新 A 的 parentCategoryId=B.id → 形成循环 A→B→A → 409
    const cycleRes = await request(app)
      .put(`/api/categories/${aId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ parentCategoryId: bId });
    expect(cycleRes.status).toBe(409);
    expect(cycleRes.body.error.code).toBe('CONFLICT_ERROR');
  });
});
