/**
 * NotificationStore — 通知存储。
 */
import type { Notification } from '../types.js';
import { generateId } from '../utils/id.js';
import { PaginationUtil } from '../utils/pagination.js';

export class NotificationStore {
  private notifications: Map<string, Notification> = new Map();
  private userIndex: Map<string, Set<string>> = new Map();

  insert(notification: Omit<Notification, 'id' | 'createdAt' | 'read'> & {
    id?: string; read?: boolean;
  }): Notification {
    const record: Notification = {
      id: notification.id ?? generateId('notif'),
      userId: notification.userId,
      type: notification.type,
      content: notification.content,
      read: notification.read ?? false,
      createdAt: new Date().toISOString(),
    };
    this.notifications.set(record.id, record);
    let set = this.userIndex.get(record.userId);
    if (!set) {
      set = new Set();
      this.userIndex.set(record.userId, set);
    }
    set.add(record.id);
    return record;
  }

  listByUser(userId: string, page: number = 1, limit: number = 10): {
    items: Notification[]; total: number; page: number; limit: number;
  } {
    const ids = this.userIndex.get(userId);
    let items: Notification[] = [];
    if (ids) {
      for (const id of ids) {
        const n = this.notifications.get(id);
        if (n) items.push(n);
      }
    }
    items = PaginationUtil.sort(items, 'createdAt', 'desc');
    return PaginationUtil.paginate(items, page, limit);
  }

  markRead(id: string): boolean {
    const n = this.notifications.get(id);
    if (!n) return false;
    n.read = true;
    return true;
  }

  size(): number {
    return this.notifications.size;
  }

  clear(): void {
    this.notifications.clear();
    this.userIndex.clear();
  }
}
