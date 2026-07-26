/**
 * ArticleController（DD-005-001 ~ DD-009-001 + DD-017-001 workflow + DD-018-001 like）。
 */
import type { Request, Response, NextFunction } from 'express';
import type { ArticleService } from '../services/article.service.js';
import type { ArticleWorkflowService } from '../services/article-workflow.service.js';
import type { LikeService } from '../services/article-workflow.service.js';
import { articleCreateSchema, articleUpdateSchema, articleListQuerySchema, articleWorkflowSchema } from '../utils/schemas.js';
import { ValidationError } from '../utils/errors.js';
import type { AuthenticatedUser } from '../utils/auth-middleware.js';

function getUser(req: Request): AuthenticatedUser {
  const user = (req as unknown as { user?: AuthenticatedUser }).user;
  if (!user) throw new ValidationError('未认证');
  return user;
}

export class ArticleController {
  constructor(
    private articleService: ArticleService,
    private workflowService: ArticleWorkflowService,
    private likeService: LikeService,
  ) {}

  async create(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const user = getUser(req);
    const input = articleCreateSchema.parse(req.body);
    const article = this.articleService.create({
      title: input.title,
      content: input.content,
      authorId: user.id,
      tagIds: input.tagIds,
      categoryId: input.categoryId,
      status: input.status,
    });
    res.status(201).json(article);
  }

  async list(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const query = articleListQuerySchema.parse(req.query);
    const result = this.articleService.list(query);
    res.json(result);
  }

  async getById(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const id = req.params['id'];
    if (!id) throw new ValidationError('缺少 id');
    const article = this.articleService.getById(id, true);
    res.json(article);
  }

  async update(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const user = getUser(req);
    const id = req.params['id'];
    if (!id) throw new ValidationError('缺少 id');
    const input = articleUpdateSchema.parse(req.body);
    const article = this.articleService.update(id, input, user.id, user.role);
    res.json(article);
  }

  async remove(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const user = getUser(req);
    const id = req.params['id'];
    if (!id) throw new ValidationError('缺少 id');
    this.articleService.remove(id, user.id, user.role);
    res.status(204).end();
  }

  async workflow(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const user = getUser(req);
    const id = req.params['id'];
    if (!id) throw new ValidationError('缺少 id');
    const input = articleWorkflowSchema.parse(req.body);
    const article = this.workflowService.transition(id, input.action, user.id, user.role);
    res.json(article);
  }

  async like(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const user = getUser(req);
    const id = req.params['id'];
    if (!id) throw new ValidationError('缺少 id');
    const result = this.likeService.toggle(user.id, id);
    res.json(result);
  }
}
