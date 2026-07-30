/**
 * 认证服务测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../../src/services/auth.service.js';
import { UserRepository } from '../../src/repositories/user.repository.js';
import { BloggerRepository } from '../../src/repositories/blogger.repository.js';
import { UserRole } from '../../src/types/index.js';
import { AppError, AuthError, ConflictError, ErrorCode, NotFoundError, ValidationError } from '../../src/utils/errors.js';

describe('AuthService', () => {
  let userRepo: UserRepository;
  let bloggerRepo: BloggerRepository;
  let svc: AuthService;

  beforeEach(() => {
    userRepo = new UserRepository();
    bloggerRepo = new BloggerRepository();
    svc = new AuthService(userRepo, bloggerRepo);
  });

  describe('register()', () => {
    it('should register a new reader', async () => {
      const result = await svc.register({
        email: 'test@example.com',
        username: 'tester',
        password: 'password123',
        nickname: 'Tester',
      });      expect(result.user.email).toBe('test@example.com');
      expect(result.user.username).toBe('tester');
      expect(result.user.role).toBe(UserRole.READER);
      expect(result.token.length).toBeGreaterThan(0);
      expect(result.expiresIn).toBeGreaterThan(0);
    });

    it('should normalize email to lowercase', async () => {
      const result = await svc.register({
        email: 'TEST@Example.COM',
        username: 'tester',
        password: 'password123',
      });
      expect(result.user.email).toBe('test@example.com');
    });

    it('should auto-create blogger record when role=blogger', async () => {
      await svc.register({
        email: 'b@example.com',
        username: 'blogger1',
        password: 'password123',
        role: UserRole.BLOGGER,
      });
      const user = await userRepo.findByEmail('b@example.com');
      expect(user).toBeDefined();
      const blogger = await bloggerRepo.findByUserId(user!.id);
      expect(blogger).toBeDefined();
      expect(blogger!.verified).toBe(false);
    });

    it('should throw ValidationError on invalid email', async () => {
      await expect(
        svc.register({ email: 'not-an-email', username: 'tester', password: 'password123' })
      ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
    });

    it('should throw ValidationError on missing fields', async () => {
      await expect(
        svc.register({} as never)
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('should throw ValidationError on short username', async () => {
      await expect(
        svc.register({ email: 'a@b.com', username: 'ab', password: 'password123' })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('should throw ValidationError on short password', async () => {
      await expect(
        svc.register({ email: 'a@b.com', username: 'tester', password: '123' })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('should throw ConflictError on duplicate email', async () => {
      await svc.register({ email: 'dup@example.com', username: 'usr1', password: 'password123' });
      await expect(
        svc.register({ email: 'dup@example.com', username: 'usr2', password: 'password123' })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('should throw ConflictError on duplicate username', async () => {
      await svc.register({ email: 'a@example.com', username: 'samename', password: 'password123' });
      await expect(
        svc.register({ email: 'b@example.com', username: 'samename', password: 'password123' })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('should use username as nickname when nickname not provided', async () => {
      const result = await svc.register({
        email: 'a@example.com',
        username: 'myname',
        password: 'password123',
      });
      expect(result.user.nickname).toBe('myname');
    });

    it('should override username with explicit nickname', async () => {
      const result = await svc.register({
        email: 'a@example.com',
        username: 'myname',
        nickname: 'My Display Name',
        password: 'password123',
      });
      expect(result.user.nickname).toBe('My Display Name');
    });
  });

  describe('login()', () => {
    beforeEach(async () => {
      await svc.register({ email: 'login@example.com', username: 'loginuser', password: 'password123' });
    });

    it('should login with correct credentials', async () => {
      const result = await svc.login({ email: 'login@example.com', password: 'password123' });
      expect(result.user.email).toBe('login@example.com');
      expect(result.token.length).toBeGreaterThan(0);
    });

    it('should login with case-insensitive email', async () => {
      const result = await svc.login({ email: 'LOGIN@EXAMPLE.COM', password: 'password123' });
      expect(result.user.email).toBe('login@example.com');
    });

    it('should throw AuthError on wrong password', async () => {
      await expect(
        svc.login({ email: 'login@example.com', password: 'wrong' })
      ).rejects.toBeInstanceOf(AuthError);
    });

    it('should throw AuthError on missing user', async () => {
      await expect(
        svc.login({ email: 'noone@example.com', password: 'password123' })
      ).rejects.toBeInstanceOf(AuthError);
    });

    it('should throw ValidationError on empty body', async () => {
      await expect(svc.login({} as never)).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('authenticate()', () => {
    it('should authenticate via valid token', async () => {
      const r = await svc.register({ email: 'a@a.com', username: 'authuser', password: 'password123' });
      const user = await svc.authenticate(r.token);
      expect(user.id).toBe(r.user.id);
    });

    it('should throw AuthError on invalid token', async () => {
      await expect(svc.authenticate('invalid-token')).rejects.toBeInstanceOf(AuthError);
    });

    it('should throw AuthError on empty token', async () => {
      await expect(svc.authenticate('')).rejects.toBeInstanceOf(AuthError);
    });
  });

  describe('verifyTokenOnly()', () => {
    it('should verify valid token', async () => {
      const r = await svc.register({ email: 'a@a.com', username: 'usr', password: 'password123' });
      const payload = svc.verifyTokenOnly(r.token);
      expect(payload.sub).toBe(r.user.id);
      expect(payload.role).toBe(UserRole.READER);
    });

    it('should throw on invalid', () => {
      expect(() => svc.verifyTokenOnly('garbage')).toThrowError(AppError);
    });
  });

  describe('getUserById()', () => {
    it('should return user', async () => {
      const r = await svc.register({ email: 'a@a.com', username: 'usr1', password: 'password123' });
      const u = await svc.getUserById(r.user.id);
      expect(u.id).toBe(r.user.id);
    });

    it('should throw NotFoundError on missing', async () => {
      await expect(svc.getUserById('missing')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('toPublicUser()', () => {
    it('should strip password hash', async () => {
      const r = await svc.register({ email: 'a@a.com', username: 'usr2', password: 'password123' });
      expect((r.user as Record<string, unknown>).passwordHash).toBeUndefined();
    });
  });
});
