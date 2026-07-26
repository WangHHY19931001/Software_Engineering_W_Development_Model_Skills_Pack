import { describe, it, expect, beforeEach } from 'vitest';
import { UserProfileService } from '../../../src/services/user-profile.service.js';
import { UserProfileStore } from '../../../src/stores/user-profile.store.js';
import { UserStore } from '../../../src/stores/user.store.js';
import { NotFoundError } from '../../../src/utils/errors.js';

describe('UserProfileService (DD-021-002)', () => {
  let profileStore: UserProfileStore;
  let userStore: UserStore;
  let svc: UserProfileService;
  beforeEach(() => {
    profileStore = new UserProfileStore();
    userStore = new UserStore();
    svc = new UserProfileService(profileStore, userStore);
    userStore.insert({ email: 'a@b.com', passwordHash: 'h', role: 'admin' });
  });

  it('TC-UNIT-067N: updateProfile 创建 + 更新', () => {
    const u = userStore.findByEmail('a@b.com')!;
    const p1 = svc.updateProfile(u.id, { nickname: 'A' });
    expect(p1.nickname).toBe('A');
    const p2 = svc.updateProfile(u.id, { bio: 'hello' });
    expect(p2.bio).toBe('hello');
    expect(p2.nickname).toBe('A');
  });

  it('TC-UNIT-067E: getProfile 用户不存在抛 NotFoundError', () => {
    expect(() => svc.getProfile('missing')).toThrow(NotFoundError);
  });

  it('TC-UNIT-067B: updateProfile 用户不存在抛 NotFoundError', () => {
    expect(() => svc.updateProfile('missing', { nickname: 'A' })).toThrow(NotFoundError);
  });
});
