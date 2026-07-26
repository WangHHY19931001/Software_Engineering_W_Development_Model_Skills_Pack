import { describe, it, expect, beforeEach } from 'vitest';
import { SiteStore } from '../../../src/stores/site.store.js';

describe('SiteStore', () => {
  let store: SiteStore;
  beforeEach(() => { store = new SiteStore(); });

  it('get 返回初始 0 统计', () => {
    const s = store.get();
    expect(s.totalUsers).toBe(0);
    expect(s.totalArticles).toBe(0);
  });

  it('update 增量更新', () => {
    const s = store.update({ totalUsers: 5 });
    expect(s.totalUsers).toBe(5);
    expect(store.get().totalUsers).toBe(5);
  });

  it('reset 重置为 0', () => {
    store.update({ totalUsers: 10, totalArticles: 5 });
    store.reset();
    expect(store.get().totalUsers).toBe(0);
  });
});
