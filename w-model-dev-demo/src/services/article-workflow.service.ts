/**
 * ArticleWorkflowService（DD-017-002）+ LikeService（DD-018-002）。
 * 与 L3_article_publish_flow.tla / L3_article_like_flow.tla / L4_article_state_machine.tla 一致。
 */
import type { Article } from '../types.js';
import type { ArticleStore } from '../stores/article.store.js';
import type { LikeStore } from '../stores/like.store.js';
import type { ArticleStateMachine, ArticleEvent } from '../utils/article-state-machine.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { OwnershipChecker } from '../utils/article-helpers.js';

export class ArticleWorkflowService {
  private ownershipChecker = new OwnershipChecker();

  constructor(
    private articleStore: ArticleStore,
    private stateMachine: ArticleStateMachine,
  ) {}

  transition(articleId: string, event: ArticleEvent, userId: string, userRole: string): Article {
    const article = this.articleStore.findById(articleId);
    if (!article) throw new NotFoundError('文章');
    this.ownershipChecker.assertOwner(article.authorId, userId, userRole);
    const newStatus = this.stateMachine.transition(article.status, event);
    const patch: Partial<Article> = { status: newStatus };
    if (newStatus === 'published' && article.publishedAt === null) {
      patch.publishedAt = new Date().toISOString();
    }
    if (newStatus === 'draft') {
      patch.publishedAt = null;
    }
    return this.articleStore.update(articleId, patch);
  }

  publish(articleId: string, userId: string, userRole: string): Article {
    return this.transition(articleId, 'publish', userId, userRole);
  }

  unpublish(articleId: string, userId: string, userRole: string): Article {
    return this.transition(articleId, 'unpublish', userId, userRole);
  }

  archive(articleId: string, userId: string, userRole: string): Article {
    return this.transition(articleId, 'archive', userId, userRole);
  }

  getAvailableTransitions(articleId: string): ArticleEvent[] {
    const article = this.articleStore.findById(articleId);
    if (!article) throw new NotFoundError('文章');
    return this.stateMachine.getAvailableTransitions(article.status);
  }
}

export class LikeService {
  constructor(
    private likeStore: LikeStore,
    private articleStore: ArticleStore,
  ) {}

  toggle(userId: string, articleId: string): { liked: boolean; likeCount: number } {
    const article = this.articleStore.findById(articleId);
    if (!article) throw new NotFoundError('文章');
    if (article.status !== 'published') {
      throw new ValidationError('文章未发布，无法点赞');
    }
    const result = this.likeStore.toggle(userId, articleId);
    if (result.liked) {
      this.articleStore.incrementLike(articleId);
    } else {
      this.articleStore.decrementLike(articleId);
    }
    return { liked: result.liked, likeCount: this.articleStore.findById(articleId)!.likeCount };
  }

  like(userId: string, articleId: string): { liked: boolean; likeCount: number } {
    const article = this.articleStore.findById(articleId);
    if (!article) throw new NotFoundError('文章');
    if (article.status !== 'published') {
      throw new ValidationError('文章未发布，无法点赞');
    }
    this.likeStore.add(userId, articleId);
    this.articleStore.incrementLike(articleId);
    return { liked: true, likeCount: this.articleStore.findById(articleId)!.likeCount };
  }

  unlike(userId: string, articleId: string): { liked: boolean; likeCount: number } {
    const article = this.articleStore.findById(articleId);
    if (!article) throw new NotFoundError('文章');
    this.likeStore.remove(userId, articleId);
    this.articleStore.decrementLike(articleId);
    return { liked: false, likeCount: this.articleStore.findById(articleId)!.likeCount };
  }

  hasLiked(userId: string, articleId: string): boolean {
    return this.likeStore.exists(userId, articleId);
  }
}
