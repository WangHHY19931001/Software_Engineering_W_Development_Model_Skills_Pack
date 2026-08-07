/**
 * 发现路由（INTF-021/022）：个性化推荐（可选 JWT，控制器内解析）/ 搜索。
 * Router 工厂：接收控制器实例（AppFactory 依赖注入），保持 app.ts 原注册行为。
 */
import { Router } from 'express';
import type { DiscoveryController } from './discovery/discoveryController';
import { wrap } from '../utils/asyncHandler';

export interface DiscoveryRouterDeps {
  controller: DiscoveryController;
}

export function createDiscoveryRouter(deps: DiscoveryRouterDeps): Router {
  const router = Router();
  const c = deps.controller;
  // 23 个性化推荐（可选 JWT，控制器内解析）
  router.get('/api/me/recommendations', wrap(c.getRecommendations.bind(c)));
  // 24 搜索
  router.get('/api/search', wrap(c.searchArticles.bind(c)));
  return router;
}
