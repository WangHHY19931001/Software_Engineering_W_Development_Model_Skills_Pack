/**
 * AppFactory（DD-050 / SD-007）：Express 应用工厂（测试 seam 直连入口）。
 * 中间件链装配（rateLimit → auth → audit → routes → errorHandler）+ 路由注册顺序（接口设计 §5 29 条）
 * + 事件总线订阅装配（SD-005 通知、SD-006 Webhook、SD-004 索引，ID-4）。
 * 静态路径先于参数路径：/api/articles/hot 先于 /:id；/api/users/me/* 先于 /:id/follow。
 */
import express, { type Express } from 'express';
import { EventBus } from './utils/eventBus';
import { JwtUtil } from './utils/jwtUtil';
import { wrap } from './utils/asyncHandler';
import { StoreFactory } from './stores/storeFactory';
import { AuthService } from './services/identity/authService';
import { ProfileService } from './services/identity/profileService';
import { ArticleService } from './services/content/articleService';
import { ArticleStateMachine } from './services/content/articleStateMachine';
import { TagService } from './services/content/tagService';
import { CategoryService } from './services/content/categoryService';
import { ArticleBrowseService } from './services/interaction/articleBrowseService';
import { CommentService } from './services/interaction/commentService';
import { LikeService } from './services/interaction/likeService';
import { FollowService } from './services/interaction/followService';
import { HotService } from './services/discovery/hotService';
import { RecommendService } from './services/discovery/recommendService';
import { SearchService } from './services/discovery/searchService';
import { ReadingStatService } from './services/stats/readingStatService';
import { BloggerStatsService } from './services/stats/bloggerStatsService';
import { NotificationService } from './services/stats/notificationService';
import { RssService } from './services/integration/rssService';
import { WebhookService } from './services/integration/webhookService';
import { AuthMiddleware } from './middlewares/authMiddleware';
import { RateLimitMiddleware } from './middlewares/rateLimitMiddleware';
import { AuditMiddleware } from './middlewares/auditMiddleware';
import { ErrorMiddleware, notFoundHandler } from './middlewares/errorMiddleware';
import { AuthController } from './routes/identity/authController';
import { ArticleController } from './routes/content/articleController';
import { MetadataController } from './routes/content/metadataController';
import { BrowseController } from './routes/interaction/browseController';
import { CommentController } from './routes/interaction/commentController';
import { InteractionController } from './routes/interaction/interactionController';
import { DiscoveryController } from './routes/discovery/discoveryController';
import { StatsController } from './routes/stats/statsController';
import { IntegrationController } from './routes/integration/integrationController';
import { createAuthRouter } from './routes/auth.routes';
import { createUserRouter } from './routes/user.routes';
import { createArticleRouter } from './routes/article.routes';
import { createTagCategoryRouter } from './routes/tag-category.routes';
import { createCommentRouter } from './routes/comment.routes';
import { createInteractionRouter } from './routes/interaction.routes';
import { createFeedFollowRouter } from './routes/feed-follow.routes';
import { createDiscoveryRouter } from './routes/discovery.routes';
import { createStatsRouter } from './routes/stats.routes';
import { createNotificationRouter } from './routes/notification.routes';
import { createRssWebhookRouter } from './routes/rss-webhook.routes';

export interface AppDeps {
  /** 覆盖默认配置（单元/集成测试注入） */
  rateLimitAuth: { limit: number; windowMs: number };
  rateLimitApi: { limit: number; windowMs: number };
  /** 集成测试 seam-STORE：注入预置/可断言的 store 容器（可选；缺省创建全新内存存储，接口设计 §6） */
  stores?: StoreContainer;
  /** 阅读去重窗口（ms，ID-8 窗口参数化；集成测试可缩小窗口验证窗口过期语义，INTF-018） */
  readingDedupWindowMs?: number;
}

