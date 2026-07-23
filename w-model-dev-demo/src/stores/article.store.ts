/**
 * ArticleStore：文章内存存储（realizes INTF-011 / DD-002）。
 * findAll 按 createdAt 降序分页。
 */
import type { Article } from '../types';

export class ArticleStore {
  private readonly articles = new Map<string, Article>();

  insert(article: Article): void {
    this.articles.set(article.id, article);
  }

  findById(id: string): Article | null {
    return this.articles.get(id) ?? null;
  }

  update(id: string, patch: Partial<Article>): Article | null {
    const existing = this.articles.get(id);
    if (!existing) return null;
    const updated: Article = {
      ...existing,
      ...patch,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };
    this.articles.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.articles.delete(id);
  }

  findAll(page: number, pageSize: number): { items: Article[]; total: number } {
    const all = Array.from(this.articles.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    const start = (page - 1) * pageSize;
    const items = start < 0 || start >= all.length ? [] : all.slice(start, start + pageSize);
    return { items, total: all.length };
  }

  clear(): void {
    this.articles.clear();
  }

  size(): number {
    return this.articles.size;
  }
}
