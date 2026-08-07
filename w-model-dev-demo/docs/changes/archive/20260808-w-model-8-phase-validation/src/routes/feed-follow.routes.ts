/**
 * Feed 关注流路由（INTF-020）：我的 feed（静态 /api/me/feed）。
 * Router 工厂：接收控制器实例与中间件（AppFactory 依赖注入），保持 app.ts 原注册行为。
 */
import { Router, type RequestHandler } from 'express';
import type { InteractionController } from './interaction/interactionController';
import { wrap } from '../utils/asyncHandler';

export interface FeedFollowRouterDeps {
  controller: InteractionController;
  authenticate: RequestHandler;
}

export function createFeedFollowRouter(deps: FeedFollowRouterDeps): Router {
  const router = Router();
  const c = deps.controller;
  // 22 我的 feed（静态 /me/feed）
  router.get('/api/me/feed', deps.authenticate, wrap(c.getFeed.bind(c)));
  return router;
}
