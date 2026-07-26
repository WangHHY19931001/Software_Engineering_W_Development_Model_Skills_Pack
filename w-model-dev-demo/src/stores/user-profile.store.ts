/**
 * UserProfileStore（DD-021-002）— 用户资料存储。
 */
import type { UserProfile } from '../types.js';
import { NotFoundError } from '../utils/errors.js';

export class UserProfileStore {
  private profiles: Map<string, UserProfile> = new Map();

  upsert(userId: string, patch: Partial<Omit<UserProfile, 'userId'>>): UserProfile {
    const existing = this.profiles.get(userId);
    const now = new Date().toISOString();
    if (existing) {
      const updated: UserProfile = {
        ...existing,
        ...patch,
        userId,
        updatedAt: now,
      };
      this.profiles.set(userId, updated);
      return updated;
    }
    const record: UserProfile = {
      userId,
      nickname: patch.nickname ?? '',
      avatar: patch.avatar ?? '',
      bio: patch.bio ?? '',
      updatedAt: now,
    };
    this.profiles.set(userId, record);
    return record;
  }

  findByUserId(userId: string): UserProfile | undefined {
    return this.profiles.get(userId);
  }

  findByUserIdOrFail(userId: string): UserProfile {
    const profile = this.profiles.get(userId);
    if (!profile) throw new NotFoundError('用户资料');
    return profile;
  }

  delete(userId: string): boolean {
    return this.profiles.delete(userId);
  }

  size(): number {
    return this.profiles.size;
  }

  clear(): void {
    this.profiles.clear();
  }
}
