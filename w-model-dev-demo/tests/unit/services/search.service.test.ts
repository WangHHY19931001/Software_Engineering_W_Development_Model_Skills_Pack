import { describe, it, expect, beforeEach } from 'vitest';
import { SearchService, ArchiveService } from '../../../src/services/search.service.js';
import { ArticleStore } from '../../../src/stores/article.store.js';

describe('SearchService (DD-015-002)', () => {
  let articleStore: ArticleStore;
  let svc: SearchService;
  beforeEach(() => {
    articleStore = new ArticleStore();
    svc = new SearchService(articleStore);
  });

  it('TC-UNIT-046N: search 关键词匹配标题', () => {
    articleStore.insert({ title: 'Hello World', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'published', publishedAt: null });
    articleStore.insert({ title: 'Other', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'published', publishedAt: null });
    const r = svc.search({ keyword: 'hello', page: 1, limit: 10 });
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.title).toBe('Hello World');
  });

  it('TC-UNIT-046E: search 草稿文章被排除', () => {
    articleStore.insert({ title: 'Hello', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'draft', publishedAt: null });
    const r = svc.search({ keyword: 'hello', page: 1, limit: 10 });
    expect(r.items).toHaveLength(0);
  });

  it('TC-UNIT-046B: search 按 tagIds 过滤', () => {
    articleStore.insert({ title: 'A', content: 'c', authorId: 'u1', categoryId: null, tagIds: ['t1'], status: 'published', publishedAt: null });
    articleStore.insert({ title: 'B', content: 'c', authorId: 'u1', categoryId: null, tagIds: ['t2'], status: 'published', publishedAt: null });
    const r = svc.search({ keyword: '', tagIds: ['t1'], page: 1, limit: 10 });
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.title).toBe('A');
  });

  it('searchRaw 委托 parser', () => {
    articleStore.insert({ title: 'Hello', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'published', publishedAt: null });
    const r = svc.searchRaw({ keyword: 'hello', page: '1', limit: '10' });
    expect(r.items).toHaveLength(1);
  });
});

describe('ArchiveService (DD-022-002)', () => {
  let articleStore: ArticleStore;
  let svc: ArchiveService;
  beforeEach(() => {
    articleStore = new ArticleStore();
    svc = new ArchiveService(articleStore);
  });

  it('TC-UNIT-069N: listArchive 按年月分组', () => {
    articleStore.insert({ title: 'a', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'published', publishedAt: '2026-07-01T00:00:00Z' });
    articleStore.insert({ title: 'b', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'published', publishedAt: '2026-06-01T00:00:00Z' });
    const items = svc.listArchive();
    expect(items).toHaveLength(2);
    expect(items[0]!.year).toBe(2026);
    expect(items[0]!.month).toBe(7);
  });

  it('TC-UNIT-069E: 空文章列表返回空数组', () => {
    expect(svc.listArchive()).toEqual([]);
  });

  it('TC-UNIT-069B: 同月多文章聚合计数', () => {
    articleStore.insert({ title: 'a', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'published', publishedAt: '2026-07-01T00:00:00Z' });
    articleStore.insert({ title: 'b', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'published', publishedAt: '2026-07-15T00:00:00Z' });
    const items = svc.listArchive();
    expect(items).toHaveLength(1);
    expect(items[0]!.count).toBe(2);
    expect(items[0]!.articleIds).toHaveLength(2);
  });
});
