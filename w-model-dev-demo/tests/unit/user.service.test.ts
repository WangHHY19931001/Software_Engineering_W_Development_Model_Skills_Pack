import { describe, it, expect, beforeEach } from 'vitest';
import { UserService } from '../../src/services/user.service.js';
import { userStore } from '../../src/stores/user.store.js';
import { ConflictError, UnauthorizedError } from '../../src/utils/errors.js';
import { verifyToken } from '../../src/utils/jwt.js';

describe('UT-011 ~ UT-015: UserService', () => {
  beforeEach(() => {
    userStore.clear();
    process.env.JWT_SECRET = 'test-secret-blog-demo';
  });

  it('UT-011: register 新用户 → {userId, username}；userStore.size===1', async () => {
    const result = await UserService.register('alice', 'Pass1234');
    expect(result.username).toBe('alice');
    expect(result.userId).toBeTruthy();
    expect(userStore.size()).toBe(1);
  });

  it('UT-012: register 用户名已存在 → ConflictError(40901)', async () => {
    await UserService.register('alice', 'Pass1234');
    await expect(UserService.register('alice', 'Pass1234')).rejects.toThrow(ConflictError);
    try {
      await UserService.register('alice', 'Pass1234');
    } catch (e) {
      expect((e as ConflictError).code).toBe(40901);
    }
  });

  it('UT-013: login 凭证正确 → {token, userId, username}；token 可 verify', async () => {
    await UserService.register('alice', 'Pass1234');
    const result = await UserService.login('alice', 'Pass1234');
    expect(result.username).toBe('alice');
    expect(result.userId).toBeTruthy();
    expect(typeof result.token).toBe('string');
    const payload = verifyToken(result.token);
    expect(payload.userId).toBe(result.userId);
    expect(payload.username).toBe('alice');
  });

  it('UT-014: login 用户不存在 → UnauthorizedError(40101)', async () => {
    await expect(UserService.login('bob', 'Pass1234')).rejects.toThrow(UnauthorizedError);
    try {
      await UserService.login('bob', 'Pass1234');
    } catch (e) {
      expect((e as UnauthorizedError).code).toBe(40101);
    }
  });

  it('UT-015: login 密码错误 → UnauthorizedError(40101)', async () => {
    await UserService.register('alice', 'Pass1234');
    await expect(UserService.login('alice', 'Wrong')).rejects.toThrow(UnauthorizedError);
    try {
      await UserService.login('alice', 'Wrong');
    } catch (e) {
      expect((e as UnauthorizedError).code).toBe(40101);
    }
  });
});
