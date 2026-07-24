/**
 * DD-006 FollowService —— 关注服务
 *
 * 博主关注关系管理。followers/following 双向 Map。
 * 依赖：DD-003 UserService、DD-024 WalWriter、DD-015 NotificationService。
 *
 * TLA+ 一致性：follow/unfollow 对应 L2_identity_access.tla Follow/Unfollow。
 */
import type { Page } from '../../types.js';
import { AppError } from '../../utils/errors.js';
import type { WalWriter } from '../../infrastructure/wal.js';
import { userStore } from '../../stores/user-store.js';

export interface FollowResult {
  followerId: string;
  bloggerId: string;
  followedAt: number;
}

export interface FollowServiceDeps {
  walWriter: WalWriter;
  /** 关注后触发通知（避免循环依赖 NotificationService） */
  notifyFollow: (followerId: string, bloggerId: string) => Promise<void>;
}

export class FollowService {
  private followers: Map<string, Set<string>> = new Map(); // bloggerId -> 粉丝集合
  private following: Map<string, Set<string>> = new Map(); // userId -> 关注集合
  private deps: FollowServiceDeps;

  constructor(deps: FollowServiceDeps) {
    this.deps = deps;
  }

  /** 关注博主（对应 DD-006 follow + TLA+ Follow） */
  async follow(followerId: string, bloggerId: string): Promise<FollowResult> {
    if (followerId === bloggerId) {
      throw new AppError(60002, '不能关注自己', { followerId, bloggerId });
    }
    const blogger = userStore.findById(bloggerId);
    if (!blogger || blogger.role !== 'blogger') {
      throw new AppError(40401, `博主不存在: ${bloggerId}`, { bloggerId });
    }
    const follower = userStore.findById(followerId);
    if (!follower) {
      throw new AppError(40401, `用户不存在: ${followerId}`, { followerId });
    }
    let set = this.following.get(followerId);
    if (set && set.has(bloggerId)) {
      throw new AppError(40901, '已关注该博主', { followerId, bloggerId });
    }
    if (!set) {
      set = new Set();
      this.following.set(followerId, set);
    }
    set.add(bloggerId);
    let fset = this.followers.get(bloggerId);
    if (!fset) {
      fset = new Set();
      this.followers.set(bloggerId, fset);
    }
    fset.add(followerId);
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'follow.create',
      payload: { followerId, bloggerId, followedAt: now },
      timestamp: now,
    });
    await this.deps.notifyFollow(followerId, bloggerId);
    return { followerId, bloggerId, followedAt: now };
  }

  /** 取关（对应 DD-006 unfollow + TLA+ Unfollow） */
  unfollow(followerId: string, bloggerId: string): void {
    const set = this.following.get(followerId);
    if (!set || !set.has(bloggerId)) {
      throw new AppError(40401, '未关注该博主', { followerId, bloggerId });
    }
    set.delete(bloggerId);
    if (set.size === 0) this.following.delete(followerId);
    const fset = this.followers.get(bloggerId);
    if (fset) {
      fset.delete(followerId);
      if (fset.size === 0) this.followers.delete(bloggerId);
    }
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'follow.remove',
      payload: { followerId, bloggerId },
      timestamp: now,
    });
  }

  /** 粉丝列表分页（对应 DD-006 getFollowers） */
  getFollowers(bloggerId: string, page: number, size: number): Page<string> {
    if (page < 1) throw new AppError(40003, 'page 必须 ≥ 1');
    if (size < 1 || size > 100) throw new AppError(40003, 'size 必须 ∈ [1,100]');
    const set = this.followers.get(bloggerId) ?? new Set<string>();
    const all = Array.from(set);
    const total = all.length;
    const start = (page - 1) * size;
    const list = all.slice(start, start + size);
    return { list, total, page, pageSize: size };
  }

  /** 关注列表分页（对应 DD-006 getFollowing） */
  getFollowing(userId: string, page: number, size: number): Page<string> {
    if (page < 1) throw new AppError(40003, 'page 必须 ≥ 1');
    if (size < 1 || size > 100) throw new AppError(40003, 'size 必须 ∈ [1,100]');
    const set = this.following.get(userId) ?? new Set<string>();
    const all = Array.from(set);
    const total = all.length;
    const start = (page - 1) * size;
    const list = all.slice(start, start + size);
    return { list, total, page, pageSize: size };
  }

  /** 是否关注（对应 DD-006 isFollowing） */
  isFollowing(followerId: string, bloggerId: string): boolean {
    return this.following.get(followerId)?.has(bloggerId) ?? false;
  }

  /** 粉丝数（供推荐使用） */
  getFollowerCount(bloggerId: string): number {
    return this.followers.get(bloggerId)?.size ?? 0;
  }

  /** 清空（供测试重置） */
  clear(): void {
    this.followers.clear();
    this.following.clear();
  }
}
