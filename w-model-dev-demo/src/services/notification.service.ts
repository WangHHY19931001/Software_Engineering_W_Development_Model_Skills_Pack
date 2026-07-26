/**
 * NotificationService + PushService — 通知与推送。
 */
import type { Notification } from '../types.js';
import type { NotificationStore } from '../stores/notification.store.js';
import type { WsStore } from '../stores/ws.store.js';
import { generateId } from '../utils/id.js';

export class NotificationService {
  constructor(private notificationStore: NotificationStore) {}

  notify(userId: string, type: string, content: string): Notification {
    return this.notificationStore.insert({ userId, type, content });
  }

  listByUser(userId: string, page: number = 1, limit: number = 10) {
    return this.notificationStore.listByUser(userId, page, limit);
  }

  markRead(id: string): boolean {
    return this.notificationStore.markRead(id);
  }
}

export class PushService {
  constructor(private wsStore: WsStore) {}

  pushToUser(userId: string, message: string): number {
    return this.wsStore.sendToUser(userId, JSON.stringify({ id: generateId('push'), message, timestamp: new Date().toISOString() }));
  }

  broadcast(message: string): number {
    return this.wsStore.broadcast(JSON.stringify({ id: generateId('push'), message, timestamp: new Date().toISOString() }));
  }
}
