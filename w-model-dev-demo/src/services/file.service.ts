// SD-015 FileService — file upload validation, dedup, quota aggregation.

import {
  FILE_SIZE_LIMIT,
  DAILY_QUOTA_LIMIT,
  MONTHLY_QUOTA_LIMIT,
  type FileAsset,
  type FileInput,
} from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import {
  computeSha256,
  detectMagic,
  sanitizeFilename as storeSanitizeFilename,
  validateMagic as storeValidateMagic,
  type FileStore,
} from '../stores/file.store.js';
import type { UserStore } from '../stores/user.store.js';

export class FileService {
  constructor(
    private fileStore: FileStore,
    private userStore: UserStore,
  ) {}

  /**
   * upload — TLA+ L3_file_upload.uploadFile.
   * Validates magic, dedup by sha256, enforces quota, delegates to store.
   */
  upload(userId: string, input: FileInput): FileAsset {
    if (!this.userStore.getById(userId)) {
      throw new AppError(ErrorCode.NotFound, '1031');
    }
    if (input.content.length > FILE_SIZE_LIMIT) {
      throw new AppError(ErrorCode.FileTooLarge, '1041');
    }
    // Pre-check quota (store also checks; service-level for clearer error).
    const quota = this.fileStore.getQuota(userId);
    if (quota.dailyUsed + input.content.length > DAILY_QUOTA_LIMIT) {
      throw new AppError(ErrorCode.BusinessConflict, '1005');
    }
    if (quota.monthlyUsed + input.content.length > MONTHLY_QUOTA_LIMIT) {
      throw new AppError(ErrorCode.BusinessConflict, '1005');
    }
    return this.fileStore.create(userId, input);
  }

  /** validateMagic — TLA+ L3_file_upload.validateMagic. */
  validateMagic(buffer: Buffer, declaredMime: string): boolean {
    return storeValidateMagic(buffer, declaredMime);
  }

  /** detectMagic — expose magic-type detection. */
  detectMagic(buffer: Buffer): string | null {
    return detectMagic(buffer);
  }

  /** computeSha256 — TLA+ L3_file_upload.computeSha256. */
  computeSha256(buffer: Buffer): string {
    return computeSha256(buffer);
  }

  /** sanitizeFilename — TLA+ L3_file_upload.sanitizeFilename. */
  sanitizeFilename(name: string): string {
    return storeSanitizeFilename(name);
  }

  /** getQuota — aggregate daily/monthly used vs limit. */
  getQuota(userId: string): { dailyUsed: number; monthlyUsed: number; dailyLimit: number; monthlyLimit: number } {
    if (!this.userStore.getById(userId)) {
      throw new AppError(ErrorCode.NotFound, '1031');
    }
    return this.fileStore.getQuota(userId);
  }

  getById(fileId: string): FileAsset | null {
    return this.fileStore.getById(fileId);
  }

  listByUser(userId: string): FileAsset[] {
    return this.fileStore.listByUser(userId);
  }

  delete(operatorId: string, operatorRole: string, fileId: string): void {
    if (operatorRole !== 'admin') {
      const file = this.fileStore.getById(fileId);
      if (!file || file.userId !== operatorId) {
        throw new AppError(ErrorCode.Rbac, '1021');
      }
    }
    this.fileStore.delete(fileId);
  }
}
