/**
 * DD-011 CategoryService —— 分类服务
 *
 * 分类树 CRUD（多级父子）、分类导航、面包屑、文章分类列表。
 * 依赖：DD-007 ArticleService、DD-024 WalWriter。
 * 循环引用检测：detectCycle。
 */
import { z } from 'zod';
import type { Category, CategoryNode, Page, Article } from '../../types.js';
import { GenericStore } from '../../stores/generic-store.js';
import { articleStore } from '../../stores/article-store.js';
import { AppError } from '../../utils/errors.js';
import type { WalWriter } from '../../infrastructure/wal.js';

export interface CategoryInput {
  name: string;
  parentId?: string;
  order?: number;
}

const CategorySchema = z.object({
  name: z.string().min(1, '分类名不能为空').max(50, '分类名长度至多 50 字'),
  parentId: z.string().optional(),
  order: z.number().int().default(0),
});

const categoryStore = new GenericStore<Category>();
const childrenIndex = new Map<string, Set<string>>(); // parentId -> 子分类集合

function genId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface CategoryServiceDeps {
  walWriter: WalWriter;
}

export class CategoryService {
  constructor(private deps: CategoryServiceDeps) {}

  /** 检测循环引用（对应 DD-011 detectCycle） */
  detectCycle(id: string, newParentId?: string): boolean {
    if (!newParentId) return false;
    const visited = new Set<string>();
    let current: string | undefined = newParentId;
    while (current) {
      if (current === id) return true;
      if (visited.has(current)) return true;
      visited.add(current);
      const cat = categoryStore.findById(current);
      current = cat?.parentId;
    }
    return false;
  }

  /** 创建分类（对应 DD-011 createCategory） */
  async createCategory(input: CategoryInput, actorId: string): Promise<Category> {
    const parsed = CategorySchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(40003, '输入校验失败', { issues: parsed.error.issues });
    }
    if (parsed.data.parentId) {
      const parent = categoryStore.findById(parsed.data.parentId);
      if (!parent) {
        throw new AppError(40401, `父分类不存在: ${parsed.data.parentId}`, { parentId: parsed.data.parentId });
      }
    }
    const now = Math.floor(Date.now() / 1000);
    const category: Category = {
      id: genId(),
      name: parsed.data.name,
      parentId: parsed.data.parentId,
      order: parsed.data.order,
    };
    categoryStore.insert(category);
    if (parsed.data.parentId) {
      let set = childrenIndex.get(parsed.data.parentId);
      if (!set) {
        set = new Set();
        childrenIndex.set(parsed.data.parentId, set);
      }
      set.add(category.id);
    }
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'category.create',
      payload: category,
      timestamp: now,
    });
    return category;
  }

  /** 更新分类（对应 DD-011 updateCategory） */
  async updateCategory(id: string, input: Partial<CategoryInput>, actorId: string): Promise<Category> {
    const existing = categoryStore.findById(id);
    if (!existing) {
      throw new AppError(40401, `分类不存在: ${id}`, { id });
    }
    if (input.name !== undefined) {
      if (input.name.length < 1 || input.name.length > 50) {
        throw new AppError(40003, '分类名长度 ∈ [1,50]');
      }
    }
    if (input.parentId !== undefined && input.parentId !== existing.parentId) {
      if (input.parentId && this.detectCycle(id, input.parentId)) {
        throw new AppError(60005, '检测到循环引用', { id, newParentId: input.parentId });
      }
      // 从旧父分类的 children 移除
      if (existing.parentId) {
        const set = childrenIndex.get(existing.parentId);
        set?.delete(id);
        if (set && set.size === 0) childrenIndex.delete(existing.parentId);
      }
      // 加入新父分类的 children
      if (input.parentId) {
        let set = childrenIndex.get(input.parentId);
        if (!set) {
          set = new Set();
          childrenIndex.set(input.parentId, set);
        }
        set.add(id);
      }
    }
    const patch: Partial<Category> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.parentId !== undefined) patch.parentId = input.parentId;
    if (input.order !== undefined) patch.order = input.order;
    categoryStore.update(id, patch);
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'category.update',
      payload: categoryStore.findById(id),
      timestamp: now,
    });
    const updated = categoryStore.findById(id);
    if (!updated) throw new AppError(50001, '更新后分类丢失');
    return updated;
  }

  /** 删除分类（对应 DD-011 deleteCategory） */
  async deleteCategory(id: string, actorId: string): Promise<void> {
    const existing = categoryStore.findById(id);
    if (!existing) {
      throw new AppError(40401, `分类不存在: ${id}`, { id });
    }
    // 有子分类则拒绝
    const children = childrenIndex.get(id);
    if (children && children.size > 0) {
      throw new AppError(60002, '存在子分类，不能删除', { id, childCount: children.size });
    }
    if (existing.parentId) {
      const set = childrenIndex.get(existing.parentId);
      set?.delete(id);
      if (set && set.size === 0) childrenIndex.delete(existing.parentId);
    }
    categoryStore.delete(id);
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'category.delete',
      payload: { id, actorId },
      timestamp: now,
    });
  }

  /** 完整分类树（对应 DD-011 getCategoryTree） */
  getCategoryTree(): CategoryNode[] {
    const all = categoryStore.list();
    const byId = new Map<string, CategoryNode>();
    for (const c of all) {
      byId.set(c.id, { ...c, children: [] });
    }
    const roots: CategoryNode[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    // 排序
    const sortRec = (nodes: CategoryNode[]): void => {
      nodes.sort((a, b) => a.order - b.order);
      nodes.forEach(n => sortRec(n.children));
    };
    sortRec(roots);
    return roots;
  }

  /** 面包屑路径（对应 DD-011 getBreadcrumb） */
  getBreadcrumb(id: string): Category[] {
    const existing = categoryStore.findById(id);
    if (!existing) {
      throw new AppError(40401, `分类不存在: ${id}`, { id });
    }
    const path: Category[] = [];
    let current: Category | null = existing;
    const visited = new Set<string>();
    while (current) {
      if (visited.has(current.id)) break; // 防御性
      visited.add(current.id);
      path.unshift(current);
      current = current.parentId ? categoryStore.findById(current.parentId) : null;
    }
    return path;
  }

  /** 分类下文章列表（对应 DD-011 getArticlesByCategory） */
  getArticlesByCategory(id: string, page: number, size: number): Page<Article> {
    const existing = categoryStore.findById(id);
    if (!existing) {
      throw new AppError(40401, `分类不存在: ${id}`, { id });
    }
    if (page < 1) throw new AppError(40003, 'page 必须 ≥ 1');
    if (size < 1 || size > 100) throw new AppError(40003, 'size 必须 ∈ [1,100]');
    return articleStore.list({ categoryId: id }, page, size);
  }

  /** 按 ID 查询 */
  findById(id: string): Category | null {
    return categoryStore.findById(id);
  }

  /** 测试重置 */
  static _reset(): void {
    categoryStore.clear();
    childrenIndex.clear();
  }
}
