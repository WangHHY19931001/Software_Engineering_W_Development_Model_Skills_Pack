/**
 * 认证路由（INTF-001/002）：注册 / 登录。
 * Router 工厂：接收控制器实例与中间件（AppFactory 依赖注入），保持 app.ts 原注册行为（wrap 异步 + audit 中间件）。
 */
import { Router, type RequestHandler } from 'express';
import type { AuthController } from './identity/authController';
import { wrap } from '../utils/asyncHandler';

export interface AuthRouterDeps {
  controller: AuthController;
  audit: (action: 'login' | 'publish' | 'delete') => RequestHandler;
}

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();
  const c = deps.controller;
  // 2-3 认证（INTF-001/002）
  router.post('/api/auth/register', wrap(c.register.bind(c)));
  router.post('/api/auth/login', deps.audit('login'), wrap(c.login.bind(c)));
  return router;
}
