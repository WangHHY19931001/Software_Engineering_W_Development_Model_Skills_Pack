// SD-011 NotificationService.

import { NotificationType, type Notification, type NotificationSettings } from '../types.js';
import type { NotificationStore } from '../stores/notification.store.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { notificationSettingsSchema } from '../utils/schemas.js';

export class NotificationService {
  constructor(private notificationStore: NotificationStore) {}

  /** enqueueNotification — TLA+ L2_interaction.enqueueNotification */
  enqueueNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    refId: string,
  ): Notification | null {
    return this.notificationStore.create(userId, type, title, body, refId);
  }

  /** create — alias matching SD-011 design. */
  create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    refId: string,
  ): Notification | null {
    return this.enqueueNotification(userId, type, title, body, refId);
  }

  /** markNotificationRead — TLA+ L2_interaction.markNotificationRead */
  markNotificationRead(userId: string, notificationId: string): void {
    this.notificationStore.markRead(userId, notificationId);
  }

  markRead(userId: string, notificationId: string): void {
    this.markNotificationRead(userId, notificationId);
  }

  markAllRead(userId: string): void {
    this.notificationStore.markAllRead(userId);
  }

  /** updateNotificationSetting — TLA+ L2_interaction.updateNotificationSetting */
  updateNotificationSetting(userId: string, settings: Partial<NotificationSettings>): NotificationSettings {
    if (!notificationSettingsSchema.safeParse(settings).success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    return this.notificationStore.updateSettings(userId, settings);
  }

  listByUser(userId: string): Notification[] {
    return this.notificationStore.listByUser(userId);
  }

  unreadSize(userId: string): number {
    return this.notificationStore.unreadSize(userId);
  }
}
