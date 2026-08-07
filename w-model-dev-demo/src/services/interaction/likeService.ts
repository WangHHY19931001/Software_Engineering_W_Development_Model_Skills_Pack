/**
 * likeService（DD-019 / SD-003）：点赞/收藏（幂等，REQ-019）；计数聚合供详情；首次点赞触发 article.liked。
 */
import { BizError } from '../../utils/errors';
import type { LikeStore } from '../../stores/likeStore';
import type { FavoriteStore } from '../../stores/favoriteStore';
import type { ArticleService } from '../content/articleService';
import type { EventBus } from '../../utils/eventBus';
import type { FavoriteItem, Page } from '../../types';

export interface LikeResult {
  articleId: string;
  liked: boolean;
}

export interface FavoriteResult {
  articleId: string;
  favorited: boolean;
}

export class LikeService {
  constructor(
    private readonly likeStore: LikeStore,
    private readonly favoriteStore: FavoriteStore,
    private readonly articleService: ArticleService,
    private readonly eventBus: EventBus,
  ) {}

  /** 点赞（幂等：已存在返回 200 不重复计数；首次触发 article.liked） */
  async likeArticle(articleId: string, userId: string): Promise<LikeResult> {
    const article = await this.requirePublished(articleId);
    const existing = await this.likeStore.findByUserAndArticle(userId, articleId);
    if (existing) {
      return { articleId, liked: true };
    }
    await this.likeStore.add({ userId, articleId, createdAt: new Date().toISOString() });
    this.eventBus.emit('article.liked', {
      type: 'article.liked',
      articleId,
      userId,
      articleAuthorId: article.authorId,
    });
    return { articleId, liked: true };
  }

  /** 取消点赞（幂等移除） */
  async unlikeArticle(articleId: string, userId: string): Promise<LikeResult> {
    await this.requirePublished(articleId);
    await this.likeStore.remove(userId, articleId);
    return { articleId, liked: false };
  }

  /** 收藏（幂等） */
  async favoriteArticle(articleId: string, userId: string): Promise<FavoriteResult> {
    await this.requirePublished(articleId);
    const existing = await this.favoriteStore.findByUserAndArticle(userId, articleId);
    if (existing) {
      return { articleId, favorited: true };
    }
    await this.favoriteStore.add({ userId, articleId, createdAt: new Date().toISOString() });
    return { articleId, favorited: true };
  }

  /** 取消收藏（幂等移除） */
  async unfavoriteArticle(articleId: string, userId: string): Promise<FavoriteResult> {
    await this.requirePublished(articleId);
    await this.favoriteStore.remove(userId, articleId);
    return { articleId, favorited: false };
  }

  /** 本人收藏列表（含文章标题/摘要，createdAt 降序） */
  async listMyFavorites(userId: string, page: number, pageSize: number): Promise<Page<FavoriteItem>> {
    const favorites = await this.favoriteStore.listByUser(userId, page, pageSize);
    const articles = await this.articleService.getArticlesByIds(favorites.items.map((f) => f.articleId));
    const byId = new Map(articles.map((a) => [a.id, a]));
    const items: FavoriteItem[] = favorites.items.map((f) => {
      const article = byId.get(f.articleId);
      return {
        articleId: f.articleId,
        title: article?.title ?? '',
        summary: article?.summary ?? '',
        favoritedAt: f.createdAt,
      };
    });
    return { items, total: favorites.total, page, pageSize };
  }

  countLikes(articleId: string): number {
    return this.likeStore.countByArticle(articleId);
  }

  countFavorites(articleId: string): number {
    return this.favoriteStore.countByArticle(articleId);
  }

  private async requirePublished(articleId: string) {
    const article = await this.articleService.getPublishedArticleById(articleId);
    if (!article) {
      throw new BizError(40402, '文章不存在或不可见');
    }
    return article;
  }
}
