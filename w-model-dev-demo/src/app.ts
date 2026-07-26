/**
 * ExpressApp（DD-001-002）— Express 应用装配 + 路由挂载 + 中间件链。
 */
import express, { type Express, Router } from 'express';
import { errorHandler, notFoundHandler } from './utils/errors.js';
import { asyncHandler } from './utils/async-handler.js';
import type { AuthMiddleware } from './utils/auth-middleware.js';
import type { RateLimitMiddleware } from './utils/rate-limit.js';
import type { AuditMiddleware } from './utils/audit-middleware.js';
import type { SiteController } from './controllers/site.controller.js';
import type { UserController } from './controllers/user.controller.js';
import type { ArticleController } from './controllers/article.controller.js';
import type { CommentController } from './controllers/comment.controller.js';
import type { TagController, CategoryController } from './controllers/taxonomy.controller.js';
import type { SearchController, ArchiveController } from './controllers/search.controller.js';
import type { AuditLogController } from './controllers/audit-log.controller.js';
import type { RssController } from './controllers/rss.controller.js';
import type { WebhookController } from './controllers/webhook.controller.js';

export interface AppControllers {
  site: SiteController;
  user: UserController;
  article: ArticleController;
  comment: CommentController;
  tag: TagController;
  category: CategoryController;
  search: SearchController;
  archive: ArchiveController;
  auditLog: AuditLogController;
  rss: RssController;
  webhook: WebhookController;
}

export interface AppMiddleware {
  auth: AuthMiddleware;
  rateLimit: RateLimitMiddleware;
  audit: AuditMiddleware;
}

export function createApp(controllers: AppControllers, middleware: AppMiddleware): Express {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(middleware.rateLimit.middleware());
  app.use(middleware.audit.record());

  const api = Router();

  // 站点
  api.get('/health', (req, res) => controllers.site.health(req, res, () => {}));
  api.get('/stats', (req, res) => controllers.site.stats(req, res, () => {}));

  // 用户
  api.post('/users/register', asyncHandler((req, res, next) => controllers.user.register(req, res, next)));
  api.post('/users/login', asyncHandler((req, res, next) => controllers.user.login(req, res, next)));
  api.post('/users/password-reset/request', asyncHandler((req, res, next) => controllers.user.passwordResetRequest(req, res, next)));
  api.post('/users/password-reset', asyncHandler((req, res, next) => controllers.user.passwordReset(req, res, next)));
  api.get('/users', middleware.auth.authenticate(), middleware.auth.requireRole(['admin']), asyncHandler((req, res, next) => controllers.user.list(req, res, next)));
  api.get('/users/profile', middleware.auth.authenticate(), asyncHandler((req, res, next) => controllers.user.getProfile(req, res, next)));
  api.put('/users/profile', middleware.auth.authenticate(), asyncHandler((req, res, next) => controllers.user.updateProfile(req, res, next)));

  // 文章
  api.post('/articles', middleware.auth.authenticate(), middleware.auth.requireRole(['admin', 'author']), asyncHandler((req, res, next) => controllers.article.create(req, res, next)));
  api.get('/articles', asyncHandler((req, res, next) => controllers.article.list(req, res, next)));
  api.get('/articles/:id', asyncHandler((req, res, next) => controllers.article.getById(req, res, next)));
  api.put('/articles/:id', middleware.auth.authenticate(), middleware.auth.requireRole(['admin', 'author']), asyncHandler((req, res, next) => controllers.article.update(req, res, next)));
  api.delete('/articles/:id', middleware.auth.authenticate(), middleware.auth.requireRole(['admin', 'author']), asyncHandler((req, res, next) => controllers.article.remove(req, res, next)));
  api.post('/articles/:id/workflow', middleware.auth.authenticate(), middleware.auth.requireRole(['admin', 'author']), asyncHandler((req, res, next) => controllers.article.workflow(req, res, next)));
  api.post('/articles/:id/like', middleware.auth.authenticate(), asyncHandler((req, res, next) => controllers.article.like(req, res, next)));

  // 评论
  api.post('/articles/:id/comments', middleware.auth.authenticate(), asyncHandler((req, res, next) => controllers.comment.create(req, res, next)));
  api.get('/articles/:id/comments', asyncHandler((req, res, next) => controllers.comment.listByArticle(req, res, next)));
  api.delete('/comments/:id', middleware.auth.authenticate(), asyncHandler((req, res, next) => controllers.comment.remove(req, res, next)));

  // 标签（仅 admin 可写）
  api.get('/tags', asyncHandler((req, res, next) => controllers.tag.list(req, res, next)));
  api.post('/tags', middleware.auth.authenticate(), middleware.auth.requireRole(['admin']), asyncHandler((req, res, next) => controllers.tag.create(req, res, next)));
  api.put('/tags/:id', middleware.auth.authenticate(), middleware.auth.requireRole(['admin']), asyncHandler((req, res, next) => controllers.tag.update(req, res, next)));
  api.delete('/tags/:id', middleware.auth.authenticate(), middleware.auth.requireRole(['admin']), asyncHandler((req, res, next) => controllers.tag.remove(req, res, next)));

  // 分类
  api.get('/categories', asyncHandler((req, res, next) => controllers.category.list(req, res, next)));
  api.post('/categories', middleware.auth.authenticate(), middleware.auth.requireRole(['admin', 'author']), asyncHandler((req, res, next) => controllers.category.create(req, res, next)));
  api.put('/categories/:id', middleware.auth.authenticate(), middleware.auth.requireRole(['admin', 'author']), asyncHandler((req, res, next) => controllers.category.update(req, res, next)));
  api.delete('/categories/:id', middleware.auth.authenticate(), middleware.auth.requireRole(['admin', 'author']), asyncHandler((req, res, next) => controllers.category.remove(req, res, next)));

  // 搜索 + 归档
  api.get('/search', asyncHandler((req, res, next) => controllers.search.search(req, res, next)));
  api.get('/archive', asyncHandler((req, res, next) => controllers.archive.list(req, res, next)));

  // 审计日志
  api.get('/audit-logs', middleware.auth.authenticate(), middleware.auth.requireRole(['admin']), asyncHandler((req, res, next) => controllers.auditLog.list(req, res, next)));

  // RSS
  api.get('/rss', asyncHandler((req, res, next) => controllers.rss.feed(req, res, next)));

  // Webhook
  api.get('/webhooks', middleware.auth.authenticate(), middleware.auth.requireRole(['admin']), asyncHandler((req, res, next) => controllers.webhook.list(req, res, next)));
  api.post('/webhooks', middleware.auth.authenticate(), middleware.auth.requireRole(['admin']), asyncHandler((req, res, next) => controllers.webhook.create(req, res, next)));
  api.delete('/webhooks/:id', middleware.auth.authenticate(), middleware.auth.requireRole(['admin']), asyncHandler((req, res, next) => controllers.webhook.remove(req, res, next)));
  api.post('/webhooks/trigger', asyncHandler((req, res, next) => controllers.webhook.trigger(req, res, next)));

  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
