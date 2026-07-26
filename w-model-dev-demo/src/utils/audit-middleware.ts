/**
 * 审计日志记录中间件（DD-019-004 AuditMiddleware / REQ-018）。
 * 与 L3_audit_log_flow.tla 一致：best-effort 写入（失败不阻断主流程）。
 * 仅记录 POST/PUT/DELETE/PATCH 写操作。
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { AuditService } from '../services/audit.service.js';

export class AuditMiddleware {
  constructor(private auditService: AuditService) {}

  record(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
      res.on('finish', () => {
        const method = req.method.toUpperCase();
        if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) return;
        const userId = (req as unknown as { user?: { id: string } }).user?.id ?? 'anonymous';
        const pathSegments = req.path.split('/').filter(Boolean);
        const resource = pathSegments[1] ?? req.path;
        const resourceId = (req.params['id'] ?? pathSegments[2] ?? '') as string;
        try {
          void this.auditService.log({
            userId,
            action: `${method.toLowerCase()}.${req.path}`,
            resource,
            resourceId,
            meta: {
              statusCode: res.statusCode,
              ip: req.ip ?? '',
              method,
            },
          });
        } catch {
          // best-effort：审计失败不阻断主流程
        }
      });
      next();
    };
  }
}
