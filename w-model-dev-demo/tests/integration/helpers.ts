/**
 * 集成测试共享助手（tests/integration/helpers.ts）
 * - createTestContainer：每个测试套件 beforeEach 重置内存数据（零 mock）
 * - registerUser / loginAndGetToken：JWT 鉴权流（CON-002）
 * - createPublishedArticle：发布文章并返回 ID（多个跨模块用例复用）
 */
import type { Express } from 'express';
import request from 'supertest';
import { createContainer, type Container } from '../../src/container.js';
import type { Role } from '../../src/types.js';

const TEST_JWT_SECRET = 'test-secret-blog-demo-32chars-min!!';

export interface TestContext {
  container: Container;
  app: Express;
  stores: Container['stores'];
  services: Container['services'];
}

export function createTestContext(): TestContext {
  const container = createContainer(TEST_JWT_SECRET);
  return {
    container,
    app: container.app,
    stores: container.stores,
    services: container.services,
  };
}

export interface RegisteredUser {
  id: string;
  email: string;
  role: Role;
  token: string;
}

/**
 * 注册用户并登录获取 JWT。
 * 默认密码 password123（满足 ≥8 位约束）。
 */
export async function registerAndLogin(
  app: Express,
  email: string,
  role: Role = 'author',
  password: string = 'password123',
): Promise<RegisteredUser> {
  const regRes = await request(app)
    .post('/api/users/register')
    .send({ email, password, role });
  if (regRes.status !== 201) {
    throw new Error(`register failed: ${regRes.status} ${JSON.stringify(regRes.body)}`);
  }
  const userId: string = regRes.body.id;
  const loginRes = await request(app)
    .post('/api/users/login')
    .send({ email, password });
  if (loginRes.status !== 200) {
    throw new Error(`login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
  }
  return { id: userId, email, role, token: loginRes.body.token as string };
}

/**
 * 创建标签并返回 ID。
 */
export async function createTag(app: Express, adminToken: string, name: string): Promise<string> {
  const res = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name });
  if (res.status !== 201) {
    throw new Error(`createTag failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.id as string;
}

/**
 * 创建分类并返回 ID。
 */
export async function createCategory(
  app: Express,
  token: string,
  name: string,
  parentCategoryId: string | null = null,
): Promise<string> {
  const res = await request(app)
    .post('/api/categories')
    .set('Authorization', `Bearer ${token}`)
    .send({ name, parentCategoryId });
  if (res.status !== 201) {
    throw new Error(`createCategory failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.id as string;
}

/**
 * 创建文章（默认 draft）并返回 ID。
 */
export async function createArticle(
  app: Express,
  authorToken: string,
  payload: {
    title: string;
    content: string;
    tagIds?: string[];
    categoryId?: string | null;
    status?: 'draft' | 'published';
  },
): Promise<string> {
  const body = {
    title: payload.title,
    content: payload.content,
    tagIds: payload.tagIds ?? [],
    categoryId: payload.categoryId ?? null,
    status: payload.status ?? 'draft',
  };
  const res = await request(app)
    .post('/api/articles')
    .set('Authorization', `Bearer ${authorToken}`)
    .send(body);
  if (res.status !== 201) {
    throw new Error(`createArticle failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.id as string;
}

/**
 * 发布文章（draft → published）。
 */
export async function publishArticle(
  app: Express,
  authorToken: string,
  articleId: string,
): Promise<void> {
  const res = await request(app)
    .post(`/api/articles/${articleId}/workflow`)
    .set('Authorization', `Bearer ${authorToken}`)
    .send({ action: 'publish' });
  if (res.status !== 200) {
    throw new Error(`publishArticle failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

/**
 * 创建已发布文章（一步到位）。
 */
export async function createPublishedArticle(
  app: Express,
  authorToken: string,
  title: string = 'Hello World',
  content: string = 'Article body content',
  tagIds: string[] = [],
  categoryId: string | null = null,
): Promise<string> {
  const id = await createArticle(app, authorToken, {
    title,
    content,
    tagIds,
    categoryId,
    status: 'published',
  });
  return id;
}
