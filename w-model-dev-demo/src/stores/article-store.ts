/**
 * DD-009 ArticleStore —— 内存 Map 文章存储
 *
 * 主索引 articles: Map<articleId, Article>
 * 辅助索引 authorIndex: Map<authorId, Set<articleId>>
 * 辅助索引 statusIndex: Map<status, Set<articleId>>
 * 提供 insertOrUpdate 供 WalReplayer 幂等重放使用。
 */
import type { Article, ArticleState, Page } from '../types.js';
import { AppError } from '../utils/errors.js';

/** 危险键清单（原型链污染防护，NFR-003） */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function assertSafeKey(key: string): void {
  if (DANGEROUS_KEYS.has(key)) {
    throw new AppError(40003, `非法键名: ${key}`, { key });
  }
}

export interface ArticleFilter {
  authorId?: string;
  status?: ArticleState;
  tagId?: string;
  categoryId?: string;
  seriesId?: string;
}

export class ArticleStore {
  private articles: Map<string, Article> = new Map();
  private authorIndex: Map<string, Set<string>> = new Map();
  private statusIndex: Map<string, Set<string>> = new Map();

  /** 插入文章（对应 DD-009 insert） */
  insert(article: Article): void {
    assertSafeKey(article.id);
    if (this.articles.has(article.id)) {
      throw new AppError(40901, `文章 ID 已存在: ${article.id}`, { id: article.id });
    }
    this.articles.set(article.id, { ...article });
    this.indexAdd(this.authorIndex, article.authorId, article.id);
    this.indexAdd(this.statusIndex, article.status, article.id);
  }

  /** 幂等插入或更新（供 WalReplayer 重放使用） */
  insertOrUpdate(payload: unknown): void {
    const article = payload as Article;
    if (!article || !article.id || !article.authorId || !article.status) return;
    assertSafeKey(article.id);
    // 若已存在，先清理旧索引
    const existing = this.articles.get(article.id);
    if (existing) {
      this.indexRemove(this.authorIndex, existing.authorId, existing.id);
      this.indexRemove(this.statusIndex, existing.status, existing.id);
    }
    this.articles.set(article.id, { ...article });
    this.indexAdd(this.authorIndex, article.authorId, article.id);
    this.indexAdd(this.statusIndex, article.status, article.id);
  }

  /** 按 ID 查询（对应 DD-009 findById） */
  findById(id: string): Article | null {
    const article = this.articles.get(id);
    return article ? { ...article } : null;
  }

  /** 按作者查询（对应 DD-009 findByAuthor） */
  findByAuthor(authorId: string, filter?: ArticleFilter): Article[] {
    const ids = this.authorIndex.get(authorId) ?? new Set<string>();
    let list = Array.from(ids)
      .map(id => this.articles.get(id))
      .filter((a): a is Article => a !== undefined);
    if (filter?.status) {
      list = list.filter(a => a.status === filter.status);
    }
    if (filter?.tagId) {
      list = list.filter(a => a.tagIds.includes(filter.tagId!));
    }
    if (filter?.categoryId) {
      list = list.filter(a => a.categoryId === filter.categoryId);
    }
    if (filter?.seriesId) {
      list = list.filter(a => a.seriesId === filter.seriesId);
    }
    return list.map(a => ({ ...a }));
  }

  /** 按状态查询（对应 DD-009 findByStatus） */
  findByStatus(status: ArticleState, filter?: ArticleFilter): Article[] {
    const ids = this.statusIndex.get(status) ?? new Set<string>();
    let list = Array.from(ids)
      .map(id => this.articles.get(id))
      .filter((a): a is Article => a !== undefined);
    if (filter?.authorId) {
      list = list.filter(a => a.authorId === filter.authorId);
    }
    if (filter?.tagId) {
      list = list.filter(a => a.tagIds.includes(filter.tagId!));
    }
    if (filter?.categoryId) {
      list = list.filter(a => a.categoryId === filter.categoryId);
    }
    return list.map(a => ({ ...a }));
  }

  /** 综合查询（对应 DD-007 listArticles 调用） */
  list(filter: ArticleFilter, page = 1, pageSize = 10): Page<Article> {
    let list: Article[];
    if (filter.authorId) {
      list = this.findByAuthor(filter.authorId, filter);
    } else if (filter.status) {
      list = this.findByStatus(filter.status, filter);
    } else {
      list = this.listAll();
      if (filter.tagId) list = list.filter(a => a.tagIds.includes(filter.tagId!));
      if (filter.categoryId) list = list.filter(a => a.categoryId === filter.categoryId);
      if (filter.seriesId) list = list.filter(a => a.seriesId === filter.seriesId);
    }
    list.sort((a, b) => b.createdAt - a.createdAt);
    const total = list.length;
    const start = (page - 1) * pageSize;
    const slice = list.slice(start, start + pageSize);
    return { list: slice, total, page, pageSize };
  }

  /** 全量列表 */
  listAll(): Article[] {
    return Array.from(this.articles.values()).map(a => ({ ...a }));
  }

  /** 局部更新（对应 DD-009 update） */
  update(id: string, patch: Partial<Article>): void {
    const existing = this.articles.get(id);
    if (!existing) {
      throw new AppError(40401, `文章不存在: ${id}`, { id });
    }
    const oldStatus = existing.status;
    const oldAuthor = existing.authorId;
    const now = Math.floor(Date.now() / 1000);
    const updated: Article = { ...existing, ...patch, updatedAt: now };
    this.articles.set(id, updated);
    // 状态变更同步 statusIndex
    if (patch.status && patch.status !== oldStatus) {
      this.indexRemove(this.statusIndex, oldStatus, id);
      this.indexAdd(this.statusIndex, patch.status, id);
    }
    // 作者变更同步 authorIndex（罕见，但需正确处理）
    if (patch.authorId && patch.authorId !== oldAuthor) {
      this.indexRemove(this.authorIndex, oldAuthor, id);
      this.indexAdd(this.authorIndex, patch.authorId, id);
    }
  }

  /** 删除文章（对应 DD-009 delete） */
  delete(id: string): void {
    const existing = this.articles.get(id);
    if (!existing) {
      throw new AppError(40401, `文章不存在: ${id}`, { id });
    }
    this.articles.delete(id);
    this.indexRemove(this.authorIndex, existing.authorId, id);
    this.indexRemove(this.statusIndex, existing.status, id);
  }

  /** 总数 */
  count(): number {
    return this.articles.size;
  }

  /** 清空（供测试重置） */
  clear(): void {
    this.articles.clear();
    this.authorIndex.clear();
    this.statusIndex.clear();
  }

  private indexAdd(index: Map<string, Set<string>>, key: string, value: string): void {
    assertSafeKey(key);
    let set = index.get(key);
    if (!set) {
      set = new Set();
      index.set(key, set);
    }
    set.add(value);
  }

  private indexRemove(index: Map<string, Set<string>>, key: string, value: string): void {
    const set = index.get(key);
    if (!set) return;
    set.delete(value);
    if (set.size === 0) {
      index.delete(key);
    }
  }
}

/** 单例（供各 service 注入） */
export const articleStore = new ArticleStore();
