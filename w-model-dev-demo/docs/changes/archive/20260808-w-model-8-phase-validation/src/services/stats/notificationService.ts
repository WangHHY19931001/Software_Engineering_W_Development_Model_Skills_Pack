/**
 * notificationService（DD-033 / SD-005）：通知（REQ-026）。
 * 订阅 article.published（NEW_ARTICLE）/comment.created（REPLY）/article.liked（LIKE）/follow.created（NEW_FOLLOWER）；
 * 列表/标记已读（幂等；他人通知 40401 防枚举）。
 */
import { BizError } from '../../utils/errors';
import type { NotificationStore } from '../../stores/notificationStore';
import type { AuthService } from '../identity/authService';
import type { EventBus } from '../../utils/eventBus';
import type {
  ArticleLikedEvent,
  ArticlePublishedEvent,
  CommentCreatedEvent,
  FollowCreatedEvent,
  Notification,
  Page,
} from '../../types';

export class NotificationService {
  constructor(
    private readonly notificationStore: NotificationStore,
    private readonly authService: AuthService,
    private readonly eventBus?: EventBus,
  ) {}

  /** article.published → 关注该博主的粉丝收到 NEW_ARTICLE 通知（粉丝列表由装配层经 followStore 注入） */
  onArticlePublished(event: ArticlePublishedEvent): void {
    for (const followerId of event.followerIds ?? []) {
      this.notificationStore.create({
        userId: followerId,
        type: 'NEW_ARTICLE',
        articleId: event.articleId,
        actorId: event.authorId,
        actorName: event.authorName,
        content: `博主发布了新文章：${event.title}`,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  /** comment.created → 文章作者收到 REPLY 通知（回复者即作者本人不通知） */
  onCommentCreated(event: CommentCreatedEvent): void {
    if (event.authorId === event.articleAuthorId) {
      return;
    }
    this.notificationStore.create({
      userId: event.articleAuthorId,
      type: 'REPLY',
      articleId: event.articleId,
      actorId: event.authorId,
      actorName: event.authorName,
      content: event.content.length > 100 ? `${event.content.slice(0, 100)}…` : event.content,
      read: false,
      createdAt: new Date().toISOString(),
    });
  }

  /** article.liked → 文章作者收到 LIKE 通知 */
  async onArticleLiked(event: ArticleLikedEvent): Promise<void> {
    const actor = await this.authService.getUserById(event.userId);
    this.notificationStore.create({
      userId: event.articleAuthorId,
      type: 'LIKE',
      articleId: event.articleId,
      actorId: event.userId,
      actorName: actor?.username ?? '',
      content: '你的文章收到新的点赞',
      read: false,
      createdAt: new Date().toISOString(),
    });
  }

  /** follow.created → followee（博主）收到 NEW_FOLLOWER 通知 */
  onFollowCreated(event: FollowCreatedEvent): void {
    this.notificationStore.create({
      userId: event.followeeId,
      type: 'NEW_FOLLOWER',
      articleId: null,
      actorId: event.followerId,
      actorName: event.followerName,
      content: '新的粉丝关注了你',
      read: false,
      createdAt: new Date().toISOString(),
    });
  }

  /** 本人通知分页（createdAt 降序；unreadOnly 过滤） */
  listNotifications(userId: string, page: number, pageSize: number, unreadOnly = false): Page<Notification> {
    return this.notificationStore.listByUser(userId, page, pageSize, unreadOnly);
  }

  /** 标记已读（他人通知 40401 防枚举；幂等） */
  async markNotificationRead(userId: string, notificationId: string): Promise<Notification> {
    const notification = await this.notificationStore.findById(notificationId);
    if (!notification || notification.userId !== userId) {
      throw new BizError(40401, '通知不存在');
    }
    const updated = await this.notificationStore.markRead(notificationId);
    if (!updated) throw new BizError(40401, '通知不存在');
    return updated;
  }

  /* ============ TLA+ Next 分支对应（L2_BlogSystemAnalytics，命名契约） ============ */

  /** TLA+ L2_BlogSystemAnalytics "GenerateCommentEvent" 动作对应：评论事件生成通知（onCommentCreated 薄封装） */
  generateCommentEvent(event: CommentCreatedEvent): void {
    this.onCommentCreated(event);
  }

  /** TLA+ L2_BlogSystemAnalytics "GenerateLikeEvent" 动作对应：点赞事件生成通知（onArticleLiked 薄封装） */
  async generateLikeEvent(event: ArticleLikedEvent): Promise<void> {
    await this.onArticleLiked(event);
  }

  /** TLA+ L2_BlogSystemAnalytics "GenerateFollowPublishEvent" 动作对应：关注博主发文事件生成通知（onArticlePublished 薄封装） */
  generateFollowPublishEvent(event: ArticlePublishedEvent): void {
    this.onArticlePublished(event);
  }
}
