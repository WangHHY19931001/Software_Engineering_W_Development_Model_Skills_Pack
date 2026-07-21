import { type Response, type Request } from 'express';
import { ArticleService } from '../services/article.service.js';
import { CommentService } from '../services/comment.service.js';
import type { ArticleCreateDTO, ArticleUpdateDTO } from '../schemas/article.schema.js';

export class ArticleController {
  static async create(req: Request, res: Response): Promise<void> {
    const article = await ArticleService.create(
      req.user!.userId,
      req.body as ArticleCreateDTO,
    );
    res.status(201).json(article);
  }

  static async list(req: Request, res: Response): Promise<void> {
    const page = Number(req.query.page ?? '1');
    const pageSize = Number(req.query.pageSize ?? '10');
    const result = await ArticleService.list(page, pageSize);
    res.status(200).json(result);
  }

  static async getById(req: Request, res: Response): Promise<void> {
    const article = await ArticleService.getById(req.params.id);
    const comments = await CommentService.listByArticle(req.params.id);
    res.status(200).json({ ...article, comments });
  }

  static async update(req: Request, res: Response): Promise<void> {
    const article = await ArticleService.update(
      req.user!.userId,
      req.params.id,
      req.body as ArticleUpdateDTO,
    );
    res.status(200).json(article);
  }

  static async remove(req: Request, res: Response): Promise<void> {
    await ArticleService.remove(req.user!.userId, req.params.id);
    res.status(204).end();
  }
}
