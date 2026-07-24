/**
 * DD-015 NotificationService —— 通知服务
 *
 * 站内通知触发、已读管理、通知设置。
 * 依赖：DD-016 EmailSender。
 */
import { z } from 'zod';
import type { Notification, Page } from '../../types.js';
import { GenericStore } from '../../stores/generic-store.js';
import { AppError } from '../../utils/errors.js';
import type { EmailSender } from '../../utils/email.js';
import type { WalWriter } from '../../infrastructure/wal.js';

export interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  sendEmail?: boolean;
}

export interface NotifySettings {
  enabledTypes: string[];
  emailEnabled: boolean;
}

const NotifySchema = z.object({
  userId: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  sendEmail: z.boolean().optional(),
});

const notificationStore = new GenericStore<Notification>();
const userIndex = new Map<string, Set<string>>(); // userId -> notificationId 集合
const settingsStore = new Map<string, NotifySettings>();

function genId(): string {
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface NotificationServiceDeps {
  emailSender: EmailSender;
  walWriter: WalWriter;
}

export class NotificationService {
  constructor(private deps: NotificationServiceDeps) {}

  /** 触发通知（对应 DD-015 notify） */
  async notify(input: NotifyInput): Promise<Notification> {
    const parsed = NotifySchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(40003, '输入校验失败', { issues: parsed.error.issues });
    }
    // 检查用户是否关闭该类型
    const settings = settingsStore.get(parsed.data.userId);
    if (settings && !settings.enabledTypes.includes(parsed.data.type)) {
      // 关闭类型：不创建通知
      const now = Math.floor(Date.now() / 1000);
      return {
        id: genId(),
        userId: parsed.data.userId,
        type: parsed.data.type,
        title: parsed.data.title,
        body: parsed.data.body,
        read: true,
        createdAt: now,
      };
    }
    const now = Math.floor(Date.now() / 1000);
    const notification: Notification = {
      id: genId(),
      userId: parsed.data.userId,
      type: parsed.data.type,
      title: parsed.data.title,
      body: parsed.data.body,
      read: false,
      createdAt: now,
    };
    notificationStore.insert(notification);
    let set = userIndex.get(parsed.data.userId);
    if (!set) {
      set = new Set();
      userIndex.set(parsed.data.userId, set);
    }
    set.add(notification.id);
    // 邮件发送（若启用）
    if (parsed.data.sendEmail || (settings?.emailEnabled)) {
      try {
        await this.deps.emailSender.sendMail(
          parsed.data.userId, // 实际场景应查询 email
          parsed.data.title,
          parsed.data.body,
        );
      } catch {
        // 降级：忽略邮件失败
      }
    }
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'notification.create',
      payload: notification,
      timestamp: now,
    });
    return notification;
  }

  /** 标记已读（对应 DD-015 markRead） */
  markRead(id: string, userId: string): void {
    const existing = notificationStore.findById(id);
    if (!existing) {
      throw new AppError(40401, `通知不存在: ${id}`, { id });
    }
    if (existing.userId !== userId) {
      throw new AppError(40302, '所有权校验失败', { id, userId, ownerId: existing.userId });
    }
    notificationStore.update(id, { read: true });
  }

  /** 全部已读（对应 DD-015 markAllRead） */
  markAllRead(userId: string): void {
    const set = userIndex.get(userId);
    if (!set) return;
    for (const id of set) {
      notificationStore.update(id, { read: true });
    }
  }

  /** 未读数（对应 DD-015 getUnreadCount） */
  getUnreadCount(userId: string): number {
    const set = userIndex.get(userId) ?? new Set<string>();
    let count = 0;
    for (const id of set) {
      const n = notificationStore.findById(id);
      if (n && !n.read) count++;
    }
    return count;
  }

  /** 更新设置（对应 DD-015 updateSettings） */
  updateSettings(userId: string, settings: NotifySettings): void {
    settingsStore.set(userId, settings);
  }

  /** 获取用户通知列表分页 */
  listByUser(userId: string, page: number, size: number): Page<Notification> {
    if (page < 1) throw new AppError(40003, 'page 必须 ≥ 1');
    if (size < 1 || size > 100) throw new AppError(40003, 'size 必须 ∈ [1,100]');
    const set = userIndex.get(userId) ?? new Set<string>();
    const all = Array.from(set)
      .map(id => notificationStore.findById(id))
      .filter((n): n is Notification => n !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
    const total = all.length;
    const start = (page - 1) * size;
    const list = all.slice(start, start + size);
    return { list, total, page, pageSize: size };
  }

  /** 测试重置 */
  static _reset(): void {
    notificationStore.clear();
    userIndex.clear();
    settingsStore.clear();
  }
}
