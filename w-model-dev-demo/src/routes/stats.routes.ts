/**
 * 博主统计路由（INTF-023）：统计面板（博主）。
 * Router 工厂：接收控制器实例与中间件（AppFactory 依赖注入），保持 app.ts 原注册行为。
 */
import { Router, type RequestHandler } from 'express';
import type { StatsController } from './stats/statsController';
import { wrap } from '../utils/asyncHandler';

export interface StatsRouterDeps {
  controller: StatsController;
  authenticate: RequestHandler;
  requireBlogger: RequestHandler;
}

export function createStatsRouter(deps: StatsRouterDeps): Router {
  const router = Router();
  const c = deps.controller;
  // 25 博主统计面板
  router.get('/api/blogger/stats', deps.authenticate, deps.requireBlogger, wrap(c.getBloggerStats.bind(c)));
  return router;
}
