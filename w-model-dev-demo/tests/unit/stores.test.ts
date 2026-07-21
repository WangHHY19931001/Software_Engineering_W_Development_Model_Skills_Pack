import { describe, it, expect, beforeEach } from 'vitest';
import { UserStore } from '../../src/stores/user.store.js';
import { ArticleStore } from '../../src/stores/article.store.js';
import { CommentStore } from '../../src/stores/comment.store.js';

/**
 * UT-030：UserStore / ArticleStore / CommentStore.clear 单元测试。
 * 设计来源：docs/detailed-design.md §4.1
 */
describe('Stores.clear()', () => {
  let userStore: UserStore;
  let articleStore: ArticleStore;
  let commentStore: CommentStore;

  beforeEach(() => {
    userStore = new UserStore();
    articleStore = new ArticleStore();
    commentStore = new CommentStore();
  });

  it('UT-030: UserStore.clear 后 findById/findByUsername 返回 undefined', () => {
    const now = new Date().toISOString();
    userStore.save({ id: 'u-1', username: 'alice', passwordHash: '$2b$10$xxx', createdAt: now });
    userStore.save({ id: 'u-2', username: 'bob', passwordHash: '$2b$10$yyy', createdAt: now });

    userStore.clear();

    expect(userStore.findById('u-1')).toBeUndefined();
    expect(userStore.findById('u-2')).toBeUndefined();
    expect(userStore.findByUsername('alice')).toBeUndefined();
  });

  it('UT-030: ArticleStore.clear 后 findById 返回 undefined，count()=0', () => {
    const now = new Date().toISOString();
    articleStore.save({
      id: 'a-1',
      authorId: 'u-1',
      title: 'T',
      content: 'C',
      tags: [],
      createdAt: now,
      updatedAt: now,
    });

    expect(articleStore.count()).toBe(1);
    articleStore.clear();

    expect(articleStore.findById('a-1')).toBeUndefined();
    expect(articleStore.count()).toBe(0);
    expect(articleStore.findAll(1, 10)).toHaveLength(0);
  });

  it('UT-030: CommentStore.clear 后 findById/findByArticleId 返回空', () => {
    const now = new Date().toISOString();
    commentStore.save({
      id: 'c-1',
      articleId: 'a-1',
      authorId: 'u-1',
      content: 'Nice',
      createdAt: now,
    });

    commentStore.clear();

    expect(commentStore.findById('c-1')).toBeUndefined();
    expect(commentStore.findByArticleId('a-1')).toHaveLength(0);
  });

  it('UT-030-extra: ArticleStore.findAll 分页 + createdAt 降序', () => {
    const base = new Date('2026-01-01T00:00:00.000Z').getTime();
    for (let i = 0; i < 5; i++) {
      const ts = new Date(base + i * 1000).toISOString();
      articleStore.save({
        id: `a-${i}`,
        authorId: 'u-1',
        title: `T-${i}`,
        content: 'C',
        tags: [],
        createdAt: ts,
        updatedAt: ts,
      });
    }

    const page1 = articleStore.findAll(1, 2);
    expect(page1).toHaveLength(2);
    // 降序：最新优先（a-4 createdAt 最大）
    expect(page1[0].id).toBe('a-4');
    expect(page1[1].id).toBe('a-3');

    const page2 = articleStore.findAll(2, 2);
    expect(page2[0].id).toBe('a-2');
    expect(page2[1].id).toBe('a-1');

    const page3 = articleStore.findAll(3, 2);
    expect(page3).toHaveLength(1);
  });
});
