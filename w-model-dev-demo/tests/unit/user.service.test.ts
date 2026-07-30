/**
 * 用户服务测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { UserService } from '../../src/services/user.service.js';
import { UserRepository } from '../../src/repositories/user.repository.js';
import { NotFoundError, ValidationError } from '../../src/utils/errors.js';
import { generateId } from '../../src/utils/id.js';
import { UserRole, type User } from '../../src/types/index.js';

describe('UserService', () => {
  let userRepo: UserRepository;
  let svc: UserService;
  let nextUserNum = 0;

  beforeEach(() => {
    userRepo = new UserRepository();
    svc = new UserService(userRepo);
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

  describe('getById/getByUsername/getByEmail', () => {
    it('getById returns user', async () => {
      const u = await seedUser();
      const r = await svc.getById(u.id);
      expect(r.id).toBe(u.id);
    });

    it('getById throws NotFoundError', async () => {
      await expect(svc.getById('missing')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('getByUsername returns user', async () => {
      const u = await seedUser();
      const r = await svc.getByUsername(u.username);
      expect(r.username).toBe(u.username);
    });

    it('getByUsername throws NotFoundError', async () => {
      await expect(svc.getByUsername('none')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('getByEmail lowercases', async () => {
      const u = await seedUser();
      const r = await svc.getByEmail(u.email.toUpperCase());
      expect(r.id).toBe(u.id);
    });

    it('getByEmail throws NotFoundError', async () => {
      await expect(svc.getByEmail('no@e.com')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('updateProfile', () => {
    it('should update nickname', async () => {
      const u = await seedUser();
      const r = await svc.updateProfile(u.id, { nickname: 'New Name' });
      expect(r.nickname).toBe('New Name');
    });

    it('should update bio', async () => {
      const u = await seedUser();
      const r = await svc.updateProfile(u.id, { bio: 'New bio' });
      expect(r.bio).toBe('New bio');
    });

    it('should update avatar', async () => {
      const u = await seedUser();
      const r = await svc.updateProfile(u.id, { avatarUrl: 'https://example.com/a.png' });
      expect(r.avatarUrl).toBe('https://example.com/a.png');
    });

    it('should throw ValidationError on bad url', async () => {
      const u = await seedUser();
      await expect(
        svc.updateProfile(u.id, { avatarUrl: 'not-a-url' })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('should throw ValidationError on too long bio', async () => {
      const u = await seedUser();
      await expect(
        svc.updateProfile(u.id, { bio: 'x'.repeat(501) })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('should throw NotFoundError on missing', async () => {
      await expect(
        svc.updateProfile('missing', { nickname: 'X' })
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('changePassword()', () => {
    it('should succeed on valid input', async () => {
      const u = await seedUser();
      await svc.changePassword(u.id, { oldPassword: 'old', newPassword: 'newpassword' });
    });

    it('should throw NotFoundError on missing', async () => {
      await expect(
        svc.changePassword('missing', { oldPassword: 'a', newPassword: 'abcdef' })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should throw ValidationError on short new password', async () => {
      const u = await seedUser();
      await expect(
        svc.changePassword(u.id, { oldPassword: 'a', newPassword: '1' })
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('deleteUser()', () => {
    it('should delete', async () => {
      const u = await seedUser();
      const r = await svc.deleteUser(u.id);
      expect(r).toBe(true);
    });

    it('should throw NotFoundError on missing', async () => {
      await expect(svc.deleteUser('missing')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('listUsers()', () => {
    it('should paginate', async () => {
      await seedUser();
      await seedUser();
      await seedUser();
      const r = await svc.listUsers(1, 2);
      expect(r.items.length).toBe(2);
      expect(r.total).toBe(3);
    });

    it('should handle empty', async () => {
      const r = await svc.listUsers(1, 10);
      expect(r.items.length).toBe(0);
    });
  });

  describe('ensureExists()', () => {
    it('returns user', async () => {
      const u = await seedUser();
      const r = await svc.ensureExists(u.id);
      expect(r.id).toBe(u.id);
    });

    it('throws NotFoundError', async () => {
      await expect(svc.ensureExists('missing')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('toPublic()', () => {
    it('strips password hash', async () => {
      const u = await seedUser();
      const r = await svc.getById(u.id);
      expect((r as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
    });
  });
});
