/**
 * auditMiddleware（DD-043 / SD-007 / CON-004 / RH-01）：审计留痕（登录/发布/删除三类关键操作）。
 * 仅记录白名单字段 {actionType, actorId, resourceType, resourceId, result, httpStatus, clientIp, requestId, createdAt}——
 * 显式排除 password/token/Authorization 头/请求体（反模式 #43 防护，字段白名单在 AuditLog schema 层同样约束）。
 * 审计失败不阻断业务（记 error 日志）。
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { AuditLogStore, AuditLogCreateInput } from '../stores/auditLogStore';
import type { AuditActionType, AuditResult } from '../types';

function resolveResourceType(path: string): string {
  if (path.startsWith('/api/auth')) return 'auth';
  if (path.startsWith('/api/articles')) return 'article';
  if (path.startsWith('/api/users')) return 'user';
  return 'other';
}

function resolveResourceId(req: Request): string | null {
  if (typeof req.params?.id === 'string') return req.params.id;
  if (typeof req.params?.cid === 'string') return req.params.cid;
  return req.user?.userId ?? null;
}

export class AuditMiddleware {
  constructor(private readonly auditLogStore: AuditLogStore) {}

  audit(actionType: AuditActionType): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      res.on('finish', () => {
        try {
          // 白名单构造：绝不写入 req.body / password / token / Authorization 头（RH-01）；
          // id 省略交由 AuditLogStore.append 生成（nextId）——此前硬编码 id:'' 会令 map.set('') 互相覆盖（CON-004 缺陷）
          const log: AuditLogCreateInput = {
            actionType,
            actorId: req.user?.userId ?? null,
            resourceType: resolveResourceType(req.path),
            resourceId: resolveResourceId(req),
            result: (res.statusCode < 400 ? 'success' : 'failure') as AuditResult,
            httpStatus: res.statusCode,
            clientIp: req.ip ?? 'unknown',
            requestId: (req.headers['x-request-id'] as string | undefined) ?? '-',
            createdAt: new Date().toISOString(),
          };
          this.auditLogStore.append(log);
        } catch (err) {
          console.error('[audit] append failed', err);
        }
      });
      next();
    };
  }
}
