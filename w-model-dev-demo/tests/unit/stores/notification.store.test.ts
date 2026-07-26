import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NotificationStore } from '../../../src/stores/notification.store.js';

describe('NotificationStore', () => {
  let store: NotificationStore;
  beforeEach(() => { store = new NotificationStore(); });
  afterEach(() => { vi.useRealTimers(); });

  it('insert + listByUser 正常往返', () => {
    store.insert({ userId: 'u1', type: 'comment', content: 'hi' });
    store.insert({ userId: 'u1', type: 'like', content: 'hello' });
    store.insert({ userId: 'u2', type: 'system', content: 'welcome' });
    const r = store.listByUser('u1', 1, 10);
    expect(r.items).toHaveLength(2);
    expect(r.total).toBe(2);
  });

  it('listByUser 按 createdAt desc 排序', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-26T00:00:00.000Z'));
    store.insert({ userId: 'u1', type: 'a', content: 'first' });
    vi.setSystemTime(new Date('2026-07-26T00:00:01.000Z'));
    store.insert({ userId: 'u1', type: 'b', content: 'second' });
    const items = store.listByUser('u1', 1, 10).items;
    // 后插入的 createdAt > 先的，desc 排序应 second 在前
    expect(items[0]!.content).toBe('second');
  });

  it('markRead 标记已读', () => {
    const n = store.insert({ userId: 'u1', type: 'x', content: 'y' });
    expect(store.markRead(n.id)).toBe(true);
    expect(store.markRead('missing')).toBe(false);
  });

  it('clear 清空', () => {
    store.insert({ userId: 'u1', type: 'x', content: 'y' });
    store.clear();
    expect(store.size()).toBe(0);
  });
});
