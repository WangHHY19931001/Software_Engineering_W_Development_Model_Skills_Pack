/**
 * StatsController（DD-030 / SD-005 路由处理）：博主统计面板 + 通知列表/已读路由处理器。
 * getBloggerStats 显式校验 role=blogger（40301）；markNotificationRead 他人通知 40401 防枚举。
 */
import type { Request, Response, NextFunction } from 'express';
import { parsePage } from '../../utils/validationUtil';
import { sendError } from '../../utils/respond';
import { BizError } from '../../utils/errors';
import type { BloggerStatsService } from '../../services/stats/bloggerStatsService';
import type { NotificationService } from '../../services/stats/notificationService';

export class StatsController {
  constructor(
    private readonly bloggerStatsService: BloggerStatsService,
    private readonly notificationService: NotificationService,
  ) {}

  async getBloggerStats(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireBlogger(req);
      const stats = await this.bloggerStatsService.getBloggerStats(userId);
      res.json({ code: 0, message: 'ok', data: stats });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async listNotifications(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      const { page, pageSize } = parsePage(req.query.page, req.query.pageSize);
      const unreadOnly = req.query.unreadOnly === 'true';
      const result = this.notificationService.listNotifications(userId, page, pageSize, unreadOnly);
      res.json({
        code: 0,
        message: 'ok',
        data: {
          items: result.items.map((n) => ({
            notificationId: n.id,
            type: n.type,
            articleId: n.articleId,
            actorId: n.actorId,
            actorName: n.actorName,
            content: n.content,
            read: n.read,
            createdAt: n.createdAt,
          })),
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
        },
      });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async markNotificationRead(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      const notification = await this.notificationService.markNotificationRead(userId, req.params.id);
      res.json({ code: 0, message: 'ok', data: { notificationId: notification.id, read: notification.read } });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  protected requireUser(req: Request): string {
    if (!req.user?.userId) {
      throw new BizError(40101);
    }
    return req.user.userId;
  }

  protected requireBlogger(req: Request): string {
    const userId = this.requireUser(req);
    if (req.user?.role !== 'blogger') {
      throw new BizError(40301);
    }
    return userId;
  }
}
