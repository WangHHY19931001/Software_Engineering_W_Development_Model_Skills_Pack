/**
 * UT-034 阅读去重窗口边界判定（ReadingRecordStore.isDuplicated，DD-034/INTF-018）
 */
import { describe, it, expect } from 'vitest';
import { ReadingRecordStore } from '../../../src/stores/readingRecordStore';

describe('UT-034 ReadingRecordStore.isDuplicated 窗口边界', () => {
  it('=windowMs 处视为重复（闭区间）；超出窗口不重复', () => {
    const now = Date.parse('2026-08-07T10:00:00.000Z');
    const store = new ReadingRecordStore();
    store.add({ id: 'r_0001', articleId: 'a_1001', clientIp: '127.0.0.1', userId: null, viewedAt: new Date(now - 300000).toISOString() });

    expect(store.isDuplicated('127.0.0.1', 'a_1001', 300000, now)).toBe(true);
    expect(store.isDuplicated('127.0.0.1', 'a_1001', 300000, now + 1)).toBe(false);
  });
});

describe('ReadingRecordStore 聚合（countByArticleSince/countTrend/listByUser/tagPreference）', () => {
  const now = Date.parse('2026-08-07T10:00:00.000Z');

  it('countByArticleSince：仅统计 since 之后的记录', () => {
    const store = new ReadingRecordStore();
    store.add({ id: 'r_1', articleId: 'a_1', clientIp: '1.1.1.1', userId: 'u_1', viewedAt: new Date(now - 8 * 86400000).toISOString() }); // 8 天前（7 天窗口外）
    store.add({ id: 'r_2', articleId: 'a_1', clientIp: '1.1.1.1', userId: 'u_1', viewedAt: new Date(now - 1 * 86400000).toISOString() }); // 1 天前
    const views = store.countByArticleSince(['a_1'], now - 7 * 86400000);
    expect(views.get('a_1')).toBe(1);
  });

  it('countTrend：7 项数组，无记录日期补 0', () => {
    const store = new ReadingRecordStore();
    store.add({ id: 'r_1', articleId: 'a_1', clientIp: '1.1.1.1', userId: 'u_1', viewedAt: new Date(now - 1 * 86400000).toISOString() });
    const trend = store.countTrend(['a_1'], 7, now);
    expect(trend).toHaveLength(7);
    expect(trend.filter((t) => t.views === 0)).toHaveLength(6);
    expect(trend.find((t) => t.views === 1)?.date).toBe(new Date(now - 1 * 86400000).toISOString().slice(0, 10));
  });

  it('listByUser + tagPreference：按用户阅读历史聚合标签得分', () => {
    const store = new ReadingRecordStore();
    store.add({ id: 'r_1', articleId: 'a_1', clientIp: '1.1.1.1', userId: 'u_1', viewedAt: '2026-08-07T10:00:00.000Z' });
    store.add({ id: 'r_2', articleId: 'a_2', clientIp: '1.1.1.1', userId: 'u_1', viewedAt: '2026-08-07T10:01:00.000Z' });
    store.add({ id: 'r_3', articleId: 'a_3', clientIp: '2.2.2.2', userId: 'u_2', viewedAt: '2026-08-07T10:02:00.000Z' });

    expect(store.listByUser('u_1')).toHaveLength(2);
    const tagsByArticle = new Map([
      ['a_1', ['W模型']],
      ['a_2', ['W模型', '工程']],
      ['a_3', ['其他']],
    ]);
    const pref = store.tagPreference('u_1', tagsByArticle);
    expect(pref).toEqual([
      { tag: 'W模型', score: 2 },
      { tag: '工程', score: 1 },
    ]);
  });

  it('countByArticle / findAll / add 落库', () => {
    const store = new ReadingRecordStore();
    const record = store.add({ articleId: 'a_1', clientIp: '1.1.1.1', userId: null, viewedAt: '2026-08-07T10:00:00.000Z' });
    expect(record.id).toMatch(/^r_\d{4}$/);
    expect(store.findAll()).toHaveLength(1);
    expect(store.countByArticle('a_1')).toBe(1);
  });
});
