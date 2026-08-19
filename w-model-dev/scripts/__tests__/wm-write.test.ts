/* eslint-disable security/detect-non-literal-fs-filename -- B2 test paths are generated under a test-owned mkdtemp directory. */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cli/wm-write.ts');

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-write-cli-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function target(name: string): string {
  return path.join(tmpDir, name);
}

function runArgs(
  args: string[],
  input?: string,
  cwd = process.cwd(),
): { code: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [tsxCli, SCRIPT, ...args], {
    cwd,
    encoding: 'utf-8',
    input,
  });
  return { code: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function run(
  targetPath: string,
  args: string[],
  input?: string,
  cwd = process.cwd(),
): { code: number | null; stdout: string; stderr: string } {
  return runArgs([targetPath, ...args], input, cwd);
}

function wmwriteSummary(stdout: string): Record<string, unknown> {
  const line = stdout.split(/\r?\n/).find((entry) => entry.startsWith('WMWRITE_JSON '));
  expect(line).toBeDefined();
  return JSON.parse(line!.slice('WMWRITE_JSON '.length)) as Record<string, unknown>;
}

async function writeLock(targetPath: string, metadata: Record<string, unknown>): Promise<void> {
  const owner = path.join(`${targetPath}.lock`, 'owner');
  await fs.mkdir(owner, { recursive: true });
  await fs.writeFile(path.join(owner, 'metadata.json'), JSON.stringify(metadata), 'utf-8');
}

async function holdLiveLock(
  targetPath: string,
  holdMs: number,
  createdAt = new Date().toISOString(),
  removeOnExit = true,
): Promise<ChildProcess> {
  const holder = spawn(
    process.execPath,
    [
      '-e',
      `
    const fs = require('node:fs/promises');
    const path = require('node:path');
    const target = process.argv[1];
    const holdMs = Number(process.argv[2]);
    const owner = target + '.lock' + path.sep + 'owner';
    const removeOnExit = process.argv[4] === 'true';
    (async () => {
      await fs.mkdir(owner, { recursive: true });
      await fs.writeFile(path.join(owner, 'metadata.json'), JSON.stringify({
        targetPath: target,
        pid: process.pid,
        token: 'holder',
        createdAt: process.argv[3],
        operation: 'wm-write',
      }));
      process.stdout.write('ready\\n');
      setTimeout(async () => {
        if (removeOnExit) await fs.rm(owner, { recursive: true, force: true });
        process.exit(0);
      }, holdMs);
    })().catch((error) => { console.error(error); process.exit(1); });
  `,
      targetPath,
      String(holdMs),
      createdAt,
      String(removeOnExit),
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  await once(holder.stdout!, 'data');
  return holder;
}

async function waitForExit(child: ChildProcess): Promise<void> {
  const code = child.exitCode ?? ((await once(child, 'exit')) as [number | null])[0];
  expect(code).toBe(0);
}

describe('wm-write CLI lock controls', () => {
  it('--lock-timeout 0 is distinguishable from the default timeout while a real child process holds the lock', async () => {
    const p = target('zero-timeout.json');
    const holder = await holdLiveLock(p, 1500);

    try {
      const explicitZero = run(p, ['--stdin', '--lock-timeout', '0'], '{"value":"zero"}');
      expect(explicitZero.code).toBe(1);
      expect(wmwriteSummary(explicitZero.stdout)).toMatchObject({ ok: false, reason: 'LOCK_TIMEOUT', writtenPath: p });
      await expect(fs.access(path.join(`${p}.lock`, 'owner'))).resolves.toBeUndefined();

      const defaultTimeout = run(p, ['--stdin'], '{"value":"default"}');
      expect(defaultTimeout.code).toBe(0);
      expect(wmwriteSummary(defaultTimeout.stdout)).toMatchObject({ ok: true, writtenPath: p });
      await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"value":"default"}');
    } finally {
      await waitForExit(holder);
    }
  });

  it.each([
    ['missing value', ['--stdin', '--lock-timeout']],
    ['negative value', ['--stdin', '--lock-timeout', '-1']],
    ['decimal value', ['--stdin', '--lock-timeout', '1.5']],
    ['non-numeric value', ['--stdin', '--lock-timeout', 'abc']],
    ['unsafe integer', ['--stdin', '--lock-timeout', '9007199254740992']],
  ])('--lock-timeout %s is ARG_INVALID with exit 2', (_caseName, args) => {
    const result = run(target(`invalid-${_caseName}.json`), args, '{"value":1}');

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('✗ [ARG_INVALID]');
    expect(result.stdout).toContain('ERROR_JSON ');
  });

  it('--recover-stale-lock rejects an active external owner without removing it', async () => {
    const p = target('active-owner-explicit-recovery.json');
    const holder = await holdLiveLock(p, 5_000);

    try {
      const result = run(p, ['--stdin', '--recover-stale-lock', '--lock-timeout', '1000'], '{"value":"B"}');

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('✗ [WRITE_REJECTED]');
      expect(wmwriteSummary(result.stdout)).toMatchObject({
        script: 'wm-write.ts',
        ok: false,
        reason: 'LOCK_TIMEOUT',
        writtenPath: p,
      });
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-controlled temporary path
      await expect(fs.readFile(path.join(`${p}.lock`, 'owner', 'metadata.json'), 'utf-8')).resolves.toContain(
        '"token":"holder"',
      );
    } finally {
      await waitForExit(holder);
    }
  });

  it('returns a WRITE_REJECTED LOCK_TIMEOUT summary for a valid live lock', async () => {
    const p = target('live-lock.json');
    await writeLock(p, {
      targetPath: p,
      pid: process.pid,
      token: 'live-owner',
      createdAt: new Date().toISOString(),
      operation: 'wm-write',
    });

    const result = run(p, ['--stdin', '--lock-timeout', '1'], '{"value":1}');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('✗ [WRITE_REJECTED]');
    expect(wmwriteSummary(result.stdout)).toMatchObject({
      script: 'wm-write.ts',
      ok: false,
      reason: 'LOCK_TIMEOUT',
      writtenPath: p,
    });
  });

  it('rejects a stale lock without --recover-stale-lock and does not modify the target', async () => {
    const p = target('stale-rejected.json');
    await fs.writeFile(p, '{"value":"unchanged"}', 'utf-8');
    await writeLock(p, {
      targetPath: p,
      pid: 999_999_999,
      token: 'stale-owner',
      createdAt: '2000-01-01T00:00:00.000Z',
      operation: 'wm-write',
    });

    const result = run(p, ['--stdin', '--lock-timeout', '1000'], '{"value":"new"}');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('✗ [WRITE_REJECTED]');
    expect(wmwriteSummary(result.stdout)).toMatchObject({ ok: false, reason: 'STALE_LOCK', writtenPath: p });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"value":"unchanged"}');
  });

  it('atomically rejects a lock that becomes stale during the CLI call, unless recovery is explicit', async () => {
    const p = target('transitioned-stale-lock.json');
    const holder = await holdLiveLock(p, 500, '2000-01-01T00:00:00.000Z', false);

    try {
      const rejected = run(p, ['--stdin', '--lock-timeout', '1000'], '{"value":"rejected"}');
      expect(rejected.code).toBe(1);
      expect(rejected.stderr).toContain('✗ [WRITE_REJECTED]');
      expect(wmwriteSummary(rejected.stdout)).toMatchObject({ ok: false, reason: 'STALE_LOCK', writtenPath: p });
      await expect(fs.access(p)).rejects.toMatchObject({ code: 'ENOENT' });

      const recovered = run(p, ['--stdin', '--recover-stale-lock', '--lock-timeout', '1000'], '{"value":"recovered"}');
      expect(recovered.code).toBe(0);
      expect(wmwriteSummary(recovered.stdout)).toMatchObject({ script: 'wm-write.ts', ok: true, writtenPath: p });
      await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"value":"recovered"}');
    } finally {
      await waitForExit(holder);
    }
  });
});

