// SD-011 NotificationStore unit tests (TC-UNIT-045 ~ TC-UNIT-048).

import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationStore } from '../../src/stores/notification.store.js';
import { NotificationType } from '../../src/types.js';
import { AppError } from '../../src/utils/errors.js';

describe('SD-011 NotificationStore (TC-UNIT-045 ~ 048)', () => {
  let store: NotificationStore;

  beforeEach(() => {
    store = new NotificationStore();
  });

  it('TC-UNIT-045: created notification is unread and indexed in userIdUnread', () => {
    const notif = store.create('u-1', NotificationType.Comment, 'title', 'body', 'ref-1');
    expect(notif).not.toBeNull();
    expect(notif!.read).toBe(false);
    expect(store.unreadSize('u-1')).toBe(1);
  });

  it('TC-UNIT-046: disabled notification type returns null', () => {
    store.updateSettings('u-1', { comment: false });
    const notif = store.create('u-1', NotificationType.Comment, 'title', 'body', 'ref-1');
    expect(notif).toBeNull();
  });

  it('TC-UNIT-047: markRead marks a single notification and removes from unread set', () => {
    const notif = store.create('u-1', NotificationType.Comment, 'title', 'body', 'ref-1');
    expect(notif).not.toBeNull();
    expect(store.unreadSize('u-1')).toBe(1);

    store.markRead('u-1', notif!.id);

    const updated = store.getById(notif!.id);
    expect(updated?.read).toBe(true);
    expect(store.unreadSize('u-1')).toBe(0);
  });

  it('TC-UNIT-048: markAllRead clears all unread notifications for user', () => {
    for (let i = 0; i < 5; i++) {
      store.create('u-1', NotificationType.System, `title-${i}`, `body-${i}`, `ref-${i}`);
    }
    expect(store.unreadSize('u-1')).toBe(5);

    store.markAllRead('u-1');

    expect(store.unreadSize('u-1')).toBe(0);
  });
});
