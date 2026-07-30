/**
 * 博主注册服务
 */
import { z } from 'zod';
import { BloggerRepository } from '../repositories/blogger.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { generateId } from '../utils/id.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../utils/errors.js';
import { UserRole, type Blogger, type User } from '../types/index.js';

export const RegisterBloggerSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1).max(100),
  description: z.string().max(2000).optional().default(''),
  avatarUrl: z.string().url().optional(),
});

export const UpdateBloggerSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  avatarUrl: z.string().url().optional(),
});

export type RegisterBloggerInput = z.infer<typeof RegisterBloggerSchema>;
export type UpdateBloggerInput = z.infer<typeof UpdateBloggerSchema>;

export class BloggerService {
  constructor(
    private readonly bloggerRepo: BloggerRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async register(input: RegisterBloggerInput): Promise<Blogger> {
    const parsed = RegisterBloggerSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid blogger data', { issues: parsed.error.issues });
    }
    const user = await this.userRepo.findById(parsed.data.userId);
    if (!user) {
      throw new NotFoundError('User');
    }
    const existing = await this.bloggerRepo.findByUserId(user.id);
    if (existing) {
      throw new ConflictError('User is already a blogger');
    }
    const now = Date.now();
    const blogger: Blogger = {
      id: generateId('blogger'),
      userId: user.id,
      displayName: parsed.data.displayName,
      description: parsed.data.description ?? '',
      avatarUrl: parsed.data.avatarUrl,
      verified: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.bloggerRepo.create(blogger);
    if (user.role !== UserRole.BLOGGER) {
      await this.userRepo.update(user.id, { role: UserRole.BLOGGER, updatedAt: now });
    }
    return blogger;
  }

  async getById(id: string): Promise<Blogger> {
    const blogger = await this.bloggerRepo.findById(id);
    if (!blogger) {
      throw new NotFoundError('Blogger');
    }
    return blogger;
  }

  async getByUserId(userId: string): Promise<Blogger> {
    const blogger = await this.bloggerRepo.findByUserId(userId);
    if (!blogger) {
      throw new NotFoundError('Blogger');
    }
    return blogger;
  }

  async update(id: string, input: UpdateBloggerInput, actorId: string): Promise<Blogger> {
    const parsed = UpdateBloggerSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid blogger update data', { issues: parsed.error.issues });
    }
    const blogger = await this.bloggerRepo.findById(id);
    if (!blogger) {
      throw new NotFoundError('Blogger');
    }
    if (blogger.userId !== actorId) {
      throw new ForbiddenError('Cannot update other blogger');
    }
    const updated = await this.bloggerRepo.update(id, {
      ...parsed.data,
      updatedAt: Date.now(),
    } as Partial<Blogger>);
    if (!updated) {
      throw new NotFoundError('Blogger');
    }
    return updated;
  }

  async verify(id: string): Promise<Blogger> {
    const updated = await this.bloggerRepo.update(id, {
      verified: true,
      updatedAt: Date.now(),
    } as Partial<Blogger>);
    if (!updated) {
      throw new NotFoundError('Blogger');
    }
    return updated;
  }

  async list(): Promise<Blogger[]> {
    return this.bloggerRepo.findAll();
  }

  async listVerified(): Promise<Blogger[]> {
    return this.bloggerRepo.findVerified();
  }

  async getUser(bloggerId: string): Promise<User> {
    const blogger = await this.bloggerRepo.findById(bloggerId);
    if (!blogger) {
      throw new NotFoundError('Blogger');
    }
    const user = await this.userRepo.findById(blogger.userId);
    if (!user) {
      throw new NotFoundError('User');
    }
    return user;
  }
}
