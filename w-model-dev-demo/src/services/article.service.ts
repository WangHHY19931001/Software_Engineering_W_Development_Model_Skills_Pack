import { randomUUID } from 'node:crypto';
import type { ArticleStore } from '../stores/article.store.js';
import type { CommentStore } from '../stores/comment.store.js';
import type {
  Article,
  ArticleCreateDTO,
  ArticleDetail,
  ArticleUpdateDTO,
  PageQuery,
  PageResult,
} from '../types.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

/**
 * 文章业务服务。
 *
 * 设计来源：`docs/detailed-design.md` §3.2 / REQ-002 / REQ-003。
 * - 创建 / 更新 / 删除均强制作者隔离（authorId 来自 JWT，不取自 body）。
 * - `delete` 级联清理该文章下的全部评论。
 * - `getById` 聚合评论列表（按 createdAt 升序）。
 * - `list` 按 createdAt 降序分页；可选 tag 过滤。
 */
export class ArticleService {
  constructor(
    private readonly articleStore: ArticleStore,
    private readonly commentStore: CommentStore,
  ) {}

  create(authorId: string, dto: ArticleCreateDTO): Article {
    const now = new Date().toISOString();
    const article: Article = {
      id: randomUUID(),
      authorId,
      title: dto.title,
      content: dto.content,
      tags: dto.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.articleStore.save(article);
    return article;
  }

  update(authorId: string, articleId: string, dto: ArticleUpdateDTO): Article {
    const article = this.articleStore.findById(articleId);
    if (!article) {
      throw new NotFoundError('文章不存在');
    }
    if (article.authorId !== authorId) {
      throw new ForbiddenError('无权操作他人文章');
    }
    if (dto.title !== undefined) article.title = dto.title;
    if (dto.content !== undefined) article.content = dto.content;
    if (dto.tags !== undefined) article.tags = dto.tags;
    article.updatedAt = new Date().toISOString();
    this.articleStore.save(article);
    return article;
  }

  delete(authorId: string, articleId: string): void {
    const article = this.articleStore.findById(articleId);
    if (!article) {
      throw new NotFoundError('文章不存在');
    }
    if (article.authorId !== authorId) {
      throw new ForbiddenError('无权操作他人文章');
    }
    // 级联清理评论
    const comments = this.commentStore.findByArticleId(articleId);
    for (const c of comments) {
      this.commentStore.delete(c.id);
    }
    this.articleStore.delete(articleId);
  }

  getById(articleId: string): ArticleDetail {
    const article = this.articleStore.findById(articleId);
    if (!article) {
      throw new NotFoundError('文章不存在');
    }
    const comments = this.commentStore.findByArticleId(articleId);
    return { ...article, comments };
  }

  list(query: PageQuery): PageResult<Article> {
    const items = this.articleStore.findAll(query.page, query.pageSize, query.tag);
    const total = this.articleStore.count(query.tag);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}
