/**
 * UT-019 重复点赞幂等（likeService.likeArticle，DD-019/INTF-013）
 */
import { describe, it, expect, vi } from 'vitest';
import { LikeStore } from '../../../src/stores/likeStore';
import { FavoriteStore } from '../../../src/stores/favoriteStore';
import { LikeService } from '../../../src/services/interaction/likeService';

function makeService(overrides: { likeStore?: LikeStore; favoriteStore?: FavoriteStore; articleService?: any; eventBus?: any } = {}) {
  const likeStore = overrides.likeStore ?? new LikeStore();
  const favoriteStore = overrides.favoriteStore ?? new FavoriteStore();
  const articleService: any = overrides.articleService ?? {
    getPublishedArticleById: vi.fn().mockResolvedValue({ id: 'a_1001', authorId: 'u_0002', status: 'published' }),
  };
  const eventBus = overrides.eventBus ?? { emit: vi.fn() };
  const service = new LikeService(likeStore, favoriteStore, articleService, eventBus);
  return { likeStore, favoriteStore, articleService, eventBus, service };
}

describe('UT-019 likeService.likeArticle 幂等', () => {
  it('同用户重复点赞不重复计数、事件不重复触发', async () => {
    const likeStore = new LikeStore();
    const favoriteStore = new FavoriteStore();
    likeStore.add({ userId: 'u_0001', articleId: 'a_1001', createdAt: '2026-08-07T10:00:00.000Z' });
    const articleService: any = {
      getPublishedArticleById: vi.fn().mockResolvedValue({ id: 'a_1001', authorId: 'u_0002', status: 'published' }),
    };
    const eventBus: any = { emit: vi.fn() };
    const service = new LikeService(likeStore, favoriteStore, articleService, eventBus);

    const result = await service.likeArticle('a_1001', 'u_0001');

    expect(result.liked).toBe(true);
    expect(likeStore.countByArticle('a_1001')).toBe(1);
    expect(eventBus.emit).not.toHaveBeenCalledWith('article.liked', expect.anything());
  });

  it('首次点赞触发 article.liked 事件', async () => {
    const likeStore = new LikeStore();
    const articleService: any = {
      getPublishedArticleById: vi.fn().mockResolvedValue({ id: 'a_1001', authorId: 'u_0002', status: 'published' }),
    };
    const eventBus: any = { emit: vi.fn() };
    const service = new LikeService(likeStore, new FavoriteStore(), articleService, eventBus);

    await service.likeArticle('a_1001', 'u_0001');
    expect(likeStore.countByArticle('a_1001')).toBe(1);
    expect(eventBus.emit).toHaveBeenCalledWith('article.liked', expect.objectContaining({ articleId: 'a_1001', articleAuthorId: 'u_0002' }));
  });
});

describe('likeService 其余方法（unlike/favorite/unfavorite/listMyFavorites/计数）', () => {
  it('unlikeArticle / favoriteArticle / unfavoriteArticle 幂等语义', async () => {
    const { likeStore, favoriteStore, service } = makeService();

    const unliked = await service.unlikeArticle('a_1001', 'u_0001');
    expect(unliked.liked).toBe(false);

    const fav = await service.favoriteArticle('a_1001', 'u_0001');
    expect(fav.favorited).toBe(true);
    expect(favoriteStore.countByArticle('a_1001')).toBe(1);
    const favAgain = await service.favoriteArticle('a_1001', 'u_0001');
    expect(favAgain.favorited).toBe(true);
    expect(favoriteStore.countByArticle('a_1001')).toBe(1); // 幂等不重复计数

    const unfav = await service.unfavoriteArticle('a_1001', 'u_0001');
    expect(unfav.favorited).toBe(false);
    expect(favoriteStore.countByArticle('a_1001')).toBe(0);
  });

  it('点赞/收藏文章不存在或未发布 → 40402', async () => {
    const articleService: any = { getPublishedArticleById: vi.fn().mockResolvedValue(null) };
    const { service } = makeService({ articleService });
    expect((await service.likeArticle('a_x', 'u_0001').catch((e) => e)).code).toBe(40402);
    expect((await service.favoriteArticle('a_x', 'u_0001').catch((e) => e)).code).toBe(40402);
  });

  it('listMyFavorites：本人收藏列表（含文章标题/摘要）', async () => {
    const favoriteStore = new FavoriteStore();
    favoriteStore.add({ userId: 'u_0001', articleId: 'a_1001', createdAt: '2026-08-07T10:00:00.000Z' });
    favoriteStore.add({ userId: 'u_0001', articleId: 'a_1002', createdAt: '2026-08-07T10:01:00.000Z' });
    const articleService: any = {
      getPublishedArticleById: vi.fn().mockResolvedValue({ id: 'a_1001', authorId: 'u_0002', status: 'published' }),
      getArticlesByIds: vi.fn().mockResolvedValue([
        { id: 'a_1001', title: '标题一', summary: '摘要一' },
        { id: 'a_1002', title: '标题二', summary: '摘要二' },
      ]),
    };
    const { service } = makeService({ favoriteStore, articleService });

    const page = await service.listMyFavorites('u_0001', 1, 20);
    expect(page.total).toBe(2);
    expect(page.items[0]).toEqual(expect.objectContaining({ articleId: 'a_1002', title: '标题二' }));

    expect(service.countLikes('a_1001')).toBe(0);
    expect(service.countFavorites('a_1001')).toBe(1);
  });
});
