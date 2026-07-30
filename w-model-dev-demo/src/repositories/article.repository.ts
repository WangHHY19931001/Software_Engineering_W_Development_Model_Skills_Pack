/**
 * 博文仓储 - 含状态机相关查询
 */
import { BaseRepository } from './base.repository.js';
import { ArticleStatus, type Article } from '../types/index.js';

export interface ArticleQuery {
  authorId?: string;
  status?: ArticleStatus;
  tagId?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'publishedAt' | 'viewCount' | 'likeCount';
  sortOrder?: 'asc' | 'desc';
}

export class ArticleRepository extends BaseRepository<Article> {
  async findByAuthor(authorId: string): Promise<Article[]> {
    return this.findBy((a) => a.authorId === authorId);
  }

  async findByStatus(status: ArticleStatus): Promise<Article[]> {
    return this.findBy((a) => a.status === status);
  }

  async findPublished(): Promise<Article[]> {
    return this.findBy((a) => a.status === ArticleStatus.PUBLISHED);
  }

  async search(query: ArticleQuery): Promise<{ items: Article[]; total: number }> {
    let items = Array.from(this.store.values());

    if (query.authorId) {
      items = items.filter((a) => a.authorId === query.authorId);
    }
    if (query.status) {
      items = items.filter((a) => a.status === query.status);
    }
    if (query.tagId) {
      items = items.filter((a) => a.tagIds.includes(query.tagId!));
    }
    if (query.keyword) {
      const kw = query.keyword.toLowerCase();
      items = items.filter(
        (a) =>
          a.title.toLowerCase().includes(kw) ||
          a.content.toLowerCase().includes(kw) ||
          a.summary.toLowerCase().includes(kw),
      );
    }

    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';
    items.sort((a, b) => {
      const av = (a as unknown as Record<string, number>)[sortBy] ?? 0;
      const bv = (b as unknown as Record<string, number>)[sortBy] ?? 0;
      return sortOrder === 'asc' ? av - bv : bv - av;
    });

    const total = items.length;
    if (query.offset !== undefined && query.offset > 0) {
      items = items.slice(query.offset);
    }
    if (query.limit !== undefined && query.limit > 0) {
      items = items.slice(0, query.limit);
    }

    return {
      items: items.map((a) => this.clone(a)),
      total,
    };
  }

  async incrementView(id: string): Promise<Article | null> {
    const article = this.store.get(id);
    if (!article) return null;
    const updated = { ...article, viewCount: article.viewCount + 1 };
    this.store.set(id, updated);
    return this.clone(updated);
  }

  async incrementLike(id: string, delta: number = 1): Promise<Article | null> {
    const article = this.store.get(id);
    if (!article) return null;
    const next = article.likeCount + delta;
    const updated = { ...article, likeCount: Math.max(0, next) };
    this.store.set(id, updated);
    return this.clone(updated);
  }

  async incrementFavorite(id: string, delta: number = 1): Promise<Article | null> {
    const article = this.store.get(id);
    if (!article) return null;
    const next = article.favoriteCount + delta;
    const updated = { ...article, favoriteCount: Math.max(0, next) };
    this.store.set(id, updated);
    return this.clone(updated);
  }

  async incrementComment(id: string, delta: number = 1): Promise<Article | null> {
    const article = this.store.get(id);
    if (!article) return null;
    const next = article.commentCount + delta;
    const updated = { ...article, commentCount: Math.max(0, next) };
    this.store.set(id, updated);
    return this.clone(updated);
  }

  async countByStatus(status: ArticleStatus): Promise<number> {
    return this.findBy((a) => a.status === status).then((arr) => arr.length);
  }
}
