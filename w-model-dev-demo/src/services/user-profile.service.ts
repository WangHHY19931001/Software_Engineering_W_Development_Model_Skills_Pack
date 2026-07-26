/**
 * UserProfileService（DD-021-002）。
 */
import type { UserProfile } from '../types.js';
import type { UserProfileStore } from '../stores/user-profile.store.js';
import type { UserStore } from '../stores/user.store.js';
import { NotFoundError } from '../utils/errors.js';

export class UserProfileService {
  constructor(
    private profileStore: UserProfileStore,
    private userStore: UserStore,
  ) {}

  getProfile(userId: string): UserProfile {
    if (!this.userStore.findById(userId)) throw new NotFoundError('用户');
    return this.profileStore.findByUserIdOrFail(userId);
  }

  updateProfile(userId: string, patch: Partial<Omit<UserProfile, 'userId'>>): UserProfile {
    if (!this.userStore.findById(userId)) throw new NotFoundError('用户');
    return this.profileStore.upsert(userId, patch);
  }
}
