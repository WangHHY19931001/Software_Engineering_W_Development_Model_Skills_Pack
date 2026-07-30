/**
 * 路由定义 - 22 INTF
 */
import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../middleware/validation.middleware.js';
import { z } from 'zod';
import type { AppDeps } from './app.js';

export function createApiRouter(deps: AppDeps['apiRouter' extends Router ? 'apiRouter' : never] extends never ? AppDeps : AppDeps): Router {
  const router = Router();
  // 由于 router 不直接持有 services，此处由调用方注入
  return router;
}

export interface ServiceRegistry {
  auth: import('../services/auth.service.js').AuthService;
  user: import('../services/user.service.js').UserService;
  blogger: import('../services/blogger.service.js').BloggerService;
  article: import('../services/article.service.js').ArticleService;
  comment: import('../services/comment.service.js').CommentService;
  notification: import('../services/notification.service.js').NotificationService;
  tag: import('../services/tag.service.js').TagService;
  search: import('../services/search.service.js').SearchService;
  webhook: import('../services/webhook.service.js').WebhookService;
  rss: import('../services/rss.service.js').RssService;
  siteConfig: import('../services/site-config.service.js').SiteConfigService;
  audit: import('../services/audit-log.service.js').AuditLogService;
  viewRecord: import('../services/view-record.service.js').ViewRecordService;
  recommend: import('../services/recommend.service.js').RecommendService;
  ad: import('../services/ad.service.js').AdService;
  stats: import('../services/stats.service.js').StatsService;
  follow: import('../services/follow.service.js').FollowService;
  like: import('../services/like.service.js').LikeService;
  favorite: import('../services/favorite.service.js').FavoriteService;
}

