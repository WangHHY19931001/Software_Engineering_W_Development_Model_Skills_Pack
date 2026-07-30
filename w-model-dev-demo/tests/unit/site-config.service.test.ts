/**
 * 站点配置服务测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SiteConfigService } from '../../src/services/site-config.service.js';
import { SiteConfigRepository } from '../../src/repositories/site-config.repository.js';
import { ValidationError } from '../../src/utils/errors.js';

describe('SiteConfigService', () => {
  let repo: SiteConfigRepository;
  let svc: SiteConfigService;

  beforeEach(() => {
    repo = new SiteConfigRepository();
    svc = new SiteConfigService(repo);
  });

  describe('get()', () => {
    it('returns default when empty', async () => {
      const r = await svc.get();
      expect(r.siteTitle.length).toBeGreaterThan(0);
    });

    it('returns existing when present', async () => {
      await svc.createDefault();
      await svc.update({ siteTitle: 'Custom Title' });
      const r = await svc.get();
      expect(r.siteTitle).toBe('Custom Title');
    });
  });

  describe('createDefault()', () => {
    it('creates default config', async () => {
      const r = await svc.createDefault();
      expect(r.siteTitle).toBe('Blog System Demo');
    });
  });

  describe('update()', () => {
    it('updates fields', async () => {
      await svc.createDefault();
      const r = await svc.update({ siteTitle: 'New' });
      expect(r.siteTitle).toBe('New');
    });

    it('throws ValidationError on bad url', async () => {
      await svc.createDefault();
      await expect(svc.update({ siteLink: 'not-url' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('preserves unmodified fields', async () => {
      await svc.createDefault();
      await svc.update({ siteTitle: 'X' });
      const r = await svc.get();
      expect(r.siteDescription).toBe('A demo blog system');
    });
  });

  describe('setBannerAd()', () => {
    it('sets bannerAdId', async () => {
      await svc.createDefault();
      const r = await svc.setBannerAd('ad_1');
      expect(r.bannerAdId).toBe('ad_1');
    });

    it('clears bannerAdId with null', async () => {
      await svc.createDefault();
      await svc.setBannerAd('ad_1');
      const r = await svc.setBannerAd(null);
      expect(r.bannerAdId).toBeNull();
    });
  });

  describe('getMetaTags()', () => {
    it('returns meta', async () => {
      const r = await svc.getMetaTags();
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.keywords.length).toBeGreaterThan(0);
    });
  });

  describe('ensureExists/reset()', () => {
    it('ensureExists creates default', async () => {
      const r = await svc.ensureExists();
      expect(r.siteTitle.length).toBeGreaterThan(0);
    });

    it('reset creates default', async () => {
      await svc.createDefault();
      await svc.update({ siteTitle: 'X' });
      const r = await svc.reset();
      expect(r.siteTitle).toBe('Blog System Demo');
    });
  });
});
