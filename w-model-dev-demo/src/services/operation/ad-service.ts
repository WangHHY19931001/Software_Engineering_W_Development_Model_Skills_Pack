/**
 * DD-020 AdService —— 广告服务
 *
 * 广告位 CRUD、投放时间范围、广告审核（上架/下架）。
 * 依赖：DD-021 CtrCalculator、DD-024 WalWriter、DD-026 AuditLogger。
 * 频次控制：checkFrequency（每用户每广告每日 ≤100 次）。
 */
import { z } from 'zod';
import type { Ad, AdStatus, Page } from '../../types.js';
import { GenericStore } from '../../stores/generic-store.js';
import { CtrCalculator } from '../../utils/ctr-calculator.js';
import { AppError } from '../../utils/errors.js';
import type { WalWriter } from '../../infrastructure/wal.js';
import type { AuditLogger } from '../../infrastructure/audit.js';

export interface AdInput {
  slot: string;
  startAt: number;
  endAt: number;
  targetUser?: string;
  content?: string;
}

const AdSchema = z.object({
  slot: z.string().min(1, '广告位不能为空').max(50),
  startAt: z.number().int().positive(),
  endAt: z.number().int().positive(),
  targetUser: z.string().optional(),
  content: z.string().max(5000).optional(),
}).refine(d => d.endAt > d.startAt, { message: 'endAt 必须大于 startAt' });

const adStore = new GenericStore<Ad>();
const frequencyMap = new Map<string, number>(); // `${userId}:${adId}:${date}` -> count

function genId(): string {
  return `ad-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayKey(userId: string, adId: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${userId}:${adId}:${date}`;
}

export interface AdServiceDeps {
  walWriter: WalWriter;
  auditLogger: AuditLogger;
  ctrCalculator: CtrCalculator;
}

export class AdService {
  constructor(private deps: AdServiceDeps) {}

  /** 创建广告（对应 DD-020 createAd） */
  async createAd(input: AdInput, adminId: string): Promise<Ad> {
    const parsed = AdSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(40003, '输入校验失败', { issues: parsed.error.issues });
    }
    const now = Math.floor(Date.now() / 1000);
    const ad: Ad = {
      id: genId(),
      slot: parsed.data.slot,
      startAt: parsed.data.startAt,
      endAt: parsed.data.endAt,
      status: 'pending',
      targetUser: parsed.data.targetUser,
      content: parsed.data.content,
    };
    adStore.insert(ad);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'ad.create',
      payload: ad,
      timestamp: now,
    });
    return ad;
  }

  /** 更新广告（对应 DD-020 updateAd） */
  async updateAd(id: string, input: Partial<AdInput>, adminId: string): Promise<Ad> {
    const existing = adStore.findById(id);
    if (!existing) {
      throw new AppError(40401, `广告不存在: ${id}`, { id });
    }
    const patch: Partial<Ad> = {};
    if (input.slot !== undefined) patch.slot = input.slot;
    if (input.startAt !== undefined) patch.startAt = input.startAt;
    if (input.endAt !== undefined) patch.endAt = input.endAt;
    if (input.targetUser !== undefined) patch.targetUser = input.targetUser;
    if (input.content !== undefined) patch.content = input.content;
    adStore.update(id, patch);
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'ad.update',
      payload: adStore.findById(id),
      timestamp: now,
    });
    const updated = adStore.findById(id);
    if (!updated) throw new AppError(50001, '更新后广告丢失');
    return updated;
  }

  /** 获取广告（对应 DD-020 getAd） */
  getAd(id: string): Ad {
    const ad = adStore.findById(id);
    if (!ad) {
      throw new AppError(40401, `广告不存在: ${id}`, { id });
    }
    return ad;
  }

  /** 广告列表（对应 DD-020 listAds） */
  listAds(filter: { slot?: string; status?: AdStatus }, page: number, size: number): Page<Ad> {
    if (page < 1) throw new AppError(40003, 'page 必须 ≥ 1');
    if (size < 1 || size > 100) throw new AppError(40003, 'size 必须 ∈ [1,100]');
    let list = adStore.list();
    if (filter.slot) list = list.filter(a => a.slot === filter.slot);
    if (filter.status) list = list.filter(a => a.status === filter.status);
    list.sort((a, b) => b.startAt - a.startAt);
    const total = list.length;
    const start = (page - 1) * size;
    const slice = list.slice(start, start + size);
    return { list: slice, total, page, pageSize: size };
  }

  /** 上架（对应 DD-020 approve） */
  async approve(id: string, adminId: string): Promise<Ad> {
    const existing = adStore.findById(id);
    if (!existing) {
      throw new AppError(40401, `广告不存在: ${id}`, { id });
    }
    if (existing.status !== 'pending') {
      throw new AppError(60002, '当前状态不允许上架', { id, status: existing.status });
    }
    adStore.update(id, { status: 'active' });
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'ad.approve',
      payload: { id, adminId },
      timestamp: now,
    });
    await this.deps.auditLogger.log('ad.approve', adminId, id, {});
    const updated = adStore.findById(id);
    if (!updated) throw new AppError(50001, '上架后广告丢失');
    return updated;
  }

  /** 下架（对应 DD-020 reject） */
  async reject(id: string, reason: string, adminId: string): Promise<Ad> {
    if (!reason || reason.length === 0) {
      throw new AppError(40003, '下架原因不能为空');
    }
    const existing = adStore.findById(id);
    if (!existing) {
      throw new AppError(40401, `广告不存在: ${id}`, { id });
    }
    adStore.update(id, { status: 'rejected' });
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'ad.reject',
      payload: { id, reason, adminId },
      timestamp: now,
    });
    await this.deps.auditLogger.log('ad.reject', adminId, id, { reason });
    const updated = adStore.findById(id);
    if (!updated) throw new AppError(50001, '下架后广告丢失');
    return updated;
  }

  /** 投放广告（对应 DD-020 serveAd + checkFrequency） */
  async serveAd(userId: string, slot: string): Promise<Ad | null> {
    const now = Math.floor(Date.now() / 1000);
    // 查找符合 slot + 时间范围 + active 的广告
    const candidates = adStore
      .list()
      .filter(a =>
        a.slot === slot &&
        a.status === 'active' &&
        a.startAt <= now &&
        a.endAt >= now &&
        (!a.targetUser || a.targetUser === userId)
      );
    if (candidates.length === 0) return null;
    // 频次控制
    for (const ad of candidates) {
      if (this.checkFrequency(userId, ad.id)) {
        this.deps.ctrCalculator.recordImpression(ad.id);
        return ad;
      }
    }
    throw new AppError(60006, '广告频次超限', { userId, slot });
  }

  /** 频次控制（对应 DD-020 checkFrequency） */
  private checkFrequency(userId: string, adId: string): boolean {
    const key = todayKey(userId, adId);
    const count = frequencyMap.get(key) ?? 0;
    if (count >= 100) return false;
    frequencyMap.set(key, count + 1);
    return true;
  }

  /** 记录点击（供 controller 调用） */
  recordClick(adId: string): void {
    this.deps.ctrCalculator.recordClick(adId);
  }

  /** 测试重置 */
  static _reset(): void {
    adStore.clear();
    frequencyMap.clear();
  }
}
