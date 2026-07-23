/**
 * UserStore 单元测试（UT-001~004）。
 * 真实内存 Map 隔离，每个测试前 clear()。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { UserStore } from '../../../src/stores/user.store';
import { ConflictError, ErrorCode } from '../../../src/utils/errors';
import type { User } from '../../../src/types';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    username: 'alice',
    passwordHash: '$2b$10$x',
    createdAt: '2026-07-23T00:00:00.000Z',
    ...overrides,
  };
}

describe('UserStore', () => {
  let store: UserStore;
  beforeEach(() => {
    store = new UserStore();
  });

  it('UT-001 insert 正常写入 + 索引建立', () => {
    const user = makeUser();
    store.insert(user);
    expect(store.size()).toBe(1);
    expect(store.findByUsername('alice')?.id).toBe('u1');
  });

  it('UT-002 insert 用户名冲突抛 ConflictError 40901', () => {
    store.insert(makeUser({ id: 'u1' }));
    expect(() => store.insert(makeUser({ id: 'u2' }))).toThrow(ConflictError);
    try {
      store.insert(makeUser({ id: 'u2' }));
    } catch (err) {
      expect((err as ConflictError).code).toBe(ErrorCode.CONFLICT);
      expect((err as ConflictError).httpStatus).toBe(409);
    }
    expect(store.size()).toBe(1);
  });

  it('UT-003 findByUsername 命中/未命中', () => {
    store.insert(makeUser());
    expect(store.findByUsername('alice')?.username).toBe('alice');
    expect(store.findByUsername('bob')).toBeUndefined();
  });

  it('UT-004 findById 命中/未命中', () => {
    store.insert(makeUser({ id: 'u1' }));
    expect(store.findById('u1')?.id).toBe('u1');
    expect(store.findById('nope')).toBeUndefined();
  });
});
