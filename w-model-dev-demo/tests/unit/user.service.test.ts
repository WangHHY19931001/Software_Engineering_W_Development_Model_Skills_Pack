import { describe, it, expect, beforeEach } from 'vitest';
import { UserStore } from '../../src/stores/user.store.js';
import { PasswordUtils } from '../../src/utils/password.js';
import { JwtUtils } from '../../src/utils/jwt.js';
import { UserService } from '../../src/services/user.service.js';
import { AuthError, ConflictError } from '../../src/utils/errors.js';
import jwt from 'jsonwebtoken';

/**
 * UT-001 ~ UT-006：UserService 单元测试。
 * 设计来源：docs/detailed-design.md §4.1
 */
describe('UserService', () => {
  let userStore: UserStore;
  let passwordUtils: PasswordUtils;
  let jwtUtils: JwtUtils;
  let userService: UserService;

  beforeEach(() => {
    userStore = new UserStore();
    passwordUtils = new PasswordUtils();
    jwtUtils = new JwtUtils(process.env.JWT_SECRET ?? 'test-secret-blog-demo', 3600);
    userService = new UserService(userStore, passwordUtils, jwtUtils);
  });

  // UT-001: 成功注册新用户
  it('UT-001: 注册新用户返回 {userId, username}，不含 password 字段', () => {
    const result = userService.register('alice', 'Passw0rd!');

    expect(result.userId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.username).toBe('alice');
    expect((result as { password?: string }).password).toBeUndefined();
  });

  // UT-002: 重复用户名 → 40901
  it('UT-002: 重复用户名抛 ConflictError(40901)', () => {
    userService.register('alice', 'Passw0rd!');

    try {
      userService.register('alice', 'Passw0rd!');
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
      expect((err as ConflictError).code).toBe(40901);
    }
  });

  // UT-003: 密码哈希存储（无明文）
  it('UT-003: 存储中 passwordHash 以 $2b$10$ 开头，无明文 password 字段', () => {
    const { userId } = userService.register('alice', 'Passw0rd!');
    const user = userStore.findById(userId);

    expect(user).toBeDefined();
    expect(user!.passwordHash).toMatch(/^\$2b\$10\$/);
    expect(user!.passwordHash).not.toBe('Passw0rd!');
    expect((user as unknown as { password?: string }).password).toBeUndefined();
  });

  // UT-004: 成功登录返回 JWT
  it('UT-004: 登录返回三段式 JWT，expiresIn=3600，payload 含 userId', () => {
    const { userId } = userService.register('alice', 'Passw0rd!');
    const result = userService.login('alice', 'Passw0rd!');

    expect(result.token.split('.')).toHaveLength(3);
    expect(result.expiresIn).toBe(3600);

    const decoded = jwt.decode(result.token) as { userId: string; username: string };
    expect(decoded.userId).toBe(userId);
  });

  // UT-005: 错误密码 → 40101
  it('UT-005: 错误密码抛 AuthError(40101)', () => {
    userService.register('alice', 'Passw0rd!');

    try {
      userService.login('alice', 'WrongPass');
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).code).toBe(40101);
    }
  });

  // UT-006: 用户名不存在 → 40101（不泄露）
  it('UT-006: 用户名不存在抛 AuthError(40101)，与错误密码相同错误码', () => {
    try {
      userService.login('ghost', 'any');
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).code).toBe(40101);
    }
  });
});
