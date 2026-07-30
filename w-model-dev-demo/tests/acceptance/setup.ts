/**
 * 阶段 8 验收测试全局 setup
 *
 * 提供：
 * - 应用实例（已挂载全部中间件 + 22 INTF 路由 + RSS 路由）
 * - 全局 stores（17 个 repository，用于白盒校验副作用）
 * - JWT 签发工具
 * - 限流 bypass 头注入
 * - 测试间隔离
 *
 * 与系统测试 setup 相同的结构，但独立维护以隔离阶段 7/8 之间的 module-level 单例。
 */
import type { Application } from 'express';
import supertest from 'supertest';
import { buildServices } from '../../src/infrastructure/index.js';
import { createRouters } from '../../src/infrastructure/router.js';
import { createApp } from '../../src/infrastructure/app.js';
import { getEnv, resetEnv } from '../../src/utils/env.js';
import { signToken as signTokenImpl } from '../../src/utils/jwt.js';
import { resetRateLimitStore } from '../../src/middleware/rate-limit.middleware.js';
import { resetIdCounter } from '../../src/utils/id.js';
import { UserRole, type ArticleStatus } from '../../src/types/index.js';
import type { ServiceRegistry } from '../../src/infrastructure/routes.js';
import { UserRepository } from '../../src/repositories/user.repository.js';
import { BloggerRepository } from '../../src/repositories/blogger.repository.js';
import { ArticleRepository } from '../../src/repositories/article.repository.js';
import { CommentRepository } from '../../src/repositories/comment.repository.js';
import { NotificationRepository } from '../../src/repositories/notification.repository.js';
import { TagRepository } from '../../src/repositories/tag.repository.js';
import { WebhookRepository } from '../../src/repositories/webhook.repository.js';
import { SiteConfigRepository } from '../../src/repositories/site-config.repository.js';
import { AuditLogRepository } from '../../src/repositories/audit-log.repository.js';
import { ViewRecordRepository } from '../../src/repositories/view-record.repository.js';
import { FollowRepository } from '../../src/repositories/follow.repository.js';
import { AdSlotRepository } from '../../src/repositories/ad-slot.repository.js';
import { StatsRepository } from '../../src/repositories/stats.repository.js';
import { LikeRepositoryImpl } from '../../src/services/like.service.js';
import { FavoriteRepositoryImpl } from '../../src/services/favorite.service.js';

export interface AcceptanceContext {
  app: Application;
  services: ServiceRegistry;
  repos: AcceptanceRepos;
  signToken(payload: { sub: string; role: UserRole }, expiresInSeconds?: number): string;
  api(): {
    get: (url: string) => ReturnType<ReturnType<typeof supertest>['get']>;
    post: (url: string) => ReturnType<ReturnType<typeof supertest>['post']>;
    put: (url: string) => ReturnType<ReturnType<typeof supertest>['put']>;
    delete: (url: string) => ReturnType<ReturnType<typeof supertest>['delete']>;
    patch: (url: string) => ReturnType<ReturnType<typeof supertest>['patch']>;
  };
  resetAll(): Promise<void>;
  seq(prefix: string): string;
  registerUser(opts?: {
    email?: string;
    username?: string;
    role?: UserRole;
    password?: string;
  }): Promise<{ userId: string; token: string; role: UserRole }>;
  registerBlogger(opts?: {
    email?: string;
    username?: string;
    password?: string;
    displayName?: string;
  }): Promise<{ userId: string; bloggerId: string; token: string }>;
  registerAdmin(opts?: { email?: string; username?: string; password?: string }): Promise<{
    userId: string;
    token: string;
  }>;
  publishArticle(opts: {
    authorId: string;
    title?: string;
    content?: string;
    tagIds?: string[];
    status?: ArticleStatus;
  }): Promise<{ articleId: string; authorId: string }>;
}

export interface AcceptanceRepos {
  userRepo: UserRepository;
  bloggerRepo: BloggerRepository;
  articleRepo: ArticleRepository;
  commentRepo: CommentRepository;
  notificationRepo: NotificationRepository;
  tagRepo: TagRepository;
  webhookRepo: WebhookRepository;
  siteConfigRepo: SiteConfigRepository;
  auditLogRepo: AuditLogRepository;
  viewRecordRepo: ViewRecordRepository;
  followRepo: FollowRepository;
  adSlotRepo: AdSlotRepository;
  statsRepo: StatsRepository;
  likeRepo: LikeRepositoryImpl;
  favoriteRepo: FavoriteRepositoryImpl;
}

