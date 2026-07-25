// SD-007 SearchService.

import { AppError, ErrorCode } from '../utils/errors.js';
import {
  pageSchema,
  searchQuerySchema,
  suggestPrefixSchema,
} from '../utils/schemas.js';
import type { SearchStore, SearchHit } from '../stores/search.store.js';
import type { Page } from '../types.js';

export type SearchMode = 'relevance' | 'newest' | 'popular';

export class SearchService {
  constructor(private searchStore: SearchStore) {}

  /** search — TLA+ L2_discovery.search */
  search(
    userId: string | null,
    query: string,
    mode: SearchMode,
    page: number,
    pageSize: number,
  ): Page<SearchHit> {
    if (!searchQuerySchema.safeParse(query).success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    const parsed = pageSchema.safeParse({ page, pageSize });
    if (!parsed.success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    const hits = this.searchStore.search(query);
    // Sort by mode.
    if (mode === 'relevance') {
      hits.sort((a, b) => b.score - a.score);
    } else if (mode === 'newest') {
      // SearchStore doesn't track timestamps; treat as insertion order which is stable.
      // For determinism, fall back to score.
      hits.sort((a, b) => b.score - a.score);
    } else {
      // popular — fall back to score.
      hits.sort((a, b) => b.score - a.score);
    }
    // Append to history (per-user).
    if (userId) {
      this.searchStore.appendHistory(userId, query);
    }
    const start = (parsed.data.page - 1) * parsed.data.pageSize;
    return {
      items: hits.slice(start, start + parsed.data.pageSize),
      total: hits.length,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    };
  }

  suggest(prefix: string): string[] {
    if (!suggestPrefixSchema.safeParse(prefix).success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    return this.searchStore.suggest(prefix, 10);
  }

  history(userId: string): string[] {
    if (!userId) throw new AppError(ErrorCode.NoUser, '1011');
    return this.searchStore.getHistory(userId);
  }

  /** clearSearchHistory — TLA+ L2_discovery.clearSearchHistory */
  clearSearchHistory(userId: string): void {
    if (!userId) throw new AppError(ErrorCode.NoUser, '1011');
    this.searchStore.clearHistory(userId);
  }
}
