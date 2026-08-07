/**
 * 点赞/收藏路由（INTF-019）：点赞 / 收藏 / 我的收藏列表（静态 /api/me/favorites）。
 * Router 工厂：接收控制器实例与中间件（AppFactory 依赖注入），保持 app.ts 原注册行为。
 */
import { Router, type RequestHandler } from 'express';
import type { InteractionController } from './interaction/interactionController';
import { wrap } from '../utils/asyncHandler';

export interface InteractionRouterDeps {
  controller: InteractionController;
  authenticate: RequestHandler;
}

export function createInteractionRouter(deps: InteractionRouterDeps): Router {
  const router = Router();
  const c = deps.controller;
  // 21 点赞/收藏
  router.post('/api/articles/:id/like', deps.authenticate, wrap(c.likeArticle.bind(c)));
  router.delete('/api/articles/:id/like', deps.authenticate, wrap(c.unlikeArticle.bind(c)));
  router.post('/api/articles/:id/favorite', deps.authenticate, wrap(c.favoriteArticle.bind(c)));
  router.delete('/api/articles/:id/favorite', deps.authenticate, wrap(c.unfavoriteArticle.bind(c)));
  // 22 我的收藏（静态 /me/favorites）
  router.get('/api/me/favorites', deps.authenticate, wrap(c.listMyFavorites.bind(c)));
  return router;
}
