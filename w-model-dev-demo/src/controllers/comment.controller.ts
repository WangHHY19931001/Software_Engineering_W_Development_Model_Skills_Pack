import { type Response, type Request } from 'express';
import { CommentService } from '../services/comment.service.js';
import type { CommentCreateDTO } from '../schemas/comment.schema.js';

export class CommentController {
  static async create(req: Request, res: Response): Promise<void> {
    const comment = await CommentService.create(
      req.user!.userId,
      req.params.articleId,
      req.body as CommentCreateDTO,
    );
    res.status(201).json(comment);
  }

  static async list(req: Request, res: Response): Promise<void> {
    const items = await CommentService.listByArticle(req.params.articleId);
    res.status(200).json({ items, total: items.length });
  }

  static async remove(req: Request, res: Response): Promise<void> {
    await CommentService.remove(req.user!.userId, req.params.commentId);
    res.status(204).end();
  }
}
