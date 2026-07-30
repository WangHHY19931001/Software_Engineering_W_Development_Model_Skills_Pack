/**
 * 认证服务
 * 注册/登录/JWT
 */
import { z } from 'zod';
import { UserRepository } from '../repositories/user.repository.js';
import { BloggerRepository } from '../repositories/blogger.repository.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken, verifyToken } from '../utils/jwt.js';
import { generateId } from '../utils/id.js';
import {
  AuthError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../utils/errors.js';
import {
  UserRole,
  type AuthResult,
  type JwtPayload,
  type PublicUser,
  type User,
} from '../types/index.js';

export const RegisterSchema = z.object({
  email: z.string().email().max(200),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(6).max(128),
  nickname: z.string().min(1).max(50).optional(),
  role: z.nativeEnum(UserRole).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly bloggerRepo: BloggerRepository,
  ) {}

  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      nickname: user.nickname,
      role: user.role,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const parsed = RegisterSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid registration data', {
        issues: parsed.error.issues,
      });
    }
    const { email, username, password, nickname, role } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existingEmail = await this.userRepo.findByEmail(normalizedEmail);
    if (existingEmail) {
      throw new ConflictError('Email already in use', { field: 'email' });
    }
    const existingUsername = await this.userRepo.findByUsername(username);
    if (existingUsername) {
      throw new ConflictError('Username already in use', { field: 'username' });
    }

    const passwordHash = await hashPassword(password);
    const now = Date.now();
    const user: User = {
      id: generateId('user'),
      email: normalizedEmail,
      passwordHash,
      username,
      nickname: nickname ?? username,
      role: role ?? UserRole.READER,
      createdAt: now,
      updatedAt: now,
    };
    await this.userRepo.create(user);

    if (user.role === UserRole.BLOGGER) {
      await this.bloggerRepo.create({
        id: generateId('blogger'),
        userId: user.id,
        displayName: user.nickname,
        description: '',
        verified: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    const { token, expiresIn } = signToken({ sub: user.id, role: user.role });
    return { user: this.toPublicUser(user), token, expiresIn };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const parsed = LoginSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid login data', {
        issues: parsed.error.issues,
      });
    }
    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    const user = await this.userRepo.findByEmail(normalizedEmail);
    if (!user) {
      throw new AuthError('Invalid credentials');
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      throw new AuthError('Invalid credentials');
    }
    const { token, expiresIn } = signToken({ sub: user.id, role: user.role });
    return { user: this.toPublicUser(user), token, expiresIn };
  }

  async authenticate(token: string): Promise<PublicUser> {
    const payload = verifyToken(token);
    const user = await this.userRepo.findById(payload.sub);
    if (!user) {
      throw new AuthError('User not found');
    }
    return this.toPublicUser(user);
  }

  verifyTokenOnly(token: string): JwtPayload {
    return verifyToken(token);
  }

  async getUserById(id: string): Promise<PublicUser> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new NotFoundError('User');
    }
    return this.toPublicUser(user);
  }
}
