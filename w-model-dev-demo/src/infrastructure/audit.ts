/**
 * DD-026 AuditLogger —— 审计日志器
 *
 * 敏感操作审计记录；独立存储（独立于 wal.log）；90 天滚动；
 * 不参与崩溃重建（CONFLICT-002）。
 */
import type { AuditEntry } from '../types.js';
import { AppError } from '../utils/errors.js';

export interface AuditFilter {
  action?: string;
  actor?: string;
  target?: string;
  since?: number;
  until?: number;
}

/** 文件写入接口（便于 mock） */
export interface AuditFileWriter {
  write(path: string, data: string): Promise<void>;
  read(path: string): Promise<string>;
}

/** 默认内存写入器 */
export class MemoryAuditWriter implements AuditFileWriter {
  private files: Map<string, string> = new Map();
  async write(path: string, data: string): Promise<void> {
    this.files.set(path, data);
  }
  async read(path: string): Promise<string> {
    return this.files.get(path) ?? '';
  }
}

export class AuditLogger {
  private logPath: string;
  private entries: AuditEntry[] = [];
  private writer: AuditFileWriter;
  private maxAge = 90 * 86400; // 90 天（GAP-009）
  private counter = 0;

  constructor(logPath = './audit.log', writer?: AuditFileWriter) {
    this.logPath = logPath;
    this.writer = writer ?? new MemoryAuditWriter();
  }

  /** 写审计（对应 DD-026 log + TLA+ WriteAudit） */
  async log(
    action: string,
    actor: string,
    target: string,
    detail: Record<string, unknown>,
  ): Promise<void> {
    const entry: AuditEntry = {
      entryId: `audit-${++this.counter}`,
      action,
      actor,
      target,
      detail,
      timestamp: Math.floor(Date.now() / 1000),
    };
    this.entries.push(entry);
    try {
      await this.writer.write(this.logPath, JSON.stringify(this.entries));
    } catch (err) {
      throw new AppError(50003, '审计日志写入失败', { cause: String(err) });
    }
  }

  /** WriteAudit 别名（对应 TLA+ L2_infrastructure WriteAudit） */
  async writeAudit(ae: Omit<AuditEntry, 'entryId' | 'timestamp'>): Promise<void> {
    await this.log(ae.action, ae.actor, ae.target, ae.detail);
  }

  /** 查询审计日志（对应 DD-026 query） */
  query(filter: AuditFilter): AuditEntry[] {
    return this.entries.filter(e => {
      if (filter.action && e.action !== filter.action) return false;
      if (filter.actor && e.actor !== filter.actor) return false;
      if (filter.target && e.target !== filter.target) return false;
      if (filter.since !== undefined && e.timestamp < filter.since) return false;
      if (filter.until !== undefined && e.timestamp > filter.until) return false;
      return true;
    });
  }

  /** 清理过期日志（对应 DD-026 prune，90 天滚动） */
  prune(): void {
    const cutoff = Math.floor(Date.now() / 1000) - this.maxAge;
    this.entries = this.entries.filter(e => e.timestamp >= cutoff);
  }

  /** 获取全部审计条目数 */
  getCount(): number {
    return this.entries.length;
  }

  /** 获取审计日志路径 */
  getLogPath(): string {
    return this.logPath;
  }
}
