import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, promises as fs, readFileSync, rmSync, symlinkSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const hookSource = path.join(repoRoot, '.githooks', 'pre-commit');
const tempRoots: string[] = [];
let bashRuntimePath: string | undefined;

function fileSymlinkSupport(): string | undefined {
  const probeRoot = mkdtempSync(path.join(os.tmpdir(), 'wm-pre-commit-link-probe-'));
  try {
    symlinkSync(path.join(probeRoot, 'target'), path.join(probeRoot, 'link'), 'file');
    return undefined;
  } catch (error) {
    return `file symlink unavailable: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    rmSync(probeRoot, { recursive: true, force: true });
  }
}

const symlinkUnavailable = fileSymlinkSupport();

function toBashPath(value: string): string {
  const normalized = value.replaceAll('\\', '/');
  if (process.platform !== 'win32' || !/^([A-Za-z]):\//.test(normalized)) return normalized;
  const result = spawnSync(
    'bash',
    [
      '-c',
      `if command -v wslpath >/dev/null 2>&1; then wslpath -a -u ${shellQuote(normalized)}; elif command -v cygpath >/dev/null 2>&1; then cygpath -a -u ${shellQuote(normalized)}; else printf '%s\\n' ${shellQuote(normalized)}; fi`,
    ],
    { encoding: 'utf8', input: '' },
  );
  const converted = String(result.stdout ?? '').trim();
  return result.status === 0 && converted !== '' ? converted : normalized;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function getBashRuntimePath(): string {
  if (bashRuntimePath !== undefined) return bashRuntimePath;
  const result = spawnSync('bash', ['-c', 'printenv PATH'], {
    encoding: 'utf8',
    input: '',
  });
  bashRuntimePath = String(result.stdout ?? '').trim();
  return bashRuntimePath;
}

async function makeFixture(options: { realTypecheck?: boolean } = {}): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wm pre提交 (hook)-'));
  tempRoots.push(root);
  await fs.mkdir(path.join(root, '.githooks'), { recursive: true });
  await fs.mkdir(path.join(root, 'config'), { recursive: true });
  await fs.mkdir(path.join(root, 'node_modules', '.bin'), { recursive: true });
  await fs.mkdir(path.join(root, 'test-bin'), { recursive: true });
  await fs.copyFile(hookSource, path.join(root, '.githooks', 'pre-commit'));
  await fs.writeFile(path.join(root, 'config', 'prettier.config.cjs'), 'module.exports = {};\n', 'utf8');
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({
      private: true,
      scripts: { typecheck: 'node check-type.js' },
    }),
    'utf8',
  );
  await fs.writeFile(
    path.join(root, 'config', 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          strict: true,
          noEmit: true,
        },
        include: ['../src.ts'],
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  await fs.writeFile(
    path.join(root, 'node_modules', '.bin', 'prettier'),
    [
      '#!/usr/bin/env bash',
      'config=""',
      'previous=""',
      'for arg in "$@"; do',
      '  if [ "$previous" = "--config" ]; then config="$arg"; fi',
      '  if [ "$previous" = "--ignore-path" ]; then ignore_path="$arg"; fi',
      '  previous="$arg"',
      'done',
      'if [ "${1-}" = "--version" ]; then printf "fixture-prettier 0.0.0\\n"; exit 0; fi',
      'if [ -z "$config" ] || [ -z "$ignore_path" ] || [ ! -f "$ignore_path" ]; then exit 12; fi',
      'if [ -n "$config" ] && grep -q CONFIG_WORKTREE "$config"; then exit 1; fi',
      'printf "%s|%s|%s\\n" "$PWD" "$config" "$ignore_path" > "$PRECOMMIT_PRETTIER_CAPTURE"',
      'if [ -n "${PRECOMMIT_PRETTIER_DELAY_SECONDS-}" ]; then sleep "$PRECOMMIT_PRETTIER_DELAY_SECONDS"; fi',
      'for arg in "$@"; do',
      '  case "$arg" in',
      '    *.json) grep -q \'"ok":true\' "$arg" && exit 1 ;;',
      '    *src.ts) ',
      '      if grep -qx src.ts "$ignore_path"; then continue; fi',
      '      grep -q INVALID_FORMAT "$arg" && exit 1 ;;',
      '  esac',
      'done',
      'exit 0',
      '',
    ].join('\n'),
    'utf8',
  );
  await fs.chmod(path.join(root, 'node_modules', '.bin', 'prettier'), 0o755);
  const tscPath = path.join(root, 'node_modules', '.bin', 'tsc');
  if (options.realTypecheck) {
    const realTscEntry = toBashPath(path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc'));
    await fs.writeFile(
      tscPath,
      [
        '#!/usr/bin/env bash',
        'config=""',
        'previous=""',
        'for arg in "$@"; do',
        '  if [ "$previous" = "-p" ]; then config="$arg"; fi',
        '  previous="$arg"',
        'done',
        'printf "%s|%s|%s\\n" "$PWD" "$config" "$(node ' +
          shellQuote(realTscEntry) +
          ' --version)" > "$PRECOMMIT_TSC_CAPTURE"',
        'exec node ' + shellQuote(realTscEntry) + ' "$@"',
        '',
      ].join('\n'),
      'utf8',
    );
  } else {
    await fs.writeFile(
      tscPath,
      [
        '#!/usr/bin/env bash',
        'config=""',
        'previous=""',
        'for arg in "$@"; do',
        '  if [ "$previous" = "-p" ]; then config="$arg"; fi',
        '  previous="$arg"',
        'done',
        'if [ "${1-}" = "--version" ]; then printf "Version 0.0.0-fixture\\n"; exit 0; fi',
        'if [ -z "$config" ] || [ ! -f "$config" ]; then exit 12; fi',
        'source="$(dirname "$config")/../src.ts"',
        'printf "%s|%s\\n" "$PWD" "$config" > "$PRECOMMIT_TSC_CAPTURE"',
        'if [ -n "${PRECOMMIT_TSC_DELAY_SECONDS-}" ]; then sleep "$PRECOMMIT_TSC_DELAY_SECONDS"; fi',
        'grep -Eq "^(VALID_STAGED|VALID_WORKTREE)$" "$source"',
        '',
      ].join('\n'),
      'utf8',
    );
  }
  await fs.chmod(tscPath, 0o755);
  await fs.writeFile(
    path.join(root, 'test-bin', 'npx'),
    ['#!/usr/bin/env bash', 'printf "npx preflight invoked\\n" > "$PRECOMMIT_NPX_MARKER"', 'exit 99', ''].join('\n'),
    'utf8',
  );
  await fs.chmod(path.join(root, 'test-bin', 'npx'), 0o755);
  await fs.writeFile(
    path.join(root, 'test-bin', 'npm'),
    ['#!/usr/bin/env bash', 'printf "npm invoked\\n" > "$PRECOMMIT_NPM_MARKER"', 'exit 99', ''].join('\n'),
    'utf8',
  );
  await fs.chmod(path.join(root, 'test-bin', 'npm'), 0o755);
  await fs.writeFile(
    path.join(root, 'check-type.js'),
    [
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      "const source = fs.readFileSync(path.join(process.cwd(), 'src.ts'), 'utf8');",
      "const link = path.join(process.cwd(), 'link.ts');",
      'if (fs.existsSync(link) && fs.lstatSync(link).isSymbolicLink()) process.exit(2);',
      "process.exit(['VALID_STAGED\\n', 'VALID_WORKTREE\\n', 'INVALID_FORMAT\\n'].includes(source) ? 0 : 1);",
    ].join('\n'),
    'utf8',
  );
  return root;
}

function git(root: string, args: string[]): void {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, GIT_INDEX_FILE: undefined },
  });
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
}

function indexHash(indexFile: string): string {
  return createHash('sha256').update(readFileSync(indexFile)).digest('hex');
}

async function temporaryHookDirs(root: string): Promise<string[]> {
  return (await fs.readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.name.startsWith('.pre-commit-snapshot.') || entry.name.startsWith('.pre-commit-blobs.'))
    .map((entry) => entry.name);
}

function readPrettierCapture(root: string): {
  cwd: string;
  config: string;
  ignore: string;
} {
  const [cwd, config, ignore] = readFileSync(path.join(root, 'prettier.capture'), 'utf8').trim().split('|');
  expect(cwd).toBeTruthy();
  expect(config).toBeTruthy();
  expect(ignore).toBeTruthy();
  return { cwd: cwd!, config: config!, ignore: ignore! };
}

function readTscCapture(root: string): {
  cwd: string;
  config: string;
  version?: string;
} {
  const [cwd, config, version] = readFileSync(path.join(root, 'tsc.capture'), 'utf8').trim().split('|');
  expect(cwd).toBeTruthy();
  expect(config).toBeTruthy();
  return {
    cwd: cwd!,
    config: config!,
    ...(version === undefined ? {} : { version }),
  };
}

function gitShow(root: string, spec: string): string {
  const result = spawnSync('git', ['show', spec], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, GIT_INDEX_FILE: undefined },
  });
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  return String(result.stdout);
}

function runHook(
  root: string,
  indexFile: string,
  options: {
    batchPidFile?: string;
    batchResponse?: BatchResponse;
    bashEnv?: string;
    commandTimeoutSeconds?: number;
    prettierDelaySeconds?: number;
    snapshotTimeoutSeconds?: number;
    tscDelaySeconds?: number;
  } = {},
): ReturnType<typeof spawnSync> {
  const hookPath = toBashPath(path.join(root, '.githooks', 'pre-commit'));
  const bashCwd = toBashPath(root);
  const npxMarker = path.join(root, 'npx.marker');
  const npmMarker = path.join(root, 'npm.marker');
  const prettierCapture = path.join(root, 'prettier.capture');
  const tscCapture = path.join(root, 'tsc.capture');
  const command = [
    `export GIT_INDEX_FILE=${shellQuote(toBashPath(indexFile))}`,
    `export PATH=${shellQuote(`${toBashPath(path.join(root, 'test-bin'))}:${getBashRuntimePath()}`)}`,
    `export PRECOMMIT_NPX_MARKER=${shellQuote(toBashPath(npxMarker))}`,
    `export PRECOMMIT_NPM_MARKER=${shellQuote(toBashPath(npmMarker))}`,
    `export PRECOMMIT_PRETTIER_CAPTURE=${shellQuote(toBashPath(prettierCapture))}`,
    `export PRECOMMIT_TSC_CAPTURE=${shellQuote(toBashPath(tscCapture))}`,
    `export PRE_COMMIT_COMMAND_TIMEOUT_SECONDS=${shellQuote(String(options.commandTimeoutSeconds ?? 20))}`,
    `export PRE_COMMIT_SNAPSHOT_TIMEOUT_SECONDS=${shellQuote(String(options.snapshotTimeoutSeconds ?? 45))}`,
    `export PRECOMMIT_PRETTIER_DELAY_SECONDS=${shellQuote(String(options.prettierDelaySeconds ?? ''))}`,
    `export PRECOMMIT_TSC_DELAY_SECONDS=${shellQuote(String(options.tscDelaySeconds ?? ''))}`,
    `export PRECOMMIT_BATCH_RESPONSE=${shellQuote(options.batchResponse ?? 'happy')}`,
    `export PRECOMMIT_BATCH_PID_FILE=${shellQuote(options.batchPidFile === undefined ? '' : toBashPath(options.batchPidFile))}`,
    `cd ${shellQuote(bashCwd)}`,
    options.bashEnv === undefined ? ':' : `source ${shellQuote(toBashPath(options.bashEnv))}`,
    options.bashEnv === undefined ? ':' : 'export -f git 2>/dev/null || true',
    `bash ${shellQuote(hookPath)}`,
  ].join('; ');
  return spawnSync('bash', ['-c', command], {
    cwd: root,
    encoding: 'utf8',
    input: '',
    timeout: 60_000,
    env: { ...process.env },
  });
}

type FakeIndexRecord = { mode: string; object: string; path: string };
type BatchResponse =
  | 'bad-delimiter'
  | 'happy'
  | 'hang'
  | 'malformed-header'
  | 'missing'
  | 'missing-delimiter'
  | 'non-blob'
  | 'short-header'
  | 'short-payload';

async function runWithFakeIndexRecords(
  fixture: { root: string; index: string },
  records: FakeIndexRecord[],
  blob: string,
  options: {
    batchOnly?: boolean;
    batchPidFile?: string;
    batchResponse?: BatchResponse;
    snapshotTimeoutSeconds?: number;
  } = {},
): Promise<ReturnType<typeof spawnSync>> {
  const bashEnv = path.join(fixture.root, 'test-bin', 'fake-git-env.sh');
  const recordArgs = records
    .map(({ mode, object, path: recordPath }) => shellQuote(`${mode} ${object} 0\t${recordPath}`))
    .join(' ');
  const pathArgs = records.map(({ path: recordPath }) => shellQuote(recordPath)).join(' ');
  await fs.writeFile(
    bashEnv,
    [
      'git() {',
      '  case "$*" in',
      `    *'rev-parse --show-toplevel'*) printf '%s\\n' "${'$'}PWD" ;;`,
      `    *'diff --cached --name-only -z'*) printf '%s\\0' ${pathArgs} ;;`,
      `    *'ls-files --stage -z'*) printf '%s\\0' ${recordArgs} ;;`,
      `    *'cat-file --batch'*)
      case "${'$'}{PRECOMMIT_BATCH_RESPONSE-happy}" in
        happy) while IFS= read -r object; do printf '%s blob %s\\n' "${'$'}object" ${blob.length}; printf '%s' ${shellQuote(blob)}; printf '\\n'; done ;;
        missing) IFS= read -r object; printf '%s missing\\n' "${'$'}object"; exit 0 ;;
        non-blob) IFS= read -r object; printf '%s tree 0\\n' "${'$'}object"; exit 0 ;;
        malformed-header) IFS= read -r object; printf '%s blob nope\\n' "${'$'}object"; exit 0 ;;
        short-header) IFS= read -r object; printf '%s blob 7' "${'$'}object"; exit 0 ;;
        short-payload) IFS= read -r object; printf '%s blob 999\\nshort\\n' "${'$'}object"; exit 0 ;;
        missing-delimiter) IFS= read -r object; printf '%s blob %s\\n' "${'$'}object" ${blob.length}; printf '%s' ${shellQuote(blob)}; exit 0 ;;
        bad-delimiter) IFS= read -r object; printf '%s blob %s\\n' "${'$'}object" ${blob.length}; printf '%sX' ${shellQuote(blob)}; exit 0 ;;
        hang) printf '%s\\n' "${'$'}$" > "${'$'}{PRECOMMIT_BATCH_PID_FILE}"; while :; do sleep 1; done ;;
        *) return 88 ;;
      esac
      ;;`,
      options.batchOnly
        ? "    *'cat-file blob'*) return 91 ;;"
        : `    *'cat-file blob'*) printf '%s' ${shellQuote(blob)} ;;`,
      '    *) return 1 ;;',
      '  esac',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  return runHook(fixture.root, fixture.index, {
    bashEnv,
    batchPidFile: options.batchPidFile,
    batchResponse: options.batchResponse ?? (options.batchOnly ? 'happy' : 'happy'),
    snapshotTimeoutSeconds: options.snapshotTimeoutSeconds,
  });
}

async function initFixture(
  source: string,
  options: { realTypecheck?: boolean } = {},
): Promise<{ root: string; index: string; worktree: string }> {
  const root = await makeFixture(options);
  const index = path.join(root, '.git', 'index');
  await fs.writeFile(path.join(root, 'src.ts'), source, 'utf8');
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.invalid']);
  git(root, ['config', 'user.name', 'Test']);
  git(root, ['add', '.']);
  git(root, ['-c', 'commit.gpgSign=false', 'commit', '-q', '--no-verify', '--no-gpg-sign', '-m', 'base']);
  return { root, index, worktree: path.join(root, 'src.ts') };
}

async function removeWithRetry(root: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await fs.rm(root, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map(removeWithRetry));
});

describe('pre-commit staged snapshot', () => {
  it('passes when staged JSON is formatted and the worktree copy is not', async () => {
    const fixture = await initFixture('BASELINE\n');
    await fs.writeFile(fixture.worktree, 'VALID_STAGED\n', 'utf8');
    git(fixture.root, ['add', 'src.ts']);
    const file = path.join(fixture.root, 'fixture.json');
    await fs.writeFile(file, '{\n  "ok": true\n}\n', 'utf8');
    git(fixture.root, ['add', 'fixture.json']);
    await fs.writeFile(file, '{"ok":true}\n', 'utf8');

    const result = runHook(fixture.root, fixture.index);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const prettier = readPrettierCapture(fixture.root);
    expect(prettier.config).toBe(`${prettier.cwd}/config/prettier.config.cjs`);
    expect(prettier.ignore).toBe(`${prettier.cwd}/.prettierignore`);
    const tsc = readTscCapture(fixture.root);
    expect(tsc.config).toBe(`${tsc.cwd}/config/tsconfig.json`);
    expect(tsc.cwd).toMatch(/\.pre-commit-snapshot\.[^/]+$/);
    expect(await fs.readFile(file, 'utf8')).toBe('{"ok":true}\n');
    expect(await fs.readFile(path.join(fixture.root, '.git', 'index'))).toBeTruthy();
    expect(await temporaryHookDirs(fixture.root)).toEqual([]);
  });

  it('uses the local Prettier entrypoint without an npx preflight', async () => {
    const fixture = await initFixture('VALID_STAGED\n');

    const result = runHook(fixture.root, fixture.index);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(existsSync(path.join(fixture.root, 'npx.marker'))).toBe(false);
    expect(await temporaryHookDirs(fixture.root)).toEqual([]);
  });

  it('uses a repository-local tsc with the staged snapshot config and not npm discovery', async () => {
    const stagedSource = "export const stagedValue: string = 'VALID_STAGED';\n";
    const fixture = await initFixture("export const stagedValue: string = 'BASELINE';\n", {
      realTypecheck: true,
    });
    await fs.writeFile(fixture.worktree, stagedSource, 'utf8');
    git(fixture.root, ['add', 'src.ts']);
    const beforeHash = indexHash(fixture.index);
    const worktreeSource = 'export const stagedValue: string = ;\n';
    await fs.writeFile(fixture.worktree, worktreeSource, 'utf8');
    await fs.writeFile(path.join(fixture.root, 'config', 'tsconfig.json'), '{ invalid worktree config\n', 'utf8');

    const result = runHook(fixture.root, fixture.index);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const tsc = readTscCapture(fixture.root);
    expect(tsc.cwd).toMatch(/\.pre-commit-snapshot\.[^/]+$/);
    expect(tsc.config).toBe(`${tsc.cwd}/config/tsconfig.json`);
    expect(tsc.version).toMatch(/^Version \d+\.\d+\.\d+$/);
    expect(existsSync(path.join(fixture.root, 'npm.marker'))).toBe(false);
    expect(await fs.readFile(fixture.worktree, 'utf8')).toBe(worktreeSource);
    expect(indexHash(fixture.index)).toBe(beforeHash);
    expect(gitShow(fixture.root, ':src.ts')).toBe(stagedSource);
    expect(await temporaryHookDirs(fixture.root)).toEqual([]);
  });

  it('passes when staged content is valid and the worktree copy is invalid', async () => {
    const fixture = await initFixture('VALID_STAGED\n');
    await fs.writeFile(fixture.worktree, 'VALID_STAGED\n', 'utf8');
    git(fixture.root, ['add', 'src.ts']);
    const beforeHash = indexHash(fixture.index);
    await fs.writeFile(fixture.worktree, 'INVALID_WORKTREE\n', 'utf8');

    const result = runHook(fixture.root, fixture.index);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(await fs.readFile(fixture.worktree, 'utf8')).toBe('INVALID_WORKTREE\n');
    expect(indexHash(fixture.index)).toBe(beforeHash);
    expect(gitShow(fixture.root, ':src.ts')).toBe('VALID_STAGED\n');
    expect(existsSync(fixture.index)).toBe(true);
    expect(await temporaryHookDirs(fixture.root)).toEqual([]);
    expect(result.stderr).not.toContain('exit127');
    expect(result.stderr).not.toContain('EBUSY');
  });

  it('fails when staged content is invalid and the worktree copy is valid', async () => {
    const fixture = await initFixture('VALID_WORKTREE\n');
    await fs.writeFile(fixture.worktree, 'INVALID_STAGED\n', 'utf8');
    git(fixture.root, ['add', 'src.ts']);
    const beforeHash = indexHash(fixture.index);
    await fs.writeFile(fixture.worktree, 'VALID_WORKTREE\n', 'utf8');

    const result = runHook(fixture.root, fixture.index);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(await fs.readFile(fixture.worktree, 'utf8')).toBe('VALID_WORKTREE\n');
    expect(indexHash(fixture.index)).toBe(beforeHash);
    expect(gitShow(fixture.root, ':src.ts')).toBe('INVALID_STAGED\n');
    expect(existsSync(fixture.index)).toBe(true);
    expect(await temporaryHookDirs(fixture.root)).toEqual([]);
  });

  it('materializes a staged external symlink as a safe ordinary snapshot file', async (context) => {
    if (symlinkUnavailable !== undefined) {
      context.skip(`explicitly skipped: ${symlinkUnavailable}`);
      return;
    }

    const fixture = await initFixture('VALID_STAGED\n');
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-pre-commit-sentinel-'));
    tempRoots.push(outside);
    const sentinel = path.join(outside, 'sentinel.txt');
    const link = path.join(fixture.root, 'link.ts');
    await fs.writeFile(sentinel, 'DO NOT TOUCH\n', 'utf8');
    await fs.symlink(sentinel, link, 'file');
    git(fixture.root, ['add', 'link.ts']);
    const stagedLink = spawnSync('git', ['ls-files', '--stage', '--', 'link.ts'], {
      cwd: fixture.root,
      encoding: 'utf8',
      timeout: 30_000,
      env: { ...process.env, GIT_INDEX_FILE: undefined },
    });
    if (stagedLink.status !== 0 || !/^120000\s/.test(String(stagedLink.stdout))) {
      context.skip('explicitly skipped: Git did not preserve the fixture as a staged symlink (mode 120000)');
      return;
    }
    const beforeHash = indexHash(fixture.index);

    const result = runHook(fixture.root, fixture.index);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(await fs.readFile(sentinel, 'utf8')).toBe('DO NOT TOUCH\n');
    expect((await fs.lstat(link)).isSymbolicLink()).toBe(true);
    expect(gitShow(fixture.root, ':link.ts')).toBe(sentinel.replaceAll('\\', '/'));
    expect(indexHash(fixture.index)).toBe(beforeHash);
    expect(await temporaryHookDirs(fixture.root)).toEqual([]);
  });

  it('uses the staged Prettier config instead of a polluted worktree config', async () => {
    const fixture = await initFixture('VALID_STAGED\n');
    await fs.writeFile(path.join(fixture.root, 'config', 'prettier.config.cjs'), 'CONFIG_STAGED\n', 'utf8');
    git(fixture.root, ['add', 'config/prettier.config.cjs']);
    await fs.writeFile(path.join(fixture.root, 'config', 'prettier.config.cjs'), 'CONFIG_WORKTREE\n', 'utf8');

    const result = runHook(fixture.root, fixture.index);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const prettier = readPrettierCapture(fixture.root);
    expect(prettier.config).toBe(`${prettier.cwd}/config/prettier.config.cjs`);
    expect(prettier.ignore).toBe(`${prettier.cwd}/.prettierignore`);
    expect(await temporaryHookDirs(fixture.root)).toEqual([]);
  });

  it('uses the staged Prettier ignore file instead of a polluted worktree ignore file', async () => {
    const fixture = await initFixture('VALID_STAGED\n');
    await fs.writeFile(path.join(fixture.root, '.prettierignore'), '\n', 'utf8');
    await fs.writeFile(path.join(fixture.root, 'src.ts'), 'INVALID_FORMAT\n', 'utf8');
    git(fixture.root, ['add', '.prettierignore', 'src.ts']);
    await fs.writeFile(path.join(fixture.root, '.prettierignore'), 'source.ts\n', 'utf8');

    const result = runHook(fixture.root, fixture.index);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(await fs.readFile(path.join(fixture.root, 'src.ts'), 'utf8')).toBe('INVALID_FORMAT\n');
    expect(gitShow(fixture.root, ':src.ts')).toBe('INVALID_FORMAT\n');
    expect(await temporaryHookDirs(fixture.root)).toEqual([]);
    const prettier = readPrettierCapture(fixture.root);
    expect(prettier.config).toBe(`${prettier.cwd}/config/prettier.config.cjs`);
    expect(prettier.ignore).toBe(`${prettier.cwd}/.prettierignore`);
  });

  it('bounds a hanging Prettier check, reports its phase, and cleans the snapshot', async () => {
    const fixture = await initFixture('VALID_STAGED\n');
    const prettierTarget = path.join(fixture.root, 'fixture.json');
    await fs.writeFile(prettierTarget, '{\n  "ok": true\n}\n', 'utf8');
    git(fixture.root, ['add', 'fixture.json']);
    const startedAt = Date.now();
    const result = runHook(fixture.root, fixture.index, {
      commandTimeoutSeconds: 3,
      prettierDelaySeconds: 7,
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(124);
    expect(Date.now() - startedAt).toBeLessThan(12_000);
    expect(result.stderr).toContain('Prettier 检查 index snapshot');
    expect(result.stderr).toContain('超时（3s）');
    expect(await temporaryHookDirs(fixture.root)).toEqual([]);

    const typecheckFixture = await initFixture('BASELINE\n');
    await fs.writeFile(typecheckFixture.worktree, 'VALID_STAGED\n', 'utf8');
    git(typecheckFixture.root, ['add', 'src.ts']);
    const typecheckResult = runHook(typecheckFixture.root, typecheckFixture.index, {
      commandTimeoutSeconds: 3,
      tscDelaySeconds: 7,
    });

    expect(typecheckResult.status, `${typecheckResult.stdout}\n${typecheckResult.stderr}`).toBe(124);
    expect(typecheckResult.stderr).toContain('TypeScript 检查 index snapshot');
    expect(typecheckResult.stderr).toContain('超时（3s）');
    expect(await temporaryHookDirs(typecheckFixture.root)).toEqual([]);
  });

  it.each([
    { batchResponse: 'missing', label: 'missing object', message: '批量读取 index blob 缺失' },
    { batchResponse: 'non-blob', label: 'non-blob response', message: '批量读取 index blob header 类型或 size 非法' },
    {
      batchResponse: 'malformed-header',
      label: 'malformed header',
      message: '批量读取 index blob header 类型或 size 非法',
    },
    { batchResponse: 'short-header', label: 'short header', message: '批量读取 index blob header 短流' },
    { batchResponse: 'short-payload', label: 'short payload', message: '批量读取 index blob 短流' },
    { batchResponse: 'missing-delimiter', label: 'missing delimiter', message: '批量读取 index blob 短流' },
    { batchResponse: 'bad-delimiter', label: 'bad delimiter', message: '批量读取 index blob 分隔符非法或短流' },
  ] as Array<{ batchResponse: Exclude<BatchResponse, 'happy' | 'hang'>; label: string; message: string }>)(
    'fails closed for a batch $label response without changing the index or sentinel',
    async ({ batchResponse, message }) => {
      const fixture = await initFixture('VALID_STAGED\n');
      const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-pre-commit-batch-sentinel-'));
      tempRoots.push(outside);
      const sentinel = path.join(outside, 'sentinel.txt');
      await fs.writeFile(sentinel, 'DO NOT TOUCH\n', 'utf8');
      const beforeHash = indexHash(fixture.index);
      const records = [
        {
          mode: '100644',
          object: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          path: 'src.ts',
        },
      ];

      const result = await runWithFakeIndexRecords(fixture, records, 'payload', {
        batchOnly: true,
        batchResponse,
      });

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(1);
      expect(result.stderr).toContain(message);
      expect(await fs.readFile(sentinel, 'utf8')).toBe('DO NOT TOUCH\n');
      expect(await fs.readFile(fixture.worktree, 'utf8')).toBe('VALID_STAGED\n');
      expect(gitShow(fixture.root, ':src.ts')).toBe('VALID_STAGED\n');
      expect(indexHash(fixture.index)).toBe(beforeHash);
      expect(await temporaryHookDirs(fixture.root)).toEqual([]);
    },
  );

  it('terminates the batch helper process tree on snapshot timeout and reclaims its temp dirs', async () => {
    const fixture = await initFixture('VALID_STAGED\n');
    const batchPidFile = path.join(fixture.root, 'batch.pid');
    const beforeHash = indexHash(fixture.index);
    const startedAt = Date.now();
    const result = await runWithFakeIndexRecords(
      fixture,
      [
        {
          mode: '100644',
          object: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          path: 'src.ts',
        },
      ],
      'payload',
      {
        batchOnly: true,
        batchPidFile,
        batchResponse: 'hang',
        snapshotTimeoutSeconds: 2,
      },
    );

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(124);
    expect(Date.now() - startedAt).toBeLessThan(10_000);
    expect(result.stderr).toContain('批量物化 index snapshot 超时（2s）');
    expect(result.stderr).toContain('终止进程树：批量物化 index snapshot');
    const batchPid = readFileSync(batchPidFile, 'utf8').trim();
    expect(batchPid).toMatch(/^\d+$/);
    const processProbe = spawnSync('bash', ['-c', 'kill -0 "$1"', 'batch-process-probe', batchPid], {
      encoding: 'utf8',
      input: '',
    });
    expect(processProbe.status).not.toBe(0);
    expect(await fs.readFile(fixture.worktree, 'utf8')).toBe('VALID_STAGED\n');
    expect(gitShow(fixture.root, ':src.ts')).toBe('VALID_STAGED\n');
    expect(indexHash(fixture.index)).toBe(beforeHash);
    expect(await temporaryHookDirs(fixture.root)).toEqual([]);
  });

  it.each([
    {
      label: 'parent symlink',
      message: 'snapshot 路径组件不是目录',
      records: [
        {
          mode: '120000',
          object: '1111111111111111111111111111111111111111',
          path: 'parent',
        },
        {
          mode: '100644',
          object: '2222222222222222222222222222222222222222',
          path: 'parent/child.ts',
        },
      ],
    },
    {
      label: 'nested symlink',
      message: 'snapshot 路径组件不是目录',
      records: [
        {
          mode: '120000',
          object: '3333333333333333333333333333333333333333',
          path: 'nested/link',
        },
        {
          mode: '100644',
          object: '4444444444444444444444444444444444444444',
          path: 'nested/link/child.ts',
        },
      ],
    },
    {
      label: 'absolute path',
      message: '拒绝越界 index 路径',
      records: [
        {
          mode: '100644',
          object: '5555555555555555555555555555555555555555',
          path: '/absolute.ts',
        },
      ],
    },
    {
      label: 'traversal path',
      message: '拒绝越界 index 路径',
      records: [
        {
          mode: '100644',
          object: '6666666666666666666666666666666666666666',
          path: 'nested/../../escape.ts',
        },
      ],
    },
  ])('fails closed for a staged $label record without touching an external sentinel', async ({ records, message }) => {
    const fixture = await initFixture('VALID_STAGED\n');
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-pre-commit-record-sentinel-'));
    tempRoots.push(outside);
    const sentinel = path.join(outside, 'sentinel.txt');
    await fs.writeFile(sentinel, 'DO NOT TOUCH\n', 'utf8');
    const beforeHash = indexHash(fixture.index);

    const result = await runWithFakeIndexRecords(fixture, records, sentinel.replaceAll('\\', '/'));

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(result.stderr).toContain(message);
    expect(await fs.readFile(sentinel, 'utf8')).toBe('DO NOT TOUCH\n');
    expect(await fs.readFile(fixture.worktree, 'utf8')).toBe('VALID_STAGED\n');
    expect(gitShow(fixture.root, ':src.ts')).toBe('VALID_STAGED\n');
    expect(indexHash(fixture.index)).toBe(beforeHash);
    expect(await temporaryHookDirs(fixture.root)).toEqual([]);
  });
});

it('materializes 200 staged blobs through one batch protocol within the snapshot budget', async () => {
  const fixture = await initFixture('VALID_STAGED\\n');
  const records = Array.from({ length: 200 }, (_, index) => ({
    mode: '100644',
    object: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    path: `bulk/${String(index).padStart(3, '0')}.md`,
  }));
  const startedAt = Date.now();

  const result = await runWithFakeIndexRecords(fixture, records, 'fixture blob\\n', {
    batchOnly: true,
  });

  expect(result.status, `${result.stdout}\\n${result.stderr}`).toBe(0);
  // This is deliberately well below the hook's 45 s snapshot budget while
  // leaving room for the Windows/WSL fixture filesystem.
  expect(Date.now() - startedAt).toBeLessThan(20_000);
  expect(result.stderr).toContain('批量物化 index snapshot');
  expect(await temporaryHookDirs(fixture.root)).toEqual([]);
});
