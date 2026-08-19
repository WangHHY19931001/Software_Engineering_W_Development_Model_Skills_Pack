import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { backupPathFor, writeStateJson } from '../logic/state-write-logic.js';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-write-test-'));
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function target(name: string): string {
  return path.join(tmpDir, name);
}

async function deferred(): Promise<{ promise: Promise<void>; resolve: () => void }> {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('backupPathFor', () => {
  it('generates unique paths for backups made in the same millisecond', () => {
    const fixed = new Date(2026, 7, 15, 9, 5, 0, 123);
    const first = backupPathFor(path.join('d', 'state.json'), fixed);
    const second = backupPathFor(path.join('d', 'state.json'), fixed);
    expect(first).toMatch(/state\.json\.bak\.20260815-090500123-[0-9a-f-]+$/);
    expect(second).toMatch(/state\.json\.bak\.20260815-090500123-[0-9a-f-]+$/);
    expect(second).not.toBe(first);
  });
});

describe('writeStateJson', () => {
  it('writes a missing target without a backup', async () => {
    const p = target('fresh.json');
    const result = await writeStateJson(p, '{"a":1}');
    expect(result.ok).toBe(true);
    expect(result.backupPath).toBeUndefined();
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"a":1}');
  });

  it('rejects invalid JSON without creating the target', async () => {
    const p = target('bad.json');
    const result = await writeStateJson(p, '{not json');
    expect(result).toMatchObject({ ok: false, reason: 'INVALID_JSON' });
    await expect(fs.access(p)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('returns MTIME_CONFLICT without modifying the target', async () => {
    const p = target('conflict.json');
    await fs.writeFile(p, '{"v":1}', 'utf-8');
    const stat = await fs.stat(p);
    const result = await writeStateJson(p, '{"v":2}', { expectMtimeMs: stat.mtimeMs + 5000 });
    expect(result).toMatchObject({ ok: false, reason: 'MTIME_CONFLICT' });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"v":1}');
  });

  it('allows a matching mtime and records the old content in a backup', async () => {
    const p = target('mtime-ok.json');
    await fs.writeFile(p, '{"v":1}', 'utf-8');
    const stat = await fs.stat(p);
    const result = await writeStateJson(p, '{"v":2}', { expectMtimeMs: Math.floor(stat.mtimeMs) });
    expect(result.ok).toBe(true);
    await expect(fs.readFile(result.backupPath!, 'utf-8')).resolves.toBe('{"v":1}');
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"v":2}');
  });

  it('rotates older uniquely named backups beyond keepBackups', async () => {
    const p = target('rotate.json');
    await fs.writeFile(`${p}.bak.20260101-000000000-old`, '{"stale":true}', 'utf-8');
    await fs.writeFile(`${p}.bak.20260102-000000000-newer`, '{"stale":true}', 'utf-8');
    await fs.writeFile(p, '{"v":1}', 'utf-8');
    const result = await writeStateJson(p, '{"v":2}', { keepBackups: 2 });
    expect(result.ok).toBe(true);
    const backups = (await fs.readdir(tmpDir)).filter((entry) => entry.startsWith('rotate.json.bak.'));
    expect(backups).toHaveLength(2);
    expect(backups).toContain(path.basename(result.backupPath!));
  });

  it('skips backup creation when backup is false', async () => {
    const p = target('no-backup.json');
    await fs.writeFile(p, '{"v":1}', 'utf-8');
    const result = await writeStateJson(p, '{"v":2}', { backup: false });
    expect(result).toMatchObject({ ok: true, backupPath: undefined });
  });

  it('accepts a BOM-prefixed JSON payload unchanged', async () => {
    const p = target('bom.json');
    const result = await writeStateJson(p, '\uFEFF{"a":1}');
    expect(result.ok).toBe(true);
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('\uFEFF{"a":1}');
  });

  it('serializes writers with the same old mtime so exactly one commits', async () => {
    const p = target('serialized.json');
    await fs.writeFile(p, '{"v":0}', 'utf-8');
    const oldMtime = (await fs.stat(p)).mtimeMs;
    const entered = await deferred();
    const release = await deferred();
    const first = writeStateJson(p, '{"v":1}', {
      expectMtimeMs: oldMtime,
      afterLockAcquired: async () => { entered.resolve(); await release.promise; },
    });
    await entered.promise;
    const second = writeStateJson(p, '{"v":2}', { expectMtimeMs: oldMtime, lockTimeoutMs: 1_000 });
    release.resolve();
    const [a, b] = await Promise.all([first, second]);
    expect([a, b].filter((result) => result.ok)).toHaveLength(1);
    expect([a.reason, b.reason]).toContain('MTIME_CONFLICT');
    const final = await fs.readFile(p, 'utf-8');
    expect([a, b].find((result) => result.ok)?.writtenPath).toBe(p);
    expect(['{"v":1}', '{"v":2}']).toContain(final);
  });

  it('does not release a lock when its token differs', async () => {
    const p = target('token.json');
    const lock = `${p}.lock`;
    const acquired = await deferred();
    const release = await deferred();
    const writer = writeStateJson(p, '{"v":1}', {
      afterLockAcquired: async () => { acquired.resolve(); await release.promise; },
    });
    await acquired.promise;
    const metadataPath = path.join(lock, 'owner', 'metadata.json');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8')) as Record<string, unknown>;
    await fs.writeFile(metadataPath, JSON.stringify({ ...metadata, token: 'other-token' }), 'utf-8');
    release.resolve();
    await expect(writer).resolves.toMatchObject({ ok: true });
    await expect(fs.access(lock)).resolves.toBeUndefined();
    await fs.rm(lock, { recursive: true, force: true });
  });

  it('times out while a valid live lock remains held', async () => {
    const p = target('live-lock.json');
    const lock = `${p}.lock`;
    await fs.mkdir(path.join(lock, 'owner'), { recursive: true });
    await fs.writeFile(path.join(lock, 'owner', 'metadata.json'), JSON.stringify({
      targetPath: p, pid: process.pid, token: 'live-owner', createdAt: new Date().toISOString(), operation: 'wm-write',
    }), 'utf-8');
    const result = await writeStateJson(p, '{"v":1}', { lockTimeoutMs: 20 });
    expect(result).toMatchObject({ ok: false, reason: 'LOCK_TIMEOUT' });
    await expect(fs.access(lock)).resolves.toBeUndefined();
    await fs.rm(lock, { recursive: true, force: true });
  });

  it('recovers a stale lock by renaming it to an audit file', async () => {
    const p = target('stale-lock.json');
    const lock = `${p}.lock`;
    await fs.mkdir(path.join(lock, 'owner'), { recursive: true });
    await fs.writeFile(path.join(lock, 'owner', 'metadata.json'), JSON.stringify({
      targetPath: p, pid: 999_999_999, token: 'stale-owner', createdAt: '2000-01-01T00:00:00.000Z', operation: 'wm-write',
    }), 'utf-8');
    const result = await writeStateJson(p, '{"v":1}', { staleLockTtlMs: 1 });
    expect(result.ok).toBe(true);
    const entries = await fs.readdir(lock);
    expect(entries.some((entry) => entry.startsWith('.stale-'))).toBe(true);
  });

  it('does not let a readback rollback overwrite a later writer', async () => {
    const p = target('rollback-race.json');
    await fs.writeFile(p, '{"v":"original"}', 'utf-8');
    const entered = await deferred();
    const release = await deferred();
    const first = writeStateJson(p, '{"v":"first"}', {
      afterLockAcquired: async () => { entered.resolve(); await release.promise; },
      readbackImpl: async () => 'not json',
    });
    await entered.promise;
    const second = writeStateJson(p, '{"v":"second"}', { lockTimeoutMs: 1_000 });
    release.resolve();
    await expect(first).resolves.toMatchObject({ ok: false, reason: 'WRITE_VERIFY_FAILED' });
    await expect(second).resolves.toMatchObject({ ok: true });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"v":"second"}');
  });

  it('leaves no temporary files or owned lock after a successful transaction', async () => {
    const p = target('cleanup.json');
    await writeStateJson(p, '{"step":1}');
    const result = await writeStateJson(p, '{"step":2}');
    expect(result.ok).toBe(true);
    const entries = await fs.readdir(tmpDir);
    expect(entries.filter((entry) => entry.includes('.tmp-'))).toEqual([]);
    const lockEntries = await fs.readdir(`${p}.lock`);
    expect(lockEntries).toEqual([]);
  });

  it('rolls back a failed readback using an atomic replacement', async () => {
    const p = target('rollback.json');
    await fs.writeFile(p, '{"v":"original"}', 'utf-8');
    const result = await writeStateJson(p, '{"v":"new"}', { readbackImpl: async () => 'garbage' });
    expect(result).toMatchObject({ ok: false, reason: 'WRITE_VERIFY_FAILED', rolledBack: true });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"v":"original"}');
  });
});

