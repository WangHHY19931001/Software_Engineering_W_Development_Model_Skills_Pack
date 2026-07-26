/**
 * ArticleStore（DD-005-003）— 文章存储 + authorId/status 索引。
 */
import type { Article, ArticleQuery, ArticleStatus } from '../types.js';
import { NotFoundError } from '../utils/errors.js';
import { generateId } from '../utils/id.js';
import { PaginationUtil } from '../utils/pagination.js';

export class ArticleStore {
  private articles: Map<string, Article> = new Map();
  private authorIndex: Map<string, Set<string>> = new Map();
  private statusIndex: Map<string, Set<string>> = new Map();

  insert(article: Omit<Article, 'id' | 'createdAt' | 'updatedAt' | 'likeCount' | 'viewCount'> & {
    id?: string; likeCount?: number; viewCount?: number;
  }): Article {
    const now = new Date().toISOString();
    const record: Article = {
      id: article.id ?? generateId('article'),
      title: article.title,
      content: article.content,
      authorId: article.authorId,
      categoryId: article.categoryId,
      tagIds: article.tagIds,
      status: article.status,
      likeCount: article.likeCount ?? 0,
      viewCount: article.viewCount ?? 0,
      publishedAt: article.publishedAt,
      createdAt: now,
      updatedAt: now,
    };
    this.articles.set(record.id, record);
    this.addToIndex(this.authorIndex, record.authorId, record.id);
    this.addToIndex(this.statusIndex, record.status, record.id);
    return record;
  }

  private addToIndex(idx: Map<string, Set<string>>, key: string, value: string): void {
    let set = idx.get(key);
    if (!set) {
      set = new Set();
      idx.set(key, set);
    }
    set.add(value);
  }

  private removeFromIndex(idx: Map<string, Set<string>>, key: string, value: string): void {
    const set = idx.get(key);
    if (set) {
      set.delete(value);
      if (set.size === 0) idx.delete(key);
    }
  }

  findById(id: string): Article | undefined {
    return this.articles.get(id);
  }

  update(id: string, patch: Partial<Article>): Article {
    const article = this.articles.get(id);
    if (!article) throw new NotFoundError('文章');
    const oldStatus = article.status;
    const oldAuthor = article.authorId;
    const updated: Article = {
      ...article,
      ...patch,
      id: article.id,
      createdAt: article.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.articles.set(id, updated);
    if (patch.status !== undefined && patch.status !== oldStatus) {
      this.removeFromIndex(this.statusIndex, oldStatus, id);
      this.addToIndex(this.statusIndex, updated.status, id);
    }
    if (patch.authorId !== undefined && patch.authorId !== oldAuthor) {
      this.removeFromIndex(this.authorIndex, oldAuthor, id);
      this.addToIndex(this.authorIndex, updated.authorId, id);
    }
    return updated;
  }

  delete(id: string): boolean {
    const article = this.articles.get(id);
    if (!article) return false;
    this.removeFromIndex(this.authorIndex, article.authorId, id);
    this.removeFromIndex(this.statusIndex, article.status, id);
    return this.articles.delete(id);
  }

  listAll(): Article[] {
    return [...this.articles.values()];
  }

  listPublished(): Article[] {
    return this.listByStatus('published');
  }

  listByStatus(status: ArticleStatus): Article[] {
    const ids = this.statusIndex.get(status);
    if (!ids) return [];
    const result: Article[] = [];
    for (const id of ids) {
      const a = this.articles.get(id);
      if (a) result.push(a);
    }
    return result;
  }

  listByAuthor(authorId: string): Article[] {
    const ids = this.authorIndex.get(authorId);
    if (!ids) return [];
    const result: Article[] = [];
    for (const id of ids) {
      const a = this.articles.get(id);
      if (a) result.push(a);
    }
    return result;
  }

  query(q: ArticleQuery): { items: Article[]; total: number; page: number; limit: number } {
    let items = this.listAll();
    if (q.status !== undefined) {
      items = items.filter((a) => a.status === q.status);
    }
    if (q.authorId !== undefined) {
      items = items.filter((a) => a.authorId === q.authorId);
    }
    if (q.tagId !== undefined) {
      items = items.filter((a) => a.tagIds.includes(q.tagId!));
    }
    if (q.categoryId !== undefined) {
      items = items.filter((a) => a.categoryId === q.categoryId);
    }
    const sortKey = q.sort ?? 'createdAt';
    const order = q.order ?? 'desc';
    items = PaginationUtil.sort(items, sortKey, order);
    return PaginationUtil.paginate(items, q.page, q.limit);
  }

  incrementView(id: string): void {
    const article = this.articles.get(id);
    if (article) {
      article.viewCount += 1;
    }
  }

  incrementLike(id: string): void {
    const article = this.articles.get(id);
    if (article) {
      article.likeCount += 1;
    }
  }

  decrementLike(id: string): void {
    const article = this.articles.get(id);
    if (article && article.likeCount > 0) {
      article.likeCount -= 1;
    }
  }

  size(): number {
    return this.articles.size;
  }

  clear(): void {
    this.articles.clear();
    this.authorIndex.clear();
    this.statusIndex.clear();
  }
}
