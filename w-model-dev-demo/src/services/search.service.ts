/**
 * SearchService（DD-015-002）+ ArchiveService（DD-022-002）。
 */
import type { Article, PaginatedResult, ArchiveItem, SearchQuery } from '../types.js';
import type { ArticleStore } from '../stores/article.store.js';
import { PaginationUtil } from '../utils/pagination.js';
import { SearchQueryParser } from '../utils/search-query-parser.js';

export class SearchService {
  private parser = new SearchQueryParser();

  constructor(private articleStore: ArticleStore) {}

  search(query: SearchQuery): PaginatedResult<Article> {
    let items = this.articleStore.listPublished();
    const keyword = query.keyword.toLowerCase();
    if (keyword.length > 0) {
      items = items.filter(
        (a) =>
          a.title.toLowerCase().includes(keyword) ||
          a.content.toLowerCase().includes(keyword),
      );
    }
    if (query.tagIds !== undefined && query.tagIds.length > 0) {
      items = items.filter((a) => query.tagIds!.some((t) => a.tagIds.includes(t)));
    }
    if (query.categoryIds !== undefined && query.categoryIds.length > 0) {
      items = items.filter(
        (a) => a.categoryId !== null && query.categoryIds!.includes(a.categoryId),
      );
    }
    items = PaginationUtil.sort(items, 'createdAt', 'desc');
    return PaginationUtil.paginate(items, query.page, query.limit);
  }

  searchRaw(raw: Parameters<SearchQueryParser['parse']>[0]): PaginatedResult<Article> {
    const parsed = this.parser.parse(raw);
    return this.search(parsed);
  }
}

export class ArchiveService {
  constructor(private articleStore: ArticleStore) {}

  listArchive(): ArchiveItem[] {
    const articles = this.articleStore.listPublished();
    const buckets = new Map<string, ArchiveItem>();
    for (const a of articles) {
      const date = new Date(a.publishedAt ?? a.createdAt);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1;
      const key = `${year}-${month.toString().padStart(2, '0')}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { year, month, count: 0, articleIds: [] };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      bucket.articleIds.push(a.id);
    }
    return [...buckets.values()].sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return b.month - a.month;
    });
  }
}
