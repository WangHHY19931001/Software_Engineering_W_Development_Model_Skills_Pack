// SD-009 CategoryController — thin HTTP wrapper around CategoryService.

import type { Request, Response, NextFunction } from 'express';
import type { CategoryService } from '../services/category.service.js';
import type { AuthService } from '../services/auth.service.js';

export class CategoryController {
  constructor(
    private categoryService: CategoryService,
    private authService: AuthService,
  ) {}

  create = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parentId = req.body.parentId ?? null;
      res.status(201).json(this.categoryService.createCategory(req.body.name, parentId));
    } catch (err) {
      next(err);
    }
  };

  tree = (_req: Request, res: Response, next: NextFunction): void => {
    try {
      res.json(this.categoryService.tree());
    } catch (err) {
      next(err);
    }
  };

  breadcrumb = (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.json(this.categoryService.breadcrumb(req.params.categoryId!));
    } catch (err) {
      next(err);
    }
  };

  cascadeDelete = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.categoryService.cascadeDelete(ctx.userId, ctx.role, req.params.categoryId!);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  bindCategory = (req: Request, res: Response, next: NextFunction): void => {
    try {
      this.categoryService.bindCategory(req.params.articleId!, req.body.categoryId);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  private authContext(req: Request): { userId: string; role: string } {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    return this.authService.verifyToken(token);
  }
}
