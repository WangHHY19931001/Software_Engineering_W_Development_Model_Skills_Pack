/**
 * 审计日志服务
 */
import { z } from 'zod';
import { AuditLogRepository } from '../repositories/audit-log.repository.js';
import { generateId } from '../utils/id.js';
import { ValidationError } from '../utils/errors.js';
import { AuditAction, type AuditLog, type PaginatedResult } from '../types/index.js';

export const RecordAuditSchema = z.object({
  actorId: z.string().nullable().optional(),
  action: z.nativeEnum(AuditAction),
  target: z.string().min(1).max(200),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  ip: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
});

export type RecordAuditInput = z.infer<typeof RecordAuditSchema>;

export class AuditLogService {
  constructor(private readonly auditLogRepo: AuditLogRepository) {}

  async record(input: RecordAuditInput): Promise<AuditLog> {
    const parsed = RecordAuditSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid audit log data', { issues: parsed.error.issues });
    }
    const log: AuditLog = {
      id: generateId('audit'),
      actorId: parsed.data.actorId ?? null,
      action: parsed.data.action,
      target: parsed.data.target,
      metadata: parsed.data.metadata ?? {},
      ip: parsed.data.ip ?? null,
      userAgent: parsed.data.userAgent ?? null,
      createdAt: Date.now(),
    };
    await this.auditLogRepo.create(log);
    return log;
  }

  async list(page: number = 1, pageSize: number = 50): Promise<PaginatedResult<AuditLog>> {
    const { items, total } = await this.auditLogRepo.query({
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async listByActor(actorId: string, page: number = 1, pageSize: number = 50): Promise<PaginatedResult<AuditLog>> {
    const { items, total } = await this.auditLogRepo.query({
      actorId,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async listByAction(action: AuditAction, page: number = 1, pageSize: number = 50): Promise<PaginatedResult<AuditLog>> {
    const { items, total } = await this.auditLogRepo.query({
      action,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async purgeOlderThan(days: number): Promise<number> {
    if (days <= 0) return 0;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return this.auditLogRepo.purgeOlderThan(cutoff);
  }

  async count(): Promise<number> {
    return this.auditLogRepo.count();
  }
}
