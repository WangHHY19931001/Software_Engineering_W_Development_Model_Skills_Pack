/**
 * Express 应用入口（组装中间件 + 路由）
 *
 * 路由分组：
 * - /api/auth 注册/登录/刷新
 * - /api/users 用户资料
 * - /api/bloggers 博主
 * - /api/follow 关注
 * - /api/articles 文章
 * - /api/tags 标签
 * - /api/categories 分类
 * - /api/comments 评论
 * - /api/notifications 通知
 * - /api/site 站点
 * - /api/announcements 公告
 * - /api/stats 统计
 * - /api/ads 广告
 * - /api/recommend 推荐
 * - /api/search 搜索
 */
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getContainer } from './container.js';
import { authenticate, requireAuth } from './middleware/auth.js';
import { RbacMiddleware } from './middleware/rbac.js';
import { RateLimiter } from './middleware/rate-limiter.js';
import { ErrorHandler } from './middleware/error-handler.js';
import { validate } from './utils/validate.js';
import { AppError } from './utils/errors.js';
import { z } from 'zod';

export function createApp() {
  const app = express();
  const c = getContainer();

  app.use(express.json({ limit: '1mb' }));
  app.use(authenticate);

  // 限流：每 IP 每分钟 60 次
  app.use(RateLimiter.rateLimit({ windowMs: 60_000, max: 60 }));

  // ============ /api/auth ============
  const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    nickname: z.string().min(1).max(50),
    role: z.enum(['user', 'blogger', 'admin', 'super_admin']).optional(),
  });
  app.post('/api/auth/register', validate(RegisterSchema), async (req, res, next) => {
    try {
      const result = await c.userService.register(req.body);
      res.status(201).json(result);
    } catch (e) { next(e); }
  });

  const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  app.post('/api/auth/login', validate(LoginSchema), async (req, res, next) => {
    try {
      const result = await c.userService.login(req.body.email, req.body.password);
      res.json(result);
    } catch (e) { next(e); }
  });

  app.post('/api/auth/refresh', async (req, res, next) => {
    try {
      const { refreshToken } = req.body as { refreshToken?: string };
      if (!refreshToken) throw new Error('refreshToken 缺失');
      const { sign, verify, ACCESS_EXPIRES } = await import('./utils/jwt.js');
      const payload = verify(refreshToken);
      const accessToken = sign({ userId: payload.userId, role: payload.role }, ACCESS_EXPIRES);
      res.json({ accessToken, expiresIn: ACCESS_EXPIRES });
    } catch (e) { next(e); }
  });

  // ============ /api/users ============
  app.get('/api/users/:id', requireAuth, (req, res, next) => {
    try {
      const user = c.userService.getProfile(req.params.id);
      res.json(user);
    } catch (e) { next(e); }
  });

  const UpdateProfileSchema = z.object({
    nickname: z.string().min(1).max(50).optional(),
    avatar: z.string().url().optional(),
    bio: z.string().max(500).optional(),
  });
  app.patch('/api/users/:id', requireAuth, validate(UpdateProfileSchema), async (req, res, next) => {
    try {
      if (!req.user?.userId || req.user.userId !== req.params.id) {
        if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
          throw new AppError(40302, '所有权校验失败', { id: req.params.id, actorId: req.user?.userId });
        }
      }
      const result = await c.userService.updateProfile(req.params.id, req.body);
      res.json(result);
    } catch (e) { next(e); }
  });

  app.post('/api/users/:id/ban', requireAuth, RbacMiddleware.requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
      const { reason } = req.body as { reason?: string };
      if (!reason) throw new Error('reason 缺失');
      const result = await c.userService.banUser(req.params.id, reason, req.user!.userId!);
      res.json(result);
    } catch (e) { next(e); }
  });

  app.post('/api/users/:id/unban', requireAuth, RbacMiddleware.requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
      const result = await c.userService.unbanUser(req.params.id, req.user!.userId!);
      res.json(result);
    } catch (e) { next(e); }
  });

  // ============ /api/bloggers ============
  app.post('/api/bloggers', async (req, res, next) => {
    try {
      const result = await c.bloggerService.registerBlogger(req.body);
      res.status(201).json(result);
    } catch (e) { next(e); }
  });

  app.get('/api/bloggers/:id', (req, res, next) => {
    try {
      res.json(c.bloggerService.getBloggerProfile(req.params.id));
    } catch (e) { next(e); }
  });

  app.get('/api/bloggers/:id/home', (req, res, next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 10;
      res.json(c.bloggerService.getBloggerHome(req.params.id, page, size));
    } catch (e) { next(e); }
  });

  app.post('/api/bloggers/:id/upgrade', requireAuth, RbacMiddleware.requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
      const { level } = req.body as { level?: 'normal' | 'verified' | 'featured' };
      if (!level) throw new Error('level 缺失');
      const result = await c.bloggerService.upgradeBloggerLevel(req.params.id, level, req.user!.userId!);
      res.json(result);
    } catch (e) { next(e); }
  });

  // ============ /api/follow ============
  app.post('/api/follow/:bloggerId', requireAuth, async (req, res, next) => {
    try {
      const result = await c.followService.follow(req.user!.userId!, req.params.bloggerId);
      res.status(201).json(result);
    } catch (e) { next(e); }
  });

  app.delete('/api/follow/:bloggerId', requireAuth, (req, res, next) => {
    try {
      c.followService.unfollow(req.user!.userId!, req.params.bloggerId);
      res.status(204).end();
    } catch (e) { next(e); }
  });

  app.get('/api/follow/:bloggerId/followers', (req, res, next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 10;
      res.json(c.followService.getFollowers(req.params.bloggerId, page, size));
    } catch (e) { next(e); }
  });

  app.get('/api/follow/me/following', requireAuth, (req, res, next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 10;
      res.json(c.followService.getFollowing(req.user!.userId!, page, size));
    } catch (e) { next(e); }
  });

  // ============ /api/articles ============
  const CreateArticleSchema = z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(100000),
    summary: z.string().max(500).optional(),
    tagIds: z.array(z.string()).max(10).optional(),
    categoryId: z.string().optional(),
    seriesId: z.string().optional(),
    citeArticleIds: z.array(z.string()).max(20).optional(),
  });
  app.post('/api/articles', requireAuth, RbacMiddleware.requireRole(['blogger', 'admin', 'super_admin']), validate(CreateArticleSchema), async (req, res, next) => {
    try {
      const article = await c.articleService.createArticle({
        ...req.body,
        authorId: req.user!.userId!,
      });
      res.status(201).json(article);
    } catch (e) { next(e); }
  });

  app.get('/api/articles', (req, res, next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 10;
      const filter: Record<string, string> = {};
      if (req.query.authorId) filter.authorId = req.query.authorId as string;
      if (req.query.status) filter.status = req.query.status as string;
      if (req.query.tagId) filter.tagId = req.query.tagId as string;
      if (req.query.categoryId) filter.categoryId = req.query.categoryId as string;
      res.json(c.articleService.listArticles(filter, page, size));
    } catch (e) { next(e); }
  });

  app.get('/api/articles/:id', (req, res, next) => {
    try {
      const viewerId = req.user?.userId;
      res.json(c.articleService.getArticle(req.params.id, viewerId));
    } catch (e) { next(e); }
  });

  app.patch('/api/articles/:id', requireAuth, async (req, res, next) => {
    try {
      const result = await c.articleService.updateArticle(req.params.id, req.body, req.user!.userId!);
      res.json(result);
    } catch (e) { next(e); }
  });

  app.delete('/api/articles/:id', requireAuth, async (req, res, next) => {
    try {
      await c.articleService.deleteArticle(req.params.id, req.user!.userId!);
      res.status(204).end();
    } catch (e) { next(e); }
  });

  app.post('/api/articles/:id/transition', requireAuth, async (req, res, next) => {
    try {
      const { toState } = req.body as { toState?: string };
      if (!toState) throw new Error('toState 缺失');
      const result = await c.articleService.transitionState(req.params.id, toState as never, {
        id: req.user!.userId!,
        role: req.user!.role ?? 'user',
      });
      res.json(result);
    } catch (e) { next(e); }
  });

  app.post('/api/articles/batch', requireAuth, RbacMiddleware.requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
      const { ids, action } = req.body as { ids?: string[]; action?: 'archive' | 'delete' };
      if (!ids || !action) throw new Error('ids/action 缺失');
      const result = await c.articleService.batchManage(ids, action, {
        id: req.user!.userId!,
        role: req.user!.role ?? 'user',
      });
      res.json(result);
    } catch (e) { next(e); }
  });

  // ============ /api/tags ============
  app.post('/api/tags', requireAuth, RbacMiddleware.requireRole(['blogger', 'admin', 'super_admin']), async (req, res, next) => {
    try {
      const { name } = req.body as { name?: string };
      if (!name) throw new Error('name 缺失');
      const tag = await c.tagService.createTag(name, req.user!.userId!);
      res.status(201).json(tag);
    } catch (e) { next(e); }
  });

  app.get('/api/tags/cloud', (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      res.json(c.tagService.getTagCloud(limit));
    } catch (e) { next(e); }
  });

  app.post('/api/articles/:id/tags/:tagId', requireAuth, async (req, res, next) => {
    try {
      await c.tagService.bindTag(req.params.id, req.params.tagId, req.user!.userId!);
      res.status(204).end();
    } catch (e) { next(e); }
  });

  // ============ /api/categories ============
  app.get('/api/categories/tree', (_req, res) => {
    res.json(c.categoryService.getCategoryTree());
  });

  app.post('/api/categories', requireAuth, RbacMiddleware.requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
      const cat = await c.categoryService.createCategory(req.body, req.user!.userId!);
      res.status(201).json(cat);
    } catch (e) { next(e); }
  });

  // ============ /api/comments ============
  const CreateCommentSchema = z.object({
    articleId: z.string().min(1),
    content: z.string().min(1).max(1000),
    parentId: z.string().optional(),
  });
  app.post('/api/comments', requireAuth, validate(CreateCommentSchema), async (req, res, next) => {
    try {
      const comment = await c.commentService.createComment({
        ...req.body,
        authorId: req.user!.userId!,
      });
      res.status(201).json(comment);
    } catch (e) { next(e); }
  });

  app.get('/api/articles/:id/comments', (req, res, next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 10;
      const sort = (req.query.sort as 'latest' | 'hottest') || 'latest';
      res.json(c.commentService.listComments(req.params.id, page, size, sort));
    } catch (e) { next(e); }
  });

  app.post('/api/comments/:id/like', requireAuth, (req, res, next) => {
    try {
      c.commentService.like(req.params.id, req.user!.userId!);
      res.status(204).end();
    } catch (e) { next(e); }
  });

  app.post('/api/comments/:id/moderate', requireAuth, RbacMiddleware.requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
      const { action } = req.body as { action?: 'approve' | 'reject' };
      if (!action) throw new Error('action 缺失');
      const result = await c.commentService.moderate(req.params.id, action, req.user!.userId!);
      res.json(result);
    } catch (e) { next(e); }
  });

  // ============ /api/notifications ============
  app.get('/api/notifications', requireAuth, (req, res, next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 10;
      res.json(c.notificationService.listByUser(req.user!.userId!, page, size));
    } catch (e) { next(e); }
  });

  app.get('/api/notifications/unread-count', requireAuth, (req, res) => {
    res.json({ count: c.notificationService.getUnreadCount(req.user!.userId!) });
  });

  app.post('/api/notifications/:id/read', requireAuth, (req, res, next) => {
    try {
      c.notificationService.markRead(req.params.id, req.user!.userId!);
      res.status(204).end();
    } catch (e) { next(e); }
  });

  app.post('/api/notifications/read-all', requireAuth, (req, res) => {
    c.notificationService.markAllRead(req.user!.userId!);
    res.status(204).end();
  });

  // ============ /api/site ============
  app.get('/api/site/config', (_req, res) => {
    res.json(c.siteService.getConfig());
  });

  app.patch('/api/site/config', requireAuth, RbacMiddleware.requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
      const result = await c.siteService.updateConfig(req.body, req.user!.userId!);
      res.json(result);
    } catch (e) { next(e); }
  });

  app.post('/api/site/switches', requireAuth, RbacMiddleware.requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
      const { name, value } = req.body as { name?: string; value?: boolean };
      if (!name || typeof value !== 'boolean') throw new Error('name/value 缺失');
      await c.siteService.setSwitch(name as never, value, req.user!.userId!);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  app.get('/api/site/overview', (_req, res) => {
    res.json(c.siteService.getOverview());
  });

  // ============ /api/announcements ============
  app.get('/api/announcements', (_req, res) => {
    // 简化：返回全部
    res.json({ list: [] });
  });

  app.post('/api/announcements', requireAuth, RbacMiddleware.requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
      const ann = await c.announcementScheduler.createAnnouncement(req.body, req.user!.userId!);
      res.status(201).json(ann);
    } catch (e) { next(e); }
  });

  // ============ /api/stats ============
  app.get('/api/stats/articles', (_req, res) => {
    res.json(c.statsAggregator.getArticleStats());
  });

  app.get('/api/stats/users', (_req, res) => {
    res.json(c.statsAggregator.getUserStats());
  });

  app.get('/api/stats/site', (_req, res) => {
    res.json(c.statsAggregator.getSiteStats());
  });

  app.get('/api/stats/export', (req, res, next) => {
    try {
      const format = (req.query.format as 'csv' | 'json') || 'json';
      const type = (req.query.type as 'article' | 'user' | 'blogger' | 'site') || 'site';
      const buffer = c.statsAggregator.exportReport(format, type);
      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
      res.send(buffer);
    } catch (e) { next(e); }
  });

  // ============ /api/ads ============
  app.post('/api/ads', requireAuth, RbacMiddleware.requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
      const ad = await c.adService.createAd(req.body, req.user!.userId!);
      res.status(201).json(ad);
    } catch (e) { next(e); }
  });

  app.get('/api/ads/:id', (req, res, next) => {
    try {
      res.json(c.adService.getAd(req.params.id));
    } catch (e) { next(e); }
  });

  app.post('/api/ads/:id/approve', requireAuth, RbacMiddleware.requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
      res.json(await c.adService.approve(req.params.id, req.user!.userId!));
    } catch (e) { next(e); }
  });

  app.get('/api/ads/serve/:slot', requireAuth, async (req, res, next) => {
    try {
      const ad = await c.adService.serveAd(req.user!.userId!, req.params.slot);
      if (!ad) {
        res.status(404).json({ message: '无可用广告' });
        return;
      }
      res.json(ad);
    } catch (e) { next(e); }
  });

  // ============ /api/recommend ============
  app.get('/api/recommend/hot', (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 10;
    res.json(c.recommendationEngine.getHotFeed(page, size));
  });

  app.get('/api/recommend/latest', (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 10;
    res.json(c.recommendationEngine.getLatestFeed(page, size));
  });

  app.get('/api/recommend/personalized', requireAuth, (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 10;
    res.json(c.recommendationEngine.getPersonalizedFeed(req.user!.userId!, page, size));
  });

  app.get('/api/recommend/bloggers', (_req, res) => {
    res.json(c.recommendationEngine.getBloggerRecommend(''));
  });

  // ============ /api/search ============
  app.get('/api/search', (req, res, next) => {
    try {
      const q = req.query.q as string;
      const sort = (req.query.sort as 'relevance' | 'latest' | 'hottest') || 'relevance';
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 10;
      const userId = req.user?.userId;
      res.json(c.searchIndexer.search(q, sort, page, size, userId));
    } catch (e) { next(e); }
  });

  app.get('/api/search/suggest', (req, res, next) => {
    try {
      const prefix = req.query.prefix as string;
      res.json(c.searchIndexer.searchSuggest(prefix));
    } catch (e) { next(e); }
  });

  app.get('/api/search/history', requireAuth, (req, res) => {
    res.json({ history: c.searchIndexer.getSearchHistory(req.user!.userId!) });
  });

  app.delete('/api/search/history', requireAuth, (req, res) => {
    c.searchIndexer.clearHistory(req.user!.userId!);
    res.status(204).end();
  });

  // ============ 健康检查 ============
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Math.floor(Date.now() / 1000) });
  });

  // ============ 404 ============
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ code: 40400, message: '路由不存在', requestId: 'req-404' });
  });

  // ============ 错误处理（必须最后注册） ============
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    ErrorHandler.handle(err, _req, res, _next);
  });

  return app;
}
