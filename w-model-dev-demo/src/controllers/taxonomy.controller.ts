/**
 * TagController（DD-013-001）+ CategoryController（DD-014-001）。
 */
import type { Request, Response, NextFunction } from 'express';
import type { TagService } from '../services/tag.service.js';
import type { CategoryService } from '../services/category.service.js';
import { tagCreateSchema, tagUpdateSchema, categoryCreateSchema, categoryUpdateSchema } from '../utils/schemas.js';
import { ValidationError } from '../utils/errors.js';

export class TagController {
  constructor(private tagService: TagService) {}

  async list(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.json(this.tagService.list());
  }

  async create(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const input = tagCreateSchema.parse(req.body);
    const tag = this.tagService.create(input.name);
    res.status(201).json(tag);
  }

  async update(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const id = req.params['id'];
    if (!id) throw new ValidationError('缺少 id');
    const input = tagUpdateSchema.parse(req.body);
    const tag = this.tagService.update(id, input.name);
    res.json(tag);
  }

  async remove(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const id = req.params['id'];
    if (!id) throw new ValidationError('缺少 id');
    this.tagService.remove(id);
    res.status(204).end();
  }
}

export class CategoryController {
  constructor(private categoryService: CategoryService) {}

  async list(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.json(this.categoryService.list());
  }

  async create(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const input = categoryCreateSchema.parse(req.body);
    const category = this.categoryService.create(input.name, input.parentCategoryId);
    res.status(201).json(category);
  }

  async update(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const id = req.params['id'];
    if (!id) throw new ValidationError('缺少 id');
    const input = categoryUpdateSchema.parse(req.body);
    const category = this.categoryService.update(id, input);
    res.json(category);
  }

  async remove(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const id = req.params['id'];
    if (!id) throw new ValidationError('缺少 id');
    this.categoryService.remove(id);
    res.status(204).end();
  }
}
