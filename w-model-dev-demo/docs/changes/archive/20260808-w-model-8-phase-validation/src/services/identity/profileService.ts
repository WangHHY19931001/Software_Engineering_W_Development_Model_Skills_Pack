/**
 * profileService（DD-003 / SD-001）：资料查看/更新、修改密码（原密码校验 60002）。
 */
import { BizError } from '../../utils/errors';
import { bcryptHasher, type PasswordHasher } from '../../utils/hash';
import type { UserStore } from '../../stores/userStore';
import { toPublicUser } from './authService';
import type { PublicUser } from '../../types';

export interface ProfilePatch {
  nickname?: string;
  bio?: string;
  avatarUrl?: string;
}

export class ProfileService {
  constructor(
    private readonly userStore: UserStore,
    private readonly hasher: PasswordHasher = bcryptHasher,
  ) {}

  /** 返回本人资料（不含 passwordHash） */
  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.requireUser(userId);
    return toPublicUser(user);
  }

  /** 更新资料：校验字段（nickname 1~32 / bio ≤200 / avatarUrl http(s)）；未传字段保留 */
  async updateProfile(userId: string, patch: ProfilePatch): Promise<PublicUser> {
    await this.requireUser(userId);
    const clean = this.validatePatch(patch);
    if (Object.keys(clean).length === 0) {
      throw new BizError(40001, '至少提供一项资料字段');
    }
    const updated = await this.userStore.update(userId, clean);
    return toPublicUser(updated);
  }

  /** 修改密码：原密码匹配（60002）→ 新密码重新 bcrypt 存储 */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.requireUser(userId);
    if (oldPassword === newPassword) {
      throw new BizError(40002, '新旧密码不能相同');
    }
    const ok = await this.hasher.compare(oldPassword, user.passwordHash);
    if (!ok) {
      throw new BizError(60002);
    }
    const passwordHash = await this.hasher.hash(newPassword);
    await this.userStore.update(userId, { passwordHash });
  }

  private validatePatch(patch: ProfilePatch): ProfilePatch {
    const clean: ProfilePatch = {};
    if (patch.nickname !== undefined) {
      if (typeof patch.nickname !== 'string') throw new BizError(40001, 'nickname 类型错误');
      if (patch.nickname.length < 1 || patch.nickname.length > 32) throw new BizError(40002, 'nickname 长度越界');
      clean.nickname = patch.nickname;
    }
    if (patch.bio !== undefined) {
      if (typeof patch.bio !== 'string') throw new BizError(40001, 'bio 类型错误');
      if (patch.bio.length > 200) throw new BizError(40002, 'bio 长度越界');
      clean.bio = patch.bio;
    }
    if (patch.avatarUrl !== undefined) {
      if (typeof patch.avatarUrl !== 'string' || !/^https?:\/\/.+/.test(patch.avatarUrl)) {
        throw new BizError(40001, 'avatarUrl 须为 http(s) URL');
      }
      clean.avatarUrl = patch.avatarUrl;
    }
    return clean;
  }

  private async requireUser(userId: string) {
    const user = await this.userStore.findById(userId);
    if (!user) throw new BizError(40401, '用户不存在');
    return user;
  }
}
