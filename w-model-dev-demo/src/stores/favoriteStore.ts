/**
 * FavoriteStore（DD-023）：Favorite 实体存储，(userId, articleId) 唯一索引（幂等）。
 */
import { SnapshotStore, nextId, assertPage } from './base';
import type { Favorite, Page } from '../types';

interface FavoriteState {
  map: Map<string, Favorite>;
  byUserArticle: Map<string, string>;
  byUser: Map<string, Set<string>>;
  byArticle: Map<string, Set<string>>;
  seq: { n: number };
}

export type FavoriteCreateInput = Omit<Favorite, 'id'> & { id?: string };

function pairKey(userId: string, articleId: string): string {
  return `${userId}|${articleId}`;
}

export class FavoriteStore extends SnapshotStore<FavoriteState> {
  protected state: FavoriteState = { map: new Map(), byUserArticle: new Map(), byUser: new Map(), byArticle: new Map(), seq: { n: 0 } };

  add(favorite: FavoriteCreateInput): Favorite {
    const key = pairKey(favorite.userId, favorite.articleId);
    const existingId = this.state.byUserArticle.get(key);
    if (existingId) {
      return this.state.map.get(existingId) as Favorite;
    }
    const id = favorite.id ?? nextId('f', this.state.seq);
    const record: Favorite = { id, userId: favorite.userId, articleId: favorite.articleId, createdAt: favorite.createdAt };
    this.state.map.set(id, record);
    this.state.byUserArticle.set(key, id);
    this.addSet(this.state.byUser, record.userId, id);
    this.addSet(this.state.byArticle, record.articleId, id);
    return record;
  }

  remove(userId: string, articleId: string): boolean {
    const key = pairKey(userId, articleId);
    const id = this.state.byUserArticle.get(key);
    if (!id) return false;
    this.state.byUserArticle.delete(key);
    this.removeSet(this.state.byUser, userId, id);
    this.removeSet(this.state.byArticle, articleId, id);
    this.state.map.delete(id);
    return true;
  }

  findByUserAndArticle(userId: string, articleId: string): Favorite | null {
    const id = this.state.byUserArticle.get(pairKey(userId, articleId));
    return id ? this.state.map.get(id) ?? null : null;
  }

  /** 本人收藏分页（createdAt 降序） */
  listByUser(userId: string, page: number, pageSize: number): Page<Favorite> {
    assertPage(page, pageSize);
    const ids = this.state.byUser.get(userId) ?? new Set<string>();
    const items = [...ids]
      .map((id) => this.state.map.get(id))
      .filter((f): f is Favorite => f !== undefined)
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
  }

  countByArticle(articleId: string): number {
    return this.state.byArticle.get(articleId)?.size ?? 0;
  }

  private addSet(map: Map<string, Set<string>>, key: string, value: string): void {
    const set = map.get(key) ?? new Set<string>();
    set.add(value);
    map.set(key, set);
  }

  private removeSet(map: Map<string, Set<string>>, key: string, value: string): void {
    const set = map.get(key);
    if (!set) return;
    set.delete(value);
    if (set.size === 0) map.delete(key);
  }
}
