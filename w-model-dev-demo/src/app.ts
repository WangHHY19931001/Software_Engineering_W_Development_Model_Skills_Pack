// Express app — wires all stores, services, controllers; registers routes.

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { errorHandler } from './utils/errors.js';

// Stores
import { SiteStore } from './stores/site.store.js';
import { BloggerStore } from './stores/blogger.store.js';
import { UserStore } from './stores/user.store.js';
import { ArticleStore } from './stores/article.store.js';
import { CommentStore } from './stores/comment.store.js';
import { NotificationStore } from './stores/notification.store.js';
import { FileStore } from './stores/file.store.js';
import { SubscriptionStore } from './stores/subscription.store.js';
import { WsStore } from './stores/ws.store.js';
import { BackupStore } from './stores/backup.store.js';
import { SearchStore } from './stores/search.store.js';
import { TagStore } from './stores/tag.store.js';
import { CategoryStore } from './stores/category.store.js';
import { AdStore } from './stores/ad.store.js';
import { RecommendStore } from './stores/recommend.store.js';
import { StatsStore } from './stores/stats.store.js';
import { CrossReferenceStore } from './stores/crossref.store.js';

// Services
import { AuthService, UserService } from './services/auth.service.js';
import { SiteService } from './services/site.service.js';
import { BloggerService } from './services/blogger.service.js';
import { ArticleService } from './services/article.service.js';
import { CommentService } from './services/comment.service.js';
import { NotificationService } from './services/notification.service.js';
import { FileService } from './services/file.service.js';
import { SubscriptionService } from './services/subscription.service.js';
import { PushService } from './services/push.service.js';
import { BackupService } from './services/backup.service.js';
import { SearchService } from './services/search.service.js';
import { TagService } from './services/tag.service.js';
import { CategoryService } from './services/category.service.js';
import { AdService } from './services/ad.service.js';
import { RecommendService } from './services/recommend.service.js';
import { StatsService } from './services/stats.service.js';
import { CrossReferenceService } from './services/crossref.service.js';

// Controllers
import { SiteController } from './controllers/site.controller.js';
import { BloggerController } from './controllers/blogger.controller.js';
import { UserController } from './controllers/user.controller.js';
import { RecommendController } from './controllers/recommend.controller.js';
import { AdController } from './controllers/ad.controller.js';
import { StatsController } from './controllers/stats.controller.js';
import { SearchController } from './controllers/search.controller.js';
import { TagController } from './controllers/tag.controller.js';
import { CategoryController } from './controllers/category.controller.js';
import { CommentController } from './controllers/comment.controller.js';
import { NotificationController } from './controllers/notification.controller.js';
import { ArticleController } from './controllers/article.controller.js';
import { CrossReferenceController } from './controllers/crossref.controller.js';
import { PushController } from './controllers/push.controller.js';
import { FileController } from './controllers/file.controller.js';
import { SubscriptionController } from './controllers/subscription.controller.js';
import { BackupController } from './controllers/backup.controller.js';

export interface AppDeps {
  // Stores
  siteStore: SiteStore;
  bloggerStore: BloggerStore;
  userStore: UserStore;
  articleStore: ArticleStore;
  commentStore: CommentStore;
  notificationStore: NotificationStore;
  fileStore: FileStore;
  subscriptionStore: SubscriptionStore;
  wsStore: WsStore;
  backupStore: BackupStore;
  searchStore: SearchStore;
  tagStore: TagStore;
  categoryStore: CategoryStore;
  adStore: AdStore;
  recommendStore: RecommendStore;
  statsStore: StatsStore;
  crossRefStore: CrossReferenceStore;
  // Services
  authService: AuthService;
  userService: UserService;
  siteService: SiteService;
  bloggerService: BloggerService;
  articleService: ArticleService;
  commentService: CommentService;
  notificationService: NotificationService;
  fileService: FileService;
  subscriptionService: SubscriptionService;
  pushService: PushService;
  backupService: BackupService;
  searchService: SearchService;
  tagService: TagService;
  categoryService: CategoryService;
  adService: AdService;
  recommendService: RecommendService;
  statsService: StatsService;
  crossRefService: CrossReferenceService;
}

