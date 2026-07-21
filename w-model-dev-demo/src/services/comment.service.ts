import { randomUUID } from 'node:crypto';
import type { CommentStore } from '../stores/comment.store.js';
import type { ArticleService } from './article.service.js';
import type { Comment } from '../types.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

/**
 * 评论业务服务。
 *
 * 设计来源：`docs/detailed-design.md` §3.3 / REQ-004。
 * - `create`：通过 `articleService.getById` 校验文章存在性；authorId 来自 JWT。
 * - `delete`：校验评论存在 + 作者隔离。
 * - `listByArticle`：返回指定文章的评论列表（按 createdAt 升序）；文章不存在抛 40401。
 */
export class CommentService {
  constructor(
    private readonly commentStore: CommentStore,
    private readonly articleService: ArticleService,
  ) {}

  create(authorId: string, articleId: string, content: string): Comment {
    // 复用 ArticleService.getById 校验文章存在性（不存在会抛 NotFoundError）
    this.articleService.getById(articleId);
    const comment: Comment = {
      id: randomUUID(),
      articleId,
      authorId,
      content,
      createdAt: new Date().toISOString(),
    };
    this.commentStore.save(comment);
    return comment;
  }

  delete(authorId: string, commentId: string): void {
    const comment = this.commentStore.findById(commentId);
    if (!comment) {
      throw new NotFoundError('评论不存在');
    }
    if (comment.authorId !== authorId) {
      throw new ForbiddenError('无权删除他人评论');
    }
    this.commentStore.delete(commentId);
  }

  listByArticle(articleId: string): Comment[] {
    // 校验文章存在性
    this.articleService.getById(articleId);
    return this.commentStore.findByArticleId(articleId);
  }
}
