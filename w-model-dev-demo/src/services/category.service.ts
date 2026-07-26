/**
 * CategoryService（DD-014-002）。
 */
import type { Category } from '../types.js';
import type { CategoryStore } from '../stores/category.store.js';
import { NotFoundError } from '../utils/errors.js';

export class CategoryService {
  constructor(private categoryStore: CategoryStore) {}

  create(name: string, parentCategoryId: string | null = null): Category {
    return this.categoryStore.insert({ name, parentCategoryId });
  }

  list(): Category[] {
    return this.categoryStore.list();
  }

  findById(id: string): Category | undefined {
    return this.categoryStore.findById(id);
  }

  update(id: string, patch: { name?: string; parentCategoryId?: string | null }): Category {
    if (!this.categoryStore.findById(id)) throw new NotFoundError('分类');
    return this.categoryStore.update(id, patch);
  }

  remove(id: string): void {
    if (!this.categoryStore.findById(id)) throw new NotFoundError('分类');
    this.categoryStore.delete(id);
  }
}
