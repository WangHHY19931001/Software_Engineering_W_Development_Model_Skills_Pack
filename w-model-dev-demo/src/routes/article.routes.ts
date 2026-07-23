/**
 * article + comment 路由（realizes INTF-002 / INTF-003 HTTP 绑定）。
 * 挂载于 /api/v1 前缀，含：
 *   GET    /articles          公开，分页
 *   GET    /articles/:id      公开，详情+评论聚合
 *   POST   /articles          需鉴权
 *   PUT    /articles/:id      需鉴权（作者隔离由 service 校验）
 *   DELETE /articles/:id      需鉴权
 *   POST   /articles/:id/comments  需鉴权
 *   DELETE /comments/:commentId    需鉴权
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import type { JwtService } from '../utils/jwt';
import type { ArticleController } from '../controllers/article.controller';
import type { CommentController } from '../controllers/comment.controller';
import {
  articleCreateSchema,
  articleUpdateSchema,
  paginationSchema,
  articleIdParamSchema,
} from '../schemas/article.schema';
import { commentCreateSchema, commentIdParamSchema } from '../schemas/comment.schema';

export function buildArticleRoutes(
  articleController: ArticleController,
  commentController: CommentController,
  jwtService: JwtService,
): Router {
  const router = Router();
  const auth = authMiddleware(jwtService);

  router.get(
    '/articles',
    validateRequest({ query: paginationSchema }),
    asyncHandler(articleController.list),
  );
  router.get(
    '/articles/:id',
    validateRequest({ params: articleIdParamSchema }),
    asyncHandler(articleController.getById),
  );
  router.post(
    '/articles',
    auth,
    validateRequest({ body: articleCreateSchema }),
    asyncHandler(articleController.create),
  );
  router.put(
    '/articles/:id',
    auth,
    validateRequest({ params: articleIdParamSchema, body: articleUpdateSchema }),
    asyncHandler(articleController.update),
  );
  router.delete(
    '/articles/:id',
    auth,
    validateRequest({ params: articleIdParamSchema }),
    asyncHandler(articleController.remove),
  );
  router.post(
    '/articles/:id/comments',
    auth,
    validateRequest({ params: articleIdParamSchema, body: commentCreateSchema }),
    asyncHandler(commentController.create),
  );
  router.delete(
    '/comments/:commentId',
    auth,
    validateRequest({ params: commentIdParamSchema }),
    asyncHandler(commentController.remove),
  );
  return router;
}
