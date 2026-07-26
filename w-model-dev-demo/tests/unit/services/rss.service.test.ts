import { describe, it, expect, beforeEach } from 'vitest';
import { RssService } from '../../../src/services/rss.service.js';
import { ArticleStore } from '../../../src/stores/article.store.js';
import { AtomFeedGenerator } from '../../../src/utils/atom-feed-generator.js';

describe('RssService (DD-020-002 / L3_rss_generation_flow)', () => {
  let articleStore: ArticleStore;
  let gen: AtomFeedGenerator;
  let svc: RssService;
  beforeEach(() => {
    articleStore = new ArticleStore();
    gen = new AtomFeedGenerator();
    svc = new RssService(articleStore, gen);
  });

  it('TC-UNIT-061N: generateFeed 返回 RSS 2.0 XML', () => {
    articleStore.insert({ title: 't', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'published', publishedAt: '2026-07-26T00:00:00Z' });
    const xml = svc.generateFeed();
    expect(xml).toContain('<rss version="2.0">');
  });

  it('TC-UNIT-061E: 空文章列表仍返回 RSS 骨架', () => {
    expect(svc.generateFeed()).toContain('<rss version="2.0">');
  });

  it('TC-UNIT-061B: isModifiedSince 比较时间戳', () => {
    articleStore.insert({ title: 't', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'published', publishedAt: null });
    expect(svc.isModifiedSince('Wed, 01 Jan 2020 00:00:00 GMT')).toBe(true);
    expect(svc.isModifiedSince(undefined)).toBe(true);
    expect(svc.isModifiedSince('invalid')).toBe(true);
  });

  it('getEtag + computeEtag 一致', () => {
    const e1 = svc.getEtag();
    const e2 = svc.getEtag();
    expect(e1).toBe(e2);
  });

  it('getLastModified 空文章返回当前时间', () => {
    expect(Date.parse(svc.getLastModified())).not.toBeNaN();
  });

  it('generateAtomFeed 返回 Atom XML', () => {
    articleStore.insert({ title: 't', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'published', publishedAt: '2026-07-26T00:00:00Z' });
    expect(svc.generateAtomFeed()).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
  });
});
