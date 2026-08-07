/**
 * articleService（DD-007 / SD-002）：文章生命周期核心业务（创建/发布/归档/更新/删除/列表）。
 * 博主/归属校验经 SD-001（user store，P7-002）；事件触发 article.published/updated/archived/deleted；
 * 跨模块只读方法（getPublishedArticleById/listPublishedArticles/getArticlesByIds/findAllPublished/…）供 SD-003/004/005/006 消费。
 */
import { BizError } from '../../utils/errors';
import type { ArticleStore, ArticlePatch } from '../../stores/articleStore';
import type { TagStore } from '../../stores/tagStore';
import type { CategoryStore } from '../../stores/categoryStore';
import type { ArticleStateMachine } from './articleStateMachine';
import type { AuthService } from '../identity/authService';
import type { EventBus } from '../../utils/eventBus';
import type { Article, ArticleStatus, Page } from '../../types';

export interface ArticleCreateInput {
  title: string;
  body: string;
  summary?: string;
  tags?: string[];
  categoryId?: string;
}

export interface PublishedFilters {
  categoryId?: string;
  tag?: string;
  keyword?: string;
}

export class ArticleService {
  constructor(
    private readonly articleStore: ArticleStore,
    private readonly tagStore: TagStore,
    private readonly categoryStore: CategoryStore,
    private readonly stateMachine: ArticleStateMachine,
    private readonly authService: AuthService,
    private readonly eventBus: EventBus,
  ) {}