export function setupAcceptanceTest(): AcceptanceContext {
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-blog-demo';
  process.env.BCRYPT_COST = process.env.BCRYPT_COST ?? '4';
  process.env.RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW_MS ?? '60000';
  process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX ?? '100';
  process.env.WEBHOOK_MAX_ATTEMPTS = process.env.WEBHOOK_MAX_ATTEMPTS ?? '3';
  process.env.WEBHOOK_BASE_BACKOFF_MS = process.env.WEBHOOK_BASE_BACKOFF_MS ?? '10';
  process.env.NODE_ENV = 'test';
  resetEnv();

  resetRateLimitStore();
  resetIdCounter();

  const { services, repos } = buildServices() as unknown as {
    services: ServiceRegistry;
    repos: AcceptanceRepos;
  };
  const env = getEnv();
  const routers = createRouters({ services });
  const app = createApp({ apiRouter: routers.apiRouter, rssRouter: routers.rssRouter, env });

  const BYPASS_HEADERS = { 'x-test-bypass-rate-limit': 'true' };

  let userSeq = 0;
  function seq(prefix: string): string {
    userSeq += 1;
    return `${prefix}${userSeq}`;
  }

  async function registerUser(opts?: {
    email?: string;
    username?: string;
    role?: UserRole;
    password?: string;
  }): Promise<{ userId: string; token: string; role: UserRole }> {
    const o = opts ?? {};
    const role = o.role ?? UserRole.READER;
    const r = await services.auth.register({
      email: o.email ?? `u${seq('u')}@e.com`,
      username: o.username ?? `user_${seq('un')}`,
      password: o.password ?? 'password123',
      role,
    });
    return { userId: r.user.id, token: r.token, role };
  }

  async function registerBlogger(opts?: {
    email?: string;
    username?: string;
    password?: string;
    displayName?: string;
  }): Promise<{ userId: string; bloggerId: string; token: string }> {
    const o = opts ?? {};
    const username = o.username ?? `blogger_${seq('b')}`;
    const r = await services.auth.register({
      email: o.email ?? `b${seq('be')}@e.com`,
      username,
      password: o.password ?? 'password123',
      nickname: o.displayName ?? username,
      role: UserRole.BLOGGER,
    });
    return { userId: r.user.id, bloggerId: r.user.id, token: r.token };
  }

  async function registerAdmin(opts?: { email?: string; username?: string; password?: string }): Promise<{
    userId: string;
    token: string;
  }> {
    const o = opts ?? {};
    const r = await services.auth.register({
      email: o.email ?? `a${seq('ae')}@e.com`,
      username: o.username ?? `admin_${seq('an')}`,
      password: o.password ?? 'password123',
      role: UserRole.ADMIN,
    });
    return { userId: r.user.id, token: r.token };
  }

  async function publishArticle(opts?: {
    authorId: string;
    title?: string;
    content?: string;
    tagIds?: string[];
    status?: ArticleStatus;
  }): Promise<{ articleId: string; authorId: string }> {
    const o = opts ?? { authorId: '' };
    const article = await services.article.create(o.authorId, {
      title: o.title ?? `Article ${seq('a')}`,
      content: o.content ?? 'Hello world',
      summary: '',
      tagIds: o.tagIds ?? [],
    });
    if (o.status === undefined || o.status === ('published' as ArticleStatus)) {
      const updated = await services.article.transition(article.id, o.authorId, 'publish');
      return { articleId: updated.id, authorId: o.authorId };
    }
    return { articleId: article.id, authorId: o.authorId };
  }

  async function resetAll(): Promise<void> {
    await Promise.all([
      repos.userRepo.clear(),
      repos.bloggerRepo.clear(),
      repos.articleRepo.clear(),
      repos.commentRepo.clear(),
      repos.notificationRepo.clear(),
      repos.tagRepo.clear(),
      repos.webhookRepo.clear(),
      repos.siteConfigRepo.clear(),
      repos.auditLogRepo.clear(),
      repos.viewRecordRepo.clear(),
      repos.followRepo.clear(),
      repos.adSlotRepo.clear(),
      repos.statsRepo.clear(),
      repos.likeRepo.clear(),
      repos.favoriteRepo.clear(),
    ]);
    resetRateLimitStore();
    resetIdCounter();
    userSeq = 0;
    await services.siteConfig.ensureExists();
    (services.webhook as unknown as { resetQueue?: () => void }).resetQueue?.();
  }

  function signToken(
    payload: { sub: string; role: UserRole },
    expiresInSeconds?: number,
  ): string {
    return signTokenImpl(payload, { expiresInSeconds }).token;
  }

  function api() {
    const agent = supertest(app);
    return {
      get: (url: string) => agent.get(url).set(BYPASS_HEADERS),
      post: (url: string) => agent.post(url).set(BYPASS_HEADERS),
      put: (url: string) => agent.put(url).set(BYPASS_HEADERS),
      delete: (url: string) => agent.delete(url).set(BYPASS_HEADERS),
      patch: (url: string) => agent.patch(url).set(BYPASS_HEADERS),
    };
  }

  return {
    app,
    services,
    repos: repos as AcceptanceRepos,
    signToken,
    api,
    resetAll,
    seq,
    registerUser,
    registerBlogger,
    registerAdmin,
    publishArticle,
  };
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
