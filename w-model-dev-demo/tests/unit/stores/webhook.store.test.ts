import { describe, it, expect, beforeEach } from 'vitest';
import { WebhookStore } from '../../../src/stores/webhook.store.js';

describe('WebhookStore', () => {
  let store: WebhookStore;
  beforeEach(() => { store = new WebhookStore(); });

  it('register + findById + list 正常往返', () => {
    const w = store.register({ url: 'https://x.com', events: ['article.created'], secret: 's1234567' });
    expect(w.id).toBeTruthy();
    expect(w.active).toBe(true);
    expect(store.findById(w.id)?.url).toBe('https://x.com');
    expect(store.list()).toHaveLength(1);
  });

  it('listByEvent 仅返回 active + 事件匹配的 webhook', () => {
    const w1 = store.register({ url: 'https://1.com', events: ['a'], secret: 's1234567' });
    const w2 = store.register({ url: 'https://2.com', events: ['b'], secret: 's1234567' });
    expect(store.listByEvent('a')).toHaveLength(1);
    expect(store.listByEvent('a')[0]!.id).toBe(w1.id);
    expect(store.listByEvent('b')[0]!.id).toBe(w2.id);
  });

  it('createDelivery + updateDelivery 状态机', () => {
    const d = store.createDelivery({ webhookId: 'w1', event: 'a', payload: {} });
    expect(d.status).toBe('pending');
    expect(d.attempt).toBe(1);
    const updated = store.updateDelivery(d.id, { status: 'success', attempt: 2 });
    expect(updated.status).toBe('success');
    expect(updated.attempt).toBe(2);
  });

  it('computeNextRetry: attempt >= MAX_RETRIES 返回 null', () => {
    expect(store.computeNextRetry(3)).toBeNull();
    expect(store.computeNextRetry(4)).toBeNull();
  });

  it('computeNextRetry: attempt < MAX_RETRIES 返回时间戳', () => {
    expect(store.computeNextRetry(1)).not.toBeNull();
  });

  it('unregister + clear', () => {
    const w = store.register({ url: 'https://x.com', events: ['a'], secret: 's1234567' });
    expect(store.unregister(w.id)).toBe(true);
    expect(store.unregister(w.id)).toBe(false);
    store.register({ url: 'https://y.com', events: ['a'], secret: 's1234567' });
    store.clear();
    expect(store.list()).toHaveLength(0);
  });
});
