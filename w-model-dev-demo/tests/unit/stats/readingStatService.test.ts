/**
 * UT-031 同 IP 5 分钟窗口去重（readingStatService.recordView，DD-031/INTF-018）
 * UT-054 去重窗口外重复访问 +1（边界）
 */
import { describe, it, expect } from 'vitest';
import { ReadingRecordStore } from '../../../src/stores/readingRecordStore';
import { ReadingStatService } from '../../../src/services/stats/readingStatService';

describe('UT-031 readingStatService.recordView 窗口去重', () => {
  it('同 clientIp+articleId 5 分钟窗口内重复访问不重复计数', () => {
    let now = Date.parse('2026-08-07T10:00:00.000Z');
    const store = new ReadingRecordStore();
    const service = new ReadingStatService(store, undefined, { windowMs: 300000, now: () => now });

    service.recordView('a_1001', '127.0.0.1');
    expect(store.countByArticle('a_1001')).toBe(1);

    now += 3 * 60 * 1000; // 推进 3 分钟（窗口内）
    service.recordView('a_1001', '127.0.0.1');
    expect(store.countByArticle('a_1001')).toBe(1);
    expect(store.isDuplicated('127.0.0.1', 'a_1001', 300000, now)).toBe(true);
  });
});

describe('UT-054 readingStatService.recordView 窗口外', () => {
  it('推进超过 5 分钟窗口后同 IP 再访问 → 新增记录（计数 +1）；首条已滑出窗口', () => {
    let now = Date.parse('2026-08-07T10:00:00.000Z');
    const store = new ReadingRecordStore();
    const service = new ReadingStatService(store, undefined, { windowMs: 300000, now: () => now });

    service.recordView('a_1001', '127.0.0.1');
    now += 6 * 60 * 1000; // 推进 6 分钟（窗口外）
    service.recordView('a_1001', '127.0.0.1');

    expect(store.countByArticle('a_1001')).toBe(2);
    // 首条记录与当前时刻距离 > 5 分钟窗口（窗口外边界 +1 成立；第二次访问未被首条去重）
    const records = store.findAll().sort((a, b) => Date.parse(a.viewedAt) - Date.parse(b.viewedAt));
    expect(now - Date.parse(records[0].viewedAt)).toBeGreaterThan(300000);
    expect(now - Date.parse(records[1].viewedAt)).toBeLessThanOrEqual(300000);
  });
});

describe('readingStatService 聚合查询（getViewCount/getViews7d/getTrend7d/getReadArticleIds/getTagPreference）', () => {
  it('聚合查询正确', () => {
    const store = new ReadingRecordStore();
    const now = Date.parse('2026-08-07T10:00:00.000Z');
    store.add({ id: 'r_1', articleId: 'a_1', clientIp: '1.1.1.1', userId: 'u_1', viewedAt: new Date(now - 1 * 86400000).toISOString() });
    store.add({ id: 'r_2', articleId: 'a_1', clientIp: '2.2.2.2', userId: 'u_1', viewedAt: new Date(now - 8 * 86400000).toISOString() }); // 7 天窗口外
    store.add({ id: 'r_3', articleId: 'a_2', clientIp: '3.3.3.3', userId: 'u_2', viewedAt: new Date(now - 1 * 86400000).toISOString() });
    const service = new ReadingStatService(store, undefined, { now: () => now });

    expect(service.getViewCount('a_1')).toBe(2);
    const views7d = service.getViews7d(['a_1', 'a_2']);
    expect(views7d.get('a_1')).toBe(1); // 8 天前不计入
    expect(views7d.get('a_2')).toBe(1);
    const trend = service.getTrend7d(['a_1']);
    expect(trend).toHaveLength(7);
    expect(service.getReadArticleIds('u_1')).toEqual(['a_1', 'a_1']);
    const pref = service.getTagPreference('u_1', new Map([['a_1', ['W模型']]]));
    expect(pref).toEqual([{ tag: 'W模型', score: 2 }]);
  });
});