describe('review round 1 ownership races', () => {
  it('does not audit a replacement owner after stale recovery observed the old owner', async () => {
    const p = target('stale-owner-swap.json');
    const lockDir = `${p}.lock`;
    await fs.mkdir(path.join(lockDir, 'owner'), { recursive: true });
    await fs.writeFile(path.join(lockDir, 'owner', 'metadata.json'), JSON.stringify({
      targetPath: p, pid: 999_999_999, token: 'old', createdAt: '2000-01-01T00:00:00.000Z', operation: 'wm-write',
    }));
    const observed = await deferred();
    const continueRecovery = await deferred();
    const recovering = writeStateJson(p, '{"v":"recovered"}', {
      staleLockTtlMs: 1,
      afterStaleMetadataRead: async () => { observed.resolve(); await continueRecovery.promise; },
    } as never);
    await observed.promise;
    await fs.mkdir(path.join(lockDir, 'owner'), { recursive: true });
    await fs.writeFile(path.join(lockDir, 'owner', 'metadata.json'), JSON.stringify({
      targetPath: p, pid: process.pid, token: 'replacement', createdAt: new Date().toISOString(), operation: 'wm-write',
    }));
    continueRecovery.resolve();
    const result = await recovering;
    expect(result.reason).toBe('LOCK_TIMEOUT');
    await expect(fs.readFile(path.join(lockDir, 'owner', 'metadata.json'), 'utf-8')).resolves.toContain('replacement');
    expect((await fs.readdir(tmpDir)).filter((entry) => entry.includes('.stale-'))).toEqual([]);
    await fs.rm(lockDir, { recursive: true, force: true });
  });

  it('does not delete a replacement owner after release ownership transfer', async () => {
    const p = target('release-owner-swap.json');
    const moved = await deferred();
    const continueRelease = await deferred();
    const writer = writeStateJson(p, '{"v":1}', {
      afterReleaseOwnershipMoved: async () => { moved.resolve(); await continueRelease.promise; },
    } as never);
    await moved.promise;
    const lockDir = `${p}.lock`;
    await fs.mkdir(path.join(lockDir, 'owner'));
    await fs.writeFile(path.join(lockDir, 'owner', 'metadata.json'), JSON.stringify({
      targetPath: p, pid: process.pid, token: 'replacement', createdAt: new Date().toISOString(), operation: 'wm-write',
    }));
    continueRelease.resolve();
    await expect(writer).resolves.toMatchObject({ ok: true });
    await expect(fs.readFile(path.join(lockDir, 'owner', 'metadata.json'), 'utf-8')).resolves.toContain('replacement');
    await fs.rm(lockDir, { recursive: true, force: true });
  });

  it('keeps a waiting successor from committing while rollback owns the lock', async () => {
    const p = target('rollback-successor.json');
    await fs.writeFile(p, '{"v":"old"}');
    const beforeRollback = await deferred();
    const continueRollback = await deferred();
    const first = writeStateJson(p, '{"v":"first"}', {
      readbackImpl: async () => 'invalid',
      beforeRollback: async () => { beforeRollback.resolve(); await continueRollback.promise; },
    } as never);
    await beforeRollback.promise;
    const second = writeStateJson(p, '{"v":"second"}', { lockTimeoutMs: 1_000 });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"v":"first"}');
    continueRollback.resolve();
    await expect(first).resolves.toMatchObject({ ok: false, rolledBack: true });
    await expect(second).resolves.toMatchObject({ ok: true });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"v":"second"}');
  });
});
