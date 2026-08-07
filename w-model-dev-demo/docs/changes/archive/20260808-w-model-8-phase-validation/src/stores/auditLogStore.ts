/**
 * AuditLogStore（DD-049 / CON-004 / RH-01）：AuditLog 实体存储。
 * 字段白名单 {id, actionType, actorId, resourceType, resourceId, result, httpStatus, clientIp, requestId, createdAt}
 * ——schema 中不存在 password/token/请求体字段；保留 ≥90 天（prune 按 createdAt 清理）。
 */
import { SnapshotStore, nextId } from './base';
import type { AuditLog, AuditActionType } from '../types';

interface AuditLogState {
  map: Map<string, AuditLog>;
  seq: { n: number };
}

export type AuditLogCreateInput = Omit<AuditLog, 'id'> & { id?: string };

export interface AuditLogFilter {
  actionType?: AuditActionType;
  actorId?: string;
  before?: Date;
  after?: Date;
}

export class AuditLogStore extends SnapshotStore<AuditLogState> {
  protected state: AuditLogState = { map: new Map(), seq: { n: 0 } };

  append(input: AuditLogCreateInput): AuditLog {
    const id = input.id ?? nextId('au', this.state.seq);
    // 白名单字段类型约束：仅接受设计定义字段（无 password/token/body）
    const record: AuditLog = {
      id,
      actionType: input.actionType,
      actorId: input.actorId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      result: input.result,
      httpStatus: input.httpStatus,
      clientIp: input.clientIp,
      requestId: input.requestId,
      createdAt: input.createdAt,
    };
    this.state.map.set(id, record);
    return record;
  }

  list(filter?: AuditLogFilter): AuditLog[] {
    let items = [...this.state.map.values()];
    if (filter?.actionType) items = items.filter((l) => l.actionType === filter.actionType);
    if (filter?.actorId) items = items.filter((l) => l.actorId === filter.actorId);
    if (filter?.before) items = items.filter((l) => Date.parse(l.createdAt) < filter.before!.getTime());
    if (filter?.after) items = items.filter((l) => Date.parse(l.createdAt) >= filter.after!.getTime());
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** 保留 ≥90 天：删除 createdAt < before 的旧日志，返回删除条数 */
  prune(before: Date): number {
    let removed = 0;
    for (const [id, log] of this.state.map) {
      if (Date.parse(log.createdAt) < before.getTime()) {
        this.state.map.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
}
