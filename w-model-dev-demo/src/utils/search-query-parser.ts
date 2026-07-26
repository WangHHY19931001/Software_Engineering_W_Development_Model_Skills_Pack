/**
 * 搜索查询解析器（DD-015-003 SearchQueryParser）。
 */
export interface ParsedSearchQuery {
  keyword: string;
  tagIds: string[];
  categoryIds: string[];
  page: number;
  limit: number;
}

export class SearchQueryParser {
  parse(raw: {
    keyword?: string;
    tags?: string;
    categories?: string;
    tagIds?: string[];
    categoryIds?: string[];
    page?: string | number;
    limit?: string | number;
  }): ParsedSearchQuery {
    const keyword = (raw.keyword ?? '').trim();
    if (keyword.length === 0) {
      throw new Error('关键词必填');
    }

    let tagIds: string[] = [];
    if (Array.isArray(raw.tagIds)) {
      tagIds = raw.tagIds;
    } else if (typeof raw.tags === 'string' && raw.tags.length > 0) {
      tagIds = raw.tags.split(',').map((t) => t.trim()).filter(Boolean);
    }

    let categoryIds: string[] = [];
    if (Array.isArray(raw.categoryIds)) {
      categoryIds = raw.categoryIds;
    } else if (typeof raw.categories === 'string' && raw.categories.length > 0) {
      categoryIds = raw.categories.split(',').map((c) => c.trim()).filter(Boolean);
    }

    const page = this.parseNum(raw.page, 1, 1);
    const limit = this.parseNum(raw.limit, 10, 1, 100);

    return { keyword, tagIds, categoryIds, page, limit };
  }

  private parseNum(val: string | number | undefined, def: number, min: number, max?: number): number {
    if (val === undefined || val === null) return def;
    const n = typeof val === 'number' ? val : parseInt(val, 10);
    if (Number.isNaN(n)) return def;
    let result = Math.max(min, n);
    if (max !== undefined) {
      result = Math.min(max, result);
    }
    return result;
  }
}
