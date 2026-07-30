/**
 * 站点配置服务
 */
import { z } from 'zod';
import { SiteConfigRepository, SITE_CONFIG_ID } from '../repositories/site-config.repository.js';
import { generateId } from '../utils/id.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import type { SiteConfig } from '../types/index.js';

export const UpdateSiteConfigSchema = z.object({
  siteTitle: z.string().min(1).max(200).optional(),
  siteLink: z.string().url().optional(),
  siteDescription: z.string().max(2000).optional(),
  siteLogoUrl: z.string().url().optional(),
  bannerAdId: z.string().nullable().optional(),
  metaKeywords: z.string().max(500).optional(),
  metaDescription: z.string().max(2000).optional(),
  icpRecord: z.string().max(200).optional(),
});

export type UpdateSiteConfigInput = z.infer<typeof UpdateSiteConfigSchema>;

export class SiteConfigService {
  constructor(private readonly siteConfigRepo: SiteConfigRepository) {}

  async get(): Promise<SiteConfig> {
    const config = await this.siteConfigRepo.getSingleton();
    if (!config) {
      return this.createDefault();
    }
    return config;
  }

  async createDefault(): Promise<SiteConfig> {
    const now = Date.now();
    const config: SiteConfig = {
      id: SITE_CONFIG_ID,
      siteTitle: 'Blog System Demo',
      siteLink: 'https://blog.example.com',
      siteDescription: 'A demo blog system',
      siteLogoUrl: 'https://blog.example.com/logo.png',
      bannerAdId: null,
      metaKeywords: 'blog, demo',
      metaDescription: 'Demo blog system',
      icpRecord: '',
      updatedAt: now,
    };
    await this.siteConfigRepo.upsert(config);
    return config;
  }

  async update(input: UpdateSiteConfigInput): Promise<SiteConfig> {
    const parsed = UpdateSiteConfigSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid site config', { issues: parsed.error.issues });
    }
    const current = await this.get();
    const updated: SiteConfig = {
      ...current,
      ...parsed.data,
      updatedAt: Date.now(),
    };
    return this.siteConfigRepo.upsert(updated);
  }

  async setBannerAd(adId: string | null): Promise<SiteConfig> {
    return this.update({ bannerAdId: adId });
  }

  async getMetaTags(): Promise<{ title: string; description: string; keywords: string }> {
    const config = await this.get();
    return {
      title: config.siteTitle,
      description: config.metaDescription,
      keywords: config.metaKeywords,
    };
  }

  async ensureExists(): Promise<SiteConfig> {
    const existing = await this.siteConfigRepo.getSingleton();
    if (existing) return existing;
    return this.createDefault();
  }

  async reset(): Promise<SiteConfig> {
    await this.siteConfigRepo.delete(SITE_CONFIG_ID);
    return this.createDefault();
  }
}

void generateId;
void NotFoundError;
