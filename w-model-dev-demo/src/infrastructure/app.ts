/**
 * 应用工厂 - 装配所有路由 + 中间件
 */
import express, { type Application, type Router } from 'express';
import { ErrorHandler, notFoundHandler } from './error-handler.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.middleware.js';
import { loggingMiddleware } from '../middleware/logging.middleware.js';
import type { AppEnv } from '../utils/env.js';

export interface AppDeps {
  apiRouter: Router;
  rssRouter: Router;
  env: AppEnv;
}

export function createApp(deps: AppDeps): Application {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(loggingMiddleware());
  app.use(rateLimitMiddleware());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: Date.now() });
  });

  app.use('/api', deps.apiRouter);
  app.use('/', deps.rssRouter);

  app.use(notFoundHandler);
  app.use(ErrorHandler.handle);

  return app;
}
