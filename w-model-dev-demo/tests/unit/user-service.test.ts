import { describe, it, expect, beforeEach } from 'vitest';
import { userService } from '../../src/services/user-service.js';
import { userStore } from '../../src/stores/user-store.js';
import { ConflictError, UnauthorizedError } from '../../src/utils/errors.js';

describe('UserService', () => {
  beforeEach(() => {
    userStore.clear();
  });

  it('UT-001: 注册成功，密码已哈希', async () => {
    const result = await userService.register({ username: 'alice', password: 'Passw0rd!' });
    expect(result.userId).toBeTypeOf('string');
    expect(result.userId.length).toBeGreaterThan(0);
    const user = userStore.findByUsername('alice');
    expect(user).toBeDefined();
    expect(user!.passwordHash).not.toBe('Passw0rd!');
    expect(user!.passwordHash).not.toContain('Passw0rd');
  });

  it('UT-002: 重复用户名抛 ConflictError', async () => {
    await userService.register({ username: 'alice', password: 'Passw0rd!' });
    await expect(
      userService.register({ username: 'alice', password: 'AnotherPass!' }),
    ).rejects.toThrow(ConflictError);
  });

  it('UT-003: 正确密码返回 JWT', async () => {
    await userService.register({ username: 'alice', password: 'Passw0rd!' });
    const result = await userService.login({ username: 'alice', password: 'Passw0rd!' });
    expect(result.token).toBeTypeOf('string');
    const parts = result.token.split('.');
    expect(parts.length).toBe(3);
  });

  it('UT-004: 错误密码抛 UnauthorizedError', async () => {
    await userService.register({ username: 'alice', password: 'Passw0rd!' });
    await expect(
      userService.login({ username: 'alice', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('UT-005: 用户不存在抛 UnauthorizedError', async () => {
    await expect(
      userService.login({ username: 'nobody', password: 'whatever' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('UT-006: 合法 token 返回 payload', async () => {
    await userService.register({ username: 'alice', password: 'Passw0rd!' });
    const { token } = await userService.login({ username: 'alice', password: 'Passw0rd!' });
    const payload = userService.verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBeTypeOf('string');
  });

  it('UT-007: 非法 token 返回 null', () => {
    const payload = userService.verifyToken('garbage.token.here');
    expect(payload).toBeNull();
  });
});
