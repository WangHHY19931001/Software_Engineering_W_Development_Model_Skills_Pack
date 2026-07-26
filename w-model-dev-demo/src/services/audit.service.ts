/**
 * AuditService（DD-019-002）— 审计日志记录 + 查询（REQ-018, REQ-019）。
 * 与 L3_audit_log_flow.tla 一致：best-effort 写入。
 * 与 L4_audit_log_retention.tla 一致：Retention90Days / NoLogLoss。
 */
import type { AuditLog, AuditLogEntry, AuditLogQuery, PaginatedResult } from '../types.js';
import type { AuditLogStore } from '../stores/audit.store.js';
import type { Logger } from '../utils/logger.js';

export class AuditService {
  constructor(
    private auditLogStore: AuditLogStore,
    private logger: Logger,
  ) {}

  async log(entry: AuditLogEntry): Promise<AuditLog> {
    try {
      const record = this.auditLogStore.insert({
        userId: entry.userId,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        meta: entry.meta ?? {},
      });
      return record;
    } catch (e) {
      this.logger.error('audit_log_failure', {
        entry,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }

  query(query: AuditLogQuery): PaginatedResult<AuditLog> {
    return this.auditLogStore.query(query);
  }

  cleanupExpired(now?: Date): number {
    return this.auditLogStore.cleanupExpired(now);
  }

  assertRetentionInvariant(now?: Date): void {
    this.auditLogStore.assertRetentionInvariant(now);
  }

  getStore(): AuditLogStore {
    return this.auditLogStore;
  }
}
