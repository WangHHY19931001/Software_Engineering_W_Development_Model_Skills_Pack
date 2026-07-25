// SD-002 BloggerService.

import { SubscriptionTarget, UserRole, type Blogger, type Page } from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import type { BloggerStore } from '../stores/blogger.store.js';
import type { UserStore } from '../stores/user.store.js';
import type { SubscriptionStore } from '../stores/subscription.store.js';
import { invariant } from '../utils/logger.js';

export class BloggerService {
  constructor(
    private bloggerStore: BloggerStore,
    private userStore: UserStore,
    private subscriptionStore: SubscriptionStore,
  ) {}

  /** bloggerRegister — register a new blogger profile. */
  bloggerRegister(userId: string, slug: string, bio: string): Blogger {
    const user = this.userStore.getById(userId);
    if (!user) throw new AppError(ErrorCode.NotFound, '1031');
    if (user.role !== UserRole.Blogger && user.role !== UserRole.Admin) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    return this.bloggerStore.create(userId, slug, bio, user.role);
  }

  /** Alias matching SD-002 design. */
  register(userId: string, slug: string, bio: string): Blogger {
    return this.bloggerRegister(userId, slug, bio);
  }

  getBySlug(slug: string): Blogger | null {
    return this.bloggerStore.getBySlug(slug);
  }

  /** bloggerFollow — follow a blogger. TLA+ L2_identity_access.bloggerFollow */
  bloggerFollow(followerId: string, bloggerId: string): void {
    invariant(!!followerId && !!bloggerId, 'ids required');
    const follower = this.userStore.getById(followerId);
    if (!follower) throw new AppError(ErrorCode.NotFound, '1031');
    if (this.userStore.isBanned(followerId)) {
      throw new AppError(ErrorCode.Banned, '1022');
    }
    const blogger = this.bloggerStore.getById(bloggerId);
    if (!blogger) throw new AppError(ErrorCode.NotFound, '1031');
    if (followerId === blogger.userId) {
      throw new AppError(ErrorCode.SelfReference, '1003');
    }
    // Self-follow check also by bloggerId mapping to follower's blogger record.
    const followerBlogger = this.bloggerStore.getByUserId(followerId);
    if (followerBlogger && followerBlogger.id === bloggerId) {
      throw new AppError(ErrorCode.SelfReference, '1003');
    }
    // Check idempotency: if already subscribed, don't increment followers again.
    const wasSubscribed = this.subscriptionStore.exists(
      followerId,
      SubscriptionTarget.Blogger,
      bloggerId,
    );
    this.subscriptionStore.create(
      followerId,
      SubscriptionTarget.Blogger,
      bloggerId,
      (t, id) => this.targetExists(t, id),
    );
    if (!wasSubscribed) {
      this.bloggerStore.incrementFollowers(bloggerId);
    }
  }

  /** Alias matching SD-002 design. */
  follow(followerId: string, bloggerId: string): void {
    this.bloggerFollow(followerId, bloggerId);
  }

  /** bloggerUnfollow — unfollow a blogger. */
  bloggerUnfollow(followerId: string, bloggerId: string): void {
    if (!this.subscriptionStore.exists(followerId, SubscriptionTarget.Blogger, bloggerId)) {
      throw new AppError(ErrorCode.NotFound, '1031');
    }
    this.subscriptionStore.delete(followerId, SubscriptionTarget.Blogger, bloggerId);
    this.bloggerStore.decrementFollowers(bloggerId);
  }

  unfollow(followerId: string, bloggerId: string): void {
    this.bloggerUnfollow(followerId, bloggerId);
  }

  listByFollower(userId: string, page: number, pageSize: number): Page<Blogger> {
    if (page < 1 || pageSize < 1) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    const all = this.bloggerStore.list(1, Number.MAX_SAFE_INTEGER).items;
    const followed = all.filter((b) =>
      this.subscriptionStore.exists(userId, SubscriptionTarget.Blogger, b.id),
    );
    const start = (page - 1) * pageSize;
    const items = followed.slice(start, start + pageSize);
    return { items, total: followed.length, page, pageSize };
  }

  private targetExists(target: SubscriptionTarget, targetId: string): boolean {
    if (target === SubscriptionTarget.Blogger) {
      return !!this.bloggerStore.getById(targetId);
    }
    return false;
  }
}
