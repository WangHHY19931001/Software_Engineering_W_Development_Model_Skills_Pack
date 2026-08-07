/**
 * FollowStore（DD-024）：Follow 实体存储，(followerId, followeeId) 唯一索引（幂等）。
 */
import { SnapshotStore, nextId } from './base';
import type { Follow } from '../types';

interface FollowState {
  map: Map<string, Follow>;
  byPair: Map<string, string>;
  byFollower: Map<string, Set<string>>;
  byFollowee: Map<string, Set<string>>;
  seq: { n: number };
}

export type FollowCreateInput = Omit<Follow, 'id'> & { id?: string };

function pairKey(followerId: string, followeeId: string): string {
  return `${followerId}|${followeeId}`;
}

export class FollowStore extends SnapshotStore<FollowState> {
  protected state: FollowState = { map: new Map(), byPair: new Map(), byFollower: new Map(), byFollowee: new Map(), seq: { n: 0 } };

  add(follow: FollowCreateInput): Follow {
    const key = pairKey(follow.followerId, follow.followeeId);
    const existingId = this.state.byPair.get(key);
    if (existingId) {
      return this.state.map.get(existingId) as Follow;
    }
    const id = follow.id ?? nextId('fl', this.state.seq);
    const record: Follow = { id, followerId: follow.followerId, followeeId: follow.followeeId, createdAt: follow.createdAt };
    this.state.map.set(id, record);
    this.state.byPair.set(key, id);
    this.addSet(this.state.byFollower, record.followerId, id);
    this.addSet(this.state.byFollowee, record.followeeId, id);
    return record;
  }

  remove(followerId: string, followeeId: string): boolean {
    const key = pairKey(followerId, followeeId);
    const id = this.state.byPair.get(key);
    if (!id) return false;
    this.state.byPair.delete(key);
    this.removeSet(this.state.byFollower, followerId, id);
    this.removeSet(this.state.byFollowee, followeeId, id);
    this.state.map.delete(id);
    return true;
  }

  findByFollowerAndFollowee(followerId: string, followeeId: string): Follow | null {
    const id = this.state.byPair.get(pairKey(followerId, followeeId));
    return id ? this.state.map.get(id) ?? null : null;
  }

  /** 已关注博主 id 列表（feed 数据源） */
  listFolloweeIdsByFollower(followerId: string): string[] {
    const ids = this.state.byFollower.get(followerId) ?? new Set<string>();
    const result: string[] = [];
    for (const id of ids) {
      const f = this.state.map.get(id);
      if (f) result.push(f.followeeId);
    }
    return result;
  }

  /** 粉丝 id 列表（发文通知：NEW_ARTICLE） */
  listFollowers(followeeId: string): string[] {
    const ids = this.state.byFollowee.get(followeeId) ?? new Set<string>();
    const result: string[] = [];
    for (const id of ids) {
      const f = this.state.map.get(id);
      if (f) result.push(f.followerId);
    }
    return result;
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
