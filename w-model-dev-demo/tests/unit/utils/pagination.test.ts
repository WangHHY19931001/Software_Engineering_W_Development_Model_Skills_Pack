import { describe, it, expect } from 'vitest';
import { PaginationUtil } from '../../../src/utils/pagination.js';

describe('PaginationUtil (DD-006-003)', () => {
  it('TC-UNIT-018N: paginate 正常分页', () => {
    const items = [1, 2, 3, 4, 5];
    const r = PaginationUtil.paginate(items, 1, 2);
    expect(r.items).toEqual([1, 2]);
    expect(r.total).toBe(5);
    expect(r.page).toBe(1);
    expect(r.limit).toBe(2);
  });

  it('TC-UNIT-018E: 越界页返回空数组', () => {
    const r = PaginationUtil.paginate([1, 2], 99, 10);
    expect(r.items).toEqual([]);
    expect(r.total).toBe(2);
  });

  it('TC-UNIT-018B: page=0 自动修正为 1', () => {
    const r = PaginationUtil.paginate([1, 2, 3], 0, 2);
    expect(r.page).toBe(1);
    expect(r.items).toEqual([1, 2]);
  });

  it('sort: desc 排序', () => {
    const items = [{ n: 1 }, { n: 3 }, { n: 2 }];
    const sorted = PaginationUtil.sort(items, 'n', 'desc');
    expect(sorted.map((x) => x.n)).toEqual([3, 2, 1]);
  });

  it('validatePageLimit: limit 上限 100', () => {
    expect(PaginationUtil.validatePageLimit(1, 9999).limit).toBe(100);
    expect(PaginationUtil.validatePageLimit(0, 0)).toEqual({ page: 1, limit: 1 });
  });
});
