/**
 * 审计日志仓储
 */
import { BaseRepository } from './base.repository.js';
import type { AuditLog } from '../types/index.js';

export interface AuditQuery {
  actorId?: string;
  action?: string;
  fromTs?: number;
  toTs?: number;
  limit?: number;
  offset?: number;
}

export class AuditLogRepository extends BaseRepository<AuditLog> {
  async query(q: AuditQuery): Promise<{ items: AuditLog[]; total: number }> {
    let items = Array.from(this.store.values());
    if (q.actorId) {
      items = items.filter((a) => a.actorId === q.actorId);
    }
    if (q.action) {
      items = items.filter((a) => a.action === q.action);
    }
    if (q.fromTs !== undefined) {
      items = items.filter((a) => a.createdAt >= q.fromTs!);
    }
    if (q.toTs !== undefined) {
      items = items.filter((a) => a.createdAt <= q.toTs!);
    }
    items.sort((a, b) => b.createdAt - a.createdAt);
    const total = items.length;
    if (q.offset !== undefined && q.offset > 0) {
      items = items.slice(q.offset);
    }
    if (q.limit !== undefined && q.limit > 0) {
      items = items.slice(0, q.limit);
    }
    return { items: items.map((i) => this.clone(i)), total };
  }

  async purgeOlderThan(ts: number): Promise<number> {
    let removed = 0;
    for (const item of Array.from(this.store.values())) {
      if (item.createdAt < ts) {
        this.store.delete(item.id);
        removed += 1;
      }
    }
    return removed;
  }
}
