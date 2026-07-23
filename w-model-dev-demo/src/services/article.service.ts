/**
 * ArticleService：文章 CRUD + 作者隔离 + 评论聚合（realizes INTF-002 / DD-005）。
 * 依赖 ArticleStore + CommentStore（聚合评论）。
 */
import { randomUUID } from 'node:crypto';
import type { ArticleStore } from '../stores/article.store';
import type { CommentStore } from '../stores/comment.store';
import { NotFoundError, ForbiddenError, BadRequestError, ErrorCode } from '../utils/errors';
import type {
  Article,
  ArticleDetail,
  ArticleCreateInput,
  ArticleUpdateInput,
  Page,
} from '../types';

const MAX_PAGE_SIZE = 100;

export class ArticleService {
  constructor(
    private readonly articleStore: ArticleStore,
    private readonly commentStore: CommentStore,
  ) {}

  async create(input: ArticleCreateInput, authorId: string): Promise<Article> {
    const now = new Date().toISOString();
    const article: Article = {
      id: randomUUID(),
      authorId,
      title: input.title,
      content: input.content,
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.articleStore.insert(article);
    return article;
  }

  async update(
    articleId: string,
    input: ArticleUpdateInput,
    authorId: string,
  ): Promise<Article> {
    const existing = this.articleStore.findById(articleId);
    if (!existing) {
      throw new NotFoundError(ErrorCode.NOT_FOUND, '文章不存在');
    }
    if (existing.authorId !== authorId) {
      throw new ForbiddenError(ErrorCode.FORBIDDEN, '无权操作他人文章');
    }
    const patch: Partial<Article> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.content !== undefined) patch.content = input.content;
    if (input.tags !== undefined) patch.tags = input.tags;
    const updated = this.articleStore.update(articleId, patch);
    return updated as Article;
  }

  async delete(articleId: string, authorId: string): Promise<void> {
    const existing = this.articleStore.findById(articleId);
    if (!existing) {
      throw new NotFoundError(ErrorCode.NOT_FOUND, '文章不存在');
    }
    if (existing.authorId !== authorId) {
      throw new ForbiddenError(ErrorCode.FORBIDDEN, '无权操作他人文章');
    }
    this.articleStore.delete(articleId);
  }

  async getById(articleId: string): Promise<ArticleDetail> {
    const article = this.articleStore.findById(articleId);
    if (!article) {
      throw new NotFoundError(ErrorCode.NOT_FOUND, '文章不存在');
    }
    const comments = this.commentStore.findByArticleId(articleId);
    return { ...article, comments };
  }

  async list(page: number, pageSize: number): Promise<Page> {
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > MAX_PAGE_SIZE
    ) {
      throw new BadRequestError(ErrorCode.BAD_REQUEST, '分页参数越界');
    }
    const { items, total } = this.articleStore.findAll(page, pageSize);
    return { items, total, page, pageSize };
  }
}
