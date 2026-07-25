// SD-006 StatsService + StatsStore unit tests (TC-UNIT-024 ~ TC-UNIT-027).

import { describe, it, expect, beforeEach } from 'vitest';
import { StatsStore } from '../../src/stores/stats.store.js';
import { StatsService } from '../../src/services/stats.service.js';
import { ArticleStore } from '../../src/stores/article.store.js';
import { UserStore } from '../../src/stores/user.store.js';
import { BloggerStore } from '../../src/stores/blogger.store.js';
import { ArticleStatus, UserRole } from '../../src/types.js';
import { AppError } from '../../src/utils/errors.js';

describe('SD-006 StatsService + StatsStore (TC-UNIT-024 ~ 027)', () => {
  let statsStore: StatsStore;
  let statsService: StatsService;
  let articleStore: ArticleStore;
  let userStore: UserStore;
  let bloggerStore: BloggerStore;

  beforeEach(() => {
    statsStore = new StatsStore();
    statsService = new StatsService(statsStore);
    articleStore = new ArticleStore();
    userStore = new UserStore();
    bloggerStore = new BloggerStore();
    statsStore.setStores({ articleStore, userStore, bloggerStore });
  });

  it('TC-UNIT-024: articleStats aggregates by status', () => {
    // 10 published + 5 draft.
    for (let i = 0; i < 10; i++) {
      const a = articleStore.create('blogger-1', { title: `p${i}`, content: 'c' });
      a.status = ArticleStatus.Published;
      articleStore.update(a);
    }
    for (let i = 0; i < 5; i++) {
      articleStore.create('blogger-1', { title: `d${i}`, content: 'c' }); // stays draft
    }

    const result = statsService.articleStats('admin');
    expect(result.published).toBe(10);
    expect(result.draft).toBe(5);
  });

  it('TC-UNIT-025: userStats aggregates by role', () => {
    // 3 admin + 10 reader.
    for (let i = 0; i < 3; i++) {
      userStore.create({
        email: `admin${i}@x.com`,
        password: 'passwordpassword',
        displayName: `admin-${i}`,
        role: UserRole.Admin,
      });
    }
    for (let i = 0; i < 10; i++) {
      userStore.create({
        email: `reader${i}@x.com`,
        password: 'passwordpassword',
        displayName: `reader-${i}`,
        role: UserRole.Reader,
      });
    }

    const result = statsService.userStats('admin');
    expect(result.byRole[UserRole.Admin]).toBe(3);
    expect(result.byRole[UserRole.Reader]).toBe(10);
  });

  it('TC-UNIT-026: non-admin access to stats throws 1021', () => {
    expect(() => statsService.articleStats('reader')).toThrow(AppError);
    try {
      statsService.articleStats('reader');
    } catch (err) {
      expect((err as AppError).code).toBe(1021);
    }
  });

  it('TC-UNIT-027: siteTrend with days=100 (>90 limit) throws 1001', () => {
    expect(() => statsService.siteTrend('admin', 100)).toThrow(AppError);
    try {
      statsService.siteTrend('admin', 100);
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }
  });
});
