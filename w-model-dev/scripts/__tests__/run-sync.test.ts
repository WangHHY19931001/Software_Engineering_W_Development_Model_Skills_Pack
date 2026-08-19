import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

const { spawnSyncMock } = vi.hoisted(() => ({ spawnSyncMock: vi.fn() }));
vi.mock('node:child_process', () => ({ spawnSync: spawnSyncMock }));

import { DEFAULT_SYNC_MAX_BUFFER, DEFAULT_SYNC_TIMEOUT_MS, runSync } from '../lib/run-sync.js';

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTROLLED_SYNC_CALLERS = [
  path.join(SCRIPT_ROOT, 'lib', 'artifact-gate-assets.ts'),
  path.join(SCRIPT_ROOT, '__tests__', 'gate-report.test.ts'),
  path.join(SCRIPT_ROOT, '__tests__', 'metrics-report.test.ts'),
  path.join(SCRIPT_ROOT, '__tests__', 'wm-status.test.ts'),
];

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

  it('preserves explicit child-process options while retaining unspecified bounds', () => {
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

  it('does not allow controlled synchronous callers to bypass runSync', async () => {
    for (const file of CONTROLLED_SYNC_CALLERS) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- repository-controlled source file list
      const source = await fs.readFile(file, 'utf-8');
      expect(source).not.toMatch(/\bspawnSync\s*\(/);
      expect(source).toContain('runSync');
    }
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
