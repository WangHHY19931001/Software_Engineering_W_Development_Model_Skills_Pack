/**
 * ReadingRecordStore（DD-034）：ReadingRecord 实体存储；去重判定（clientIp+articleId+时间窗口）；聚合计数。
 * 窗口参数化（ID-8）：同 IP 阅读去重窗口默认 5 分钟，测试可注入假时钟/缩小窗口。
 */
import { SnapshotStore, nextId } from './base';
import type { ReadingRecord, TagScore, TrendPoint } from '../types';

interface ReadingRecordState {
  map: Map<string, ReadingRecord>;
  seq: { n: number };
}

export type ReadingRecordCreateInput = Omit<ReadingRecord, 'id'> & { id?: string };

export class ReadingRecordStore extends SnapshotStore<ReadingRecordState> {
  protected state: ReadingRecordState = { map: new Map(), seq: { n: 0 } };

  add(record: ReadingRecordCreateInput): ReadingRecord {
    const id = record.id ?? nextId('r', this.state.seq);
    const full: ReadingRecord = {
      id,
      articleId: record.articleId,
      clientIp: record.clientIp,
      userId: record.userId ?? null,
      viewedAt: record.viewedAt,
    };
    this.state.map.set(id, full);
    return full;
  }

  findAll(): ReadingRecord[] {
    return [...this.state.map.values()];
  }

  /** 去重窗口判定（闭区间：now − viewedAt ≤ windowMs 视为重复，DD-034/UT-034） */
  isDuplicated(clientIp: string, articleId: string, windowMs: number, now: number = Date.now()): boolean {
    for (const r of this.state.map.values()) {
      if (r.clientIp === clientIp && r.articleId === articleId) {
        if (now - Date.parse(r.viewedAt) <= windowMs) return true;
      }
    }
    return false;
  }

  countByArticle(articleId: string): number {
    let count = 0;
    for (const r of this.state.map.values()) {
      if (r.articleId === articleId) count += 1;
    }
    return count;
  }

  /** 近 since 时刻之后的阅读量聚合（热门 7 天窗口） */
  countByArticleSince(articleIds: string[], since: number): Map<string, number> {
    const result = new Map<string, number>();
    const idSet = new Set(articleIds);
    for (const r of this.state.map.values()) {
      if (idSet.has(r.articleId) && Date.parse(r.viewedAt) >= since) {
        result.set(r.articleId, (result.get(r.articleId) ?? 0) + 1);
      }
    }
    return result;
  }

  /** 近 days 天每日阅读趋势（7 项数组，无记录日期补 0，DD-031 getTrend7d） */
  countTrend(articleIds: string[], days: number, now: number = Date.now()): TrendPoint[] {
    const idSet = new Set(articleIds);
    const dates: string[] = [];
    const map = new Map<string, number>();
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
      dates.push(d);
      map.set(d, 0);
    }
    for (const r of this.state.map.values()) {
      if (!idSet.has(r.articleId)) continue;
      const day = r.viewedAt.slice(0, 10);
      if (map.has(day)) map.set(day, (map.get(day) ?? 0) + 1);
    }
    return dates.map((date) => ({ date, views: map.get(date) ?? 0 }));
  }

  /** 某用户阅读记录（个性化推荐数据源） */
  listByUser(userId: string): ReadingRecord[] {
    return [...this.state.map.values()].filter((r) => r.userId === userId);
  }

  /** 标签偏好聚合（DD-034）：按用户阅读历史聚合文章标签得分 */
  tagPreference(userId: string, tagsByArticle: Map<string, string[]>): TagScore[] {
    const scores = new Map<string, number>();
    for (const r of this.state.map.values()) {
      if (r.userId !== userId) continue;
      for (const tag of tagsByArticle.get(r.articleId) ?? []) {
        scores.set(tag, (scores.get(tag) ?? 0) + 1);
      }
    }
    return [...scores.entries()]
      .map(([tag, score]) => ({ tag, score }))
      .sort((a, b) => b.score - a.score || a.tag.localeCompare(b.tag));
  }
}
