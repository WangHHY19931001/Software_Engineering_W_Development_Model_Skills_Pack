import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationService, PushService } from '../../../src/services/notification.service.js';
import { NotificationStore } from '../../../src/stores/notification.store.js';
import { WsStore } from '../../../src/stores/ws.store.js';

describe('NotificationService', () => {
  let store: NotificationStore;
  let svc: NotificationService;
  beforeEach(() => { store = new NotificationStore(); svc = new NotificationService(store); });

  it('notify + listByUser 正常往返', () => {
    svc.notify('u1', 'comment', 'hello');
    const r = svc.listByUser('u1', 1, 10);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.content).toBe('hello');
  });

  it('markRead 标记已读', () => {
    const n = svc.notify('u1', 'x', 'y');
    expect(svc.markRead(n.id)).toBe(true);
  });
});

describe('PushService', () => {
  let wsStore: WsStore;
  let svc: PushService;
  beforeEach(() => { wsStore = new WsStore(); svc = new PushService(wsStore); });

  it('pushToUser 推送给指定用户的连接', () => {
    let received = '';
    wsStore.add({ id: 'c1', userId: 'u1', send: (d) => { received = d; }, createdAt: '' });
    const n = svc.pushToUser('u1', 'hello');
    expect(n).toBe(1);
    expect(received).toContain('hello');
  });

  it('broadcast 推送给所有连接', () => {
    wsStore.add({ id: 'c1', userId: 'u1', send: () => {}, createdAt: '' });
    wsStore.add({ id: 'c2', userId: 'u2', send: () => {}, createdAt: '' });
    expect(svc.broadcast('hi')).toBe(2);
  });
});