export function createDeps(): AppDeps {
  // Stores
  const siteStore = new SiteStore();
  const bloggerStore = new BloggerStore();
  const userStore = new UserStore();
  const articleStore = new ArticleStore();
  const commentStore = new CommentStore();
  const notificationStore = new NotificationStore();
  const fileStore = new FileStore();
  const subscriptionStore = new SubscriptionStore();
  const wsStore = new WsStore();
  const backupStore = new BackupStore();
  const searchStore = new SearchStore();
  const tagStore = new TagStore();
  const categoryStore = new CategoryStore();
  const adStore = new AdStore();
  const recommendStore = new RecommendStore();
  const statsStore = new StatsStore();
  const crossRefStore = new CrossReferenceStore();

  // Wire store dependencies (SiteStore aggregates stats from other stores).
  siteStore.setStores({
    userStore,
    bloggerStore,
    articleStore,
    commentStore,
    fileStore,
  });

  // Services (order matters for dependency injection)
  const authService = new AuthService(userStore);
  const userService = new UserService(userStore, authService);
  const siteService = new SiteService(siteStore);
  const bloggerService = new BloggerService(bloggerStore, userStore, subscriptionStore);
  const articleService = new ArticleService(articleStore, searchStore, userStore);
  const commentService = new CommentService(commentStore, articleStore, siteStore);
  const notificationService = new NotificationService(notificationStore);
  const fileService = new FileService(fileStore, userStore);
  const pushService = new PushService(wsStore);
  const subscriptionService = new SubscriptionService(
    subscriptionStore,
    userStore,
    bloggerStore,
    tagStore,
    categoryStore,
    pushService,
  );
  const backupService = new BackupService(
    backupStore,
    userStore,
    bloggerStore,
    articleStore,
    commentStore,
    notificationStore,
    fileStore,
  );
  const searchService = new SearchService(searchStore);
  const tagService = new TagService(tagStore);
  const categoryService = new CategoryService(categoryStore);
  const adService = new AdService(adStore);
  const recommendService = new RecommendService(recommendStore, articleStore, subscriptionStore);
  const statsService = new StatsService(statsStore);
  const crossRefService = new CrossReferenceService(crossRefStore, articleStore, tagStore);

  return {
    siteStore, bloggerStore, userStore, articleStore, commentStore,
    notificationStore, fileStore, subscriptionStore, wsStore, backupStore,
    searchStore, tagStore, categoryStore, adStore, recommendStore, statsStore,
    crossRefStore,
    authService, userService, siteService, bloggerService, articleService,
    commentService, notificationService, fileService, subscriptionService,
    pushService, backupService, searchService, tagService, categoryService,
    adService, recommendService, statsService, crossRefService,
  };
}

