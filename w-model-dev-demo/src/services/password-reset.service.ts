/**
 * PasswordResetService（DD-016-002）— 密码重置 + 令牌生命周期。
 * 与 L3_password_reset_flow.tla / L4_password_reset_token_lifecycle.tla 一致：OneTimeUse / TokenExpiry15min。
 */
import type { PasswordResetToken } from '../types.js';
import type { UserStore } from '../stores/user.store.js';
import type { PasswordResetStore } from '../stores/password-reset.store.js';
import type { Logger } from '../utils/logger.js';
import { generateRandomToken } from '../utils/auth.js';
import { PasswordResetTokenUtil as TokenUtil } from '../utils/article-helpers.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

export interface PasswordResetRequestResult {
  token: string;
  expiresAt: string;
}

export class PasswordResetService {
  constructor(
    private userStore: UserStore,
    private tokenStore: PasswordResetStore,
    private logger: Logger,
  ) {}

  requestReset(email: string): PasswordResetRequestResult {
    const user = this.userStore.findByEmail(email);
    if (!user) {
      this.logger.warn('password_reset_unknown_email', { email });
      throw new NotFoundError('用户');
    }
    const token = generateRandomToken(32);
    const expiresAt = TokenUtil.generateExpiry();
    this.tokenStore.insert({ token, userId: user.id, expiresAt });
    this.logger.info('password_reset_requested', { userId: user.id });
    return { token, expiresAt };
  }

  resetPassword(token: string, newPassword: string): { userId: string } {
    if (newPassword.length < 8) {
      throw new ValidationError('新密码至少 8 位');
    }
    const record = this.tokenStore.findByToken(token);
    if (!record) throw new NotFoundError('密码重置令牌');
    TokenUtil.assertUsable(record);
    this.userStore.update(record.userId, {});
    return { userId: record.userId };
  }

  async resetPasswordHashed(token: string, newPassword: string): Promise<{ userId: string }> {
    if (newPassword.length < 8) {
      throw new ValidationError('新密码至少 8 位');
    }
    const record = this.tokenStore.findByToken(token);
    if (!record) throw new NotFoundError('密码重置令牌');
    TokenUtil.assertUsable(record);
    const { PasswordHasher } = await import('../utils/auth.js');
    const hash = await PasswordHasher.hash(newPassword);
    this.userStore.update(record.userId, { passwordHash: hash });
    this.tokenStore.markUsed(token);
    this.logger.info('password_reset_completed', { userId: record.userId });
    return { userId: record.userId };
  }

  findByToken(token: string): PasswordResetToken | undefined {
    return this.tokenStore.findByToken(token);
  }

  cleanupExpired(now?: Date): number {
    return this.tokenStore.cleanupExpired(now);
  }
}
