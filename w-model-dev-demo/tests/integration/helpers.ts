/**
 * 集成测试通用工具（阶段 6，seam-HTTP + seam-STORE，接口设计 §6）。
 * - seam-HTTP：supertest 直连 createApp（不启真实端口）；createApp 支持注入 store 容器（AppDeps.stores）。
 * - seam-STORE：预置种子数据（用户/博主/文章/标签/分类/评论/阅读记录/通知）+ WebhookDelivery/Notification/AuditLog store 快照断言。
 * - 外部契约 seam：本地 mock HTTP 回调服务（Webhook 接收端，D-04，INTF-022）。
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp, type AppDeps } from '../../src/app';
import { StoreFactory, type StoreContainer } from '../../src/stores/storeFactory';
import type { Article, ArticleStatus, Category, Comment, Notification, ReadingRecord, Role, Tag, User } from '../../src/types';

export const TEST_PASSWORD = 'Passw0rd!x';
export const PASSWORD_HASH = await bcrypt.hash(TEST_PASSWORD, 10);

export interface TestEnv {
  app: Express;
  stores: StoreContainer;
}

export interface TestEnvOptions {
  readingDedupWindowMs?: number;
  rateLimitAuth?: AppDeps['rateLimitAuth'];
  rateLimitApi?: AppDeps['rateLimitApi'];
}

/** 创建测试环境：全新内存 store 容器 + Express app（每用例独立，天然隔离） */
export function createTestEnv(options: TestEnvOptions = {}): TestEnv {
  const storeFactory = new StoreFactory();
  const stores = storeFactory.createStores();
  const app = createApp({
    stores,
    ...(options.readingDedupWindowMs !== undefined ? { readingDedupWindowMs: options.readingDedupWindowMs } : {}),
    ...(options.rateLimitAuth ? { rateLimitAuth: options.rateLimitAuth } : {}),
    ...(options.rateLimitApi ? { rateLimitApi: options.rateLimitApi } : {}),
  });
  return { app, stores };
}

/* ============ seam-STORE 种子数据 ============ */

export interface SeedUserOptions {
  username: string;
  email: string;
  password?: string;
  role?: Role;
  id?: string;
}

export async function seedUser(stores: StoreContainer, opts: SeedUserOptions): Promise<User> {
  const passwordHash = opts.password && opts.password !== TEST_PASSWORD ? await bcrypt.hash(opts.password, 10) : PASSWORD_HASH;
  return stores.userStore.create({
    id: opts.id,
    username: opts.username,
    email: opts.email,
    passwordHash,
    role: opts.role ?? 'reader',
    createdAt: new Date().toISOString(),
  });
}

export function seedTag(stores: StoreContainer, name: string): Tag {
  return stores.tagStore.create({ name, createdAt: new Date().toISOString() });
}

export interface SeedCategoryOptions {
  name: string;
  parentId?: string | null;
  depth?: number;
  id?: string;
}

export function seedCategory(stores: StoreContainer, opts: SeedCategoryOptions): Category {
  return stores.categoryStore.create({
    id: opts.id,
    parentId: opts.parentId ?? null,
    name: opts.name,
    depth: opts.depth ?? 1,
    createdAt: new Date().toISOString(),
  });
}

export interface SeedArticleOptions {
  id?: string;
  authorId: string;
  title: string;
  body?: string;
  summary?: string;
  tags?: string[];
  categoryId?: string | null;
  status?: ArticleStatus;
  publishedAt?: string | null;
}

export function seedArticle(stores: StoreContainer, opts: SeedArticleOptions): Article {
  const now = new Date().toISOString();
  const status = opts.status ?? 'draft';
  return stores.articleStore.create({
    id: opts.id,
    authorId: opts.authorId,
    title: opts.title,
    body: opts.body ?? '默认正文内容',
    summary: opts.summary ?? '',
    categoryId: opts.categoryId ?? null,
    status,
    tags: opts.tags ?? [],
    publishedAt: opts.publishedAt !== undefined ? opts.publishedAt : status === 'published' ? now : null,
    createdAt: now,
    updatedAt: now,
  });
}

