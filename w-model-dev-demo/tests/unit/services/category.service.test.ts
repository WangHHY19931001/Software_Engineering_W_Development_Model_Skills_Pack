import { describe, it, expect, beforeEach } from 'vitest';
import { CategoryService } from '../../../src/services/category.service.js';
import { CategoryStore } from '../../../src/stores/category.store.js';
import { NotFoundError } from '../../../src/utils/errors.js';

describe('CategoryService (DD-014-002)', () => {
  let store: CategoryStore;
  let svc: CategoryService;
  beforeEach(() => { store = new CategoryStore(); svc = new CategoryService(store); });

  it('TC-UNIT-044N: create + list 正常往返', () => {
    const c = svc.create('Tech', null);
    expect(c.id).toBeTruthy();
    expect(svc.list()).toHaveLength(1);
  });

  it('TC-UNIT-044E: update 不存在抛 NotFoundError', () => {
    expect(() => svc.update('missing', { name: 'x' })).toThrow(NotFoundError);
  });

  it('TC-UNIT-044B: create 嵌套子分类', () => {
    const parent = svc.create('Parent', null);
    const child = svc.create('Child', parent.id);
    expect(child.parentCategoryId).toBe(parent.id);
  });

  it('remove 不存在抛 NotFoundError', () => {
    expect(() => svc.remove('missing')).toThrow(NotFoundError);
  });
});
