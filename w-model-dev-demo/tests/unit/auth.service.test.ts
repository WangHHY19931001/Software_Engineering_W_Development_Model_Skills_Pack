// SD-003 UserStore + AuthService + UserService unit tests (TC-UNIT-011 ~ TC-UNIT-015).

import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { UserStore } from '../../src/stores/user.store.js';
import { AuthService, UserService } from '../../src/services/auth.service.js';
import { UserRole } from '../../src/types.js';
import { AppError } from '../../src/utils/errors.js';
import { clearRevokedJtis } from '../../src/utils/auth.js';

describe('SD-003 UserStore + AuthService + UserService (TC-UNIT-011 ~ 015)', () => {
  let userStore: UserStore;
  let authService: AuthService;
  let userService: UserService;

  beforeEach(() => {
    userStore = new UserStore();
    authService = new AuthService(userStore);
    userService = new UserService(userStore, authService);
    clearRevokedJtis();
  });

  it('TC-UNIT-011: user register email uniqueness throws 1005', async () => {
    await authService.userRegister({
      email: 'a@b.com',
      password: 'passwordpassword',
      displayName: 'a',
    });
    expect(userStore.hasEmail('a@b.com')).toBe(true);
    expect(async () =>
      authService.userRegister({
        email: 'a@b.com',
        password: 'passwordpassword',
        displayName: 'b',
      }),
    ).rejects.toThrow(AppError);
    try {
      await authService.userRegister({
        email: 'a@b.com',
        password: 'passwordpassword',
        displayName: 'b',
      });
    } catch (err) {
      expect((err as AppError).code).toBe(1005);
    }
  });

  it('TC-UNIT-012: login with wrong password throws 1012', async () => {
    await authService.userRegister({
      email: 'login@x.com',
      password: 'correct-password',
      displayName: 'login-user',
    });
    expect(async () => authService.userLogin('login@x.com', 'wrong')).rejects.toThrow(AppError);
    try {
      await authService.userLogin('login@x.com', 'wrong');
    } catch (err) {
      expect((err as AppError).code).toBe(1012);
    }
  });

  it('TC-UNIT-013: verifyToken with expired token throws 1013', () => {
    // Register a user so the user exists (verifyToken checks user existence after jwt.verify).
    const user = userStore.create({
      email: 'expire@x.com',
      password: 'passwordpassword',
      displayName: 'expire-user',
    });
    // Sign a token that is already expired (exp 10 seconds in the past).
    // jwt.verify will throw a TokenExpiredError whose message includes "expired".
    const secret = process.env.JWT_SECRET as string;
    const expiredToken = jwt.sign(
      {
        userId: user.id,
        role: UserRole.Reader,
        jti: 'jti-expired-test',
        exp: Math.floor(Date.now() / 1000) - 10,
      },
      secret,
    );

    expect(() => authService.verifyToken(expiredToken)).toThrow(AppError);
    try {
      authService.verifyToken(expiredToken);
    } catch (err) {
      expect((err as AppError).code).toBe(1013);
    }
  });

  it('TC-UNIT-014: banned user token immediately invalidated (1022)', async () => {
    const admin = await authService.userRegister({
      email: 'admin@x.com',
      password: 'passwordpassword',
      displayName: 'admin',
      role: UserRole.Admin,
    });
    const target = await authService.userRegister({
      email: 'target@x.com',
      password: 'passwordpassword',
      displayName: 'target',
      role: UserRole.Reader,
    });
    const { token } = await authService.userLogin('target@x.com', 'passwordpassword');
    // Token works before ban.
    const ctx = authService.verifyToken(token);
    expect(ctx.userId).toBe(target.id);
    // Admin bans target → revokes all JTIs.
    userService.ban(admin.id, 'admin', target.id, 'violation');
    expect(authService.revokedCount()).toBeGreaterThan(0);
    // Token now rejected.
    expect(() => authService.verifyToken(token)).toThrow(AppError);
    try {
      authService.verifyToken(token);
    } catch (err) {
      expect((err as AppError).code).toBe(1022);
    }
  });

  it('TC-UNIT-015: cannot ban admin throws 1021', async () => {
    const admin1 = await authService.userRegister({
      email: 'admin1@x.com',
      password: 'passwordpassword',
      displayName: 'admin1',
      role: UserRole.Admin,
    });
    const admin2 = await authService.userRegister({
      email: 'admin2@x.com',
      password: 'passwordpassword',
      displayName: 'admin2',
      role: UserRole.Admin,
    });
    expect(() => userService.ban(admin1.id, 'admin', admin2.id, 'reason')).toThrow(AppError);
    try {
      userService.ban(admin1.id, 'admin', admin2.id, 'reason');
    } catch (err) {
      expect((err as AppError).code).toBe(1021);
    }
  });
});
