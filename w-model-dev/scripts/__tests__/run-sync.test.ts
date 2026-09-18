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
      // Skip transient fixtures written by parallel tests (e.g. dependency-boundaries'
      // .d2-boundary-fixture-<pid>.ts) to avoid racing their write/remove lifecycle.
      if (entry.name.startsWith('.d2-')) return [];
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

/**
 * 锚定位（2026-09-18 任务 3.5）：返回锚在该文件全文的出现次数与命中行号（升序）。
 *
 * 台账用**锚**取代行号——行号是位置（上方插行即全体漂移，实测三次回填），锚是内容寻址。
 * 同一文件内多条**字面相同**的调用无法用单行唯一锚区分（如 coverage-logic 的三条 execSync、
 * check-tla-model 的两条 java 探针），此时台账须为每个命中行各登记一条：由
 * 「occurrences ≥ 1」「命中行数 == 同锚条目数」「命中行集合 == AST 调用行集合」三重对账兜住，
 * 新增一条字面相同的调用而漏登记时，命中行数会大于同锚条目数而立刻转红。
 */
function locateAnchor(source: string, anchor: string): { occurrences: number; lines: number[] } {
  const occurrences = anchor === '' ? 0 : source.split(anchor).length - 1;
  const lines = source
    .split('\n')
    .map((line, index) => (line.includes(anchor) ? index + 1 : 0))
    .filter((line) => line !== 0);
  return { occurrences, lines };
}

