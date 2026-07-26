import { describe, it, expect, beforeEach } from 'vitest';
import { CategoryStore } from '../../../src/stores/category.store.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../src/utils/errors.js';

describe('CategoryStore (DD-014-003)', () => {
  let store: CategoryStore;
  beforeEach(() => { store = new CategoryStore(); });

  it('TC-UNIT-044N: insert + findById 正常往返', () => {
    const c = store.insert({ name: 'Tech', parentCategoryId: null });
    expect(c.id).toBeTruthy();
    expect(store.findById(c.id)?.name).toBe('Tech');
  });

  it('TC-UNIT-044E: 父分类不存在抛 ValidationError', () => {
    expect(() => store.insert({ name: 'Sub', parentCategoryId: 'missing' })).toThrow(ValidationError);
  });

  it('TC-UNIT-044B: 循环依赖检测抛 ConflictError', () => {
    const c1 = store.insert({ name: 'c1', parentCategoryId: null });
    const c2 = store.insert({ name: 'c2', parentCategoryId: c1.id });
    expect(() => store.update(c1.id, { parentCategoryId: c2.id })).toThrow(ConflictError);
  });

  it('update 不存在抛 NotFoundError', () => {
    expect(() => store.update('missing', { name: 'x' })).toThrow(NotFoundError);
  });

  it('delete: 存在子分类抛 ConflictError', () => {
    const c1 = store.insert({ name: 'c1', parentCategoryId: null });
    store.insert({ name: 'c2', parentCategoryId: c1.id });
    expect(() => store.delete(c1.id)).toThrow(ConflictError);
  });
});
