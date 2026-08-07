/**
 * 验收测试 · 标签与分类（UAT-025~029，REQ-015~016）
 * 路径映射：docs/uat-path-mapping.md（直接映射）。
 * 契约说明：分类嵌套深度 ≤3 层（根=1），超限 60003 → HTTP 400；同级重名 40901（INTF-009/010）。
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestEnv, seedUser, seedTag, seedCategory, login, bearer } from './helpers';

async function seedBlogger(env: ReturnType<typeof createTestEnv>, username: string, email: string) {
  return seedUser(env.stores, { username, email, role: 'blogger' });
}

describe('UAT-025 创建标签（名称唯一）（正常路径，REQ-015）', () => {
  it('博主创建标签 → 201 + tagId/name', async () => {
    const env = createTestEnv();
    await seedBlogger(env, 'uat25_b', 'uat25@example.com');
    const session = await login(env.app, 'uat25@example.com');
    const res = await request(env.app).post('/api/tags').set(bearer(session.token)).send({ name: 'typescript' });
    expect(res.status).toBe(201);
    expect(res.body.data.tagId).toBeTruthy();
    expect(res.body.data.name).toBe('typescript');
  });
});

describe('UAT-026 重复标签名创建被拒（异常路径，REQ-015）', () => {
  it('已存在标签名再次创建 → 409 + 40901', async () => {
    const env = createTestEnv();
    await seedBlogger(env, 'uat26_b', 'uat26@example.com');
    seedTag(env.stores, 'typescript');
    const session = await login(env.app, 'uat26@example.com');
    const res = await request(env.app).post('/api/tags').set(bearer(session.token)).send({ name: 'typescript' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe(40901);
    expect(res.body.error.message).toBeTruthy();
  });
});

describe('UAT-027 创建分类并支持嵌套（正常路径，REQ-016）', () => {
  it('三级嵌套分类创建成功，depth 依次 1/2/3', async () => {
    const env = createTestEnv();
    await seedBlogger(env, 'uat27_b', 'uat27@example.com');
    const session = await login(env.app, 'uat27@example.com');
    const l1 = await request(env.app).post('/api/categories').set(bearer(session.token)).send({ name: '技术' });
    expect(l1.status).toBe(201);
    expect(l1.body.data.depth).toBe(1);
    const l2 = await request(env.app)
      .post('/api/categories')
      .set(bearer(session.token))
      .send({ name: '后端', parentId: l1.body.data.categoryId });
    expect(l2.status).toBe(201);
    expect(l2.body.data.depth).toBe(2);
    const l3 = await request(env.app)
      .post('/api/categories')
      .set(bearer(session.token))
      .send({ name: 'Node.js', parentId: l2.body.data.categoryId });
    expect(l3.status).toBe(201);
    expect(l3.body.data.depth).toBe(3);
  });
});

describe('UAT-028 分类嵌套深度超 3 层被拒（边界路径，REQ-016）', () => {
  it('第 3 层下创建子分类 → 400 + 60003', async () => {
    const env = createTestEnv();
    await seedBlogger(env, 'uat28_b', 'uat28@example.com');
    // 构造真实三级 parentId 链（深度由 computeDepth 沿链计算，seedCategory.depth 仅为写入快照值）
    seedCategory(env.stores, { id: 'cat-l1', name: '一层', depth: 1 });
    seedCategory(env.stores, { id: 'cat-l2', name: '二层', parentId: 'cat-l1', depth: 2 });
    seedCategory(env.stores, { id: 'cat-l3', name: '三层', parentId: 'cat-l2', depth: 3 });
    const session = await login(env.app, 'uat28@example.com');
    const res = await request(env.app)
      .post('/api/categories')
      .set(bearer(session.token))
      .send({ name: '过深', parentId: 'cat-l3' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(60003);
    expect(res.body.error.message).toBeTruthy();
  });
});

describe('UAT-029 重复分类名创建被拒（异常路径，REQ-016）', () => {
  it('同父级重名分类 → 409 + 40901', async () => {
    const env = createTestEnv();
    await seedBlogger(env, 'uat29_b', 'uat29@example.com');
    seedCategory(env.stores, { id: 'cat-tech', name: '技术', depth: 1 });
    const session = await login(env.app, 'uat29@example.com');
    const res = await request(env.app).post('/api/categories').set(bearer(session.token)).send({ name: '技术' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe(40901);
  });
});
