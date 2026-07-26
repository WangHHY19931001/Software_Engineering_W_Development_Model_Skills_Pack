/**
 * CategoryStore（DD-014-003）— 分类存储 + 父子关系 + 循环检查。
 */
import type { Category } from '../types.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { generateId } from '../utils/id.js';
import { CategoryCycleChecker } from '../utils/article-helpers.js';

export class CategoryStore {
  private categories: Map<string, Category> = new Map();
  private cycleChecker: CategoryCycleChecker = new CategoryCycleChecker();

  insert(category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Category {
    if (category.parentCategoryId !== null) {
      const parent = this.categories.get(category.parentCategoryId);
      if (!parent) {
        throw new ValidationError('父分类不存在');
      }
    }
    const now = new Date().toISOString();
    const record: Category = {
      id: category.id ?? generateId('category'),
      name: category.name,
      parentCategoryId: category.parentCategoryId,
      createdAt: now,
      updatedAt: now,
    };
    this.categories.set(record.id, record);
    return record;
  }

  findById(id: string): Category | undefined {
    return this.categories.get(id);
  }

  update(id: string, patch: Partial<Pick<Category, 'name' | 'parentCategoryId'>>): Category {
    const category = this.categories.get(id);
    if (!category) throw new NotFoundError('分类');
    if (patch.parentCategoryId !== undefined) {
      if (patch.parentCategoryId !== null) {
        const parent = this.categories.get(patch.parentCategoryId);
        if (!parent) {
          throw new ValidationError('父分类不存在');
        }
        if (!this.cycleChecker.check(id, patch.parentCategoryId, this.categories)) {
          throw new ConflictError('分类循环依赖（NoCycle 不变式违反）');
        }
      }
    }
    const updated: Category = {
      ...category,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.categories.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    const hasChildren = [...this.categories.values()].some(
      (c) => c.parentCategoryId === id,
    );
    if (hasChildren) {
      throw new ConflictError('存在子分类，无法删除');
    }
    return this.categories.delete(id);
  }

  list(): Category[] {
    return [...this.categories.values()];
  }

  size(): number {
    return this.categories.size;
  }

  clear(): void {
    this.categories.clear();
  }

  getCycleChecker(): CategoryCycleChecker {
    return this.cycleChecker;
  }
}
