// SD-007 SearchService + SearchStore unit tests (TC-UNIT-028 ~ TC-UNIT-031).

import { describe, it, expect, beforeEach } from 'vitest';
import { SearchStore } from '../../src/stores/search.store.js';
import { SearchService } from '../../src/services/search.service.js';
import { AppError } from '../../src/utils/errors.js';

describe('SD-007 SearchService + SearchStore (TC-UNIT-028 ~ 031)', () => {
  let searchStore: SearchStore;
  let searchService: SearchService;

  beforeEach(() => {
    searchStore = new SearchStore();
    searchService = new SearchService(searchStore);
  });

  it('TC-UNIT-028: full-text search returns intersection of inverted index', () => {
    // Index 2 articles containing "hello".
    searchStore.index('a-1', 'hello world', 'content here');
    searchStore.index('a-2', 'hello there', 'another content');

    const result = searchService.search(null, 'hello', 'relevance', 1, 10);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]!.score).toBeGreaterThan(0);
  });

  it('TC-UNIT-029: search history FIFO eviction caps at 20', () => {
    // Perform 21 searches to trigger FIFO eviction.
    for (let i = 0; i < 21; i++) {
      searchService.search('u-1', `query-${i}`, 'relevance', 1, 10);
    }
    const history = searchStore.getHistory('u-1');
    expect(history).toHaveLength(20);
    // Newest query should be at the front.
    expect(history[0]).toBe('query-20');
  });

  it('TC-UNIT-030: suggest returns prefix matches', () => {
    searchStore.index('a-1', 'hello world', 'content');
    const result = searchService.suggest('hel');
    expect(result).toContain('hello');
  });

  it('TC-UNIT-031: search query over 100 chars throws 1001', () => {
    const longQuery = 'a'.repeat(101);
    expect(() => searchService.search(null, longQuery, 'relevance', 1, 10)).toThrow(AppError);
    try {
      searchService.search(null, longQuery, 'relevance', 1, 10);
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }
  });
});
