/**
 * ArticleStore（DD-011）：Article 实体存储 + 检索索引（作者/状态/分类/标签/关键词/发布时间）。
 */
import { BizError } from '../utils/errors';
import { SnapshotStore, nextId, assertPage } from './base';
import type { Article, ArticleStatus, Page } from '../types';

interface ArticleState {
  map: Map<string, Article>;
  byAuthor: Map<string, Set<string>>;
  byStatus: Map<ArticleStatus, Set<string>>;
  byCategory: Map<string, Set<string>>;
  byTag: Map<string, Set<string>>;
  seq: { n: number };
}

export type ArticleCreateInput = Omit<Article, 'id'> & { id?: string };
export type ArticlePatch = Partial<Pick<Article, 'title' | 'body' | 'summary' | 'categoryId' | 'status' | 'tags' | 'publishedAt' | 'updatedAt'>>;

export interface PublishedFilters {
  categoryId?: string;
  tag?: string;
  keyword?: string;
}

export class ArticleStore extends SnapshotStore<ArticleState> {
  protected state: ArticleState = {
    map: new Map(),
    byAuthor: new Map(),
    byStatus: new Map(),
    byCategory: new Map(),
    byTag: new Map(),
    seq: { n: 0 },
  };

  create(article: ArticleCreateInput): Article {
    const id = article.id ?? nextId('a', this.state.seq);
    const record: Article = { ...article, id };
    this.state.map.set(id, record);
    this.indexAdd(record);
    return record;
  }

  findById(id: string): Article | null {
    return this.state.map.get(id) ?? null;
  }

  findAll(): Article[] {
    return [...this.state.map.values()];
  }

  update(id: string, patch: ArticlePatch): Article {
    const article = this.require(id);
    const prev: Article = { ...article };
    const next: Article = { ...article, ...patch, id };
    this.state.map.set(id, next);
    // 索引维护：状态/分类/标签变化时同步
    if (prev.status !== next.status) this.indexRemoveStatus(prev);
    if (prev.categoryId !== next.categoryId) this.removeSet(this.state.byCategory, prev.categoryId, id);
    if (prev.tags.join('|') !== next.tags.join('|')) this.indexRemoveTags(prev);
    this.indexAdd(next);
    return next;
  }

  delete(id: string): void {
    const article = this.state.map.get(id);
    if (!article) return;
    this.indexRemoveAll(article);
    this.state.map.delete(id);
  }

  /** 博主文章列表（DD-007 listMyArticles 数据源；createdAt 降序） */
  listByAuthorAndStatus(authorId: string, status: ArticleStatus | undefined, page: number, pageSize: number): Page<Article> {
    assertPage(page, pageSize);
    const ids = this.state.byAuthor.get(authorId) ?? new Set<string>();
    const items = [...ids]
      .map((id) => this.state.map.get(id))
      .filter((a): a is Article => a !== undefined && (status === undefined || a.status === status))
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    return this.paginateItems(items, page, pageSize);
  }

  /** 已发布文章筛选（INTF-011；含关键词模糊匹配），publishedAt 降序 */
  filterPublished(filters: PublishedFilters, page: number, pageSize: number): Page<Article> {
    assertPage(page, pageSize);
    let items = [...this.state.map.values()].filter((a) => a.status === 'published');
    if (filters.categoryId) {
      const ids = this.state.byCategory.get(filters.categoryId) ?? new Set<string>();
      items = items.filter((a) => ids.has(a.id));
    }
    if (filters.tag) {
      const ids = this.state.byTag.get(filters.tag) ?? new Set<string>();
      items = items.filter((a) => ids.has(a.id));
    }
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      items = items.filter((a) => a.title.toLowerCase().includes(kw) || a.body.toLowerCase().includes(kw) || a.summary.toLowerCase().includes(kw));
    }
    items = items.sort((x, y) => (y.publishedAt ?? '').localeCompare(x.publishedAt ?? ''));
    return this.paginateItems(items, page, pageSize);
  }

  /** 作者全部文章（RSS/统计聚合，DD-011 findByAuthor） */
  findByAuthor(authorId: string): Article[] {
    const ids = this.state.byAuthor.get(authorId) ?? new Set<string>();
    return [...ids].map((id) => this.state.map.get(id)).filter((a): a is Article => a !== undefined);
  }

  /** 全部已发布文章（跨模块只读消费：feed/热门/推荐/搜索） */
  listPublished(): Article[] {
    return [...this.state.map.values()].filter((a) => a.status === 'published');
  }

  countByAuthor(authorId: string): number {
    return this.state.byAuthor.get(authorId)?.size ?? 0;
  }

  private paginateItems(items: Article[], page: number, pageSize: number): Page<Article> {
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
  }

  private indexAdd(a: Article): void {
    this.addSet(this.state.byAuthor, a.authorId, a.id);
    this.addSet(this.state.byStatus, a.status, a.id);
    if (a.categoryId) this.addSet(this.state.byCategory, a.categoryId, a.id);
    for (const t of a.tags) this.addSet(this.state.byTag, t, a.id);
  }

  private indexRemoveAll(a: Article): void {
    this.indexRemoveStatus(a);
    this.indexRemoveTags(a);
    this.removeSet(this.state.byAuthor, a.authorId, a.id);
    this.removeSet(this.state.byCategory, a.categoryId, a.id);
  }

  private indexRemoveStatus(a: Article): void {
    this.removeSet(this.state.byStatus, a.status, a.id);
  }

  private indexRemoveTags(a: Article): void {
    for (const t of a.tags) this.removeSet(this.state.byTag, t, a.id);
  }

  private addSet(map: Map<string, Set<string>>, key: string, value: string): void {
    const set = map.get(key) ?? new Set<string>();
    set.add(value);
    map.set(key, set);
  }

  private removeSet(map: Map<string, Set<string>>, key: string | null, value: string): void {
    if (!key) return;
    const set = map.get(key);
    if (!set) return;
    set.delete(value);
    if (set.size === 0) map.delete(key);
  }

  private require(id: string): Article {
    const article = this.state.map.get(id);
    if (!article) throw new BizError(40401, '文章不存在');
    return article;
  }
}
