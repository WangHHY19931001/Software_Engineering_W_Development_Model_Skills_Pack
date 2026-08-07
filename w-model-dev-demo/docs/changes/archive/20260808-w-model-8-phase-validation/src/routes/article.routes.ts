/**
 * 文章路由（INTF-007~016）：浏览 / 管理（静态 /hot 先于参数 /:id；/blogger/articles 管理列表）。
 * Router 工厂：接收控制器实例与中间件（AppFactory 依赖注入），保持 app.ts 原注册行为与静态优先顺序。
 */
import { Router, type RequestHandler } from 'express';
import type { ArticleController } from './content/articleController';
import type { BrowseController } from './interaction/browseController';
import type { DiscoveryController } from './discovery/discoveryController';
import { wrap } from '../utils/asyncHandler';

export interface ArticleRouterDeps {
  articleController: ArticleController;
  browseController: BrowseController;
  discoveryController: DiscoveryController;
  authenticate: RequestHandler;
  requireBlogger: RequestHandler;
  audit: (action: 'login' | 'publish' | 'delete') => RequestHandler;
}

export function createArticleRouter(deps: ArticleRouterDeps): Router {
  const router = Router();
  const ac = deps.articleController;
  const bc = deps.browseController;
  // 8 热门（静态，先于 /:id）
  router.get('/api/articles/hot', wrap(deps.discoveryController.getHotArticles.bind(deps.discoveryController)));
  // 9-10 浏览列表/详情
  router.get('/api/articles', wrap(bc.listArticles.bind(bc)));
  router.get('/api/articles/:id', wrap(bc.getArticle.bind(bc)));
  // 11-16 文章管理（博主）
  router.post('/api/articles', deps.authenticate, deps.requireBlogger, deps.audit('publish'), wrap(ac.createArticle.bind(ac)));
  router.post('/api/articles/:id/publish', deps.authenticate, deps.audit('publish'), wrap(ac.publishArticle.bind(ac)));
  router.post('/api/articles/:id/archive', deps.authenticate, wrap(ac.archiveArticle.bind(ac)));
  router.post('/api/articles/:id/unarchive', deps.authenticate, wrap(ac.unarchiveArticle.bind(ac)));
  router.put('/api/articles/:id', deps.authenticate, wrap(ac.updateArticle.bind(ac)));
  router.delete('/api/articles/:id', deps.authenticate, deps.audit('delete'), wrap(ac.deleteArticle.bind(ac)));
  router.get('/api/blogger/articles', deps.authenticate, wrap(ac.listMyArticles.bind(ac)));
  return router;
}
