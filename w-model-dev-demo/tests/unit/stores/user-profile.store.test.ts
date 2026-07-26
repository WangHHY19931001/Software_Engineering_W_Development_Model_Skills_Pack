import { describe, it, expect, beforeEach } from 'vitest';
import { UserProfileStore } from '../../../src/stores/user-profile.store.js';
import { NotFoundError } from '../../../src/utils/errors.js';

describe('UserProfileStore (DD-021-002)', () => {
  let store: UserProfileStore;
  beforeEach(() => { store = new UserProfileStore(); });

  it('TC-UNIT-067N: upsert 创建 + 更新', () => {
    const p1 = store.upsert('u1', { nickname: 'A' });
    expect(p1.nickname).toBe('A');
    const p2 = store.upsert('u1', { avatar: 'http://x.com/a.png' });
    expect(p2.nickname).toBe('A');
    expect(p2.avatar).toBe('http://x.com/a.png');
  });

  it('TC-UNIT-067E: findByUserIdOrFail 不存在抛 NotFoundError', () => {
    expect(() => store.findByUserIdOrFail('missing')).toThrow(NotFoundError);
  });

  it('TC-UNIT-067B: 默认值 nickname/avatar/bio 为空串', () => {
    store.upsert('u1', {});
    const p = store.findByUserId('u1')!;
    expect(p.nickname).toBe('');
    expect(p.avatar).toBe('');
    expect(p.bio).toBe('');
  });

  it('delete + size', () => {
    store.upsert('u1', { nickname: 'A' });
    expect(store.delete('u1')).toBe(true);
    expect(store.size()).toBe(0);
  });
});
