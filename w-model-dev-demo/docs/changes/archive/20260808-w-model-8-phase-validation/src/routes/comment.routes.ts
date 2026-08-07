/**
 * 评论路由（INTF-018）：评论 / 回复 / 删除（静态 reply 子路径先于 DELETE 参数路径）。
 * Router 工厂：接收控制器实例与中间件（AppFactory 依赖注入），保持 app.ts 原注册行为与静态优先顺序。
 */
import { Router, type RequestHandler } from 'express';
import type { CommentController } from './interaction/commentController';
import { wrap } from '../utils/asyncHandler';

export interface CommentRouterDeps {
  controller: CommentController;
  authenticate: RequestHandler;
}

export function createCommentRouter(deps: CommentRouterDeps): Router {
  const router = Router();
  const c = deps.controller;
  // 18-20 评论
  router.post('/api/articles/:id/comments', deps.authenticate, wrap(c.createComment.bind(c)));
  router.get('/api/articles/:id/comments', wrap(c.listComments.bind(c)));
  router.post('/api/articles/:id/comments/:cid/reply', deps.authenticate, wrap(c.replyComment.bind(c))); // 静态回复子路径先于 DELETE 参数路径
  router.delete('/api/articles/:id/comments/:cid', deps.authenticate, wrap(c.deleteComment.bind(c)));
  return router;
}
