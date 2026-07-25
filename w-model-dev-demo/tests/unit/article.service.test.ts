// SD-012 ArticleStore + ArticleService unit tests (TC-UNIT-049 ~ TC-UNIT-054).

import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleStore } from '../../src/stores/article.store.js';
import { ArticleService } from '../../src/services/article.service.js';
import { SearchStore } from '../../src/stores/search.store.js';
import { UserStore } from '../../src/stores/user.store.js';
import { ArticleStatus, ScheduleStatus, UserRole } from '../../src/types.js';
import { AppError } from '../../src/utils/errors.js';

describe('SD-012 ArticleStore + ArticleService (TC-UNIT-049 ~ 054)', () => {
  let articleStore: ArticleStore;
  let searchStore: SearchStore;
  let userStore: UserStore;
  let articleService: ArticleService;

  beforeEach(() => {
    articleStore = new ArticleStore();
    searchStore = new SearchStore();
    userStore = new UserStore();
    articleService = new ArticleService(articleStore, searchStore, userStore);
    // Seed a blogger user for createArticle.
    userStore.create({
      email: 'blogger@x.com',
      password: 'passwordpassword',
      displayName: 'blogger',
      role: UserRole.Blogger,
    });
  });

  it('TC-UNIT-049: article create with title > 200 chars throws 1001', () => {
    const longTitle = 'x'.repeat(201);
    expect(() =>
      articleStore.create('blogger-1', { title: longTitle, content: 'c' }),
    ).toThrow(AppError);
    try {
      articleStore.create('blogger-1', { title: longTitle, content: 'c' });
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }
  });

  it('TC-UNIT-050: article transition draft → pending_review succeeds', () => {
    const article = articleStore.create('blogger-1', { title: 't', content: 'c' });
    articleService.transition('blogger-1', article.id, ArticleStatus.PendingReview);
    const updated = articleStore.getById(article.id);
    expect(updated?.status).toBe(ArticleStatus.PendingReview);
  });

  it('TC-UNIT-051: article reverse transition archived → published throws 1002', () => {
    // Build an article and move it through draft → pending_review → published → offline → archived.
    const article = articleStore.create('blogger-1', { title: 't', content: 'c' });
    articleService.transition('blogger-1', article.id, ArticleStatus.PendingReview);
    articleService.transition('blogger-1', article.id, ArticleStatus.Published);
    articleService.transition('blogger-1', article.id, ArticleStatus.Offline);
    articleService.transition('blogger-1', article.id, ArticleStatus.Archived);

    // Archived → Published is NOT in VALID_NEXT[Archived] = [Archived].
    expect(() =>
      articleService.transition('blogger-1', article.id, ArticleStatus.Published),
    ).toThrow(AppError);
    try {
      articleService.transition('blogger-1', article.id, ArticleStatus.Published);
    } catch (err) {
      expect((err as AppError).code).toBe(1002);
    }
  });

  it('TC-UNIT-052: schedulePublish sets scheduleStatus to pending', () => {
    const article = articleStore.create('blogger-1', { title: 't', content: 'c' });
    articleService.transition('blogger-1', article.id, ArticleStatus.PendingReview);
    const futureDate = new Date(Date.now() + 60_000);
    articleService.schedule('blogger-1', article.id, futureDate);

    const updated = articleStore.getById(article.id);
    expect(updated?.scheduleStatus).toBe(ScheduleStatus.Pending);
    expect(updated?.scheduledAt).toBeInstanceOf(Date);
  });

  it('TC-UNIT-053: fireScheduledPublish transitions to published and sets schedule_fired', () => {
    const article = articleStore.create('blogger-1', { title: 't', content: 'c' });
    articleService.transition('blogger-1', article.id, ArticleStatus.PendingReview);
    const futureDate = new Date(Date.now() + 60_000);
    articleService.schedule('blogger-1', article.id, futureDate);

    articleService.fireScheduledPublish(article.id);

    const updated = articleStore.getById(article.id);
    expect(updated?.status).toBe(ArticleStatus.Published);
    expect(updated?.scheduleStatus).toBe(ScheduleStatus.Fired);
  });

  it('TC-UNIT-054: batchOffline with reader role throws 1021', () => {
    // Create + publish an article.
    const article = articleStore.create('blogger-1', { title: 't', content: 'c' });
    articleService.transition('blogger-1', article.id, ArticleStatus.PendingReview);
    articleService.transition('blogger-1', article.id, ArticleStatus.Published);

    expect(() =>
      articleService.batchOffline('reader-1', UserRole.Reader, [article.id]),
    ).toThrow(AppError);
    try {
      articleService.batchOffline('reader-1', UserRole.Reader, [article.id]);
    } catch (err) {
      expect((err as AppError).code).toBe(1021);
    }
  });
});
