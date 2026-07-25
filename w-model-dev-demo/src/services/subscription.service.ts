// SD-016 SubscriptionService — subscribe/unsubscribe + aggregation push + permission.

import {
  SubscriptionLevel,
  SubscriptionTarget,
  UserRole,
  type Page,
  type Subscription,
  type SubscriptionEvent,
} from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import type { SubscriptionStore } from '../stores/subscription.store.js';
import type { UserStore } from '../stores/user.store.js';
import type { BloggerStore } from '../stores/blogger.store.js';
import type { TagStore } from '../stores/tag.store.js';
import type { CategoryStore } from '../stores/category.store.js';
import type { PushService } from './push.service.js';

const AGGREGATION_WINDOW_MS = 60 * 60 * 1000; // 1h

export class SubscriptionService {
  constructor(
    private subscriptionStore: SubscriptionStore,
    private userStore: UserStore,
    private bloggerStore: BloggerStore,
    private tagStore: TagStore,
    private categoryStore: CategoryStore,
    private pushService: PushService,
  ) {}

  /** subscribe — TLA+ L2_subscription_push.subscribe. */
  subscribe(
    userId: string,
    target: SubscriptionTarget,
    targetId: string,
  ): Subscription {
    if (!this.userStore.getById(userId)) {
      throw new AppError(ErrorCode.NotFound, '1031');
    }
    return this.subscriptionStore.create(userId, target, targetId, (t, id) =>
      this.targetExists(t, id),
    );
  }

  /** create — alias matching SD-016 design. */
  create(
    userId: string,
    target: SubscriptionTarget,
    targetId: string,
  ): Subscription {
    return this.subscribe(userId, target, targetId);
  }

  /** unsubscribe — TLA+ L2_subscription_push.unsubscribe. */
  unsubscribe(userId: string, target: SubscriptionTarget, targetId: string): void {
    this.subscriptionStore.delete(userId, target, targetId);
  }

  /**
   * aggregateAndPush — TLA+ L2_subscription_push.aggregateAndPush.
   * Enqueue event; if 1h window reached, drain and batch push to all subscribers.
   * Returns the number of push calls made (0 if still within window).
   */
  aggregateAndPush(targetId: string, event: SubscriptionEvent): number {
    const queued = this.subscriptionStore.enqueueEvent(targetId, event);
    // Check if oldest event in queue is older than 1h → flush.
    if (queued.length === 0) return 0;
    const oldest = queued[0]!;
    if (Date.now() - oldest.at.getTime() >= AGGREGATION_WINDOW_MS || queued.length >= 10) {
      const events = this.subscriptionStore.drainQueue(targetId, event.type);
      const subscribers = this.subscriptionStore.listByTarget(targetId);
      let pushCount = 0;
      for (const subUserId of subscribers) {
        this.pushService.push(subUserId, `subscription:${targetId}`, {
          type: event.type,
          targetId,
          events: events.map((e) => ({ refId: e.refId, at: e.at })),
          count: events.length,
        });
        pushCount += 1;
      }
      return pushCount;
    }
    return 0;
  }

  /** listByUser — paged subscription list. */
  listByUser(
    userId: string,
    target: SubscriptionTarget | undefined,
    page: number,
    pageSize: number,
  ): Page<Subscription> {
    if (page < 1 || pageSize < 1) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    const result = this.subscriptionStore.listByUser(userId, target);
    const start = (page - 1) * pageSize;
    return {
      items: result.items.slice(start, start + pageSize),
      total: result.total,
      page,
      pageSize,
    };
  }

  /**
   * permission — TLA+ L2_subscription_push.permission.
   * Returns basic/premium/admin based on user role + subscription count.
   */
  permission(userId: string, _target: SubscriptionTarget): SubscriptionLevel {
    const user = this.userStore.getById(userId);
    if (!user) throw new AppError(ErrorCode.NotFound, '1031');
    if (user.role === UserRole.Admin) return SubscriptionLevel.Admin;
    const subs = this.subscriptionStore.listByUser(userId);
    if (subs.total >= 5) return SubscriptionLevel.Premium;
    return SubscriptionLevel.Basic;
  }

  private targetExists(target: SubscriptionTarget, targetId: string): boolean {
    switch (target) {
      case SubscriptionTarget.Blogger:
        return this.bloggerStore.getById(targetId) !== null;
      case SubscriptionTarget.Tag:
        return this.tagStore.getById(targetId) !== null;
      case SubscriptionTarget.Category:
        return this.categoryStore.getById(targetId) !== null;
      default:
        return false;
    }
  }
}
