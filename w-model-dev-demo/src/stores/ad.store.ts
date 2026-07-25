// SD-005 AdStore.

import { AdStatus, type Ad, type AdInput } from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { adInputSchema } from '../utils/schemas.js';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `ad-${counter}`;
}

export class AdStore {
  private ads = new Map<string, Ad>();
  private slotIdToAds = new Map<string, Set<string>>();
  private statusToAds = new Map<AdStatus, Set<string>>();

  size(): number {
    return this.ads.size;
  }

  getById(id: string): Ad | null {
    return this.ads.get(id) ?? null;
  }

  listBySlot(slotId: string): Ad[] {
    const set = this.slotIdToAds.get(slotId);
    if (!set) return [];
    const out: Ad[] = [];
    for (const id of set) {
      const ad = this.ads.get(id);
      if (ad) out.push({ ...ad });
    }
    return out;
  }

  hasOverlap(slotId: string, startAt: Date, endAt: Date, excludeId?: string): boolean {
    const existing = this.listBySlot(slotId);
    for (const ad of existing) {
      if (excludeId && ad.id === excludeId) continue;
      if (ad.status === AdStatus.Offline || ad.status === AdStatus.Rejected) continue;
      // Overlap: startA < endB && startB < endA
      if (startAt < ad.endAt && ad.startAt < endAt) {
        return true;
      }
    }
    return false;
  }

  create(_operatorId: string, input: AdInput, operatorRole: string): Ad {
    if (operatorRole !== 'admin') {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    const parsed = adInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    if (this.hasOverlap(parsed.data.slotId, parsed.data.startAt, parsed.data.endAt)) {
      throw new AppError(ErrorCode.BusinessConflict, '1005');
    }
    const now = new Date();
    const ad: Ad = {
      id: nextId(),
      slotId: parsed.data.slotId,
      title: parsed.data.title,
      imageUrl: parsed.data.imageUrl,
      targetUrl: parsed.data.targetUrl,
      startAt: parsed.data.startAt,
      endAt: parsed.data.endAt,
      status: AdStatus.PendingReview,
      clickCount: 0,
      impressCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.ads.set(ad.id, ad);
    this.indexAdd(this.slotIdToAds, parsed.data.slotId, ad.id);
    this.indexAdd(this.statusToAds, AdStatus.PendingReview, ad.id);
    return { ...ad };
  }

  update(ad: Ad): Ad {
    const existing = this.ads.get(ad.id);
    if (!existing) throw new AppError(ErrorCode.NotFound, '1031');
    const oldStatus = existing.status;
    const newStatus = ad.status;
    const updated: Ad = { ...ad, updatedAt: new Date() };
    this.ads.set(ad.id, updated);
    if (oldStatus !== newStatus) {
      this.indexRemove(this.statusToAds, oldStatus, ad.id);
      this.indexAdd(this.statusToAds, newStatus, ad.id);
    }
    return { ...updated };
  }

  listBySlotPaged(slotId: string, page: number, pageSize: number): { items: Ad[]; total: number } {
    const all = this.listBySlot(slotId).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const start = (page - 1) * pageSize;
    return { items: all.slice(start, start + pageSize), total: all.length };
  }

  private indexAdd<K>(map: Map<K, Set<string>>, key: K, value: string): void {
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(value);
  }

  private indexRemove<K>(map: Map<K, Set<string>>, key: K, value: string): void {
    const set = map.get(key);
    if (!set) return;
    set.delete(value);
    if (set.size === 0) map.delete(key);
  }

  clear(): void {
    this.ads.clear();
    this.slotIdToAds.clear();
    this.statusToAds.clear();
  }
}
