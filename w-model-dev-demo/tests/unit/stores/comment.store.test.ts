import { describe, it, expect, beforeEach } from 'vitest';
import { CommentStore } from '../../../src/stores/comment.store.js';
import { NotFoundError } from '../../../src/utils/errors.js';

describe('CommentStore (DD-010-003)', () => {
  let store: CommentStore;
  beforeEach(() => { store = new CommentStore(); });

  it('TC-UNIT-032N: insert + findById + listByArticle 正常往返', () => {
    const c = store.insert({ articleId: 'a1', userId: 'u1', content: 'hi' });
    expect(c.id).toBeTruthy();
    expect(store.findById(c.id)?.content).toBe('hi');
    expect(store.listByArticle('a1', 1, 10).items).toHaveLength(1);
  });

  it('TC-UNIT-032E: update 不存在抛 NotFoundError', () => {
    expect(() => store.update('missing', { content: 'x' })).toThrow(NotFoundError);
  });

  it('TC-UNIT-032B: deleteByArticle 级联清理', () => {
    store.insert({ articleId: 'a1', userId: 'u1', content: 'c1' });
    store.insert({ articleId: 'a1', userId: 'u2', content: 'c2' });
    store.insert({ articleId: 'a2', userId: 'u1', content: 'c3' });
    expect(store.deleteByArticle('a1')).toBe(2);
    expect(store.size()).toBe(1);
  });

  it('listByUser 按 userId 过滤', () => {
    store.insert({ articleId: 'a1', userId: 'u1', content: 'x' });
    store.insert({ articleId: 'a2', userId: 'u2', content: 'y' });
    expect(store.listByUser('u1')).toHaveLength(1);
  });

  it('delete 同步清理 articleIndex', () => {
    const c = store.insert({ articleId: 'a1', userId: 'u1', content: 'x' });
    store.delete(c.id);
    expect(store.listByArticle('a1', 1, 10).items).toHaveLength(0);
  });
});
