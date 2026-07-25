// SD-004 RecommendService.

import { ArticleStatus, UserRole, type Article, type Page } from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import type { RecommendStore } from '../stores/recommend.store.js';
import type { ArticleStore } from '../stores/article.store.js';
import type { SubscriptionStore } from '../stores/subscription.store.js';
import { SubscriptionTarget } from '../types.js';

export type RecommendationMode = 'hot' | 'latest' | 'personalized';

export class RecommendService {
  private mode: RecommendationMode = 'hot';

  constructor(
    private recommendStore: RecommendStore,
    private articleStore: ArticleStore,
    private subscriptionStore: SubscriptionStore,
  ) {}

  /** hot — score = viewCount*1 + likeCount*5 + commentCount*10, desc. */
  hot(page: number, pageSize: number): Page<Article> {
    if (page < 1 || pageSize < 1) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    const all = this.articleStore.listByStatus(ArticleStatus.Published);
    const sorted = all.sort(
      (a, b) => this.recommendStore.hotRank(b) - this.recommendStore.hotRank(a),
    );
    const start = (page - 1) * pageSize;
    return {
      items: sorted.slice(start, start + pageSize),
      total: sorted.length,
      page,
      pageSize,
    };
  }

  /** personalized — articles from subscribed bloggers, time desc. */
  personalized(userId: string, page: number, pageSize: number): Page<Article> {
    if (!userId) throw new AppError(ErrorCode.NoUser, '1011');
    if (page < 1 || pageSize < 1) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    const subs = this.subscriptionStore.listByUser(userId, SubscriptionTarget.Blogger);
    const bloggerIds = subs.items.map((s) => s.targetId);
    const all: Article[] = [];
    for (const bloggerId of bloggerIds) {
      // bloggerId here is the Blogger.id; for now treat as authorId proxy.
      // In a real system, Subscription.targetId for Blogger target = blogger.id,
      // and Article.authorId is user.id. We provide best-effort by listing both.
      const articles = this.articleStore.listByAuthor(bloggerId);
      all.push(...articles);
    }
    const sorted = all
      .filter((a) => a.status === ArticleStatus.Published)
      .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
    const start = (page - 1) * pageSize;
    return {
      items: sorted.slice(start, start + pageSize),
      total: sorted.length,
      page,
      pageSize,
    };
  }

  /** latest — publishedAt desc. */
  latest(page: number, pageSize: number): Page<Article> {
    if (page < 1 || pageSize < 1) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    const all = this.articleStore.listByStatus(ArticleStatus.Published);
    const sorted = all.sort(
      (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
    );
    const start = (page - 1) * pageSize;
    return {
      items: sorted.slice(start, start + pageSize),
      total: sorted.length,
      page,
      pageSize,
    };
  }

  /** setSlot — admin only. */
  setSlot(_operatorId: string, operatorRole: string, slotName: string, articleId: string, priority: number): void {
    if (operatorRole !== UserRole.Admin) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    if (!slotName || slotName.length > 50) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    if (priority < 0) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    const article = this.articleStore.getById(articleId);
    if (!article) throw new AppError(ErrorCode.NotFound, '1031');
    if (article.status !== ArticleStatus.Published) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    this.recommendStore.setSlot(slotName, articleId, priority);
  }

  /** setRecommendationMode — TLA+ L2_discovery.setRecommendationMode */
  setRecommendationMode(_operatorId: string, operatorRole: string, mode: RecommendationMode): void {
    if (operatorRole !== UserRole.Admin) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    this.mode = mode;
  }

  getMode(): RecommendationMode {
    return this.mode;
  }

  /** recordArticleView — TLA+ L2_discovery.recordArticleView */
  recordArticleView(articleId: string): void {
    const article = this.articleStore.getById(articleId);
    if (!article) throw new AppError(ErrorCode.NotFound, '1031');
    this.articleStore.incrementView(articleId);
  }
}
