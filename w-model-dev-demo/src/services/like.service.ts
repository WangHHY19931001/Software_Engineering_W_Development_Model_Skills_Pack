/**
 * 点赞服务
 */
import { z } from 'zod';
import { BaseRepository } from '../repositories/base.repository.js';
import { ArticleRepository } from '../repositories/article.repository.js';
import { generateId } from '../utils/id.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import type { Like } from '../types/index.js';

export type LikeRepository = BaseRepository<Like>;

export class LikeRepositoryImpl extends BaseRepository<Like> {}

export const CreateLikeSchema = z.object({
  userId: z.string().min(1),
  postId: z.string().min(1),
});

export type CreateLikeInput = z.infer<typeof CreateLikeSchema>;

export class LikeService {
  constructor(
    private readonly likeRepo: LikeRepository,
    private readonly articleRepo: ArticleRepository,
  ) {}

  async like(input: CreateLikeInput): Promise<Like> {
    const parsed = CreateLikeSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid like data', { issues: parsed.error.issues });
    }
    const article = await this.articleRepo.findById(parsed.data.postId);
    if (!article) {
      throw new NotFoundError('Article');
    }
    const existing = await this.likeRepo.findOne(
      (l) => l.userId === parsed.data.userId && l.postId === parsed.data.postId,
    );
    if (existing) {
      throw new ConflictError('Already liked');
    }
    const like: Like = {
      id: generateId('like'),
      userId: parsed.data.userId,
      postId: parsed.data.postId,
      createdAt: Date.now(),
    };
    await this.likeRepo.create(like);
    await this.articleRepo.incrementLike(parsed.data.postId, 1);
    return like;
  }

  async unlike(userId: string, postId: string): Promise<boolean> {
    const like = await this.likeRepo.findOne(
      (l) => l.userId === userId && l.postId === postId,
    );
    if (!like) {
      throw new NotFoundError('Like');
    }
    const ok = await this.likeRepo.delete(like.id);
    if (ok) {
      await this.articleRepo.incrementLike(postId, -1);
    }
    return ok;
  }

  async isLiked(userId: string, postId: string): Promise<boolean> {
    const like = await this.likeRepo.findOne(
      (l) => l.userId === userId && l.postId === postId,
    );
    return like !== null;
  }

  async countByPost(postId: string): Promise<number> {
    return this.likeRepo.findBy((l) => l.postId === postId).then((arr) => arr.length);
  }

  async listByUser(userId: string): Promise<Like[]> {
    return this.likeRepo.findBy((l) => l.userId === userId);
  }
}
