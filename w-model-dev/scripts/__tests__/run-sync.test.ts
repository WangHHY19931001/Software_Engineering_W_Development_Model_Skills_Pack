import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { execFileMock, spawnSyncMock } = vi.hoisted(() => ({ execFileMock: vi.fn(), spawnSyncMock: vi.fn() }));
vi.mock('node:child_process', () => ({ execFile: execFileMock, spawnSync: spawnSyncMock }));

import {
  auditSynchronousChildProcessSource,
  DEFAULT_SYNC_MAX_BUFFER,
  DEFAULT_SYNC_TIMEOUT_MS,
  runSync,
  SYNC_PROCESS_EXCEPTIONS,
  type RunSyncOptions,
} from '../lib/run-sync.js';
import { detectScriptsChanges } from '../cli/check-docs-consistency.js';
import { checkEnvironment } from '../cli/check-tla-model.js';
import { main as securityScanMain } from '../cli/security-scan.js';

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUN_SYNC_FILE = 'lib/run-sync.ts';

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

async function findDirectSyncCalls() {
  const calls: Array<{ api: string; file: string; line: number }> = [];
  const violations: Array<{ file: string; line: number; message: string }> = [];
  for (const absolutePath of await collectTypeScriptFiles(SCRIPT_ROOT)) {
    const file = path.relative(SCRIPT_ROOT, absolutePath).replaceAll(path.sep, '/');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- repository-controlled TypeScript path
    const source = await fs.readFile(absolutePath, 'utf-8');
    const audit = auditSynchronousChildProcessSource(source, file);
    calls.push(...audit.calls);
    violations.push(...audit.violations);
  }
  return { calls, violations };
}

type ConsoleSpy = {
  mock: { calls: unknown[][] };
  mockClear: () => void;
  mockRestore: () => void;
};

function extractErrorJson(logSpy: ConsoleSpy): Record<string, unknown>[] {
  return logSpy.mock.calls
    .map(([value]) => String(value))
    .filter((value: string) => value.startsWith('ERROR_JSON '))
    .map((value: string) => JSON.parse(value.slice('ERROR_JSON '.length)) as Record<string, unknown>);
}

