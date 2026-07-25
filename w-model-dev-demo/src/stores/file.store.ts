// SD-015 FileStore.

import {
  FILE_MAGIC,
  FILE_SIZE_LIMIT,
  DAILY_QUOTA_LIMIT,
  MONTHLY_QUOTA_LIMIT,
  type FileAsset,
  type FileInput,
} from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import crypto from 'node:crypto';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `f-${counter}`;
}

export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function detectMagic(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;
  for (const magic of FILE_MAGIC) {
    let match = true;
    for (let i = 0; i < magic.bytes.length; i++) {
      if (buffer[i] !== magic.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) return magic.mime;
  }
  return null;
}

export function validateMagic(buffer: Buffer, declaredMime: string): boolean {
  if (buffer.length < 4) return false;
  const detected = detectMagic(buffer);
  if (!detected) return false;
  return detected === declaredMime;
}

export function sanitizeFilename(name: string): string {
  // Remove path separators, .., control chars, and <>"'.
  let cleaned = name
    .replace(/[<>\"']/g, '')
    .replace(/\.\./g, '')
    .replace(/[\\/]/g, '')
    .replace(/[\x00-\x1f\x7f]/g, '');
  if (cleaned.length > 255) cleaned = cleaned.slice(0, 255);
  if (cleaned.length === 0) {
    throw new AppError(ErrorCode.ZodValidation, '1001');
  }
  return cleaned;
}

export class FileStore {
  private files = new Map<string, FileAsset>();
  private userIdToFiles = new Map<string, Set<string>>();
  private sha256ToId = new Map<string, string>();
  private dailyUsed = new Map<string, number>();
  private monthlyUsed = new Map<string, number>();

  size(): number {
    return this.files.size;
  }

  getById(id: string): FileAsset | null {
    return this.files.get(id) ?? null;
  }

  hasSha256(sha: string): boolean {
    return this.sha256ToId.has(sha);
  }

  getQuota(userId: string): { dailyUsed: number; monthlyUsed: number; dailyLimit: number; monthlyLimit: number } {
    return {
      dailyUsed: this.dailyUsed.get(userId) ?? 0,
      monthlyUsed: this.monthlyUsed.get(userId) ?? 0,
      dailyLimit: DAILY_QUOTA_LIMIT,
      monthlyLimit: MONTHLY_QUOTA_LIMIT,
    };
  }

  create(userId: string, input: FileInput): FileAsset {
    const size = input.content.length;
    if (size > FILE_SIZE_LIMIT) {
      throw new AppError(ErrorCode.FileTooLarge, '1041');
    }
    if (!validateMagic(input.content, input.mimeType)) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    const sha = computeSha256(input.content);
    const existingId = this.sha256ToId.get(sha);
    if (existingId) {
      // Dedup: do not store again.
      const existing = this.files.get(existingId);
      if (existing) return { ...existing };
    }
    // Quota check (daily + monthly)
    const daily = this.dailyUsed.get(userId) ?? 0;
    const monthly = this.monthlyUsed.get(userId) ?? 0;
    if (daily + size > DAILY_QUOTA_LIMIT) {
      throw new AppError(ErrorCode.BusinessConflict, '1005');
    }
    if (monthly + size > MONTHLY_QUOTA_LIMIT) {
      throw new AppError(ErrorCode.BusinessConflict, '1005');
    }
    const cleanName = sanitizeFilename(input.filename);
    const now = new Date();
    const file: FileAsset = {
      id: nextId(),
      userId,
      filename: cleanName,
      mimeType: input.mimeType,
      size,
      content: Buffer.from(input.content),
      sha256: sha,
      magicType: input.mimeType,
      createdAt: now,
      updatedAt: now,
    };
    this.files.set(file.id, file);
    this.sha256ToId.set(sha, file.id);
    let set = this.userIdToFiles.get(userId);
    if (!set) {
      set = new Set();
      this.userIdToFiles.set(userId, set);
    }
    set.add(file.id);
    this.dailyUsed.set(userId, daily + size);
    this.monthlyUsed.set(userId, monthly + size);
    return { ...file };
  }

  delete(fileId: string): void {
    const f = this.files.get(fileId);
    if (!f) throw new AppError(ErrorCode.NotFound, '1031');
    this.files.delete(fileId);
    this.sha256ToId.delete(f.sha256);
    const set = this.userIdToFiles.get(f.userId);
    if (set) {
      set.delete(fileId);
      if (set.size === 0) this.userIdToFiles.delete(f.userId);
    }
  }

  listByUser(userId: string): FileAsset[] {
    const set = this.userIdToFiles.get(userId);
    if (!set) return [];
    const out: FileAsset[] = [];
    for (const id of set) {
      const f = this.files.get(id);
      if (f) out.push({ ...f });
    }
    return out;
  }

  resetDailyQuota(): void {
    this.dailyUsed.clear();
  }

  clear(): void {
    this.files.clear();
    this.userIdToFiles.clear();
    this.sha256ToId.clear();
    this.dailyUsed.clear();
    this.monthlyUsed.clear();
  }
}
