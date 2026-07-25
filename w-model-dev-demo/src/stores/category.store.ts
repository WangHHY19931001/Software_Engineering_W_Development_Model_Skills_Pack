// SD-009 CategoryStore.

import { MAX_DEPTH, type Category, type CategoryNode } from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { categoryNameSchema } from '../utils/schemas.js';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `c-${counter}`;
}

export class CategoryStore {
  private categories = new Map<string, Category>();
  private parentIdToChildren = new Map<string, Set<string>>();
  private categoryIdToArticles = new Map<string, Set<string>>();

  size(): number {
    return this.categories.size;
  }

  getById(id: string): Category | null {
    const c = this.categories.get(id);
    if (!c || c.deleted) return null;
    return { ...c };
  }

  list(): Category[] {
    const out: Category[] = [];
    for (const c of this.categories.values()) {
      if (!c.deleted) out.push({ ...c });
    }
    return out;
  }

  create(name: string, parentId: string | null): Category {
    if (!categoryNameSchema.safeParse(name).success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    let depth = 0;
    if (parentId) {
      const parent = this.categories.get(parentId);
      if (!parent || parent.deleted) {
        throw new AppError(ErrorCode.NotFound, '1031');
      }
      depth = parent.depth + 1;
      if (depth > MAX_DEPTH) {
        throw new AppError(ErrorCode.DepthLimit, '1004');
      }
    }
    const now = new Date();
    const category: Category = {
      id: nextId(),
      name,
      parentId: parentId ?? null,
      depth,
      sortOrder: 0,
      deleted: false,
      createdAt: now,
      updatedAt: now,
    };
    this.categories.set(category.id, category);
    if (parentId) {
      let set = this.parentIdToChildren.get(parentId);
      if (!set) {
        set = new Set();
        this.parentIdToChildren.set(parentId, set);
      }
      set.add(category.id);
    }
    return { ...category };
  }

  tree(): CategoryNode[] {
    const roots = this.list().filter((c) => c.parentId === null);
    return roots
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => this.buildNode(c.id));
  }

  private buildNode(id: string): CategoryNode {
    const cat = this.categories.get(id);
    if (!cat) throw new AppError(ErrorCode.NotFound, '1031');
    const childIds = this.parentIdToChildren.get(id) ?? new Set<string>();
    const children: CategoryNode[] = Array.from(childIds)
      .map((cid) => this.categories.get(cid))
      .filter((c): c is Category => !!c && !c.deleted)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => this.buildNode(c.id));
    return { category: { ...cat }, children };
  }

  breadcrumb(categoryId: string): Category[] {
    const out: Category[] = [];
    let current = this.categories.get(categoryId);
    if (!current || current.deleted) {
      throw new AppError(ErrorCode.NotFound, '1031');
    }
    while (current) {
      out.unshift({ ...current });
      if (!current.parentId) break;
      const parent = this.categories.get(current.parentId);
      if (!parent || parent.deleted) break;
      current = parent;
    }
    return out;
  }

  cascadeDelete(operatorRole: string, categoryId: string): void {
    if (operatorRole !== 'admin') {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    const cat = this.categories.get(categoryId);
    if (!cat || cat.deleted) throw new AppError(ErrorCode.NotFound, '1031');
    // Recursively delete children.
    const stack: string[] = [categoryId];
    while (stack.length > 0) {
      const id = stack.pop();
      if (!id) break;
      const c = this.categories.get(id);
      if (!c || c.deleted) continue;
      c.deleted = true;
      c.updatedAt = new Date();
      // Null out categoryId on articles in this category.
      const articles = this.categoryIdToArticles.get(id);
      if (articles) {
        // We just clear the index; ArticleStore handles its own field.
        this.categoryIdToArticles.delete(id);
      }
      const children = this.parentIdToChildren.get(id);
      if (children) {
        for (const childId of children) stack.push(childId);
      }
    }
  }

  bindArticle(categoryId: string, articleId: string): void {
    const cat = this.categories.get(categoryId);
    if (!cat || cat.deleted) throw new AppError(ErrorCode.NotFound, '1031');
    let set = this.categoryIdToArticles.get(categoryId);
    if (!set) {
      set = new Set();
      this.categoryIdToArticles.set(categoryId, set);
    }
    set.add(articleId);
  }

  clear(): void {
    this.categories.clear();
    this.parentIdToChildren.clear();
    this.categoryIdToArticles.clear();
  }
}
