/**
 * followService（DD-020 / SD-003）：关注/取关（幂等）；禁止自关注（40002）；followee 须为博主（40002）；
 * feed 按 publishedAt 降序（仅已发布）；触发 follow.created 事件（NEW_FOLLOWER 通知消费）。
 * 身份校验在 user store（经 SD-001 服务方法，P7-002）；feed 文章经 SD-002（article store）。
 */
import { BizError } from '../../utils/errors';
import type { FollowStore } from '../../stores/followStore';
import type { AuthService } from '../identity/authService';
import type { ArticleService } from '../content/articleService';
import type { EventBus } from '../../utils/eventBus';
import type { FeedItem, Page } from '../../types';

export interface FollowResult {
  followerId: string;
  followeeId: string;
  followedAt: string;
}

export class FollowService {
  constructor(
    private readonly followStore: FollowStore,
    private readonly authService: AuthService,
    private readonly articleService: ArticleService,
    private readonly eventBus: EventBus,
  ) {}

  /** 关注博主：身份校验（followee 存在且 role=blogger）→ 自关注拒绝 → 写入（幂等）→ follow.created */
  async followBlogger(followerId: string, followeeId: string): Promise<FollowResult> {
    if (followerId === followeeId) {
      throw new BizError(40002, '不能关注自己');
    }
    const followee = await this.authService.getUserById(followeeId);
    if (!followee) {
      throw new BizError(40401, '用户不存在');
    }
    if (followee.role !== 'blogger') {
      throw new BizError(40002, '只能关注博主');
    }
    const existing = await this.followStore.findByFollowerAndFollowee(followerId, followeeId);
    if (existing) {
      return { followerId, followeeId, followedAt: existing.createdAt };
    }
    const follow = await this.followStore.add({ followerId, followeeId, createdAt: new Date().toISOString() });
    const follower = await this.authService.getUserById(followerId);
    this.eventBus.emit('follow.created', {
      type: 'follow.created',
      followerId,
      followerName: follower?.username ?? '',
      followeeId,
    });
    return { followerId, followeeId, followedAt: follow.createdAt };
  }

  /** 取关（幂等移除；取关后 feed 不再推送） */
  async unfollowBlogger(followerId: string, followeeId: string): Promise<void> {
    await this.followStore.remove(followerId, followeeId);
  }

  /** feed：已关注博主最新已发布文章（publishedAt 降序） */
  async getFeed(userId: string, page: number, pageSize: number): Promise<Page<FeedItem>> {
    const followeeIds = await this.followStore.listFolloweeIdsByFollower(userId);
    if (followeeIds.length === 0) {
      return { items: [], total: 0, page, pageSize };
    }
    const followeeSet = new Set(followeeIds);
    const published = await this.articleService.findAllPublished();
    const articles = published
      .filter((a) => followeeSet.has(a.authorId))
      .sort((x, y) => (y.publishedAt ?? '').localeCompare(x.publishedAt ?? ''));
    const start = (page - 1) * pageSize;
    const items: FeedItem[] = [];
    for (const article of articles.slice(start, start + pageSize)) {
      const author = await this.authService.getUserById(article.authorId);
      items.push({
        articleId: article.id,
        title: article.title,
        summary: article.summary,
        author: { userId: article.authorId, username: author?.username ?? '' },
        publishedAt: article.publishedAt,
      });
    }
    return { items, total: articles.length, page, pageSize };
  }
}
