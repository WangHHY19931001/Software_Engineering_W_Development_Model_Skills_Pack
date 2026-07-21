import type { Article } from '../types.js';

/**
 * 内存文章存储。
 *
 * 设计来源：`docs/detailed-design.md` §1.1 / §2.3 / §3.2 / CON-002。
 * - 主键 `id` 作为 Map key（O(1) 查找）。
 * - `findAll(page, pageSize, tag?)` 按 `createdAt` 降序（最新优先）分页；可选 tag 过滤。
 * - `count(tag?)` 返回（可选过滤后）总数。
 */
export class ArticleStore {
  private readonly articles: Map<string, Article> = new Map();

  save(article: Article): Article {
    this.articles.set(article.id, article);
    return article;
  }

  findById(id: string): Article | undefined {
    return this.articles.get(id);
  }

  delete(id: string): boolean {
    return this.articles.delete(id);
  }

  /**
   * 分页查询文章列表。
   * - 按 `createdAt` 降序（最新优先）。
   * - `tag` 可选；提供时仅返回 tags 数组中包含该值的文章。
   * - page 从 1 开始；pageSize ≥ 1。
   */
  findAll(page: number, pageSize: number, tag?: string): Article[] {
    let list = Array.from(this.articles.values());
    if (tag) {
      list = list.filter(a => a.tags.includes(tag));
    }
    list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }

  count(tag?: string): number {
    if (!tag) return this.articles.size;
    let n = 0;
    for (const a of this.articles.values()) {
      if (a.tags.includes(tag)) n += 1;
    }
    return n;
  }

  clear(): void {
    this.articles.clear();
  }
}
