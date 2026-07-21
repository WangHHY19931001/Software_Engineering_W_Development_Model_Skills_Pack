import { Router } from 'express';
import type { ArticleController } from '../controllers/article.controller.js';
import type { CommentController } from '../controllers/comment.controller.js';
import type { AuthMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ArticleCreateSchema, ArticleUpdateSchema, ArticleListQuerySchema } from '../schemas/article.schema.js';
import { CommentCreateSchema } from '../schemas/comment.schema.js';

/**
 * 文章 + 评论路由（评论挂在 /articles/:id/comments 下）。
 *
 * 设计来源：`docs/outline-design.md` §2.2 / §2.3。
 * - 创建 / 修改 / 删除文章 / 发表 / 删除评论 → 需鉴权。
 * - 列表 / 详情 / 评论列表 → 公开。
 */
export function buildArticleRoutes(
  articleController: ArticleController,
  commentController: CommentController,
  authMiddleware: AuthMiddleware,
): Router {
  const router = Router();

  // 文章
  router.get('/', validate({ query: ArticleListQuerySchema }), articleController.list);
  router.get('/:id', articleController.getById);
  router.post('/', authMiddleware.verify, validate({ body: ArticleCreateSchema }), articleController.create);
  router.patch('/:id', authMiddleware.verify, validate({ body: ArticleUpdateSchema }), articleController.update);
  router.delete('/:id', authMiddleware.verify, articleController.delete);

  // 评论（嵌套在文章下）
  router.get('/:id/comments', commentController.listByArticle);
  router.post('/:id/comments', authMiddleware.verify, validate({ body: CommentCreateSchema }), commentController.create);
  router.delete('/:id/comments/:commentId', authMiddleware.verify, commentController.delete);

  return router;
}
