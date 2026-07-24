// 文章路由：/api/articles（发布/列表/详情/审核/评论）
// 对应 outline-design.md INTF-ARTICLE-API + INTF-COMMENT-API
import { Router } from 'express';
import { articleController } from '../controllers/article.controller';
import { commentController } from '../controllers/comment.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { publishArticleSchema, addCommentSchema, reviewArticleSchema } from '../schemas';
import { wrap } from '../utils/async-handler';

const router = Router();

// POST /api/articles —— 发布文章（须登录 + zod 校验）
router.post(
  '/',
  authMiddleware.authenticate.bind(authMiddleware),
  validate(publishArticleSchema),
  wrap(articleController.publishArticle.bind(articleController)),
);

// GET /api/articles —— 文章列表（无须登录，role 默认 user）
router.get('/', wrap(articleController.listArticles.bind(articleController)));

// GET /api/articles/:id —— 文章详情（无须登录，role 默认 user）
router.get('/:id', wrap(articleController.getArticle.bind(articleController)));

// PATCH /api/articles/:id/review —— 管理员审核（须登录 + admin + zod 校验）
router.patch(
  '/:id/review',
  authMiddleware.authenticate.bind(authMiddleware),
  authMiddleware.requireAdmin.bind(authMiddleware),
  validate(reviewArticleSchema),
  wrap(articleController.reviewArticle.bind(articleController)),
);

// POST /api/articles/:id/comments —— 添加评论（须登录 + zod 校验）
router.post(
  '/:id/comments',
  authMiddleware.authenticate.bind(authMiddleware),
  validate(addCommentSchema),
  wrap(commentController.addComment.bind(commentController)),
);

// GET /api/articles/:id/comments —— 评论列表（无须登录）
router.get('/:id/comments', wrap(commentController.listComments.bind(commentController)));

export const articleRoutes = router;
