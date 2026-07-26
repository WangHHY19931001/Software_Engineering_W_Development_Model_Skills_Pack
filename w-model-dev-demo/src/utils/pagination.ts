/**
 * 分页工具（DD-006-003 PaginationUtil）。
 */
import type { PaginatedResult } from '../types.js';

export class PaginationUtil {
  static paginate<T>(items: T[], page: number, limit: number): PaginatedResult<T> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const start = (safePage - 1) * safeLimit;
    const end = start + safeLimit;
    const sliced = items.slice(start, end);
    return {
      items: sliced,
      total: items.length,
      page: safePage,
      limit: safeLimit,
    };
  }

  static sort<T>(items: T[], key: keyof T, order: 'asc' | 'desc' = 'desc'): T[] {
    const sorted = [...items].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av === bv) return 0;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      if (av < bv) return order === 'asc' ? -1 : 1;
      return order === 'asc' ? 1 : -1;
    });
    return sorted;
  }

  static validatePageLimit(page: number, limit: number): { page: number; limit: number } {
    return {
      page: Math.max(1, Math.floor(page)),
      limit: Math.max(1, Math.min(100, Math.floor(limit))),
    };
  }
}
