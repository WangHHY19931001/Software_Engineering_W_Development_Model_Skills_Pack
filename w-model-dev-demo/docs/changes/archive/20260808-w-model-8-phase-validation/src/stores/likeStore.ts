/**
 * LikeStore（DD-022）：Like 实体存储，(userId, articleId) 唯一索引（幂等）。
 */
import { SnapshotStore, nextId } from './base';
import type { Like } from '../types';

interface LikeState {
  map: Map<string, Like>;
  byUserArticle: Map<string, string>;
  byArticle: Map<string, Set<string>>;
  seq: { n: number };
}

export type LikeCreateInput = Omit<Like, 'id'> & { id?: string };

function pairKey(userId: string, articleId: string): string {
  return `${userId}|${articleId}`;
}

export class LikeStore extends SnapshotStore<LikeState> {
  protected state: LikeState = { map: new Map(), byUserArticle: new Map(), byArticle: new Map(), seq: { n: 0 } };

  /** 幂等写入：已存在返回既有记录（不重复计数） */
  add(like: LikeCreateInput): Like {
    const key = pairKey(like.userId, like.articleId);
    const existingId = this.state.byUserArticle.get(key);
    if (existingId) {
      return this.state.map.get(existingId) as Like;
    }
    const id = like.id ?? nextId('l', this.state.seq);
    const record: Like = { id, userId: like.userId, articleId: like.articleId, createdAt: like.createdAt };
    this.state.map.set(id, record);
    this.state.byUserArticle.set(key, id);
    const set = this.state.byArticle.get(record.articleId) ?? new Set<string>();
    set.add(id);
    this.state.byArticle.set(record.articleId, set);
    return record;
  }

  remove(userId: string, articleId: string): boolean {
    const key = pairKey(userId, articleId);
    const id = this.state.byUserArticle.get(key);
    if (!id) return false;
    this.state.byUserArticle.delete(key);
    const set = this.state.byArticle.get(articleId);
    if (set) {
      set.delete(id);
      if (set.size === 0) this.state.byArticle.delete(articleId);
    }
    this.state.map.delete(id);
    return true;
  }

  findByUserAndArticle(userId: string, articleId: string): Like | null {
    const id = this.state.byUserArticle.get(pairKey(userId, articleId));
    return id ? this.state.map.get(id) ?? null : null;
  }

  countByArticle(articleId: string): number {
    return this.state.byArticle.get(articleId)?.size ?? 0;
  }

  listByArticle(articleId: string): Like[] {
    const ids = this.state.byArticle.get(articleId) ?? new Set<string>();
    return [...ids].map((id) => this.state.map.get(id)).filter((l): l is Like => l !== undefined);
  }
}
