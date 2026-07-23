/**
 * ArticleStore 单元测试（UT-005~008）。
 * findAll 按 createdAt 降序分页 + 越界返回空数组。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleStore } from '../../../src/stores/article.store';
import type { Article } from '../../../src/types';

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'a1',
    authorId: 'u1',
    title: 'Hello',
    content: 'Body',
    tags: [],
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
    ...overrides,
  };
}

describe('ArticleStore', () => {
  let store: ArticleStore;
  beforeEach(() => {
    store = new ArticleStore();
  });

  it('UT-005 insert + findById 往返一致', () => {
    store.insert(makeArticle({ id: 'a1' }));
    expect(store.findById('a1')?.title).toBe('Hello');
    expect(store.findById('nope')).toBeNull();
  });

  it('UT-006 update 存在更新/不存在返回 null', () => {
    store.insert(makeArticle({ id: 'a1', createdAt: '2020-01-01T00:00:00.000Z' }));
    const updated = store.update('a1', { title: 'v2' });
    expect(updated?.title).toBe('v2');
    expect(updated!.updatedAt > updated!.createdAt).toBe(true);
    expect(store.update('nope', { title: 'v2' })).toBeNull();
  });

  it('UT-007 delete 存在删除/不存在返回 false', () => {
    store.insert(makeArticle({ id: 'a1' }));
    expect(store.delete('a1')).toBe(true);
    expect(store.findById('a1')).toBeNull();
    expect(store.delete('nope')).toBe(false);
  });

  it('UT-008 findAll 按 createdAt 降序分页 + 越界', () => {
    store.insert(makeArticle({ id: 'a1', createdAt: '2026-07-23T01:00:00.000Z' }));
    store.insert(makeArticle({ id: 'a2', createdAt: '2026-07-23T03:00:00.000Z' }));
    store.insert(makeArticle({ id: 'a3', createdAt: '2026-07-23T02:00:00.000Z' }));

    const p1 = store.findAll(1, 2);
    expect(p1.items.length).toBe(2);
    expect(p1.items[0].createdAt > p1.items[1].createdAt).toBe(true);
    expect(p1.total).toBe(3);

    const p2 = store.findAll(2, 2);
    expect(p2.items.length).toBe(1);
    expect(p2.total).toBe(3);

    const overflow = store.findAll(5, 2);
    expect(overflow.items.length).toBe(0);
    expect(overflow.total).toBe(3);
  });
});
