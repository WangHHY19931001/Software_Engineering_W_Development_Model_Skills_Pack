import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { validateBySchema, type SchemaValidationResult } from '../infrastructure/schema-loader.js';
import { parseJsonSafe } from '../lib/safe-json.js';
import { inferProjectRoot, isProjectStateTarget, resolveStateSchema } from '../lib/state-schema-registry.js';

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
  /** Default true preserves direct-call automatic stale recovery; false returns STALE_LOCK unless recovery is explicit. */
  allowImplicitStaleRecovery?: boolean;
  afterLockAcquired?: () => void | Promise<void>;
  beforeCommit?: () => void | Promise<void>;
  afterStaleMetadataRead?: () => void | Promise<void>;
  afterRecoveryOwnershipMoved?: () => void | Promise<void>;
  afterReleaseOwnershipMoved?: () => void | Promise<void>;
  beforeRollback?: () => void | Promise<void>;
  /** Project root used to resolve .w-model target schema registrations. Defaults to the target's .w-model parent. */
  projectRoot?: string;
  /** Allows an otherwise unregistered .w-model target, never bypassing registered schema validation. */
  allowUntyped?: boolean;
  /** Injectable only for state-write tests; validator infrastructure failures must propagate. */
  schemaValidator?: (name: string, data: unknown) => SchemaValidationResult;
}

export interface StateWriteResult {
  ok: boolean;
  writtenPath: string;
  backupPath?: string;
  reason?:
    | 'INVALID_JSON'
    | 'MTIME_CONFLICT'
    | 'TARGET_MISSING_FOR_MTIME'
    | 'WRITE_VERIFY_FAILED'
    | 'LOCK_TIMEOUT'
    | 'STALE_LOCK'
    | 'UNREGISTERED_TARGET'
    | 'SCHEMA_INVALID';
  schemaInvalidLine?: number;
  untyped?: boolean;
  rolledBack?: boolean;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const ownerPathFor = (lockDir: string) => path.join(lockDir, 'owner');
const metadataPathFor = (ownerDir: string) => path.join(ownerDir, 'metadata.json');
const transitionPathFor = (ownerDir: string) => path.join(ownerDir, 'transition.json');

interface TransitionMetadata {
  kind: 'recovering' | 'releasing';
  operatorPid: number;
  operatorToken: string;
  operatorStartedAt: string;
  origin: StateLockMetadata;
}

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
  try {
    const prefix = `${path.basename(absPath)}.bak.`;
    const dir = path.dirname(absPath);
    const backups = (await fs.readdir(dir)).filter((entry) => entry.startsWith(prefix)).sort();
    await Promise.all(
      backups.slice(0, Math.max(0, backups.length - keep)).map(async (entry) => {
        try {
          await fs.unlink(path.join(dir, entry));
        } catch {
          /* best effort */
        }
      }),
    );
  } catch {
    /* best effort */
  }
}

function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function readMetadata(ownerDir: string): Promise<StateLockMetadata | undefined> {
  try {
    return JSON.parse(await fs.readFile(metadataPathFor(ownerDir), 'utf-8')) as StateLockMetadata;
  } catch {
    return undefined;
  }
}

async function readTransition(transitionDir: string): Promise<TransitionMetadata | undefined> {
  try {
    return JSON.parse(await fs.readFile(transitionPathFor(transitionDir), 'utf-8')) as TransitionMetadata;
  } catch {
    return undefined;
  }
}

async function recoverOrphanTransitions(
  lockDir: string,
  opts: StateWriteOptions,
): Promise<'none' | 'recovered' | 'stale'> {
  let entries: string[];
  try {
    entries = await fs.readdir(lockDir);
  } catch {
    return 'none';
  }
  let recovered = false;
  for (const entry of entries) {
    if (!entry.startsWith('.recovering-') && !entry.startsWith('.releasing-')) continue;
    const transitionDir = path.join(lockDir, entry);
    const transition = await readTransition(transitionDir);
    if (!transition) continue;
    const expired = Date.now() - Date.parse(transition.operatorStartedAt) > (opts.staleLockTtlMs ?? 60_000);
    const stale = expired && !isPidRunning(transition.operatorPid);
    if (!stale) continue;
    if (opts.recoverStaleLock !== true && opts.allowImplicitStaleRecovery === false) return 'stale';
    const auditDir = path.join(lockDir, `.stale-transition-${Date.now()}-${randomUUID()}`);
    try {
      await renameWithRetry(transitionDir, auditDir);
      recovered = true;
    } catch {
      /* a live owner may have completed its transition */
    }
  }
  return recovered ? 'recovered' : 'none';
}

async function hasTransition(lockDir: string): Promise<boolean> {
  try {
    return (await fs.readdir(lockDir)).some(
      (entry) => entry.startsWith('.recovering-') || entry.startsWith('.releasing-'),
    );
  } catch {
    return false;
  }
}

