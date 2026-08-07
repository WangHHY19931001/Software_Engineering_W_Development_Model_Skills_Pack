/**
 * categoryService（DD-010 / SD-002）：分类唯一性（同级重名 40901）、嵌套（深度 ≤3 层，60003）、按分类浏览已发布文章。
 */
import { BizError } from '../../utils/errors';
import type { CategoryStore } from '../../stores/categoryStore';
import type { ArticleStore } from '../../stores/articleStore';
import type { Article, Category, Page } from '../../types';

export class CategoryService {
  constructor(
    private readonly categoryStore: CategoryStore,
    private readonly articleStore: ArticleStore,
  ) {}

  /** 创建分类：parentId 存在性（40401）→ 深度计算（根=1，>3 层 60003）→ 同级重名（40901） */
  createCategory(name: string, parentId: string | null, actorId: string): Category {
    if (parentId) {
      const parent = this.categoryStore.findById(parentId);
      if (!parent) throw new BizError(40401, '父分类不存在');
    }
    const depth = parentId ? this.computeDepth(parentId) + 1 : 1;
    if (depth > 3) {
      throw new BizError(60003, '分类嵌套深度超过 3 层');
    }
    const siblings = this.categoryStore.listByParent(parentId);
    if (siblings.some((c) => c.name === name)) {
      throw new BizError(40901, '同级分类已存在');
    }
    return this.categoryStore.create({ parentId, name, depth, createdAt: new Date().toISOString() });
  }

  listCategories(): Category[] {
    return this.categoryStore.list();
  }

  /** 按分类浏览已发布文章 */
  filterByCategory(categoryId: string, page: number, pageSize: number): Page<Article> {
    return this.articleStore.filterPublished({ categoryId }, page, pageSize);
  }

  /** 沿 parentId 链计算层级（根=1；防环 visited 保护） */
  computeDepth(categoryId: string): number {
    let depth = 1;
    let current = this.categoryStore.findById(categoryId);
    const visited = new Set<string>();
    while (current?.parentId && !visited.has(current.parentId)) {
      visited.add(current.parentId);
      depth += 1;
      current = this.categoryStore.findById(current.parentId);
    }
    return depth;
  }
}
