import { describe, it, expect, beforeEach } from 'vitest';
import { TagStore } from '../../../src/stores/tag.store.js';
import { ConflictError, NotFoundError } from '../../../src/utils/errors.js';

describe('TagStore (DD-013-003)', () => {
  let store: TagStore;
  beforeEach(() => { store = new TagStore(); });

  it('TC-UNIT-041N: insert + findByName 正常往返', () => {
    const t = store.insert({ name: 'TypeScript' });
    expect(t.id).toBeTruthy();
    expect(store.findByName('typescript')?.id).toBe(t.id);
  });

  it('TC-UNIT-041E: 重名抛 ConflictError', () => {
    store.insert({ name: 'TS' });
    expect(() => store.insert({ name: 'ts' })).toThrow(ConflictError);
  });

  it('TC-UNIT-041B: update 名称重名抛 ConflictError', () => {
    store.insert({ name: 'a' });
    const b = store.insert({ name: 'b' });
    expect(() => store.update(b.id, { name: 'a' })).toThrow(ConflictError);
  });

  it('update 不存在抛 NotFoundError', () => {
    expect(() => store.update('missing', { name: 'x' })).toThrow(NotFoundError);
  });

  it('delete 同步清理索引', () => {
    const t = store.insert({ name: 'x' });
    store.delete(t.id);
    expect(store.findByName('x')).toBeUndefined();
  });
});
