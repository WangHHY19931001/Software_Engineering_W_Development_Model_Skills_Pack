import type { Article } from '../types.js';
import { NotFoundError } from '../utils/errors.js';

class ArticleStore {
  private byId = new Map<string, Article>();

  insert(article: Article): void {
    this.byId.set(article.id, article);
  }

  findById(id: string): Article | undefined {
    return this.byId.get(id);
  }

  update(id: string, patch: Partial<Article>): Article {
    const existing = this.byId.get(id);
    if (!existing) throw new NotFoundError(`Article "${id}" not found`);
    const updated: Article = { ...existing, ...patch, id: existing.id };
    this.byId.set(id, updated);
    return updated;
  }

  remove(id: string): void {
    if (!this.byId.has(id)) throw new NotFoundError(`Article "${id}" not found`);
    this.byId.delete(id);
  }

  list(): Article[] {
    return Array.from(this.byId.values());
  }

  clear(): void {
    this.byId.clear();
  }
}

export const articleStore = new ArticleStore();
