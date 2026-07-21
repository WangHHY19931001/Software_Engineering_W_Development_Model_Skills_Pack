import { Router } from 'express';
import { ArticleController } from '../controllers/article.controller.js';
import { CommentController } from '../controllers/comment.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middleware/validate.js';
import {
  ArticleCreateSchema,
  ArticleUpdateSchema,
} from '../schemas/article.schema.js';
import { CommentCreateSchema } from '../schemas/comment.schema.js';

const router: Router = Router();

// 公开
router.get('/', asyncHandler(ArticleController.list));
router.get('/:id', asyncHandler(ArticleController.getById));

// 受保护
router.post(
  '/',
  authMiddleware,
  validate(ArticleCreateSchema),
  asyncHandler(ArticleController.create),
);
router.patch(
  '/:id',
  authMiddleware,
  validate(ArticleUpdateSchema),
  asyncHandler(ArticleController.update),
);
router.delete(
  '/:id',
  authMiddleware,
  asyncHandler(ArticleController.remove),
);

// 嵌套评论路由
router.get(
  '/:articleId/comments',
  asyncHandler(CommentController.list),
);
router.post(
  '/:articleId/comments',
  authMiddleware,
  validate(CommentCreateSchema),
  asyncHandler(CommentController.create),
);
router.delete(
  '/:articleId/comments/:commentId',
  authMiddleware,
  asyncHandler(CommentController.remove),
);

export { router as articleRoutes };