  /** 创建草稿：博主校验（40301）→ 标签/分类存在性（40401）→ 落库 status=draft */
  async createArticle(authorId: string, input: ArticleCreateInput): Promise<Article> {
    const isBlogger = await this.authService.isBlogger(authorId);
    if (!isBlogger) {
      throw new BizError(40301, '仅博主可创建文章');
    }
    for (const tag of input.tags ?? []) {
      const found = await this.tagStore.findByName(tag);
      if (!found) throw new BizError(40401, `标签不存在：${tag}`);
    }
    if (input.categoryId) {
      const category = await this.categoryStore.findById(input.categoryId);
      if (!category) throw new BizError(40401, '分类不存在');
    }
    const now = new Date().toISOString();
    return this.articleStore.create({
      authorId,
      title: input.title,
      body: input.body,
      summary: input.summary ?? '',
      categoryId: input.categoryId ?? null,
      status: 'draft',
      tags: input.tags ?? [],
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** 发布：归属校验 → draft→published → 触发 article.published（已 published 幂等 200，INTF-006） */
  async publishArticle(articleId: string, authorId: string): Promise<Article> {
    const article = await this.requireOwned(articleId, authorId);
    if (article.status === 'published') {
      return article;
    }
    const newStatus = this.stateMachine.transition(article.status, 'publish');
    const now = new Date().toISOString();
    const updated = await this.articleStore.update(articleId, { status: newStatus, publishedAt: now, updatedAt: now });
    const author = await this.authService.getUserById(authorId);
    this.eventBus.emit('article.published', {
      type: 'article.published',
      articleId,
      authorId,
      authorName: author?.username ?? '',
      title: updated.title,
      publishedAt: now,
    });
    return updated;
  }

  /** 归档：published→archived（draft→archived 60001） */
  async archiveArticle(articleId: string, authorId: string): Promise<Article> {
    const article = await this.requireOwned(articleId, authorId);
    const newStatus = this.stateMachine.transition(article.status, 'archive');
    const updated = await this.articleStore.update(articleId, { status: newStatus, updatedAt: new Date().toISOString() });
    this.eventBus.emit('article.archived', { type: 'article.archived', articleId });
    return updated;
  }

  /** 取消归档：archived→draft */
  async unarchiveArticle(articleId: string, authorId: string): Promise<Article> {
    const article = await this.requireOwned(articleId, authorId);
    const newStatus = this.stateMachine.transition(article.status, 'unarchive');
    const updated = await this.articleStore.update(articleId, { status: newStatus, updatedAt: new Date().toISOString() });
    return updated;
  }

  /** 更新：归属校验 → 内容更新；published 编辑后置回 draft（REQ-012）→ 触发 article.updated */
  async updateArticle(articleId: string, authorId: string, patch: ArticlePatch): Promise<Article> {
    const article = await this.requireOwned(articleId, authorId);
    if (patch.tags) {
      for (const tag of patch.tags) {
        const found = await this.tagStore.findByName(tag);
        if (!found) throw new BizError(40401, `标签不存在：${tag}`);
      }
    }
    if (patch.categoryId) {
      const category = await this.categoryStore.findById(patch.categoryId);
      if (!category) throw new BizError(40401, '分类不存在');
    }
    const nextStatus: ArticleStatus = article.status === 'published' ? 'draft' : article.status;
    const updated = await this.articleStore.update(articleId, { ...patch, status: nextStatus, updatedAt: new Date().toISOString() });
    this.eventBus.emit('article.updated', { type: 'article.updated', articleId });
    return updated;
  }

  /** 删除：仅 draft 可删（published/archived 删除 → 60001，仅可归档）；删除审计留痕由 audit 中间件承担 */
  async deleteArticle(articleId: string, authorId: string): Promise<void> {
    const article = await this.requireOwned(articleId, authorId);
    if (!this.stateMachine.canTransition(article.status, 'delete')) {
      throw new BizError(60001, '仅草稿文章可删除（已发布/归档仅可归档）');
    }
    await this.articleStore.delete(articleId);
    this.eventBus.emit('article.deleted', { type: 'article.deleted', articleId });
  }

  /** TLA+ L2_BlogSystemContent / L3_BlogSystemArticleState "EditPublishedArticle" 动作对应：编辑已发布文章（published 编辑后置回 draft，REQ-012） */
  async editPublishedArticle(articleId: string, authorId: string, patch: ArticlePatch): Promise<Article> {
    return this.updateArticle(articleId, authorId, patch);
  }

  /** 本人文章列表（草稿+已发布+归档，按状态筛选） */
  async listMyArticles(authorId: string, status: ArticleStatus | undefined, page: number, pageSize: number): Promise<Page<Article>> {
    return this.articleStore.listByAuthorAndStatus(authorId, status, page, pageSize);
  }

  /* ============ 跨模块只读（article store，经 SD-002 服务方法） ============ */

  /** 已发布文章读取（SD-003/004/006 消费；非 published 返回 null，40402 语义由调用方转译） */
  async getPublishedArticleById(id: string): Promise<Article | null> {
    const article = await this.articleStore.findById(id);
    return article && article.status === 'published' ? article : null;
  }

  /** 文章存在性（不限状态，供评论/删除等管理路径） */
  async getArticleById(id: string): Promise<Article | null> {
    return this.articleStore.findById(id);
  }

  /** 同步读取（不限状态，供事件订阅类同步消费者如 searchService.syncIndex） */
  getArticleByIdSync(id: string): Article | null {
    return this.articleStore.findById(id);
  }

  /** 已发布文章筛选分页（INTF-011/009/010 组合筛选） */
  async listPublishedArticles(filters: PublishedFilters, page: number, pageSize: number): Promise<Page<Article>> {
    return this.articleStore.filterPublished(filters, page, pageSize);
  }

  /** 批量取文章（推荐/收藏列表/搜索明细） */
  async getArticlesByIds(ids: string[]): Promise<Article[]> {
    const result: Article[] = [];
    for (const id of ids) {
      const article = await this.articleStore.findById(id);
      if (article) result.push(article);
    }
    return result;
  }

  /** 全部已发布文章（feed/热门/推荐候选，跨模块只读） */
  async findAllPublished(): Promise<Article[]> {
    return this.articleStore.listPublished();
  }

  /** 作者全部文章（RSS 源/统计聚合） */
  async findByAuthor(authorId: string): Promise<Article[]> {
    return this.articleStore.findByAuthor(authorId);
  }

  /** 作者文章数（博主面板统计） */
  async countByAuthor(authorId: string): Promise<number> {
    return this.articleStore.countByAuthor(authorId);
  }

  private async requireOwned(articleId: string, authorId: string): Promise<Article> {
    const article = await this.articleStore.findById(articleId);
    if (!article) throw new BizError(40401, '文章不存在');
    if (article.authorId !== authorId) {
      throw new BizError(40301, '无权操作他人文章');
    }
    return article;
  }
}
