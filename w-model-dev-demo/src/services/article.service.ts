// SD-012 ArticleService.

import {
  ArticleStatus,
  ScheduleStatus,
  UserRole,
  type Article,
  type ArticleInput,
  type Page,
} from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import type { ArticleStore } from '../stores/article.store.js';
import type { SearchStore } from '../stores/search.store.js';
import type { UserStore } from '../stores/user.store.js';
import { appendAuditLog, invariant } from '../utils/logger.js';

// Valid state transitions (L4_article_state_machine ValidTransitions).
const VALID_NEXT: Record<ArticleStatus, ArticleStatus[]> = {
  [ArticleStatus.Draft]: [ArticleStatus.PendingReview, ArticleStatus.Draft],
  [ArticleStatus.PendingReview]: [ArticleStatus.Published, ArticleStatus.PendingReview],
  [ArticleStatus.Published]: [ArticleStatus.Offline, ArticleStatus.Published],
  [ArticleStatus.Offline]: [ArticleStatus.Archived, ArticleStatus.Published, ArticleStatus.Offline],
  [ArticleStatus.Archived]: [ArticleStatus.Archived],
};

export class ArticleService {
  constructor(
    private articleStore: ArticleStore,
    private searchStore: SearchStore,
    private userStore: UserStore,
  ) {}

  /** createArticle — TLA+ L3_article_lifecycle.createArticle + L2_content_management.bloggerCreateArticle */
  createArticle(authorId: string, input: ArticleInput): Article {
    const user = this.userStore.getById(authorId);
    if (!user) throw new AppError(ErrorCode.NotFound, '1031');
    if (user.role !== UserRole.Blogger && user.role !== UserRole.Admin) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    const article = this.articleStore.create(authorId, input);
    this.searchStore.index(article.id, article.title, article.content);
    return article;
  }

  /** bloggerCreateArticle — alias matching L2_content_management. */
  bloggerCreateArticle(authorId: string, input: ArticleInput): Article {
    return this.createArticle(authorId, input);
  }

  /** submitForReview — draft → pending_review. TLA+ L3_article_lifecycle.submitForReview + L2_content_management.submitForReview */
  submitForReview(authorId: string, articleId: string): void {
    this.transition(authorId, articleId, ArticleStatus.PendingReview);
  }

  /** approveArticle — admin approves pending_review → published. */
  approveArticle(operatorId: string, operatorRole: string, articleId: string): void {
    if (operatorRole !== UserRole.Admin) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    const article = this.articleStore.getById(articleId);
    if (!article) throw new AppError(ErrorCode.NotFound, '1031');
    if (article.status !== ArticleStatus.PendingReview) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    this.transitionInternal(article, ArticleStatus.Published);
    appendAuditLog(operatorId, 'approveArticle', articleId);
  }

  /** publishArticle — TLA+ L3_article_lifecycle.publishArticle (pending_review → published). */
  publishArticle(authorId: string, articleId: string): void {
    this.transition(authorId, articleId, ArticleStatus.Published);
  }

  /** offlineArticle — published → offline. TLA+ L2_content_management.offlineArticle + L3_article_lifecycle.offlineArticle */
  offlineArticle(operatorId: string, operatorRole: string, articleId: string): void {
    const article = this.articleStore.getById(articleId);
    if (!article) throw new AppError(ErrorCode.NotFound, '1031');
    // Author or admin only.
    if (article.authorId !== operatorId && operatorRole !== UserRole.Admin) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    this.transitionInternal(article, ArticleStatus.Offline);
    appendAuditLog(operatorId, 'offlineArticle', articleId);
  }

  /** archiveArticle — offline → archived. TLA+ L2_content_management.archiveArticle + L3_article_lifecycle.archiveArticle */
  archiveArticle(operatorId: string, operatorRole: string, articleId: string): void {
    const article = this.articleStore.getById(articleId);
    if (!article) throw new AppError(ErrorCode.NotFound, '1031');
    if (article.authorId !== operatorId && operatorRole !== UserRole.Admin) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    this.transitionInternal(article, ArticleStatus.Archived);
    appendAuditLog(operatorId, 'archiveArticle', articleId);
  }

