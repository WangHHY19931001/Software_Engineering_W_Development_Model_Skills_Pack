/**
 * SearchIndexStore（DD-029）：四字段拼接倒排索引（词 → 文章 id 列表 + 字段权重分）。
 * 字段权重：标题 4 > 标签 3 > 摘要 2 > 正文 1（REQ-023 相关性排序）。
 */
import { SnapshotStore, assertPage } from './base';
import type { Page } from '../types';

export interface SearchFields {
  title: string;
  body: string;
  summary: string;
  tags: string[];
}

interface SearchIndexState {
  /** token → articleId → 累计得分 */
  postings: Map<string, Map<string, number>>;
}

export interface SearchHit {
  id: string;
  score: number;
}

const FIELD_WEIGHTS: Array<[keyof SearchFields, number]> = [
  ['title', 4],
  ['tags', 3],
  ['summary', 2],
  ['body', 1],
];

/** 分词：字母数字（含 CJK）连续段，小写去重 */
export function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return [...new Set(matches)];
}

export class SearchIndexStore extends SnapshotStore<SearchIndexState> {
  protected state: SearchIndexState = { postings: new Map() };

  index(articleId: string, fields: SearchFields): void {
    this.remove(articleId);
    for (const [field, weight] of FIELD_WEIGHTS) {
      const tokens = field === 'tags' ? fields.tags.map((t) => t.toLowerCase()) : tokenize(fields[field]);
      for (const token of tokens) {
        if (!token) continue;
        const articleMap = this.state.postings.get(token) ?? new Map<string, number>();
        articleMap.set(articleId, (articleMap.get(articleId) ?? 0) + weight);
        this.state.postings.set(token, articleMap);
      }
    }
  }

  remove(articleId: string): void {
    for (const [token, articleMap] of this.state.postings) {
      if (articleMap.delete(articleId) && articleMap.size === 0) {
        this.state.postings.delete(token);
      }
    }
  }

  /** 检索（空关键词返回空，DD-029 query）；按得分降序 */
  query(q: string, page: number, pageSize: number): Page<SearchHit> {
    assertPage(page, pageSize);
    const all = this.queryAll(q);
    const start = (page - 1) * pageSize;
    return { items: all.slice(start, start + pageSize), total: all.length, page, pageSize };
  }

  /** 全量命中（不分页，供 service 层内部扫描后二次过滤/分页） */
  queryAll(q: string): SearchHit[] {
    const trimmed = q.trim();
    if (!trimmed) {
      return [];
    }
    const tokens = tokenize(trimmed);
    const scores = new Map<string, number>();
    for (const token of tokens) {
      const articleMap = this.state.postings.get(token);
      if (!articleMap) continue;
      for (const [articleId, score] of articleMap) {
        scores.set(articleId, (scores.get(articleId) ?? 0) + score);
      }
    }
    return [...scores.entries()]
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  }
}
