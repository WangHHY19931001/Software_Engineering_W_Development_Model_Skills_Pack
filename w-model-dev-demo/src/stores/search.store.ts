// SD-007 SearchStore: inverted index + history.

import { AppError, ErrorCode } from '../utils/errors.js';
import { SEARCH_HISTORY_MAX } from '../types.js';

export interface SearchHit {
  articleId: string;
  snippet: string;
  score: number;
}

export class SearchStore {
  private invertedIndex = new Map<string, Set<string>>();
  private articleTerms = new Map<string, Set<string>>();
  private articleSnippets = new Map<string, string>();
  private searchHistory = new Map<string, string[]>();

  index(articleId: string, title: string, content: string): void {
    if (!articleId) throw new AppError(ErrorCode.NotFound, '1031');
    const terms = this.tokenize(`${title} ${content}`);
    // Remove old terms for this article.
    const old = this.articleTerms.get(articleId);
    if (old) {
      for (const t of old) {
        const set = this.invertedIndex.get(t);
        if (set) {
          set.delete(articleId);
          if (set.size === 0) this.invertedIndex.delete(t);
        }
      }
    }
    const newTerms = new Set<string>();
    for (const t of terms) {
      newTerms.add(t);
      let set = this.invertedIndex.get(t);
      if (!set) {
        set = new Set();
        this.invertedIndex.set(t, set);
      }
      set.add(articleId);
    }
    this.articleTerms.set(articleId, newTerms);
    this.articleSnippets.set(articleId, content.slice(0, 120));
  }

  search(query: string): SearchHit[] {
    const terms = this.tokenize(query);
    if (terms.length === 0) return [];
    let candidate: Set<string> | null = null;
    for (const t of terms) {
      const set = this.invertedIndex.get(t);
      if (!set) return [];
      if (candidate === null) {
        candidate = new Set(set);
      } else {
        const next = new Set<string>();
        for (const id of candidate) {
          if (set.has(id)) next.add(id);
        }
        candidate = next;
      }
    }
    if (!candidate) return [];
    const hits: SearchHit[] = [];
    for (const articleId of candidate) {
      const snippet = this.articleSnippets.get(articleId) ?? '';
      // Score = sum of term frequencies.
      let score = 0;
      for (const t of terms) {
        const set = this.invertedIndex.get(t);
        if (set && set.has(articleId)) score += 1;
      }
      hits.push({ articleId, snippet, score });
    }
    return hits;
  }

  suggest(prefix: string, topN = 10): string[] {
    const matches: string[] = [];
    for (const term of this.invertedIndex.keys()) {
      if (term.startsWith(prefix)) matches.push(term);
    }
    return matches.slice(0, topN);
  }

  appendHistory(userId: string, query: string): void {
    let arr = this.searchHistory.get(userId);
    if (!arr) {
      arr = [];
      this.searchHistory.set(userId, arr);
    }
    // FIFO: remove any existing same query, then unshift latest.
    const idx = arr.indexOf(query);
    if (idx >= 0) arr.splice(idx, 1);
    arr.unshift(query);
    if (arr.length > SEARCH_HISTORY_MAX) {
      arr.length = SEARCH_HISTORY_MAX;
    }
  }

  getHistory(userId: string): string[] {
    const arr = this.searchHistory.get(userId);
    return arr ? [...arr] : [];
  }

  clearHistory(userId: string): void {
    this.searchHistory.delete(userId);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9\u4e00-\u9fa5]+/)
      .filter((s) => s.length > 0);
  }

  clear(): void {
    this.invertedIndex.clear();
    this.articleTerms.clear();
    this.articleSnippets.clear();
    this.searchHistory.clear();
  }
}