describe('runSync', () => {
  let errorSpy: ConsoleSpy;
  let logSpy: ConsoleSpy;
  let previousExitCode: typeof process.exitCode;

  beforeEach(() => {
    spawnSyncMock.mockReset();
    previousExitCode = process.exitCode;
    process.exitCode = undefined;
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    logSpy.mockRestore();
    process.exitCode = previousExitCode;
  });
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

  it('preserves nonzero exit status and child-process errors for callers to observe', () => {
    const error = Object.assign(new Error('git unavailable'), { code: 'ENOENT' });
    spawnSyncMock.mockReturnValue({ status: 1, stdout: '', stderr: 'failed', error });

    const result = runSync('git', ['status']);

    expect(result.status).toBe(1);
    expect(result.stderr).toBe('failed');
    expect(result.error).toBe(error);
  });

  it('requires affected production probes to use bounded runSync calls', async () => {
    const sources = await Promise.all(
      ['cli/check-docs-consistency.ts', 'cli/check-tla-model.ts', 'cli/security-scan.ts'].map(async (file) => {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- file is a fixed repository-relative audit target
        return [file, await fs.readFile(path.join(SCRIPT_ROOT, file), 'utf-8')] as const;
      }),
    );
    const sourceByFile = new Map(sources);
    const docsSource = sourceByFile.get('cli/check-docs-consistency.ts')!;
    const tlaSource = sourceByFile.get('cli/check-tla-model.ts')!;
    const securitySource = sourceByFile.get('cli/security-scan.ts')!;

    expect(docsSource).toMatch(/runSync\('git', \['diff', '--name-only', 'HEAD'\], \{[\s\S]*?timeout\s*:\s*15_000/);
    expect(docsSource).toMatch(/runSync\('git', \['status', '--porcelain'\], \{[\s\S]*?timeout\s*:\s*15_000/);
    expect(docsSource).toMatch(/diff\.error === undefined && diff\.status === 0/);
    expect(docsSource).toMatch(/status\.error === undefined && status\.status === 0/);
    expect(tlaSource).toMatch(/runSync\('java', \['-version'\], \{[\s\S]*?timeout\s*:\s*EXEC_LIMITS\.shortTimeoutMs/);
    expect(tlaSource).toMatch(/if \(res\.error\)[\s\S]*?else if \(res\.status !== 0\)/);
    expect(tlaSource).toMatch(/if \(res\.error \|\| res\.status !== 0 \|\| major === null\)/);
    expect(tlaSource).toMatch(/const major = res\.error \|\| res\.status !== 0 \? null : parseJavaMajor/);
    expect(securitySource).toMatch(/const r = runSync\([\s\S]*?timeout\s*:\s*300_000[\s\S]*?maxBuffer\s*:/);
    expect(securitySource).toMatch(/if \(r\.error \|\| \(r\.status !== 0 && !r\.stdout\)\)/);

    for (const result of [
      { status: null, error: Object.assign(new Error('git timed out'), { code: 'ETIMEDOUT' }) },
      { status: 1, error: Object.assign(new Error('git unavailable'), { code: 'ENOENT' }) },
    ]) {
      spawnSyncMock.mockReset();
      spawnSyncMock.mockReturnValue({ stdout: '', stderr: '', ...result });
      expect(detectScriptsChanges('C:/fixture')).toBe(false);
      expect(spawnSyncMock).toHaveBeenCalledTimes(2);
      expect(spawnSyncMock).toHaveBeenNthCalledWith(
        1,
        'git',
        ['diff', '--name-only', 'HEAD'],
        expect.objectContaining({ cwd: 'C:/fixture', timeout: 15_000 }),
      );
      expect(spawnSyncMock).toHaveBeenNthCalledWith(
        2,
        'git',
        ['status', '--porcelain'],
        expect.objectContaining({ cwd: 'C:/fixture', timeout: 15_000 }),
      );
    }

    spawnSyncMock.mockReset();
    spawnSyncMock.mockReturnValue({ status: 128, stdout: 'w-model-dev/scripts/changed.ts\\n', stderr: 'fatal' });
    expect(detectScriptsChanges('C:/fixture')).toBe(false);

    const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-sync-runtime-'));
    const jarPath = path.join(fixtureRoot, 'tla2tools.jar');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- jarPath is beneath the test-owned mkdtemp fixture root
    await fs.writeFile(jarPath, 'fixture');
    try {
      for (const result of [
        {
          status: null,
          error: Object.assign(new Error('java timed out'), { code: 'ETIMEDOUT' }),
          stdout: '',
          stderr: '',
        },
        {
          status: null,
          error: Object.assign(new Error('java unavailable'), { code: 'ENOENT' }),
          stdout: '',
          stderr: '',
        },
        { status: 1, error: undefined, stdout: '', stderr: 'java -version failed' },
      ]) {
        spawnSyncMock.mockReset();
        spawnSyncMock.mockReturnValue(result);
        const environment = await checkEnvironment(jarPath, 17);
        expect(environment.ok).toBe(false);
        expect(environment.javaVersion).toBeNull();
        expect(environment.errors.length).toBeGreaterThan(0);
        if (result.error) expect(environment.errors.join('\\n')).toContain(result.error.message);
        if (result.status !== null && result.status !== 0) expect(environment.errors.join('\\n')).toContain('退出码 1');
        expect(spawnSyncMock).toHaveBeenCalledWith(
          'java',
          ['-version'],
          expect.objectContaining({ timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'] }),
        );
      }
    } finally {
      await fs.rm(fixtureRoot, { recursive: true, force: true });
    }

    for (const result of [
      {
        status: null,
        stdout: '',
        stderr: 'eslint timed out',
        error: Object.assign(new Error('eslint timed out'), { code: 'ETIMEDOUT' }),
        category: 'FILE_READ',
      },
      { status: 1, stdout: '', stderr: 'eslint failed', error: undefined, category: 'FILE_READ' },
      { status: 1, stdout: '{not-json', stderr: 'eslint warning', error: undefined, category: 'FILE_PARSE' },
    ]) {
      spawnSyncMock.mockReset();
      spawnSyncMock.mockReturnValue(result);
      logSpy.mockClear();
      errorSpy.mockClear();
      process.exitCode = undefined;
      await securityScanMain();
      expect(process.exitCode).toBe(2);
      expect(extractErrorJson(logSpy)).toEqual([
        expect.objectContaining({ category: result.category, rule: 'P0-3', exitCode: 2 }),
      ]);
      expect(spawnSyncMock).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['eslint', '--format', 'json']),
        expect.objectContaining({ timeout: 300_000, maxBuffer: 10 * 1024 * 1024 }),
      );
    }
  });

  it('keeps production direct child-process calls fully bounded and observable', async () => {
    const sources = new Map(
      await Promise.all(
        ['cli/check-tla-model.ts', 'cli/ensure-codegraph-opsx.ts'].map(async (file) => {
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- file is a fixed repository-relative audit target
          return [file, await fs.readFile(path.join(SCRIPT_ROOT, file), 'utf-8')] as const;
        }),
      ),
    );
    const audit = await findDirectSyncCalls();
    const productionCalls = audit.calls.filter((call) => call.file.startsWith('cli/'));

    for (const call of productionCalls) {
      const source = sources.get(call.file);
      expect(source, call.file).toBeDefined();
      const optionBlock = source!
        .split('\n')
        .slice(call.line - 1, call.line + 20)
        .join('\n');
      expect(optionBlock, `${call.file}:${call.line} timeout`).toMatch(/timeout\s*:/);
      expect(optionBlock, `${call.file}:${call.line} killSignal`).toMatch(/killSignal\s*:\s*['"]SIGKILL['"]/);
      expect(optionBlock, `${call.file}:${call.line} encoding`).toMatch(/encoding\s*:\s*['"]utf-8['"]/);
      expect(optionBlock, `${call.file}:${call.line} maxBuffer`).toMatch(/maxBuffer\s*:/);
    }
  });

  it('keeps the centralized direct-call manifest free of unresolved timeout follow-ups', () => {
    expect(SYNC_PROCESS_EXCEPTIONS.filter((entry) => entry.timeout.status === 'missing-followup')).toEqual([]);
  });

  it('retains line-accurate provenance for calls migrated through runSync', async () => {
    const migratedEntries = SYNC_PROCESS_EXCEPTIONS.filter((entry) => entry.migratedToRunSync === true);
    expect(migratedEntries).not.toHaveLength(0);

    for (const entry of migratedEntries) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- manifest paths are repository-controlled
      const source = await fs.readFile(path.join(SCRIPT_ROOT, entry.file), 'utf-8');
      const sourceLine = source.split('\n')[entry.line - 1] ?? '';
      expect(sourceLine, `${entry.file}:${entry.line}`).toContain('runSync');
      expect(entry.timeout.status).toBe('present');
    }
  });

  it('resolves direct aliases, namespace properties, static element access, and destructured aliases with the TypeScript AST', () => {
    const source = [
      "import { spawnSync as runChild, execSync } from 'node:child_process';",
      "import * as childProcess from 'node:child_process';",
      "runChild('node', []);",
      "execSync('node -v');",
      "childProcess.execFileSync('node', []);",
      "childProcess['spawnSync']('node', []);",
      'const { execSync: destructuredExec } = childProcess;',
      "destructuredExec('node -v');",
    ].join('\n');

    expect(auditSynchronousChildProcessSource(source, 'fixtures/aliases.ts')).toEqual({
      calls: [
        { api: 'spawnSync', file: 'fixtures/aliases.ts', line: 3 },
        { api: 'execSync', file: 'fixtures/aliases.ts', line: 4 },
        { api: 'execFileSync', file: 'fixtures/aliases.ts', line: 5 },
        { api: 'spawnSync', file: 'fixtures/aliases.ts', line: 6 },
        { api: 'execSync', file: 'fixtures/aliases.ts', line: 8 },
      ],
      violations: [],
    });
  });

  it('reports non-literal namespace property access rather than silently skipping it', () => {
    const source = [
      "import * as childProcess from 'node:child_process';",
      'const operation = process.argv[2];',
      "childProcess[operation]('node', []);",
    ].join('\n');

    expect(auditSynchronousChildProcessSource(source, 'fixtures/dynamic.ts')).toEqual({
      calls: [],
      violations: [
        {
          file: 'fixtures/dynamic.ts',
          line: 3,
          message: 'dynamic child_process property access cannot be safely audited',
        },
      ],
    });
  });

  it('audits every direct synchronous child-process call against the centralized exception manifest', async () => {
    const audit = await findDirectSyncCalls();
    expect(audit.violations).toEqual([]);
    const directCalls = audit.calls.filter((call) => !(call.file === RUN_SYNC_FILE && call.api === 'spawnSync'));
    expect(directCalls).not.toHaveLength(0);
    expect(audit.calls.filter((call) => call.file === RUN_SYNC_FILE && call.api === 'spawnSync')).toHaveLength(1);

    const directExceptions = SYNC_PROCESS_EXCEPTIONS.filter((candidate) => candidate.migratedToRunSync !== true);
    const remainingExceptions = [...directExceptions];
    for (const call of directCalls) {
      const exceptionIndex = remainingExceptions.findIndex(
        (candidate) => candidate.api === call.api && candidate.file === call.file,
      );
      expect(exceptionIndex, `${call.file}:${call.line} ${call.api} must be reviewed`).toBeGreaterThanOrEqual(0);
      const [exception] = remainingExceptions.splice(exceptionIndex, 1);
      expect(exception?.line).toBe(call.line);
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
      expect(exception?.timeout.status, `${call.file}:${call.line} ${call.api}`).toBe(
        hasExplicitTimeout ? 'present' : 'missing-followup',
      );
    }

    expect(remainingExceptions).toHaveLength(0);
    expect(SYNC_PROCESS_EXCEPTIONS.filter((entry) => entry.migratedToRunSync !== true)).toHaveLength(
      directCalls.length,
    );
    expect(SYNC_PROCESS_EXCEPTIONS.filter((entry) => entry.migratedToRunSync === true)).not.toHaveLength(0);
    expect(
      SYNC_PROCESS_EXCEPTIONS.filter((entry) => entry.migratedToRunSync === true).every(
        (entry) => entry.timeout.status === 'present',
      ),
    ).toBe(true);
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
