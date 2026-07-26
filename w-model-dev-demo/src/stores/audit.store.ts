/**
 * AuditLogStore（DD-019-003）— 审计日志存储 + 90 天保留清理（CON-004）。
 * 与 L4_audit_log_retention.tla 一致：Retention90Days / NoLogLoss 不变式。
 */
import type { AuditLog, AuditLogQuery, PaginatedResult } from '../types.js';
import { generateUuid } from '../utils/id.js';
import { PaginationUtil } from '../utils/pagination.js';

export class AuditLogStore {
  private logs: Map<string, AuditLog> = new Map();
  private timestampIndex: Map<string, Set<string>> = new Map();
  private actionIndex: Map<string, Set<string>> = new Map();
  private userIndex: Map<string, Set<string>> = new Map();
  readonly RETENTION_DAYS = 90;

  insert(log: Omit<AuditLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): AuditLog {
    const record: AuditLog = {
      id: log.id ?? generateUuid(),
      userId: log.userId,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      meta: log.meta,
      timestamp: log.timestamp ?? new Date().toISOString(),
    };
    this.logs.set(record.id, record);
    const month = record.timestamp.slice(0, 7);
    this.addToIndex(this.timestampIndex, month, record.id);
    this.addToIndex(this.actionIndex, record.action, record.id);
    this.addToIndex(this.userIndex, record.userId, record.id);
    return record;
  }

  private addToIndex(idx: Map<string, Set<string>>, key: string, value: string): void {
    let set = idx.get(key);
    if (!set) {
      set = new Set();
      idx.set(key, set);
    }
    set.add(value);
  }

  private removeFromIndex(idx: Map<string, Set<string>>, key: string, value: string): void {
    const set = idx.get(key);
    if (set) {
      set.delete(value);
      if (set.size === 0) idx.delete(key);
    }
  }

  query(q: AuditLogQuery): PaginatedResult<AuditLog> {
    let items = [...this.logs.values()];
    if (q.userId !== undefined) {
      items = items.filter((l) => l.userId === q.userId);
    }
    if (q.action !== undefined) {
      items = items.filter((l) => l.action.includes(q.action!));
    }
    if (q.resource !== undefined) {
      items = items.filter((l) => l.resource === q.resource);
    }
    if (q.startTime !== undefined) {
      items = items.filter((l) => l.timestamp >= q.startTime!);
    }
    if (q.endTime !== undefined) {
      items = items.filter((l) => l.timestamp <= q.endTime!);
    }
    items = items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return PaginationUtil.paginate(items, q.page, q.limit);
  }

  cleanupExpired(now: Date = new Date()): number {
    const cutoff = new Date(now.getTime() - this.RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const cutoffIso = cutoff.toISOString();
    const expired: AuditLog[] = [];
    for (const log of this.logs.values()) {
      if (log.timestamp < cutoffIso) {
        expired.push(log);
      }
    }
    for (const log of expired) {
      this.logs.delete(log.id);
      const month = log.timestamp.slice(0, 7);
      this.removeFromIndex(this.timestampIndex, month, log.id);
      this.removeFromIndex(this.actionIndex, log.action, log.id);
      this.removeFromIndex(this.userIndex, log.userId, log.id);
    }
    return expired.length;
  }

  assertRetentionInvariant(now: Date = new Date()): void {
    const cutoff = new Date(now.getTime() - this.RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const cutoffIso = cutoff.toISOString();
    for (const log of this.logs.values()) {
      if (log.timestamp < cutoffIso) {
        throw new Error(`AuditLogStore 不变式违反 Retention90Days: 存在超过 90 天的日志 ${log.id}`);
      }
    }
  }

  size(): number {
    return this.logs.size;
  }

  clear(): void {
    this.logs.clear();
    this.timestampIndex.clear();
    this.actionIndex.clear();
    this.userIndex.clear();
  }
}
