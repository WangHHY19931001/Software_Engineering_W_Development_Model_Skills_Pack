/**
 * 通知服务 - 事件触发
 */
import { z } from 'zod';
import { NotificationRepository } from '../repositories/notification.repository.js';
import { generateId } from '../utils/id.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import {
  NotificationType,
  type Notification,
  type PaginatedResult,
} from '../types/index.js';

export const CreateNotificationSchema = z.object({
  recipientId: z.string().min(1),
  type: z.nativeEnum(NotificationType),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(2000),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});

export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;

export class NotificationService {
  constructor(private readonly notificationRepo: NotificationRepository) {}

  async create(input: CreateNotificationInput): Promise<Notification> {
    const parsed = CreateNotificationSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid notification data', { issues: parsed.error.issues });
    }
    const notification: Notification = {
      id: generateId('notif'),
      recipientId: parsed.data.recipientId,
      type: parsed.data.type,
      title: parsed.data.title,
      content: parsed.data.content,
      payload: parsed.data.payload ?? {},
      read: false,
      createdAt: Date.now(),
    };
    await this.notificationRepo.create(notification);
    return notification;
  }

  async notifyComment(
    recipientId: string,
    actorId: string,
    postId: string,
    postTitle: string,
  ): Promise<Notification> {
    return this.create({
      recipientId,
      type: NotificationType.COMMENT_ON_POST,
      title: '新评论',
      content: `您的文章《${postTitle}》收到新评论`,
      payload: { actorId, postId },
    });
  }

  async notifyCommentReply(
    recipientId: string,
    actorId: string,
    postId: string,
    postTitle: string,
  ): Promise<Notification> {
    return this.create({
      recipientId,
      type: NotificationType.COMMENT_REPLY,
      title: '评论回复',
      content: `您的评论收到新回复：${postTitle}`,
      payload: { actorId, postId },
    });
  }

  async notifyFollow(
    recipientId: string,
    followerId: string,
  ): Promise<Notification> {
    return this.create({
      recipientId,
      type: NotificationType.FOLLOW,
      title: '新粉丝',
      content: '您有一位新的粉丝',
      payload: { followerId },
    });
  }

  async notifyLike(
    recipientId: string,
    actorId: string,
    postId: string,
    postTitle: string,
  ): Promise<Notification> {
    return this.create({
      recipientId,
      type: NotificationType.LIKE,
      title: '新点赞',
      content: `您的文章《${postTitle}》被点赞`,
      payload: { actorId, postId },
    });
  }

  async notifyFavorite(
    recipientId: string,
    actorId: string,
    postId: string,
    postTitle: string,
  ): Promise<Notification> {
    return this.create({
      recipientId,
      type: NotificationType.FAVORITE,
      title: '新收藏',
      content: `您的文章《${postTitle}》被收藏`,
      payload: { actorId, postId },
    });
  }

  async notifyPostPublished(
    recipientId: string,
    authorId: string,
    postId: string,
    postTitle: string,
  ): Promise<Notification> {
    return this.create({
      recipientId,
      type: NotificationType.POST_PUBLISHED,
      title: '关注博主发布新文章',
      content: `您关注的博主发布了新文章《${postTitle}》`,
      payload: { authorId, postId },
    });
  }

  async listByRecipient(
    recipientId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResult<Notification>> {
    const all = await this.notificationRepo.findByRecipient(recipientId);
    all.sort((a, b) => b.createdAt - a.createdAt);
    const total = all.length;
    const start = (page - 1) * pageSize;
    const items = all.slice(start, start + pageSize);
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async listUnread(recipientId: string): Promise<Notification[]> {
    return this.notificationRepo.findUnreadByRecipient(recipientId);
  }

  async markRead(id: string): Promise<Notification> {
    const updated = await this.notificationRepo.markRead(id);
    if (!updated) {
      throw new NotFoundError('Notification');
    }
    return updated;
  }

  async markAllRead(recipientId: string): Promise<number> {
    return this.notificationRepo.markAllRead(recipientId);
  }

  async countUnread(recipientId: string): Promise<number> {
    return this.notificationRepo.countUnread(recipientId);
  }

  async delete(id: string): Promise<boolean> {
    return this.notificationRepo.delete(id);
  }
}