it('skips dot-prefixed transient fixtures created by parallel tests', async () => {
  const transient = path.join(SCRIPT_ROOT, 'logic', `.d2-boundary-fixture-${process.pid}-probe.ts`);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is repository-controlled
  await fs.writeFile(transient, "import 'fs';\n");
  try {
    const files = await collectTypeScriptFiles(SCRIPT_ROOT);
    expect(files.some((file) => file === transient)).toBe(false);
  } finally {
    await fs.rm(transient, { force: true });
  }
});

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

    expect(docsSource).toMatch(
      /runSync\(\s*'git',\s*\['-c',\s*'core\.quotePath=false',\s*'diff',\s*'--name-only',\s*'HEAD'\],\s*\{[\s\S]*?timeout\s*:\s*15_000/,
    );
    expect(docsSource).toMatch(/runSync\('git', \['status', '--porcelain'\], \{[\s\S]*?timeout\s*:\s*15_000/);
    expect(docsSource).toMatch(/diff\.error === undefined && diff\.status === 0/);
    expect(docsSource).toMatch(/status\.error === undefined && status\.status === 0/);
    expect(tlaSource).toMatch(/runSync\('java', \['-version'\], \{[\s\S]*?timeout\s*:\s*EXEC_LIMITS\.shortTimeoutMs/);
    expect(tlaSource).toMatch(/if \(res\.error\)[\s\S]*?else if \(res\.status !== 0\)/);
    expect(tlaSource).toMatch(/if \(res\.error \|\| res\.status !== 0 \|\| major === null\)/);
    expect(tlaSource).toMatch(/const major = res\.error \|\| res\.status !== 0 \? null : parseJavaMajor/);
    expect(securitySource).toMatch(/const r = runSync\([\s\S]*?timeout\s*:\s*300_000[\s\S]*?maxBuffer\s*:/);
    expect(securitySource).toMatch(/if \(r\.error \|\| \(r\.status !== 0 && !r\.stdout\)\)/);

    // 复刻 Node spawnSync 的失败契约（run-sync.ts 是 spawnSync 的薄封装，逐字段透传）：
    // spawn 失败 / 超时 → status 为 null 且 error 携带 code；数字 status 只出现在子进程
    // 真实运行后退出的场景，此时 error 为 undefined。故二者不同时出现。
    for (const result of [
      { status: null, error: Object.assign(new Error('git timed out'), { code: 'ETIMEDOUT' }) },
      { status: null, error: Object.assign(new Error('git unavailable'), { code: 'ENOENT' }) },
    ]) {
      spawnSyncMock.mockReset();
      spawnSyncMock.mockReturnValue({ stdout: '', stderr: '', ...result });
      expect(detectScriptsChanges('C:/fixture')).toBe(false);
      expect(spawnSyncMock).toHaveBeenCalledTimes(2);
      expect(spawnSyncMock).toHaveBeenNthCalledWith(
        1,
        'git',
        ['-c', 'core.quotePath=false', 'diff', '--name-only', 'HEAD'],
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

  it('retains anchor-accurate provenance for calls migrated through runSync', async () => {
    const migratedEntries = SYNC_PROCESS_EXCEPTIONS.filter((entry) => entry.migratedToRunSync === true);
    expect(migratedEntries).not.toHaveLength(0);

    for (const entry of migratedEntries) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- manifest paths are repository-controlled
      const source = await fs.readFile(path.join(SCRIPT_ROOT, entry.file), 'utf-8');
      const located = locateAnchor(source, entry.anchor);
      const peers = migratedEntries.filter((peer) => peer.file === entry.file && peer.anchor === entry.anchor);
      const label = `${entry.file}#${entry.anchor}`;
      expect(located.occurrences, label).toBeGreaterThanOrEqual(1);
      // 命中行数须等于共用该锚的台账条目数：字面相同的调用被完整枚举，不靠位置区分
      expect(located.lines, label).toHaveLength(peers.length);
      const sourceLines = source.split('\n');
      for (const line of located.lines) {
        expect(sourceLines[line - 1], label).toContain('runSync');
      }
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
    expect(directExceptions).toHaveLength(directCalls.length);

    const loadLines = async (file: string): Promise<string[]> =>
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- file 取自本测试对仓库源码扫描得到的受控文件集合（SCRIPT_ROOT 下相对名），只读审计用途
      (await fs.readFile(path.join(SCRIPT_ROOT, file), 'utf-8')).split('\n');

    // 逐 (file, api) 分组对账：台账锚的命中行集合 == AST 扫描出的真实调用行集合（行号不再入库）
    const keys = new Set<string>();
    for (const call of directCalls) keys.add(`${call.file}|${call.api}`);
    for (const entry of directExceptions) keys.add(`${entry.file}|${entry.api}`);

    for (const key of [...keys].sort()) {
      const [file, api] = key.split('|') as [string, string];
      const calls = directCalls.filter((call) => call.file === file && call.api === api);
      const entries = directExceptions.filter((entry) => entry.file === file && entry.api === api);
      expect(entries, `${key} 台账条目数须等于真实调用数`).toHaveLength(calls.length);

      const lines = await loadLines(file);
      const source = lines.join('\n');
      const anchoredLines = new Set<number>();
      for (const entry of entries) {
        const located = locateAnchor(source, entry.anchor);
        const label = `${entry.file}#${entry.anchor} ${entry.api}`;
        expect(located.occurrences, `${label} 锚须命中`).toBeGreaterThanOrEqual(1);
        for (const line of located.lines) anchoredLines.add(line);
        expect(entry.symbol).not.toBe('');
        expect(entry.reason).not.toBe('');

        const optionBlock = lines.slice(located.lines[0]! - 1, located.lines[0]! + 20).join('\n');
        const hasExplicitTimeout = /timeout\s*:/.test(optionBlock);
        expect(entry.timeout.required).toBe(true);
        expect(entry.timeout.status, label).toBe(hasExplicitTimeout ? 'present' : 'missing-followup');
      }
      expect(
        [...anchoredLines].sort((a, b) => a - b),
        `${key} 锚命中行须与真实调用行一一对应`,
      ).toEqual(calls.map((call) => call.line).sort((a, b) => a - b));
    }

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
    const timeoutMs = 250;
    const startedAt = Date.now();
    const result = runRealSync(process.execPath, ['-e', 'setTimeout(() => {}, 5_000)'], { timeout: timeoutMs });
    const elapsedMs = Date.now() - startedAt;

    expect((result.error as NodeJS.ErrnoException | undefined)?.code).toBe('ETIMEDOUT');
    // Relative window instead of a hard wall-clock bound (F-G8-06): slow or
    // loaded CI only widens the elapsed time, it must not flip the verdict.
    expect(elapsedMs).toBeGreaterThanOrEqual(timeoutMs - 20); // timeout:250 → 下限 230
    expect(elapsedMs).toBeLessThan(timeoutMs + 2_000);
  });
});
