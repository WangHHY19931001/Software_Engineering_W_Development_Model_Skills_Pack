import { describe, it, expect, beforeEach } from 'vitest';
import { SubscriptionStore } from '../../../src/stores/subscription.store.js';
import { ConflictError } from '../../../src/utils/errors.js';

describe('SubscriptionStore', () => {
  let store: SubscriptionStore;
  beforeEach(() => { store = new SubscriptionStore(); });

  it('subscribe + list 正常往返', () => {
    const s = store.subscribe('a@b.com');
    expect(s.id).toBeTruthy();
    expect(store.list()).toHaveLength(1);
  });

  it('subscribe 重复邮箱抛 ConflictError', () => {
    store.subscribe('a@b.com');
    expect(() => store.subscribe('A@B.com')).toThrow(ConflictError);
  });

  it('unsubscribe 返回布尔', () => {
    store.subscribe('a@b.com');
    expect(store.unsubscribe('a@b.com')).toBe(true);
    expect(store.unsubscribe('a@b.com')).toBe(false);
  });
});