export function createApp(deps: Partial<AppDeps> = {}): Express {
  /* ============ 存储基座 ============ */
  // seam-STORE：集成测试注入预置 store 容器（避免重复初始化 50001）；缺省创建全新内存存储
  const stores = deps.stores ?? new StoreFactory().createStores();

  /* ============ 事件总线（ID-4） ============ */
  const eventBus = new EventBus();

  /* ============ 服务装配 ============ */
  const jwtUtil = new JwtUtil();
  const authService = new AuthService(stores.userStore, jwtUtil);
  const profileService = new ProfileService(stores.userStore);
  const articleStateMachine = new ArticleStateMachine();
  const articleService = new ArticleService(stores.articleStore, stores.tagStore, stores.categoryStore, articleStateMachine, authService, eventBus);
  const tagService = new TagService(stores.tagStore, stores.articleStore);
  const categoryService = new CategoryService(stores.categoryStore, stores.articleStore);
  // 阅读去重窗口参数化（ID-8）：测试可缩小窗口（seam-HTTP + seam-STORE 断言窗口过期语义）
  const readingStatService = new ReadingStatService(
    stores.readingRecordStore,
    undefined,
    deps.readingDedupWindowMs ? { windowMs: deps.readingDedupWindowMs } : {},
  );
  const articleBrowseService = new ArticleBrowseService(articleService, eventBus, readingStatService);
  const commentService = new CommentService(stores.commentStore, articleService, authService, eventBus);
  const likeService = new LikeService(stores.likeStore, stores.favoriteStore, articleService, eventBus);
  const followService = new FollowService(stores.followStore, authService, articleService, eventBus);
  const hotService = new HotService(readingStatService, articleService);
  const recommendService = new RecommendService(readingStatService, articleService, hotService);
  const searchService = new SearchService(stores.searchIndexStore, articleService);
  const bloggerStatsService = new BloggerStatsService(articleService, commentService, readingStatService);
  const notificationService = new NotificationService(stores.notificationStore, authService);
  const rssService = new RssService(authService, articleService);
  const webhookService = new WebhookService(stores.webhookConfigStore, stores.webhookDeliveryStore);

  /* ============ 事件订阅（SD-005 通知 / SD-006 Webhook / SD-004 索引） ============ */
  eventBus.on('article.published', (e) => {
    if (e.type !== 'article.published') return;
    const followerIds = stores.followStore.listFollowers(e.authorId);
    notificationService.onArticlePublished({ ...e, followerIds });
    webhookService.onArticlePublished(e);
    searchService.syncIndex(e);
  });
  eventBus.on('article.updated', (e) => searchService.syncIndex(e));
  eventBus.on('article.archived', (e) => searchService.syncIndex(e));
  eventBus.on('article.deleted', (e) => searchService.syncIndex(e));
  eventBus.on('comment.created', (e) => {
    if (e.type !== 'comment.created') return;
    notificationService.onCommentCreated(e);
    webhookService.onCommentCreated(e);
  });
  eventBus.on('article.liked', (e) => {
    if (e.type !== 'article.liked') return;
    void notificationService.onArticleLiked(e);
  });
  eventBus.on('follow.created', (e) => {
    if (e.type !== 'follow.created') return;
    notificationService.onFollowCreated(e);
  });
  eventBus.on('reading.viewed', (e) => {
    if (e.type !== 'reading.viewed') return;
    readingStatService.recordView(e.articleId, e.clientIp, e.userId ?? null);
  });

  /* ============ 控制器 ============ */
  const authController = new AuthController(authService, profileService);
  const articleController = new ArticleController(articleService);
  const metadataController = new MetadataController(tagService, categoryService);
  const browseController = new BrowseController(articleBrowseService, likeService, readingStatService, authService);
  const commentController = new CommentController(commentService, authService);
  const interactionController = new InteractionController(likeService, followService);
  const discoveryController = new DiscoveryController(hotService, recommendService, searchService, jwtUtil);
  const statsController = new StatsController(bloggerStatsService, notificationService);
  const integrationController = new IntegrationController(rssService, webhookService);

  /* ============ 中间件 ============ */
  const authMiddleware = new AuthMiddleware(jwtUtil);
  const authenticate = authMiddleware.authenticate.bind(authMiddleware);
  const requireBlogger = authMiddleware.requireBlogger.bind(authMiddleware);
  // 双限流器独立实例（NFR-006：认证 10/min/IP 与通用 100/min/IP 为两条独立限额，
  // 共享实例会让同路径计数器互相叠加——认证接口实际限额被折半）
  const authRateLimit = new RateLimitMiddleware();
  const apiRateLimit = new RateLimitMiddleware();
  const authLimiter = authRateLimit.rateLimit(deps.rateLimitAuth ?? { limit: 10, windowMs: 60000 });
  const apiLimiter = apiRateLimit.rateLimit(deps.rateLimitApi ?? { limit: 100, windowMs: 60000 });
  const auditMiddleware = new AuditMiddleware(stores.auditLogStore);
  const audit = (action: 'login' | 'publish' | 'delete') => auditMiddleware.audit(action);
  const errorMiddleware = new ErrorMiddleware();

  /* ============ 应用装配（路由注册顺序 = 接口设计 §5 29 条） ============ */
  const app = express();
  app.use(express.json());
  app.use('/api/', apiLimiter); // 通用限流 100/min/IP（NFR-006）
  app.use('/api/auth/', authLimiter); // 认证接口限流 10/min/IP（NFR-006，先于通用限流命中更严阈值）

  // 1 健康检查（公开）
  app.get('/api/health', (req, res) => {
    res.json({ code: 0, message: 'ok', data: { status: 'ok' } });
  });
  // 2-29 业务路由（INTF-001~022，静态路径先于参数路径，注册顺序 = 接口设计 §5 29 条）
  app.use(createAuthRouter({ controller: authController, audit }));
  app.use(createUserRouter({ authController, interactionController, authenticate }));
  app.use(createArticleRouter({
    articleController,
    browseController,
    discoveryController,
    authenticate,
    requireBlogger,
    audit,
  }));
  app.use(createTagCategoryRouter({ controller: metadataController, authenticate, requireBlogger }));
  app.use(createCommentRouter({ controller: commentController, authenticate }));
  app.use(createInteractionRouter({ controller: interactionController, authenticate }));
  app.use(createFeedFollowRouter({ controller: interactionController, authenticate }));
  app.use(createDiscoveryRouter({ controller: discoveryController }));
  app.use(createStatsRouter({ controller: statsController, authenticate, requireBlogger }));
  app.use(createNotificationRouter({ controller: statsController, authenticate }));
  app.use(createRssWebhookRouter({ controller: integrationController, authenticate, requireBlogger }));
  // 29 兜底 404 + 错误处理（最后挂载）
  app.use(notFoundHandler);
  app.use(errorMiddleware.errorHandler.bind(errorMiddleware));

  return app;
}
