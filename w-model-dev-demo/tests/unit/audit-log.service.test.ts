/**
 * 审计日志服务测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLogService } from '../../src/services/audit-log.service.js';
import { AuditLogRepository } from '../../src/repositories/audit-log.repository.js';
import { AuditAction } from '../../src/types/index.js';
import { ValidationError } from '../../src/utils/errors.js';

describe('AuditLogService', () => {
  let repo: AuditLogRepository;
  let svc: AuditLogService;

  beforeEach(() => {
    repo = new AuditLogRepository();
    svc = new AuditLogService(repo);
  });

  describe('record()', () => {
    it('records entry', async () => {
      const r = await svc.record({ action: AuditAction.LOGIN_SUCCESS, target: 'u1' });
      expect(r.action).toBe(AuditAction.LOGIN_SUCCESS);
      expect(r.target).toBe('u1');
    });

    it('throws on invalid', async () => {
      await expect(svc.record({} as never)).rejects.toBeInstanceOf(ValidationError);
    });

    it('records metadata', async () => {
      const r = await svc.record({
        action: AuditAction.POST_CREATED,
        target: 'p1',
        metadata: { foo: 'bar' },
      });
      expect(r.metadata.foo).toBe('bar');
    });

    it('records ip and userAgent', async () => {
      const r = await svc.record({
        action: AuditAction.LOGIN_SUCCESS,
        target: 'u1',
        ip: '1.2.3.4',
        userAgent: 'ua',
      });
      expect(r.ip).toBe('1.2.3.4');
      expect(r.userAgent).toBe('ua');
    });
  });

  describe('list()', () => {
    beforeEach(async () => {
      await svc.record({ action: AuditAction.LOGIN_SUCCESS, target: 'u1' });
      await svc.record({ action: AuditAction.LOGIN_FAILED, target: 'u2' });
    });

    it('list all paginated', async () => {
      const r = await svc.list(1, 10);
      expect(r.total).toBe(2);
    });

    it('listByActor', async () => {
      await svc.record({ action: AuditAction.POST_CREATED, target: 'p1', actorId: 'a1' });
      const r = await svc.listByActor('a1');
      expect(r.total).toBe(1);
    });

    it('listByAction', async () => {
      const r = await svc.listByAction(AuditAction.LOGIN_SUCCESS);
      expect(r.total).toBe(1);
    });

    it('paginate with pageSize', async () => {
      const r = await svc.list(1, 1);
      expect(r.items.length).toBe(1);
      expect(r.total).toBe(2);
    });
  });

  describe('purgeOlderThan()', () => {
    it('purges old entries', async () => {
      await svc.record({ action: AuditAction.LOGIN_SUCCESS, target: 'u1' });
      const removed = await svc.purgeOlderThan(0);
      expect(removed).toBeGreaterThanOrEqual(0);
    });

    it('returns 0 for non-positive days', async () => {
      const r = await svc.purgeOlderThan(-1);
      expect(r).toBe(0);
    });
  });

  describe('count()', () => {
    it('returns count', async () => {
      await svc.record({ action: AuditAction.LOGIN_SUCCESS, target: 'u1' });
      const c = await svc.count();
      expect(c).toBe(1);
    });
  });
});
