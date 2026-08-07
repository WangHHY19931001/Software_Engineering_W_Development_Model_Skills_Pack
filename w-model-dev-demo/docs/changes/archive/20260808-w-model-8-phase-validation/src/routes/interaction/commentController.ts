/**
 * CommentController（DD-015 / SD-003 路由处理）：评论发表/列表/删除/回复。
 * 发表/回复须认证（未认证 40101，控制器入口拦截）；删除授权由服务层判定（RH-03，非作者 40301）。
 */
import type { Request, Response, NextFunction } from 'express';
import { parse, commentCreateSchema, parsePage } from '../../utils/validationUtil';
import { sendError } from '../../utils/respond';
import { BizError } from '../../utils/errors';
import type { CommentService } from '../../services/interaction/commentService';
import type { AuthService } from '../../services/identity/authService';

export class CommentController {
  constructor(
    private readonly commentService: CommentService,
    private readonly authService: AuthService,
  ) {}

  async createComment(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      const body = parse(commentCreateSchema, req.body).data;
      const comment = await this.commentService.createComment(req.params.id, userId, body.content, body.parentId);
      const author = await this.authService.getUserById(userId);
      res.status(201).json({
        code: 0,
        message: 'ok',
        data: {
          commentId: comment.id,
          articleId: comment.articleId,
          authorId: comment.authorId,
          authorName: author?.username ?? '',
          content: comment.content,
          parentId: comment.parentId,
          createdAt: comment.createdAt,
        },
      });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async listComments(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const { page, pageSize } = parsePage(req.query.page, req.query.pageSize);
      const result = await this.commentService.listComments(req.params.id, page, pageSize);
      const items = await Promise.all(
        result.items.map(async (c) => {
          const author = await this.authService.getUserById(c.authorId);
          return {
            commentId: c.id,
            articleId: c.articleId,
            authorId: c.authorId,
            authorName: author?.username ?? '',
            content: c.content,
            parentId: c.parentId,
            createdAt: c.createdAt,
          };
        }),
      );
      res.json({ code: 0, message: 'ok', data: { items, total: result.total, page: result.page, pageSize: result.pageSize } });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async deleteComment(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      await this.commentService.deleteComment(req.params.id, req.params.cid, userId);
      res.status(204).send();
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async replyComment(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      const body = parse(commentCreateSchema, req.body).data;
      const comment = await this.commentService.replyComment(req.params.id, req.params.cid, userId, body.content);
      const author = await this.authService.getUserById(userId);
      res.status(201).json({
        code: 0,
        message: 'ok',
        data: {
          commentId: comment.id,
          articleId: comment.articleId,
          authorId: comment.authorId,
          authorName: author?.username ?? '',
          content: comment.content,
          parentId: comment.parentId,
          createdAt: comment.createdAt,
        },
      });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  protected requireUser(req: Request): string {
    if (!req.user?.userId) {
      throw new BizError(40101);
    }
    return req.user.userId;
  }
}
