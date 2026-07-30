/**
 * 广告位服务测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AdService } from '../../src/services/ad.service.js';
import { AdSlotRepository } from '../../src/repositories/ad-slot.repository.js';
import { SiteConfigRepository } from '../../src/repositories/site-config.repository.js';
import { AdPlacement, AdStatus } from '../../src/types/index.js';
import { NotFoundError, ValidationError } from '../../src/utils/errors.js';

describe('AdService', () => {
  let adRepo: AdSlotRepository;
  let siteConfigRepo: SiteConfigRepository;
  let svc: AdService;
  let nextAdNum = 0;

  beforeEach(() => {
    adRepo = new AdSlotRepository();
    siteConfigRepo = new SiteConfigRepository();
    svc = new AdService(adRepo, siteConfigRepo);
  });

  function nextAdInput() {
    nextAdNum += 1;
    return {
      name: `Ad ${nextAdNum}`,
      placement: AdPlacement.BANNER_TOP,
      imageUrl: `https://cdn.example.com/ad${nextAdNum}.png`,
      linkUrl: `https://example.com/click${nextAdNum}`,
      startAt: Date.now() - 1000,
      endAt: Date.now() + 100_000,
      status: AdStatus.ACTIVE,
    };
  }

  describe('create()', () => {
    it('creates ad', async () => {
      const a = await svc.create(nextAdInput());
      expect(a.name).toContain('Ad');
      expect(a.impressionCount).toBe(0);
    });

    it('throws ValidationError on missing fields', async () => {
      await expect(svc.create({} as never)).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws on bad url', async () => {
      await expect(
        svc.create({ ...nextAdInput(), imageUrl: 'not-url' })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws if endAt < startAt', async () => {
      const input = nextAdInput();
      await expect(
        svc.create({ ...input, startAt: 100, endAt: 50 })
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('update()', () => {
    it('updates fields', async () => {
      const a = await svc.create(nextAdInput());
      const r = await svc.update(a.id, { name: 'Updated' });
      expect(r.name).toBe('Updated');
    });

    it('throws NotFoundError on missing', async () => {
      await expect(svc.update('m', { name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws ValidationError on bad data', async () => {
      const a = await svc.create(nextAdInput());
      await expect(svc.update(a.id, { name: '' })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('getById/list', () => {
    it('getById returns ad', async () => {
      const a = await svc.create(nextAdInput());
      const r = await svc.getById(a.id);
      expect(r.id).toBe(a.id);
    });

    it('getById throws NotFoundError', async () => {
      await expect(svc.getById('m')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('list returns all', async () => {
      await svc.create(nextAdInput());
      await svc.create(nextAdInput());
      const r = await svc.list();
      expect(r.length).toBe(2);
    });

    it('listActive returns only active', async () => {
      const a1 = await svc.create(nextAdInput());
      const a2 = await svc.create({ ...nextAdInput(), status: AdStatus.PAUSED });
      const r = await svc.listActive();
      expect(r.map((a) => a.id)).toContain(a1.id);
      expect(r.map((a) => a.id)).not.toContain(a2.id);
    });

    it('listActive filters by time window', async () => {
      const a1 = await svc.create(nextAdInput());
      await svc.create({
        ...nextAdInput(),
        startAt: Date.now() + 100_000,
        endAt: Date.now() + 200_000,
      });
      const r = await svc.listActive();
      expect(r.length).toBe(1);
      expect(r[0]!.id).toBe(a1.id);
    });

    it('listByPlacement filters by placement', async () => {
      const a = await svc.create({ ...nextAdInput(), placement: AdPlacement.SIDEBAR });
      const r = await svc.listByPlacement(AdPlacement.SIDEBAR);
      expect(r.length).toBe(1);
      expect(r[0]!.id).toBe(a.id);
    });
  });

  describe('delete()', () => {
    it('deletes ad', async () => {
      const a = await svc.create(nextAdInput());
      const r = await svc.delete(a.id);
      expect(r).toBe(true);
    });

    it('throws NotFoundError', async () => {
      await expect(svc.delete('m')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('recordImpression/Click', () => {
    it('recordImpression increments', async () => {
      const a = await svc.create(nextAdInput());
      const r = await svc.recordImpression(a.id);
      expect(r?.impressionCount).toBe(1);
    });

    it('recordImpression returns null on missing', async () => {
      const r = await svc.recordImpression('m');
      expect(r).toBeNull();
    });

    it('recordClick increments', async () => {
      const a = await svc.create(nextAdInput());
      const r = await svc.recordClick(a.id);
      expect(r?.clickCount).toBe(1);
    });

    it('recordClick returns null on missing', async () => {
      const r = await svc.recordClick('m');
      expect(r).toBeNull();
    });
  });

  describe('banner ad', () => {
    it('setBanner sets id', async () => {
      const a = await svc.create(nextAdInput());
      await svc.setBanner(a.id);
    });

    it('getBannerAd returns null when no banner', async () => {
      const r = await svc.getBannerAd();
      expect(r).toBeNull();
    });

    it('getBannerAd returns active banner', async () => {
      const a = await svc.create(nextAdInput());
      await siteConfigRepo.upsert({
        id: 'site_config_singleton',
        siteTitle: 't',
        siteLink: 'https://e.com',
        siteDescription: '',
        siteLogoUrl: '',
        bannerAdId: a.id,
        metaKeywords: '',
        metaDescription: '',
        icpRecord: '',
        updatedAt: Date.now(),
      });
      const r = await svc.getBannerAd();
      expect(r?.id).toBe(a.id);
    });
  });
});
