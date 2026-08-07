/**
 * 用户路由（INTF-003~006）：资料 / 改密 / 博主申请 / 关注（静态 /users/me 先于参数 /:id/follow）。
 * Router 工厂：接收控制器实例与中间件（AppFactory 依赖注入），保持 app.ts 原注册行为与静态优先顺序。
 */
import { Router, type RequestHandler } from 'express';
import type { AuthController } from './identity/authController';
import type { InteractionController } from './interaction/interactionController';
import { wrap } from '../utils/asyncHandler';

export interface UserRouterDeps {
  authController: AuthController;
  interactionController: InteractionController;
  authenticate: RequestHandler;
}

export function createUserRouter(deps: UserRouterDeps): Router {
  const router = Router();
  const ac = deps.authController;
  const ic = deps.interactionController;
  // 4-6 用户资料/博主申请（静态路径，先于 /:id/follow）
  router.get('/api/users/me', deps.authenticate, wrap(ac.getProfile.bind(ac)));
  router.patch('/api/users/me', deps.authenticate, wrap(ac.updateProfile.bind(ac)));
  router.put('/api/users/me/password', deps.authenticate, wrap(ac.changePassword.bind(ac)));
  router.post('/api/users/me/blogger', deps.authenticate, wrap(ac.applyBlogger.bind(ac)));
  // 7 关注（参数路径）
  router.post('/api/users/:id/follow', deps.authenticate, wrap(ic.followBlogger.bind(ic)));
  router.delete('/api/users/:id/follow', deps.authenticate, wrap(ic.unfollowBlogger.bind(ic)));
  return router;
}
