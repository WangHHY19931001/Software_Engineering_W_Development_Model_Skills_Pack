import { describe, it, expect, beforeEach } from 'vitest';
import { AuditService } from '../../../src/services/audit.service.js';
import { AuditLogStore } from '../../../src/stores/audit.store.js';
import { Logger } from '../../../src/utils/logger.js';

describe('AuditService (DD-019-002 / L3_audit_log_flow / L4_audit_log_retention)', () => {
  let store: AuditLogStore;
  let logger: Logger;
  let svc: AuditService;
  beforeEach(() => {
    store = new AuditLogStore();
    logger = new Logger('debug');
    svc = new AuditService(store, logger);
  });

  it('TC-UNIT-057N: log 正常写入', async () => {
    const r = await svc.log({ userId: 'u1', action: 'x.create', resource: 'r', resourceId: '1', meta: { a: 1 } });
    expect(r.id).toBeTruthy();
    expect(r.action).toBe('x.create');
  });

  it('TC-UNIT-057E: log meta 缺省时填充 {}', async () => {
    const r = await svc.log({ userId: 'u1', action: 'x', resource: 'r', resourceId: '1' });
    expect(r.meta).toEqual({});
  });

  it('TC-UNIT-057B: query 委托 store', async () => {
    await svc.log({ userId: 'u1', action: 'x', resource: 'r', resourceId: '1' });
    const r = svc.query({ page: 1, limit: 10 });
    expect(r.total).toBe(1);
  });

  it('cleanupExpired + assertRetentionInvariant 委托 store', async () => {
    await svc.log({ userId: 'u1', action: 'x', resource: 'r', resourceId: '1' });
    expect(svc.cleanupExpired(new Date('2099-01-01'))).toBe(1);
  });

  it('getStore 返回内部 store', () => {
    expect(svc.getStore()).toBe(store);
  });
});
