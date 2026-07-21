import type { Request, Response } from 'express';
import type { CommentService } from '../services/comment.service.js';

/**
 * 评论控制器。
 *
 * 设计来源：`docs/outline-design.md` §2.3（接口 8-10）。
 * - 发表 / 删除需鉴权（authorId 取自 `req.user.userId`，不取自 body）。
 * - 列表为公开接口。
 */
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  create = (req: Request, res: Response): void => {
    const authorId = req.user!.userId;
    const articleId = req.params['id'];
    const { content } = req.body as { content: string };
    const comment = this.commentService.create(authorId, articleId!, content);
    res.status(201).json({
      commentId: comment.id,
      articleId: comment.articleId,
      authorId: comment.authorId,
      content: comment.content,
      createdAt: comment.createdAt,
    });
  };

  listByArticle = (req: Request, res: Response): void => {
    const articleId = req.params['id'];
    const items = this.commentService.listByArticle(articleId!);
    res.status(200).json({ items, total: items.length });
  };

  delete = (req: Request, res: Response): void => {
    const authorId = req.user!.userId;
    const commentId = req.params['commentId'];
    this.commentService.delete(authorId, commentId!);
    res.status(204).send();
  };
}
