import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLogStore } from '../../../src/stores/audit.store.js';
import { NotFoundError } from '../../../src/utils/errors.js';

describe('AuditLogStore (DD-019-003 / L4_audit_log_retention)', () => {
  let store: AuditLogStore;
  beforeEach(() => { store = new AuditLogStore(); });

  it('TC-UNIT-057N: insert + query 正常往返', () => {
    store.insert({ userId: 'u1', action: 'post.create', resource: 'article', resourceId: 'a1', meta: {} });
    const r = store.query({ page: 1, limit: 10 });
    expect(r.items).toHaveLength(1);
    expect(r.total).toBe(1);
  });

  it('TC-UNIT-057E: query 按 action 模糊匹配 + startTime 过滤', () => {
    store.insert({ userId: 'u1', action: 'post.create', resource: 'article', resourceId: 'a1', meta: {}, timestamp: '2026-07-01T00:00:00Z' });
    store.insert({ userId: 'u1', action: 'post.update', resource: 'article', resourceId: 'a2', meta: {}, timestamp: '2026-07-26T00:00:00Z' });
    const r = store.query({ page: 1, limit: 10, action: 'post', startTime: '2026-07-15T00:00:00Z' });
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.action).toBe('post.update');
  });

  it('TC-UNIT-057B: cleanupExpired 清理 90 天前日志（Retention90Days 不变式）', () => {
    store.insert({ userId: 'u1', action: 'old', resource: 'r', resourceId: '1', meta: {}, timestamp: '2026-01-01T00:00:00Z' });
    store.insert({ userId: 'u1', action: 'new', resource: 'r', resourceId: '2', meta: {}, timestamp: '2026-07-26T00:00:00Z' });
    const now = new Date('2026-07-26T00:00:00Z');
    const removed = store.cleanupExpired(now);
    expect(removed).toBe(1);
    expect(store.size()).toBe(1);
  });

  it('assertRetentionInvariant: 存在过期日志抛错', () => {
    store.insert({ userId: 'u1', action: 'old', resource: 'r', resourceId: '1', meta: {}, timestamp: '2026-01-01T00:00:00Z' });
    expect(() => store.assertRetentionInvariant(new Date('2026-07-26T00:00:00Z'))).toThrow();
  });

  it('query 按 userId 过滤', () => {
    store.insert({ userId: 'u1', action: 'x', resource: 'r', resourceId: '1', meta: {} });
    store.insert({ userId: 'u2', action: 'y', resource: 'r', resourceId: '2', meta: {} });
    expect(store.query({ page: 1, limit: 10, userId: 'u1' }).total).toBe(1);
  });

  it('query 按 resource 精确匹配', () => {
    store.insert({ userId: 'u1', action: 'x', resource: 'article', resourceId: '1', meta: {} });
    store.insert({ userId: 'u2', action: 'y', resource: 'comment', resourceId: '2', meta: {} });
    expect(store.query({ page: 1, limit: 10, resource: 'article' }).total).toBe(1);
  });
});
