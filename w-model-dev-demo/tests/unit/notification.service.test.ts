/**
 * 通知服务测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationService } from '../../src/services/notification.service.js';
import { NotificationRepository } from '../../src/repositories/notification.repository.js';
import { NotificationType } from '../../src/types/index.js';
import { NotFoundError, ValidationError } from '../../src/utils/errors.js';

describe('NotificationService', () => {
  let repo: NotificationRepository;
  let svc: NotificationService;

  beforeEach(() => {
    repo = new NotificationRepository();
    svc = new NotificationService(repo);
  });

  describe('create()', () => {
    it('should create a notification', async () => {
      const n = await svc.create({
        recipientId: 'u1',
        type: NotificationType.COMMENT_ON_POST,
        title: 't',
        content: 'c',
      });
      expect(n.recipientId).toBe('u1');
      expect(n.read).toBe(false);
    });

    it('should throw ValidationError on missing fields', async () => {
      await expect(svc.create({} as never)).rejects.toBeInstanceOf(ValidationError);
    });

    it('should throw ValidationError on invalid type', async () => {
      await expect(
        svc.create({ recipientId: 'u', type: 'invalid' as never, title: 't', content: 'c' })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('should accept payload', async () => {
      const n = await svc.create({
        recipientId: 'u1',
        type: NotificationType.LIKE,
        title: 't',
        content: 'c',
        payload: { postId: 'p1' },
      });
      expect(n.payload.postId).toBe('p1');
    });
  });

  describe('notify*() helpers', () => {
    it('notifyComment creates COMMENT_ON_POST', async () => {
      const n = await svc.notifyComment('u1', 'u2', 'p1', 'Title');
      expect(n.type).toBe(NotificationType.COMMENT_ON_POST);
    });

    it('notifyCommentReply creates COMMENT_REPLY', async () => {
      const n = await svc.notifyCommentReply('u1', 'u2', 'p1', 'T');
      expect(n.type).toBe(NotificationType.COMMENT_REPLY);
    });

    it('notifyFollow creates FOLLOW', async () => {
      const n = await svc.notifyFollow('u1', 'u2');
      expect(n.type).toBe(NotificationType.FOLLOW);
    });

    it('notifyLike creates LIKE', async () => {
      const n = await svc.notifyLike('u1', 'u2', 'p1', 'T');
      expect(n.type).toBe(NotificationType.LIKE);
    });

    it('notifyFavorite creates FAVORITE', async () => {
      const n = await svc.notifyFavorite('u1', 'u2', 'p1', 'T');
      expect(n.type).toBe(NotificationType.FAVORITE);
    });

    it('notifyPostPublished creates POST_PUBLISHED', async () => {
      const n = await svc.notifyPostPublished('u1', 'u2', 'p1', 'T');
      expect(n.type).toBe(NotificationType.POST_PUBLISHED);
    });
  });

  describe('list*()', () => {
    beforeEach(async () => {
      await svc.create({ recipientId: 'u1', type: NotificationType.LIKE, title: 't1', content: 'c1' });
      await svc.create({ recipientId: 'u1', type: NotificationType.COMMENT_ON_POST, title: 't2', content: 'c2' });
      await svc.create({ recipientId: 'u2', type: NotificationType.LIKE, title: 't3', content: 'c3' });
    });

    it('listByRecipient returns paginated', async () => {
      const r = await svc.listByRecipient('u1', 1, 10);
      expect(r.total).toBe(2);
      expect(r.items.length).toBe(2);
    });

    it('listUnread returns unread only', async () => {
      const r = await svc.listUnread('u1');
      expect(r.length).toBe(2);
    });
  });

  describe('markRead/markAllRead', () => {
    it('markRead marks one as read', async () => {
      const n = await svc.create({ recipientId: 'u1', type: NotificationType.LIKE, title: 't', content: 'c' });
      const r = await svc.markRead(n.id);
      expect(r.read).toBe(true);
    });

    it('markRead throws on missing', async () => {
      await expect(svc.markRead('missing')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('markAllRead marks all', async () => {
      await svc.create({ recipientId: 'u1', type: NotificationType.LIKE, title: 't1', content: 'c1' });
      await svc.create({ recipientId: 'u1', type: NotificationType.COMMENT_ON_POST, title: 't2', content: 'c2' });
      const count = await svc.markAllRead('u1');
      expect(count).toBe(2);
    });

    it('countUnread returns count', async () => {
      await svc.create({ recipientId: 'u1', type: NotificationType.LIKE, title: 't', content: 'c' });
      const c = await svc.countUnread('u1');
      expect(c).toBe(1);
    });
  });

  describe('delete()', () => {
    it('deletes notification', async () => {
      const n = await svc.create({ recipientId: 'u1', type: NotificationType.LIKE, title: 't', content: 'c' });
      const r = await svc.delete(n.id);
      expect(r).toBe(true);
    });

    it('returns false for missing', async () => {
      const r = await svc.delete('missing');
      expect(r).toBe(false);
    });
  });
});
