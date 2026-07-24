// 评论控制器：处理添加/查询评论 HTTP 请求，编排 CommentService
// 对应 detailed-design.md DD-COMMENT-CTRL
import type { Request, Response } from 'express';
import { commentService } from '../services/comment.service';
import type { CommentService } from '../services/comment.service';
import { AppError } from '../utils/errors';

export class CommentController {
  constructor(private commentService: CommentService) {}

  async addComment(req: Request, res: Response): Promise<void> {
    const articleId = req.params.id;
    const { content } = req.body as { content: string };
    const authorId = req.user?.userId;
    if (!authorId) {
      throw new AppError(40101, '未授权');
    }
    const result = this.commentService.add(articleId, authorId, content);
    if (!result.ok) {
      throw new AppError(result.code, result.message);
    }
    res.status(201).json({
      code: 0,
      message: '评论成功',
      data: {
        commentId: result.data.commentId,
        articleId: result.data.articleId,
        createdAt: result.data.createdAt,
      },
    });
  }

  async listComments(req: Request, res: Response): Promise<void> {
    const articleId = req.params.id;
    const result = this.commentService.listByArticle(articleId);
    if (!result.ok) {
      throw new AppError(result.code, result.message);
    }
    res.status(200).json({
      code: 0,
      message: '查询成功',
      data: { comments: result.data },
    });
  }
}

export const commentController = new CommentController(commentService);
