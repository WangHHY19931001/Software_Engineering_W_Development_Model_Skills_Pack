/**
 * CommentService：评论增删查 + 文章存在性校验（realizes INTF-003 / DD-006）。
 * 依赖 CommentStore + ArticleService（校验文章存在）。
 */
import { randomUUID } from 'node:crypto';
import type { CommentStore } from '../stores/comment.store';
import type { ArticleService } from './article.service';
import { NotFoundError, ForbiddenError, ErrorCode } from '../utils/errors';
import type { Comment, CommentCreateInput } from '../types';

export class CommentService {
  constructor(
    private readonly commentStore: CommentStore,
    private readonly articleService: ArticleService,
  ) {}

  async create(
    articleId: string,
    input: CommentCreateInput,
    authorId: string,
  ): Promise<Comment> {
    await this.articleService.getById(articleId);
    const comment: Comment = {
      id: randomUUID(),
      articleId,
      authorId,
      content: input.content,
      createdAt: new Date().toISOString(),
    };
    this.commentStore.insert(comment);
    return comment;
  }

  async delete(commentId: string, authorId: string): Promise<void> {
    const existing = this.commentStore.findById(commentId);
    if (!existing) {
      throw new NotFoundError(ErrorCode.NOT_FOUND, '评论不存在');
    }
    if (existing.authorId !== authorId) {
      throw new ForbiddenError(ErrorCode.FORBIDDEN, '无权操作他人评论');
    }
    this.commentStore.delete(commentId);
  }

  async listByArticle(articleId: string): Promise<Comment[]> {
    return this.commentStore.findByArticleId(articleId);
  }
}
