/**
 * 关注服务
 */
import { z } from 'zod';
import { FollowRepository } from '../repositories/follow.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { generateId } from '../utils/id.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../utils/errors.js';
import { Follow, type PaginatedResult, type PublicUser } from '../types/index.js';

export const CreateFollowSchema = z.object({
  followerId: z.string().min(1),
  followeeId: z.string().min(1),
});

export type CreateFollowInput = z.infer<typeof CreateFollowSchema>;

export class FollowService {
  constructor(
    private readonly followRepo: FollowRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async follow(input: CreateFollowInput): Promise<Follow> {
    const parsed = CreateFollowSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid follow data', { issues: parsed.error.issues });
    }
    if (parsed.data.followerId === parsed.data.followeeId) {
      throw new ValidationError('Cannot follow yourself');
    }
    const follower = await this.userRepo.findById(parsed.data.followerId);
    if (!follower) {
      throw new NotFoundError('Follower');
    }
    const followee = await this.userRepo.findById(parsed.data.followeeId);
    if (!followee) {
      throw new NotFoundError('Followee');
    }
    const existing = await this.followRepo.findPair(parsed.data.followerId, parsed.data.followeeId);
    if (existing) {
      throw new ConflictError('Already following');
    }
    const follow: Follow = {
      id: generateId('follow'),
      followerId: parsed.data.followerId,
      followeeId: parsed.data.followeeId,
      createdAt: Date.now(),
    };
    await this.followRepo.create(follow);
    return follow;
  }

  async unfollow(followerId: string, followeeId: string): Promise<boolean> {
    const pair = await this.followRepo.findPair(followerId, followeeId);
    if (!pair) {
      throw new NotFoundError('Follow');
    }
    return this.followRepo.delete(pair.id);
  }

  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    return this.followRepo.isFollowing(followerId, followeeId);
  }

  async listFollowers(followeeId: string, page: number = 1, pageSize: number = 20): Promise<PaginatedResult<PublicUser>> {
    const follows = await this.followRepo.findByFollowee(followeeId);
    const users: PublicUser[] = [];
    for (const f of follows) {
      const u = await this.userRepo.findById(f.followerId);
      if (u) {
        users.push({
          id: u.id,
          email: u.email,
          username: u.username,
          nickname: u.nickname,
          role: u.role,
          bio: u.bio,
          avatarUrl: u.avatarUrl,
          createdAt: u.createdAt,
        });
      }
    }
    users.sort((a, b) => b.createdAt - a.createdAt);
    const total = users.length;
    const start = (page - 1) * pageSize;
    return {
      items: users.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async listFollowing(followerId: string, page: number = 1, pageSize: number = 20): Promise<PaginatedResult<PublicUser>> {
    const follows = await this.followRepo.findByFollower(followerId);
    const users: PublicUser[] = [];
    for (const f of follows) {
      const u = await this.userRepo.findById(f.followeeId);
      if (u) {
        users.push({
          id: u.id,
          email: u.email,
          username: u.username,
          nickname: u.nickname,
          role: u.role,
          bio: u.bio,
          avatarUrl: u.avatarUrl,
          createdAt: u.createdAt,
        });
      }
    }
    users.sort((a, b) => b.createdAt - a.createdAt);
    const total = users.length;
    const start = (page - 1) * pageSize;
    return {
      items: users.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async countFollowers(followeeId: string): Promise<number> {
    return this.followRepo.countFollowers(followeeId);
  }

  async countFollowing(followerId: string): Promise<number> {
    return this.followRepo.countFollowing(followerId);
  }
}
