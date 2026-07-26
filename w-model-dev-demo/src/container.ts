/**
 * 依赖装配容器（Dependency Injection Container）。
 * 集中创建所有 store/service/controller 实例。
 */
import { UserStore } from './stores/user.store.js';
import { ArticleStore } from './stores/article.store.js';
import { CommentStore } from './stores/comment.store.js';
import { TagStore } from './stores/tag.store.js';
import { CategoryStore } from './stores/category.store.js';
import { LikeStore } from './stores/like.store.js';
import { AuditLogStore } from './stores/audit.store.js';
import { PasswordResetStore } from './stores/password-reset.store.js';
import { UserProfileStore } from './stores/user-profile.store.js';
import { NotificationStore } from './stores/notification.store.js';
import { SubscriptionStore } from './stores/subscription.store.js';
import { WebhookStore } from './stores/webhook.store.js';
import { WsStore } from './stores/ws.store.js';
import { SiteStore } from './stores/site.store.js';

import { Logger } from './utils/logger.js';
import { JwtUtil } from './utils/auth.js';
import { AuthMiddleware, RbacService } from './utils/auth-middleware.js';
import { RateLimitMiddleware } from './utils/rate-limit.js';
import { AuditMiddleware } from './utils/audit-middleware.js';
import { ArticleStateMachine } from './utils/article-state-machine.js';
import { AtomFeedGenerator } from './utils/atom-feed-generator.js';

import { AuthService, LoginRateLimiter } from './services/auth.service.js';
import { UserService } from './services/user.service.js';
import { ArticleService } from './services/article.service.js';
import { CommentService } from './services/comment.service.js';
import { TagService } from './services/tag.service.js';
import { CategoryService } from './services/category.service.js';
import { SearchService, ArchiveService } from './services/search.service.js';
import { ArticleWorkflowService, LikeService } from './services/article-workflow.service.js';
import { AuditService } from './services/audit.service.js';
import { RssService } from './services/rss.service.js';
import { PasswordResetService } from './services/password-reset.service.js';
import { UserProfileService } from './services/user-profile.service.js';
import { WebhookService } from './services/webhook.service.js';
import { SiteService } from './services/site.service.js';
import { NotificationService, PushService } from './services/notification.service.js';

import { SiteController } from './controllers/site.controller.js';
import { UserController } from './controllers/user.controller.js';
import { ArticleController } from './controllers/article.controller.js';
import { CommentController } from './controllers/comment.controller.js';
import { TagController, CategoryController } from './controllers/taxonomy.controller.js';
import { SearchController, ArchiveController } from './controllers/search.controller.js';
import { AuditLogController } from './controllers/audit-log.controller.js';
import { RssController } from './controllers/rss.controller.js';
import { WebhookController } from './controllers/webhook.controller.js';

import { createApp, type AppControllers, type AppMiddleware } from './app.js';
import type { Express } from 'express';

export interface Container {
  app: Express;
  stores: {
    user: UserStore;
    article: ArticleStore;
    comment: CommentStore;
    tag: TagStore;
    category: CategoryStore;
    like: LikeStore;
    audit: AuditLogStore;
    passwordReset: PasswordResetStore;
    userProfile: UserProfileStore;
    notification: NotificationStore;
    subscription: SubscriptionStore;
    webhook: WebhookStore;
    ws: WsStore;
    site: SiteStore;
  };
  services: {
    auth: AuthService;
    user: UserService;
    article: ArticleService;
    comment: CommentService;
    tag: TagService;
    category: CategoryService;
    search: SearchService;
    archive: ArchiveService;
    workflow: ArticleWorkflowService;
    like: LikeService;
    audit: AuditService;
    rss: RssService;
    passwordReset: PasswordResetService;
    profile: UserProfileService;
    webhook: WebhookService;
    site: SiteService;
    notification: NotificationService;
    push: PushService;
  };
  controllers: AppControllers;
  middleware: AppMiddleware;
  utils: {
    jwt: JwtUtil;
    logger: Logger;
    rbac: RbacService;
    stateMachine: ArticleStateMachine;
    feedGenerator: AtomFeedGenerator;
  };
}

