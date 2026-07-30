/**
 * 集成测试全局 setup（阶段 6 - W 模型）
 *
 * 提供：
 * - 应用实例（已挂载全部中间件 + 22 INTF 路由 + RSS 路由）
 * - 全局 stores（17 个 repository，用于白盒校验副作用）
 * - JWT 签发工具（直签 token，绕过 bcrypt + 注册流程）
 * - 限流 bypass 头注入（除限流自身测试外）
 * - 时间注入（clockMock）
 * - 测试间隔离（每个 setupIntegrationTest() 调用产生全新 service + repo 实例）
 *
 * 测试间隔离策略：
 * - buildServices() 每次调用产出新的 repo 实例 → 测试间状态自动隔离
 * - 限流 store 为 module-level 单例 → resetRateLimitStore() 重置
 * - 计数器（id）也需 reset 以保持可预测
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

/**
 * 集成测试上下文：每个 describe 之前由 setupIntegrationTest() 构造一次
 */
export interface IntegrationContext {
  app: Application;
  services: ServiceRegistry;
  repos: IntegrationRepos;
  signToken(payload: { sub: string; role: UserRole }, expiresInSeconds?: number): string;
  api(): {
    get: (url: string) => ReturnType<ReturnType<typeof supertest>['get']>;
    post: (url: string) => ReturnType<ReturnType<typeof supertest>['post']>;
    put: (url: string) => ReturnType<ReturnType<typeof supertest>['put']>;
    delete: (url: string) => ReturnType<ReturnType<typeof supertest>['delete']>;
    patch: (url: string) => ReturnType<ReturnType<typeof supertest>['patch']>;
  };
  resetAll(): Promise<void>;
  clockMock: {
    now: number;
    advance(ms: number): void;
    reset(): void;
  };
  /**
   * 工厂方法：注册一个 reader 并返回 { user, token }
   */
  registerUser(opts?: {
    email?: string;
    username?: string;
    role?: UserRole;
    password?: string;
  }): Promise<{ userId: string; token: string; role: UserRole }>;
  /**
   * 工厂方法：注册一个 blogger（同时注册 user + 升级 blogger）
   */
  registerBlogger(opts?: {
    email?: string;
    username?: string;
    password?: string;
    displayName?: string;
  }): Promise<{ userId: string; bloggerId: string; token: string }>;
  /**
   * 工厂方法：注册一个 admin
   */
  registerAdmin(opts?: { email?: string; username?: string; password?: string }): Promise<{
    userId: string;
    token: string;
  }>;
  /**
   * 工厂方法：创建一个已发布的 article
   */
  publishArticle(opts: {
    authorId: string;
    title?: string;
    content?: string;
    tagIds?: string[];
    status?: ArticleStatus;
  }): Promise<{ articleId: string; authorId: string }>;
  /**
   * 工具：生成一个计数器
   */
  seq(prefix: string): string;
}

export interface IntegrationRepos {
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

/**
 * 构造一个集成测试上下文
 *
 * 用法：
 * ```ts
 * let ctx: IntegrationContext;
 * beforeEach(() => { ctx = setupIntegrationTest(); });
 * ```
 */
export function setupIntegrationTest(): IntegrationContext {
  // 确保 JWT_SECRET 已设置（防漏）
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-blog-demo';
  process.env.BCRYPT_COST = process.env.BCRYPT_COST ?? '4';
  process.env.RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW_MS ?? '60000';
  process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX ?? '100';
  process.env.WEBHOOK_MAX_ATTEMPTS = process.env.WEBHOOK_MAX_ATTEMPTS ?? '3';
  process.env.WEBHOOK_BASE_BACKOFF_MS = process.env.WEBHOOK_BASE_BACKOFF_MS ?? '10';
  process.env.NODE_ENV = 'test';
  resetEnv();

  // 重置 module-level 限流 store
  resetRateLimitStore();
  resetIdCounter();

  // 构建新一组 services + repos（每个 test 全新）
  const { services, repos } = buildServices() as unknown as {
    services: ServiceRegistry;
    repos: IntegrationRepos;
  };
  const env = getEnv();
  const routers = createRouters({ services });
  const app = createApp({ apiRouter: routers.apiRouter, rssRouter: routers.rssRouter, env });

  // clockMock：用于 TC-INT-019 投放期 / TC-INT-013 重试
  const clockMock = {
    now: Date.now(),
    advance(ms: number) {
      this.now += ms;
      // 简单 stub：通过 Date.now 覆盖（部分库可能不受影响，但 view-record / ad 已使用 Date.now）
    },
    reset() {
      this.now = Date.now();
    },
  };

  // 自动限流 bypass 头
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

  async function registerAdmin(opts?: {
    email?: string;
    username?: string;
    password?: string;
  }): Promise<{ userId: string; token: string }> {
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
      // 默认发布
      const updated = await services.article.transition(
        article.id,
        o.authorId,
        'publish',
      );
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
    clockMock.reset();
    userSeq = 0;
    // 重新初始化 site_config
    await services.siteConfig.ensureExists();
    // 重新初始化 webhook queue（webhook service 模块状态）
    (services.webhook as unknown as { resetQueue?: () => void }).resetQueue?.();
  }

  function signToken(
    payload: { sub: string; role: UserRole },
    expiresInSeconds?: number,
  ): string {
    return signTokenImpl(payload, { expiresInSeconds }).token;
  }

  function api() {
    // supertest 接受 app 并自动注入 bypass header 到每个请求
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
    repos: repos as IntegrationRepos,
    signToken,
    api,
    resetAll,
    clockMock,
    registerUser,
    registerBlogger,
    registerAdmin,
    publishArticle,
    seq,
  };
}

/**
 * 工具：构造 Authorization 头
 */
export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
