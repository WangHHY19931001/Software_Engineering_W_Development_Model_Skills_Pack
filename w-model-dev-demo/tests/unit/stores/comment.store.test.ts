/**
 * CommentStore 单元测试（UT-009~011）。
 * findByArticleId 按 createdAt 升序 + 空结果返回 []。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CommentStore } from '../../../src/stores/comment.store';
import type { Comment } from '../../../src/types';

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'c1',
    articleId: 'a1',
    authorId: 'u1',
    content: 'Nice',
    createdAt: '2026-07-23T00:00:00.000Z',
    ...overrides,
  };
}

describe('CommentStore', () => {
  let store: CommentStore;
  beforeEach(() => {
    store = new CommentStore();
  });

  it('UT-009 insert + findById 往返一致', () => {
    store.insert(makeComment({ id: 'c1' }));
    expect(store.findById('c1')?.content).toBe('Nice');
    expect(store.findById('nope')).toBeNull();
  });

  it('UT-010 delete 存在删除/不存在返回 false', () => {
    store.insert(makeComment({ id: 'c1' }));
    expect(store.delete('c1')).toBe(true);
    expect(store.findById('c1')).toBeNull();
    expect(store.delete('nope')).toBe(false);
  });

  it('UT-011 findByArticleId 按 createdAt 升序 + 空结果', () => {
    store.insert(makeComment({ id: 'c1', articleId: 'a1', createdAt: '2026-07-23T02:00:00.000Z' }));
    store.insert(makeComment({ id: 'c2', articleId: 'a1', createdAt: '2026-07-23T01:00:00.000Z' }));
    const results = store.findByArticleId('a1');
    expect(results.length).toBe(2);
    expect(results[0].createdAt < results[1].createdAt).toBe(true);
    expect(store.findByArticleId('nope')).toEqual([]);
  });
});
