// SD-012 ArticleStore.

import {
  ArticleStatus,
  ScheduleStatus,
  type Article,
  type ArticleInput,
} from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { articleInputSchema } from '../utils/schemas.js';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `a-${counter}`;
}

export class ArticleStore {
  private articles = new Map<string, Article>();
  private authorIdToArticles = new Map<string, Set<string>>();
  private statusToArticles = new Map<ArticleStatus, Set<string>>();
  private seriesIdToArticles = new Map<string, Set<string>>();

  size(): number {
    return this.articles.size;
  }

  statusSize(status: ArticleStatus): number {
    const set = this.statusToArticles.get(status);
    return set ? set.size : 0;
  }

  getById(id: string): Article | null {
    const a = this.articles.get(id);
    return a ? { ...a } : null;
  }

  listByStatus(status: ArticleStatus): Article[] {
    const set = this.statusToArticles.get(status);
    if (!set) return [];
    const out: Article[] = [];
    for (const id of set) {
      const a = this.articles.get(id);
      if (a) out.push({ ...a });
    }
    return out;
  }

  listByAuthor(authorId: string): Article[] {
    const set = this.authorIdToArticles.get(authorId);
    if (!set) return [];
    const out: Article[] = [];
    for (const id of set) {
      const a = this.articles.get(id);
      if (a) out.push({ ...a });
    }
    return out;
  }

  create(authorId: string, input: ArticleInput): Article {
    const parsed = articleInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    const now = new Date();
    const article: Article = {
      id: nextId(),
      authorId,
      title: parsed.data.title,
      content: parsed.data.content,
      summary: parsed.data.summary ?? '',
      coverImageUrl: parsed.data.coverImageUrl ?? null,
      status: ArticleStatus.Draft,
      seriesId: parsed.data.seriesId ?? null,
      seriesOrder: parsed.data.seriesOrder ?? 0,
      scheduledAt: parsed.data.scheduledAt ?? null,
      publishedAt: null,
      archivedAt: null,
      scheduleStatus: ScheduleStatus.None,
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      categoryId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.articles.set(article.id, article);
    this.indexAdd(this.authorIdToArticles, authorId, article.id);
    this.indexAdd(this.statusToArticles, ArticleStatus.Draft, article.id);
    if (article.seriesId) {
      this.indexAdd(this.seriesIdToArticles, article.seriesId, article.id);
    }
    return { ...article };
  }

  update(article: Article): Article {
    const existing = this.articles.get(article.id);
    if (!existing) {
      throw new AppError(ErrorCode.NotFound, '1031');
    }
    const oldStatus = existing.status;
    const newStatus = article.status;
    const updated: Article = { ...article, updatedAt: new Date() };
    this.articles.set(article.id, updated);
    if (oldStatus !== newStatus) {
      this.indexRemove(this.statusToArticles, oldStatus, article.id);
      this.indexAdd(this.statusToArticles, newStatus, article.id);
    }
    return { ...updated };
  }

  incrementView(articleId: string): void {
    const a = this.articles.get(articleId);
    if (!a) throw new AppError(ErrorCode.NotFound, '1031');
    a.viewCount += 1;
  }

  incrementLike(articleId: string): void {
    const a = this.articles.get(articleId);
    if (!a) throw new AppError(ErrorCode.NotFound, '1031');
    a.likeCount += 1;
  }

  incrementComment(articleId: string): void {
    const a = this.articles.get(articleId);
    if (!a) throw new AppError(ErrorCode.NotFound, '1031');
    a.commentCount += 1;
  }

  listByAuthorPaged(authorId: string, page: number, pageSize: number): { items: Article[]; total: number } {
    const all = this.listByAuthor(authorId).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const start = (page - 1) * pageSize;
    return { items: all.slice(start, start + pageSize), total: all.length };
  }

  private indexAdd<K>(map: Map<K, Set<string>>, key: K, value: string): void {
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(value);
  }

  private indexRemove<K>(map: Map<K, Set<string>>, key: K, value: string): void {
    const set = map.get(key);
    if (!set) return;
    set.delete(value);
    if (set.size === 0) map.delete(key);
  }

  clear(): void {
    this.articles.clear();
    this.authorIdToArticles.clear();
    this.statusToArticles.clear();
    this.seriesIdToArticles.clear();
  }
}
