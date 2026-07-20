import { Router } from 'express';
import * as articleController from '../controllers/article-controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

export const articleRouter = Router();

// 公开路由（无需认证）
articleRouter.get('/', asyncHandler(articleController.list));
articleRouter.get('/:id', asyncHandler(articleController.getById));

// 需认证路由
articleRouter.post('/', authMiddleware, asyncHandler(articleController.create));
articleRouter.put('/:id', authMiddleware, asyncHandler(articleController.update));
articleRouter.delete('/:id', authMiddleware, asyncHandler(articleController.remove));
