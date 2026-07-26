/**
 * CommentService（DD-010-002 / DD-011-002 / DD-012-002）。
 */
import type { Comment, PaginatedResult } from '../types.js';
import type { CommentStore } from '../stores/comment.store.js';
import type { ArticleStore } from '../stores/article.store.js';
import { NotFoundError, ValidationError, AuthorizationError } from '../utils/errors.js';

export class CommentService {
  constructor(
    private commentStore: CommentStore,
    private articleStore: ArticleStore,
  ) {}

  create(articleId: string, userId: string, content: string): Comment {
    const article = this.articleStore.findById(articleId);
    if (!article) throw new NotFoundError('文章');
    if (article.status !== 'published') {
      throw new ValidationError('文章未发布，无法评论');
    }
    if (!content.trim()) throw new ValidationError('评论内容必填');
    return this.commentStore.insert({ articleId, userId, content });
  }

  listByArticle(articleId: string, page: number = 1, limit: number = 10): PaginatedResult<Comment> {
    const article = this.articleStore.findById(articleId);
    if (!article) throw new NotFoundError('文章');
    return this.commentStore.listByArticle(articleId, page, limit);
  }

  remove(commentId: string, userId: string, userRole: string): void {
    const comment = this.commentStore.findById(commentId);
    if (!comment) throw new NotFoundError('评论');
    if (userRole !== 'admin' && comment.userId !== userId) {
      throw new AuthorizationError('无权删除他人评论');
    }
    this.commentStore.delete(commentId);
  }
}
