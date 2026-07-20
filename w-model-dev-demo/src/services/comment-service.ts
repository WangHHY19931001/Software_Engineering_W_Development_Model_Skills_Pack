import { randomUUID } from 'node:crypto';
import type { Comment } from '../types.js';
import type { ArticleService } from './article-service.js';
import { commentStore } from '../stores/comment-store.js';
import { NotFoundError } from '../utils/errors.js';

class CommentService {
  constructor(private articleSvc: ArticleService) {}

  async create(
    articleId: string,
    input: { content: string },
    authorId: string,
  ): Promise<{ commentId: string }> {
    if (this.articleSvc.findById(articleId) === null) {
      throw new NotFoundError(`Article "${articleId}" not found`);
    }
    const comment: Comment = {
      id: randomUUID(),
      articleId,
      content: input.content,
      authorId,
      createdAt: new Date().toISOString(),
    };
    commentStore.insert(comment);
    return { commentId: comment.id };
  }

  listByArticle(articleId: string): Comment[] {
    return commentStore.listByArticle(articleId);
  }
}

import { articleService } from './article-service.js';
export const commentService = new CommentService(articleService);
