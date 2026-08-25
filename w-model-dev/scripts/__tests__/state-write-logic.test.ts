/* eslint-disable security/detect-non-literal-fs-filename -- B2 test paths are generated under a test-owned mkdtemp directory. */
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

function stateTarget(name: string): string {
  return path.join(tmpDir, '.w-model', name);
}

const validProject = {
  id: 'project-1',
  name: 'Test project',
  description: '',
  status: '需求分析',
  techStack: { frontend: [], backend: [], database: [], others: [] },
  createdAt: '2026-08-19T00:00:00.000Z',
  updatedAt: '2026-08-19T00:00:00.000Z',
};

const validRunLogEntry = {
  runId: 'run-1',
  timestamp: '2026-08-19T00:00:00.000Z',
  phase: 1,
  phaseName: '需求分析',
  action: 'produce',
  role: 'S',
  duration_s: 0,
  tokens: 0,
  estimated: false,
  subagentSpawns: 0,
  gateExitCode: null,
  outcome: 'success',
};

async function deferred(): Promise<{ promise: Promise<void>; resolve: () => void }> {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
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

  it('rejects an invalid registered JSON payload inside the lock without side effects', async () => {
    const p = stateTarget('project.json');
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, JSON.stringify(validProject), 'utf-8');

    const result = await writeStateJson(p, JSON.stringify({ ...validProject, unexpected: true }));

    expect(result).toMatchObject({ ok: false, reason: 'SCHEMA_INVALID' });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe(JSON.stringify(validProject));
    const entries = await fs.readdir(path.dirname(p));
    expect(entries.filter((entry) => entry.includes('.tmp-') || entry.includes('.bak.'))).toEqual([]);
    await expect(fs.readdir(`${p}.lock`)).resolves.toEqual([]);
  });

  it('writes a valid registered JSON payload', async () => {
    const p = stateTarget('project.json');
    await fs.mkdir(path.dirname(p), { recursive: true });

    const result = await writeStateJson(p, JSON.stringify(validProject), { projectRoot: tmpDir });

    expect(result).toMatchObject({ ok: true });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe(JSON.stringify(validProject));
  });

  it('rejects an invalid registered Windows case variant without creating transaction side effects', async () => {
    const projectRoot = target('case-variant-project');
    const p = path.join(projectRoot, '.W-MODEL', 'PROJECT.JSON');
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, JSON.stringify(validProject), 'utf-8');

    const result = await writeStateJson(p, JSON.stringify({ ...validProject, unexpected: true }), {
      projectRoot,
    });

    expect(result).toMatchObject({ ok: false, reason: 'SCHEMA_INVALID' });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe(JSON.stringify(validProject));
    const entries = await fs.readdir(path.dirname(p));
    expect(entries.filter((entry) => entry.includes('.tmp-') || entry.includes('.bak.'))).toEqual([]);
    await expect(fs.readdir(`${p}.lock`)).resolves.toEqual([]);
  });

  it('propagates schema infrastructure errors while releasing the acquired lock without transaction artifacts', async () => {
    const projectRoot = target('schema-infrastructure-project');
    const p = path.join(projectRoot, '.w-model', 'project.json');
    await fs.mkdir(path.dirname(p), { recursive: true });
    const infrastructureError = new Error('schema infrastructure unavailable');

    await expect(
      writeStateJson(p, JSON.stringify(validProject), {
        projectRoot,
        schemaValidator: () => {
          throw infrastructureError;
        },
      }),
    ).rejects.toBe(infrastructureError);

    const entries = await fs.readdir(path.dirname(p));
    expect(entries.filter((entry) => entry.includes('.tmp-') || entry.includes('.bak.'))).toEqual([]);
    await expect(fs.readdir(`${p}.lock`)).resolves.toEqual([]);
  });

  it('rejects an invalid registered JSONL line and reports only the line number', async () => {
    const p = stateTarget('run-log.jsonl');
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, `${JSON.stringify(validRunLogEntry)}\n`, 'utf-8');

    const result = await writeStateJson(
      p,
      `${JSON.stringify(validRunLogEntry)}\n${JSON.stringify({ ...validRunLogEntry, extra: true })}\n`,
      { projectRoot: tmpDir },
    );

    expect(result).toMatchObject({ ok: false, reason: 'SCHEMA_INVALID', schemaInvalidLine: 2 });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe(`${JSON.stringify(validRunLogEntry)}\n`);
  });

  it('rejects unregistered .w-model targets unless untyped writes are explicitly allowed', async () => {
    const p = stateTarget('custom.json');
    await fs.mkdir(path.dirname(p), { recursive: true });

    const rejected = await writeStateJson(p, '{"custom":true}', { projectRoot: tmpDir });
    expect(rejected).toMatchObject({ ok: false, reason: 'UNREGISTERED_TARGET' });
    await expect(fs.access(p)).rejects.toMatchObject({ code: 'ENOENT' });

    const allowed = await writeStateJson(p, '{"custom":true}', { projectRoot: tmpDir, allowUntyped: true });
    expect(allowed).toMatchObject({ ok: true, untyped: true });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"custom":true}');
  });

  it('does not let allowUntyped bypass an invalid registered schema', async () => {
    const p = stateTarget('project.json');
    await fs.mkdir(path.dirname(p), { recursive: true });

    const result = await writeStateJson(p, JSON.stringify({ ...validProject, unexpected: true }), {
      projectRoot: tmpDir,
      allowUntyped: true,
    });

    expect(result).toMatchObject({ ok: false, reason: 'SCHEMA_INVALID' });
  });

  it('serializes writers with the same old mtime so exactly one commits', async () => {
    const p = target('serialized.json');
    await fs.writeFile(p, '{"v":0}', 'utf-8');
    const oldMtime = (await fs.stat(p)).mtimeMs;
    const entered = await deferred();
    const release = await deferred();
    const first = writeStateJson(p, '{"v":1}', {
      expectMtimeMs: oldMtime,
      afterLockAcquired: async () => {
        entered.resolve();
        await release.promise;
      },
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

  it('does not let explicit stale recovery take over an active writer before its commit', async () => {
    const p = target('active-owner-explicit-recovery.json');
    const acquired = await deferred();
    const release = await deferred();
    const first = writeStateJson(p, '{"writer":"A"}', {
      afterLockAcquired: async () => {
        acquired.resolve();
        await release.promise;
      },
    });

    await acquired.promise;
    const ownerMetadataPath = path.join(`${p}.lock`, 'owner', 'metadata.json');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-controlled temporary path
    const activeOwner = await fs.readFile(ownerMetadataPath, 'utf-8');
    const second = await writeStateJson(p, '{"writer":"B"}', {
      recoverStaleLock: true,
      lockTimeoutMs: 25,
    });

    expect(second).toMatchObject({ ok: false, reason: 'LOCK_TIMEOUT' });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-controlled temporary path
    await expect(fs.readFile(ownerMetadataPath, 'utf-8')).resolves.toBe(activeOwner);
    release.resolve();
    await expect(first).resolves.toMatchObject({ ok: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-controlled temporary path
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"writer":"A"}');
  });

  it('does not release a lock when its token differs', async () => {
    const p = target('token.json');
    const lock = `${p}.lock`;
    const acquired = await deferred();
    const release = await deferred();
    const writer = writeStateJson(p, '{"v":1}', {
      afterLockAcquired: async () => {
        acquired.resolve();
        await release.promise;
      },
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
    await fs.writeFile(
      path.join(lock, 'owner', 'metadata.json'),
      JSON.stringify({
        targetPath: p,
        pid: process.pid,
        token: 'live-owner',
        createdAt: new Date().toISOString(),
        operation: 'wm-write',
      }),
      'utf-8',
    );
    const result = await writeStateJson(p, '{"v":1}', { lockTimeoutMs: 20 });
    expect(result).toMatchObject({ ok: false, reason: 'LOCK_TIMEOUT' });
    await expect(fs.access(lock)).resolves.toBeUndefined();
    await fs.rm(lock, { recursive: true, force: true });
  });

  it('recovers a stale lock by renaming it to an audit file', async () => {
    const p = target('stale-lock.json');
    const lock = `${p}.lock`;
    await fs.mkdir(path.join(lock, 'owner'), { recursive: true });
    await fs.writeFile(
      path.join(lock, 'owner', 'metadata.json'),
      JSON.stringify({
        targetPath: p,
        pid: 999_999_999,
        token: 'stale-owner',
        createdAt: '2000-01-01T00:00:00.000Z',
        operation: 'wm-write',
      }),
      'utf-8',
    );
    const result = await writeStateJson(p, '{"v":1}', { staleLockTtlMs: 1 });
    expect(result.ok).toBe(true);
    const entries = await fs.readdir(lock);
    expect(entries.some((entry) => entry.startsWith('.stale-'))).toBe(true);
  });

  it('returns STALE_LOCK instead of implicitly recovering when policy disables recovery', async () => {
    const p = target('stale-lock-rejected.json');
    const lock = `${p}.lock`;
    await fs.mkdir(path.join(lock, 'owner'), { recursive: true });
    await fs.writeFile(
      path.join(lock, 'owner', 'metadata.json'),
      JSON.stringify({
        targetPath: p,
        pid: 999_999_999,
        token: 'stale-owner',
        createdAt: '2000-01-01T00:00:00.000Z',
        operation: 'wm-write',
      }),
      'utf-8',
    );

    const result = await writeStateJson(p, '{"v":1}', { staleLockTtlMs: 1, allowImplicitStaleRecovery: false });

    expect(result).toMatchObject({ ok: false, reason: 'STALE_LOCK' });
    await expect(fs.access(p)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.access(path.join(lock, 'owner', 'metadata.json'))).resolves.toBeUndefined();
  });

  it.each(['', '{broken'])('rejects an owner with %j metadata without deleting the unknown owner', async (metadata) => {
    const p = target(`unknown-owner-${metadata === '' ? 'empty' : 'broken'}.json`);
    const lock = `${p}.lock`;
    const ownerMetadataPath = path.join(lock, 'owner', 'metadata.json');
    await fs.mkdir(path.dirname(ownerMetadataPath), { recursive: true });
    await fs.writeFile(ownerMetadataPath, metadata, 'utf-8');

    const result = await writeStateJson(p, '{"v":1}', { lockTimeoutMs: 20 });

    expect(result).toMatchObject({ ok: false, reason: 'STALE_LOCK' });
    await expect(fs.readFile(ownerMetadataPath, 'utf-8')).resolves.toBe(metadata);
    await fs.rm(lock, { recursive: true, force: true });
  });

  it('audits and recovers an owner with corrupt metadata only when explicitly requested', async () => {
    const p = target('unknown-owner-explicit-recovery.json');
    const lock = `${p}.lock`;
    const ownerMetadataPath = path.join(lock, 'owner', 'metadata.json');
    await fs.mkdir(path.dirname(ownerMetadataPath), { recursive: true });
    await fs.writeFile(ownerMetadataPath, '{broken', 'utf-8');

    const result = await writeStateJson(p, '{"v":1}', { recoverStaleLock: true, lockTimeoutMs: 1_000 });

    expect(result).toMatchObject({ ok: true });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"v":1}');
    expect((await fs.readdir(lock)).some((entry) => entry.startsWith('.stale-'))).toBe(true);
  });

  it('does not let a readback rollback overwrite a later writer', async () => {
    const p = target('rollback-race.json');
    await fs.writeFile(p, '{"v":"original"}', 'utf-8');
    const entered = await deferred();
    const release = await deferred();
    const first = writeStateJson(p, '{"v":"first"}', {
      afterLockAcquired: async () => {
        entered.resolve();
        await release.promise;
      },
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

  it('preserves an existing target after a failed readback with backup disabled', async () => {
    const p = target('rollback-no-backup.json');
    await fs.writeFile(p, '{"v":"original"}', 'utf-8');
    const result = await writeStateJson(p, '{"v":"new"}', {
      backup: false,
      readbackImpl: async () => 'garbage',
    });

    expect(result).toMatchObject({ ok: false, reason: 'WRITE_VERIFY_FAILED', rolledBack: true });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"v":"original"}');
    expect((await fs.readdir(tmpDir)).filter((entry) => entry.includes('.tmp-'))).toEqual([]);
  });

  it('restores a target that was originally absent after a failed readback without backup', async () => {
    const p = target('rollback-missing-no-backup.json');
    const result = await writeStateJson(p, '{"v":"new"}', {
      backup: false,
      readbackImpl: async () => 'garbage',
    });

    expect(result).toMatchObject({ ok: false, reason: 'WRITE_VERIFY_FAILED', rolledBack: true });
    await expect(fs.access(p)).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await fs.readdir(tmpDir)).filter((entry) => entry.includes('.tmp-'))).toEqual([]);
  });

  it('does not report a rollback after its lock token changes', async () => {
    const p = target('rollback-token-mismatch.json');
    await fs.writeFile(p, '{"v":"original"}', 'utf-8');
    const result = await writeStateJson(p, '{"v":"new"}', {
      backup: false,
      readbackImpl: async () => 'garbage',
      beforeRollback: async () => {
        const metadataPath = path.join(`${p}.lock`, 'owner', 'metadata.json');
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8')) as Record<string, unknown>;
        await fs.writeFile(metadataPath, JSON.stringify({ ...metadata, token: 'replacement-token' }), 'utf-8');
      },
    });

    expect(result).toMatchObject({ ok: false, reason: 'WRITE_VERIFY_FAILED', rolledBack: false });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"v":"new"}');
    expect((await fs.readdir(tmpDir)).filter((entry) => entry.includes('.tmp-'))).toEqual([]);
    await fs.rm(`${p}.lock`, { recursive: true, force: true });
  });
});

describe('review round 1 ownership races', () => {
  it('does not audit a replacement owner after stale recovery observed the old owner', async () => {
    const p = target('stale-owner-swap.json');
    const lockDir = `${p}.lock`;
    await fs.mkdir(path.join(lockDir, 'owner'), { recursive: true });
    await fs.writeFile(
      path.join(lockDir, 'owner', 'metadata.json'),
      JSON.stringify({
        targetPath: p,
        pid: 999_999_999,
        token: 'old',
        createdAt: '2000-01-01T00:00:00.000Z',
        operation: 'wm-write',
      }),
    );
    const observed = await deferred();
    const continueRecovery = await deferred();
    const recovering = writeStateJson(p, '{"v":"recovered"}', {
      staleLockTtlMs: 1,
      afterStaleMetadataRead: async () => {
        observed.resolve();
        await continueRecovery.promise;
      },
    } as never);
    await observed.promise;
    await fs.mkdir(path.join(lockDir, 'owner'), { recursive: true });
    await fs.writeFile(
      path.join(lockDir, 'owner', 'metadata.json'),
      JSON.stringify({
        targetPath: p,
        pid: process.pid,
        token: 'replacement',
        createdAt: new Date().toISOString(),
        operation: 'wm-write',
      }),
    );
    continueRecovery.resolve();
    const result = await recovering;
    expect(result.reason).toBe('LOCK_TIMEOUT');
    await expect(fs.readFile(path.join(lockDir, 'owner', 'metadata.json'), 'utf-8')).resolves.toContain('replacement');
    expect((await fs.readdir(tmpDir)).filter((entry) => entry.includes('.stale-'))).toEqual([]);
    await fs.rm(lockDir, { recursive: true, force: true });
  });

  it('does not let a second writer recover an active stale-owner recovery transition', async () => {
    const p = target('active-recovery.json');
    const owner = path.join(`${p}.lock`, 'owner');
    await fs.mkdir(owner, { recursive: true });
    await fs.writeFile(
      path.join(owner, 'metadata.json'),
      JSON.stringify({
        targetPath: p,
        pid: 999_999_999,
        token: 'dead-owner',
        createdAt: '2000-01-01T00:00:00.000Z',
        operation: 'wm-write',
      }),
    );
    const moved = await deferred();
    const continueRecovery = await deferred();
    const first = writeStateJson(p, '{"v":"first"}', {
      staleLockTtlMs: 1,
      afterRecoveryOwnershipMoved: async () => {
        moved.resolve();
        await continueRecovery.promise;
      },
    } as never);
    await moved.promise;
    const second = await writeStateJson(p, '{"v":"second"}', {
      recoverStaleLock: true,
      staleLockTtlMs: 1,
      lockTimeoutMs: 25,
    });
    expect(second).toMatchObject({ ok: false, reason: 'LOCK_TIMEOUT' });
    const activeTransition = (await fs.readdir(`${p}.lock`)).find((entry) => entry.startsWith('.recovering-'));
    expect(activeTransition).toBeDefined();
    continueRecovery.resolve();
    await expect(first).resolves.toMatchObject({ ok: true });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"v":"first"}');
  });

  it('does not delete a replacement owner after release ownership transfer', async () => {
    const p = target('release-owner-swap.json');
    const moved = await deferred();
    const continueRelease = await deferred();
    const writer = writeStateJson(p, '{"v":1}', {
      afterReleaseOwnershipMoved: async () => {
        moved.resolve();
        await continueRelease.promise;
      },
    } as never);
    await moved.promise;
    const lockDir = `${p}.lock`;
    await fs.mkdir(path.join(lockDir, 'owner'));
    await fs.writeFile(
      path.join(lockDir, 'owner', 'metadata.json'),
      JSON.stringify({
        targetPath: p,
        pid: process.pid,
        token: 'replacement',
        createdAt: new Date().toISOString(),
        operation: 'wm-write',
      }),
    );
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
      beforeRollback: async () => {
        beforeRollback.resolve();
        await continueRollback.promise;
      },
    } as never);
    await beforeRollback.promise;
    const second = writeStateJson(p, '{"v":"second"}', { lockTimeoutMs: 1_000 });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"v":"first"}');
    continueRollback.resolve();
    await expect(first).resolves.toMatchObject({ ok: false, rolledBack: true });
    await expect(second).resolves.toMatchObject({ ok: true });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"v":"second"}');
  });

  it.each(['.recovering-orphan', '.releasing-orphan'])(
    'recovers stale orphan transition %s and writes',
    async (transition) => {
      const p = target(`orphan-${transition.slice(1)}.json`);
      const transitionDir = path.join(`${p}.lock`, transition);
      await fs.mkdir(transitionDir, { recursive: true });
      const origin = {
        targetPath: p,
        pid: 999_999_999,
        token: transition,
        createdAt: '2000-01-01T00:00:00.000Z',
        operation: 'wm-write',
      };
      await fs.writeFile(path.join(transitionDir, 'metadata.json'), JSON.stringify(origin));
      await fs.writeFile(
        path.join(transitionDir, 'transition.json'),
        JSON.stringify({
          kind: transition.includes('recovering') ? 'recovering' : 'releasing',
          operatorPid: 999_999_999,
          operatorToken: 'dead-operator',
          operatorStartedAt: '2000-01-01T00:00:00.000Z',
          origin,
        }),
      );
      const result = await writeStateJson(p, '{"v":"recovered"}', { staleLockTtlMs: 1 });
      expect(result.ok).toBe(true);
      await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"v":"recovered"}');
      const entries = await fs.readdir(`${p}.lock`);
      expect(entries.some((entry) => entry.startsWith('.stale-'))).toBe(true);
    },
  );

  it('does not clean an active orphan transition', async () => {
    const p = target('active-transition.json');
    const transitionDir = path.join(`${p}.lock`, '.releasing-active');
    await fs.mkdir(transitionDir, { recursive: true });
    await fs.writeFile(
      path.join(transitionDir, 'metadata.json'),
      JSON.stringify({
        targetPath: p,
        pid: process.pid,
        token: 'active',
        createdAt: new Date().toISOString(),
        operation: 'wm-write',
      }),
    );
    const result = await writeStateJson(p, '{"v":1}', { lockTimeoutMs: 20, staleLockTtlMs: 1 });
    expect(result).toMatchObject({ ok: false, reason: 'LOCK_TIMEOUT' });
    await expect(fs.readFile(path.join(transitionDir, 'metadata.json'), 'utf-8')).resolves.toContain('active');
  });
});
