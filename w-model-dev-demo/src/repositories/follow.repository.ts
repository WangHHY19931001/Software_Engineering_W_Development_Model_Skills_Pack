/**
 * 关注仓储
 */
import { BaseRepository } from './base.repository.js';
import type { Follow } from '../types/index.js';

export class FollowRepository extends BaseRepository<Follow> {
  async findByFollower(followerId: string): Promise<Follow[]> {
    return this.findBy((f) => f.followerId === followerId);
  }

  async findByFollowee(followeeId: string): Promise<Follow[]> {
    return this.findBy((f) => f.followeeId === followeeId);
  }

  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    return this.findOne(
      (f) => f.followerId === followerId && f.followeeId === followeeId,
    ).then((r) => r !== null);
  }

  async findPair(followerId: string, followeeId: string): Promise<Follow | null> {
    return this.findOne(
      (f) => f.followerId === followerId && f.followeeId === followeeId,
    );
  }

  async countFollowers(followeeId: string): Promise<number> {
    return this.findByFollowee(followeeId).then((arr) => arr.length);
  }

  async countFollowing(followerId: string): Promise<number> {
    return this.findByFollower(followerId).then((arr) => arr.length);
  }
}
