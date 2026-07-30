/**
 * 收藏服务
 */
import { z } from 'zod';
import { BaseRepository } from '../repositories/base.repository.js';
import { ArticleRepository } from '../repositories/article.repository.js';
import { generateId } from '../utils/id.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import type { Favorite } from '../types/index.js';

export type FavoriteRepository = BaseRepository<Favorite>;

export class FavoriteRepositoryImpl extends BaseRepository<Favorite> {}

export const CreateFavoriteSchema = z.object({
  userId: z.string().min(1),
  postId: z.string().min(1),
});

export type CreateFavoriteInput = z.infer<typeof CreateFavoriteSchema>;

export class FavoriteService {
  constructor(
    private readonly favoriteRepo: FavoriteRepository,
    private readonly articleRepo: ArticleRepository,
  ) {}

  async favorite(input: CreateFavoriteInput): Promise<Favorite> {
    const parsed = CreateFavoriteSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid favorite data', { issues: parsed.error.issues });
    }
    const article = await this.articleRepo.findById(parsed.data.postId);
    if (!article) {
      throw new NotFoundError('Article');
    }
    const existing = await this.favoriteRepo.findOne(
      (f) => f.userId === parsed.data.userId && f.postId === parsed.data.postId,
    );
    if (existing) {
      throw new ConflictError('Already favorited');
    }
    const favorite: Favorite = {
      id: generateId('fav'),
      userId: parsed.data.userId,
      postId: parsed.data.postId,
      createdAt: Date.now(),
    };
    await this.favoriteRepo.create(favorite);
    await this.articleRepo.incrementFavorite(parsed.data.postId, 1);
    return favorite;
  }

  async unfavorite(userId: string, postId: string): Promise<boolean> {
    const fav = await this.favoriteRepo.findOne(
      (f) => f.userId === userId && f.postId === postId,
    );
    if (!fav) {
      throw new NotFoundError('Favorite');
    }
    const ok = await this.favoriteRepo.delete(fav.id);
    if (ok) {
      await this.articleRepo.incrementFavorite(postId, -1);
    }
    return ok;
  }

  async isFavorited(userId: string, postId: string): Promise<boolean> {
    const fav = await this.favoriteRepo.findOne(
      (f) => f.userId === userId && f.postId === postId,
    );
    return fav !== null;
  }

  async countByPost(postId: string): Promise<number> {
    return this.favoriteRepo.findBy((f) => f.postId === postId).then((arr) => arr.length);
  }

  async listByUser(userId: string): Promise<Favorite[]> {
    return this.favoriteRepo.findBy((f) => f.userId === userId);
  }
}
