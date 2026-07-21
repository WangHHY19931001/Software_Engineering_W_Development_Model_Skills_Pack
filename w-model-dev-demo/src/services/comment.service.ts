import { randomUUID } from 'node:crypto';
import { commentStore } from '../stores/comment.store.js';
import { articleStore } from '../stores/article.store.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';
import type { CommentCreateDTO } from '../schemas/comment.schema.js';
import type { Comment } from '../types.js';

export class CommentService {
  static async create(
    authorId: string,
    articleId: string,
    dto: CommentCreateDTO,
  ): Promise<Comment> {
    if (!articleStore.findById(articleId)) {
      throw new NotFoundError(40401, '文章不存在');
    }
    const comment: Comment = {
      id: randomUUID(),
      articleId,
      authorId,
      content: dto.content,
      createdAt: new Date().toISOString(),
    };
    commentStore.save(comment);
    return comment;
  }

  static async listByArticle(articleId: string): Promise<Comment[]> {
    return commentStore.findByArticleId(articleId);
  }

  static async remove(authorId: string, commentId: string): Promise<void> {
    const comment = commentStore.findById(commentId);
    if (!comment) throw new NotFoundError(40401, '评论不存在');
    if (comment.authorId !== authorId) throw new ForbiddenError(40301, '无权操作他人评论');
    commentStore.delete(commentId);
  }
}
