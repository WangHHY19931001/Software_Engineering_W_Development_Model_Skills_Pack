/**
 * 通知路由（INTF-025）：通知列表 / 标记已读（静态 /api/me/notifications）。
 * Router 工厂：接收控制器实例与中间件（AppFactory 依赖注入），保持 app.ts 原注册行为。
 */
import { Router, type RequestHandler } from 'express';
import type { StatsController } from './stats/statsController';
import { wrap } from '../utils/asyncHandler';

export interface NotificationRouterDeps {
  controller: StatsController;
  authenticate: RequestHandler;
}

export function createNotificationRouter(deps: NotificationRouterDeps): Router {
  const router = Router();
  const c = deps.controller;
  // 26 通知
  router.get('/api/me/notifications', deps.authenticate, wrap(c.listNotifications.bind(c)));
  router.patch('/api/me/notifications/:id/read', deps.authenticate, wrap(c.markNotificationRead.bind(c)));
  return router;
}
