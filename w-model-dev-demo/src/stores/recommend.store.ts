// SD-004 RecommendStore.

import type { Article, RecommendSlot } from '../types.js';

export class RecommendStore {
  private slots = new Map<string, RecommendSlot>();
  private priorityQueue: string[] = [];

  getSlot(name: string): RecommendSlot | null {
    return this.slots.get(name) ?? null;
  }

  setSlot(name: string, articleId: string, priority: number): RecommendSlot {
    const slot: RecommendSlot = { name, articleId, priority };
    this.slots.set(name, slot);
    if (!this.priorityQueue.includes(name)) {
      this.priorityQueue.push(name);
    }
    this.priorityQueue.sort((a, b) => {
      const sa = this.slots.get(a);
      const sb = this.slots.get(b);
      const pa = sa ? sa.priority : 0;
      const pb = sb ? sb.priority : 0;
      return pb - pa;
    });
    return { ...slot };
  }

  listSlots(): RecommendSlot[] {
    return this.priorityQueue
      .map((n) => this.slots.get(n))
      .filter((s): s is RecommendSlot => !!s)
      .map((s) => ({ ...s }));
  }

  clear(): void {
    this.slots.clear();
    this.priorityQueue.length = 0;
  }

  // RecommendStore delegates hot/latest/personalized to ArticleStore; pure helpers:
  hotRank(article: Article): number {
    return article.viewCount * 1 + article.likeCount * 5 + article.commentCount * 10;
  }
}
