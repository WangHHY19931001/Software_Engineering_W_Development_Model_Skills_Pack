// Supplementary unit tests for coverage gaps (TC-UNIT-098 ~ TC-UNIT-115).
// Targets uncovered methods in: ArticleService, SiteService, BackupService,
// FileService, RecommendStore, logger, errors.

import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleStore } from '../../src/stores/article.store.js';
import { ArticleService } from '../../src/services/article.service.js';
import { SearchStore } from '../../src/stores/search.store.js';
import { UserStore } from '../../src/stores/user.store.js';
import { SiteStore } from '../../src/stores/site.store.js';
import { SiteService } from '../../src/services/site.service.js';
import { BackupStore } from '../../src/stores/backup.store.js';
import { BackupService } from '../../src/services/backup.service.js';
import { BloggerStore } from '../../src/stores/blogger.store.js';
import { CommentStore } from '../../src/stores/comment.store.js';
import { NotificationStore } from '../../src/stores/notification.store.js';
import { FileStore } from '../../src/stores/file.store.js';
import { FileService } from '../../src/services/file.service.js';
import { RecommendStore } from '../../src/stores/recommend.store.js';
import {
  ArticleStatus,
  BackupType,
  ScheduleStatus,
  UserRole,
} from '../../src/types.js';
import { AppError, ErrorCode, errorHandler, hasErrorCode, throwAppError } from '../../src/utils/errors.js';
import {
  appendAuditLog,
  appendOperationLog,
  auditLogBuffer,
  clearAuditLogs,
  debugAssert,
  invariant,
} from '../../src/utils/logger.js';

// =================================================================
// SD-012 ArticleService — uncovered methods
// =================================================================

