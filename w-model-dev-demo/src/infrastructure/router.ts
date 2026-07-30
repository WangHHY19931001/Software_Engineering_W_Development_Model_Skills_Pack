/**
 * 路由聚合器
 */
import { Router } from 'express';
import { buildApiRouter, buildRssRouter, type ServiceRegistry } from './routes.js';

export interface RouterDeps {
  services: ServiceRegistry;
}

export function createRouters(deps: RouterDeps): { apiRouter: Router; rssRouter: Router } {
  return {
    apiRouter: buildApiRouter(deps.services),
    rssRouter: buildRssRouter(deps.services),
  };
}
