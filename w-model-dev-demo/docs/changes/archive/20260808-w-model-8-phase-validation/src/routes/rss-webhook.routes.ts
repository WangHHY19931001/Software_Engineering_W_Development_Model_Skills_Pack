/**
 * RSS/Webhook 路由（INTF-026~028）：RSS（公开）/ Webhook 配置（博主）。
 * Router 工厂：接收控制器实例与中间件（AppFactory 依赖注入），保持 app.ts 原注册行为。
 */
import { Router, type RequestHandler } from 'express';
import type { IntegrationController } from './integration/integrationController';
import { wrap } from '../utils/asyncHandler';

export interface RssWebhookRouterDeps {
  controller: IntegrationController;
  authenticate: RequestHandler;
  requireBlogger: RequestHandler;
}

export function createRssWebhookRouter(deps: RssWebhookRouterDeps): Router {
  const router = Router();
  const c = deps.controller;
  // 27 RSS（公开）
  router.get('/api/bloggers/:id/rss', wrap(c.getBloggerRss.bind(c)));
  // 28 Webhook 配置
  router.post('/api/me/webhooks', deps.authenticate, deps.requireBlogger, wrap(c.createWebhook.bind(c)));
  router.get('/api/me/webhooks', deps.authenticate, wrap(c.listWebhooks.bind(c)));
  router.delete('/api/me/webhooks/:webhookId', deps.authenticate, wrap(c.deleteWebhook.bind(c)));
  return router;
}
