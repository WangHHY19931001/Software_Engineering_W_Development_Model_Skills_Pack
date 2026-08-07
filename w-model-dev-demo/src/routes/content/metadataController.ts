/**
 * MetadataController（DD-006 / SD-002 路由处理）：标签/分类路由处理器（创建须博主、查询公开）。
 */
import type { Request, Response, NextFunction } from 'express';
import { parse, tagCreateSchema, categoryCreateSchema } from '../../utils/validationUtil';
import { sendError } from '../../utils/respond';
import { BizError } from '../../utils/errors';
import type { TagService } from '../../services/content/tagService';
import type { CategoryService } from '../../services/content/categoryService';

export class MetadataController {
  constructor(
    private readonly tagService: TagService,
    private readonly categoryService: CategoryService,
  ) {}

  async createTag(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      this.requireBlogger(req);
      const body = parse(tagCreateSchema, req.body).data;
      const tag = await this.tagService.createTag(body.name);
      res.status(201).json({ code: 0, message: 'ok', data: { tagId: tag.id, name: tag.name, createdAt: tag.createdAt } });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async listTags(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const tags = await this.tagService.listTags();
      res.json({ code: 0, message: 'ok', data: { items: tags.map((t) => ({ tagId: t.id, name: t.name })) } });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async createCategory(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireBlogger(req);
      const body = parse(categoryCreateSchema, req.body).data;
      const category = await this.categoryService.createCategory(body.name, body.parentId ?? null, userId);
      res.status(201).json({
        code: 0,
        message: 'ok',
        data: { categoryId: category.id, name: category.name, parentId: category.parentId, depth: category.depth, createdAt: category.createdAt },
      });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async listCategories(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const categories = await this.categoryService.listCategories();
      res.json({
        code: 0,
        message: 'ok',
        data: { items: categories.map((c) => ({ categoryId: c.id, name: c.name, parentId: c.parentId, depth: c.depth })) },
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

  protected requireBlogger(req: Request): string {
    const userId = this.requireUser(req);
    if (req.user?.role !== 'blogger') {
      throw new BizError(40301);
    }
    return userId;
  }
}
