import { randomUUID } from 'node:crypto';
import { articleStore } from '../stores/article.store.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';
import type { ArticleCreateDTO, ArticleUpdateDTO } from '../schemas/article.schema.js';
import type { Article } from '../types.js';

export class ArticleService {
  static async create(
    authorId: string,
    dto: ArticleCreateDTO,
  ): Promise<Article> {
    const now = new Date().toISOString();
    const article: Article = {
      id: randomUUID(),
      title: dto.title,
      content: dto.content,
      authorId,
      createdAt: now,
      updatedAt: now,
    };
    articleStore.save(article);
    return article;
  }

  static async list(
    page: number,
    pageSize: number,
  ): Promise<{ items: Article[]; total: number; page: number; pageSize: number }> {
    if (page < 1) page = 1;
    if (pageSize < 1) pageSize = 10;
    const result = articleStore.findAll(page, pageSize);
    return { ...result, page, pageSize };
  }

  static async getById(id: string): Promise<Article> {
    const article = articleStore.findById(id);
    if (!article) throw new NotFoundError(40401, '文章不存在');
    return article;
  }

  static async update(
    authorId: string,
    id: string,
    dto: ArticleUpdateDTO,
  ): Promise<Article> {
    const article = articleStore.findById(id);
    if (!article) throw new NotFoundError(40401, '文章不存在');
    if (article.authorId !== authorId) throw new ForbiddenError(40301, '无权操作他人文章');
    const updated: Article = {
      ...article,
      ...dto,
      updatedAt: new Date().toISOString(),
    };
    articleStore.save(updated);
    return updated;
  }

  static async remove(authorId: string, id: string): Promise<void> {
    const article = articleStore.findById(id);
    if (!article) throw new NotFoundError(40401, '文章不存在');
    if (article.authorId !== authorId) throw new ForbiddenError(40301, '无权操作他人文章');
    articleStore.delete(id);
  }
}
