import { Router } from 'express';
import * as commentController from '../controllers/comment-controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

export const commentRouter = Router({ mergeParams: true });

// 公开路由
commentRouter.get('/', asyncHandler(commentController.listByArticle));

// 需认证路由
commentRouter.post('/', authMiddleware, asyncHandler(commentController.create));