describe('SD-012 ArticleService supplementary (TC-UNIT-098 ~ 100)', () => {
  let articleStore: ArticleStore;
  let searchStore: SearchStore;
  let userStore: UserStore;
  let articleService: ArticleService;
  let bloggerId: string;
  let adminId: string;

  beforeEach(() => {
    articleStore = new ArticleStore();
    searchStore = new SearchStore();
    userStore = new UserStore();
    articleService = new ArticleService(articleStore, searchStore, userStore);
    const blogger = userStore.create({
      email: 'blogger@x.com',
      password: 'passwordpassword',
      displayName: 'blogger',
      role: UserRole.Blogger,
    });
    bloggerId = blogger.id;
    const admin = userStore.create({
      email: 'admin@x.com',
      password: 'passwordpassword',
      displayName: 'admin',
      role: UserRole.Admin,
    });
    adminId = admin.id;
  });

  it('TC-UNIT-098: createArticle through service indexes article in search', () => {
    const article = articleService.createArticle(bloggerId, { title: 't', content: 'c' });
    expect(article.status).toBe(ArticleStatus.Draft);
    expect(article.authorId).toBe(bloggerId);
    // search store should have indexed the article
    const results = searchStore.search('t');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('TC-UNIT-098b: createArticle with reader role throws 1021', () => {
    const reader = userStore.create({
      email: 'reader@x.com',
      password: 'passwordpassword',
      displayName: 'reader',
      role: UserRole.Reader,
    });
    expect(() =>
      articleService.createArticle(reader.id, { title: 't', content: 'c' }),
    ).toThrow(AppError);
    try {
      articleService.createArticle(reader.id, { title: 't', content: 'c' });
    } catch (err) {
      expect((err as AppError).code).toBe(1021);
    }
  });

  it('TC-UNIT-098c: createArticle with non-existent author throws 1031', () => {
    expect(() =>
      articleService.createArticle('no-such-user', { title: 't', content: 'c' }),
    ).toThrow(AppError);
    try {
      articleService.createArticle('no-such-user', { title: 't', content: 'c' });
    } catch (err) {
      expect((err as AppError).code).toBe(1031);
    }
  });

  it('TC-UNIT-099: approveArticle by admin transitions pending_review → published', () => {
    const article = articleService.createArticle(bloggerId, { title: 't', content: 'c' });
    articleService.submitForReview(bloggerId, article.id);
    articleService.approveArticle(adminId, UserRole.Admin, article.id);
    const updated = articleStore.getById(article.id);
    expect(updated?.status).toBe(ArticleStatus.Published);
    expect(updated?.publishedAt).toBeInstanceOf(Date);
  });

  it('TC-UNIT-099b: approveArticle by non-admin throws 1021', () => {
    const article = articleService.createArticle(bloggerId, { title: 't', content: 'c' });
    articleService.submitForReview(bloggerId, article.id);
    expect(() =>
      articleService.approveArticle(bloggerId, UserRole.Blogger, article.id),
    ).toThrow(AppError);
    try {
      articleService.approveArticle(bloggerId, UserRole.Blogger, article.id);
    } catch (err) {
      expect((err as AppError).code).toBe(1021);
    }
  });

  it('TC-UNIT-099c: approveArticle on non-pending status throws 1002', () => {
    const article = articleService.createArticle(bloggerId, { title: 't', content: 'c' });
    // Still in draft status
    expect(() =>
      articleService.approveArticle(adminId, UserRole.Admin, article.id),
    ).toThrow(AppError);
    try {
      articleService.approveArticle(adminId, UserRole.Admin, article.id);
    } catch (err) {
      expect((err as AppError).code).toBe(1002);
    }
  });

  it('TC-UNIT-100: offlineArticle + archiveArticle + republishArticle by admin', () => {
    const article = articleService.createArticle(bloggerId, { title: 't', content: 'c' });
    articleService.submitForReview(bloggerId, article.id);
    articleService.approveArticle(adminId, UserRole.Admin, article.id);
    // offline
    articleService.offlineArticle(adminId, UserRole.Admin, article.id);
    expect(articleStore.getById(article.id)?.status).toBe(ArticleStatus.Offline);
    // archive
    articleService.archiveArticle(adminId, UserRole.Admin, article.id);
    expect(articleStore.getById(article.id)?.status).toBe(ArticleStatus.Archived);
    expect(articleStore.getById(article.id)?.archivedAt).toBeInstanceOf(Date);
  });

  it('TC-UNIT-100b: republishArticle on archived article throws 1002', () => {
    const article = articleService.createArticle(bloggerId, { title: 't', content: 'c' });
    articleService.submitForReview(bloggerId, article.id);
    articleService.approveArticle(adminId, UserRole.Admin, article.id);
    articleService.offlineArticle(adminId, UserRole.Admin, article.id);
    articleService.archiveArticle(adminId, UserRole.Admin, article.id);
    expect(() =>
      articleService.republishArticle(adminId, UserRole.Admin, article.id),
    ).toThrow(AppError);
    try {
      articleService.republishArticle(adminId, UserRole.Admin, article.id);
    } catch (err) {
      expect((err as AppError).code).toBe(1002);
    }
  });

  it('TC-UNIT-100c: offlineArticle by non-owner non-admin throws 1021', () => {
    const article = articleService.createArticle(bloggerId, { title: 't', content: 'c' });
    articleService.submitForReview(bloggerId, article.id);
    articleService.approveArticle(adminId, UserRole.Admin, article.id);
    const other = userStore.create({
      email: 'other@x.com',
      password: 'passwordpassword',
      displayName: 'other',
      role: UserRole.Blogger,
    });
    expect(() =>
      articleService.offlineArticle(other.id, UserRole.Blogger, article.id),
    ).toThrow(AppError);
  });

  it('TC-UNIT-100d: listByAuthor + getById return expected shapes', () => {
    const article = articleService.createArticle(bloggerId, { title: 't1', content: 'c' });
    const found = articleService.getById(article.id);
    expect(found?.id).toBe(article.id);
    const page = articleService.listByAuthor(bloggerId, 1, 10);
    expect(page.items.length).toBe(1);
    expect(page.total).toBe(1);
  });

  it('TC-UNIT-100e: listByAuthor with invalid pagination throws 1001', () => {
    expect(() => articleService.listByAuthor(bloggerId, 0, 10)).toThrow(AppError);
    try {
      articleService.listByAuthor(bloggerId, 0, 10);
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }
  });

  it('TC-UNIT-100f: batchOffline with empty list throws 1001', () => {
    expect(() =>
      articleService.batchOffline(adminId, UserRole.Admin, []),
    ).toThrow(AppError);
    try {
      articleService.batchOffline(adminId, UserRole.Admin, []);
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }
  });

  it('TC-UNIT-100g: batchOffline with > 100 ids throws 1001', () => {
    const ids = Array(101).fill('a-1');
    expect(() =>
      articleService.batchOffline(adminId, UserRole.Admin, ids),
    ).toThrow(AppError);
  });

  it('TC-UNIT-100h: schedulePublish with past date throws invariant error', () => {
    const article = articleService.createArticle(bloggerId, { title: 't', content: 'c' });
    articleService.submitForReview(bloggerId, article.id);
    const pastDate = new Date(Date.now() - 60_000);
    expect(() =>
      articleService.schedule(bloggerId, article.id, pastDate),
    ).toThrow();
  });

  it('TC-UNIT-100i: schedulePublish on non-pending status throws 1002', () => {
    const article = articleService.createArticle(bloggerId, { title: 't', content: 'c' });
    // article is still in draft
    const futureDate = new Date(Date.now() + 60_000);
    expect(() =>
      articleService.schedule(bloggerId, article.id, futureDate),
    ).toThrow(AppError);
  });

  it('TC-UNIT-100j: fireScheduledPublish on non-pending schedule throws 1002', () => {
    const article = articleService.createArticle(bloggerId, { title: 't', content: 'c' });
    articleService.submitForReview(bloggerId, article.id);
    // scheduleStatus is None, not Pending
    expect(() =>
      articleService.fireScheduledPublish(article.id),
    ).toThrow(AppError);
  });
});

// =================================================================
// SD-001 SiteService — uncovered methods
// =================================================================

describe('SD-001 SiteService supplementary (TC-UNIT-101 ~ 103)', () => {
  let siteStore: SiteStore;
  let siteService: SiteService;

  beforeEach(() => {
    siteStore = new SiteStore();
    siteService = new SiteService(siteStore);
  });

  it('TC-UNIT-101: enterMaintenance + exitMaintenance toggle mode', () => {
    siteService.enterMaintenance('admin-1', 'admin');
    expect(siteStore.getConfig().maintenanceMode).toBe(true);
    siteService.exitMaintenance('admin-1', 'admin');
    expect(siteStore.getConfig().maintenanceMode).toBe(false);
  });

  it('TC-UNIT-101b: enterMaintenance by non-admin throws 1021', () => {
    expect(() => siteService.enterMaintenance('reader-1', 'reader')).toThrow(AppError);
    try {
      siteService.enterMaintenance('reader-1', 'reader');
    } catch (err) {
      expect((err as AppError).code).toBe(1021);
    }
  });

  it('TC-UNIT-102: createAnnouncement sets text + at', () => {
    const future = new Date(Date.now() + 60_000);
    siteService.createAnnouncement('admin-1', 'admin', 'hello', future);
    const cfg = siteStore.getConfig();
    expect(cfg.announcement).toBe('hello');
    expect(cfg.announcementAt).toBeInstanceOf(Date);
  });

  it('TC-UNIT-102b: publishAnnouncement with future date throws 1002', () => {
    const future = new Date(Date.now() + 60_000);
    siteService.createAnnouncement('admin-1', 'admin', 'hi', future);
    expect(() =>
      siteService.publishAnnouncement('admin-1', 'admin'),
    ).toThrow(AppError);
    try {
      siteService.publishAnnouncement('admin-1', 'admin');
    } catch (err) {
      expect((err as AppError).code).toBe(1002);
    }
  });

  it('TC-UNIT-102c: publishAnnouncement without announcement throws 1001', () => {
    expect(() =>
      siteService.publishAnnouncement('admin-1', 'admin'),
    ).toThrow(AppError);
    try {
      siteService.publishAnnouncement('admin-1', 'admin');
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }
  });

  it('TC-UNIT-103: archiveAnnouncement clears text', () => {
    const future = new Date(Date.now() + 60_000);
    siteService.createAnnouncement('admin-1', 'admin', 'hi', future);
    siteService.archiveAnnouncement('admin-1', 'admin');
    expect(siteStore.getConfig().announcement).toBe('');
  });

  it('TC-UNIT-103b: updateConfig + getConfig round-trip', () => {
    const result = siteService.updateConfig('admin-1', 'admin', { siteName: 'new' });
    expect(result.siteName).toBe('new');
    expect(siteService.getConfig().siteName).toBe('new');
  });
});

// =================================================================
// SD-017 BackupService — uncovered methods
// =================================================================

describe('SD-017 BackupService supplementary (TC-UNIT-104 ~ 106)', () => {
  let backupStore: BackupStore;
  let userStore: UserStore;
  let bloggerStore: BloggerStore;
  let articleStore: ArticleStore;
  let commentStore: CommentStore;
  let notificationStore: NotificationStore;
  let fileStore: FileStore;
  let backupService: BackupService;
  let userId: string;

  beforeEach(() => {
    backupStore = new BackupStore();
    userStore = new UserStore();
    bloggerStore = new BloggerStore();
    articleStore = new ArticleStore();
    commentStore = new CommentStore();
    notificationStore = new NotificationStore();
    fileStore = new FileStore();
    backupService = new BackupService(
      backupStore,
      userStore,
      bloggerStore,
      articleStore,
      commentStore,
      notificationStore,
      fileStore,
    );
    const user = userStore.create({
      email: 'u@x.com',
      password: 'passwordpassword',
      displayName: 'u',
      role: UserRole.Admin,
    });
    userId = user.id;
  });

  it('TC-UNIT-104: exportUserData returns JSON buffer with user data', () => {
    const buf = backupService.exportUserData(userId);
    const parsed = JSON.parse(buf.toString('utf8'));
    expect(parsed.user.id).toBe(userId);
    expect(parsed.user.email).toBe('u@x.com');
    expect(parsed.exportedAt).toBeDefined();
  });

  it('TC-UNIT-104b: exportUserData with non-existent user throws 1031', () => {
    expect(() => backupService.exportUserData('no-such-user')).toThrow(AppError);
    try {
      backupService.exportUserData('no-such-user');
    } catch (err) {
      expect((err as AppError).code).toBe(1031);
    }
  });

  it('TC-UNIT-105: incremental returns buffer with since field', () => {
    const since = new Date(Date.now() - 60_000);
    const buf = backupService.incremental(userId, UserRole.Admin, since);
    const parsed = JSON.parse(buf.toString('utf8'));
    expect(parsed.since).toBe(since.toISOString());
    expect(parsed.generatedAt).toBeDefined();
  });

  it('TC-UNIT-105b: incremental with invalid date throws 1001', () => {
    const invalid = new Date('invalid') as unknown as Date;
    expect(() =>
      backupService.incremental(userId, UserRole.Admin, invalid),
    ).toThrow(AppError);
    try {
      backupService.incremental(userId, UserRole.Admin, invalid);
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }
  });

  it('TC-UNIT-106: restore with non-existent backup throws 1031', () => {
    expect(() =>
      backupService.restore(userId, UserRole.Admin, 'no-such-backup'),
    ).toThrow(AppError);
    try {
      backupService.restore(userId, UserRole.Admin, 'no-such-backup');
    } catch (err) {
      expect((err as AppError).code).toBe(1031);
    }
  });

  it('TC-UNIT-106b: verifyIntegrity on non-existent backup throws 1031', () => {
    expect(() => backupService.verifyIntegrity('no-such-backup')).toThrow(AppError);
    try {
      backupService.verifyIntegrity('no-such-backup');
    } catch (err) {
      expect((err as AppError).code).toBe(1031);
    }
  });

  it('TC-UNIT-106c: createBackup with invalid type throws 1001', () => {
    const payload = Buffer.from(JSON.stringify({ data: 'x' }));
    expect(() =>
      backupService.createBackup(userId, UserRole.Admin, 'invalid-type' as BackupType, payload),
    ).toThrow(AppError);
    try {
      backupService.createBackup(userId, UserRole.Admin, 'invalid-type' as BackupType, payload);
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }
  });

  it('TC-UNIT-106d: getById returns backup or null', () => {
    const payload = Buffer.from(JSON.stringify({ data: 'x' }));
    const backup = backupService.createBackup(userId, UserRole.Admin, BackupType.Full, payload);
    expect(backupService.getById(backup.id)?.id).toBe(backup.id);
    expect(backupService.getById('no-such')).toBeNull();
  });
});

// =================================================================
// SD-015 FileService — uncovered methods
// =================================================================

describe('SD-015 FileService supplementary (TC-UNIT-107 ~ 109)', () => {
  let fileStore: FileStore;
  let userStore: UserStore;
  let fileService: FileService;
  let userId: string;

  beforeEach(() => {
    fileStore = new FileStore();
    userStore = new UserStore();
    fileService = new FileService(fileStore, userStore);
    const user = userStore.create({
      email: 'u@x.com',
      password: 'passwordpassword',
      displayName: 'u',
    });
    userId = user.id;
  });

  it('TC-UNIT-107: validateMagic returns true for matching PNG', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    expect(fileService.validateMagic(png, 'image/png')).toBe(true);
  });

  it('TC-UNIT-107b: validateMagic returns false for mismatched mime', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    expect(fileService.validateMagic(png, 'image/jpeg')).toBe(false);
  });

  it('TC-UNIT-107c: detectMagic returns mime for known bytes', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    expect(fileService.detectMagic(png)).toBe('image/png');
    // JPEG magic needs 4 bytes (detectMagic requires buffer.length >= 4)
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(fileService.detectMagic(jpeg)).toBe('image/jpeg');
  });

  it('TC-UNIT-107d: detectMagic returns null for unknown bytes', () => {
    const unknown = Buffer.from([0x00, 0x00, 0x00]);
    expect(fileService.detectMagic(unknown)).toBeNull();
  });

  it('TC-UNIT-108: computeSha256 returns deterministic hash', () => {
    const buf = Buffer.from('hello');
    const hash1 = fileService.computeSha256(buf);
    const hash2 = fileService.computeSha256(buf);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex length
  });

  it('TC-UNIT-108b: sanitizeFilename strips dangerous chars', () => {
    const result = fileService.sanitizeFilename('../../etc/passwd');
    expect(result).not.toContain('..');
    expect(result).not.toContain('/');
  });

  it('TC-UNIT-108c: getQuota with non-existent user throws 1031', () => {
    expect(() => fileService.getQuota('no-such-user')).toThrow(AppError);
    try {
      fileService.getQuota('no-such-user');
    } catch (err) {
      expect((err as AppError).code).toBe(1031);
    }
  });

  it('TC-UNIT-109: getById + listByUser return expected results', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x01]);
    const file = fileService.upload(userId, { filename: 'a.png', mimeType: 'image/png', content: png });
    expect(fileService.getById(file.id)?.id).toBe(file.id);
    expect(fileService.getById('no-such')).toBeNull();
    expect(fileService.listByUser(userId)).toHaveLength(1);
  });

  it('TC-UNIT-109b: delete by non-owner non-admin throws 1021', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x02]);
    const file = fileService.upload(userId, { filename: 'a.png', mimeType: 'image/png', content: png });
    const other = userStore.create({
      email: 'o@x.com',
      password: 'passwordpassword',
      displayName: 'o',
    });
    expect(() => fileService.delete(other.id, UserRole.Reader, file.id)).toThrow(AppError);
    try {
      fileService.delete(other.id, UserRole.Reader, file.id);
    } catch (err) {
      expect((err as AppError).code).toBe(1021);
    }
  });

  it('TC-UNIT-109c: upload with non-existent user throws 1031', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    expect(() =>
      fileService.upload('no-such-user', { filename: 'a.png', mimeType: 'image/png', content: png }),
    ).toThrow(AppError);
    try {
      fileService.upload('no-such-user', { filename: 'a.png', mimeType: 'image/png', content: png });
    } catch (err) {
      expect((err as AppError).code).toBe(1031);
    }
  });

  it('TC-UNIT-109d: upload exceeding FILE_SIZE_LIMIT throws 1041', () => {
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
    oversized[0] = 0x89;
    oversized[1] = 0x50;
    oversized[2] = 0x4e;
    oversized[3] = 0x47;
    expect(() =>
      fileService.upload(userId, { filename: 'big.png', mimeType: 'image/png', content: oversized }),
    ).toThrow(AppError);
    try {
      fileService.upload(userId, { filename: 'big.png', mimeType: 'image/png', content: oversized });
    } catch (err) {
      expect((err as AppError).code).toBe(1041);
    }
  });
});

