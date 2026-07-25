// SD-017 BackupStore + BackupService unit tests (TC-UNIT-076 ~ TC-UNIT-080).

import { describe, it, expect, beforeEach } from 'vitest';
import { BackupStore, computeBackupSha256 } from '../../src/stores/backup.store.js';
import { BackupService } from '../../src/services/backup.service.js';
import { UserStore } from '../../src/stores/user.store.js';
import { BloggerStore } from '../../src/stores/blogger.store.js';
import { ArticleStore } from '../../src/stores/article.store.js';
import { CommentStore } from '../../src/stores/comment.store.js';
import { NotificationStore } from '../../src/stores/notification.store.js';
import { FileStore } from '../../src/stores/file.store.js';
import { BackupStatus, BackupType, BACKUP_SIZE_LIMIT, UserRole } from '../../src/types.js';
import { AppError } from '../../src/utils/errors.js';

describe('SD-017 BackupStore + BackupService (TC-UNIT-076 ~ 080)', () => {
  let backupStore: BackupStore;
  let userStore: UserStore;
  let bloggerStore: BloggerStore;
  let articleStore: ArticleStore;
  let commentStore: CommentStore;
  let notificationStore: NotificationStore;
  let fileStore: FileStore;
  let backupService: BackupService;

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
  });

  /** Helper: a valid JSON payload (restore parses payload as JSON). */
  function jsonPayload(obj: unknown): Buffer {
    return Buffer.from(JSON.stringify(obj), 'utf8');
  }

  it('TC-UNIT-076: createBackup with reader role throws 1021', () => {
    const payload = jsonPayload({ data: 'test' });
    expect(() =>
      backupService.createBackup('op-1', UserRole.Reader, BackupType.Full, payload),
    ).toThrow(AppError);
    try {
      backupService.createBackup('op-1', UserRole.Reader, BackupType.Full, payload);
    } catch (err) {
      expect((err as AppError).code).toBe(1021);
    }
  });

  it('TC-UNIT-077: createBackup with payload > BACKUP_SIZE_LIMIT throws 1005', () => {
    // Payload of exactly BACKUP_SIZE_LIMIT + 1 bytes triggers the size check in BackupStore.create.
    const oversized = Buffer.alloc(BACKUP_SIZE_LIMIT + 1);
    expect(() =>
      backupService.createBackup('admin-1', UserRole.Admin, BackupType.Full, oversized),
    ).toThrow(AppError);
    try {
      backupService.createBackup('admin-1', UserRole.Admin, BackupType.Full, oversized);
    } catch (err) {
      expect((err as AppError).code).toBe(1005);
    }
  });

  it('TC-UNIT-078: restore transitions backup status from Created to Restored', () => {
    const payload = jsonPayload({ data: 'restore-test' });
    const backup = backupService.createBackup('admin-1', UserRole.Admin, BackupType.Full, payload);

    // Pre-condition: status is Created.
    expect(backup.status).toBe(BackupStatus.Created);

    backupService.restore('admin-1', UserRole.Admin, backup.id);

    const restored = backupStore.getById(backup.id);
    expect(restored?.status).toBe(BackupStatus.Restored);
  });

  it('TC-UNIT-079: verifyIntegrity returns true for valid (untampered) backup', () => {
    const payload = jsonPayload({ data: 'integrity-test' });
    const backup = backupService.createBackup('admin-1', UserRole.Admin, BackupType.Full, payload);

    // verifyIntegrity recomputes SHA-256 of the stored payload and compares to the stored sha256.
    const result = backupService.verifyIntegrity(backup.id);
    expect(result).toBe(true);

    // Cross-check: the stored sha256 matches a fresh recompute of the original payload.
    const recomputed = computeBackupSha256(payload);
    expect(recomputed).toBe(backup.sha256);
  });

  it('TC-UNIT-080: restore on already-restored backup throws 1002', () => {
    const payload = jsonPayload({ data: 'double-restore' });
    const backup = backupService.createBackup('admin-1', UserRole.Admin, BackupType.Full, payload);

    // First restore succeeds (Created → Restored).
    backupService.restore('admin-1', UserRole.Admin, backup.id);
    expect(backupStore.getById(backup.id)?.status).toBe(BackupStatus.Restored);

    // Second restore fails: status is no longer Created → 1002 (state machine illegal).
    expect(() =>
      backupService.restore('admin-1', UserRole.Admin, backup.id),
    ).toThrow(AppError);
    try {
      backupService.restore('admin-1', UserRole.Admin, backup.id);
    } catch (err) {
      expect((err as AppError).code).toBe(1002);
    }
  });
});
