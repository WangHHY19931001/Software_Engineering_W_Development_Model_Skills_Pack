/**
 * NotificationStore（DD-035）：Notification 实体存储；按用户分页（unreadOnly 过滤）；已读幂等更新。
 */
import { SnapshotStore, nextId, assertPage } from './base';
import type { Notification, Page } from '../types';

interface NotificationState {
  map: Map<string, Notification>;
  seq: { n: number };
}

export type NotificationCreateInput = Omit<Notification, 'id'> & { id?: string };

export class NotificationStore extends SnapshotStore<NotificationState> {
  protected state: NotificationState = { map: new Map(), seq: { n: 0 } };

  create(input: NotificationCreateInput): Notification {
    const id = input.id ?? nextId('n', this.state.seq);
    const record: Notification = {
      id,
      userId: input.userId,
      type: input.type,
      articleId: input.articleId ?? null,
      actorId: input.actorId ?? null,
      actorName: input.actorName,
      content: input.content,
      read: input.read,
      createdAt: input.createdAt,
    };
    this.state.map.set(id, record);
    return record;
  }

  findById(id: string): Notification | null {
    return this.state.map.get(id) ?? null;
  }

  listByUser(userId: string, page: number, pageSize: number, unreadOnly = false): Page<Notification> {
    assertPage(page, pageSize);
    const items = [...this.state.map.values()]
      .filter((n) => n.userId === userId && (!unreadOnly || !n.read))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
  }

  markRead(id: string): Notification | null {
    const record = this.state.map.get(id);
    if (!record) return null;
    const next: Notification = { ...record, read: true };
    this.state.map.set(id, next);
    return next;
  }
}
