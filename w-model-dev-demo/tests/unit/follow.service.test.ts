/**
 * 关注服务测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FollowService } from '../../src/services/follow.service.js';
import { FollowRepository } from '../../src/repositories/follow.repository.js';
import { UserRepository } from '../../src/repositories/user.repository.js';
import { UserRole, type User } from '../../src/types/index.js';
import { generateId } from '../../src/utils/id.js';
import { ConflictError, NotFoundError, ValidationError } from '../../src/utils/errors.js';

describe('FollowService', () => {
  let followRepo: FollowRepository;
  let userRepo: UserRepository;
  let svc: FollowService;
  let nextUserNum = 0;

  beforeEach(() => {
    followRepo = new FollowRepository();
    userRepo = new UserRepository();
    svc = new FollowService(followRepo, userRepo);
  });

  async function seedUser(): Promise<User> {
    nextUserNum += 1;
    const u: User = {
      id: generateId('user'),
      email: `u${nextUserNum}@e.com`,
      passwordHash: 'h',
      username: `u${nextUserNum}`,
      nickname: `U${nextUserNum}`,
      role: UserRole.READER,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await userRepo.create(u);
    return u;
  }

  describe('follow()', () => {
    it('should follow user', async () => {
      const u1 = await seedUser();
      const u2 = await seedUser();
      const f = await svc.follow({ followerId: u1.id, followeeId: u2.id });
      expect(f.followerId).toBe(u1.id);
      expect(f.followeeId).toBe(u2.id);
    });

    it('should throw ValidationError on self-follow', async () => {
      const u = await seedUser();
      await expect(svc.follow({ followerId: u.id, followeeId: u.id })).rejects.toBeInstanceOf(ValidationError);
    });

    it('should throw NotFoundError on missing follower', async () => {
      const u = await seedUser();
      await expect(svc.follow({ followerId: 'missing', followeeId: u.id })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should throw NotFoundError on missing followee', async () => {
      const u = await seedUser();
      await expect(svc.follow({ followerId: u.id, followeeId: 'missing' })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should throw ConflictError on duplicate', async () => {
      const u1 = await seedUser();
      const u2 = await seedUser();
      await svc.follow({ followerId: u1.id, followeeId: u2.id });
      await expect(svc.follow({ followerId: u1.id, followeeId: u2.id })).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('unfollow()', () => {
    it('should unfollow', async () => {
      const u1 = await seedUser();
      const u2 = await seedUser();
      await svc.follow({ followerId: u1.id, followeeId: u2.id });
      const r = await svc.unfollow(u1.id, u2.id);
      expect(r).toBe(true);
    });

    it('should throw NotFoundError if not following', async () => {
      const u1 = await seedUser();
      const u2 = await seedUser();
      await expect(svc.unfollow(u1.id, u2.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('isFollowing()', () => {
    it('returns true when following', async () => {
      const u1 = await seedUser();
      const u2 = await seedUser();
      await svc.follow({ followerId: u1.id, followeeId: u2.id });
      const r = await svc.isFollowing(u1.id, u2.id);
      expect(r).toBe(true);
    });

    it('returns false when not following', async () => {
      const u1 = await seedUser();
      const u2 = await seedUser();
      const r = await svc.isFollowing(u1.id, u2.id);
      expect(r).toBe(false);
    });
  });

  describe('listFollowers/listFollowing', () => {
    it('listFollowers returns followers', async () => {
      const u1 = await seedUser();
      const u2 = await seedUser();
      await svc.follow({ followerId: u2.id, followeeId: u1.id });
      const r = await svc.listFollowers(u1.id);
      expect(r.items.length).toBe(1);
      expect(r.total).toBe(1);
    });

    it('listFollowing returns following', async () => {
      const u1 = await seedUser();
      const u2 = await seedUser();
      await svc.follow({ followerId: u1.id, followeeId: u2.id });
      const r = await svc.listFollowing(u1.id);
      expect(r.items.length).toBe(1);
    });

    it('paginate correctly', async () => {
      const u1 = await seedUser();
      const u2 = await seedUser();
      const u3 = await seedUser();
      await svc.follow({ followerId: u1.id, followeeId: u2.id });
      await svc.follow({ followerId: u1.id, followeeId: u3.id });
      const r = await svc.listFollowing(u1.id, 1, 1);
      expect(r.items.length).toBe(1);
      expect(r.total).toBe(2);
    });
  });

  describe('countFollowers/countFollowing', () => {
    it('countFollowers', async () => {
      const u1 = await seedUser();
      const u2 = await seedUser();
      await svc.follow({ followerId: u2.id, followeeId: u1.id });
      const c = await svc.countFollowers(u1.id);
      expect(c).toBe(1);
    });

    it('countFollowing', async () => {
      const u1 = await seedUser();
      const u2 = await seedUser();
      await svc.follow({ followerId: u1.id, followeeId: u2.id });
      const c = await svc.countFollowing(u1.id);
      expect(c).toBe(1);
    });
  });
});
