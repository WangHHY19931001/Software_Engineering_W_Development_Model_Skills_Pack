import { describe, it, expect, beforeEach } from 'vitest';
import { PasswordResetService } from '../../../src/services/password-reset.service.js';
import { UserStore } from '../../../src/stores/user.store.js';
import { PasswordResetStore } from '../../../src/stores/password-reset.store.js';
import { Logger } from '../../../src/utils/logger.js';
import { NotFoundError, ValidationError } from '../../../src/utils/errors.js';

describe('PasswordResetService (DD-016-002 / L3_password_reset_flow / L4_password_reset_token_lifecycle)', () => {
  let userStore: UserStore;
  let tokenStore: PasswordResetStore;
  let svc: PasswordResetService;
  beforeEach(() => {
    userStore = new UserStore();
    tokenStore = new PasswordResetStore();
    svc = new PasswordResetService(userStore, tokenStore, new Logger('debug'));
    userStore.insert({ email: 'a@b.com', passwordHash: 'old', role: 'admin' });
  });

  it('TC-UNIT-048N: requestReset 生成 token + expiresAt', () => {
    const r = svc.requestReset('a@b.com');
    expect(r.token).toBeTruthy();
    expect(r.expiresAt).toBeTruthy();
    expect(tokenStore.findByToken(r.token)?.userId).toBe(userStore.findByEmail('a@b.com')?.id);
  });

  it('TC-UNIT-048E: requestReset 不存在邮箱抛 NotFoundError', () => {
    expect(() => svc.requestReset('missing@x.com')).toThrow(NotFoundError);
  });

  it('TC-UNIT-048B: resetPasswordHashed 成功后令牌标记已用（OneTimeUse）', async () => {
    const r = svc.requestReset('a@b.com');
    await svc.resetPasswordHashed(r.token, 'newpassword123');
    expect(tokenStore.findByToken(r.token)?.used).toBe(true);
  });

  it('resetPassword: 新密码 < 8 抛 ValidationError', () => {
    expect(() => svc.resetPassword('t', 'short')).toThrow(ValidationError);
  });

  it('resetPassword: 令牌不存在抛 NotFoundError', () => {
    expect(() => svc.resetPassword('missing', 'password123')).toThrow(NotFoundError);
  });

  it('cleanupExpired 委托 store', () => {
    expect(svc.cleanupExpired()).toBe(0);
  });
});
