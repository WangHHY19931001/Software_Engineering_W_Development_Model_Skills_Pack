/**
 * CategoryStore（DD-013）：Category 实体存储（树形），(parentId, name) 同级唯一索引（重名 40901）。
 */
import { BizError } from '../utils/errors';
import { SnapshotStore, nextId } from './base';
import type { Category } from '../types';

interface CategoryState {
  map: Map<string, Category>;
  byParent: Map<string, Set<string>>;
  seq: { n: number };
}

export type CategoryCreateInput = Omit<Category, 'id'> & { id?: string };

export class CategoryStore extends SnapshotStore<CategoryState> {
  protected state: CategoryState = { map: new Map(), byParent: new Map(), seq: { n: 0 } };

  create(category: CategoryCreateInput): Category {
    const siblings = this.listByParent(category.parentId);
    if (siblings.some((c) => c.name === category.name)) {
      throw new BizError(40901, '同级分类已存在');
    }
    const id = category.id ?? nextId('c', this.state.seq);
    const record: Category = {
      id,
      parentId: category.parentId ?? null,
      name: category.name,
      depth: category.depth,
      createdAt: category.createdAt,
    };
    this.state.map.set(id, record);
    const set = this.state.byParent.get(record.parentId ?? '') ?? new Set<string>();
    set.add(id);
    this.state.byParent.set(record.parentId ?? '', set);
    return record;
  }

  findById(id: string): Category | null {
    return this.state.map.get(id) ?? null;
  }

  findByName(name: string): Category | null {
    for (const c of this.state.map.values()) {
      if (c.name === name) return c;
    }
    return null;
  }

  listByParent(parentId: string | null): Category[] {
    const ids = this.state.byParent.get(parentId ?? '') ?? new Set<string>();
    return [...ids].map((id) => this.state.map.get(id)).filter((c): c is Category => c !== undefined);
  }

  list(): Category[] {
    return [...this.state.map.values()];
  }
}
