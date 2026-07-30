/**
 * 博主服务测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { BloggerService } from '../../src/services/blogger.service.js';
import { UserRepository } from '../../src/repositories/user.repository.js';
import { BloggerRepository } from '../../src/repositories/blogger.repository.js';
import { UserRole, type User } from '../../src/types/index.js';
import { generateId } from '../../src/utils/id.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../src/utils/errors.js';

describe('BloggerService', () => {
  let userRepo: UserRepository;
  let bloggerRepo: BloggerRepository;
  let svc: BloggerService;
  let nextUserNum = 0;

  beforeEach(() => {
    userRepo = new UserRepository();
    bloggerRepo = new BloggerRepository();
    svc = new BloggerService(bloggerRepo, userRepo);
  });

  async function seedUser(role: UserRole = UserRole.READER): Promise<User> {
    nextUserNum += 1;
    const u: User = {
      id: generateId('user'),
      email: `u${nextUserNum}@e.com`,
      passwordHash: 'h',
      username: `u${nextUserNum}`,
      nickname: `U${nextUserNum}`,
      role,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await userRepo.create(u);
    return u;
  }

  describe('register()', () => {
    it('should register blogger', async () => {
      const u = await seedUser();
      const b = await svc.register({ userId: u.id, displayName: 'Display' });
      expect(b.displayName).toBe('Display');
      expect(b.userId).toBe(u.id);
    });

    it('should set user role to blogger', async () => {
      const u = await seedUser(UserRole.READER);
      await svc.register({ userId: u.id, displayName: 'D' });
      const updated = await userRepo.findById(u.id);
      expect(updated!.role).toBe(UserRole.BLOGGER);
    });

    it('should throw ValidationError on missing fields', async () => {
      const u = await seedUser();
      await expect(
        svc.register({ userId: u.id, displayName: '' })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('should throw NotFoundError on missing user', async () => {
      await expect(
        svc.register({ userId: 'missing', displayName: 'D' })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should throw ConflictError on duplicate', async () => {
      const u = await seedUser();
      await svc.register({ userId: u.id, displayName: 'D' });
      await expect(
        svc.register({ userId: u.id, displayName: 'D2' })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('should keep blogger role if already blogger', async () => {
      const u = await seedUser(UserRole.BLOGGER);
      await svc.register({ userId: u.id, displayName: 'D' });
      const updated = await userRepo.findById(u.id);
      expect(updated!.role).toBe(UserRole.BLOGGER);
    });
  });

  describe('getById/getByUserId', () => {
    it('getById returns blogger', async () => {
      const u = await seedUser();
      const b = await svc.register({ userId: u.id, displayName: 'D' });
      const r = await svc.getById(b.id);
      expect(r.id).toBe(b.id);
    });

    it('getById throws NotFoundError', async () => {
      await expect(svc.getById('missing')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('getByUserId returns blogger', async () => {
      const u = await seedUser();
      const b = await svc.register({ userId: u.id, displayName: 'D' });
      const r = await svc.getByUserId(u.id);
      expect(r.id).toBe(b.id);
    });

    it('getByUserId throws NotFoundError', async () => {
      await expect(svc.getByUserId('missing')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('update()', () => {
    it('should update own', async () => {
      const u = await seedUser();
      const b = await svc.register({ userId: u.id, displayName: 'D' });
      const r = await svc.update(b.id, { displayName: 'New' }, u.id);
      expect(r.displayName).toBe('New');
    });

    it('should throw ForbiddenError for other', async () => {
      const u1 = await seedUser();
      const u2 = await seedUser();
      const b = await svc.register({ userId: u1.id, displayName: 'D' });
      await expect(
        svc.update(b.id, { displayName: 'X' }, u2.id)
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('should throw NotFoundError on missing', async () => {
      const u = await seedUser();
      await expect(
        svc.update('missing', { displayName: 'X' }, u.id)
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should throw ValidationError on bad data', async () => {
      const u = await seedUser();
      const b = await svc.register({ userId: u.id, displayName: 'D' });
      await expect(
        svc.update(b.id, { displayName: '' }, u.id)
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('verify()', () => {
    it('should mark verified', async () => {
      const u = await seedUser();
      const b = await svc.register({ userId: u.id, displayName: 'D' });
      const r = await svc.verify(b.id);
      expect(r.verified).toBe(true);
    });

    it('should throw NotFoundError on missing', async () => {
      await expect(svc.verify('missing')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('list*()', () => {
    it('list returns all', async () => {
      const u1 = await seedUser();
      const u2 = await seedUser();
      await svc.register({ userId: u1.id, displayName: 'D1' });
      await svc.register({ userId: u2.id, displayName: 'D2' });
      const r = await svc.list();
      expect(r.length).toBe(2);
    });

    it('listVerified returns only verified', async () => {
      const u1 = await seedUser();
      const u2 = await seedUser();
      const b1 = await svc.register({ userId: u1.id, displayName: 'D1' });
      await svc.register({ userId: u2.id, displayName: 'D2' });
      await svc.verify(b1.id);
      const r = await svc.listVerified();
      expect(r.length).toBe(1);
    });
  });

  describe('getUser()', () => {
    it('returns user', async () => {
      const u = await seedUser();
      const b = await svc.register({ userId: u.id, displayName: 'D' });
      const r = await svc.getUser(b.id);
      expect(r.id).toBe(u.id);
    });

    it('throws NotFoundError on missing blogger', async () => {
      await expect(svc.getUser('missing')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws NotFoundError on missing user', async () => {
      const u = await seedUser();
      const b = await svc.register({ userId: u.id, displayName: 'D' });
      await userRepo.delete(u.id);
      await expect(svc.getUser(b.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
