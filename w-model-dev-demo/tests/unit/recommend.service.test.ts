// SD-004 RecommendService unit tests (TC-UNIT-016 ~ TC-UNIT-019).

import { describe, it, expect, beforeEach } from 'vitest';
import { RecommendStore } from '../../src/stores/recommend.store.js';
import { RecommendService } from '../../src/services/recommend.service.js';
import { ArticleStore } from '../../src/stores/article.store.js';
import { SubscriptionStore } from '../../src/stores/subscription.store.js';
import { ArticleStatus, UserRole } from '../../src/types.js';
import { UserStore } from '../../src/stores/user.store.js';
import { AppError } from '../../src/utils/errors.js';

describe('SD-004 RecommendService (TC-UNIT-016 ~ 019)', () => {
  let recommendStore: RecommendStore;
  let articleStore: ArticleStore;
  let subscriptionStore: SubscriptionStore;
  let userStore: UserStore;
  let recommendService: RecommendService;

  beforeEach(() => {
    recommendStore = new RecommendStore();
    articleStore = new ArticleStore();
    subscriptionStore = new SubscriptionStore();
    userStore = new UserStore();
    recommendService = new RecommendService(recommendStore, articleStore, subscriptionStore);
  });

  /** Helper: create + publish an article directly in the store. */
  function makePublishedArticle(viewCount: number, likeCount: number): string {
    const a = articleStore.create('blogger-1', { title: 't', content: 'c' });
    a.status = ArticleStatus.Published;
    a.publishedAt = new Date();
    a.viewCount = viewCount;
    a.likeCount = likeCount;
    articleStore.update(a);
    return a.id;
  }

  it('TC-UNIT-016: hot recommendation formula sorts by score desc', () => {
    const hottest = makePublishedArticle(100, 10, );
    makePublishedArticle(1, 0);
    makePublishedArticle(5, 1);

    const result = recommendService.hot(1, 10);
    expect(result.items).toHaveLength(3);
    expect(result.items[0]!.id).toBe(hottest);
  });

  it('TC-UNIT-017: personalized recommendation requires userId (1011)', () => {
    expect(() => recommendService.personalized('', 1, 10)).toThrow(AppError);
    try {
      recommendService.personalized('', 1, 10);
    } catch (err) {
      expect((err as AppError).code).toBe(1011);
    }
  });

  it('TC-UNIT-018: latest recommendation sorts by publishedAt desc', () => {
    const a1 = articleStore.create('blogger-1', { title: 'a1', content: 'c' });
    a1.status = ArticleStatus.Published;
    a1.publishedAt = new Date(2024, 0, 1);
    articleStore.update(a1);

    const a2 = articleStore.create('blogger-1', { title: 'a2', content: 'c' });
    a2.status = ArticleStatus.Published;
    a2.publishedAt = new Date(2024, 0, 2);
    articleStore.update(a2);

    const result = recommendService.latest(1, 10);
    expect(result.items.length).toBeGreaterThanOrEqual(2);
    expect(
      (result.items[0]!.publishedAt?.getTime() ?? 0) >
        (result.items[1]!.publishedAt?.getTime() ?? 0),
    ).toBe(true);
  });

  it('TC-UNIT-019: setSlot with reader role throws 1021', () => {
    const a = makePublishedArticle(0, 0);
    expect(() =>
      recommendService.setSlot('reader-1', UserRole.Reader, 'slot1', a, 1),
    ).toThrow(AppError);
    try {
      recommendService.setSlot('reader-1', UserRole.Reader, 'slot1', a, 1);
    } catch (err) {
      expect((err as AppError).code).toBe(1021);
    }
  });
});