export interface SeedCommentOptions {
  id?: string;
  articleId: string;
  authorId: string;
  content: string;
  parentId?: string | null;
  createdAt?: string;
}

export function seedComment(stores: StoreContainer, opts: SeedCommentOptions): Comment {
  return stores.commentStore.create({
    id: opts.id,
    articleId: opts.articleId,
    authorId: opts.authorId,
    parentId: opts.parentId ?? null,
    content: opts.content,
    createdAt: opts.createdAt ?? new Date().toISOString(),
  });
}

export interface SeedNotificationOptions {
  id?: string;
  userId: string;
  type: Notification['type'];
  articleId?: string | null;
  actorId?: string | null;
  actorName?: string;
  content?: string;
  read?: boolean;
  createdAt?: string;
}

export function seedNotification(stores: StoreContainer, opts: SeedNotificationOptions): Notification {
  return stores.notificationStore.create({
    id: opts.id,
    userId: opts.userId,
    type: opts.type,
    articleId: opts.articleId ?? null,
    actorId: opts.actorId ?? null,
    actorName: opts.actorName ?? '',
    content: opts.content ?? '',
    read: opts.read ?? false,
    createdAt: opts.createdAt ?? new Date().toISOString(),
  });
}

export interface SeedReadingRecordOptions {
  articleId: string;
  clientIp?: string;
  userId?: string | null;
  viewedAt: string;
}

export function seedReadingRecord(stores: StoreContainer, opts: SeedReadingRecordOptions): ReadingRecord {
  return stores.readingRecordStore.add({
    articleId: opts.articleId,
    clientIp: opts.clientIp ?? '127.0.0.1',
    userId: opts.userId ?? null,
    viewedAt: opts.viewedAt,
  });
}

/* ============ seam-HTTP 业务辅助 ============ */

export async function register(app: Express, username: string, email: string, password = TEST_PASSWORD): Promise<string> {
  const res = await request(app).post('/api/auth/register').send({ username, email, password });
  if (res.status !== 201) {
    throw new Error(`register 失败：${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data.userId as string;
}

export interface LoginResult {
  token: string;
  userId: string;
  role: Role;
}

export async function login(app: Express, identifier: string, password = TEST_PASSWORD): Promise<LoginResult> {
  const res = await request(app).post('/api/auth/login').send({ identifier, password });
  if (res.status !== 200) {
    throw new Error(`login 失败：${res.status} ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.data.token, userId: res.body.data.user.userId, role: res.body.data.user.role };
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/* ============ 通用等待（异步投递/事件消费轮询） ============ */

export interface PollOptions {
  timeoutMs?: number;
  intervalMs?: number;
  message?: string;
}

export async function pollUntil<T>(
  fn: () => T | Promise<T>,
  predicate: (value: T) => boolean,
  options: PollOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const intervalMs = options.intervalMs ?? 50;
  const startedAt = Date.now();
  for (;;) {
    const value = await fn();
    if (predicate(value)) return value;
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(options.message ?? `pollUntil 超时（${timeoutMs}ms）`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/* ============ 本地 mock Webhook 回调服务（D-04 / INTF-022） ============ */

export interface MockWebhookRequest {
  headers: Record<string, string>;
  body: string;
  event: string;
}

export interface MockWebhookServer {
  url: string;
  requests: MockWebhookRequest[];
  /** 收到请求总数（含重试） */
  count(): number;
  close(): Promise<void>;
}

export function startMockServer(options: { status?: number } = {}): Promise<MockWebhookServer> {
  return new Promise((resolve) => {
    const requests: MockWebhookRequest[] = [];
    const server: Server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(req.headers)) {
          if (typeof value === 'string') headers[key] = value;
        }
        requests.push({ headers, body, event: headers['x-blog-event'] ?? '' });
        res.writeHead(options.status ?? 200, { 'Content-Type': 'application/json' });
        res.end('{}');
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${addr.port}/hook`,
        requests,
        count: () => requests.length,
        close: () =>
          new Promise<void>((resolveClose, rejectClose) => {
            server.close((err) => (err ? rejectClose(err) : resolveClose()));
          }),
      });
    });
  });
}