export function createApp(deps?: AppDeps): { app: Express; deps: AppDeps } {
  const d = deps ?? createDeps();

  // Controllers
  const siteController = new SiteController(d.siteService, d.authService);
  const bloggerController = new BloggerController(d.bloggerService, d.authService);
  const userController = new UserController(d.authService, d.userService);
  const recommendController = new RecommendController(d.recommendService, d.authService);
  const adController = new AdController(d.adService, d.authService);
  const statsController = new StatsController(d.statsService, d.authService);
  const searchController = new SearchController(d.searchService, d.authService);
  const tagController = new TagController(d.tagService, d.authService);
  const categoryController = new CategoryController(d.categoryService, d.authService);
  const commentController = new CommentController(d.commentService, d.authService);
  const notificationController = new NotificationController(d.notificationService, d.authService);
  const articleController = new ArticleController(d.articleService, d.authService);
  const crossRefController = new CrossReferenceController(d.crossRefService);
  const pushController = new PushController(d.pushService, d.authService);
  const fileController = new FileController(d.fileService, d.authService);
  const subscriptionController = new SubscriptionController(d.subscriptionService, d.authService);
  const backupController = new BackupController(d.backupService, d.authService);

  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
  });

  // SD-001 Site
  app.get('/api/site/config', siteController.getConfig);
  app.put('/api/site/config', siteController.updateConfig);
  app.post('/api/site/maintenance', siteController.setMaintenanceMode);
  app.post('/api/site/announcement', siteController.scheduleAnnouncement);
  app.get('/api/site/stats', siteController.getStatsOverview);

  // SD-002 Blogger
  app.post('/api/bloggers', bloggerController.register);
  app.get('/api/bloggers/:slug', bloggerController.getBySlug);
  app.post('/api/bloggers/:bloggerId/follow', bloggerController.follow);
  app.delete('/api/bloggers/:bloggerId/follow', bloggerController.unfollow);
  app.get('/api/bloggers', bloggerController.listByFollower);

  // SD-003 User + Auth
  app.post('/api/auth/register', userController.register);
  app.post('/api/auth/login', userController.login);
  app.post('/api/auth/logout', userController.logout);
  app.get('/api/users/me', userController.me);
  app.post('/api/users/:userId/ban', userController.ban);
  app.post('/api/users/:userId/unban', userController.unban);

  // SD-004 Recommend
  app.get('/api/recommend/hot', recommendController.hot);
  app.get('/api/recommend/personalized', recommendController.personalized);
  app.get('/api/recommend/latest', recommendController.latest);
  app.post('/api/recommend/slots', recommendController.setSlot);

  // SD-005 Ad
  app.post('/api/ads', adController.create);
  app.post('/api/ads/:adId/audit', adController.audit);
  app.post('/api/ads/:adId/click', adController.recordClick);
  app.get('/api/ads/slot/:slotId', adController.listBySlot);

  // SD-006 Stats
  app.get('/api/stats/articles', statsController.articleStats);
  app.get('/api/stats/users', statsController.userStats);
  app.get('/api/stats/bloggers', statsController.bloggerStats);
  app.get('/api/stats/trend', statsController.siteTrend);

  // SD-007 Search
  app.get('/api/search', searchController.search);
  app.get('/api/search/suggest', searchController.suggest);
  app.get('/api/search/history', searchController.history);
  app.delete('/api/search/history', searchController.clearHistory);

  // SD-008 Tag
  app.post('/api/tags', tagController.create);
  app.post('/api/tags/:tagId/approve', tagController.approve);
  app.post('/api/tags/:tagId/reject', tagController.reject);
  app.post('/api/articles/:articleId/tags', tagController.bind);
  app.delete('/api/articles/:articleId/tags', tagController.unbind);
  app.get('/api/tags/cloud', tagController.cloud);
  app.post('/api/tags/merge', tagController.merge);

  // SD-009 Category
  app.post('/api/categories', categoryController.create);
  app.get('/api/categories/tree', categoryController.tree);
  app.get('/api/categories/:categoryId/breadcrumb', categoryController.breadcrumb);
  app.delete('/api/categories/:categoryId', categoryController.cascadeDelete);
  app.post('/api/articles/:articleId/category', categoryController.bindCategory);

  // SD-010 Comment
  app.post('/api/articles/:articleId/comments', commentController.create);
  app.post('/api/comments/:commentId/audit', commentController.audit);
  app.post('/api/comments/:commentId/like', commentController.like);
  app.post('/api/comments/:commentId/report', commentController.report);
  app.get('/api/articles/:articleId/comments', commentController.listByArticle);

  // SD-011 Notification
  app.get('/api/notifications', notificationController.list);
  app.post('/api/notifications/:notificationId/read', notificationController.markRead);
  app.post('/api/notifications/read-all', notificationController.markAllRead);
  app.put('/api/notifications/settings', notificationController.updateSettings);
  app.get('/api/notifications/unread/count', notificationController.unreadSize);

  // SD-012 Article
  app.post('/api/articles', articleController.create);
  app.get('/api/articles/:articleId', articleController.getById);
  app.post('/api/articles/:articleId/submit', articleController.submitForReview);
  app.post('/api/articles/:articleId/publish', articleController.publish);
  app.post('/api/articles/:articleId/approve', articleController.approve);
  app.post('/api/articles/:articleId/offline', articleController.offline);
  app.post('/api/articles/:articleId/archive', articleController.archive);
  app.post('/api/articles/:articleId/republish', articleController.republish);
  app.post('/api/articles/:articleId/schedule', articleController.schedule);
  app.post('/api/articles/:articleId/fire', articleController.fireScheduledPublish);
  app.post('/api/articles/batch-offline', articleController.batchOffline);
  app.get('/api/authors/:authorId/articles', articleController.listByAuthor);
  app.post('/api/articles/:articleId/transition', articleController.transition);

  // SD-013 CrossReference
  app.post('/api/articles/:articleId/citations', crossRefController.addCitation);
  app.delete('/api/articles/:articleId/citations', crossRefController.removeCitation);
  app.get('/api/articles/:articleId/backlinks', crossRefController.backlinks);
  app.get('/api/articles/:articleId/related', crossRefController.related);
  app.get('/api/articles/:articleId/graph', crossRefController.graph);

  // SD-014 Push
  app.post('/api/push/:userId', pushController.push);
  app.post('/api/push/broadcast', pushController.broadcast);
  app.post('/api/push/flush', pushController.flushOffline);

  // SD-015 File
  app.post('/api/files', fileController.upload);
  app.get('/api/files/quota', fileController.getQuota);
  app.get('/api/files/:fileId', fileController.getById);
  app.get('/api/files', fileController.listByUser);
  app.delete('/api/files/:fileId', fileController.delete);

  // SD-016 Subscription
  app.post('/api/subscriptions', subscriptionController.subscribe);
  app.delete('/api/subscriptions', subscriptionController.unsubscribe);
  app.get('/api/subscriptions', subscriptionController.list);
  app.get('/api/subscriptions/permission', subscriptionController.permission);

  // SD-017 Backup
  app.post('/api/backups', backupController.create);
  app.get('/api/backups/export/:userId', backupController.exportUserData);
  app.post('/api/backups/:backupId/restore', backupController.restore);
  app.get('/api/backups/incremental', backupController.incremental);
  app.get('/api/backups/:backupId/verify', backupController.verifyIntegrity);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ code: 404, message: 'Not Found', httpStatus: 404 });
  });

  // Error handler (must be last)
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    errorHandler(err, req, res, next);
  });

  return { app, deps: d };
}
