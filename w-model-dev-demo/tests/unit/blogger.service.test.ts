// SD-002 BloggerStore + BloggerService unit tests (TC-UNIT-006 ~ TC-UNIT-010).

import { describe, it, expect, beforeEach } from 'vitest';
import { BloggerStore } from '../../src/stores/blogger.store.js';
import { BloggerService } from '../../src/services/blogger.service.js';
import { UserStore } from '../../src/stores/user.store.js';
import { SubscriptionStore } from '../../src/stores/subscription.store.js';
import { UserRole } from '../../src/types.js';
import { AppError } from '../../src/utils/errors.js';

describe('SD-002 BloggerStore + BloggerService (TC-UNIT-006 ~ 010)', () => {
  let bloggerStore: BloggerStore;
  let userStore: UserStore;
  let subscriptionStore: SubscriptionStore;
  let bloggerService: BloggerService;

  beforeEach(() => {
    bloggerStore = new BloggerStore();
    userStore = new UserStore();
    subscriptionStore = new SubscriptionStore();
    bloggerService = new BloggerService(bloggerStore, userStore, subscriptionStore);
  });

  it('TC-UNIT-006: blogger slug uniqueness throws 1005', () => {
    bloggerStore.create('u-1', 'alice', 'bio', 'blogger');
    expect(bloggerStore.hasSlug('alice')).toBe(true);
    expect(() => bloggerStore.create('u-2', 'alice', 'bio', 'blogger')).toThrow(AppError);
    try {
      bloggerStore.create('u-2', 'alice', 'bio', 'blogger');
    } catch (err) {
      expect((err as AppError).code).toBe(1005);
    }
  });

  it('TC-UNIT-007: slug with uppercase throws 1001', () => {
    expect(() => bloggerStore.create('u-1', 'Alice', 'bio', 'blogger')).toThrow(AppError);
    try {
      bloggerStore.create('u-1', 'Alice', 'bio', 'blogger');
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }
  });

  it('TC-UNIT-008: follow blogger succeeds and increments followerCount', () => {
    // Create two blogger users.
    const follower = userStore.create({
      email: 'follower@x.com',
      password: 'passwordpassword',
      displayName: 'follower',
      role: UserRole.Blogger,
    });
    const target = userStore.create({
      email: 'target@x.com',
      password: 'passwordpassword',
      displayName: 'target',
      role: UserRole.Blogger,
    });
    const targetBlogger = bloggerStore.create(target.id, 'target-slug', 'bio', 'blogger');

    bloggerService.follow(follower.id, targetBlogger.id);

    expect(subscriptionStore.size()).toBe(1);
    const updated = bloggerStore.getById(targetBlogger.id);
    expect(updated?.followerCount).toBe(1);
  });

  it('TC-UNIT-009: self-follow throws 1003', () => {
    const user = userStore.create({
      email: 'self@x.com',
      password: 'passwordpassword',
      displayName: 'self',
      role: UserRole.Blogger,
    });
    const blogger = bloggerStore.create(user.id, 'self-slug', 'bio', 'blogger');

    expect(() => bloggerService.follow(user.id, blogger.id)).toThrow(AppError);
    try {
      bloggerService.follow(user.id, blogger.id);
    } catch (err) {
      expect((err as AppError).code).toBe(1003);
    }
  });

  it('TC-UNIT-010: unfollow non-existent relationship throws 1031', () => {
    const follower = userStore.create({
      email: 'f2@x.com',
      password: 'passwordpassword',
      displayName: 'f2',
      role: UserRole.Blogger,
    });
    const target = userStore.create({
      email: 't2@x.com',
      password: 'passwordpassword',
      displayName: 't2',
      role: UserRole.Blogger,
    });
    const targetBlogger = bloggerStore.create(target.id, 't2-slug', 'bio', 'blogger');

    expect(() => bloggerService.unfollow(follower.id, targetBlogger.id)).toThrow(AppError);
    try {
      bloggerService.unfollow(follower.id, targetBlogger.id);
    } catch (err) {
      expect((err as AppError).code).toBe(1031);
    }
  });
});
