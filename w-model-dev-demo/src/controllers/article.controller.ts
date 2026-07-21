import type { Request, Response } from 'express';
import type { ArticleService } from '../services/article.service.js';
import type { ArticleCreateDTO, ArticleUpdateDTO, PageQuery } from '../types.js';

/**
 * 文章控制器。
 *
 * 设计来源：`docs/outline-design.md` §2.2（接口 3-7）。
 * - 创建 / 修改 / 删除均需鉴权（authorId 取自 `req.user.userId`）。
 * - 列表 / 详情为公开接口（无需 Authorization 头）。
 */
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  create = (req: Request, res: Response): void => {
    const authorId = req.user!.userId;
    const dto = req.body as ArticleCreateDTO;
    const article = this.articleService.create(authorId, dto);
    res.status(201).json({
      articleId: article.id,
      authorId: article.authorId,
      title: article.title,
      content: article.content,
      tags: article.tags,
      createdAt: article.createdAt,
    });
  };

  update = (req: Request, res: Response): void => {
    const authorId = req.user!.userId;
    const articleId = req.params['id'];
    const dto = req.body as ArticleUpdateDTO;
    const article = this.articleService.update(authorId, articleId!, dto);
    res.status(200).json({
      articleId: article.id,
      authorId: article.authorId,
      title: article.title,
      content: article.content,
      tags: article.tags,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    });
  };

  delete = (req: Request, res: Response): void => {
    const authorId = req.user!.userId;
    const articleId = req.params['id'];
    this.articleService.delete(authorId, articleId!);
    res.status(204).send();
  };

  getById = (req: Request, res: Response): void => {
    const articleId = req.params['id'];
    const detail = this.articleService.getById(articleId!);
    res.status(200).json({
      id: detail.id,
      authorId: detail.authorId,
      title: detail.title,
      content: detail.content,
      tags: detail.tags,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
      comments: detail.comments,
    });
  };

  list = (req: Request, res: Response): void => {
    const query = req.query as unknown as PageQuery;
    const result = this.articleService.list(query);
    res.status(200).json(result);
  };
}
