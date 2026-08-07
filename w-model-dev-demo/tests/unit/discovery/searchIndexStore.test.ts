/**
 * UT-029 空关键词检索空结果（SearchIndexStore.query，DD-029/INTF-017）
 */
import { describe, it, expect } from 'vitest';
import { SearchIndexStore } from '../../../src/stores/searchIndexStore';

describe('UT-029 SearchIndexStore.query', () => {
  it('空串/空白关键词 → 空结果（不抛异常）', () => {
    const store = new SearchIndexStore();
    store.index('a_1', { title: 'W模型 实践', body: 'b', summary: 's', tags: [] });

    expect(store.query('', 1, 20).items).toEqual([]);
    expect(store.query('   ', 1, 20).items).toEqual([]);
  });
});
