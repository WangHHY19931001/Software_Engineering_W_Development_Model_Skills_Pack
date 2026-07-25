// SD-016 SubscriptionStore.

import {
  SubscriptionTarget,
  type Subscription,
  type SubscriptionEvent,
} from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `sub-${counter}`;
}

export interface SubscriptionExistsFn {
  (target: SubscriptionTarget, targetId: string): boolean;
}

export class SubscriptionStore {
  private subscriptions = new Map<string, Subscription>();
  private userIdToSubs = new Map<string, Set<string>>();
  private targetIdToSubs = new Map<string, Set<string>>();
  // Aggregation queue per (targetId + eventType) — 1h window.
  private aggregationQueue = new Map<string, SubscriptionEvent[]>();

  size(): number {
    return this.subscriptions.size;
  }

  getById(id: string): Subscription | null {
    return this.subscriptions.get(id) ?? null;
  }

  exists(userId: string, target: SubscriptionTarget, targetId: string): boolean {
    const set = this.userIdToSubs.get(userId);
    if (!set) return false;
    for (const id of set) {
      const s = this.subscriptions.get(id);
      if (s && s.target === target && s.targetId === targetId) return true;
    }
    return false;
  }

  create(
    userId: string,
    target: SubscriptionTarget,
    targetId: string,
    targetExists: (target: SubscriptionTarget, targetId: string) => boolean,
  ): Subscription {
    if (!targetExists(target, targetId)) {
      throw new AppError(ErrorCode.NotFound, '1031');
    }
    if (this.exists(userId, target, targetId)) {
      // Idempotent: return existing subscription (no-op).
      const set = this.userIdToSubs.get(userId);
      if (set) {
        for (const id of set) {
          const s = this.subscriptions.get(id);
          if (s && s.target === target && s.targetId === targetId) {
            return { ...s };
          }
        }
      }
    }
    const now = new Date();
    const sub: Subscription = {
      id: nextId(),
      userId,
      target,
      targetId,
      createdAt: now,
      updatedAt: now,
    };
    this.subscriptions.set(sub.id, sub);
    this.indexAdd(this.userIdToSubs, userId, sub.id);
    this.indexAdd(this.targetIdToSubs, targetId, sub.id);
    return { ...sub };
  }

  delete(userId: string, target: SubscriptionTarget, targetId: string): void {
    const set = this.userIdToSubs.get(userId);
    if (!set) throw new AppError(ErrorCode.NotFound, '1031');
    let foundId: string | null = null;
    for (const id of set) {
      const s = this.subscriptions.get(id);
      if (s && s.target === target && s.targetId === targetId) {
        foundId = id;
        break;
      }
    }
    if (!foundId) throw new AppError(ErrorCode.NotFound, '1031');
    set.delete(foundId);
    this.subscriptions.delete(foundId);
    const targetSet = this.targetIdToSubs.get(targetId);
    if (targetSet) {
      targetSet.delete(foundId);
      if (targetSet.size === 0) this.targetIdToSubs.delete(targetId);
    }
  }

  listByUser(userId: string, target?: SubscriptionTarget): { items: Subscription[]; total: number } {
    const set = this.userIdToSubs.get(userId);
    if (!set) return { items: [], total: 0 };
    const all: Subscription[] = [];
    for (const id of set) {
      const s = this.subscriptions.get(id);
      if (s) {
        if (!target || s.target === target) all.push({ ...s });
      }
    }
    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { items: all, total: all.length };
  }

  listByTarget(targetId: string): string[] {
    const set = this.targetIdToSubs.get(targetId);
    if (!set) return [];
    const out: string[] = [];
    for (const id of set) {
      const s = this.subscriptions.get(id);
      if (s) out.push(s.userId);
    }
    return out;
  }

  enqueueEvent(targetId: string, event: SubscriptionEvent): SubscriptionEvent[] {
    const key = `${targetId}::${event.type}`;
    let arr = this.aggregationQueue.get(key);
    if (!arr) {
      arr = [];
      this.aggregationQueue.set(key, arr);
    }
    arr.push(event);
    return [...arr];
  }

  drainQueue(targetId: string, type: string): SubscriptionEvent[] {
    const key = `${targetId}::${type}`;
    const arr = this.aggregationQueue.get(key);
    if (!arr) return [];
    this.aggregationQueue.delete(key);
    return [...arr];
  }

  private indexAdd<K>(map: Map<K, Set<string>>, key: K, value: string): void {
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(value);
  }

  clear(): void {
    this.subscriptions.clear();
    this.userIdToSubs.clear();
    this.targetIdToSubs.clear();
    this.aggregationQueue.clear();
  }
}
