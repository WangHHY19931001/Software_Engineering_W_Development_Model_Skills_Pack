// SD-011 NotificationStore.

import { NotificationType, type Notification, type NotificationSettings } from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `n-${counter}`;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  comment: true,
  like: true,
  follow: true,
  system: true,
  subscription: true,
};

export class NotificationStore {
  private notifications = new Map<string, Notification>();
  private userIdToNotifications = new Map<string, Set<string>>();
  private userIdUnread = new Map<string, Set<string>>();
  private settings = new Map<string, NotificationSettings>();

  size(): number {
    return this.notifications.size;
  }

  unreadSize(userId: string): number {
    const set = this.userIdUnread.get(userId);
    return set ? set.size : 0;
  }

  getById(id: string): Notification | null {
    return this.notifications.get(id) ?? null;
  }

  getSettings(userId: string): NotificationSettings {
    const s = this.settings.get(userId);
    return s ? { ...s } : { ...DEFAULT_NOTIFICATION_SETTINGS };
  }

  updateSettings(userId: string, patch: Partial<NotificationSettings>): NotificationSettings {
    const current = this.getSettings(userId);
    const updated: NotificationSettings = { ...current, ...patch };
    this.settings.set(userId, updated);
    return { ...updated };
  }

  isTypeEnabled(userId: string, type: NotificationType): boolean {
    const s = this.getSettings(userId);
    switch (type) {
      case NotificationType.Comment:
        return s.comment;
      case NotificationType.Like:
        return s.like;
      case NotificationType.Follow:
        return s.follow;
      case NotificationType.System:
        return s.system;
      case NotificationType.Subscription:
        return s.subscription;
      default:
        return false;
    }
  }

  create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    refId: string,
  ): Notification | null {
    if (!title || !body) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    if (!this.isTypeEnabled(userId, type)) {
      // Per TC-UNIT-046: when type disabled, reject (1001) or return null.
      return null;
    }
    const now = new Date();
    const notif: Notification = {
      id: nextId(),
      userId,
      type,
      title,
      body,
      refId,
      read: false,
      createdAt: now,
      updatedAt: now,
    };
    this.notifications.set(notif.id, notif);
    this.indexAdd(this.userIdToNotifications, userId, notif.id);
    this.indexAdd(this.userIdUnread, userId, notif.id);
    return { ...notif };
  }

  markRead(userId: string, notificationId: string): void {
    const n = this.notifications.get(notificationId);
    if (!n || n.userId !== userId) {
      throw new AppError(ErrorCode.NotFound, '1031');
    }
    if (n.read) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    n.read = true;
    n.updatedAt = new Date();
    this.indexRemove(this.userIdUnread, userId, notificationId);
  }

  markAllRead(userId: string): void {
    const set = this.userIdUnread.get(userId);
    if (!set) return;
    for (const id of set) {
      const n = this.notifications.get(id);
      if (n) {
        n.read = true;
        n.updatedAt = new Date();
      }
    }
    set.clear();
  }

  listByUser(userId: string): Notification[] {
    const set = this.userIdToNotifications.get(userId);
    if (!set) return [];
    const out: Notification[] = [];
    for (const id of set) {
      const n = this.notifications.get(id);
      if (n) out.push({ ...n });
    }
    return out;
  }

  private indexAdd<K>(map: Map<K, Set<string>>, key: K, value: string): void {
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(value);
  }

  private indexRemove<K>(map: Map<K, Set<string>>, key: K, value: string): void {
    const set = map.get(key);
    if (!set) return;
    set.delete(value);
    if (set.size === 0) map.delete(key);
  }

  clear(): void {
    this.notifications.clear();
    this.userIdToNotifications.clear();
    this.userIdUnread.clear();
    this.settings.clear();
  }
}
