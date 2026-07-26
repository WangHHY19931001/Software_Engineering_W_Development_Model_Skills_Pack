import { describe, it, expect, beforeEach } from 'vitest';
import { UserService } from '../../../src/services/user.service.js';
import { UserStore } from '../../../src/stores/user.store.js';
import { UserProfileStore } from '../../../src/stores/user-profile.store.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../src/utils/errors.js';

describe('UserService (DD-002-002 / DD-021-002)', () => {
  let store: UserStore;
  let profileStore: UserProfileStore;
  let svc: UserService;
  beforeEach(() => {
    store = new UserStore();
    profileStore = new UserProfileStore();
    svc = new UserService(store, profileStore);
  });

  it('TC-UNIT-005N: createUser 正常创建（含 profile 初始化）', async () => {
    const u = await svc.createUser({ email: 'a@b.com', password: 'password123', role: 'admin' });
    expect(u.id).toBeTruthy();
    expect(u.passwordHash).toBeUndefined();
    expect(profileStore.findByUserId(u.id)).toBeTruthy();
  });

  it('TC-UNIT-005E: 重复邮箱抛 ConflictError', async () => {
    await svc.createUser({ email: 'a@b.com', password: 'password123', role: 'admin' });
    await expect(svc.createUser({ email: 'a@b.com', password: 'password123', role: 'reader' }))
      .rejects.toThrow(ConflictError);
  });

  it('TC-UNIT-005B: 密码 < 8 抛 ValidationError', async () => {
    await expect(svc.createUser({ email: 'a@b.com', password: 'short', role: 'admin' }))
      .rejects.toThrow(ValidationError);
  });

  it('findByIdOrFail 不存在抛 NotFoundError', () => {
    expect(() => svc.findByIdOrFail('missing')).toThrow(NotFoundError);
  });

  it('updatePasswordHashed 修改密码哈希', async () => {
    const u = await svc.createUser({ email: 'a@b.com', password: 'password123', role: 'admin' });
    await svc.updatePasswordHashed(u.id, 'newpassword456');
    expect(store.findById(u.id)?.passwordHash).not.toBe('newpassword456');
  });

  it('list 返回不含 passwordHash', async () => {
    await svc.createUser({ email: 'a@b.com', password: 'password123', role: 'admin' });
    const list = svc.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.passwordHash).toBeUndefined();
  });

  it('updateProfile 委托给 profileStore', async () => {
    const u = await svc.createUser({ email: 'a@b.com', password: 'password123', role: 'admin' });
    const p = svc.updateProfile(u.id, { nickname: 'A' });
    expect(p.nickname).toBe('A');
  });
});