  /** republishArticle — offline → published (only if not archived). TLA+ L3_article_lifecycle.republishArticle */
  republishArticle(operatorId: string, operatorRole: string, articleId: string): void {
    const article = this.articleStore.getById(articleId);
    if (!article) throw new AppError(ErrorCode.NotFound, '1031');
    if (article.authorId !== operatorId && operatorRole !== UserRole.Admin) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    if (article.archivedAt) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    this.transitionInternal(article, ArticleStatus.Published);
    appendAuditLog(operatorId, 'republishArticle', articleId);
  }

  /** Generic transition — TLA+ L3 state machine. */
  transition(authorId: string, articleId: string, to: ArticleStatus): void {
    const article = this.articleStore.getById(articleId);
    if (!article) throw new AppError(ErrorCode.NotFound, '1031');
    if (article.authorId !== authorId) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    this.transitionInternal(article, to);
  }

  private transitionInternal(article: Article, to: ArticleStatus): void {
    const allowed = VALID_NEXT[article.status];
    if (!allowed || !allowed.includes(to)) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    article.status = to;
    if (to === ArticleStatus.Published) {
      article.publishedAt = new Date();
      // ScheduleFired when published (TLA+ L4 FireScheduledPublish).
      if (article.scheduleStatus === ScheduleStatus.Pending) {
        article.scheduleStatus = ScheduleStatus.Fired;
      }
      this.searchStore.index(article.id, article.title, article.content);
    }
    if (to === ArticleStatus.Archived) {
      article.archivedAt = new Date();
    }
    this.articleStore.update(article);
  }

  /** schedulePublish — set schedule_pending (pending_review only). TLA+ L3_article_lifecycle.schedulePublish */
  schedulePublish(authorId: string, articleId: string, scheduledAt: Date): void {
    invariant(scheduledAt.getTime() > Date.now(), 'scheduledAt must be in future');
    const article = this.articleStore.getById(articleId);
    if (!article) throw new AppError(ErrorCode.NotFound, '1031');
    if (article.authorId !== authorId) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    if (article.status !== ArticleStatus.PendingReview) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    if (article.scheduleStatus !== ScheduleStatus.None) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    article.scheduleStatus = ScheduleStatus.Pending;
    article.scheduledAt = scheduledAt;
    this.articleStore.update(article);
  }

  /** schedule — alias matching SD-012 design method name. */
  schedule(authorId: string, articleId: string, scheduledAt: Date): void {
    this.schedulePublish(authorId, articleId, scheduledAt);
  }

  /** fireScheduledPublish — fire scheduled publication. TLA+ L3_article_lifecycle.fireScheduledPublish */
  fireScheduledPublish(articleId: string): void {
    const article = this.articleStore.getById(articleId);
    if (!article) throw new AppError(ErrorCode.NotFound, '1031');
    if (article.status !== ArticleStatus.PendingReview) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    if (article.scheduleStatus !== ScheduleStatus.Pending) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    this.transitionInternal(article, ArticleStatus.Published);
    article.scheduleStatus = ScheduleStatus.Fired;
    this.articleStore.update(article);
  }

  /** batchOffline — admin batch offline. TLA+ L4 BatchOffline. */
  batchOffline(operatorId: string, operatorRole: string, articleIds: string[]): void {
    if (operatorRole !== UserRole.Admin) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    if (articleIds.length === 0) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    if (articleIds.length > 100) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    for (const id of articleIds) {
      const article = this.articleStore.getById(id);
      if (!article) throw new AppError(ErrorCode.NotFound, '1031');
      if (article.status !== ArticleStatus.Published) {
        throw new AppError(ErrorCode.StateMachineIllegal, '1002');
      }
    }
    for (const id of articleIds) {
      const article = this.articleStore.getById(id);
      if (article) {
        this.transitionInternal(article, ArticleStatus.Offline);
      }
    }
    appendAuditLog(operatorId, 'batchOffline', articleIds.join(','));
  }

  listByAuthor(authorId: string, page: number, pageSize: number): Page<Article> {
    if (page < 1 || pageSize < 1) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    const result = this.articleStore.listByAuthorPaged(authorId, page, pageSize);
    return { items: result.items, total: result.total, page, pageSize };
  }

  getById(id: string): Article | null {
    return this.articleStore.getById(id);
  }
}