export function buildApiRouter(svc: ServiceRegistry): Router {
  const router = Router();

  // ============ INTF-001 用户认证 (SD-001) ============
  router.post(
    '/auth/register',
    validateBody(z.object({
      email: z.string().email(),
      username: z.string().min(3).max(50),
      password: z.string().min(6).max(128),
      nickname: z.string().max(50).optional(),
      role: z.enum(['reader', 'blogger', 'admin']).optional(),
    })),
    asyncHandler(async (req: Request, res: Response) => {
      const result = await svc.auth.register(req.body);
      res.status(201).json(result);
    }),
  );
  router.post(
    '/auth/login',
    validateBody(z.object({ email: z.string().email(), password: z.string().min(1) })),
    asyncHandler(async (req: Request, res: Response) => {
      const result = await svc.auth.login(req.body);
      res.json(result);
    }),
  );
  router.get(
    '/auth/me',
    authMiddleware(),
    asyncHandler(async (req: Request, res: Response) => {
      const user = await svc.auth.authenticate(req.headers.authorization!.replace('Bearer ', ''));
      res.json(user);
    }),
  );

  // ============ INTF-002 用户资料 (SD-002) ============
  router.get(
    '/users/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const user = await svc.user.getById(req.params.id!);
      res.json(user);
    }),
  );
  router.put(
    '/users/me',
    authMiddleware(),
    validateBody(z.object({
      nickname: z.string().max(50).optional(),
      bio: z.string().max(500).optional(),
      avatarUrl: z.string().url().optional(),
    })),
    asyncHandler(async (req: Request, res: Response) => {
      const user = await svc.user.updateProfile(req.auth!.sub, req.body);
      res.json(user);
    }),
  );
  router.delete(
    '/users/me',
    authMiddleware(),
    asyncHandler(async (req: Request, res: Response) => {
      await svc.user.deleteUser(req.auth!.sub);
      res.status(204).end();
    }),
  );

  // ============ INTF-003 关注 (SD-003) ============
  router.post(
    '/follows',
    authMiddleware(),
    validateBody(z.object({ followeeId: z.string().min(1) })),
    asyncHandler(async (req: Request, res: Response) => {
      const follow = await svc.follow.follow({ followerId: req.auth!.sub, followeeId: req.body.followeeId });
      res.status(201).json(follow);
    }),
  );
  router.delete(
    '/follows/:followeeId',
    authMiddleware(),
    asyncHandler(async (req: Request, res: Response) => {
      await svc.follow.unfollow(req.auth!.sub, req.params.followeeId!);
      res.status(204).end();
    }),
  );
  router.get(
    '/users/:id/followers',
    asyncHandler(async (req: Request, res: Response) => {
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 20);
      const result = await svc.follow.listFollowers(req.params.id!, page, pageSize);
      res.json(result);
    }),
  );
  router.get(
    '/users/:id/following',
    asyncHandler(async (req: Request, res: Response) => {
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 20);
      const result = await svc.follow.listFollowing(req.params.id!, page, pageSize);
      res.json(result);
    }),
  );

  // ============ INTF-004 博主注册 (SD-004) ============
  router.post(
    '/bloggers',
    authMiddleware(),
    validateBody(z.object({
      displayName: z.string().min(1).max(100),
      description: z.string().max(2000).optional(),
      avatarUrl: z.string().url().optional(),
    })),
    asyncHandler(async (req: Request, res: Response) => {
      const blogger = await svc.blogger.register({ userId: req.auth!.sub, ...req.body });
      res.status(201).json(blogger);
    }),
  );
  router.get(
    '/bloggers/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const blogger = await svc.blogger.getById(req.params.id!);
      res.json(blogger);
    }),
  );
  router.put(
    '/bloggers/:id',
    authMiddleware(),
    asyncHandler(async (req: Request, res: Response) => {
      const blogger = await svc.blogger.update(req.params.id!, req.body, req.auth!.sub);
      res.json(blogger);
    }),
  );

  // ============ INTF-005 博文生命周期 (SD-005) ============
  router.post(
    '/articles',
    authMiddleware(),
    requireRole('blogger', 'admin'),
    validateBody(z.object({
      title: z.string().min(1).max(200),
      content: z.string(),
      summary: z.string().max(500).optional(),
      tagIds: z.array(z.string()).optional(),
    })),
    asyncHandler(async (req: Request, res: Response) => {
      const article = await svc.article.create(req.auth!.sub, req.body);
      res.status(201).json(article);
    }),
  );
  router.put(
    '/articles/:id',
    authMiddleware(),
    requireRole('blogger', 'admin'),
    asyncHandler(async (req: Request, res: Response) => {
      const article = await svc.article.update(req.params.id!, req.auth!.sub, req.body);
      res.json(article);
    }),
  );
  router.post(
    '/articles/:id/transition',
    authMiddleware(),
    requireRole('blogger', 'admin'),
    validateBody(z.object({ action: z.enum(['publish', 'unpublish', 'archive', 'unarchive', 'delete']) })),
    asyncHandler(async (req: Request, res: Response) => {
      const article = await svc.article.transition(req.params.id!, req.auth!.sub, req.body.action);
      res.json(article);
    }),
  );
  router.delete(
    '/articles/:id',
    authMiddleware(),
    requireRole('blogger', 'admin'),
    asyncHandler(async (req: Request, res: Response) => {
      await svc.article.deleteArticle(req.params.id!, req.auth!.sub);
      res.status(204).end();
    }),
  );

  // ============ INTF-006 博文浏览 (SD-006) ============
  router.get(
    '/articles/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const article = await svc.article.getPublishedById(req.params.id!);
      res.json(article);
    }),
  );
  router.post(
    '/articles/:id/view',
    asyncHandler(async (req: Request, res: Response) => {
      await svc.viewRecord.recordView({
        postId: req.params.id!,
        userId: req.auth?.sub ?? null,
        ip: req.ip ?? 'unknown',
        userAgent: (req.headers['user-agent'] as string) ?? '',
        referer: (req.headers.referer as string) ?? '',
      });
      res.status(204).end();
    }),
  );

  // ============ INTF-007 互动 (SD-007) ============
  router.post(
    '/articles/:id/like',
    authMiddleware(),
    asyncHandler(async (req: Request, res: Response) => {
      const like = await svc.like.like({ userId: req.auth!.sub, postId: req.params.id! });
      res.status(201).json(like);
    }),
  );
  router.delete(
    '/articles/:id/like',
    authMiddleware(),
    asyncHandler(async (req: Request, res: Response) => {
      await svc.like.unlike(req.auth!.sub, req.params.id!);
      res.status(204).end();
    }),
  );
  router.post(
    '/articles/:id/favorite',
    authMiddleware(),
    asyncHandler(async (req: Request, res: Response) => {
      const fav = await svc.favorite.favorite({ userId: req.auth!.sub, postId: req.params.id! });
      res.status(201).json(fav);
    }),
  );
  router.delete(
    '/articles/:id/favorite',
    authMiddleware(),
    asyncHandler(async (req: Request, res: Response) => {
      await svc.favorite.unfavorite(req.auth!.sub, req.params.id!);
      res.status(204).end();
    }),
  );

  // ============ INTF-008 标签 (SD-008) ============
  router.post(
    '/tags',
    authMiddleware(),
    requireRole('blogger', 'admin'),
    validateBody(z.object({
      name: z.string().min(1).max(50),
      slug: z.string().min(1).max(50),
      description: z.string().max(500).optional(),
    })),
    asyncHandler(async (req: Request, res: Response) => {
      const tag = await svc.tag.create(req.body);
      res.status(201).json(tag);
    }),
  );
  router.get(
    '/tags',
    asyncHandler(async (_req: Request, res: Response) => {
      const tags = await svc.tag.list();
      res.json(tags);
    }),
  );
  router.get(
    '/tags/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const tag = await svc.tag.getById(req.params.id!);
      res.json(tag);
    }),
  );

  // ============ INTF-009 搜索 (SD-009) ============
  router.get(
    '/search',
    asyncHandler(async (req: Request, res: Response) => {
      const keyword = String(req.query.q ?? '');
      const results = await svc.search.searchAll(keyword);
      res.json({ items: results, total: results.length });
    }),
  );
  router.get(
    '/search/articles',
    asyncHandler(async (req: Request, res: Response) => {
      const keyword = String(req.query.q ?? '');
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 20);
      const result = await svc.search.searchArticles(keyword, page, pageSize);
      res.json(result);
    }),
  );

  // ============ INTF-010 评论 (SD-010) ============
  router.post(
    '/articles/:id/comments',
    authMiddleware(),
    validateBody(z.object({
      parentId: z.string().optional(),
      content: z.string().min(1).max(2000),
    })),
    asyncHandler(async (req: Request, res: Response) => {
      const comment = await svc.comment.create({
        postId: req.params.id!,
        authorId: req.auth!.sub,
        parentId: req.body.parentId,
        content: req.body.content,
      });
      res.status(201).json(comment);
    }),
  );
  router.get(
    '/articles/:id/comments',
    asyncHandler(async (req: Request, res: Response) => {
      const tree = await svc.comment.getTreeByPost(req.params.id!);
      res.json(tree);
    }),
  );
  router.delete(
    '/comments/:id',
    authMiddleware(),
    asyncHandler(async (req: Request, res: Response) => {
      const isAdmin = req.auth!.role === 'admin';
      await svc.comment.delete(req.params.id!, req.auth!.sub, isAdmin);
      res.status(204).end();
    }),
  );

  // ============ INTF-011 通知 (SD-011) ============
  router.get(
    '/me/notifications',
    authMiddleware(),
    asyncHandler(async (req: Request, res: Response) => {
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 20);
      const result = await svc.notification.listByRecipient(req.auth!.sub, page, pageSize);
      res.json(result);
    }),
  );
  router.put(
    '/me/notifications/:id/read',
    authMiddleware(),
    asyncHandler(async (req: Request, res: Response) => {
      const notif = await svc.notification.markRead(req.params.id!);
      res.json(notif);
    }),
  );
  router.post(
    '/me/notifications/read-all',
    authMiddleware(),
    asyncHandler(async (req: Request, res: Response) => {
      const count = await svc.notification.markAllRead(req.auth!.sub);
      res.json({ count });
    }),
  );

  // ============ INTF-013 Webhook (SD-013) ============
  router.post(
    '/webhooks',
    authMiddleware(),
    requireRole('blogger', 'admin'),
    validateBody(z.object({
      url: z.string().url(),
      events: z.array(z.enum([
        'post.created', 'post.updated', 'post.published', 'post.deleted',
        'comment.created', 'user.registered', 'blogger.registered',
      ])).min(1),
    })),
    asyncHandler(async (req: Request, res: Response) => {
      const wh = await svc.webhook.create({ ownerId: req.auth!.sub, ...req.body });
      res.status(201).json(wh);
    }),
  );
  router.get(
    '/webhooks',
    authMiddleware(),
    asyncHandler(async (req: Request, res: Response) => {
      const list = await svc.webhook.listByOwner(req.auth!.sub);
      res.json(list);
    }),
  );
  router.delete(
    '/webhooks/:id',
    authMiddleware(),
    asyncHandler(async (req: Request, res: Response) => {
      await svc.webhook.delete(req.params.id!, req.auth!.sub);
      res.status(204).end();
    }),
  );

  // ============ INTF-014 站点配置 (SD-014) ============
  router.get(
    '/site-config',
    asyncHandler(async (_req: Request, res: Response) => {
      const config = await svc.siteConfig.get();
      res.json(config);
    }),
  );
  router.put(
    '/site-config',
    authMiddleware(),
    requireRole('admin'),
    asyncHandler(async (req: Request, res: Response) => {
      const config = await svc.siteConfig.update(req.body);
      res.json(config);
    }),
  );

  // ============ INTF-015 访问记录 (SD-015) ============
  router.get(
    '/articles/:id/views',
    authMiddleware(),
    requireRole('admin'),
    asyncHandler(async (req: Request, res: Response) => {
      const records = await svc.viewRecord.getByPost(req.params.id!);
      res.json(records);
    }),
  );

  // ============ INTF-016 审计日志 (SD-016) ============
  router.get(
    '/audit-logs',
    authMiddleware(),
    requireRole('admin'),
    asyncHandler(async (req: Request, res: Response) => {
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 50);
      const result = await svc.audit.list(page, pageSize);
      res.json(result);
    }),
  );

  // ============ INTF-017 站点统计 (SD-017) ============
  router.get(
    '/stats',
    authMiddleware(),
    requireRole('admin'),
    asyncHandler(async (_req: Request, res: Response) => {
      const stats = await svc.stats.getSiteStats();
      res.json(stats);
    }),
  );

  // ============ INTF-018 推荐 (SD-018) ============
  router.get(
    '/articles/:id/related',
    asyncHandler(async (req: Request, res: Response) => {
      const related = await svc.recommend.recommendByTags(req.params.id!);
      res.json(related);
    }),
  );
  router.get(
    '/articles/popular',
    asyncHandler(async (_req: Request, res: Response) => {
      const popular = await svc.recommend.popular();
      res.json(popular);
    }),
  );

  // ============ INTF-019 广告位 (SD-019) ============
  router.post(
    '/ads',
    authMiddleware(),
    requireRole('admin'),
    asyncHandler(async (req: Request, res: Response) => {
      const ad = await svc.ad.create(req.body);
      res.status(201).json(ad);
    }),
  );
  router.get(
    '/ads',
    asyncHandler(async (_req: Request, res: Response) => {
      const ads = await svc.ad.list();
      res.json(ads);
    }),
  );
  router.delete(
    '/ads/:id',
    authMiddleware(),
    requireRole('admin'),
    asyncHandler(async (req: Request, res: Response) => {
      await svc.ad.delete(req.params.id!);
      res.status(204).end();
    }),
  );

  // ============ INTF-022 错误处理路由占位 (SD-022) ============
  // 由 error-handler 中间件处理
  void validateQuery;
  return router;
}

export function buildRssRouter(svc: ServiceRegistry): Router {
  const router = Router();
  router.get(
    '/rss.xml',
    asyncHandler(async (_req: Request, res: Response) => {
      const xml = await svc.rss.buildFeed();
      res.set('Content-Type', 'application/rss+xml; charset=utf-8');
      res.send(xml);
    }),
  );
  return router;
}
