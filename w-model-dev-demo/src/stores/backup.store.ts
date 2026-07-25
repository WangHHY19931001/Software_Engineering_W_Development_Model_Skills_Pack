// SD-017 BackupStore.

import { BackupStatus, BackupType, BACKUP_SIZE_LIMIT, type Backup } from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import crypto from 'node:crypto';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `bk-${counter}`;
}

export function computeBackupSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export class BackupStore {
  private backups = new Map<string, Backup>();
  private statusToBackups = new Map<BackupStatus, Set<string>>();

  size(): number {
    return this.backups.size;
  }

  getById(id: string): Backup | null {
    return this.backups.get(id) ?? null;
  }

  create(operatorId: string, type: BackupType, payload: Buffer, operatorRole: string): Backup {
    if (operatorRole !== 'admin') {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    if (payload.length > BACKUP_SIZE_LIMIT) {
      throw new AppError(ErrorCode.BusinessConflict, '1005');
    }
    const sha = computeBackupSha256(payload);
    const now = new Date();
    const backup: Backup = {
      id: nextId(),
      operatorId,
      type,
      payload: Buffer.from(payload),
      sha256: sha,
      size: payload.length,
      status: BackupStatus.Created,
      createdAt: now,
      updatedAt: now,
    };
    this.backups.set(backup.id, backup);
    this.indexAdd(this.statusToBackups, BackupStatus.Created, backup.id);
    return { ...backup, payload: Buffer.from(backup.payload) };
  }

  update(backup: Backup): Backup {
    const existing = this.backups.get(backup.id);
    if (!existing) throw new AppError(ErrorCode.NotFound, '1031');
    const oldStatus = existing.status;
    const newStatus = backup.status;
    const updated: Backup = { ...backup, updatedAt: new Date() };
    this.backups.set(backup.id, updated);
    if (oldStatus !== newStatus) {
      this.indexRemove(this.statusToBackups, oldStatus, backup.id);
      this.indexAdd(this.statusToBackups, newStatus, backup.id);
    }
    return { ...updated };
  }

  setStatus(backupId: string, status: BackupStatus): Backup {
    const b = this.backups.get(backupId);
    if (!b) throw new AppError(ErrorCode.NotFound, '1031');
    const old = b.status;
    b.status = status;
    b.updatedAt = new Date();
    if (old !== status) {
      this.indexRemove(this.statusToBackups, old, backupId);
      this.indexAdd(this.statusToBackups, status, backupId);
    }
    return { ...b, payload: Buffer.from(b.payload) };
  }

  verifyIntegrity(backupId: string): boolean {
    const b = this.backups.get(backupId);
    if (!b) throw new AppError(ErrorCode.NotFound, '1031');
    const recomputed = computeBackupSha256(b.payload);
    return recomputed === b.sha256;
  }

  private indexAdd<K>(map: Map<K, Set<string>>, key: K, value: string): void {
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(value);
  }

  private indexRemove<K>(map: Map<K, Set<string>>, key: K, value: string): void {
    const set = map.get(key);
    if (!set) return;
    set.delete(value);
    if (set.size === 0) map.delete(key);
  }

  clear(): void {
    this.backups.clear();
    this.statusToBackups.clear();
  }
}
