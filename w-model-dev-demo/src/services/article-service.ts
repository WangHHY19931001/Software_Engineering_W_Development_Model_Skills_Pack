import { randomUUID } from 'node:crypto';
import type { Article } from '../types.js';
import { articleStore } from '../stores/article-store.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

class ArticleService {
  async create(
    input: { title: string; content: string },
    authorId: string,
  ): Promise<{ articleId: string }> {
    const now = new Date().toISOString();
    const article: Article = {
      id: randomUUID(),
      title: input.title,
      content: input.content,
      authorId,
      createdAt: now,
      updatedAt: now,
    };
    articleStore.insert(article);
    return { articleId: article.id };
  }

  list(): Article[] {
    return articleStore.list();
  }

  findById(id: string): Article | null {
    return articleStore.findById(id) ?? null;
  }

  async update(
    id: string,
    patch: { title?: string; content?: string },
    userId: string,
  ): Promise<Article> {
    const article = this.findById(id);
    if (!article) throw new NotFoundError(`Article "${id}" not found`);
    if (article.authorId !== userId) throw new ForbiddenError('Only the author can modify this article');
    return articleStore.update(id, { ...patch, updatedAt: new Date().toISOString() });
  }

  async remove(id: string, userId: string): Promise<void> {
    const article = this.findById(id);
    if (!article) throw new NotFoundError(`Article "${id}" not found`);
    if (article.authorId !== userId) throw new ForbiddenError('Only the author can delete this article');
    articleStore.remove(id);
  }
}

export const articleService = new ArticleService();
