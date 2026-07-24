/**
 * DD-023 SearchIndexer —— 搜索索引器
 *
 * 全文搜索（标题/内容/摘要）、标签/分类/博主搜索、搜索建议、
 * 搜索历史（50 条/用户 FIFO）。
 * 依赖：DD-009 ArticleStore。
 */
import type { Article, Page } from '../../types.js';
import { articleStore } from '../../stores/article-store.js';
import { AppError } from '../../utils/errors.js';

export type SearchSort = 'relevance' | 'latest' | 'hottest';
export type SearchField = 'title' | 'content' | 'summary';

interface SearchHit {
  articleId: string;
  score: number;
}

const HISTORY_MAX = 50;

/** 简单分词：按非字母数字字符切分，并小写化（中文按字符切） */
function tokenize(text: string): string[] {
  if (!text) return [];
  const tokens: string[] = [];
  // 英文/数字：按非字母数字切分
  const alnumTokens = text.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/i).filter(t => t.length > 0);
  for (const t of alnumTokens) {
    if (/^[a-z0-9]+$/i.test(t)) {
      tokens.push(t);
    } else {
      // 中文按单字切分（简化版）
      for (const ch of t) {
        if (/[\u4e00-\u9fa5]/.test(ch)) {
          tokens.push(ch);
        }
      }
      // 同时保留整体（多字中文词）
      if (t.length > 1) tokens.push(t);
    }
  }
  return tokens;
}

export class SearchIndexer {
  private invertedIndex: Map<string, Map<string, number>> = new Map(); // token -> (articleId -> 频次)
  private history: Map<string, string[]> = new Map(); // userId -> 搜索历史 FIFO
  private indexedArticles: Set<string> = new Set();

  /** 索引文章（对应 DD-023 indexArticle） */
  indexArticle(article: Article): void {
    // 若已索引，先移除旧索引
    if (this.indexedArticles.has(article.id)) {
      this.removeFromIndex(article.id);
    }
    this.indexedArticles.add(article.id);
    const text = `${article.title} ${article.summary ?? ''} ${article.content}`;
    const tokens = tokenize(text);
    const freq = new Map<string, number>();
    for (const t of tokens) {
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
    for (const [token, count] of freq) {
      let postings = this.invertedIndex.get(token);
      if (!postings) {
        postings = new Map();
        this.invertedIndex.set(token, postings);
      }
      postings.set(article.id, count);
    }
  }

  private removeFromIndex(articleId: string): void {
    for (const [token, postings] of this.invertedIndex.entries()) {
      postings.delete(articleId);
      if (postings.size === 0) {
        this.invertedIndex.delete(token);
      }
    }
    this.indexedArticles.delete(articleId);
  }

  /** 搜索（对应 DD-023 search） */
  search(query: string, sort: SearchSort, page: number, size: number, userId?: string): Page<Article> {
    if (!query || query.trim().length === 0) {
      throw new AppError(40003, '搜索关键词不能为空');
    }
    if (page < 1) throw new AppError(40003, 'page 必须 ≥ 1');
    if (size < 1 || size > 100) throw new AppError(40003, 'size 必须 ∈ [1,100]');
    const tokens = tokenize(query);
    const scores = new Map<string, number>();
    for (const token of tokens) {
      const postings = this.invertedIndex.get(token);
      if (!postings) continue;
      for (const [articleId, freq] of postings) {
        scores.set(articleId, (scores.get(articleId) ?? 0) + freq);
      }
    }
    let hits: SearchHit[] = Array.from(scores.entries())
      .map(([articleId, score]) => ({ articleId, score }))
      .filter(h => {
        const a = articleStore.findById(h.articleId);
        return a && a.status === 'published';
      });
    if (sort === 'latest') {
      hits.sort((a, b) => {
        const aa = articleStore.findById(a.articleId);
        const ba = articleStore.findById(b.articleId);
        return (ba?.createdAt ?? 0) - (aa?.createdAt ?? 0);
      });
    } else if (sort === 'hottest') {
      hits.sort((a, b) => {
        const aa = articleStore.findById(a.articleId);
        const ba = articleStore.findById(b.articleId);
        return (ba?.stats.heat ?? 0) - (aa?.stats.heat ?? 0);
      });
    } else {
      hits.sort((a, b) => b.score - a.score);
    }
    const total = hits.length;
    const start = (page - 1) * size;
    const slice = hits.slice(start, start + size);
    const list = slice
      .map(h => articleStore.findById(h.articleId))
      .filter((a): a is Article => a !== null);
    // 记录搜索历史
    if (userId) {
      this.recordHistory(userId, query);
    }
    return { list, total, page, pageSize: size };
  }

  /** 搜索建议（对应 DD-023 searchSuggest） */
  searchSuggest(prefix: string): string[] {
    if (!prefix || prefix.length < 1) {
      throw new AppError(40003, 'prefix 长度 ≥ 1');
    }
    const lower = prefix.toLowerCase();
    const suggestions: string[] = [];
    for (const token of this.invertedIndex.keys()) {
      if (token.startsWith(lower) && suggestions.length < 10) {
        suggestions.push(token);
      }
    }
    return suggestions;
  }

  /** 搜索历史（对应 DD-023 getSearchHistory） */
  getSearchHistory(userId: string): string[] {
    return [...(this.history.get(userId) ?? [])];
  }

  /** 清空历史（对应 DD-023 clearHistory） */
  clearHistory(userId: string): void {
    this.history.delete(userId);
  }

  private recordHistory(userId: string, query: string): void {
    let list = this.history.get(userId) ?? [];
    list = [query, ...list.filter(q => q !== query)].slice(0, HISTORY_MAX);
    this.history.set(userId, list);
  }

  /** 测试重置 */
  _reset(): void {
    this.invertedIndex.clear();
    this.history.clear();
    this.indexedArticles.clear();
  }
}
