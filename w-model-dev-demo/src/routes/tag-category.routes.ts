/**
 * 标签/分类路由（INTF-017）：创建须博主，查询公开。
 * Router 工厂：接收控制器实例与中间件（AppFactory 依赖注入），保持 app.ts 原注册行为。
 */
import { Router, type RequestHandler } from 'express';
import type { MetadataController } from './content/metadataController';
import { wrap } from '../utils/asyncHandler';

export interface TagCategoryRouterDeps {
  controller: MetadataController;
  authenticate: RequestHandler;
  requireBlogger: RequestHandler;
}

export function createTagCategoryRouter(deps: TagCategoryRouterDeps): Router {
  const router = Router();
  const c = deps.controller;
  // 17 标签/分类（创建须博主，查询公开）
  router.post('/api/tags', deps.authenticate, deps.requireBlogger, wrap(c.createTag.bind(c)));
  router.get('/api/tags', wrap(c.listTags.bind(c)));
  router.post('/api/categories', deps.authenticate, deps.requireBlogger, wrap(c.createCategory.bind(c)));
  router.get('/api/categories', wrap(c.listCategories.bind(c)));
  return router;
}