async function staleOwnerState(lockDir: string, opts: StateWriteOptions): Promise<'none' | 'stale' | 'recoverable'> {
  const metadata = await readMetadata(ownerPathFor(lockDir));
  if (!metadata) return 'none';
  const expired = Date.now() - Date.parse(metadata.createdAt) > (opts.staleLockTtlMs ?? 60_000);
  const stale = expired && !isPidRunning(metadata.pid);
  if (!stale) return 'none';
  return opts.recoverStaleLock === true || opts.allowImplicitStaleRecovery !== false ? 'recoverable' : 'stale';
}

async function recoverLockIfStale(lockDir: string, opts: StateWriteOptions): Promise<boolean> {
  const ownerDir = ownerPathFor(lockDir);
  const candidate = path.join(lockDir, `.recovering-${randomUUID()}`);
  const current = await readMetadata(ownerDir);
  if (!current) return false;
  const transition: TransitionMetadata = {
    kind: 'recovering',
    operatorPid: process.pid,
    operatorToken: randomUUID(),
    operatorStartedAt: new Date().toISOString(),
    origin: current,
  };
  await fs.writeFile(transitionPathFor(ownerDir), JSON.stringify(transition), 'utf-8');
  try {
    await renameWithRetry(ownerDir, candidate);
    await opts.afterRecoveryOwnershipMoved?.();
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT';
  }
  const metadata = await readMetadata(candidate);
  await opts.afterStaleMetadataRead?.();
  const expired =
    metadata !== undefined && Date.now() - Date.parse(metadata.createdAt) > (opts.staleLockTtlMs ?? 60_000);
  const stale = metadata !== undefined && expired && !isPidRunning(metadata.pid);
  if (stale) {
    await renameWithRetry(candidate, path.join(lockDir, `.stale-${Date.now()}-${randomUUID()}`));
    return true;
  }
  try {
    await renameWithRetry(candidate, ownerDir);
  } catch {
    await fs.rm(candidate, { recursive: true, force: true });
  }
  return false;
}

type AcquiredLock = { lockDir: string; ownerDir: string; metadata: StateLockMetadata };
type AcquireLockResult = AcquiredLock | 'STALE_LOCK' | undefined;

async function acquireLock(absPath: string, opts: StateWriteOptions): Promise<AcquireLockResult> {
  const lockDir = `${absPath}.lock`;
  const ownerDir = ownerPathFor(lockDir);
  const deadline = Date.now() + (opts.lockTimeoutMs === undefined ? 5_000 : opts.lockTimeoutMs);
  await fs.mkdir(lockDir, { recursive: true });
  while (Date.now() <= deadline) {
    const metadata: StateLockMetadata = {
      targetPath: absPath,
      pid: process.pid,
      token: randomUUID(),
      createdAt: new Date().toISOString(),
      operation: 'wm-write',
    };
    try {
      const transitions = await recoverOrphanTransitions(lockDir, opts);
      if (transitions === 'stale') return 'STALE_LOCK';
      if (await hasTransition(lockDir)) {
        await sleep(10);
        continue;
      }
      await fs.mkdir(ownerDir);
      await fs.writeFile(metadataPathFor(ownerDir), JSON.stringify(metadata), 'utf-8');
      return { lockDir, ownerDir, metadata };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const owner = await staleOwnerState(lockDir, opts);
      if (owner === 'stale') return 'STALE_LOCK';
      if (owner === 'recoverable' && (await recoverLockIfStale(lockDir, opts))) continue;
      await sleep(10);
    }
  }
  return undefined;
}

async function ownsLock(ownerDir: string, token: string): Promise<boolean> {
  return (await readMetadata(ownerDir))?.token === token;
}

async function releaseLock(lockDir: string, ownerDir: string, token: string, opts: StateWriteOptions): Promise<void> {
  if (!(await ownsLock(ownerDir, token))) return;
  const released = path.join(lockDir, `.releasing-${randomUUID()}`);
  const origin = await readMetadata(ownerDir);
  if (!origin) return;
  const transition: TransitionMetadata = {
    kind: 'releasing',
    operatorPid: process.pid,
    operatorToken: randomUUID(),
    operatorStartedAt: new Date().toISOString(),
    origin,
  };
  try {
    await fs.writeFile(transitionPathFor(ownerDir), JSON.stringify(transition), 'utf-8');
    await renameWithRetry(ownerDir, released);
    await opts.afterReleaseOwnershipMoved?.();
  } catch {
    return;
  }
  await fs.rm(released, { recursive: true, force: true });
}

function parseStatePayload(
  jsonText: string,
  line?: number,
): { parsed?: unknown; invalid?: Pick<StateWriteResult, 'reason' | 'schemaInvalidLine'> } {
  try {
    return { parsed: parseJsonSafe(jsonText) };
  } catch {
    return {
      invalid: {
        reason: 'SCHEMA_INVALID',
        ...(line === undefined ? {} : { schemaInvalidLine: line }),
      },
    };
  }
}

