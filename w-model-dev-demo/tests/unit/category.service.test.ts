// SD-009 CategoryStore + CategoryService unit tests (TC-UNIT-036 ~ TC-UNIT-039).

import { describe, it, expect, beforeEach } from 'vitest';
import { CategoryStore } from '../../src/stores/category.store.js';
import { CategoryService } from '../../src/services/category.service.js';
import { MAX_DEPTH, UserRole } from '../../src/types.js';
import { AppError } from '../../src/utils/errors.js';

describe('SD-009 CategoryStore + CategoryService (TC-UNIT-036 ~ 039)', () => {
  let categoryStore: CategoryStore;
  let categoryService: CategoryService;

  beforeEach(() => {
    categoryStore = new CategoryStore();
    categoryService = new CategoryService(categoryStore);
  });

  it('TC-UNIT-036: category tree depth exceeding MAX_DEPTH throws 1004', () => {
    // Build a chain of MAX_DEPTH+1 (6) categories.
    let parentId: string | null = null;
    for (let i = 0; i < MAX_DEPTH; i++) {
      const c = categoryStore.create(`level-${i}`, parentId);
      parentId = c.id;
    }
    // The next create would make depth = MAX_DEPTH (5), which is allowed (depth > MAX_DEPTH check).
    // depth 5 is the 6th level (0-indexed). depth > MAX_DEPTH means depth > 5, i.e., 6.
    // So we need one more level to trigger the error.
    const atMaxDepth = categoryStore.create(`level-${MAX_DEPTH}`, parentId);
    // Now creating a child of atMaxDepth would have depth = MAX_DEPTH+1 = 6 → throws.
    expect(() => categoryStore.create('too-deep', atMaxDepth.id)).toThrow(AppError);
    try {
      categoryStore.create('too-deep', atMaxDepth.id);
    } catch (err) {
      expect((err as AppError).code).toBe(1004);
    }
  });

  it('TC-UNIT-037: category tree builds recursively', () => {
    const root = categoryStore.create('root', null);
    const child = categoryStore.create('child', root.id);
    const grandchild = categoryStore.create('grandchild', child.id);

    const tree = categoryService.tree();
    expect(tree).toHaveLength(1);
    expect(tree[0]!.category.id).toBe(root.id);
    expect(tree[0]!.children).toBeDefined();
    expect(tree[0]!.children[0]!.category.id).toBe(child.id);
    expect(tree[0]!.children[0]!.children[0]!.category.id).toBe(grandchild.id);
    expect(tree[0]!.children[0]!.children[0]!.children).toBeDefined();
  });

  it('TC-UNIT-038: breadcrumb walks up to root', () => {
    const root = categoryStore.create('root', null);
    const child = categoryStore.create('child', root.id);
    const grandchild = categoryStore.create('grandchild', child.id);

    const result = categoryService.breadcrumb(grandchild.id);
    expect(result).toHaveLength(3);
    expect(result[0]!.parentId).toBeNull();
    expect(result[2]!.id).toBe(grandchild.id);
  });

  it('TC-UNIT-039: cascadeDelete removes parent and children', () => {
    const root = categoryStore.create('root', null);
    const c1 = categoryStore.create('c1', root.id);
    const c2 = categoryStore.create('c2', root.id);

    const initialSize = categoryStore.size();
    categoryService.cascadeDelete('admin-1', UserRole.Admin, root.id);
    // After deletion, getById returns null for soft-deleted categories.
    expect(categoryStore.getById(root.id)).toBeNull();
    expect(categoryStore.getById(c1.id)).toBeNull();
    expect(categoryStore.getById(c2.id)).toBeNull();
    // list() filters out deleted categories.
    expect(categoryStore.list().length).toBe(initialSize - 3);
  });
});
