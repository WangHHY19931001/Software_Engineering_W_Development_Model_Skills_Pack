/**
 * UT-003 修改密码原密码错误（profileService.changePassword，DD-003/INTF-004）
 */
import { describe, it, expect, beforeAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { UserStore } from '../../../src/stores/userStore';
import { ProfileService } from '../../../src/services/identity/profileService';

describe('UT-003 profileService.changePassword', () => {
  let userStore: UserStore;
  let profileService: ProfileService;
  let originalHash: string;

  beforeAll(async () => {
    userStore = new UserStore();
    originalHash = await bcrypt.hash('OldPassw0rd!', 10);
    userStore.create({ id: 'u_0001', username: 'reader1', email: 'r1@example.com', passwordHash: originalHash, role: 'reader', createdAt: new Date().toISOString() });
    profileService = new ProfileService(userStore);
  });

  it('oldPassword 不匹配返回业务错误 60002（httpStatus 400），密码哈希未被修改', async () => {
    expect.assertions(3);
    try {
      await profileService.changePassword('u_0001', 'WrongPass0!', 'NewPassw0rd!');
    } catch (err: any) {
      expect(err.code).toBe(60002);
      expect(err.httpStatus).toBe(400);
    }
    const after = userStore.findById('u_0001')!;
    expect(await bcrypt.compare('OldPassw0rd!', after.passwordHash)).toBe(true);
  });

  it('原密码正确时更新密码哈希', async () => {
    await profileService.changePassword('u_0001', 'OldPassw0rd!', 'NewPassw0rd!');
    const after = userStore.findById('u_0001')!;
    expect(await bcrypt.compare('NewPassw0rd!', after.passwordHash)).toBe(true);
  });
});

describe('profileService getProfile / updateProfile', () => {
  it('getProfile：返回本人资料（不含 passwordHash）；不存在 40401', async () => {
    const store = new UserStore();
    store.create({ id: 'u_0001', username: 'reader1', email: 'r1@example.com', passwordHash: 'h', nickname: '昵称', role: 'reader', createdAt: new Date().toISOString() });
    const service = new ProfileService(store);
    const profile = await service.getProfile('u_0001');
    expect(profile.userId).toBe('u_0001');
    expect(profile.nickname).toBe('昵称');
    expect((profile as any).passwordHash).toBeUndefined();
    expect((await service.getProfile('u_9999').catch((e) => e)).code).toBe(40401);
  });

  it('updateProfile：未传字段保持不变；空 patch → 40001；字段越界 → 40002；url 非法 → 40001', async () => {
    const store = new UserStore();
    store.create({ id: 'u_0001', username: 'reader1', email: 'r1@example.com', passwordHash: 'h', role: 'reader', createdAt: new Date().toISOString() });
    const service = new ProfileService(store);

    const updated = await service.updateProfile('u_0001', { nickname: '博主小张', avatarUrl: 'https://cdn.example.com/a.png' });
    expect(updated.nickname).toBe('博主小张');
    expect(updated.avatarUrl).toBe('https://cdn.example.com/a.png');

    const kept = await service.getProfile('u_0001');
    expect(kept.bio).toBeNull(); // 未传字段保留

    expect((await service.updateProfile('u_0001', {}).catch((e) => e)).code).toBe(40001);
    expect((await service.updateProfile('u_0001', { nickname: 'x'.repeat(33) }).catch((e) => e)).code).toBe(40002);
    expect((await service.updateProfile('u_0001', { bio: 'x'.repeat(201) }).catch((e) => e)).code).toBe(40002);
    expect((await service.updateProfile('u_0001', { avatarUrl: 'ftp://x/y.png' }).catch((e) => e)).code).toBe(40001);
    expect((await service.updateProfile('u_9999', { nickname: 'x' }).catch((e) => e)).code).toBe(40401);
  });

  it('changePassword：old === new → 40002；用户不存在 → 40401', async () => {
    const store = new UserStore();
    store.create({ id: 'u_0001', username: 'reader1', email: 'r1@example.com', passwordHash: await bcrypt.hash('OldPassw0rd!', 4), role: 'reader', createdAt: new Date().toISOString() });
    const service = new ProfileService(store);
    expect((await service.changePassword('u_0001', 'SamePass0!', 'SamePass0!').catch((e) => e)).code).toBe(40002);
    expect((await service.changePassword('u_9999', 'OldPassw0!', 'NewPassw0rd!').catch((e) => e)).code).toBe(40401);
  });
});
