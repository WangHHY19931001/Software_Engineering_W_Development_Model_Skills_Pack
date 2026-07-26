/**
 * PasswordResetStore（DD-016-003）— 密码重置令牌存储 + 一次性使用。
 * 与 L4_password_reset_token_lifecycle.tla 一致：OneTimeUse / TokenExpiry15min。
 */
import type { PasswordResetToken } from '../types.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { PasswordResetTokenUtil } from '../utils/article-helpers.js';

export class PasswordResetStore {
  private tokens: Map<string, PasswordResetToken> = new Map();
  private userIndex: Map<string, Set<string>> = new Map();

  insert(token: Omit<PasswordResetToken, 'createdAt' | 'used'> & { used?: boolean }): PasswordResetToken {
    const record: PasswordResetToken = {
      token: token.token,
      userId: token.userId,
      expiresAt: token.expiresAt,
      used: token.used ?? false,
      createdAt: new Date().toISOString(),
    };
    this.tokens.set(record.token, record);
    let set = this.userIndex.get(record.userId);
    if (!set) {
      set = new Set();
      this.userIndex.set(record.userId, set);
    }
    set.add(record.token);
    return record;
  }

  findByToken(token: string): PasswordResetToken | undefined {
    return this.tokens.get(token);
  }

  findByUser(userId: string): PasswordResetToken[] {
    const ids = this.userIndex.get(userId);
    if (!ids) return [];
    const result: PasswordResetToken[] = [];
    for (const t of ids) {
      const token = this.tokens.get(t);
      if (token) result.push(token);
    }
    return result;
  }

  markUsed(token: string): PasswordResetToken {
    const record = this.tokens.get(token);
    if (!record) throw new NotFoundError('密码重置令牌');
    PasswordResetTokenUtil.assertUsable(record);
    record.used = true;
    return record;
  }

  delete(token: string): boolean {
    const record = this.tokens.get(token);
    if (!record) return false;
    const set = this.userIndex.get(record.userId);
    if (set) {
      set.delete(token);
      if (set.size === 0) this.userIndex.delete(record.userId);
    }
    return this.tokens.delete(token);
  }

  cleanupExpired(now: Date = new Date()): number {
    const expired: string[] = [];
    for (const [token, record] of this.tokens) {
      if (PasswordResetTokenUtil.isExpired(record.expiresAt, now)) {
        expired.push(token);
      }
    }
    for (const token of expired) {
      this.delete(token);
    }
    return expired.length;
  }

  assertOneTimeUse(token: string): void {
    const record = this.tokens.get(token);
    if (!record) throw new NotFoundError('密码重置令牌');
    if (record.used) {
      throw new ValidationError('密码重置令牌已使用（OneTimeUse 不变式）');
    }
  }

  size(): number {
    return this.tokens.size;
  }

  clear(): void {
    this.tokens.clear();
    this.userIndex.clear();
  }
}
