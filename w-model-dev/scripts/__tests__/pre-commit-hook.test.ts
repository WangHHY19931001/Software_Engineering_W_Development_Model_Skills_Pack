import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, promises as fs, readFileSync, rmSync, symlinkSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const hookSource = path.join(repoRoot, '.githooks', 'pre-commit');
const tempRoots: string[] = [];

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

async function makeFixture(): Promise<string> {
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
    path.join(root, 'node_modules', '.bin', 'prettier'),
    [
      '#!/usr/bin/env bash',
      'config=""',
      'previous=""',
      'for arg in "$@"; do',
      '  if [ "$previous" = "--config" ]; then config="$arg"; fi',
      '  previous="$arg"',
      'done',
      'if [ -n "$config" ] && grep -q CONFIG_WORKTREE "$config"; then exit 1; fi',
      'for arg in "$@"; do',
      '  case "$arg" in',
      '    *.json) grep -q \'"ok":true\' "$arg" && exit 1 ;;',
      '    *src.ts) ',
      '      if [ -f .prettierignore ] && grep -qx source.ts .prettierignore; then continue; fi',
      '      grep -q INVALID_FORMAT "$arg" && exit 1 ;;',
      '  esac',
      'done',
      'exit 0',
      '',
    ].join('\n'),
    'utf8',
  );
  await fs.chmod(path.join(root, 'node_modules', '.bin', 'prettier'), 0o755);
  await fs.writeFile(
    path.join(root, 'test-bin', 'npx'),
    ['#!/usr/bin/env bash', 'printf "npx preflight invoked\\n" > "$PRECOMMIT_NPX_MARKER"', 'exit 99', ''].join('\n'),
    'utf8',
  );
  await fs.chmod(path.join(root, 'test-bin', 'npx'), 0o755);
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
    .filter(
      (entry) =>
        entry.isDirectory() &&
        (entry.name.startsWith('.pre-commit-snapshot.') || entry.name.startsWith('.pre-commit-blobs.')),
    )
    .map((entry) => entry.name);
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

function runHook(root: string, indexFile: string): ReturnType<typeof spawnSync> {
  const hookPath = toBashPath(path.join(root, '.githooks', 'pre-commit'));
  const bashCwd = toBashPath(root);
  const npxMarker = path.join(root, 'npx.marker');
  return spawnSync('bash', ['-c', `cd ${shellQuote(bashCwd)} && bash ${shellQuote(hookPath)}`], {
    cwd: root,
    encoding: 'utf8',
    input: '',
    timeout: 60_000,
    env: {
      ...process.env,
      GIT_INDEX_FILE: toBashPath(indexFile),
      PATH: `${toBashPath(path.join(root, 'test-bin'))}:${process.env.PATH ?? ''}`,
      PRECOMMIT_NPX_MARKER: toBashPath(npxMarker),
    },
  });
}

async function initFixture(source: string): Promise<{ root: string; index: string; worktree: string }> {
  const root = await makeFixture();
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
    const fixture = await initFixture('VALID_STAGED\n');
    const file = path.join(fixture.root, 'fixture.json');
    await fs.writeFile(file, '{\n  "ok": true\n}\n', 'utf8');
    git(fixture.root, ['add', 'fixture.json']);
    await fs.writeFile(file, '{"ok":true}\n', 'utf8');

    const result = runHook(fixture.root, fixture.index);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
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
  });
});
