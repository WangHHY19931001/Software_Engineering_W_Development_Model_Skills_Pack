// SD-016 SubscriptionStore + SubscriptionService unit tests (TC-UNIT-071 ~ TC-UNIT-075).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubscriptionStore } from '../../src/stores/subscription.store.js';
import { SubscriptionService } from '../../src/services/subscription.service.js';
import { UserStore } from '../../src/stores/user.store.js';
import { BloggerStore } from '../../src/stores/blogger.store.js';
import { TagStore } from '../../src/stores/tag.store.js';
import { CategoryStore } from '../../src/stores/category.store.js';
import { WsStore } from '../../src/stores/ws.store.js';
import { PushService } from '../../src/services/push.service.js';
import { SubscriptionLevel, SubscriptionTarget, UserRole } from '../../src/types.js';
import { AppError } from '../../src/utils/errors.js';

describe('SD-016 SubscriptionStore + SubscriptionService (TC-UNIT-071 ~ 075)', () => {
  let subscriptionStore: SubscriptionStore;
  let userStore: UserStore;
  let bloggerStore: BloggerStore;
  let tagStore: TagStore;
  let categoryStore: CategoryStore;
  let wsStore: WsStore;
  let pushService: PushService;
  let subscriptionService: SubscriptionService;
  // Capture actual ids — UserStore/BloggerStore module-level counters persist
  // across test cases within a file, so the ids may not be 'u-1'/'b-1' after the first test.
  let subUserId: string;
  let bloggerId: string;

  beforeEach(() => {
    subscriptionStore = new SubscriptionStore();
    userStore = new UserStore();
    bloggerStore = new BloggerStore();
    tagStore = new TagStore();
    categoryStore = new CategoryStore();
    wsStore = new WsStore();
    pushService = new PushService(wsStore);
    subscriptionService = new SubscriptionService(
      subscriptionStore,
      userStore,
      bloggerStore,
      tagStore,
      categoryStore,
      pushService,
    );

    // Seed a user + a blogger target for subscription.
    const subUser = userStore.create({
      email: 'sub@x.com',
      password: 'passwordpassword',
      displayName: 'sub',
      role: UserRole.Reader,
    });
    subUserId = subUser.id;
    const bloggerUser = userStore.create({
      email: 'blogger@x.com',
      password: 'passwordpassword',
      displayName: 'blogger',
      role: UserRole.Blogger,
    });
    const blogger = bloggerStore.create(bloggerUser.id, 'blogger-slug', 'bio', 'blogger');
    bloggerId = blogger.id;
  });

  it('TC-UNIT-071: subscription create is idempotent (no duplicate)', () => {
    const initial = subscriptionStore.size();
    subscriptionService.create(subUserId, SubscriptionTarget.Blogger, bloggerId);
    subscriptionService.create(subUserId, SubscriptionTarget.Blogger, bloggerId); // idempotent
    expect(subscriptionStore.size()).toBe(initial + 1);
  });

  it('TC-UNIT-072: aggregateAndPush batches events within 1h window', () => {
    // Subscribe a user to blogger so there is a subscriber to push to.
    subscriptionService.create(subUserId, SubscriptionTarget.Blogger, bloggerId);

    // Enqueue 10 events to trigger the >= 10 flush threshold.
    const pushSpy = vi.spyOn(pushService, 'push');
    for (let i = 0; i < 10; i++) {
      subscriptionService.aggregateAndPush(bloggerId, {
        type: 'article-published',
        refId: `ref-${i}`,
        at: new Date(),
      });
    }
    // After 10 events, flush triggers; push called once per subscriber.
    expect(pushSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('TC-UNIT-073: listByUser pagination returns correct page slice', () => {
    // Create multiple bloggers to subscribe to.
    const bloggerIds: string[] = [];
    for (let i = 1; i <= 15; i++) {
      const u = userStore.create({
        email: `b${i}@x.com`,
        password: 'passwordpassword',
        displayName: `b${i}`,
        role: UserRole.Blogger,
      });
      const b = bloggerStore.create(u.id, `slug-${i}`, 'bio', 'blogger');
      bloggerIds.push(b.id);
    }
    // subUserId subscribes to 15 bloggers.
    for (const bid of bloggerIds) {
      subscriptionService.create(subUserId, SubscriptionTarget.Blogger, bid);
    }

    const page2 = subscriptionService.listByUser(subUserId, undefined, 2, 10);
    expect(page2.items).toHaveLength(5);
    expect(page2.total).toBe(15);
  });

  it('TC-UNIT-074: permission returns basic for reader with <5 subscriptions', () => {
    // subUserId is a reader with 0 subscriptions → basic.
    const result = subscriptionService.permission(subUserId, SubscriptionTarget.Blogger);
    expect(result).toBe(SubscriptionLevel.Basic);
  });

  it('TC-UNIT-075: subscribe to non-existent target throws 1031', () => {
    expect(() =>
      subscriptionService.create(subUserId, SubscriptionTarget.Blogger, 'no-such-blogger'),
    ).toThrow(AppError);
    try {
      subscriptionService.create(subUserId, SubscriptionTarget.Blogger, 'no-such-blogger');
    } catch (err) {
      expect((err as AppError).code).toBe(1031);
    }
  });
});
