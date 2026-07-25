// SD-001 SiteService + SiteStore unit tests (TC-UNIT-001 ~ TC-UNIT-005).

import { describe, it, expect, beforeEach } from 'vitest';
import { SiteStore } from '../../src/stores/site.store.js';
import { SiteService } from '../../src/services/site.service.js';
import { ArticleStore } from '../../src/stores/article.store.js';
import { UserStore } from '../../src/stores/user.store.js';
import { BloggerStore } from '../../src/stores/blogger.store.js';
import { CommentStore } from '../../src/stores/comment.store.js';
import { FileStore } from '../../src/stores/file.store.js';
import { AppError } from '../../src/utils/errors.js';

describe('SD-001 SiteService + SiteStore (TC-UNIT-001 ~ 005)', () => {
  let siteStore: SiteStore;
  let siteService: SiteService;

  beforeEach(() => {
    siteStore = new SiteStore();
    siteService = new SiteService(siteStore);
  });

  it('TC-UNIT-001: admin updates site config successfully', () => {
    const result = siteStore.updateConfig('admin-1', { siteName: '新站' }, 'admin');
    expect(result.siteName).toBe('新站');
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it('TC-UNIT-002: non-admin update config throws RBAC 1021', () => {
    expect(() => siteStore.updateConfig('reader-1', { siteName: 'x' }, 'reader')).toThrow(
      AppError,
    );
    try {
      siteStore.updateConfig('reader-1', { siteName: 'x' }, 'reader');
    } catch (err) {
      expect((err as AppError).code).toBe(1021);
    }
  });

  it('TC-UNIT-003: maintenance mode blocks non-admin with 1023/503', () => {
    siteService.setMaintenanceMode('admin-1', 'admin', true);
    expect(() => siteService.requireNotMaintenance('reader')).toThrow(AppError);
    try {
      siteService.requireNotMaintenance('reader');
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.code).toBe(1023);
      expect(appErr.httpStatus).toBe(503);
    }
  });

  it('TC-UNIT-004: scheduleAnnouncement with past date throws 1001', () => {
    const pastDate = new Date(Date.now() - 60_000);
    expect(() =>
      siteService.scheduleAnnouncement('admin-1', 'admin', 'hello', pastDate),
    ).toThrow(AppError);
    try {
      siteService.scheduleAnnouncement('admin-1', 'admin', 'hello', pastDate);
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }
  });

  it('TC-UNIT-005: getStatsOverview aggregates counts across stores', () => {
    const userStore = new UserStore();
    const bloggerStore = new BloggerStore();
    const articleStore = new ArticleStore();
    const commentStore = new CommentStore();
    const fileStore = new FileStore();
    siteStore.setStores({ userStore, bloggerStore, articleStore, commentStore, fileStore });

    for (let i = 0; i < 5; i++) {
      userStore.create({
        email: `u${i}@x.com`,
        password: 'hashhashhashhashhashhashhashhash',
        displayName: `user-${i}`,
      });
    }
    for (let i = 0; i < 10; i++) {
      articleStore.create('b-1', { title: `t${i}`, content: 'c' });
    }

    const result = siteStore.getStatsOverview();
    expect(result.articleCount).toBe(10);
    expect(result.userCount).toBe(5);
  });
});
