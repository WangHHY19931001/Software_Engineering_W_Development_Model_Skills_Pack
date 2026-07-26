/**
 * 验收测试共享助手（tests/acceptance/helpers.ts）
 * - 复用系统测试 createTestContext / registerAndLogin / createPublishedArticle 等
 * - 测试 seam：seam-http（supertest 调用 Express app，不启动真实 HTTP 服务器）
 * - 数据隔离：beforeEach 创建新 container，重置内存存储与限流桶
 * - 覆盖 docs/acceptance-test-cases.md 的 63 条 UAT 用例
 *
 * 第 9 轮 W 模型阶段 8 验收测试。
 */
import type { Express } from 'express';
import request from 'supertest';
import { createContainer, type Container } from '../../src/container.js';
import type { Role } from '../../src/types.js';

const TEST_JWT_SECRET = 'test-secret-blog-demo-32chars-min!!';

export interface AcceptanceTestContext {
  container: Container;
  app: Express;
  stores: Container['stores'];
  services: Container['services'];
  middleware: Container['middleware'];
}

export function createTestContext(): AcceptanceTestContext {
  const container = createContainer(TEST_JWT_SECRET);
  return {
    container,
    app: container.app,
    stores: container.stores,
    services: container.services,
    middleware: container.middleware,
  };
}

export interface RegisteredUser {
  id: string;
  email: string;
  role: Role;
  token: string;
}

/** 注册并登录获取 JWT。默认密码 password123（≥8 位）。 */
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

/** 创建文章（默认 draft）并返回 ID。 */
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

/** 创建已发布文章（一步到位）。 */
export async function createPublishedArticle(
  app: Express,
  authorToken: string,
  title: string = 'Hello World',
  content: string = 'Article body content',
  tagIds: string[] = [],
  categoryId: string | null = null,
): Promise<string> {
  return createArticle(app, authorToken, { title, content, tagIds, categoryId, status: 'published' });
}

/** 发布文章（draft → published）。 */
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

/** 创建分类并返回 ID。 */
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

/** 创建标签并返回 ID（仅 admin）。 */
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

/** 创建评论并返回 ID。 */
export async function createComment(
  app: Express,
  token: string,
  articleId: string,
  content: string = '测试评论',
): Promise<string> {
  const res = await request(app)
    .post(`/api/articles/${articleId}/comments`)
    .set('Authorization', `Bearer ${token}`)
    .send({ content });
  if (res.status !== 201) {
    throw new Error(`createComment failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.id as string;
}

/** 请求密码重置并返回 token（通过 service 直接获取，模拟邮件投递）。 */
export function requestPasswordResetToken(
  services: Container['services'],
  email: string,
): { token: string; expiresAt: string } {
  return services.passwordReset.requestReset(email);
}