describe('wm-write CLI schema validation', () => {
  const validProject = {
    id: 'project-1',
    name: 'Test project',
    description: '',
    status: '需求分析',
    techStack: { frontend: [], backend: [], database: [], others: [] },
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
  };

  it('returns SCHEMA_INVALID with exit 1 without allowing --allow-untyped to bypass a registered target', async () => {
    const stateDir = path.join(tmpDir, '.w-model');
    const p = path.join(stateDir, 'project.json');
    await fs.mkdir(stateDir, { recursive: true });

    const result = run(
      p,
      ['--stdin', '--allow-untyped'],
      JSON.stringify({ ...validProject, unexpected: true }),
      tmpDir,
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('✗ [WRITE_REJECTED]');
    expect(wmwriteSummary(result.stdout)).toMatchObject({
      ok: false,
      reason: 'SCHEMA_INVALID',
      writtenPath: p,
    });
    await expect(fs.access(p)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('uses the target .w-model parent as project root when the CLI cwd differs', async () => {
    const stateDir = path.join(tmpDir, '.w-model');
    const p = path.join(stateDir, 'project.json');
    await fs.mkdir(stateDir, { recursive: true });

    const result = run(p, ['--stdin'], JSON.stringify({ ...validProject, unexpected: true }));

    expect(result.code).toBe(1);
    expect(wmwriteSummary(result.stdout)).toMatchObject({
      ok: false,
      reason: 'SCHEMA_INVALID',
      writtenPath: p,
    });
  });

  it('rejects invalid registered and unregistered Windows case variants through real child processes', async () => {
    const stateDir = path.join(tmpDir, '.W-MODEL');
    const registered = path.join(stateDir, 'PROJECT.JSON');
    const unregistered = path.join(stateDir, 'CUSTOM.JSON');
    await fs.mkdir(stateDir, { recursive: true });

    const invalidRegistered = run(
      registered,
      ['--stdin'],
      JSON.stringify({ ...validProject, unexpected: true }),
      tmpDir,
    );
    expect(invalidRegistered.code).toBe(1);
    expect(wmwriteSummary(invalidRegistered.stdout)).toMatchObject({
      ok: false,
      reason: 'SCHEMA_INVALID',
      writtenPath: registered,
    });

    const rejectedUnregistered = run(unregistered, ['--stdin'], '{"custom":true}', tmpDir);
    expect(rejectedUnregistered.code).toBe(1);
    expect(wmwriteSummary(rejectedUnregistered.stdout)).toMatchObject({
      ok: false,
      reason: 'UNREGISTERED_TARGET',
      writtenPath: unregistered,
    });

    const allowedUnregistered = run(unregistered, ['--stdin', '--allow-untyped'], '{"custom":true}', tmpDir);
    expect(allowedUnregistered.code).toBe(0);
    expect(wmwriteSummary(allowedUnregistered.stdout)).toMatchObject({ ok: true, untyped: true });
  });

  it('returns UNREGISTERED_TARGET with exit 1, then writes with --allow-untyped and marks the JSON summary', async () => {
    const stateDir = path.join(tmpDir, '.w-model');
    const p = path.join(stateDir, 'custom.json');
    await fs.mkdir(stateDir, { recursive: true });

    const rejected = run(p, ['--stdin'], '{"custom":true}', tmpDir);
    expect(rejected.code).toBe(1);
    expect(rejected.stderr).toContain('✗ [WRITE_REJECTED]');
    expect(wmwriteSummary(rejected.stdout)).toMatchObject({
      ok: false,
      reason: 'UNREGISTERED_TARGET',
      writtenPath: p,
    });

    const allowed = run(p, ['--stdin', '--allow-untyped'], '{"custom":true}', tmpDir);
    expect(allowed.code).toBe(0);
    expect(allowed.stderr).toContain('警告');
    expect(wmwriteSummary(allowed.stdout)).toMatchObject({ ok: true, untyped: true, writtenPath: p });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"custom":true}');
  });
});

describe('wm-write CLI argument boundaries and existing contract', () => {
  it('accepts the target after --stdin', async () => {
    const p = target('target-after-option.json');

    const result = runArgs(['--stdin', p], '{"source":"stdin"}');

    expect(result.code).toBe(0);
    expect(wmwriteSummary(result.stdout)).toMatchObject({ ok: true, writtenPath: p });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"source":"stdin"}');
  });

  it('--from consumes a path named --lock-timeout instead of parsing it as a timeout flag', async () => {
    const source = path.join(tmpDir, '--lock-timeout');
    const p = target('from-option-looking-path.json');
    await fs.writeFile(source, '{"source":"file"}', 'utf-8');

    const result = run(p, ['--from', '--lock-timeout'], undefined, tmpDir);

    expect(result.code).toBe(0);
    expect(wmwriteSummary(result.stdout)).toMatchObject({ ok: true, writtenPath: p });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"source":"file"}');
  });

  it('rejects unknown extra positional arguments', () => {
    const result = run(target('extra-positional.json'), ['--stdin', 'unexpected.json'], '{"value":1}');

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('✗ [ARG_INVALID]');
    expect(result.stdout).toContain('ERROR_JSON ');
  });

  it('--stdin and --from both write successfully', async () => {
    const stdinTarget = target('stdin.json');
    const stdinResult = run(stdinTarget, ['--stdin'], '{"source":"stdin"}');
    expect(stdinResult.code).toBe(0);
    expect(wmwriteSummary(stdinResult.stdout)).toMatchObject({ ok: true, writtenPath: stdinTarget });

    const fromTarget = target('from.json');
    const source = target('source.json');
    await fs.writeFile(source, '{"source":"file"}', 'utf-8');
    const fromResult = run(fromTarget, ['--from', source]);
    expect(fromResult.code).toBe(0);
    expect(wmwriteSummary(fromResult.stdout)).toMatchObject({ ok: true, writtenPath: fromTarget });
  });

  it('--stdin and --from remain mutually exclusive with exit 2', async () => {
    const source = target('source.json');
    await fs.writeFile(source, '{"source":"file"}', 'utf-8');

    const result = run(target('mutual.json'), ['--stdin', '--from', source], '{"source":"stdin"}');

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('✗ [ARG_INVALID]');
    expect(result.stdout).toContain('ERROR_JSON ');
  });

  it('--expect-mtime accepts a finite fractional value and floors it', async () => {
    const p = target('mtime-fractional.json');
    await fs.writeFile(p, '{"value":"old"}', 'utf-8');
    const mtime = Math.floor((await fs.stat(p)).mtimeMs);

    const result = run(p, ['--stdin', '--expect-mtime', `${mtime}.5`], '{"value":"new"}');

    expect(result.code).toBe(0);
    expect(wmwriteSummary(result.stdout)).toMatchObject({ ok: true, writtenPath: p });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"value":"new"}');
  });

  it('returns MTIME_CONFLICT as a write rejection with exit 1', async () => {
    const p = target('mtime.json');
    await fs.writeFile(p, '{"value":"old"}', 'utf-8');
    const mtime = Math.floor((await fs.stat(p)).mtimeMs);

    const result = run(p, ['--stdin', '--expect-mtime', String(mtime + 10_000)], '{"value":"new"}');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('✗ [WRITE_REJECTED]');
    expect(wmwriteSummary(result.stdout)).toMatchObject({ ok: false, reason: 'MTIME_CONFLICT', writtenPath: p });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"value":"old"}');
  });
});
