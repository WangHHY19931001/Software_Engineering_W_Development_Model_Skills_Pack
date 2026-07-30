/**
 * 点赞 + 收藏 服务测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { LikeService, LikeRepositoryImpl } from '../../src/services/like.service.js';
import { FavoriteService, FavoriteRepositoryImpl } from '../../src/services/favorite.service.js';
import { ArticleRepository } from '../../src/repositories/article.repository.js';
import { ArticleStatus, type Article } from '../../src/types/index.js';
import { generateId } from '../../src/utils/id.js';
import { ConflictError, NotFoundError } from '../../src/utils/errors.js';

describe('LikeService', () => {
  let likeRepo: LikeRepositoryImpl;
  let articleRepo: ArticleRepository;
  let svc: LikeService;
  let nextUserNum = 0;

  beforeEach(() => {
    likeRepo = new LikeRepositoryImpl();
    articleRepo = new ArticleRepository();
    svc = new LikeService(likeRepo, articleRepo);
  });

  async function seedArticle(authorId: string = 'a1'): Promise<Article> {
    const a: Article = {
      id: generateId('article'),
      authorId,
      title: 't',
      content: 'c',
      summary: '',
      status: ArticleStatus.PUBLISHED,
      tagIds: [],
      viewCount: 0,
      likeCount: 0,
      favoriteCount: 0,
      commentCount: 0,
      publishedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await articleRepo.create(a);
    return a;
  }

  describe('like()', () => {
    it('should like', async () => {
      const a = await seedArticle();
      const r = await svc.like({ userId: 'u1', postId: a.id });
      expect(r.userId).toBe('u1');
    });

    it('should increment article like count', async () => {
      const a = await seedArticle();
      await svc.like({ userId: 'u1', postId: a.id });
      const updated = await articleRepo.findById(a.id);
      expect(updated?.likeCount).toBe(1);
    });

    it('should throw ConflictError on duplicate', async () => {
      const a = await seedArticle();
      await svc.like({ userId: 'u1', postId: a.id });
      await expect(svc.like({ userId: 'u1', postId: a.id })).rejects.toBeInstanceOf(ConflictError);
    });

    it('should throw NotFoundError on missing article', async () => {
      await expect(svc.like({ userId: 'u1', postId: 'm' })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('unlike()', () => {
    it('should unlike', async () => {
      const a = await seedArticle();
      await svc.like({ userId: 'u1', postId: a.id });
      const r = await svc.unlike('u1', a.id);
      expect(r).toBe(true);
    });

    it('should decrement article like count', async () => {
      const a = await seedArticle();
      await svc.like({ userId: 'u1', postId: a.id });
      await svc.unlike('u1', a.id);
      const updated = await articleRepo.findById(a.id);
      expect(updated?.likeCount).toBe(0);
    });

    it('should throw NotFoundError if not liked', async () => {
      const a = await seedArticle();
      await expect(svc.unlike('u1', a.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('isLiked/countByPost/listByUser', () => {
    it('isLiked returns true when liked', async () => {
      const a = await seedArticle();
      await svc.like({ userId: 'u1', postId: a.id });
      expect(await svc.isLiked('u1', a.id)).toBe(true);
    });

    it('isLiked returns false when not', async () => {
      const a = await seedArticle();
      expect(await svc.isLiked('u1', a.id)).toBe(false);
    });

    it('countByPost returns count', async () => {
      const a = await seedArticle();
      await svc.like({ userId: 'u1', postId: a.id });
      await svc.like({ userId: 'u2', postId: a.id });
      expect(await svc.countByPost(a.id)).toBe(2);
    });

    it('listByUser returns user likes', async () => {
      const a = await seedArticle();
      await svc.like({ userId: 'u1', postId: a.id });
      const r = await svc.listByUser('u1');
      expect(r.length).toBe(1);
    });
  });
});

describe('FavoriteService', () => {
  let favRepo: FavoriteRepositoryImpl;
  let articleRepo: ArticleRepository;
  let svc: FavoriteService;
  let nextUserNum = 0;

  beforeEach(() => {
    favRepo = new FavoriteRepositoryImpl();
    articleRepo = new ArticleRepository();
    svc = new FavoriteService(favRepo, articleRepo);
  });

  async function seedArticle(authorId: string = 'a1'): Promise<Article> {
    const a: Article = {
      id: generateId('article'),
      authorId,
      title: 't',
      content: 'c',
      summary: '',
      status: ArticleStatus.PUBLISHED,
      tagIds: [],
      viewCount: 0,
      likeCount: 0,
      favoriteCount: 0,
      commentCount: 0,
      publishedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await articleRepo.create(a);
    return a;
  }

  describe('favorite()', () => {
    it('should favorite', async () => {
      const a = await seedArticle();
      const r = await svc.favorite({ userId: 'u1', postId: a.id });
      expect(r.userId).toBe('u1');
    });

    it('should throw ConflictError on duplicate', async () => {
      const a = await seedArticle();
      await svc.favorite({ userId: 'u1', postId: a.id });
      await expect(svc.favorite({ userId: 'u1', postId: a.id })).rejects.toBeInstanceOf(ConflictError);
    });

    it('should throw NotFoundError on missing', async () => {
      await expect(svc.favorite({ userId: 'u1', postId: 'm' })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('unfavorite()', () => {
    it('should unfavorite', async () => {
      const a = await seedArticle();
      await svc.favorite({ userId: 'u1', postId: a.id });
      const r = await svc.unfavorite('u1', a.id);
      expect(r).toBe(true);
    });

    it('throws on not favorited', async () => {
      const a = await seedArticle();
      await expect(svc.unfavorite('u1', a.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('isFavorited/countByPost/listByUser', () => {
    it('isFavorited', async () => {
      const a = await seedArticle();
      await svc.favorite({ userId: 'u1', postId: a.id });
      expect(await svc.isFavorited('u1', a.id)).toBe(true);
    });

    it('countByPost', async () => {
      const a = await seedArticle();
      await svc.favorite({ userId: 'u1', postId: a.id });
      expect(await svc.countByPost(a.id)).toBe(1);
    });

    it('listByUser', async () => {
      const a = await seedArticle();
      await svc.favorite({ userId: 'u1', postId: a.id });
      const r = await svc.listByUser('u1');
      expect(r.length).toBe(1);
    });
  });
});
