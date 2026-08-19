import { spawnSync } from 'node:child_process';
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

function run(targetPath: string, args: string[], input?: string): { code: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [tsxCli, SCRIPT, targetPath, ...args], {
    encoding: 'utf-8',
    input,
  });
  return { code: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
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

describe('wm-write CLI lock controls', () => {
  it('--lock-timeout 0 parses and is forwarded to the real writer', async () => {
    const p = target('zero-timeout.json');
    await writeLock(p, {
      targetPath: p,
      pid: process.pid,
      token: 'live-owner',
      createdAt: new Date().toISOString(),
      operation: 'wm-write',
    });

    const result = run(p, ['--stdin', '--lock-timeout', '0'], '{"value":0}');

    expect(result.code).toBe(1);
    expect(wmwriteSummary(result.stdout)).toMatchObject({ ok: false, reason: 'LOCK_TIMEOUT', writtenPath: p });
  });

  it.each([
    ['missing value', ['--stdin', '--lock-timeout']],
    ['negative value', ['--stdin', '--lock-timeout', '-1']],
    ['decimal value', ['--stdin', '--lock-timeout', '1.5']],
    ['non-numeric value', ['--stdin', '--lock-timeout', 'abc']],
  ])('--lock-timeout %s is ARG_INVALID with exit 2', (_caseName, args) => {
    const result = run(target(`invalid-${_caseName}.json`), args, '{"value":1}');

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('✗ [ARG_INVALID]');
    expect(result.stdout).toContain('ERROR_JSON ');
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

  it('--recover-stale-lock recovers a stale owner and writes successfully', async () => {
    const p = target('stale-lock.json');
    await writeLock(p, {
      targetPath: p,
      pid: process.pid,
      token: 'old-live-owner',
      createdAt: '2000-01-01T00:00:00.000Z',
      operation: 'wm-write',
    });

    const result = run(p, ['--stdin', '--recover-stale-lock', '--lock-timeout', '1000'], '{"value":"recovered"}');

    expect(result.code).toBe(0);
    expect(wmwriteSummary(result.stdout)).toMatchObject({ script: 'wm-write.ts', ok: true, writtenPath: p });
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"value":"recovered"}');
  });
});

describe('wm-write CLI existing contract', () => {
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
