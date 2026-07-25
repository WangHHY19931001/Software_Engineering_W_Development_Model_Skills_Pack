// SD-010 CommentService.

import { CommentStatus, UserRole, type Comment, type Page } from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import type { CommentStore, CommentCreateInput } from '../stores/comment.store.js';
import type { ArticleStore } from '../stores/article.store.js';
import type { SiteStore } from '../stores/site.store.js';
import { appendAuditLog } from '../utils/logger.js';

export class CommentService {
  constructor(
    private commentStore: CommentStore,
    private articleStore: ArticleStore,
    private siteStore: SiteStore,
  ) {}

  /** createComment — TLA+ L2_interaction.createComment */
  createComment(
    articleId: string,
    userId: string,
    parentId: string | null,
    content: string,
  ): Comment {
    const article = this.articleStore.getById(articleId);
    if (!article) throw new AppError(ErrorCode.NotFound, '1031');
    const cfg = this.siteStore.getConfig();
    const ctx: CommentCreateInput = {
      articleStatus: article.status,
      commentOpen: cfg.commentOpen,
    };
    const comment = this.commentStore.create(articleId, userId, parentId, content, ctx);
    return comment;
  }

  /** approveComment — TLA+ L2_interaction.approveComment */
  approveComment(operatorId: string, operatorRole: string, commentId: string, decision: 'approve' | 'reject'): void {
    const comment = this.commentStore.getById(commentId);
    if (!comment) throw new AppError(ErrorCode.NotFound, '1031');
    // Admin or article author.
    const article = this.articleStore.getById(comment.articleId);
    if (!article) throw new AppError(ErrorCode.NotFound, '1031');
    if (operatorRole !== UserRole.Admin && article.authorId !== operatorId) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    if (comment.status !== CommentStatus.PendingReview) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    comment.status = decision === 'approve' ? CommentStatus.Approved : CommentStatus.Rejected;
    this.commentStore.update(comment);
    appendAuditLog(operatorId, 'approveComment', commentId);
  }

  /** audit — alias matching SD-010 design. */
  audit(operatorId: string, operatorRole: string, commentId: string, decision: 'approve' | 'reject'): void {
    this.approveComment(operatorId, operatorRole, commentId, decision);
  }

  /** likeComment — TLA+ L2_interaction.likeComment (idempotent) */
  likeComment(userId: string, commentId: string): void {
    this.commentStore.like(userId, commentId);
  }

  /** like — alias matching SD-010 design. */
  like(userId: string, commentId: string): void {
    this.likeComment(userId, commentId);
  }

  /** reportComment — TLA+ L2_interaction.reportComment */
  reportComment(userId: string, commentId: string, reason: string): void {
    this.commentStore.report(userId, commentId, reason);
  }

  /** resolveComment — TLA+ L2_interaction.resolveComment. Restores a flagged comment to approved. */
  resolveComment(operatorId: string, operatorRole: string, commentId: string): void {
    if (operatorRole !== UserRole.Admin) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    const comment = this.commentStore.getById(commentId);
    if (!comment) throw new AppError(ErrorCode.NotFound, '1031');
    if (comment.status !== CommentStatus.Flagged) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    comment.status = CommentStatus.Approved;
    this.commentStore.update(comment);
    appendAuditLog(operatorId, 'resolveComment', commentId);
  }

  listByArticle(
    articleId: string,
    page: number,
    pageSize: number,
    sort: 'newest' | 'oldest' | 'popular',
  ): Page<Comment> {
    if (page < 1 || pageSize < 1) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    const result = this.commentStore.listByArticlePaged(articleId, page, pageSize, sort);
    return { items: result.items, total: result.total, page, pageSize };
  }
}
