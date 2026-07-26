import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService, LoginRateLimiter } from '../../../src/services/auth.service.js';
import { UserStore } from '../../../src/stores/user.store.js';
import { JwtUtil } from '../../../src/utils/auth.js';
import { PasswordHasher } from '../../../src/utils/auth.js';
import { AuthenticationError, ValidationError } from '../../../src/utils/errors.js';

const SECRET = 'test-secret-blog-demo-32chars-min!!';

describe('AuthService (DD-003-002 / L3_login_flow)', () => {
  let store: UserStore;
  let jwt: JwtUtil;
  let svc: AuthService;
  beforeEach(async () => {
    store = new UserStore();
    jwt = new JwtUtil(SECRET);
    svc = new AuthService(store, jwt, new LoginRateLimiter(5, 60000));
    const hash = await PasswordHasher.hash('password123');
    store.insert({ email: 'a@b.com', passwordHash: hash, role: 'admin' });
  });

  it('TC-UNIT-008N: 正确凭据签发 JWT', async () => {
    const r = await svc.login('a@b.com', 'password123');
    expect(r.token).toBeTruthy();
    expect(r.user.email).toBe('a@b.com');
    expect(r.user.passwordHash).toBeUndefined();
  });

  it('TC-UNIT-008E: 错误密码抛 AuthenticationError', async () => {
    await expect(svc.login('a@b.com', 'wrong')).rejects.toThrow(AuthenticationError);
  });

  it('TC-UNIT-008B: 空 email/password 抛 ValidationError', async () => {
    await expect(svc.login('', 'x')).rejects.toThrow(ValidationError);
    await expect(svc.login('a@b.com', '')).rejects.toThrow(ValidationError);
  });

  it('verifyToken 解码 JWT', async () => {
    const { token } = await svc.login('a@b.com', 'password123');
    const u = svc.verifyToken(token);
    expect(u.email).toBe('a@b.com');
  });

  it('失败 5 次后锁定（rateLimiter）', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(svc.login('a@b.com', 'wrong')).rejects.toThrow(AuthenticationError);
    }
    await expect(svc.login('a@b.com', 'password123')).rejects.toThrow(AuthenticationError);
  });
});

describe('LoginRateLimiter', () => {
  it('recordFailure + isLocked', () => {
    const r = new LoginRateLimiter(3, 1000);
    r.recordFailure('k', 1000);
    r.recordFailure('k', 1000);
    expect(r.isLocked('k', 1000)).toBe(false);
    r.recordFailure('k', 1000);
    expect(r.isLocked('k', 1000)).toBe(true);
  });

  it('remainingAttempts 递减', () => {
    const r = new LoginRateLimiter(3, 1000);
    expect(r.remainingAttempts('k')).toBe(3);
    r.recordFailure('k');
    expect(r.remainingAttempts('k')).toBe(2);
  });

  it('recordSuccess 清空失败计数', () => {
    const r = new LoginRateLimiter(3, 1000);
    r.recordFailure('k');
    r.recordSuccess('k');
    expect(r.remainingAttempts('k')).toBe(3);
  });

  it('锁定过期后自动解锁', () => {
    const r = new LoginRateLimiter(1, 100);
    r.recordFailure('k', 1000);
    expect(r.isLocked('k', 1000)).toBe(true);
    expect(r.isLocked('k', 2000)).toBe(false);
  });
});
