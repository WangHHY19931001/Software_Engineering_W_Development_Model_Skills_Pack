/**
 * DD-018 AnnouncementScheduler —— 公告定时调度器
 *
 * 全局公告定时发布；秒级 Unix 时间戳精度（GAP-003）。
 * 依赖：DD-017 SiteService、DD-024 WalWriter。
 */
import { z } from 'zod';
import type { Announcement, AnnouncementStatus } from '../../types.js';
import { GenericStore } from '../../stores/generic-store.js';
import { AppError } from '../../utils/errors.js';
import type { WalWriter } from '../../infrastructure/wal.js';

export interface AnnouncementInput {
  title: string;
  body: string;
  publishAt?: number;
}

const AnnouncementSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题长度至多 200 字'),
  body: z.string().min(1, '内容不能为空').max(5000, '内容长度至多 5000 字'),
  publishAt: z.number().int().positive().optional(),
});

const announcementStore = new GenericStore<Announcement>();
const queue = new Map<string, number>(); // id -> publishAt

function genId(): string {
  return `an-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface AnnouncementSchedulerDeps {
  walWriter: WalWriter;
}

export class AnnouncementScheduler {
  constructor(private deps: AnnouncementSchedulerDeps) {}

  /** 创建公告（对应 DD-018 createAnnouncement） */
  async createAnnouncement(input: AnnouncementInput, adminId: string): Promise<Announcement> {
    const parsed = AnnouncementSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(40003, '输入校验失败', { issues: parsed.error.issues });
    }
    const now = Math.floor(Date.now() / 1000);
    const status: AnnouncementStatus = parsed.data.publishAt ? 'scheduled' : 'draft';
    const announcement: Announcement = {
      id: genId(),
      title: parsed.data.title,
      body: parsed.data.body,
      publishAt: parsed.data.publishAt,
      status,
      createdAt: now,
      publishedAt: undefined,
    };
    announcementStore.insert(announcement);
    if (parsed.data.publishAt) {
      queue.set(announcement.id, parsed.data.publishAt);
    }
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'announcement.create',
      payload: announcement,
      timestamp: now,
    });
    return announcement;
  }

  /** 定时发布（对应 DD-018 schedulePublish） */
  async schedulePublish(id: string, publishAt: number, adminId: string): Promise<void> {
    const existing = announcementStore.findById(id);
    if (!existing) {
      throw new AppError(40401, `公告不存在: ${id}`, { id });
    }
    const now = Math.floor(Date.now() / 1000);
    if (publishAt <= now) {
      throw new AppError(40003, 'publishAt 必须大于当前时间', { publishAt, now });
    }
    if (existing.status === 'published') {
      throw new AppError(60002, '已发布公告不能重新定时', { id, status: existing.status });
    }
    announcementStore.update(id, { publishAt, status: 'scheduled' });
    queue.set(id, publishAt);
    const nowTs = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${nowTs}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'announcement.schedule',
      payload: { id, publishAt, adminId },
      timestamp: nowTs,
    });
  }

  /** 取消定时（对应 DD-018 cancelSchedule） */
  async cancelSchedule(id: string, adminId: string): Promise<void> {
    const existing = announcementStore.findById(id);
    if (!existing) {
      throw new AppError(40401, `公告不存在: ${id}`, { id });
    }
    if (existing.status === 'published') {
      throw new AppError(60002, '已发布公告不能取消定时', { id, status: existing.status });
    }
    announcementStore.update(id, { status: 'cancelled' });
    queue.delete(id);
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'announcement.cancel',
      payload: { id, adminId },
      timestamp: now,
    });
  }

  /**
   * 立即发布公告（对应 TLA+ L2_operations_support.tla Next 分支 PublishAnnouncement）。
   * 与 schedulePublish（定时发布）不同，本方法跳过等待立即置为 published。
   */
  async publishAnnouncement(id: string, adminId: string): Promise<Announcement> {
    const existing = announcementStore.findById(id);
    if (!existing) {
      throw new AppError(40401, `公告不存在: ${id}`, { id });
    }
    if (existing.status === 'published') {
      throw new AppError(60002, '公告已发布，不能重复发布', { id, status: existing.status });
    }
    const now = Math.floor(Date.now() / 1000);
    announcementStore.update(id, { status: 'published', publishedAt: now });
    queue.delete(id);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'announcement.publishNow',
      payload: { id, adminId },
      timestamp: now,
    });
    return announcementStore.findById(id)!;
  }

  /**
   * 移除公告（对应 TLA+ L2_operations_support.tla Next 分支 RemoveAnnouncement）。
   * 从存储中删除公告并清理定时队列。
   */
  async removeAnnouncement(id: string, adminId: string): Promise<void> {
    const existing = announcementStore.findById(id);
    if (!existing) {
      throw new AppError(40401, `公告不存在: ${id}`, { id });
    }
    announcementStore.delete(id);
    queue.delete(id);
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'announcement.remove',
      payload: { id, adminId },
      timestamp: now,
    });
  }

  /** 处理到期公告（对应 DD-018 processDueAnnouncements） */
  processDueAnnouncements(now: number): number {
    let count = 0;
    for (const [id, publishAt] of queue.entries()) {
      if (publishAt <= now) {
        announcementStore.update(id, { status: 'published', publishedAt: now });
        queue.delete(id);
        count++;
      }
    }
    if (count > 0) {
      const ts = Math.floor(Date.now() / 1000);
      this.deps.walWriter.append({
        opId: `op-${ts}-${Math.random().toString(36).slice(2, 8)}`,
        opType: 'announcement.publish',
        payload: { count, now },
        timestamp: ts,
      });
    }
    return count;
  }

  /** 按 ID 查询 */
  findById(id: string): Announcement | null {
    return announcementStore.findById(id);
  }

  /** 测试重置 */
  static _reset(): void {
    announcementStore.clear();
    queue.clear();
  }
}
