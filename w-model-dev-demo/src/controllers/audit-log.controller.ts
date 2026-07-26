/**
 * AuditLogController（DD-019-001）— 审计日志查询（仅 admin）。
 */
import type { Request, Response, NextFunction } from 'express';
import type { AuditService } from '../services/audit.service.js';
import { auditLogQuerySchema } from '../utils/schemas.js';

export class AuditLogController {
  constructor(private auditService: AuditService) {}

  async list(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const input = auditLogQuerySchema.parse(req.query);
    const result = this.auditService.query(input);
    res.json(result);
  }
}
