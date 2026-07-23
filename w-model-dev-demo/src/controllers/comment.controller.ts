/**
 * CommentController：评论 HTTP 适配层（调用 INTF-003）。
 * create 201 / remove 204，异常透传 errorHandler。
 * DTO 映射 comment.id→commentId 以符合 UAT-009 契约。
 */
import type { RequestHandler } from 'express';
import type { CommentService } from '../services/comment.service';
import type { Comment } from '../types';

function toCommentDto(c: Comment) {
  return {
    commentId: c.id,
    articleId: c.articleId,
    authorId: c.authorId,
    content: c.content,
    createdAt: c.createdAt,
  };
}

export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  create: RequestHandler = async (req, res) => {
    const comment = await this.commentService.create(
      req.params.id,
      req.body,
      req.user!.userId,
    );
    res.status(201).json(toCommentDto(comment));
  };

  remove: RequestHandler = async (req, res) => {
    await this.commentService.delete(req.params.commentId, req.user!.userId);
    res.status(204).end();
  };
}
