import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleStore } from '../../../src/stores/article.store.js';
import { NotFoundError } from '../../../src/utils/errors.js';

describe('ArticleStore (DD-005-003)', () => {
  let store: ArticleStore;
  beforeEach(() => { store = new ArticleStore(); });

  function mkArticle(overrides: Partial<Parameters<ArticleStore['insert']>[0]> = {}) {
    return store.insert({
      title: 't',
      content: 'c',
      authorId: 'u1',
      categoryId: null,
      tagIds: [],
      status: 'draft',
      publishedAt: null,
      ...overrides,
    });
  }

  it('TC-UNIT-016N: insert + findById + listAll 正常往返', () => {
    const a = mkArticle();
    expect(a.id).toBeTruthy();
    expect(store.findById(a.id)?.title).toBe('t');
    expect(store.listAll()).toHaveLength(1);
  });

  it('TC-UNIT-016E: update 不存在抛 NotFoundError', () => {
    expect(() => store.update('missing', { title: 'x' })).toThrow(NotFoundError);
  });

  it('TC-UNIT-016B: statusIndex 与 authorIndex 一致性', () => {
    mkArticle({ status: 'published', authorId: 'u1' });
    mkArticle({ status: 'published', authorId: 'u1' });
    mkArticle({ status: 'draft', authorId: 'u2' });
    expect(store.listByStatus('published')).toHaveLength(2);
    expect(store.listByAuthor('u1')).toHaveLength(2);
    expect(store.listPublished()).toHaveLength(2);
  });

  it('query: 分页+过滤+排序', () => {
    mkArticle({ status: 'published', authorId: 'u1' });
    mkArticle({ status: 'published', authorId: 'u2' });
    mkArticle({ status: 'draft', authorId: 'u1' });
    const r = store.query({ page: 1, limit: 10, status: 'published', sort: 'createdAt', order: 'asc' });
    expect(r.items).toHaveLength(2);
    expect(r.total).toBe(2);
  });

  it('delete: 同步清理索引', () => {
    const a = mkArticle({ status: 'published', authorId: 'u1' });
    store.delete(a.id);
    expect(store.listByStatus('published')).toHaveLength(0);
    expect(store.listByAuthor('u1')).toHaveLength(0);
  });

  it('incrementView / incrementLike / decrementLike', () => {
    const a = mkArticle();
    store.incrementView(a.id);
    store.incrementLike(a.id);
    store.incrementLike(a.id);
    store.decrementLike(a.id);
    const updated = store.findById(a.id)!;
    expect(updated.viewCount).toBe(1);
    expect(updated.likeCount).toBe(1);
  });

  it('update: status 变更同步索引', () => {
    const a = mkArticle({ status: 'draft' });
    store.update(a.id, { status: 'published' });
    expect(store.listByStatus('draft')).toHaveLength(0);
    expect(store.listByStatus('published')).toHaveLength(1);
  });
});
