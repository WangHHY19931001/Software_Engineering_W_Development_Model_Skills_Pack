/**
 * CommentController（DD-010-001 / DD-011-001 / DD-012-001）。
 */
import type { Request, Response, NextFunction } from 'express';
import type { CommentService } from '../services/comment.service.js';
import { commentCreateSchema } from '../utils/schemas.js';
import { ValidationError } from '../utils/errors.js';
import type { AuthenticatedUser } from '../utils/auth-middleware.js';

function getUser(req: Request): AuthenticatedUser {
  const user = (req as unknown as { user?: AuthenticatedUser }).user;
  if (!user) throw new ValidationError('未认证');
  return user;
}

export class CommentController {
  constructor(private commentService: CommentService) {}

  async create(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const user = getUser(req);
    const articleId = req.params['articleId'] ?? req.params['id'];
    if (!articleId) throw new ValidationError('缺少文章 id');
    const input = commentCreateSchema.parse(req.body);
    const comment = this.commentService.create(articleId, user.id, input.content);
    res.status(201).json(comment);
  }

  async listByArticle(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const articleId = req.params['articleId'] ?? req.params['id'];
    if (!articleId) throw new ValidationError('缺少文章 id');
    const page = parseInt((req.query['page'] as string) ?? '1', 10) || 1;
    const limit = parseInt((req.query['limit'] as string) ?? '10', 10) || 10;
    const result = this.commentService.listByArticle(articleId, page, limit);
    res.json(result);
  }

  async remove(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const user = getUser(req);
    const id = req.params['id'];
    if (!id) throw new ValidationError('缺少评论 id');
    this.commentService.remove(id, user.id, user.role);
    res.status(204).end();
  }
}
