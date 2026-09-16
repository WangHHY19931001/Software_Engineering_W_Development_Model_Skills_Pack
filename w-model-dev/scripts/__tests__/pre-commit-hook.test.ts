import { spawnSync } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const hookSource = path.join(repoRoot, '.githooks', 'pre-commit');
const tempRoots: string[] = [];

function toBashPath(value: string): string {
  const normalized = value.replaceAll('\\', '/');
  return /^([A-Za-z]):\//.test(normalized)
    ? `/mnt/${normalized.slice(0, 1).toLowerCase()}${normalized.slice(2)}`
    : normalized;
}

async function makeFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-pre-commit-'));
  tempRoots.push(root);
  await fs.mkdir(path.join(root, '.githooks'), { recursive: true });
  await fs.mkdir(path.join(root, 'config'), { recursive: true });
  await fs.mkdir(path.join(root, 'node_modules', '.bin'), { recursive: true });
  await fs.copyFile(hookSource, path.join(root, '.githooks', 'pre-commit'));
  await fs.writeFile(path.join(root, 'config', 'prettier.config.cjs'), 'module.exports = {};\n', 'utf8');
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ private: true, scripts: { typecheck: 'node check-type.js' } }),
    'utf8',
  );
  await fs.writeFile(
    path.join(root, 'node_modules', '.bin', 'prettier'),
    '#!/usr/bin/env bash\nfor arg in "$@"; do\n  case "$arg" in\n    *.json) grep -q \'"ok":true\' "$arg" && exit 1 ;;\n  esac\ndone\nexit 0\n',
    'utf8',
  );
  await fs.chmod(path.join(root, 'node_modules', '.bin', 'prettier'), 0o755);
  await fs.writeFile(
    path.join(root, 'check-type.js'),
    [
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      "const source = fs.readFileSync(path.join(process.cwd(), 'src.ts'), 'utf8');",
      "process.exit(source === 'VALID_STAGED\\n' ? 0 : 1);",
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

function runHook(root: string, indexFile: string): ReturnType<typeof spawnSync> {
  const hookPath = toBashPath(path.join(root, '.githooks', 'pre-commit'));
  const shellQuote = (value: string): string => `'${value.replaceAll("'", "'\\\\''")}'`;
  return spawnSync('bash', ['-c', `bash ${shellQuote(hookPath)}`], {
    cwd: root,
    encoding: 'utf8',
    input: '',
    timeout: 60_000,
    env: { ...process.env, GIT_INDEX_FILE: toBashPath(indexFile) },
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
  });

  it('passes when staged content is valid and the worktree copy is invalid', async () => {
    const fixture = await initFixture('VALID_STAGED\n');
    await fs.writeFile(fixture.worktree, 'VALID_STAGED\n', 'utf8');
    git(fixture.root, ['add', 'src.ts']);
    await fs.writeFile(fixture.worktree, 'INVALID_WORKTREE\n', 'utf8');

    const result = runHook(fixture.root, fixture.index);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(await fs.readFile(fixture.worktree, 'utf8')).toBe('INVALID_WORKTREE\n');
    expect(existsSync(fixture.index)).toBe(true);
    expect(result.stderr).not.toContain('exit127');
    expect(result.stderr).not.toContain('EBUSY');
  });

  it('fails when staged content is invalid and the worktree copy is valid', async () => {
    const fixture = await initFixture('VALID_WORKTREE\n');
    await fs.writeFile(fixture.worktree, 'INVALID_STAGED\n', 'utf8');
    git(fixture.root, ['add', 'src.ts']);
    await fs.writeFile(fixture.worktree, 'VALID_WORKTREE\n', 'utf8');

    const result = runHook(fixture.root, fixture.index);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(await fs.readFile(fixture.worktree, 'utf8')).toBe('VALID_WORKTREE\n');
    expect(existsSync(fixture.index)).toBe(true);
  });
});
