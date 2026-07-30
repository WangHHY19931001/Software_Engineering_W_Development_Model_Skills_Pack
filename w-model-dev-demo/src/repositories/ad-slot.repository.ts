/**
 * 广告位仓储
 */
import { BaseRepository } from './base.repository.js';
import { AdStatus, type AdSlot } from '../types/index.js';

export class AdSlotRepository extends BaseRepository<AdSlot> {
  async findByStatus(status: AdStatus): Promise<AdSlot[]> {
    return this.findBy((a) => a.status === status);
  }

  async findActive(now: number = Date.now()): Promise<AdSlot[]> {
    return this.findBy(
      (a) => a.status === AdStatus.ACTIVE && a.startAt <= now && a.endAt >= now,
    );
  }

  async incrementImpression(id: string): Promise<AdSlot | null> {
    const ad = this.store.get(id);
    if (!ad) return null;
    const updated = { ...ad, impressionCount: ad.impressionCount + 1 };
    this.store.set(id, updated);
    return this.clone(updated);
  }

  async incrementClick(id: string): Promise<AdSlot | null> {
    const ad = this.store.get(id);
    if (!ad) return null;
    const updated = { ...ad, clickCount: ad.clickCount + 1 };
    this.store.set(id, updated);
    return this.clone(updated);
  }
}