export function createContainer(jwtSecret?: string): Container {
  const secret = jwtSecret ?? process.env['JWT_SECRET'] ?? '';
  // NFR-002: HS256 密钥长度 ≥ 256 位（32 字节）。TC-SEC-001 验证 31/32/64 字节边界。
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET 未设置或长度不足 32 字节（256 位，NFR-002 / CON-002 安全约束）');
  }

  // utils
  const logger = new Logger('info');
  const jwt = new JwtUtil(secret);
  const rbac = new RbacService();
  const stateMachine = new ArticleStateMachine();
  const feedGenerator = new AtomFeedGenerator();

  // stores
  const userStore = new UserStore();
  const articleStore = new ArticleStore();
  const commentStore = new CommentStore();
  const tagStore = new TagStore();
  const categoryStore = new CategoryStore();
  const likeStore = new LikeStore();
  const auditLogStore = new AuditLogStore();
  const passwordResetStore = new PasswordResetStore();
  const userProfileStore = new UserProfileStore();
  const notificationStore = new NotificationStore();
  const subscriptionStore = new SubscriptionStore();
  const webhookStore = new WebhookStore();
  const wsStore = new WsStore();
  const siteStore = new SiteStore();

  // services
  const authService = new AuthService(userStore, jwt, new LoginRateLimiter());
  const userService = new UserService(userStore, userProfileStore);
  const articleService = new ArticleService(articleStore, commentStore, tagStore, categoryStore);
  const commentService = new CommentService(commentStore, articleStore);
  const tagService = new TagService(tagStore);
  const categoryService = new CategoryService(categoryStore);
  const searchService = new SearchService(articleStore);
  const archiveService = new ArchiveService(articleStore);
  const workflowService = new ArticleWorkflowService(articleStore, stateMachine);
  const likeService = new LikeService(likeStore, articleStore);
  const auditService = new AuditService(auditLogStore, logger);
  const rssService = new RssService(articleStore, feedGenerator);
  const passwordResetService = new PasswordResetService(userStore, passwordResetStore, logger);
  const profileService = new UserProfileService(userProfileStore, userStore);
  const webhookService = new WebhookService(webhookStore, logger);
  const siteService = new SiteService(siteStore);
  const notificationService = new NotificationService(notificationStore);
  const pushService = new PushService(wsStore);

  // controllers
  const siteController = new SiteController(siteService);
  const userController = new UserController(userService, authService, passwordResetService, profileService);
  const articleController = new ArticleController(articleService, workflowService, likeService);
  const commentController = new CommentController(commentService);
  const tagController = new TagController(tagService);
  const categoryController = new CategoryController(categoryService);
  const searchController = new SearchController(searchService);
  const archiveController = new ArchiveController(archiveService);
  const auditLogController = new AuditLogController(auditService);
  const rssController = new RssController(rssService);
  const webhookController = new WebhookController(webhookService);

  // middleware
  const authMiddleware = new AuthMiddleware(jwt);
  const rateLimitMiddleware = new RateLimitMiddleware();
  const auditMiddleware = new AuditMiddleware(auditService);

  const controllers: AppControllers = {
    site: siteController,
    user: userController,
    article: articleController,
    comment: commentController,
    tag: tagController,
    category: categoryController,
    search: searchController,
    archive: archiveController,
    auditLog: auditLogController,
    rss: rssController,
    webhook: webhookController,
  };

  const middleware: AppMiddleware = {
    auth: authMiddleware,
    rateLimit: rateLimitMiddleware,
    audit: auditMiddleware,
  };

  const app = createApp(controllers, middleware);

  return {
    app,
    stores: {
      user: userStore,
      article: articleStore,
      comment: commentStore,
      tag: tagStore,
      category: categoryStore,
      like: likeStore,
      audit: auditLogStore,
      passwordReset: passwordResetStore,
      userProfile: userProfileStore,
      notification: notificationStore,
      subscription: subscriptionStore,
      webhook: webhookStore,
      ws: wsStore,
      site: siteStore,
    },
    services: {
      auth: authService,
      user: userService,
      article: articleService,
      comment: commentService,
      tag: tagService,
      category: categoryService,
      search: searchService,
      archive: archiveService,
      workflow: workflowService,
      like: likeService,
      audit: auditService,
      rss: rssService,
      passwordReset: passwordResetService,
      profile: profileService,
      webhook: webhookService,
      site: siteService,
      notification: notificationService,
      push: pushService,
    },
    controllers,
    middleware,
    utils: { jwt, logger, rbac, stateMachine, feedGenerator },
  };
}
