/**
 * 用户资料服务
 */
import { z } from 'zod';
import { UserRepository } from '../repositories/user.repository.js';
import { generateId } from '../utils/id.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import type { PublicUser, User } from '../types/index.js';

export const UpdateProfileSchema = z.object({
  nickname: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().max(2000).optional(),
});

export const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6).max(128),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  toPublic(user: User): PublicUser {
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

  async getById(id: string): Promise<PublicUser> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new NotFoundError('User');
    }
    return this.toPublic(user);
  }

  async getByUsername(username: string): Promise<PublicUser> {
    const user = await this.userRepo.findByUsername(username);
    if (!user) {
      throw new NotFoundError('User');
    }
    return this.toPublic(user);
  }

  async getByEmail(email: string): Promise<PublicUser> {
    const user = await this.userRepo.findByEmail(email.toLowerCase());
    if (!user) {
      throw new NotFoundError('User');
    }
    return this.toPublic(user);
  }

  async updateProfile(id: string, input: UpdateProfileInput): Promise<PublicUser> {
    const parsed = UpdateProfileSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid profile data', { issues: parsed.error.issues });
    }
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new NotFoundError('User');
    }
    const updates: Partial<User> = {
      ...parsed.data,
      updatedAt: Date.now(),
    };
    const updated = await this.userRepo.update(id, updates);
    if (!updated) {
      throw new NotFoundError('User');
    }
    return this.toPublic(updated);
  }

  async changePassword(id: string, input: ChangePasswordInput): Promise<void> {
    const parsed = ChangePasswordSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid password data', { issues: parsed.error.issues });
    }
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new NotFoundError('User');
    }
    // 实际使用 hash 工具；此处仅更新 hash 字段的占位
    void user;
    void parsed.data;
  }

  async deleteUser(id: string): Promise<boolean> {
    const exists = await this.userRepo.exists(id);
    if (!exists) {
      throw new NotFoundError('User');
    }
    return this.userRepo.delete(id);
  }

  async listUsers(page: number = 1, pageSize: number = 20): Promise<{
    items: PublicUser[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const all = await this.userRepo.findAll();
    all.sort((a, b) => b.createdAt - a.createdAt);
    const total = all.length;
    const start = (page - 1) * pageSize;
    const items = all.slice(start, start + pageSize).map((u) => this.toPublic(u));
    return { items, total, page, pageSize };
  }

  async ensureExists(id: string): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new NotFoundError('User');
    }
    return user;
  }
}

void generateId; // 防止未使用警告
void ConflictError;
