import { describe, it, expect } from 'vitest';
import { SearchQueryParser } from '../../../src/utils/search-query-parser.js';

describe('SearchQueryParser (DD-015-003)', () => {
  it('TC-UNIT-046N: 完整 raw 输入解析为结构化查询', () => {
    const p = new SearchQueryParser().parse({
      keyword: 'hello',
      tags: 't1,t2',
      categories: 'c1',
      page: '2',
      limit: '20',
    });
    expect(p.keyword).toBe('hello');
    expect(p.tagIds).toEqual(['t1', 't2']);
    expect(p.categoryIds).toEqual(['c1']);
    expect(p.page).toBe(2);
    expect(p.limit).toBe(20);
  });

  it('TC-UNIT-046E: 空 keyword 抛错', () => {
    expect(() => new SearchQueryParser().parse({ keyword: '  ' })).toThrow('关键词必填');
  });

  it('TC-UNIT-046B: page/limit 越界自动夹紧；tagIds 数组优先于 tags 字符串', () => {
    const p = new SearchQueryParser().parse({
      keyword: 'k',
      tagIds: ['t1'],
      page: 999,
      limit: 9999,
    });
    expect(p.tagIds).toEqual(['t1']);
    expect(p.limit).toBe(100);
  });

  it('默认 page=1, limit=10', () => {
    const p = new SearchQueryParser().parse({ keyword: 'k' });
    expect(p.page).toBe(1);
    expect(p.limit).toBe(10);
    expect(p.tagIds).toEqual([]);
  });

  it('page 非数字 fallback 默认值', () => {
    const p = new SearchQueryParser().parse({ keyword: 'k', page: 'abc' });
    expect(p.page).toBe(1);
  });
});
