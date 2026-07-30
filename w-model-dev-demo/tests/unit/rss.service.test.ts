/**
 * RSS 服务测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { RssService } from '../../src/services/rss.service.js';
import { ArticleRepository } from '../../src/repositories/article.repository.js';
import { UserRepository } from '../../src/repositories/user.repository.js';
import { BloggerRepository } from '../../src/repositories/blogger.repository.js';
import { SiteConfigRepository } from '../../src/repositories/site-config.repository.js';
import { ArticleStatus, UserRole, type User } from '../../src/types/index.js';
import { generateId } from '../../src/utils/id.js';

describe('RssService', () => {
  let articleRepo: ArticleRepository;
  let userRepo: UserRepository;
  let bloggerRepo: BloggerRepository;
  let siteConfigRepo: SiteConfigRepository;
  let svc: RssService;
  let nextUserNum = 0;

  beforeEach(() => {
    articleRepo = new ArticleRepository();
    userRepo = new UserRepository();
    bloggerRepo = new BloggerRepository();
    siteConfigRepo = new SiteConfigRepository();
    svc = new RssService(articleRepo, userRepo, bloggerRepo, siteConfigRepo);
  });

  async function seedUser(): Promise<User> {
    nextUserNum += 1;
    const u: User = {
      id: generateId('user'),
      email: `u${nextUserNum}@e.com`,
      passwordHash: 'h',
      username: `u${nextUserNum}`,
      nickname: `U${nextUserNum}`,
      role: UserRole.BLOGGER,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await userRepo.create(u);
    return u;
  }

  async function seedArticle(authorId: string, status: ArticleStatus = ArticleStatus.PUBLISHED): Promise<void> {
    await articleRepo.create({
      id: generateId('article'),
      authorId,
      title: `Title ${nextUserNum}`,
      content: `Content ${nextUserNum}`,
      summary: `Summary ${nextUserNum}`,
      status,
      tagIds: [],
      viewCount: 0,
      likeCount: 0,
      favoriteCount: 0,
      commentCount: 0,
      publishedAt: status === ArticleStatus.PUBLISHED ? Date.now() : null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  describe('buildFeed()', () => {
    it('should produce valid RSS XML', async () => {
      const u = await seedUser();
      await seedArticle(u.id);
      const xml = await svc.buildFeed();
      expect(xml).toContain('<?xml');
      expect(xml).toContain('<rss version="2.0">');
      expect(xml).toContain('<channel>');
      expect(xml).toContain('</channel>');
    });

    it('should include articles', async () => {
      const u = await seedUser();
      await seedArticle(u.id);
      const xml = await svc.buildFeed();
      expect(xml).toContain('<item>');
      expect(xml).toContain(`Title ${nextUserNum}`);
    });

    it('should use site config when available', async () => {
      await siteConfigRepo.upsert({
        id: 'site_config_singleton',
        siteTitle: 'My Blog',
        siteLink: 'https://my.blog',
        siteDescription: 'desc',
        siteLogoUrl: '',
        bannerAdId: null,
        metaKeywords: '',
        metaDescription: '',
        icpRecord: '',
        updatedAt: Date.now(),
      });
      const xml = await svc.buildFeed();
      expect(xml).toContain('My Blog');
      expect(xml).toContain('https://my.blog');
    });

    it('should escape special characters in titles', async () => {
      const u = await seedUser();
      await articleRepo.create({
        id: generateId('article'),
        authorId: u.id,
        title: 'T<>&"\'',
        content: 'c',
        summary: '',
        status: ArticleStatus.PUBLISHED,
        tagIds: [],
        viewCount: 0,
        likeCount: 0,
        favoriteCount: 0,
        commentCount: 0,
        publishedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const xml = await svc.buildFeed();
      expect(xml).toContain('&lt;');
    });

    it('should not include draft articles', async () => {
      const u = await seedUser();
      await seedArticle(u.id, ArticleStatus.DRAFT);
      const xml = await svc.buildFeed();
      expect(xml).not.toContain('<item>');
    });

    it('should not include deleted articles', async () => {
      const u = await seedUser();
      await seedArticle(u.id, ArticleStatus.DELETED);
      const xml = await svc.buildFeed();
      expect(xml).not.toContain('<item>');
    });

    it('should sort by publishedAt desc', async () => {
      const u = await seedUser();
      await articleRepo.create({
        id: 'a1',
        authorId: u.id,
        title: 'older',
        content: 'c',
        summary: '',
        status: ArticleStatus.PUBLISHED,
        tagIds: [],
        viewCount: 0,
        likeCount: 0,
        favoriteCount: 0,
        commentCount: 0,
        publishedAt: 1000,
        createdAt: 1000,
        updatedAt: 1000,
      });
      await articleRepo.create({
        id: 'a2',
        authorId: u.id,
        title: 'newer',
        content: 'c',
        summary: '',
        status: ArticleStatus.PUBLISHED,
        tagIds: [],
        viewCount: 0,
        likeCount: 0,
        favoriteCount: 0,
        commentCount: 0,
        publishedAt: 2000,
        createdAt: 2000,
        updatedAt: 2000,
      });
      const xml = await svc.buildFeed();
      const newerIdx = xml.indexOf('newer');
      const olderIdx = xml.indexOf('older');
      expect(newerIdx).toBeGreaterThan(-1);
      expect(olderIdx).toBeGreaterThan(-1);
      expect(newerIdx).toBeLessThan(olderIdx);
    });

    it('should cap items at 20', async () => {
      const u = await seedUser();
      for (let i = 0; i < 30; i += 1) {
        await seedArticle(u.id);
      }
      const xml = await svc.buildFeed();
      const matches = xml.match(/<item>/g);
      expect(matches?.length).toBe(20);
    });
  });

  describe('listFeedItems()', () => {
    it('returns top published', async () => {
      const u = await seedUser();
      await seedArticle(u.id);
      const items = await svc.listFeedItems();
      expect(items.length).toBe(1);
      expect(items[0]!.status).toBe(ArticleStatus.PUBLISHED);
    });

    it('empty when no published', async () => {
      const u = await seedUser();
      await seedArticle(u.id, ArticleStatus.DRAFT);
      const items = await svc.listFeedItems();
      expect(items.length).toBe(0);
    });
  });

  describe('getAuthorName()', () => {
    it('returns blogger displayName if exists', async () => {
      const u = await seedUser();
      const now = Date.now();
      await bloggerRepo.create({
        id: generateId('blogger'),
        userId: u.id,
        displayName: 'Display',
        description: '',
        verified: true,
        createdAt: now,
        updatedAt: now,
      });
      const article = await articleRepo.create({
        id: 'a1',
        authorId: u.id,
        title: 't',
        content: 'c',
        summary: '',
        status: ArticleStatus.PUBLISHED,
        tagIds: [],
        viewCount: 0,
        likeCount: 0,
        favoriteCount: 0,
        commentCount: 0,
        publishedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const name = await svc.getAuthorName(article);
      expect(name).toBe('Display');
    });

    it('returns user nickname if no blogger', async () => {
      const u = await seedUser();
      const article = await articleRepo.create({
        id: 'a1',
        authorId: u.id,
        title: 't',
        content: 'c',
        summary: '',
        status: ArticleStatus.PUBLISHED,
        tagIds: [],
        viewCount: 0,
        likeCount: 0,
        favoriteCount: 0,
        commentCount: 0,
        publishedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const name = await svc.getAuthorName(article);
      expect(name).toBe(u.nickname);
    });

    it('returns Anonymous for missing user', async () => {
      const article = await articleRepo.create({
        id: 'a1',
        authorId: 'missing',
        title: 't',
        content: 'c',
        summary: '',
        status: ArticleStatus.PUBLISHED,
        tagIds: [],
        viewCount: 0,
        likeCount: 0,
        favoriteCount: 0,
        commentCount: 0,
        publishedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const name = await svc.getAuthorName(article);
      expect(name).toBe('Anonymous');
    });
  });
});
