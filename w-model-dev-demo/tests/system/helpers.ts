/**
 * 系统测试共享助手（tests/system/helpers.ts）
 * - 复用集成测试 createTestContext / registerAndLogin / createPublishedArticle 等
 * - 新增：bulk seed（批量预置数据）、timing（P95 测量）、memory（heapUsed 测量）
 * 测试 seam：seam-http（supertest 调用 Express app，不启动真实 HTTP 服务器）
 * 数据隔离：beforeEach 创建新 container，重置内存存储与限流桶
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
  middleware: Container['middleware'];
}

export function createTestContext(): TestContext {
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

/** 创建已发布文章（一步到位）。 */
export async function createPublishedArticle(
  app: Express,
  authorToken: string,
  title: string = 'Hello World',
  content: string = 'Article body content',
): Promise<string> {
  const res = await request(app)
    .post('/api/articles')
    .set('Authorization', `Bearer ${authorToken}`)
    .send({ title, content, tagIds: [], categoryId: null, status: 'published' });
  if (res.status !== 201) {
    throw new Error(`createArticle failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.id as string;
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

/** 批量预置已发布文章（直接走 store，避免 HTTP 开销）。 */
export function bulkSeedArticles(
  store: Container['stores']['article'],
  count: number,
  authorId: string,
  prefix: string = 'Bulk',
): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const rec = store.insert({
      title: `${prefix} Article ${i}`,
      content: `${prefix} body ${i} — ${'x'.repeat(50)}`,
      authorId,
      categoryId: null,
      tagIds: [],
      status: 'published',
      publishedAt: new Date().toISOString(),
    });
    ids.push(rec.id);
  }
  return ids;
}

/** 批量预置评论（直接走 store）。 */
export function bulkSeedComments(
  store: Container['stores']['comment'],
  count: number,
  articleId: string,
  userId: string,
): void {
  for (let i = 0; i < count; i++) {
    store.insert({ articleId, userId, content: `Bulk comment ${i}` });
  }
}

/**
 * 批量预置用户（直接走 store）。
 * 为避免 1000 次 bcrypt 哈希导致测试超时，仅对第一个密码做一次哈希后复用。
 * 内存测试关注 heap 占用而非密码安全性，复用哈希不影响内存测量有效性。
 */
export async function bulkSeedUsers(
  store: Container['stores']['user'],
  count: number,
): Promise<string[]> {
  const { PasswordHasher } = await import('../../src/utils/auth.js');
  // 仅哈希一次，后续用户复用同一哈希值（内存测试不验证密码安全性）
  const sharedHash = await PasswordHasher.hash('password123');
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const rec = store.insert({
      email: `bulk${i}@b.com`,
      passwordHash: sharedHash,
      role: 'reader',
    });
    ids.push(rec.id);
  }
  return ids;
}

/** 计算延迟分布的 P95（毫秒）。 */
export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? sorted[0]!;
}

/** 计算错误率（status >= 400 或非 2xx 计为错误）。 */
export function errorRate(statuses: number[]): number {
  if (statuses.length === 0) return 0;
  const errors = statuses.filter((s) => s < 200 || s >= 400).length;
  return errors / statuses.length;
}

/** 获取当前进程 heapUsed（字节）。 */
export function heapUsedMB(): number {
  return process.memoryUsage().heapUsed / (1024 * 1024);
}
