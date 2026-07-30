/**
 * 广告位服务
 */
import { z } from 'zod';
import { AdSlotRepository } from '../repositories/ad-slot.repository.js';
import { SiteConfigRepository } from '../repositories/site-config.repository.js';
import { generateId } from '../utils/id.js';
import {
  NotFoundError,
  ValidationError,
} from '../utils/errors.js';
import {
  AdPlacement,
  AdStatus,
  type AdSlot,
} from '../types/index.js';

export const CreateAdSchema = z.object({
  name: z.string().min(1).max(100),
  placement: z.nativeEnum(AdPlacement),
  imageUrl: z.string().url(),
  linkUrl: z.string().url(),
  startAt: z.number().int().nonnegative(),
  endAt: z.number().int().nonnegative(),
  status: z.nativeEnum(AdStatus).optional().default(AdStatus.ACTIVE),
});

export const UpdateAdSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  placement: z.nativeEnum(AdPlacement).optional(),
  imageUrl: z.string().url().optional(),
  linkUrl: z.string().url().optional(),
  startAt: z.number().int().nonnegative().optional(),
  endAt: z.number().int().nonnegative().optional(),
  status: z.nativeEnum(AdStatus).optional(),
});

export type CreateAdInput = z.infer<typeof CreateAdSchema>;
export type UpdateAdInput = z.infer<typeof UpdateAdSchema>;

export class AdService {
  constructor(
    private readonly adRepo: AdSlotRepository,
    private readonly siteConfigRepo: SiteConfigRepository,
  ) {}

  async create(input: CreateAdInput): Promise<AdSlot> {
    const parsed = CreateAdSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid ad data', { issues: parsed.error.issues });
    }
    if (parsed.data.endAt < parsed.data.startAt) {
      throw new ValidationError('endAt must be greater than startAt');
    }
    const now = Date.now();
    const ad: AdSlot = {
      id: generateId('ad'),
      name: parsed.data.name,
      placement: parsed.data.placement,
      imageUrl: parsed.data.imageUrl,
      linkUrl: parsed.data.linkUrl,
      startAt: parsed.data.startAt,
      endAt: parsed.data.endAt,
      status: parsed.data.status ?? AdStatus.ACTIVE,
      impressionCount: 0,
      clickCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await this.adRepo.create(ad);
    return ad;
  }

  async update(id: string, input: UpdateAdInput): Promise<AdSlot> {
    const parsed = UpdateAdSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid ad update', { issues: parsed.error.issues });
    }
    const ad = await this.adRepo.findById(id);
    if (!ad) {
      throw new NotFoundError('Ad');
    }
    const updated = await this.adRepo.update(id, {
      ...parsed.data,
      updatedAt: Date.now(),
    } as Partial<AdSlot>);
    if (!updated) {
      throw new NotFoundError('Ad');
    }
    return updated;
  }

  async getById(id: string): Promise<AdSlot> {
    const ad = await this.adRepo.findById(id);
    if (!ad) {
      throw new NotFoundError('Ad');
    }
    return ad;
  }

  async list(): Promise<AdSlot[]> {
    return this.adRepo.findAll();
  }

  async listActive(): Promise<AdSlot[]> {
    return this.adRepo.findActive();
  }

  async listByPlacement(placement: AdPlacement): Promise<AdSlot[]> {
    const all = await this.adRepo.findAll();
    return all.filter((a) => a.placement === placement && a.status === AdStatus.ACTIVE);
  }

  async delete(id: string): Promise<boolean> {
    const exists = await this.adRepo.exists(id);
    if (!exists) {
      throw new NotFoundError('Ad');
    }
    return this.adRepo.delete(id);
  }

  async recordImpression(id: string): Promise<AdSlot | null> {
    return this.adRepo.incrementImpression(id);
  }

  async recordClick(id: string): Promise<AdSlot | null> {
    return this.adRepo.incrementClick(id);
  }

  async setBanner(adId: string | null): Promise<void> {
    const config = await this.siteConfigRepo.getSingleton();
    if (config) {
      await this.siteConfigRepo.upsert({ ...config, bannerAdId: adId, updatedAt: Date.now() });
    }
  }

  async getBannerAd(): Promise<AdSlot | null> {
    const config = await this.siteConfigRepo.getSingleton();
    if (!config || !config.bannerAdId) return null;
    const ad = await this.adRepo.findById(config.bannerAdId);
    if (!ad) return null;
    if (ad.status !== AdStatus.ACTIVE) return null;
    if (Date.now() < ad.startAt || Date.now() > ad.endAt) return null;
    return ad;
  }
}
