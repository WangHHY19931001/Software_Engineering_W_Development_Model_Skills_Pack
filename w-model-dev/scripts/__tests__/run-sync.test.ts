import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

const { spawnSyncMock } = vi.hoisted(() => ({ spawnSyncMock: vi.fn() }));
vi.mock('node:child_process', () => ({ spawnSync: spawnSyncMock }));

import {
  DEFAULT_SYNC_MAX_BUFFER,
  DEFAULT_SYNC_TIMEOUT_MS,
  runSync,
  SYNC_PROCESS_EXCEPTIONS,
  type RunSyncOptions,
} from '../lib/run-sync.js';

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUN_SYNC_FILE = 'lib/run-sync.ts';
const DIRECT_SYNC_APIS = /\b(spawnSync|execSync|execFileSync)\s*\(/g;

interface DirectSyncCall {
  api: 'spawnSync' | 'execSync' | 'execFileSync';
  file: string;
  line: number;
}

async function collectTypeScriptFiles(directory: string): Promise<string[]> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test starts from repository-controlled scripts root
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectTypeScriptFiles(entryPath);
      return entry.isFile() && entry.name.endsWith('.ts') ? [entryPath] : [];
    }),
  );
  return files.flat();
}

async function findDirectSyncCalls(): Promise<DirectSyncCall[]> {
  const calls: DirectSyncCall[] = [];
  for (const absolutePath of await collectTypeScriptFiles(SCRIPT_ROOT)) {
    const file = path.relative(SCRIPT_ROOT, absolutePath).replaceAll(path.sep, '/');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- repository-controlled TypeScript path
    const source = await fs.readFile(absolutePath, 'utf-8');
    for (const match of source.matchAll(DIRECT_SYNC_APIS)) {
      const api = match[1] as DirectSyncCall['api'];
      if (file === RUN_SYNC_FILE && api === 'spawnSync') continue;
      calls.push({
        api,
        file,
        line: source.slice(0, match.index).split('\n').length,
      });
    }
  }
  return calls;
}

describe('runSync', () => {
  it('passes default timeout, kill signal, encoding, and buffer bounds to spawnSync', () => {
    spawnSyncMock.mockReturnValue({ status: 0, stdout: 'ready' });

    const result = runSync('node', ['-e', "process.stdout.write('ready')"]);

    expect(result).toMatchObject({ status: 0, stdout: 'ready' });
    expect(spawnSyncMock).toHaveBeenCalledWith('node', ['-e', "process.stdout.write('ready')"], {
      timeout: DEFAULT_SYNC_TIMEOUT_MS,
      killSignal: 'SIGKILL',
      encoding: 'utf-8',
      maxBuffer: DEFAULT_SYNC_MAX_BUFFER,
    });
  });

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY])(
    'falls back to the default timeout for invalid value %s',
    (timeout) => {
      spawnSyncMock.mockReturnValue({ status: 0, stdout: '' });

      runSync('node', [], { timeout });

      expect(spawnSyncMock).toHaveBeenLastCalledWith(
        'node',
        [],
        expect.objectContaining({ timeout: DEFAULT_SYNC_TIMEOUT_MS }),
      );
    },
  );

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY])(
    'falls back to the default maxBuffer for invalid value %s',
    (maxBuffer) => {
      spawnSyncMock.mockReturnValue({ status: 0, stdout: '' });

      runSync('node', [], { maxBuffer });

      expect(spawnSyncMock).toHaveBeenLastCalledWith(
        'node',
        [],
        expect.objectContaining({ maxBuffer: DEFAULT_SYNC_MAX_BUFFER }),
      );
    },
  );

  it('preserves safe explicit child-process options while retaining unspecified bounds', () => {
    spawnSyncMock.mockReturnValue({ status: 0, stdout: 'custom' });

    runSync('node', ['-e', "process.stdout.write('custom')"], { cwd: '/tmp', timeout: 500 });

    expect(spawnSyncMock).toHaveBeenCalledWith('node', ['-e', "process.stdout.write('custom')"], {
      timeout: 500,
      killSignal: 'SIGKILL',
      encoding: 'utf-8',
      maxBuffer: DEFAULT_SYNC_MAX_BUFFER,
      cwd: '/tmp',
    });
  });

  it('does not let an unsafe cast override its kill signal or string encoding contract', () => {
    spawnSyncMock.mockReturnValue({ status: 0, stdout: '' });
    const unsafeOptions = {
      killSignal: 'SIGTERM',
      encoding: null,
    } as unknown as RunSyncOptions;

    runSync('node', [], unsafeOptions);

    expect(spawnSyncMock).toHaveBeenLastCalledWith(
      'node',
      [],
      expect.objectContaining({ killSignal: 'SIGKILL', encoding: 'utf-8' }),
    );
  });

  it('audits every direct synchronous child-process call against the centralized exception manifest', async () => {
    const directCalls = await findDirectSyncCalls();
    expect(directCalls).not.toHaveLength(0);

    for (const call of directCalls) {
      const exception = SYNC_PROCESS_EXCEPTIONS.find(
        (candidate) => candidate.api === call.api && candidate.file === call.file && candidate.line === call.line,
      );
      expect(exception, `${call.file}:${call.line} ${call.api} must be reviewed`).toBeDefined();
      expect(exception?.symbol).not.toBe('');
      expect(exception?.reason).not.toBe('');
      expect(exception?.timeout.required).toBe(true);

      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path comes from repository source scan
      const sourceLines = await fs.readFile(path.join(SCRIPT_ROOT, call.file), 'utf-8');
      const optionBlock = sourceLines
        .split('\n')
        .slice(call.line - 1, call.line + 20)
        .join('\n');
      const hasExplicitTimeout = /timeout\s*:/.test(optionBlock);
      expect(exception?.timeout.status).toBe(hasExplicitTimeout ? 'present' : 'missing-followup');
    }

    expect(SYNC_PROCESS_EXCEPTIONS).toHaveLength(directCalls.length);
  });

  it('terminates a real slow child within an explicit short timeout', async () => {
    vi.doUnmock('node:child_process');
    vi.resetModules();
    const { runSync: runRealSync } = await import('../lib/run-sync.js');
    const startedAt = Date.now();
    const result = runRealSync(process.execPath, ['-e', 'setTimeout(() => {}, 5_000)'], { timeout: 250 });
    const elapsedMs = Date.now() - startedAt;

    expect((result.error as NodeJS.ErrnoException | undefined)?.code).toBe('ETIMEDOUT');
    expect(elapsedMs).toBeLessThan(2_000);
  });
});
