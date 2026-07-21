import type { Article } from '../types.js';

class ArticleStoreImpl {
  private articles = new Map<string, Article>();

  save(article: Article): void {
    this.articles.set(article.id, article);
  }

  findById(id: string): Article | undefined {
    return this.articles.get(id);
  }

  findAll(page: number, pageSize: number): { items: Article[]; total: number } {
    const all = Array.from(this.articles.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    const start = (page - 1) * pageSize;
    return { items: all.slice(start, start + pageSize), total: all.length };
  }

  delete(id: string): boolean {
    return this.articles.delete(id);
  }

  clear(): void {
    this.articles.clear();
  }

  size(): number {
    return this.articles.size;
  }
}

export const articleStore = new ArticleStoreImpl();