// =================================================================
// SD-004 RecommendStore — uncovered methods
// =================================================================

describe('SD-004 RecommendStore supplementary (TC-UNIT-110 ~ 111)', () => {
  let store: RecommendStore;

  beforeEach(() => {
    store = new RecommendStore();
  });

  it('TC-UNIT-110: setSlot + getSlot + listSlots maintain priority order', () => {
    store.setSlot('low', 'a-1', 1);
    store.setSlot('high', 'a-2', 10);
    store.setSlot('mid', 'a-3', 5);
    const slots = store.listSlots();
    expect(slots).toHaveLength(3);
    // Priority descending: high(10) → mid(5) → low(1)
    expect(slots[0].name).toBe('high');
    expect(slots[1].name).toBe('mid');
    expect(slots[2].name).toBe('low');
    expect(store.getSlot('high')?.articleId).toBe('a-2');
    expect(store.getSlot('no-such')).toBeNull();
  });

  it('TC-UNIT-110b: setSlot updates existing slot priority', () => {
    store.setSlot('s1', 'a-1', 1);
    store.setSlot('s1', 'a-2', 10); // update same slot
    const slots = store.listSlots();
    expect(slots).toHaveLength(1);
    expect(slots[0].articleId).toBe('a-2');
    expect(slots[0].priority).toBe(10);
  });

  it('TC-UNIT-111: hotRank computes view*1 + like*5 + comment*10', () => {
    const article = {
      id: 'a-1',
      authorId: 'u-1',
      title: 't',
      content: 'c',
      summary: '',
      coverImageUrl: null,
      status: ArticleStatus.Published,
      seriesId: null,
      seriesOrder: 0,
      scheduledAt: null,
      publishedAt: null,
      archivedAt: null,
      scheduleStatus: ScheduleStatus.None,
      viewCount: 10,
      likeCount: 2,
      commentCount: 1,
      categoryId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // 10*1 + 2*5 + 1*10 = 30
    expect(store.hotRank(article)).toBe(30);
  });

  it('TC-UNIT-111b: clear resets all slots', () => {
    store.setSlot('s1', 'a-1', 1);
    store.setSlot('s2', 'a-2', 2);
    store.clear();
    expect(store.listSlots()).toHaveLength(0);
    expect(store.getSlot('s1')).toBeNull();
  });
});

// =================================================================
// utils/logger — uncovered functions
// =================================================================

describe('utils/logger supplementary (TC-UNIT-112 ~ 113)', () => {
  beforeEach(() => {
    clearAuditLogs();
  });

  it('TC-UNIT-112: appendOperationLog delegates to appendAuditLog', () => {
    const entry = appendOperationLog('u-1', 'op', 'target');
    expect(entry.userId).toBe('u-1');
    expect(entry.action).toBe('op');
    expect(entry.target).toBe('target');
    expect(auditLogBuffer).toHaveLength(1);
  });

  it('TC-UNIT-112b: appendAuditLog creates unique entries', () => {
    const e1 = appendAuditLog('u-1', 'a1', 't1');
    const e2 = appendAuditLog('u-2', 'a2', 't2');
    expect(e1.id).not.toBe(e2.id);
    expect(auditLogBuffer).toHaveLength(2);
  });

  it('TC-UNIT-113: invariant throws when condition is false', () => {
    expect(() => invariant(false, 'must fail')).toThrow();
    expect(() => invariant(false, 'must fail')).toThrow(/Invariant violated: must fail/);
    // Does not throw when true
    expect(() => invariant(true, 'ok')).not.toThrow();
  });

  it('TC-UNIT-113b: debugAssert returns condition without throwing', () => {
    expect(debugAssert(true, 'ok')).toBe(true);
    expect(debugAssert(false, 'fail')).toBe(false);
    // Does not throw on false
    expect(() => debugAssert(false, 'no throw')).not.toThrow();
  });

  it('TC-UNIT-113c: clearAuditLogs empties the buffer', () => {
    appendAuditLog('u-1', 'a', 't');
    appendAuditLog('u-2', 'b', 't2');
    expect(auditLogBuffer).toHaveLength(2);
    clearAuditLogs();
    expect(auditLogBuffer).toHaveLength(0);
  });
});

// =================================================================
// utils/errors — uncovered functions
// =================================================================

describe('utils/errors supplementary (TC-UNIT-114 ~ 115)', () => {
  it('TC-UNIT-114: throwAppError throws AppError with code + message', () => {
    expect(() => throwAppError(1001, 'validation')).toThrow(AppError);
    try {
      throwAppError(1001, 'validation');
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
      expect((err as AppError).message).toBe('validation');
    }
  });

  it('TC-UNIT-114b: throwAppError without message uses code as message', () => {
    expect(() => throwAppError(1021)).toThrow(AppError);
    try {
      throwAppError(1021);
    } catch (err) {
      expect((err as AppError).code).toBe(1021);
      expect((err as AppError).message).toBe('1021');
    }
  });

  it('TC-UNIT-115: errorHandler formats AppError with httpStatus', () => {
    const res = {
      status: (code: number) => {
        expect(code).toBe(409);
        return { json: (body: unknown) => {
          const b = body as { code: number; message: string; httpStatus: number };
          expect(b.code).toBe(1005);
          expect(b.httpStatus).toBe(409);
        } };
      },
      json: () => {},
    };
    const err = new AppError(1005, 'conflict');
    errorHandler(err, {} as never, res as never, {} as never);
  });

  it('TC-UNIT-115b: errorHandler formats generic Error as 500', () => {
    const res = {
      status: (code: number) => {
        expect(code).toBe(500);
        return { json: (body: unknown) => {
          const b = body as { code: number; message: string; httpStatus: number };
          expect(b.code).toBe(500);
          expect(b.httpStatus).toBe(500);
        } };
      },
      json: () => {},
    };
    const err = new Error('something broke');
    errorHandler(err, {} as never, res as never, {} as never);
  });

  it('TC-UNIT-115c: errorHandler formats unknown error as 500', () => {
    const res = {
      status: (code: number) => {
        expect(code).toBe(500);
        return { json: (body: unknown) => {
          const b = body as { code: number; message: string };
          expect(b.code).toBe(500);
          expect(b.message).toBe('Unknown error');
        } };
      },
      json: () => {},
    };
    errorHandler('not an error', {} as never, res as never, {} as never);
  });

  it('TC-UNIT-115d: hasErrorCode returns true only for matching AppError', () => {
    const err = new AppError(1021, 'rbac');
    expect(hasErrorCode(err, 1021)).toBe(true);
    expect(hasErrorCode(err, 1001)).toBe(false);
    expect(hasErrorCode(new Error('plain'), 1021)).toBe(false);
    expect(hasErrorCode('string', 1021)).toBe(false);
  });

  it('TC-UNIT-115e: AppError toJSON returns full shape', () => {
    const err = new AppError(1031, 'not found');
    const json = err.toJSON();
    expect(json.code).toBe(1031);
    expect(json.message).toBe('not found');
    expect(json.httpStatus).toBe(404);
  });

  it('TC-UNIT-115f: AppError with unknown code defaults to 500 httpStatus', () => {
    const err = new AppError(9999, 'unknown');
    expect(err.httpStatus).toBe(500);
  });
});
