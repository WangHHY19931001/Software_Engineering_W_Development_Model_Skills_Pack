import { describe, it, expect, beforeEach } from 'vitest';
import { PasswordResetStore } from '../../../src/stores/password-reset.store.js';
import { NotFoundError, ValidationError } from '../../../src/utils/errors.js';

describe('PasswordResetStore (DD-016-003 / L4_password_reset_token_lifecycle)', () => {
  let store: PasswordResetStore;
  beforeEach(() => { store = new PasswordResetStore(); });

  it('TC-UNIT-048N: insert + findByToken + markUsable', () => {
    store.insert({ token: 'tok1', userId: 'u1', expiresAt: '2099-01-01T00:00:00Z' });
    expect(store.findByToken('tok1')?.userId).toBe('u1');
    store.markUsed('tok1');
    expect(store.findByToken('tok1')?.used).toBe(true);
  });

  it('TC-UNIT-048E: markUsed 不存在抛 NotFoundError', () => {
    expect(() => store.markUsed('missing')).toThrow(NotFoundError);
  });

  it('TC-UNIT-048B: markUsed 已使用抛 ValidationError（OneTimeUse）', () => {
    store.insert({ token: 'tok1', userId: 'u1', expiresAt: '2099-01-01T00:00:00Z' });
    store.markUsed('tok1');
    expect(() => store.markUsed('tok1')).toThrow(ValidationError);
  });

  it('cleanupExpired 清理过期 token', () => {
    store.insert({ token: 'old', userId: 'u1', expiresAt: '2020-01-01T00:00:00Z' });
    store.insert({ token: 'new', userId: 'u1', expiresAt: '2099-01-01T00:00:00Z' });
    const removed = store.cleanupExpired(new Date('2026-07-26T00:00:00Z'));
    expect(removed).toBe(1);
    expect(store.size()).toBe(1);
  });

  it('findByUser 返回该用户所有 token', () => {
    store.insert({ token: 't1', userId: 'u1', expiresAt: '2099-01-01T00:00:00Z' });
    store.insert({ token: 't2', userId: 'u1', expiresAt: '2099-01-01T00:00:00Z' });
    store.insert({ token: 't3', userId: 'u2', expiresAt: '2099-01-01T00:00:00Z' });
    expect(store.findByUser('u1')).toHaveLength(2);
  });

  it('assertOneTimeUse: 已使用抛错', () => {
    store.insert({ token: 't1', userId: 'u1', expiresAt: '2099-01-01T00:00:00Z' });
    store.markUsed('t1');
    expect(() => store.assertOneTimeUse('t1')).toThrow(ValidationError);
  });
});