function validateRegisteredStatePayload(
  absPath: string,
  jsonText: string,
  projectRoot: string,
  allowUntyped: boolean,
  schemaValidator: (name: string, data: unknown) => SchemaValidationResult,
): Pick<StateWriteResult, 'reason' | 'schemaInvalidLine' | 'untyped'> | undefined {
  const registered = resolveStateSchema(absPath, projectRoot);
  if (!registered) {
    if (isProjectStateTarget(absPath, projectRoot) && !allowUntyped) return { reason: 'UNREGISTERED_TARGET' };
    return isProjectStateTarget(absPath, projectRoot) ? { untyped: true } : undefined;
  }

  if (registered.format === 'json') {
    const payload = parseStatePayload(jsonText);
    if (payload.invalid) return payload.invalid;
    return schemaValidator(registered.schemaName, payload.parsed).valid ? undefined : { reason: 'SCHEMA_INVALID' };
  }

  const lines = jsonText.split(/\r?\n/);
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    if (line === '') continue;
    const payload = parseStatePayload(line, index + 1);
    if (payload.invalid) return payload.invalid;
    if (!schemaValidator(registered.schemaName, payload.parsed).valid) {
      return { reason: 'SCHEMA_INVALID', schemaInvalidLine: index + 1 };
    }
  }
  return undefined;
}

async function restoreIfStillOwned(
  absPath: string,
  jsonText: string,
  backupPath: string | undefined,
  ownerDir: string,
  token: string,
  opts: StateWriteOptions,
): Promise<boolean> {
  if (!(await ownsLock(ownerDir, token))) return false;
  let current: string;
  try {
    current = await fs.readFile(absPath, 'utf-8');
  } catch {
    return false;
  }
  if (current !== jsonText || !(await ownsLock(ownerDir, token))) return false;
  await opts.beforeRollback?.();
  if (!(await ownsLock(ownerDir, token)) || (await fs.readFile(absPath, 'utf-8')) !== jsonText) return false;

  let rollbackTmp: string | undefined;
  try {
    rollbackTmp = `${absPath}.tmp-${process.pid}-${randomUUID()}`;
    if (backupPath) {
      await fs.copyFile(backupPath, rollbackTmp);
      await renameWithRetry(rollbackTmp, absPath);
      rollbackTmp = undefined;
    } else {
      // Move the payload away before cleanup, never unlink the target path directly.
      await renameWithRetry(absPath, rollbackTmp);
    }
    return true;
  } catch {
    return false;
  } finally {
    if (rollbackTmp) await fs.rm(rollbackTmp, { force: true });
  }
}

export async function writeStateJson(
  absPath: string,
  jsonText: string,
  opts: StateWriteOptions = {},
): Promise<StateWriteResult> {
  const projectRoot = opts.projectRoot ?? inferProjectRoot(absPath);
  const registered = resolveStateSchema(absPath, projectRoot);
  if (!registered || registered.format === 'json') {
    try {
      parseJsonSafe(jsonText);
    } catch {
      return { ok: false, writtenPath: absPath, reason: 'INVALID_JSON' };
    }
  }
  const acquired = await acquireLock(absPath, opts);
  if (acquired === 'STALE_LOCK') return { ok: false, writtenPath: absPath, reason: 'STALE_LOCK' };
  if (!acquired) return { ok: false, writtenPath: absPath, reason: 'LOCK_TIMEOUT' };
  let tmpPath: string | undefined;
  try {
    await opts.afterLockAcquired?.();
    const validation = validateRegisteredStatePayload(
      absPath,
      jsonText,
      projectRoot,
      opts.allowUntyped === true,
      opts.schemaValidator ?? validateBySchema,
    );
    if (validation?.reason) return { ok: false, writtenPath: absPath, ...validation };
    if (opts.expectMtimeMs != null) {
      let stat: Awaited<ReturnType<typeof fs.stat>>;
      try {
        stat = await fs.stat(absPath);
      } catch {
        return { ok: false, writtenPath: absPath, reason: 'TARGET_MISSING_FOR_MTIME' };
      }
      if (Math.floor(stat.mtimeMs) !== Math.floor(opts.expectMtimeMs))
        return { ok: false, writtenPath: absPath, reason: 'MTIME_CONFLICT' };
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
      const rolledBack = await restoreIfStillOwned(
        absPath,
        jsonText,
        backupPath,
        acquired.ownerDir,
        acquired.metadata.token,
        opts,
      );
      return { ok: false, writtenPath: absPath, reason: 'WRITE_VERIFY_FAILED', rolledBack };
    }
    return { ok: true, writtenPath: absPath, backupPath, ...(validation?.untyped ? { untyped: true } : {}) };
  } finally {
    if (tmpPath) await fs.rm(tmpPath, { force: true });
    await releaseLock(acquired.lockDir, acquired.ownerDir, acquired.metadata.token, opts);
  }
}
