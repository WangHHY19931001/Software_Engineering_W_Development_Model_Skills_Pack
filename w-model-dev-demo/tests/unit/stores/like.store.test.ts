import { describe, it, expect, beforeEach } from 'vitest';
import { LikeStore } from '../../../src/stores/like.store.js';
import { ConflictError } from '../../../src/utils/errors.js';

describe('LikeStore (DD-018-003)', () => {
  let store: LikeStore;
  beforeEach(() => { store = new LikeStore(); });

  it('TC-UNIT-055N: toggle 切换点赞状态', () => {
    const r1 = store.toggle('u1', 'a1');
    expect(r1.liked).toBe(true);
    expect(store.exists('u1', 'a1')).toBe(true);
    const r2 = store.toggle('u1', 'a1');
    expect(r2.liked).toBe(false);
    expect(store.exists('u1', 'a1')).toBe(false);
  });

  it('TC-UNIT-055E: add 重复点赞抛 ConflictError', () => {
    store.add('u1', 'a1');
    expect(() => store.add('u1', 'a1')).toThrow(ConflictError);
  });

  it('TC-UNIT-055B: 复合主键 (userId, articleId) 隔离', () => {
    store.add('u1', 'a1');
    store.add('u2', 'a1');
    store.add('u1', 'a2');
    expect(store.countByArticle('a1')).toBe(2);
    expect(store.listByUser('u1')).toHaveLength(2);
  });

  it('remove 返回布尔', () => {
    store.add('u1', 'a1');
    expect(store.remove('u1', 'a1')).toBe(true);
    expect(store.remove('u1', 'a1')).toBe(false);
  });
});
