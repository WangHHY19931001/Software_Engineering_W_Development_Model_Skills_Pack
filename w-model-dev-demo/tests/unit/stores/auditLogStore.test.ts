/**
 * UT-049 审计日志保留 90 天清理（AuditLogStore，DD-049/CON-004）
 */
import { describe, it, expect } from 'vitest';
import { AuditLogStore } from '../../../src/stores/auditLogStore';

describe('UT-049 AuditLogStore', () => {
  it('append 落库 + prune 按 createdAt 删除 90 天前记录（≥90 天保留策略）', () => {
    const now = Date.parse('2026-08-07T10:00:00.000Z');
    const store = new AuditLogStore();
    store.append({ actionType: 'login', actorId: 'u_0001', resourceType: 'auth', resourceId: null, result: 'success', httpStatus: 200, clientIp: '127.0.0.1', requestId: 'r1', createdAt: new Date(now - 91 * 86400000).toISOString() });
    store.append({ actionType: 'login', actorId: 'u_0001', resourceType: 'auth', resourceId: null, result: 'success', httpStatus: 200, clientIp: '127.0.0.1', requestId: 'r2', createdAt: new Date(now - 30 * 86400000).toISOString() });

    const removed = store.prune(new Date(now - 90 * 86400000));
    expect(removed).toBe(1);

    const remaining = store.list();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].requestId).toBe('r2');

    // 过滤查询
    const filtered = store.list({ actionType: 'login', actorId: 'u_0001' });
    expect(filtered).toHaveLength(1);
  });
});
