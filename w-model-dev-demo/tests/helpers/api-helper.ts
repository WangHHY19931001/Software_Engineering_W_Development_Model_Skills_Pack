/**
 * HTTP 测试公共辅助 —— 用于集成/系统/验收测试
 *
 * 提供应用重置、用户注册/登录、JWT token 生成、supertest 请求封装。
 */
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetContainer } from '../../src/container.js';
import { userStore } from '../../src/stores/user-store.js';
import { articleStore } from '../../src/stores/article-store.js';
import { TagService } from '../../src/services/content/tag-service.js';
import { CategoryService } from '../../src/services/content/category-service.js';
import { CommentService } from '../../src/services/interaction/comment-service.js';
import { NotificationService } from '../../src/services/interaction/notification-service.js';
import { RateLimiter } from '../../src/middleware/rate-limiter.js';

export interface UserTokens {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** 重置全部应用状态：容器 + 存储 + 限流器 + 静态状态 */
export function resetAppState(): void {
  resetContainer();
  userStore.clear();
  articleStore.clear();
  TagService._reset();
  CategoryService._reset();
  CommentService._reset();
  NotificationService._reset();
  RateLimiter.clear();
}

/** 创建全新 Express 应用实例 */
export function createTestApp(): Express {
  resetAppState();
  return createApp();
}

/** 构造 Authorization header */
export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** 注册用户并返回 token */
export async function registerUser(
  app: Express,
  email: string,
  password = 'Pass1234',
  nickname?: string,
  role?: string,
): Promise<UserTokens> {
  const body: Record<string, string> = { email, password, nickname: nickname ?? email.split('@')[0] };
  if (role) body.role = role;
  const res = await request(app).post('/api/auth/register').send(body);
  if (res.status !== 201) {
    throw new Error(`注册失败 (${email}): status=${res.status}, body=${JSON.stringify(res.body)}`);
  }
  return res.body as UserTokens;
}

/** 登录并返回 token */
export async function loginUser(
  app: Express,
  email: string,
  password = 'Pass1234',
): Promise<UserTokens> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`登录失败 (${email}): status=${res.status}, body=${JSON.stringify(res.body)}`);
  }
  return res.body as UserTokens;
}

/** 创建文章（需 blogger/admin token） */
export async function createArticle(
  app: Express,
  token: string,
  input: { title?: string; content?: string; summary?: string; status?: string; tagIds?: string[]; citeArticleIds?: string[] },
): Promise<{ id: string; title: string; status: string; authorId: string; [k: string]: unknown }> {
  const res = await request(app)
    .post('/api/articles')
    .set(authHeader(token))
    .send({
      title: input.title ?? 'Test Article',
      content: input.content ?? 'Test content',
      summary: input.summary,
      tagIds: input.tagIds,
      citeArticleIds: input.citeArticleIds,
    });
  if (res.status !== 201) {
    throw new Error(`创建文章失败: status=${res.status}, body=${JSON.stringify(res.body)}`);
  }
  return res.body;
}

/** 文章状态转换 */
export async function transitionArticle(
  app: Express,
  token: string,
  articleId: string,
  toState: string,
): Promise<{ articleId: string; previousState: string; targetState: string }> {
  const res = await request(app)
    .post(`/api/articles/${articleId}/transition`)
    .set(authHeader(token))
    .send({ toState });
  return res.body;
}

/** 注册四类角色用户并返回 token */
export async function setupAllRoles(
  app: Express,
): Promise<{ user: UserTokens; blogger: UserTokens; admin: UserTokens; superAdmin: UserTokens }> {
  const user = await registerUser(app, 'user@test.com', 'Pass1234', 'userA', 'user');
  const blogger = await registerUser(app, 'blogger@test.com', 'Pass1234', 'bloggerA', 'blogger');
  const admin = await registerUser(app, 'admin@test.com', 'Pass1234', 'adminA', 'admin');
  const superAdmin = await registerUser(app, 'superadmin@test.com', 'Pass1234', 'superA', 'super_admin');
  return { user, blogger, admin, superAdmin };
}

/** 便捷 supertest 封装 */
export const req = request;
