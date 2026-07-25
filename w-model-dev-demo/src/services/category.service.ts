// SD-009 CategoryService.

import { UserRole, type Category, type CategoryNode } from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import type { CategoryStore } from '../stores/category.store.js';

export class CategoryService {
  constructor(private categoryStore: CategoryStore) {}

  /** createCategory — TLA+ L2_content_management.createCategory */
  createCategory(name: string, parentId: string | null): Category {
    return this.categoryStore.create(name, parentId);
  }

  /** bindCategory — TLA+ L2_content_management.bindCategory */
  bindCategory(articleId: string, categoryId: string): void {
    const cat = this.categoryStore.getById(categoryId);
    if (!cat) throw new AppError(ErrorCode.NotFound, '1031');
    this.categoryStore.bindArticle(categoryId, articleId);
  }

  tree(): CategoryNode[] {
    return this.categoryStore.tree();
  }

  breadcrumb(categoryId: string): Category[] {
    return this.categoryStore.breadcrumb(categoryId);
  }

  /** cascadeDelete — admin only. */
  cascadeDelete(_operatorId: string, operatorRole: string, categoryId: string): void {
    if (operatorRole !== UserRole.Admin) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    this.categoryStore.cascadeDelete(operatorRole, categoryId);
  }
}
