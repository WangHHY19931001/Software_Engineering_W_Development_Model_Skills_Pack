/**
 * AuthService 单元测试（UT-012~020）。
 * 真实 UserStore + PasswordHasher + JwtService；每个测试前 clear()。
 * JWT_SECRET 由测试脚本注入。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { UserStore } from '../../../src/stores/user.store';
import { PasswordHasher } from '../../../src/utils/password';
import { JwtService } from '../../../src/utils/jwt';
import { AuthService } from '../../../src/services/user.service';
import {
  ConflictError,
  UnauthorizedError,
  ErrorCode,
} from '../../../src/utils/errors';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('AuthService', () => {
  let userStore: UserStore;
  let authService: AuthService;

  beforeEach(() => {
    userStore = new UserStore();
    const passwordHasher = new PasswordHasher();
    const jwtService = new JwtService();
    authService = new AuthService(userStore, passwordHasher, jwtService);
  });

  it('UT-012 register 正常注册返回 userId', async () => {
    const result = await authService.register({ username: 'alice', password: 'Passw0rd!' });
    expect(result.userId).toMatch(UUID_RE);
    expect(result.username).toBe('alice');
  });

  it('UT-013 register 用户名已存在抛 40901', async () => {
    await authService.register({ username: 'alice', password: 'Passw0rd!' });
    await expect(
      authService.register({ username: 'alice', password: 'Passw0rd!' }),
    ).rejects.toThrow(ConflictError);
    try {
      await authService.register({ username: 'alice', password: 'Passw0rd!' });
    } catch (err) {
      expect((err as ConflictError).code).toBe(ErrorCode.CONFLICT);
    }
  });

  it('UT-014 register 密码哈希存储无明文 + cost=10', async () => {
    await authService.register({ username: 'alice', password: 'Passw0rd!' });
    const user = userStore.findByUsername('alice')!;
    expect(user.passwordHash).toMatch(/^\$2b\$10\$/);
    expect(user.passwordHash).not.toContain('Passw0rd');
    expect('password' in user).toBe(false);
  });

  it('UT-015 login 正常返回 token', async () => {
    await authService.register({ username: 'alice', password: 'Passw0rd!' });
    const result = await authService.login({ username: 'alice', password: 'Passw0rd!' });
    expect(result.token.split('.').length).toBe(3);
    expect(result.expiresIn).toBe(3600);
  });

  it('UT-016 login 用户不存在抛 40101', async () => {
    await expect(
      authService.login({ username: 'ghost', password: 'Passw0rd!' }),
    ).rejects.toThrow(UnauthorizedError);
    try {
      await authService.login({ username: 'ghost', password: 'Passw0rd!' });
    } catch (err) {
      expect((err as UnauthorizedError).code).toBe(ErrorCode.UNAUTHORIZED_CREDENTIALS);
    }
  });

  it('UT-017 login 密码错误抛 40101', async () => {
    await authService.register({ username: 'alice', password: 'Passw0rd!' });
    await expect(
      authService.login({ username: 'alice', password: 'WrongPass1' }),
    ).rejects.toThrow(UnauthorizedError);
    try {
      await authService.login({ username: 'alice', password: 'WrongPass1' });
    } catch (err) {
      expect((err as UnauthorizedError).code).toBe(ErrorCode.UNAUTHORIZED_CREDENTIALS);
    }
  });

  it('UT-018 login 错误码文案一致不泄露存在性', async () => {
    await authService.register({ username: 'alice', password: 'Passw0rd!' });
    let msgNotExists = '';
    let msgWrongPwd = '';
    try {
      await authService.login({ username: 'ghost', password: 'Passw0rd!' });
    } catch (err) {
      msgNotExists = (err as UnauthorizedError).message;
    }
    try {
      await authService.login({ username: 'alice', password: 'WrongPass1' });
    } catch (err) {
      msgWrongPwd = (err as UnauthorizedError).message;
    }
    expect(msgNotExists).toBe(msgWrongPwd);
  });

  it('UT-019 verifyToken 合法 token 返回 payload', async () => {
    const reg = await authService.register({ username: 'alice', password: 'Passw0rd!' });
    const loginResult = await authService.login({ username: 'alice', password: 'Passw0rd!' });
    const payload = await authService.verifyToken(loginResult.token);
    expect(payload.userId).toBe(reg.userId);
    expect(payload.username).toBe('alice');
  });

  it('UT-020 verifyToken 过期/伪造抛 40102', async () => {
    await expect(authService.verifyToken('fake.token.here')).rejects.toThrow(UnauthorizedError);
    try {
      await authService.verifyToken('fake.token.here');
    } catch (err) {
      expect((err as UnauthorizedError).code).toBe(ErrorCode.UNAUTHORIZED_TOKEN);
    }
  });
});
