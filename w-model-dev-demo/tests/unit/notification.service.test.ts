// SD-011 NotificationService unit tests (TC-UNIT-049 ~ 053).
// NotificationService is a thin delegation layer over NotificationStore.
// These tests verify delegation behavior, validation, and TLA+ L2_interaction coverage.

import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationStore } from '../../src/stores/notification.store.js';
import { NotificationService } from '../../src/services/notification.service.js';
import { NotificationType } from '../../src/types.js';
import { AppError } from '../../src/utils/errors.js';

describe('SD-011 NotificationService (TC-UNIT-049 ~ 053)', () => {
  let store: NotificationStore;
  let service: NotificationService;

  beforeEach(() => {
    store = new NotificationStore();
    service = new NotificationService(store);
  });

  it('TC-UNIT-049: enqueueNotification creates notification and returns it', () => {
    const notif = service.enqueueNotification(
      'u-1',
      NotificationType.Comment,
      'title-1',
      'body-1',
      'ref-1',
    );
    expect(notif).not.toBeNull();
    expect(notif!.userId).toBe('u-1');
    expect(notif!.type).toBe(NotificationType.Comment);
    expect(notif!.read).toBe(false);
    expect(store.unreadSize('u-1')).toBe(1);
  });

  it('TC-UNIT-050: create (alias) delegates to enqueueNotification', () => {
    const notif = service.create(
      'u-1',
      NotificationType.Like,
      'liked your article',
      'body',
      'ref-2',
    );
    expect(notif).not.toBeNull();
    expect(notif!.type).toBe(NotificationType.Like);
  });

  it('TC-UNIT-051: markNotificationRead marks a single notification read', () => {
    const notif = service.enqueueNotification(
      'u-1',
      NotificationType.System,
      'title',
      'body',
      'ref-3',
    );
    expect(store.unreadSize('u-1')).toBe(1);

    service.markNotificationRead('u-1', notif!.id);

    const updated = store.getById(notif!.id);
    expect(updated?.read).toBe(true);
    expect(store.unreadSize('u-1')).toBe(0);
  });

  it('TC-UNIT-052: updateNotificationSetting with invalid settings throws 1001', () => {
    // Pass an object that fails notificationSettingsSchema (e.g. wrong types).
    expect(() =>
      service.updateNotificationSetting('u-1', { comment: 'not-a-boolean' } as unknown as {
        comment: boolean;
      }),
    ).toThrow(AppError);
    try {
      service.updateNotificationSetting('u-1', { comment: 'not-a-boolean' } as unknown as {
        comment: boolean;
      });
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }
  });

  it('TC-UNIT-053: listByUser + unreadSize + markAllRead compose correctly', () => {
    // Seed 3 notifications across types.
    service.enqueueNotification('u-1', NotificationType.Comment, 't1', 'b1', 'r1');
    service.enqueueNotification('u-1', NotificationType.Like, 't2', 'b2', 'r2');
    service.enqueueNotification('u-1', NotificationType.System, 't3', 'b3', 'r3');

    expect(service.unreadSize('u-1')).toBe(3);
    expect(service.listByUser('u-1')).toHaveLength(3);

    service.markAllRead('u-1');

    expect(service.unreadSize('u-1')).toBe(0);
    const list = service.listByUser('u-1');
    expect(list.every((n) => n.read)).toBe(true);
  });
});
