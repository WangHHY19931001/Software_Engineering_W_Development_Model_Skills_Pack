import { describe, it, expect, beforeEach } from 'vitest';
import { UserStore } from '../../../src/stores/user.store.js';
import { ConflictError, NotFoundError } from '../../../src/utils/errors.js';

describe('UserStore (DD-002-003 / DD-003-003)', () => {
  let store: UserStore;
  beforeEach(() => { store = new UserStore(); });

  it('TC-UNIT-006N: insert + findByEmail 正常往返', () => {
    const u = store.insert({ email: 'a@b.com', passwordHash: 'h', role: 'admin' });
    expect(u.id).toBeTruthy();
    expect(u.email).toBe('a@b.com');
    expect(store.findByEmail('a@b.com')?.id).toBe(u.id);
    expect(store.findById(u.id)?.email).toBe('a@b.com');
  });

  it('TC-UNIT-006E: 重复 email 抛 ConflictError', () => {
    store.insert({ email: 'a@b.com', passwordHash: 'h', role: 'admin' });
    expect(() => store.insert({ email: 'a@b.com', passwordHash: 'h2', role: 'reader' })).toThrow(ConflictError);
  });

  it('TC-UNIT-006B: email 大小写归一（EMAIL 唯一性）', () => {
    store.insert({ email: 'A@B.com', passwordHash: 'h', role: 'admin' });
    expect(() => store.insert({ email: 'a@b.com', passwordHash: 'h2', role: 'reader' })).toThrow(ConflictError);
  });

  it('update: 不存在抛 NotFoundError', () => {
    expect(() => store.update('missing', { passwordHash: 'x' })).toThrow(NotFoundError);
  });

  it('delete + list + size + clear', () => {
    const u = store.insert({ email: 'a@b.com', passwordHash: 'h', role: 'admin' });
    expect(store.size()).toBe(1);
    expect(store.delete(u.id)).toBe(true);
    expect(store.size()).toBe(0);
    store.insert({ email: 'c@d.com', passwordHash: 'h', role: 'reader' });
    store.clear();
    expect(store.size()).toBe(0);
  });
});
