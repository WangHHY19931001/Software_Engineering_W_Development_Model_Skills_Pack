import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { parseJsonSafe } from '../lib/safe-json.js';

export interface StateLockMetadata {
  targetPath: string;
  pid: number;
  token: string;
  createdAt: string;
  operation: 'wm-write';
}

export interface StateWriteOptions {
  backup?: boolean;
  keepBackups?: number;
  expectMtimeMs?: number | null;
  readbackImpl?: (absPath: string) => Promise<string>;
  lockTimeoutMs?: number;
  staleLockTtlMs?: number;
  recoverStaleLock?: boolean;
  afterLockAcquired?: () => void | Promise<void>;
  beforeCommit?: () => void | Promise<void>;
}

export interface StateWriteResult {
  ok: boolean;
  writtenPath: string;
  backupPath?: string;
  reason?: 'INVALID_JSON' | 'MTIME_CONFLICT' | 'TARGET_MISSING_FOR_MTIME' | 'WRITE_VERIFY_FAILED' | 'LOCK_TIMEOUT' | 'STALE_LOCK';
  rolledBack?: boolean;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function backupPathFor(absPath: string, now: Date = new Date()): string {
  const pad = (n: number, length = 2) => String(n).padStart(length, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${pad(now.getMilliseconds(), 3)}`;
  return `${absPath}.bak.${stamp}-${randomUUID()}`;
}

async function renameWithRetry(src: string, dest: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await fs.rename(src, dest);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if ((code === 'EPERM' || code === 'EBUSY') && attempt < 8) {
        await sleep(10 * attempt);
        continue;
      }
      throw error;
    }
  }
}

async function rotateBackups(absPath: string, keep: number): Promise<void> {
  const dir = path.dirname(absPath);
  const prefix = `${path.basename(absPath)}.bak.`;
  try {
    const backups = (await fs.readdir(dir)).filter((entry) => entry.startsWith(prefix)).sort();
    await Promise.all(backups.slice(0, Math.max(0, backups.length - keep)).map(async (entry) => {
      try { await fs.unlink(path.join(dir, entry)); } catch { /* best effort */ }
    }));
  } catch { /* best effort */ }
}

function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function recoverLockIfStale(lockPath: string, opts: StateWriteOptions): Promise<boolean> {
  let metadata: StateLockMetadata;
  try {
    metadata = JSON.parse(await fs.readFile(lockPath, 'utf-8')) as StateLockMetadata;
  } catch {
    return false;
  }
  const expired = Date.now() - Date.parse(metadata.createdAt) > (opts.staleLockTtlMs ?? 60_000);
  if (!opts.recoverStaleLock && !(expired && !isPidRunning(metadata.pid))) return false;
  const auditPath = `${lockPath}.stale-${Date.now()}-${randomUUID()}`;
  try {
    await renameWithRetry(lockPath, auditPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    return false;
  }
}

async function acquireLock(absPath: string, opts: StateWriteOptions): Promise<StateLockMetadata | undefined> {
  const lockPath = `${absPath}.lock`;
  const deadline = Date.now() + (opts.lockTimeoutMs ?? 5_000);
  while (Date.now() <= deadline) {
    const lock: StateLockMetadata = {
      targetPath: absPath, pid: process.pid, token: randomUUID(), createdAt: new Date().toISOString(), operation: 'wm-write',
    };
    try {
      const handle = await fs.open(lockPath, 'wx');
      await handle.writeFile(JSON.stringify(lock), 'utf-8');
      await handle.close();
      return lock;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (await recoverLockIfStale(lockPath, opts)) continue;
      await sleep(10);
    }
  }
  return undefined;
}

async function releaseLock(lockPath: string, token: string): Promise<void> {
  try {
    const lock = JSON.parse(await fs.readFile(lockPath, 'utf-8')) as StateLockMetadata;
    if (lock.token === token) await fs.unlink(lockPath);
  } catch {
    // A replaced, removed, or unreadable lock is not ours to delete.
  }
}

async function restoreIfCurrentPayload(absPath: string, jsonText: string, backupPath?: string): Promise<boolean> {
  let current: string;
  try { current = await fs.readFile(absPath, 'utf-8'); } catch { return false; }
  if (current !== jsonText) return false;
  try {
    if (backupPath) {
      const rollbackTmp = `${absPath}.tmp-${process.pid}-${randomUUID()}`;
      await fs.copyFile(backupPath, rollbackTmp);
      await renameWithRetry(rollbackTmp, absPath);
    } else {
      await fs.unlink(absPath);
    }
    return true;
  } catch {
    return false;
  }
}

export async function writeStateJson(absPath: string, jsonText: string, opts: StateWriteOptions = {}): Promise<StateWriteResult> {
  try { parseJsonSafe(jsonText); } catch { return { ok: false, writtenPath: absPath, reason: 'INVALID_JSON' }; }

  const lock = await acquireLock(absPath, opts);
  if (!lock) return { ok: false, writtenPath: absPath, reason: 'LOCK_TIMEOUT' };
  const lockPath = `${absPath}.lock`;
  let tmpPath: string | undefined;
  try {
    await opts.afterLockAcquired?.();
    if (opts.expectMtimeMs != null) {
      let stat: Awaited<ReturnType<typeof fs.stat>>;
      try { stat = await fs.stat(absPath); } catch { return { ok: false, writtenPath: absPath, reason: 'TARGET_MISSING_FOR_MTIME' }; }
      if (Math.floor(stat.mtimeMs) !== Math.floor(opts.expectMtimeMs)) {
        return { ok: false, writtenPath: absPath, reason: 'MTIME_CONFLICT' };
      }
    }

    let backupPath: string | undefined;
    if (opts.backup !== false) {
      try {
        if ((await fs.stat(absPath)).isFile()) {
          backupPath = backupPathFor(absPath);
          await fs.copyFile(absPath, backupPath);
          await rotateBackups(absPath, opts.keepBackups ?? 5);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }

    tmpPath = `${absPath}.tmp-${process.pid}-${randomUUID()}`;
    await fs.writeFile(tmpPath, jsonText, 'utf-8');
    await opts.beforeCommit?.();
    await renameWithRetry(tmpPath, absPath);
    tmpPath = undefined;

    const readBack = await (opts.readbackImpl ?? ((file: string) => fs.readFile(file, 'utf-8')))(absPath);
    if (readBack !== jsonText) {
      const rolledBack = await restoreIfCurrentPayload(absPath, jsonText, backupPath);
      return { ok: false, writtenPath: absPath, reason: 'WRITE_VERIFY_FAILED', rolledBack };
    }
    return { ok: true, writtenPath: absPath, backupPath };
  } finally {
    if (tmpPath) await fs.rm(tmpPath, { force: true });
    await releaseLock(lockPath, lock.token);
  }
}
