/**
 * LikeStore（DD-018-003）— 点赞存储 + 复合主键 (userId, articleId) 去重。
 */
import type { Like } from '../types.js';
import { ConflictError } from '../utils/errors.js';

export class LikeStore {
  private likes: Map<string, Like> = new Map();

  private key(userId: string, articleId: string): string {
    return `${userId}:${articleId}`;
  }

  toggle(userId: string, articleId: string): { liked: boolean; like: Like | null } {
    const k = this.key(userId, articleId);
    const existing = this.likes.get(k);
    if (existing) {
      this.likes.delete(k);
      return { liked: false, like: null };
    }
    const record: Like = {
      userId,
      articleId,
      createdAt: new Date().toISOString(),
    };
    this.likes.set(k, record);
    return { liked: true, like: record };
  }

  add(userId: string, articleId: string): Like {
    const k = this.key(userId, articleId);
    if (this.likes.has(k)) {
      throw new ConflictError('已点赞过该文章');
    }
    const record: Like = {
      userId,
      articleId,
      createdAt: new Date().toISOString(),
    };
    this.likes.set(k, record);
    return record;
  }

  remove(userId: string, articleId: string): boolean {
    return this.likes.delete(this.key(userId, articleId));
  }

  exists(userId: string, articleId: string): boolean {
    return this.likes.has(this.key(userId, articleId));
  }

  listByArticle(articleId: string): Like[] {
    return [...this.likes.values()].filter((l) => l.articleId === articleId);
  }

  listByUser(userId: string): Like[] {
    return [...this.likes.values()].filter((l) => l.userId === userId);
  }

  countByArticle(articleId: string): number {
    return this.listByArticle(articleId).length;
  }

  size(): number {
    return this.likes.size;
  }

  clear(): void {
    this.likes.clear();
  }
}
