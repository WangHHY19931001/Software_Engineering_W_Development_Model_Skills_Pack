/**
 * 通知仓储
 */
import { BaseRepository } from './base.repository.js';
import type { Notification } from '../types/index.js';

export class NotificationRepository extends BaseRepository<Notification> {
  async findByRecipient(recipientId: string): Promise<Notification[]> {
    return this.findBy((n) => n.recipientId === recipientId);
  }

  async findUnreadByRecipient(recipientId: string): Promise<Notification[]> {
    return this.findBy((n) => n.recipientId === recipientId && n.read === false);
  }

  async markRead(id: string): Promise<Notification | null> {
    return this.update(id, { read: true } as unknown as Partial<Notification>);
  }

  async markAllRead(recipientId: string): Promise<number> {
    const all = await this.findUnreadByRecipient(recipientId);
    let n = 0;
    for (const item of all) {
      await this.update(item.id, { read: true } as unknown as Partial<Notification>);
      n += 1;
    }
    return n;
  }

  async countUnread(recipientId: string): Promise<number> {
    return this.findUnreadByRecipient(recipientId).then((arr) => arr.length);
  }
}
