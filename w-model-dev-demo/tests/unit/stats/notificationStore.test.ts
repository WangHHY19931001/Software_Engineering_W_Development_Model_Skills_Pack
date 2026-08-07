/**
 * UT-035 通知列表未读过滤（NotificationStore.listByUser，DD-035/INTF-020）
 */
import { describe, it, expect } from 'vitest';
import { NotificationStore } from '../../../src/stores/notificationStore';

function makeNotification(id: string, read: boolean) {
  return { id, userId: 'u_0001', type: 'REPLY' as const, articleId: 'a_1001', actorId: 'u_0002', actorName: 'x', content: 'c', read, createdAt: `2026-08-07T10:00:${String(Number(id.slice(-1))).padStart(2, '0')}Z` };
}

describe('UT-035 NotificationStore.listByUser', () => {
  it('unreadOnly=true 仅返回未读；false 返回全量', () => {
    const store = new NotificationStore();
    store.create(makeNotification('n1', false));
    store.create(makeNotification('n2', false));
    store.create(makeNotification('n3', true));

    const unread = store.listByUser('u_0001', 1, 20, true);
    expect(unread.total).toBe(2);
    expect(unread.items.every((n) => n.read === false)).toBe(true);

    const all = store.listByUser('u_0001', 1, 20, false);
    expect(all.total).toBe(3);
  });

  it('create / findById / markRead（已读幂等更新）', () => {
    const store = new NotificationStore();
    const created = store.create({ id: 'n_1', userId: 'u_0001', type: 'REPLY', articleId: 'a_1', actorId: 'u_2', actorName: 'x', content: 'c', read: false, createdAt: '2026-08-07T10:00:00.000Z' });
    expect(created.id).toBe('n_1');
    expect(store.findById('n_1')?.read).toBe(false);
    const marked = store.markRead('n_1');
    expect(marked?.read).toBe(true);
    expect(store.markRead('n_9999')).toBeNull(); // 不存在返回 null
  });
});
